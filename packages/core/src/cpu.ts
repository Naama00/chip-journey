import { ProcessorProfile, Mnemonic } from './profile';
import { InstructionMemory } from './instruction-memory';
import { Memory } from './state';
import { RegisterFile } from './state';
import { Circuit, addAlu } from './circuit';
import { decodeInstruction } from './decoder';
import { Signal } from './gates';
import { ExecutionContext, ExecutionHandler } from './execution';
import { Cache } from './cache';
import { CachedMemory } from './cached-memory';

export class CPU implements ExecutionContext {
  public pc = 0;
  public halted = false;

  private circuit: Circuit;
  private aIds: string[];
  private bIds: string[];
  private opSel0Id: string;
  private opSel1Id: string;
  private resultIds: string[] = [];
  private useCircuitAlu: boolean;
  private readonly cache: Cache;
  private readonly cachedMemory: CachedMemory;

  constructor(
    private profile: ProcessorProfile,
    private instrMem: InstructionMemory,
    private dataMem: Memory,
    private regFile: RegisterFile,
    private handlers: Record<Mnemonic, ExecutionHandler>,
    cacheLineCount: number = 4,
  ) {
    if (regFile.registerCount !== profile.registerCount || regFile.wordWidth !== profile.dataWidth) {
      throw new Error(
        `RegisterFile shape mismatch: expected ${profile.registerCount} registers of ${profile.dataWidth} bits`,
      );
    }

    this.circuit = new Circuit();
    this.aIds = [];
    this.bIds = [];
    this.opSel0Id = 'alu_opSel0';
    this.opSel1Id = 'alu_opSel1';
    this.useCircuitAlu = profile.dataWidth === 8;
    this.cache = new Cache(cacheLineCount, profile.dataWidth);
    this.cachedMemory = new CachedMemory(dataMem, this.cache);

    if (this.useCircuitAlu) {
      for (let i = 0; i < profile.dataWidth; i += 1) {
        const aId = `alu_a${i}`;
        const bId = `alu_b${i}`;
        this.aIds.push(aId);
        this.bIds.push(bId);
        this.circuit.addNode({ id: aId, kind: 'INPUT', inputs: [] });
        this.circuit.addNode({ id: bId, kind: 'INPUT', inputs: [] });
      }

      this.circuit.addNode({ id: this.opSel0Id, kind: 'INPUT', inputs: [] });
      this.circuit.addNode({ id: this.opSel1Id, kind: 'INPUT', inputs: [] });

      const aluOutput = addAlu(this.circuit, 'alu', this.aIds, this.bIds, this.opSel0Id, this.opSel1Id);
      this.resultIds = aluOutput.resultIds;
    }
  }

  private regName(n: number): string {
    return `R${n}`;
  }

  setPc(pc: number): void {
    this.pc = pc;
  }

  halt(): void {
    this.halted = true;
  }

  readReg(n: number): Signal[] {
    return this.regFile.read(this.regName(n));
  }

  writeReg(n: number, value: Signal[]): void {
    this.regFile.clockTick(this.regName(n), value);
  }

  readMem(addr: number): Signal[] {
    return this.cachedMemory.read(addr).value;
  }

  writeMem(addr: number, value: Signal[]): void {
    this.cachedMemory.write(addr, value);
  }

  public get cacheStats() {
    return {
      hitCount: this.cachedMemory.hitCount,
      missCount: this.cachedMemory.missCount,
      hitRate: this.cachedMemory.hitRate,
    };
  }

  runAlu(a: Signal[], b: Signal[], opSel0: Signal, opSel1: Signal) {
    if (this.useCircuitAlu) {
      this.setAluInputs(a, b, opSel0, opSel1);
      const values = this.circuit.evaluateAll();
      const result = this.resultIds.map((id) => values[id] as Signal);
      const carryOut = values['alu_carryOut'] as Signal;
      const zero = values['alu_zero'] as Signal;

      return { result, carryOut, zero };
    }

    const result: Signal[] = [];
    let carry = opSel0;

    if (opSel1 === 1) {
      for (let i = 0; i < a.length; i += 1) {
        if (opSel0 === 0) {
          result.push((a[i] & b[i]) as Signal);
        } else {
          result.push((a[i] | b[i]) as Signal);
        }
      }
    } else {
      for (let i = 0; i < a.length; i += 1) {
        const aBit = a[i];
        const bBit = opSel0 === 1 ? (b[i] ^ 1) as Signal : b[i];
        const sum = (aBit + bBit + carry) as number;
        result.push((sum % 2) as Signal);
        carry = sum > 1 ? 1 : 0;
      }
    }

    const zero = result.every((bit) => bit === 0) ? 1 : 0;
    return { result, carryOut: carry as Signal, zero: zero as Signal };
  }

  isZero(bits: Signal[]): boolean {
    return bits.every((bit) => bit === 0);
  }

  private setAluInputs(aBits: Signal[], bBits: Signal[], opSel0: Signal, opSel1: Signal): void {
    for (let i = 0; i < this.profile.dataWidth; i += 1) {
      this.circuit.setInput(this.aIds[i], aBits[i]);
      this.circuit.setInput(this.bIds[i], bBits[i]);
    }

    this.circuit.setInput(this.opSel0Id, opSel0);
    this.circuit.setInput(this.opSel1Id, opSel1);
  }

  private evaluateAlu(): Signal[] {
    const values = this.circuit.evaluateAll();
    return this.resultIds.map((id) => values[id] as Signal);
  }

  step(): void {
    if (this.halted) {
      throw new Error('Cannot step a halted CPU');
    }

    const instructionBits = this.instrMem.read(this.pc);
    const decoded = decodeInstruction(instructionBits, this.profile);
    const handler = this.handlers[decoded.mnemonic];

    if (!handler) {
      throw new Error(`No execution handler registered for mnemonic ${decoded.mnemonic}`);
    }

    handler(this, decoded.fields);
  }

  run(maxCycles: number): void {
    let cycles = 0;

    while (!this.halted) {
      if (cycles >= maxCycles) {
        throw new Error(`CPU did not halt within ${maxCycles} cycles`);
      }

      this.step();
      cycles += 1;
    }
  }
}

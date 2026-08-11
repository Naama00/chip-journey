import { ProcessorProfile } from './profile';
import { InstructionMemory } from './instruction-memory';
import { Memory } from './state';
import { RegisterFile } from './state';
import { Circuit } from './circuit';
import { addAlu } from './circuit';
import { decodeInstruction } from './decoder';
import { Signal } from './gates';
import { ExecutionContext, customHandlers } from './execution';

export class CPU implements ExecutionContext {
  public pc = 0;
  public halted = false;

  private circuit: Circuit;
  private aIds: string[];
  private bIds: string[];
  private opSelId: string;
  private resultIds: string[];

  constructor(
    private profile: ProcessorProfile,
    private instrMem: InstructionMemory,
    private dataMem: Memory,
    private regFile: RegisterFile,
  ) {
    if (regFile.registerCount !== profile.registerCount || regFile.wordWidth !== profile.dataWidth) {
      throw new Error(
        `RegisterFile shape mismatch: expected ${profile.registerCount} registers of ${profile.dataWidth} bits`,
      );
    }

    this.circuit = new Circuit();
    this.aIds = [];
    this.bIds = [];
    this.opSelId = 'alu_opSel';

    for (let i = 0; i < profile.dataWidth; i += 1) {
      const aId = `alu_a${i}`;
      const bId = `alu_b${i}`;
      this.aIds.push(aId);
      this.bIds.push(bId);
      this.circuit.addNode({ id: aId, kind: 'INPUT', inputs: [] });
      this.circuit.addNode({ id: bId, kind: 'INPUT', inputs: [] });
    }

    this.circuit.addNode({ id: this.opSelId, kind: 'INPUT', inputs: [] });

    const aluOutput = addAlu(this.circuit, 'alu', this.aIds, this.bIds, this.opSelId);
    this.resultIds = aluOutput.resultIds;
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
    return this.dataMem.read(addr);
  }

  writeMem(addr: number, value: Signal[]): void {
    this.dataMem.write(addr, value);
  }

  runAlu(a: Signal[], b: Signal[], opSel: Signal) {
    this.setAluInputs(a, b, opSel);
    const values = this.circuit.evaluateAll();
    const result = this.resultIds.map((id) => values[id] as Signal);
    const carryOut = values['alu_carryOut'] as Signal;
    const zero = values['alu_zero'] as Signal;

    return { result, carryOut, zero };
  }

  isZero(bits: Signal[]): boolean {
    return bits.every((bit) => bit === 0);
  }

  private setAluInputs(aBits: Signal[], bBits: Signal[], opSel: Signal): void {
    for (let i = 0; i < this.profile.dataWidth; i += 1) {
      this.circuit.setInput(this.aIds[i], aBits[i]);
      this.circuit.setInput(this.bIds[i], bBits[i]);
    }

    this.circuit.setInput(this.opSelId, opSel);
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
    const handler = customHandlers[decoded.mnemonic];

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

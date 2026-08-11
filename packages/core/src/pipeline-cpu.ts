import { ProcessorProfile } from './profile';
import { InstructionMemory } from './instruction-memory';
import { Memory, RegisterFile } from './state';
import { Circuit, addAlu } from './circuit';
import { decodeInstruction } from './decoder';
import { Signal } from './gates';
import { ExecutionContext } from './execution';
import { stageDecode, stageExecute, stageFetch, stageMemory, stageWriteback } from './pipeline-stages';
import { getRegisterDependencies, hasRawHazard } from './hazards';
import { makeExMemBubble, makeIdExBubble, makeIfIdBubble, makeMemWbBubble } from './pipeline-latches';

export class PipelineCPU implements ExecutionContext {
  public pc = 0;
  public halted = false;
  public finished = false;

  private _ifIdLatch = makeIfIdBubble();
  private _idExLatch = makeIdExBubble();
  private _exMemLatch = makeExMemBubble();
  private _memWbLatch = makeMemWbBubble();

  private haltSeen = false;
  private pendingFlush: number | null = null;
  private circuit: Circuit;
  private aIds: string[];
  private bIds: string[];
  private opSel0Id: string;
  private opSel1Id: string;
  private resultIds: string[] = [];
  private useCircuitAlu: boolean;

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
    this.opSel0Id = 'alu_opSel0';
    this.opSel1Id = 'alu_opSel1';
    this.useCircuitAlu = profile.dataWidth === 8;

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
    return this.dataMem.read(addr);
  }

  writeMem(addr: number, value: Signal[]): void {
    this.dataMem.write(addr, value);
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

  private computeStall(): boolean {
    if (this._ifIdLatch.isBubble) {
      return false;
    }

    const decoded = decodeInstruction(this._ifIdLatch.instructionBits, this.profile);
    const format = this.profile.instructionSet.find((entry) => entry.mnemonic === decoded.mnemonic);

    if (!format) {
      throw new Error(`Unknown instruction mnemonic during hazard check: ${decoded.mnemonic}`);
    }

    const { reads } = getRegisterDependencies(decoded, format);
    return hasRawHazard(reads, this._idExLatch, this._exMemLatch, this._memWbLatch);
  }

  step(): void {
    if (this.finished) {
      throw new Error('Cannot step a finished PipelineCPU');
    }

    const flushTargetFromLastCycle = this.pendingFlush;

    stageWriteback(this.memWbLatch, this);

    const newMemWb = stageMemory(this.exMemLatch, this);
    const newExMem = stageExecute(this.idExLatch, this.profile, this);
    if (newExMem.isBubble === false && newExMem.isHalt) {
      this.haltSeen = true;
    }

    let newIdEx = makeIdExBubble();
    let newIfId = this._ifIdLatch;

    if (flushTargetFromLastCycle !== null) {
      newIdEx = makeIdExBubble();
      this.pc = flushTargetFromLastCycle;
      this.pendingFlush = null;
      newIfId = this.haltSeen ? makeIfIdBubble() : stageFetch(this.pc, this.instrMem);
      if (!this.haltSeen) {
        this.pc += 1;
      }
    } else if (newExMem.isBubble === false && newExMem.branchTaken) {
      newIdEx = makeIdExBubble();
      // Overwrite any pending flush if a new branch resolves in EX before a
      // previous branch has fully drained. This simple model does not handle
      // overlapping taken branches inside the penalty window.
      this.pendingFlush = newExMem.branchTarget;
      newIfId = this.haltSeen ? makeIfIdBubble() : stageFetch(this.pc, this.instrMem);
      if (!this.haltSeen) {
        this.pc += 1;
      }
    } else {
      const stalling = this.computeStall();
      newIdEx = stalling ? makeIdExBubble() : stageDecode(this._ifIdLatch, this.profile, this);

      if (!stalling) {
        if (this.haltSeen) {
          newIfId = makeIfIdBubble();
        } else {
          newIfId = stageFetch(this.pc, this.instrMem);
          this.pc += 1;
        }
      } else {
        newIfId = this._ifIdLatch;
      }
    }

    this._ifIdLatch = newIfId;
    this._idExLatch = newIdEx;
    this._exMemLatch = newExMem;
    this._memWbLatch = newMemWb;

    if (this.haltSeen && this._ifIdLatch.isBubble && this._idExLatch.isBubble && this._exMemLatch.isBubble && this._memWbLatch.isBubble) {
      this.finished = true;
    }
  }

  get ifIdLatch() {
    return this._ifIdLatch;
  }

  get idExLatch() {
    return this._idExLatch;
  }

  get exMemLatch() {
    return this._exMemLatch;
  }

  get memWbLatch() {
    return this._memWbLatch;
  }

  run(maxCycles: number): void {
    let cycles = 0;

    while (!this.finished) {
      if (cycles >= maxCycles) {
        throw new Error(`PipelineCPU did not finish within ${maxCycles} cycles`);
      }

      this.step();
      cycles += 1;
    }
  }
}

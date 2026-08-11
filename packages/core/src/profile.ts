export interface FieldSpec {
  name: string;
  width: number;
}

export type Mnemonic =
  | 'ADD'
  | 'SUB'
  | 'LOAD'
  | 'STORE'
  | 'JUMP'
  | 'JZ'
  | 'HALT'
  | 'AND'
  | 'OR'
  | 'SLT'
  | 'ADDI'
  | 'LW'
  | 'SW'
  | 'BEQ'
  | 'J';

import { Signal } from './gates';

export interface InstructionFormat {
  mnemonic: Mnemonic;
  opcode: number;
  opcodeWidth: number;
  fields: FieldSpec[];
  dispatchField?: string;
  dispatchValue?: number;
  srcRegFields?: string[];
  destRegField?: string;
  aluOp?: { opSel0: Signal; opSel1: Signal };
  aluSecondOperand?: 'register' | 'immediate' | 'zero';
  aluImmediateField?: string;
  writesRegFrom?: 'alu' | 'memory' | 'aluSignBit';
  memOp?: 'read' | 'write';
  memAddressField?: string;
  controlFlow?: 'sequential' | 'jump' | 'branch' | 'halt';
  branchTargetKind?: 'absolute' | 'pcRelative';
  branchTargetField?: string;
  // The sum of opcodeWidth plus all field widths should be less than or equal to instructionWidth.
}

export interface ProcessorProfile {
  name: string;
  dataWidth: number;
  instructionWidth: number;
  registerCount: number;
  harvard: boolean;
  instructionSet: InstructionFormat[];
}

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

export interface InstructionFormat {
  mnemonic: Mnemonic;
  opcode: number;
  opcodeWidth: number;
  fields: FieldSpec[];
  dispatchField?: string;
  dispatchValue?: number;
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

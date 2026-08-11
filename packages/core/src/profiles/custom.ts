import { FieldSpec, InstructionFormat, ProcessorProfile } from '../profile';

const addFields: FieldSpec[] = [
  { name: 'rd', width: 2 },
  { name: 'rs1', width: 2 },
  { name: 'rs2', width: 2 },
];

const subFields: FieldSpec[] = [
  { name: 'rd', width: 2 },
  { name: 'rs1', width: 2 },
  { name: 'rs2', width: 2 },
];

const loadFields: FieldSpec[] = [
  { name: 'rd', width: 2 },
  { name: 'addr', width: 8 },
];

const storeFields: FieldSpec[] = [
  { name: 'rs', width: 2 },
  { name: 'addr', width: 8 },
];

const jumpFields: FieldSpec[] = [
  { name: 'addr', width: 8 },
];

const jzFields: FieldSpec[] = [
  { name: 'rs', width: 2 },
  { name: 'addr', width: 8 },
];

export const customProfile: ProcessorProfile = {
  name: 'Custom',
  dataWidth: 8,
  instructionWidth: 16,
  registerCount: 4,
  harvard: true,
  instructionSet: [
    {
      mnemonic: 'ADD',
      opcode: 0b0001,
      opcodeWidth: 4,
      fields: addFields,
      srcRegFields: ['rs1', 'rs2'],
      destRegField: 'rd',
      aluOp: { opSel0: 0, opSel1: 0 },
      aluSecondOperand: 'register',
      writesRegFrom: 'alu',
    },
    {
      mnemonic: 'SUB',
      opcode: 0b0010,
      opcodeWidth: 4,
      fields: subFields,
      srcRegFields: ['rs1', 'rs2'],
      destRegField: 'rd',
      aluOp: { opSel0: 1, opSel1: 0 },
      aluSecondOperand: 'register',
      writesRegFrom: 'alu',
    },
    {
      mnemonic: 'LOAD',
      opcode: 0b0011,
      opcodeWidth: 4,
      fields: loadFields,
      destRegField: 'rd',
      aluOp: { opSel0: 0, opSel1: 0 },
      aluSecondOperand: 'immediate',
      aluImmediateField: 'addr',
      writesRegFrom: 'memory',
      memOp: 'read',
      memAddressField: 'addr',
    },
    {
      mnemonic: 'STORE',
      opcode: 0b0100,
      opcodeWidth: 4,
      fields: storeFields,
      srcRegFields: ['rs'],
      aluOp: { opSel0: 0, opSel1: 0 },
      aluSecondOperand: 'immediate',
      aluImmediateField: 'addr',
      memOp: 'write',
      memAddressField: 'addr',
    },
    {
      mnemonic: 'JUMP',
      opcode: 0b0101,
      opcodeWidth: 4,
      fields: jumpFields,
      controlFlow: 'jump',
      branchTargetKind: 'absolute',
      branchTargetField: 'addr',
    },
    {
      mnemonic: 'JZ',
      opcode: 0b0110,
      opcodeWidth: 4,
      fields: jzFields,
      srcRegFields: ['rs'],
      aluOp: { opSel0: 1, opSel1: 0 },
      aluSecondOperand: 'zero',
      controlFlow: 'branch',
      branchTargetKind: 'absolute',
      branchTargetField: 'addr',
    },
    {
      mnemonic: 'HALT',
      opcode: 0b1111,
      opcodeWidth: 4,
      fields: [],
      controlFlow: 'halt',
    },
  ],
};

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
    { mnemonic: 'ADD', opcode: 0b0001, opcodeWidth: 4, fields: addFields },
    { mnemonic: 'SUB', opcode: 0b0010, opcodeWidth: 4, fields: subFields },
    { mnemonic: 'LOAD', opcode: 0b0011, opcodeWidth: 4, fields: loadFields },
    { mnemonic: 'STORE', opcode: 0b0100, opcodeWidth: 4, fields: storeFields },
    { mnemonic: 'JUMP', opcode: 0b0101, opcodeWidth: 4, fields: jumpFields },
    { mnemonic: 'JZ', opcode: 0b0110, opcodeWidth: 4, fields: jzFields },
    { mnemonic: 'HALT', opcode: 0b1111, opcodeWidth: 4, fields: [] },
  ],
};

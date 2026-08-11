import { Mnemonic } from '../profile';
import { signExtendImmediate, numberToTwosComplementBits, twosComplementBitsToNumber } from '../signed';
import { ExecutionContext, ExecutionHandler, makeArithmeticHandler, customHandlers } from '../execution';

export const mipsHandlers: Record<Mnemonic, ExecutionHandler> = {
  ADD: makeArithmeticHandler(0, 0, 'rd', 'rs', 'rt'),

  SUB: makeArithmeticHandler(1, 0, 'rd', 'rs', 'rt'),

  AND: makeArithmeticHandler(0, 1, 'rd', 'rs', 'rt'),

  OR: makeArithmeticHandler(1, 1, 'rd', 'rs', 'rt'),

  SLT(ctx, fields) {
    const left = ctx.readReg(fields.rs);
    const right = ctx.readReg(fields.rt);
    const { result } = ctx.runAlu(left, right, 1, 0);
    // Simplified sign-bit comparison; real hardware handles overflow edge cases.
    const lessThan = result[result.length - 1] === 1 ? 1 : 0;
    ctx.writeReg(fields.rd, numberToTwosComplementBits(lessThan, result.length));
    ctx.setPc(ctx.pc + 1);
  },

  ADDI(ctx, fields) {
    const value = ctx.readReg(fields.rs);
    const immediate = signExtendImmediate(fields.immediate, 16);
    const extended = numberToTwosComplementBits(immediate, value.length);
    const { result } = ctx.runAlu(value, extended, 0, 0);
    ctx.writeReg(fields.rt, result);
    ctx.setPc(ctx.pc + 1);
  },

  LW(ctx, fields) {
    const base = ctx.readReg(fields.rs);
    const immediate = signExtendImmediate(fields.immediate, 16);
    const offset = numberToTwosComplementBits(immediate, base.length);
    const { result } = ctx.runAlu(base, offset, 0, 0);
    const address = twosComplementBitsToNumber(result);
    const value = ctx.readMem(address);
    ctx.writeReg(fields.rt, value);
    ctx.setPc(ctx.pc + 1);
  },

  SW(ctx, fields) {
    const base = ctx.readReg(fields.rs);
    const immediate = signExtendImmediate(fields.immediate, 16);
    const offset = numberToTwosComplementBits(immediate, base.length);
    const { result } = ctx.runAlu(base, offset, 0, 0);
    const address = twosComplementBitsToNumber(result);
    const value = ctx.readReg(fields.rt);
    ctx.writeMem(address, value);
    ctx.setPc(ctx.pc + 1);
  },

  BEQ(ctx, fields) {
    const left = ctx.readReg(fields.rs);
    const right = ctx.readReg(fields.rt);
    const equal = left.length === right.length && left.every((bit, index) => bit === right[index]);

    if (equal) {
      const offset = signExtendImmediate(fields.immediate, 16);
      ctx.setPc(ctx.pc + 1 + offset);
    } else {
      ctx.setPc(ctx.pc + 1);
    }
  },

  J(ctx, fields) {
    // Simplified direct instruction addressing; real MIPS uses pseudo-direct byte-aligned addresses.
    ctx.setPc(fields.address);
  },

  HALT: customHandlers.HALT,
};

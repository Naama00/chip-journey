import { Mnemonic } from './profile';
import { Signal } from './gates';

export interface ExecutionContext {
  readonly pc: number;
  setPc(pc: number): void;
  halt(): void;
  readReg(n: number): Signal[];
  writeReg(n: number, value: Signal[]): void;
  readMem(addr: number): Signal[];
  writeMem(addr: number, value: Signal[]): void;
  runAlu(a: Signal[], b: Signal[], opSel0: Signal, opSel1: Signal): {
    result: Signal[];
    carryOut: Signal;
    zero: Signal;
  };
  isZero(bits: Signal[]): boolean;
}

export type ExecutionHandler = (ctx: ExecutionContext, fields: Record<string, number>) => void;

export function makeArithmeticHandler(
  opSel0: Signal,
  opSel1: Signal,
  rdField: string,
  rs1Field: string,
  rs2Field: string,
): ExecutionHandler {
  return (ctx, fields) => {
    const left = ctx.readReg(fields[rs1Field]);
    const right = ctx.readReg(fields[rs2Field]);
    const { result } = ctx.runAlu(left, right, opSel0, opSel1);
    ctx.writeReg(fields[rdField], result);
    ctx.setPc(ctx.pc + 1);
  };
}

export const customHandlers: Partial<Record<Mnemonic, ExecutionHandler>> = {
  ADD: makeArithmeticHandler(0, 0, 'rd', 'rs1', 'rs2'),

  SUB: makeArithmeticHandler(1, 0, 'rd', 'rs1', 'rs2'),


  LOAD(ctx, fields) {
    const value = ctx.readMem(fields.addr);
    ctx.writeReg(fields.rd, value);
    ctx.setPc(ctx.pc + 1);
  },

  STORE(ctx, fields) {
    const value = ctx.readReg(fields.rs);
    ctx.writeMem(fields.addr, value);
    ctx.setPc(ctx.pc + 1);
  },

  JUMP(ctx, fields) {
    ctx.setPc(fields.addr);
  },

  JZ(ctx, fields) {
    const value = ctx.readReg(fields.rs);
    if (ctx.isZero(value)) {
      ctx.setPc(fields.addr);
    } else {
      ctx.setPc(ctx.pc + 1);
    }
  },

  HALT(ctx) {
    ctx.halt();
  },
};

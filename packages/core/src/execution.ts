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
  runAlu(a: Signal[], b: Signal[], opSel: Signal): {
    result: Signal[];
    carryOut: Signal;
    zero: Signal;
  };
  isZero(bits: Signal[]): boolean;
}

export type ExecutionHandler = (ctx: ExecutionContext, fields: Record<string, number>) => void;

export const customHandlers: Record<Mnemonic, ExecutionHandler> = {
  ADD(ctx, fields) {
    const rs1 = ctx.readReg(fields.rs1);
    const rs2 = ctx.readReg(fields.rs2);
    const { result } = ctx.runAlu(rs1, rs2, 0);
    ctx.writeReg(fields.rd, result);
    ctx.setPc(ctx.pc + 1);
  },

  SUB(ctx, fields) {
    const rs1 = ctx.readReg(fields.rs1);
    const rs2 = ctx.readReg(fields.rs2);
    const { result } = ctx.runAlu(rs1, rs2, 1);
    ctx.writeReg(fields.rd, result);
    ctx.setPc(ctx.pc + 1);
  },

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

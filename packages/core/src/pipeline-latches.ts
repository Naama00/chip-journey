import { DecodedInstruction } from './decoder';
import { Signal } from './gates';

export type IfIdLatch =
  | { isBubble: true }
  | { isBubble: false; instructionBits: Signal[]; pc: number };

export type IdExLatch =
  | { isBubble: true }
  | {
      isBubble: false;
      decoded: DecodedInstruction;
      pc: number;
      regValues: Record<string, Signal[]>;
      destReg: number | null;
    };

export type ExMemLatch =
  | { isBubble: true }
  | {
      isBubble: false;
      aluResult: Signal[];
      destReg: number | null;
      memoryOp: 'read' | 'write' | 'none';
      memoryAddress: number | null;
      storeValue: Signal[] | null;
      // Branch information is computed in EX for the upcoming flush milestone.
      // This stage records it, but the pipeline orchestrator will handle
      // any misprediction flushes later.
      branchTaken: boolean;
      branchTarget: number | null;
      isHalt: boolean;
    };

export type MemWbLatch =
  | { isBubble: true }
  | { isBubble: false; writeValue: Signal[]; destReg: number | null };

export function makeIfIdBubble(): IfIdLatch {
  return { isBubble: true };
}

export function makeIdExBubble(): IdExLatch {
  return { isBubble: true };
}

export function makeExMemBubble(): ExMemLatch {
  return { isBubble: true };
}

export function makeMemWbBubble(): MemWbLatch {
  return { isBubble: true };
}

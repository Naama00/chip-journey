import { decodeInstruction } from './decoder';
import { ExecutionContext } from './execution';
import { InstructionMemory } from './instruction-memory';
import { getRegisterDependencies } from './hazards';
import {
  makeExMemBubble,
  makeIdExBubble,
  makeMemWbBubble,
  ExMemLatch,
  IdExLatch,
  IfIdLatch,
  MemWbLatch,
} from './pipeline-latches';
import { ProcessorProfile } from './profile';
import { numberToTwosComplementBits, signExtendImmediate, twosComplementBitsToNumber } from './signed';
import { Signal } from './gates';

export function stageFetch(pc: number, instrMem: InstructionMemory): IfIdLatch {
  return {
    isBubble: false,
    instructionBits: instrMem.read(pc),
    pc,
  };
}

export function stageDecode(ifIdLatch: IfIdLatch, profile: ProcessorProfile, ctx: ExecutionContext): IdExLatch {
  if (ifIdLatch.isBubble) {
    return makeIdExBubble();
  }

  const decoded = decodeInstruction(ifIdLatch.instructionBits, profile);
  const format = profile.instructionSet.find((entry) => entry.mnemonic === decoded.mnemonic);

  if (!format) {
    throw new Error(`Unknown instruction mnemonic during decode: ${decoded.mnemonic}`);
  }

  const { reads } = getRegisterDependencies(decoded, format);
  const regValues: Record<string, Signal[]> = {};

  for (let index = 0; index < (format.srcRegFields ?? []).length; index += 1) {
    const fieldName = format.srcRegFields![index];
    const registerNumber = reads[index];
    regValues[fieldName] = ctx.readReg(registerNumber);
  }

  const destReg = format.destRegField ? decoded.fields[format.destRegField] : null;

  return {
    isBubble: false,
    decoded,
    pc: ifIdLatch.pc,
    regValues,
    destReg,
  };
}

export function stageExecute(idExLatch: IdExLatch, profile: ProcessorProfile, ctx: ExecutionContext): ExMemLatch {
  if (idExLatch.isBubble) {
    return makeExMemBubble();
  }

  const format = profile.instructionSet.find((entry) => entry.mnemonic === idExLatch.decoded.mnemonic);
  if (!format) {
    throw new Error(`Unknown instruction mnemonic during execute: ${idExLatch.decoded.mnemonic}`);
  }

  let aluResult: Signal[] = Array.from({ length: profile.dataWidth }, () => 0 as Signal);
  let zero = false;

  if (format.aluOp) {
    const firstOperand = idExLatch.regValues[format.srcRegFields?.[0] ?? ''] ?? Array.from({ length: profile.dataWidth }, () => 0 as Signal);
    let secondOperand: Signal[];

    switch (format.aluSecondOperand) {
      case 'register':
        secondOperand = idExLatch.regValues[format.srcRegFields?.[1] ?? ''] ?? Array.from({ length: profile.dataWidth }, () => 0 as Signal);
        break;
      case 'immediate': {
        const immediateField = format.aluImmediateField;
        if (!immediateField) {
          throw new Error('aluSecondOperand is immediate but no aluImmediateField is defined');
        }
        const rawImmediate = idExLatch.decoded.fields[immediateField];
        const immediateWidth = format.fields.find((field) => field.name === immediateField)?.width ?? profile.dataWidth;
        const signed = signExtendImmediate(rawImmediate, immediateWidth);
        secondOperand = numberToTwosComplementBits(signed, profile.dataWidth);
        break;
      }
      case 'zero':
        secondOperand = Array.from({ length: profile.dataWidth }, () => 0 as Signal);
        break;
      default:
        secondOperand = Array.from({ length: profile.dataWidth }, () => 0 as Signal);
    }

    const alu = ctx.runAlu(firstOperand, secondOperand, format.aluOp.opSel0, format.aluOp.opSel1);
    aluResult = alu.result;
    zero = alu.zero === 1;
  }

  let memoryOp: 'read' | 'write' | 'none' = 'none';
  if (format.memOp === 'read') {
    memoryOp = 'read';
  } else if (format.memOp === 'write') {
    memoryOp = 'write';
  }

  const memoryAddress = format.memAddressField
    ? idExLatch.decoded.fields[format.memAddressField]
    : format.memOp
    ? twosComplementBitsToNumber(aluResult)
    : null;

  const storeValue = format.memOp === 'write' ? idExLatch.regValues[format.srcRegFields?.[format.srcRegFields.length - 1] ?? ''] ?? null : null;

  const branchTaken = format.controlFlow === 'jump' || (format.controlFlow === 'branch' && zero);

  let branchTarget: number | null = null;
  if (format.controlFlow === 'jump' || format.controlFlow === 'branch') {
    const targetField = format.branchTargetField;
    if (!targetField) {
      throw new Error('branch instruction requires branchTargetField');
    }

    if (format.branchTargetKind === 'pcRelative') {
      const rawTarget = idExLatch.decoded.fields[targetField];
      const extension = signExtendImmediate(rawTarget, format.fields.find((field) => field.name === targetField)?.width ?? profile.dataWidth);
      branchTarget = idExLatch.pc + 1 + extension;
    } else {
      branchTarget = idExLatch.decoded.fields[targetField];
    }
  }

  return {
    isBubble: false,
    aluResult,
    destReg: idExLatch.destReg,
    memoryOp,
    memoryAddress,
    storeValue,
    branchTaken,
    branchTarget,
    isHalt: format.controlFlow === 'halt',
  };
}

export function stageMemory(exMemLatch: ExMemLatch, ctx: ExecutionContext): MemWbLatch {
  if (exMemLatch.isBubble) {
    return makeMemWbBubble();
  }

  if (exMemLatch.memoryOp === 'write' && exMemLatch.memoryAddress !== null && exMemLatch.storeValue !== null) {
    ctx.writeMem(exMemLatch.memoryAddress, exMemLatch.storeValue);
  }

  const writeValue = exMemLatch.memoryOp === 'read' && exMemLatch.memoryAddress !== null ? ctx.readMem(exMemLatch.memoryAddress) : exMemLatch.aluResult;

  return {
    isBubble: false,
    writeValue,
    destReg: exMemLatch.destReg,
  };
}

export function stageWriteback(memWbLatch: MemWbLatch, ctx: ExecutionContext): void {
  if (memWbLatch.isBubble || memWbLatch.destReg === null) {
    return;
  }

  ctx.writeReg(memWbLatch.destReg, memWbLatch.writeValue);
}

import { DecodedInstruction } from './decoder';
import { InstructionFormat } from './profile';
import { ExMemLatch, IdExLatch, MemWbLatch } from './pipeline-latches';

export function getRegisterDependencies(
  decoded: DecodedInstruction,
  format: InstructionFormat,
): { reads: number[]; writes: number[] } {
  const reads = (format.srcRegFields ?? []).map((fieldName) => decoded.fields[fieldName]);
  const writes = format.destRegField ? [decoded.fields[format.destRegField]] : [];

  return {
    reads,
    writes,
  };
}

function isHazardRegister(register: number | null, srcRegs: number[]): boolean {
  if (register === null || register === 0) {
    return false;
  }

  return srcRegs.some((srcReg) => srcReg !== 0 && srcReg === register);
}

export function hasRawHazard(
  srcRegs: number[],
  idExLatch: IdExLatch,
  exMemLatch: ExMemLatch,
  memWbLatch: MemWbLatch,
): boolean {
  if (idExLatch.isBubble === false && isHazardRegister(idExLatch.destReg, srcRegs)) {
    return true;
  }

  if (exMemLatch.isBubble === false && isHazardRegister(exMemLatch.destReg, srcRegs)) {
    return true;
  }

  if (memWbLatch.isBubble === false && isHazardRegister(memWbLatch.destReg, srcRegs)) {
    return true;
  }

  return false;
}

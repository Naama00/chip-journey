export type Signal = 0 | 1;

export function evaluateAnd(a: Signal, b: Signal): Signal {
  if (a === 1 && b === 1) {
    return 1;
  }

  return 0;
}

export function evaluateOr(a: Signal, b: Signal): Signal {
  if (a === 1 || b === 1) {
    return 1;
  }

  return 0;
}

export function evaluateNot(a: Signal): Signal {
  if (a === 0) {
    return 1;
  }

  return 0;
}

export function evaluateXor(a: Signal, b: Signal): Signal {
  const orResult = evaluateOr(a, b);
  const andResult = evaluateAnd(a, b);
  const notAndResult = evaluateNot(andResult);

  const xorResult = evaluateAnd(orResult, notAndResult);
  return xorResult;
}

import { Signal, evaluateAnd, evaluateNot, evaluateOr, evaluateXor } from './gates';

export type GateKind = 'AND' | 'OR' | 'NOT' | 'XOR' | 'INPUT';

export interface CircuitNode {
  id: string;
  kind: GateKind;
  inputs: string[];
}

export class Circuit {
  private nodes = new Map<string, CircuitNode>();
  private inputValues = new Map<string, Signal>();

  addNode(node: CircuitNode): void {
    this.nodes.set(node.id, node);
  }

  setInput(id: string, value: Signal): void {
    const node = this.nodes.get(id);

    if (!node) {
      throw new Error(`Node "${id}" does not exist`);
    }

    if (node.kind !== 'INPUT') {
      throw new Error(`Node "${id}" is not an INPUT node`);
    }

    this.inputValues.set(id, value);
  }

  evaluate(id: string): Signal {
    return this.evaluateNode(id, new Set<string>());
  }

  evaluateAll(): Record<string, Signal> {
    const results: Record<string, Signal> = {};

    for (const id of this.nodes.keys()) {
      results[id] = this.evaluate(id);
    }

    return results;
  }

  private evaluateNode(id: string, visiting: Set<string>): Signal {
    if (visiting.has(id)) {
      throw new Error(`Circuit contains a cycle at node "${id}"`);
    }

    const node = this.nodes.get(id);

    if (!node) {
      throw new Error(`Node "${id}" does not exist`);
    }

    visiting.add(id);

    let value: Signal;

    if (node.kind === 'INPUT') {
      if (!this.inputValues.has(id)) {
        throw new Error(`Input node "${id}" has no value`);
      }

      value = this.inputValues.get(id)!;
    } else {
      const inputSignals = node.inputs.map((inputId) => this.evaluateNode(inputId, visiting));
      value = this.evaluateGate(node.kind, inputSignals);
    }

    visiting.delete(id);
    return value;
  }

  private evaluateGate(kind: GateKind, inputs: Signal[]): Signal {
    switch (kind) {
      case 'AND':
        if (inputs.length !== 2) {
          throw new Error('AND gate requires exactly 2 inputs');
        }
        return evaluateAnd(inputs[0], inputs[1]);
      case 'OR':
        if (inputs.length !== 2) {
          throw new Error('OR gate requires exactly 2 inputs');
        }
        return evaluateOr(inputs[0], inputs[1]);
      case 'NOT':
        if (inputs.length !== 1) {
          throw new Error('NOT gate requires exactly 1 input');
        }
        return evaluateNot(inputs[0]);
      case 'XOR':
        if (inputs.length !== 2) {
          throw new Error('XOR gate requires exactly 2 inputs');
        }
        return evaluateXor(inputs[0], inputs[1]);
      case 'INPUT':
        throw new Error('INPUT gate cannot be evaluated as a computed gate');
      default:
        throw new Error(`Unknown gate kind: ${kind}`);
    }
  }
}

export function addFullAdder(
  circuit: Circuit,
  prefix: string,
  aId: string,
  bId: string,
  cinId: string,
): { sumId: string; carryOutId: string } {
  const xor1Id = `${prefix}_xor1`;
  const and1Id = `${prefix}_and1`;
  const sumId = `${prefix}_sum`;
  const and2Id = `${prefix}_and2`;
  const carryOutId = `${prefix}_carryOut`;

  circuit.addNode({ id: xor1Id, kind: 'XOR', inputs: [aId, bId] });
  circuit.addNode({ id: and1Id, kind: 'AND', inputs: [aId, bId] });
  circuit.addNode({ id: sumId, kind: 'XOR', inputs: [xor1Id, cinId] });
  circuit.addNode({ id: and2Id, kind: 'AND', inputs: [xor1Id, cinId] });
  circuit.addNode({ id: carryOutId, kind: 'OR', inputs: [and1Id, and2Id] });

  return { sumId, carryOutId };
}

export function addMux2(
  circuit: Circuit,
  prefix: string,
  selId: string,
  xId: string,
  yId: string,
): string {
  const notSelId = `${prefix}_notSel`;
  const andXId = `${prefix}_andX`;
  const andYId = `${prefix}_andY`;
  const outputId = `${prefix}_out`;

  circuit.addNode({ id: notSelId, kind: 'NOT', inputs: [selId] });
  circuit.addNode({ id: andXId, kind: 'AND', inputs: [notSelId, xId] });
  circuit.addNode({ id: andYId, kind: 'AND', inputs: [selId, yId] });
  circuit.addNode({ id: outputId, kind: 'OR', inputs: [andXId, andYId] });

  return outputId;
}

export function addAlu(
  circuit: Circuit,
  prefix: string,
  aIds: string[],
  bIds: string[],
  opSel0Id: string,
  opSel1Id: string,
): { resultIds: string[]; carryOutId: string; zeroId: string } {
  if (aIds.length !== 8 || bIds.length !== 8) {
    throw new Error('addAlu requires exactly 8 aIds and 8 bIds');
  }

  const muxedBIds: string[] = [];

  for (let i = 0; i < 8; i += 1) {
    const notBId = `${prefix}_notB${i}`;
    circuit.addNode({ id: notBId, kind: 'NOT', inputs: [bIds[i]] });

    const muxedBId = addMux2(circuit, `${prefix}_muxB${i}`, opSel0Id, bIds[i], notBId);
    muxedBIds.push(muxedBId);
  }

  const { sumIds, carryOutId } = addRippleCarryAdder(circuit, `${prefix}_adder`, aIds, muxedBIds, opSel0Id);

  const booleanResultIds: string[] = [];

  for (let i = 0; i < 8; i += 1) {
    const andId = `${prefix}_and${i}`;
    const orId = `${prefix}_or${i}`;

    circuit.addNode({ id: andId, kind: 'AND', inputs: [aIds[i], bIds[i]] });
    circuit.addNode({ id: orId, kind: 'OR', inputs: [aIds[i], bIds[i]] });

    const andOrId = addMux2(circuit, `${prefix}_muxAndOr${i}`, opSel0Id, andId, orId);
    const resultId = addMux2(circuit, `${prefix}_muxArithBool${i}`, opSel1Id, sumIds[i], andOrId);

    booleanResultIds.push(resultId);
  }

  let previousOrId = booleanResultIds[0];
  for (let i = 1; i < booleanResultIds.length; i += 1) {
    const orId = `${prefix}_zeroOr${i}`;
    circuit.addNode({ id: orId, kind: 'OR', inputs: [previousOrId, booleanResultIds[i]] });
    previousOrId = orId;
  }

  const zeroId = `${prefix}_zero`;
  circuit.addNode({ id: zeroId, kind: 'NOT', inputs: [previousOrId] });

  return { resultIds: booleanResultIds, carryOutId, zeroId };
}

export function addRippleCarryAdder(
  circuit: Circuit,
  prefix: string,
  aIds: string[],
  bIds: string[],
  carryInId: string,
): { sumIds: string[]; carryOutId: string } {
  if (aIds.length !== 8 || bIds.length !== 8) {
    throw new Error('addRippleCarryAdder requires exactly 8 aIds and 8 bIds');
  }

  const sumIds: string[] = [];
  let currentCarryId = carryInId;
  let finalCarryOutId = carryInId;

  for (let i = 0; i < 8; i += 1) {
    const bitPrefix = `${prefix}_bit${i}`;
    const { sumId, carryOutId } = addFullAdder(circuit, bitPrefix, aIds[i], bIds[i], currentCarryId);

    sumIds.push(sumId);
    currentCarryId = carryOutId;
    finalCarryOutId = carryOutId;
  }

  return { sumIds, carryOutId: finalCarryOutId };
}

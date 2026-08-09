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

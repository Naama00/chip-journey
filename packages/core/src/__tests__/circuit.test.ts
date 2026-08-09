import { describe, it, expect } from 'vitest';
import { Circuit, CircuitNode } from '../circuit';
import { Signal } from '../gates';

describe('Circuit', () => {
  it('evaluates a half-adder with AND and XOR gates', () => {
    const circuit = new Circuit();

    const nodes: CircuitNode[] = [
      { id: 'a', kind: 'INPUT', inputs: [] },
      { id: 'b', kind: 'INPUT', inputs: [] },
      { id: 'sum', kind: 'XOR', inputs: ['a', 'b'] },
      { id: 'carry', kind: 'AND', inputs: ['a', 'b'] },
    ];

    for (const node of nodes) {
      circuit.addNode(node);
    }

    const cases: Array<{ a: Signal; b: Signal; expectedSum: Signal; expectedCarry: Signal }> = [
      { a: 0, b: 0, expectedSum: 0, expectedCarry: 0 },
      { a: 0, b: 1, expectedSum: 1, expectedCarry: 0 },
      { a: 1, b: 0, expectedSum: 1, expectedCarry: 0 },
      { a: 1, b: 1, expectedSum: 0, expectedCarry: 1 },
    ];

    for (const testCase of cases) {
      circuit.setInput('a', testCase.a);
      circuit.setInput('b', testCase.b);

      const sum = circuit.evaluate('sum');
      const carry = circuit.evaluate('carry');

      expect(sum).toBe(testCase.expectedSum);
      expect(carry).toBe(testCase.expectedCarry);
    }
  });

  it('throws when the circuit contains a cycle', () => {
    const circuit = new Circuit();

    circuit.addNode({ id: 'A', kind: 'XOR', inputs: ['B', 'A'] });
    circuit.addNode({ id: 'B', kind: 'AND', inputs: ['A', 'A'] });

    expect(() => circuit.evaluate('A')).toThrowError('Circuit contains a cycle at node "A"');
  });
});

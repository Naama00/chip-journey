import { describe, it, expect } from 'vitest';
import { Circuit, CircuitNode, addFullAdder, addRippleCarryAdder, addMux2, addAlu } from '../circuit';
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

  it('evaluates a full-adder built from two half-adders', () => {
    const circuit = new Circuit();

    const nodes: CircuitNode[] = [
      { id: 'a', kind: 'INPUT', inputs: [] },
      { id: 'b', kind: 'INPUT', inputs: [] },
      { id: 'cin', kind: 'INPUT', inputs: [] },
    ];

    for (const node of nodes) {
      circuit.addNode(node);
    }

    const { sumId, carryOutId } = addFullAdder(circuit, 'fa', 'a', 'b', 'cin');

    const cases: Array<{ a: Signal; b: Signal; cin: Signal; expectedSum: Signal; expectedCarry: Signal }> = [
      { a: 0, b: 0, cin: 0, expectedSum: 0, expectedCarry: 0 },
      { a: 0, b: 0, cin: 1, expectedSum: 1, expectedCarry: 0 },
      { a: 0, b: 1, cin: 0, expectedSum: 1, expectedCarry: 0 },
      { a: 0, b: 1, cin: 1, expectedSum: 0, expectedCarry: 1 },
      { a: 1, b: 0, cin: 0, expectedSum: 1, expectedCarry: 0 },
      { a: 1, b: 0, cin: 1, expectedSum: 0, expectedCarry: 1 },
      { a: 1, b: 1, cin: 0, expectedSum: 0, expectedCarry: 1 },
      { a: 1, b: 1, cin: 1, expectedSum: 1, expectedCarry: 1 },
    ];

    for (const testCase of cases) {
      circuit.setInput('a', testCase.a);
      circuit.setInput('b', testCase.b);
      circuit.setInput('cin', testCase.cin);

      const sum = circuit.evaluate(sumId);
      const carryOut = circuit.evaluate(carryOutId);

      expect(sum).toBe(testCase.expectedSum);
      expect(carryOut).toBe(testCase.expectedCarry);
    }
  });

  describe('addRippleCarryAdder', () => {
    function numberToBits(value: number): Signal[] {
      const bits: Signal[] = [];
      for (let i = 0; i < 8; i += 1) {
        bits.push((value >> i) & 1 ? 1 : 0);
      }
      return bits;
    }

    function setInputBits(circuit: Circuit, ids: string[], bits: Signal[]) {
      for (let i = 0; i < ids.length; i += 1) {
        circuit.setInput(ids[i], bits[i]);
      }
    }

    it('adds an 8-bit ripple-carry adder and computes correct sums', () => {
      const circuit = new Circuit();
      const aIds: string[] = [];
      const bIds: string[] = [];

      for (let i = 0; i < 8; i += 1) {
        aIds.push(`a${i}`);
        bIds.push(`b${i}`);
        circuit.addNode({ id: `a${i}`, kind: 'INPUT', inputs: [] });
        circuit.addNode({ id: `b${i}`, kind: 'INPUT', inputs: [] });
      }

      circuit.addNode({ id: 'carryIn', kind: 'INPUT', inputs: [] });

      const { sumIds, carryOutId } = addRippleCarryAdder(circuit, 'ripple', aIds, bIds, 'carryIn');

      const cases: Array<{ a: number; b: number; expectedSum: number; expectedCarryOut: Signal }> = [
        { a: 0, b: 0, expectedSum: 0, expectedCarryOut: 0 },
        { a: 1, b: 1, expectedSum: 2, expectedCarryOut: 0 },
        { a: 255, b: 1, expectedSum: 0, expectedCarryOut: 1 },
      ];

      for (const testCase of cases) {
        const aBits = numberToBits(testCase.a);
        const bBits = numberToBits(testCase.b);

        setInputBits(circuit, aIds, aBits);
        setInputBits(circuit, bIds, bBits);
        circuit.setInput('carryIn', 0);

        const values = circuit.evaluateAll();
        const sumBits = sumIds.map((sumId) => values[sumId] as Signal);
        const expectedBits = numberToBits(testCase.expectedSum);

        expect(sumBits).toEqual(expectedBits);
        expect(values[carryOutId]).toBe(testCase.expectedCarryOut);
      }
    });
  });

  describe('addMux2', () => {
    it('selects x when sel is 0 and y when sel is 1', () => {
      const circuit = new Circuit();

      circuit.addNode({ id: 'sel', kind: 'INPUT', inputs: [] });
      circuit.addNode({ id: 'x', kind: 'INPUT', inputs: [] });
      circuit.addNode({ id: 'y', kind: 'INPUT', inputs: [] });

      const outId = addMux2(circuit, 'mux', 'sel', 'x', 'y');

      const cases: Array<{ sel: Signal; x: Signal; y: Signal; expected: Signal }> = [
        { sel: 0, x: 0, y: 0, expected: 0 },
        { sel: 0, x: 1, y: 0, expected: 1 },
        { sel: 1, x: 0, y: 1, expected: 1 },
        { sel: 1, x: 1, y: 0, expected: 0 },
      ];

      for (const testCase of cases) {
        circuit.setInput('sel', testCase.sel);
        circuit.setInput('x', testCase.x);
        circuit.setInput('y', testCase.y);

        const output = circuit.evaluate(outId);
        expect(output).toBe(testCase.expected);
      }
    });
  });

  describe('addAlu', () => {
    function numberToBits(value: number): Signal[] {
      const bits: Signal[] = [];
      for (let i = 0; i < 8; i += 1) {
        bits.push((value >> i) & 1 ? 1 : 0);
      }
      return bits;
    }

    function setInputBits(circuit: Circuit, ids: string[], bits: Signal[]) {
      for (let i = 0; i < ids.length; i += 1) {
        circuit.setInput(ids[i], bits[i]);
      }
    }

    it('performs 5 + 3 = 8 when opSelId is 0', () => {
      const circuit = new Circuit();
      const aIds: string[] = [];
      const bIds: string[] = [];

      for (let i = 0; i < 8; i += 1) {
        aIds.push(`a${i}`);
        bIds.push(`b${i}`);
        circuit.addNode({ id: `a${i}`, kind: 'INPUT', inputs: [] });
        circuit.addNode({ id: `b${i}`, kind: 'INPUT', inputs: [] });
      }

      circuit.addNode({ id: 'opSel0', kind: 'INPUT', inputs: [] });
      circuit.addNode({ id: 'opSel1', kind: 'INPUT', inputs: [] });

      const { resultIds, carryOutId, zeroId } = addAlu(circuit, 'alu', aIds, bIds, 'opSel0', 'opSel1');

      setInputBits(circuit, aIds, numberToBits(5));
      setInputBits(circuit, bIds, numberToBits(3));
      circuit.setInput('opSel0', 0);
      circuit.setInput('opSel1', 0);

      const values = circuit.evaluateAll();
      const resultBits = resultIds.map((id) => values[id] as Signal);

      expect(resultBits).toEqual(numberToBits(8));
      expect(values[carryOutId]).toBe(0);
      expect(values[zeroId]).toBe(0);
    });

    it('performs 5 - 3 = 2 when opSelId is 1', () => {
      const circuit = new Circuit();
      const aIds: string[] = [];
      const bIds: string[] = [];

      for (let i = 0; i < 8; i += 1) {
        aIds.push(`a${i}`);
        bIds.push(`b${i}`);
        circuit.addNode({ id: `a${i}`, kind: 'INPUT', inputs: [] });
        circuit.addNode({ id: `b${i}`, kind: 'INPUT', inputs: [] });
      }

      circuit.addNode({ id: 'opSel0', kind: 'INPUT', inputs: [] });
      circuit.addNode({ id: 'opSel1', kind: 'INPUT', inputs: [] });

      const { resultIds, zeroId } = addAlu(circuit, 'alu', aIds, bIds, 'opSel0', 'opSel1');

      setInputBits(circuit, aIds, numberToBits(5));
      setInputBits(circuit, bIds, numberToBits(3));
      circuit.setInput('opSel0', 1);
      circuit.setInput('opSel1', 0);

      const values = circuit.evaluateAll();
      const resultBits = resultIds.map((id) => values[id] as Signal);

      expect(resultBits).toEqual(numberToBits(2));
      expect(values[zeroId]).toBe(0);
    });

    it('performs 5 AND 3 = 1 when opSel1 is 1 and opSel0 is 0', () => {
      const circuit = new Circuit();
      const aIds: string[] = [];
      const bIds: string[] = [];

      for (let i = 0; i < 8; i += 1) {
        aIds.push(`a${i}`);
        bIds.push(`b${i}`);
        circuit.addNode({ id: `a${i}`, kind: 'INPUT', inputs: [] });
        circuit.addNode({ id: `b${i}`, kind: 'INPUT', inputs: [] });
      }

      circuit.addNode({ id: 'opSel0', kind: 'INPUT', inputs: [] });
      circuit.addNode({ id: 'opSel1', kind: 'INPUT', inputs: [] });

      const { resultIds, zeroId } = addAlu(circuit, 'alu', aIds, bIds, 'opSel0', 'opSel1');

      setInputBits(circuit, aIds, numberToBits(5));
      setInputBits(circuit, bIds, numberToBits(3));
      circuit.setInput('opSel0', 0);
      circuit.setInput('opSel1', 1);

      const values = circuit.evaluateAll();
      const resultBits = resultIds.map((id) => values[id] as Signal);

      expect(resultBits).toEqual(numberToBits(1));
      expect(values[zeroId]).toBe(0);
    });

    it('performs 5 OR 3 = 7 when opSel1 is 1 and opSel0 is 1', () => {
      const circuit = new Circuit();
      const aIds: string[] = [];
      const bIds: string[] = [];

      for (let i = 0; i < 8; i += 1) {
        aIds.push(`a${i}`);
        bIds.push(`b${i}`);
        circuit.addNode({ id: `a${i}`, kind: 'INPUT', inputs: [] });
        circuit.addNode({ id: `b${i}`, kind: 'INPUT', inputs: [] });
      }

      circuit.addNode({ id: 'opSel0', kind: 'INPUT', inputs: [] });
      circuit.addNode({ id: 'opSel1', kind: 'INPUT', inputs: [] });

      const { resultIds, zeroId } = addAlu(circuit, 'alu', aIds, bIds, 'opSel0', 'opSel1');

      setInputBits(circuit, aIds, numberToBits(5));
      setInputBits(circuit, bIds, numberToBits(3));
      circuit.setInput('opSel0', 1);
      circuit.setInput('opSel1', 1);

      const values = circuit.evaluateAll();
      const resultBits = resultIds.map((id) => values[id] as Signal);

      expect(resultBits).toEqual(numberToBits(7));
      expect(values[zeroId]).toBe(0);
    });

    it('sets zero flag when result is zero', () => {
      const circuit = new Circuit();
      const aIds: string[] = [];
      const bIds: string[] = [];

      for (let i = 0; i < 8; i += 1) {
        aIds.push(`a${i}`);
        bIds.push(`b${i}`);
        circuit.addNode({ id: `a${i}`, kind: 'INPUT', inputs: [] });
        circuit.addNode({ id: `b${i}`, kind: 'INPUT', inputs: [] });
      }

      circuit.addNode({ id: 'opSel0', kind: 'INPUT', inputs: [] });
      circuit.addNode({ id: 'opSel1', kind: 'INPUT', inputs: [] });

      const { resultIds, zeroId } = addAlu(circuit, 'alu', aIds, bIds, 'opSel0', 'opSel1');

      setInputBits(circuit, aIds, numberToBits(5));
      setInputBits(circuit, bIds, numberToBits(5));
      circuit.setInput('opSel0', 1);
      circuit.setInput('opSel1', 0);

      const values = circuit.evaluateAll();
      const resultBits = resultIds.map((id) => values[id] as Signal);

      expect(resultBits).toEqual(numberToBits(0));
      expect(values[zeroId]).toBe(1);
    });

    it('clears zero flag when result is not zero', () => {
      const circuit = new Circuit();
      const aIds: string[] = [];
      const bIds: string[] = [];

      for (let i = 0; i < 8; i += 1) {
        aIds.push(`a${i}`);
        bIds.push(`b${i}`);
        circuit.addNode({ id: `a${i}`, kind: 'INPUT', inputs: [] });
        circuit.addNode({ id: `b${i}`, kind: 'INPUT', inputs: [] });
      }

      circuit.addNode({ id: 'opSel0', kind: 'INPUT', inputs: [] });
      circuit.addNode({ id: 'opSel1', kind: 'INPUT', inputs: [] });

      const { resultIds, zeroId } = addAlu(circuit, 'alu', aIds, bIds, 'opSel0', 'opSel1');

      setInputBits(circuit, aIds, numberToBits(6));
      setInputBits(circuit, bIds, numberToBits(3));
      circuit.setInput('opSel0', 1);
      circuit.setInput('opSel1', 0);

      const values = circuit.evaluateAll();
      const resultBits = resultIds.map((id) => values[id] as Signal);

      expect(resultBits).toEqual(numberToBits(3));
      expect(values[zeroId]).toBe(0);
    });
  });

  it('throws when the circuit contains a cycle', () => {
    const circuit = new Circuit();

    circuit.addNode({ id: 'A', kind: 'XOR', inputs: ['B', 'A'] });
    circuit.addNode({ id: 'B', kind: 'AND', inputs: ['A', 'A'] });

    expect(() => circuit.evaluate('A')).toThrowError('Circuit contains a cycle at node "A"');
  });
});

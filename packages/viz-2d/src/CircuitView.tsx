import { useEffect, useRef, useState } from 'react';
import { Circuit, CircuitNode } from '@chip-journey/core/src/circuit';
import { Signal } from '@chip-journey/core/src/gates';

const nodeLayout: Record<string, { x: number; y: number }> = {
  a: { x: 80, y: 60 },
  b: { x: 80, y: 180 },
  sum: { x: 260, y: 60 },
  carry: { x: 260, y: 180 },
};

const nodeSize = {
  inputRadius: 24,
  gateWidth: 120,
  gateHeight: 60,
};

const activeColor = '#4ade80';
const inactiveColor = '#94a3b8';
const textColor = '#0f172a';

function getNodeColor(value: Signal) {
  return value === 1 ? activeColor : inactiveColor;
}

export default function CircuitView() {
  const circuitRef = useRef<Circuit | null>(null);
  const [signalValues, setSignalValues] = useState<Record<string, Signal>>({});

  useEffect(() => {
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

    circuit.setInput('a', 0);
    circuit.setInput('b', 0);

    circuitRef.current = circuit;
    setSignalValues(circuit.evaluateAll());
  }, []);

  const handleInputClick = (id: string) => {
    const circuit = circuitRef.current;
    if (!circuit) {
      return;
    }

    const currentValue = signalValues[id];
    const newValue: Signal = currentValue === 1 ? 0 : 1;

    circuit.setInput(id, newValue);
    setSignalValues(circuit.evaluateAll());
  };

  const renderLink = (sourceId: string, targetId: string) => {
    const source = nodeLayout[sourceId];
    const target = nodeLayout[targetId];
    const sourceX = source.x + nodeSize.inputRadius;
    const sourceY = source.y;
    const targetX = target.x - nodeSize.gateWidth / 2;
    const targetY = target.y;
    const value = signalValues[sourceId] ?? 0;

    return (
      <line
        key={`${sourceId}-${targetId}`}
        x1={sourceX}
        y1={sourceY}
        x2={targetX}
        y2={targetY}
        stroke={getNodeColor(value)}
        strokeWidth={4}
        strokeLinecap="round"
      />
    );
  };

  const inputNodes: Array<{ id: string; label: string }> = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ];

  const gateNodes: Array<{ id: string; label: string }> = [
    { id: 'sum', label: 'SUM' },
    { id: 'carry', label: 'CARRY' },
  ];

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', color: textColor }}>
      <h1>Chip Journey: Half Adder</h1>
      <svg width={420} height={280} style={{ background: '#fcfcfd', border: '1px solid #e2e8f0', borderRadius: 12 }}>
        {['sum', 'carry'].flatMap((targetId) =>
          ['a', 'b'].map((sourceId) => renderLink(sourceId, targetId)),
        )}

        {inputNodes.map(({ id, label }) => {
          const position = nodeLayout[id];
          const value = signalValues[id] ?? 0;
          return (
            <g key={id}>
              <circle
                cx={position.x}
                cy={position.y}
                r={nodeSize.inputRadius}
                fill={getNodeColor(value)}
                stroke="#0f172a"
                strokeWidth={2}
                style={{ cursor: 'pointer' }}
                onClick={() => handleInputClick(id)}
              />
              <text x={position.x} y={position.y + 6} textAnchor="middle" fill={textColor} fontSize={20} fontWeight="700">
                {label}
              </text>
              <text x={position.x} y={position.y + 28} textAnchor="middle" fill={textColor} fontSize={12}>
                {signalValues[id] ?? 0}
              </text>
            </g>
          );
        })}

        {gateNodes.map(({ id, label }) => {
          const position = nodeLayout[id];
          const value = signalValues[id] ?? 0;
          return (
            <g key={id}>
              <rect
                x={position.x - nodeSize.gateWidth / 2}
                y={position.y - nodeSize.gateHeight / 2}
                width={nodeSize.gateWidth}
                height={nodeSize.gateHeight}
                rx={12}
                fill={getNodeColor(value)}
                stroke="#0f172a"
                strokeWidth={2}
              />
              <text x={position.x} y={position.y - 8} textAnchor="middle" fill={textColor} fontSize={16} fontWeight="700">
                {label}
              </text>
              <text x={position.x} y={position.y + 16} textAnchor="middle" fill={textColor} fontSize={14}>
                {signalValues[id] ?? 0}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

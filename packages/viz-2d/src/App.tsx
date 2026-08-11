import { useState } from 'react';
import CircuitView from './CircuitView';
import PipelineView from './PipelineView';

const tabs = ['Half-Adder', 'Pipeline'] as const;

type Tab = (typeof tabs)[number];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('Half-Adder');

  return (
    <div style={{ fontFamily: 'sans-serif', color: '#0f172a' }}>
      <div style={{ display: 'flex', gap: 12, padding: 16, background: '#f8fafc' }}>
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 16px',
              borderRadius: 999,
              border: activeTab === tab ? '2px solid #0ea5e9' : '1px solid #cbd5e1',
              background: activeTab === tab ? '#bae6fd' : '#ffffff',
              cursor: 'pointer',
              fontWeight: activeTab === tab ? 700 : 500,
            }}
          >
            {tab}
          </button>
        ))}
      </div>
      <div style={{ padding: 16 }}>
        {activeTab === 'Half-Adder' ? <CircuitView /> : <PipelineView />}
      </div>
    </div>
  );
}

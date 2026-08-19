import PipelineScene3D from './PipelineScene3D';
import DatapathScene3D from './DatapathScene3D';
import { useState } from 'react';

export default function App() {
  const [view, setView] = useState<'pipeline' | 'datapath'>('pipeline');
  return (
    <div>
      <div style={{ position: 'absolute', left: 12, top: 12, zIndex: 20 }}>
        <button onClick={() => setView('pipeline')} style={{ marginRight: 8 }}>
          Pipeline View
        </button>
        <button onClick={() => setView('datapath')}>Datapath View</button>
      </div>
      {view === 'pipeline' ? <PipelineScene3D /> : <DatapathScene3D />}
    </div>
  );
}

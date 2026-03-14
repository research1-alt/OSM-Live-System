
import React from 'react';
// Changed CANMessage to CANFrame to resolve "no exported member" error as defined in types.ts
import { CANFrame } from '../types';

interface TraceTableProps {
  messages: CANFrame[];
}

const TraceTable: React.FC<TraceTableProps> = ({ messages }) => {
  return (
    <div className="flex-1 overflow-auto bg-slate-900/50 rounded-lg border border-slate-700">
      <table className="w-full text-left text-xs mono border-collapse">
        <thead className="sticky top-0 bg-slate-800 text-slate-400 uppercase font-bold border-b border-slate-700">
          <tr>
            <th className="px-4 py-2">ID (Hex)</th>
            <th className="px-4 py-2">DLC</th>
            <th className="px-4 py-2">Data Bytes</th>
            <th className="px-4 py-2">Count</th>
            <th className="px-4 py-2">Cycle (ms)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {messages.map((msg, i) => (
            <tr key={`${msg.id}-${i}`} className="hover:bg-slate-800/50 transition-colors">
              <td className="px-4 py-2 text-emerald-400 font-bold">{msg.id}</td>
              <td className="px-4 py-2 text-slate-300">{msg.dlc}</td>
              <td className="px-4 py-2 text-blue-300 tracking-widest">
                {msg.data.join(' ')}
              </td>
              <td className="px-4 py-2 text-slate-500">{msg.count}</td>
              {/* Updated msg.period to msg.periodMs to match CANFrame interface property name */}
              <td className="px-4 py-2 text-amber-500">{msg.periodMs || '--'}</td>
            </tr>
          ))}
          {messages.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-slate-500 italic">
                Waiting for CAN traffic...
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default TraceTable;

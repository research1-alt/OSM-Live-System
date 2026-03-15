
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { CANFrame } from '../types';

interface TraceTableProps {
  messages: CANFrame[];
}

const ROW_HEIGHT = 32; // Fixed height for each row in pixels
const VISIBLE_ROWS = 25; // Number of rows to render at once

const TraceTable: React.FC<TraceTableProps> = ({ messages }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Handle scroll to update visible window
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // Auto-scroll to bottom if we are already near the bottom
  useEffect(() => {
    if (containerRef.current) {
      const { scrollHeight, clientHeight, scrollTop } = containerRef.current;
      const isNearBottom = scrollHeight - clientHeight - scrollTop < 100;
      if (isNearBottom) {
        containerRef.current.scrollTop = scrollHeight;
      }
    }
  }, [messages.length]);

  const { startIndex, endIndex, translateY } = useMemo(() => {
    const start = Math.floor(scrollTop / ROW_HEIGHT);
    const startIndex = Math.max(0, start - 5); // Buffer of 5 rows above
    const endIndex = Math.min(messages.length, startIndex + VISIBLE_ROWS + 10); // Buffer of 10 rows below
    return {
      startIndex,
      endIndex,
      translateY: startIndex * ROW_HEIGHT
    };
  }, [scrollTop, messages.length]);

  const visibleMessages = messages.slice(startIndex, endIndex);
  const totalHeight = messages.length * ROW_HEIGHT;

  return (
    <div 
      ref={containerRef}
      onScroll={onScroll}
      className="flex-1 overflow-auto bg-slate-900/50 rounded-lg border border-slate-700 relative"
      style={{ minHeight: '300px' }}
    >
      <table className="w-full text-left text-xs mono border-collapse">
        <thead className="sticky top-0 bg-slate-800 text-slate-400 uppercase font-bold border-b border-slate-700 z-10">
          <tr style={{ height: ROW_HEIGHT }}>
            <th className="px-4 py-2 w-24">ID (Hex)</th>
            <th className="px-4 py-2 w-16">DLC</th>
            <th className="px-4 py-2">Data Bytes</th>
            <th className="px-4 py-2 w-20">Count</th>
            <th className="px-4 py-2 w-24">Cycle (ms)</th>
          </tr>
        </thead>
        <tbody>
          {/* Spacer to push content down to the correct scroll position */}
          <tr style={{ height: translateY }}>
            <td colSpan={5} style={{ padding: 0 }}></td>
          </tr>
          
          {visibleMessages.map((msg, i) => (
            <tr 
              key={`${msg.id}-${startIndex + i}`} 
              className="hover:bg-slate-800/50 transition-colors border-b border-slate-800/50"
              style={{ height: ROW_HEIGHT }}
            >
              <td className="px-4 py-1 text-emerald-400 font-bold truncate">{msg.id}</td>
              <td className="px-4 py-1 text-slate-300">{msg.dlc}</td>
              <td className="px-4 py-1 text-blue-300 tracking-widest whitespace-nowrap overflow-hidden">
                {msg.data.join(' ')}
              </td>
              <td className="px-4 py-1 text-slate-500">{msg.count}</td>
              <td className="px-4 py-1 text-amber-500">{msg.periodMs || '--'}</td>
            </tr>
          ))}

          {/* Spacer to maintain total scroll height */}
          <tr style={{ height: Math.max(0, totalHeight - translateY - (visibleMessages.length * ROW_HEIGHT)) }}>
            <td colSpan={5} style={{ padding: 0 }}></td>
          </tr>

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

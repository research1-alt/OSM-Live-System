
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CANFrame, ConversionLibrary } from '@/types';
import { Terminal, Lock, Unlock, RefreshCw, Clock, Timer, Info, Save, Loader2 } from 'lucide-react';

interface CANMonitorProps {
  frames: CANFrame[];
  isPaused: boolean;
  library: ConversionLibrary;
  onClearTrace?: () => void;
  onSaveTrace?: () => void;
  isSaving?: boolean;
}

const CANMonitor: React.FC<CANMonitorProps> = ({ 
  frames, 
  isPaused, 
  onClearTrace, 
  onSaveTrace,
  isSaving = false
}) => {
  const [autoScroll, setAutoScroll] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [timeMode, setTimeMode] = useState<'relative' | 'absolute'>('relative');
  const scrollRef = useRef<HTMLDivElement>(null);

  const displayFrames = useMemo(() => {
    if (frames.length <= 1000) return frames;
    return frames.slice(-1000);
  }, [frames]);

  useEffect(() => {
    if (autoScroll && !isPaused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayFrames, isPaused, autoScroll]);

  const handleReload = () => {
    setIsResetting(true);
    onClearTrace?.();
    setTimeout(() => setIsResetting(false), 800);
  };

  const headerLine = ";---+--  ---+----  ---+--  ---------+--  -+- +- +- -- -- -- -- -- -- -- --";

  const renderClassicHeaders = () => (
    <div className="sticky top-0 bg-white z-20 pt-4 pb-2 select-none font-mono text-[13px] text-slate-400 whitespace-pre border-b border-slate-100">
      <div className="mb-0.5">;   Message   Time      Type ID              Rx/Tx</div>
      <div className="mb-0.5">{";   Number    " + (timeMode === 'relative' ? 'Offset    ' : 'System    ') + "|    [hex]           |  Data Length"}</div>
      <div className="mb-0.5">;   |         [ms]      |    |               |  |  Data [hex] ...</div>
      <div className="mb-0.5">;   |         |         |    |               |  |  | </div>
      <div className="text-slate-200">{headerLine}</div>
    </div>
  );

  const formatClassicRow = (frame: CANFrame, indexInDisplay: number) => {
    const actualIndex = frames.length > 1000 ? (frames.length - 1000 + indexInDisplay + 1) : (indexInDisplay + 1);
    const msgNum = actualIndex.toString().padStart(7, ' ');
    const timeStr = (timeMode === 'relative' ? (frame.timestamp / 1000).toFixed(6) : new Date(frame.absoluteTimestamp).toLocaleTimeString('en-GB', { hour12: false }) + "." + new Date(frame.absoluteTimestamp).getMilliseconds().toString().padStart(3, '0')).padStart(12, ' ');
    const type = "DT".padStart(6, ' ');
    const id = frame.id.replace('0x', '').toUpperCase().padStart(12, ' ');
    const rxtx = frame.direction.padStart(3, ' ');
    const dlc = frame.dlc.toString().padStart(2, ' ');
    const dataBytes = frame.data.map(d => d.padStart(2, '0')).join(' ');

    return (
      <div key={`${frame.absoluteTimestamp}-${actualIndex}`} className="flex hover:bg-slate-50 transition-colors leading-tight h-5 items-center font-mono text-[13px] text-slate-800 whitespace-pre">
        <span>{" " + msgNum + "  " + timeStr + "  " + type + "  "}</span>
        <span className="text-indigo-600 font-bold">{id}</span>
        <span>{"  " + rxtx + " " + dlc + " "}</span>
        <span className="text-emerald-600">{dataBytes}</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-xl relative overflow-visible">
      <div className="bg-slate-50 px-6 py-2.5 flex justify-between items-center border-b border-slate-200 shrink-0 z-[100]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-white rounded border border-slate-200 text-[9px] font-orbitron font-black text-indigo-600 shadow-sm">
            <Terminal size={10} /> TRACE_VIEW_HUD
          </div>
          
          <button 
            onClick={onSaveTrace}
            disabled={frames.length === 0 || isSaving}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[9px] font-orbitron font-black uppercase transition-all border shadow-sm ${
              isSaving 
                ? 'bg-indigo-600 text-white border-indigo-700 animate-pulse' 
                : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-500/50 hover:text-emerald-600'
            } disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {isSaving ? 'SAVING_BUFFER...' : 'SAVE_TRACE'}
          </button>

          <button onClick={() => setTimeMode(timeMode === 'relative' ? 'absolute' : 'relative')} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[8px] font-orbitron font-black uppercase transition-all border bg-white border-slate-200 text-slate-600 hover:border-indigo-600/50 hover:text-indigo-600 shadow-sm">
            {timeMode === 'relative' ? <Timer size={10} /> : <Clock size={10} />}
            {timeMode === 'relative' ? 'RELATIVE_TIME' : 'SYSTEM_TIME'}
          </button>
          
          <button onClick={() => setAutoScroll(!autoScroll)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[8px] font-orbitron font-black uppercase transition-all border shadow-sm ${autoScroll ? 'bg-indigo-600 border-indigo-700 text-white shadow-md' : 'bg-white border-slate-200 text-slate-400'}`}>
            {autoScroll ? <Unlock size={10} /> : <Lock size={10} />}
            {autoScroll ? 'AUTO_SCROLL' : 'SCROLL_LOCKED'}
          </button>
          
          <button onClick={handleReload} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[8px] font-orbitron font-black uppercase transition-all border active:scale-95 shadow-sm ${isResetting ? 'bg-red-500 text-white border-red-600' : 'bg-red-50 hover:bg-red-100 border-red-200 text-red-600'}`} disabled={isResetting}>
            <RefreshCw size={10} className={isResetting ? "animate-spin" : ""} />
            {isResetting ? 'PURGING...' : 'RELOAD'}
          </button>
        </div>
        <div className="text-[8px] font-orbitron font-black text-slate-300 uppercase tracking-[0.3em] hidden md:flex items-center gap-2">
          <Info size={10} className="text-indigo-400" /> RECENT_STREAM_WINDOW
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar bg-white font-mono min-h-0 z-10">
        <div className="p-4 min-w-[1000px] text-slate-800 relative h-full">
          {renderClassicHeaders()}
          <div className="pt-2 space-y-0.5 pb-8 overflow-y-visible">
            {!isResetting && displayFrames.map((frame, idx) => formatClassicRow(frame, idx))}
          </div>
        </div>
        {(frames.length === 0 || isResetting) && !isPaused && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 z-40 pointer-events-none">
             <div className="relative mb-6">
               <div className="w-16 h-16 border-2 border-dashed border-indigo-200 rounded-full animate-spin"></div>
               <Terminal size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-200" />
             </div>
            <p className="text-[10px] font-orbitron font-black text-indigo-400 uppercase tracking-[0.4em]">{isResetting ? 'CLEARING_LOGS' : 'AWAITING_TRAFFIC'}</p>
          </div>
        )}
      </div>

      <div className="bg-slate-50 px-6 py-2 border-t border-slate-200 flex justify-between items-center text-[8px] font-orbitron font-black text-slate-400 uppercase tracking-widest shrink-0 z-[60]">
        <div className="flex gap-6">
          <span>PCAN_VIEW_COMPATIBLE: 100%</span>
          <span className="text-indigo-600 font-bold">BUFFER_USAGE: {frames.length.toLocaleString()} FRAMES</span>
          {isSaving && (
            <div className="flex items-center gap-2 text-indigo-600 font-bold ml-4">
               <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse"></div>
               EXPORT_ACTIVE: DO NOT DISCONNECT
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CANMonitor;

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CANFrame, ConversionLibrary } from '@/types';
import { Terminal, Lock, Unlock, RefreshCw, Clock, Timer, Info, Save, Loader2, Zap } from 'lucide-react';

interface CANMonitorProps {
  frames: CANFrame[];
  isPaused: boolean;
  library: ConversionLibrary;
  onClearTrace?: () => void;
  onSaveTrace?: () => void;
  isSaving?: boolean;
  autoSaveEnabled?: boolean;
  onToggleAutoSave?: () => void;
}

const CANMonitor: React.FC<CANMonitorProps> = ({ 
  frames, 
  isPaused, 
  onClearTrace, 
  onSaveTrace,
  isSaving = false,
  autoSaveEnabled = false,
  onToggleAutoSave
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

  const headerLine = ";---+-- ------+------ +- --+----- +- +- +- +- -- -- -- -- -- -- --";

  const renderClassicHeaders = () => (
    <div className="sticky top-0 bg-white z-20 pt-2 pb-1 select-none font-mono text-[10px] md:text-[13px] text-slate-400 whitespace-pre border-b border-slate-100">
      <div className="mb-0.5">;   Message   Time    Type ID     Rx/Tx</div>
      <div className="mb-0.5">{";   Number    " + (timeMode === 'relative' ? 'Offset  ' : 'System  ') + "|    [hex]  |  Data Length"}</div>
      <div className="mb-0.5">;   |         [ms]    |    |      |  |  Data [hex] ...</div>
      <div className="mb-0.5">;   |         |       |    |      |  |  |</div>
      <div className="text-slate-200">{headerLine}</div>
    </div>
  );

  const formatClassicRow = (frame: CANFrame, indexInDisplay: number) => {
    const actualIndex = frames.length > 1000 ? (frames.length - 1000 + indexInDisplay + 1) : (indexInDisplay + 1);
    const msgNum = actualIndex.toString().padStart(7, ' ');
    const timeVal = (frame.timestamp / 1000);
    const timeStr = (timeMode === 'relative' ? timeVal.toFixed(3) : new Date(frame.absoluteTimestamp).toLocaleTimeString('en-GB', { hour12: false })).padStart(13, ' ');
    const type = "DT";
    const id = frame.id.replace('0x', '').toUpperCase().padStart(8, ' ');
    const rxtx = frame.direction.padStart(2, ' ');
    const dlc = frame.dlc.toString().padStart(1, ' ');
    const dataBytes = frame.data.map(d => d.padStart(2, '0')).join(' ');

    return (
      <div key={`${frame.absoluteTimestamp}-${actualIndex}`} className="flex hover:bg-slate-50 transition-colors leading-tight h-5 items-center font-mono text-[10px] md:text-[13px] text-slate-800 whitespace-pre">
        <span>{msgNum + " " + timeStr + " " + type + " " + id + " " + rxtx + " " + dlc + "  "}</span>
        <span className="text-emerald-600">{dataBytes}</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow relative overflow-hidden min-h-0">
      <div className="bg-slate-50 px-3 md:px-6 py-2 md:py-2.5 flex flex-wrap justify-between items-center border-b border-slate-200 shrink-0 z-[100] gap-2">
        <div className="flex flex-wrap items-center gap-2 md:gap-4">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded border border-slate-200 text-[8px] md:text-[9px] font-orbitron font-black text-indigo-600 shadow-sm">
            <Terminal size={10} /> <span className="hidden xs:inline">TRACE_HUD</span>
          </div>
          
          <button 
            onClick={onSaveTrace}
            disabled={frames.length === 0 || isSaving}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[8px] md:text-[9px] font-orbitron font-black uppercase transition-all border shadow-sm ${
              isSaving ? 'bg-indigo-600 text-white animate-pulse' : 'bg-white text-slate-600'
            } disabled:opacity-30`}
          >
            {isSaving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
            <span className="hidden sm:inline">SAVE</span>
          </button>

          <button 
            onClick={onToggleAutoSave}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[8px] md:text-[9px] font-orbitron font-black uppercase transition-all border shadow-sm ${
              autoSaveEnabled ? 'bg-emerald-600 text-white' : 'bg-white text-slate-400'
            }`}
          >
            <Zap size={10} className={autoSaveEnabled ? 'animate-pulse' : ''} />
            <span className="hidden sm:inline">AUTO</span>
          </button>

          <button onClick={() => setTimeMode(timeMode === 'relative' ? 'absolute' : 'relative')} className="p-1.5 rounded-lg text-slate-600 bg-white border border-slate-200">
            {timeMode === 'relative' ? <Timer size={12} /> : <Clock size={12} />}
          </button>
          
          <button onClick={() => setAutoScroll(!autoScroll)} className={`p-1.5 rounded-lg border ${autoScroll ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-400 border-slate-200'}`}>
            {autoScroll ? <Unlock size={12} /> : <Lock size={12} />}
          </button>
          
          <button onClick={handleReload} className={`p-1.5 rounded-lg border ${isResetting ? 'bg-red-500 text-white border-red-600' : 'bg-red-50 text-red-600 border-red-200'}`} disabled={isResetting}>
            <RefreshCw size={12} className={isResetting ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar bg-white font-mono min-h-0 z-10 relative">
        <div className="p-2 md:p-4 min-w-[700px] md:min-w-[1000px] text-slate-800 relative h-full">
          {renderClassicHeaders()}
          <div className="pt-2 space-y-0.5 pb-8 overflow-y-visible">
            {!isResetting && displayFrames.map((frame, idx) => formatClassicRow(frame, idx))}
          </div>
        </div>
        {(frames.length === 0 || isResetting) && !isPaused && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 z-40 pointer-events-none">
            <p className="text-[8px] font-orbitron font-black text-indigo-400 uppercase tracking-[0.4em]">{isResetting ? 'PURGING' : 'AWAITING_BUS'}</p>
          </div>
        )}
      </div>

      <div className="bg-slate-50 px-3 md:px-6 py-1.5 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center text-[7px] md:text-[8px] font-orbitron font-black text-slate-400 uppercase shrink-0 z-[60] gap-1">
        <div className="flex flex-wrap gap-3 md:gap-6 justify-center">
          <span className="text-indigo-600 font-bold">BUFF: {frames.length.toLocaleString()} / 1M</span>
          {isSaving && (
            <div className="flex items-center gap-1.5 text-indigo-600 font-bold">
               <div className="w-1 h-1 bg-indigo-600 rounded-full animate-pulse"></div> EXPORTING
            </div>
          )}
        </div>
        <div className="hidden xs:block">PCAN_VIEW_LINK v5.x</div>
      </div>
    </div>
  );
};

export default CANMonitor;
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CANFrame, ConversionLibrary } from '@/types';
import { Terminal, Lock, Unlock, RefreshCw, Clock, Timer, Info, Save, Loader2, Zap, Database, X, Download } from 'lucide-react';

interface CANMonitorProps {
  frames: CANFrame[];
  isPaused: boolean;
  library: ConversionLibrary;
  onClearTrace?: () => void;
  onSaveTrace?: () => void;
  isSaving?: boolean;
  autoSaveEnabled?: boolean;
  onToggleAutoSave?: () => void;
  msgPerSec?: number;
  onExportWideCsv?: () => void;
  totalBufferCount?: number;
}

const CANMonitor: React.FC<CANMonitorProps> = ({ 
  frames, 
  isPaused, 
  onClearTrace, 
  onSaveTrace,
  isSaving = false,
  autoSaveEnabled = false,
  onToggleAutoSave,
  msgPerSec = 0,
  onExportWideCsv,
  totalBufferCount
}) => {
  const [autoScroll, setAutoScroll] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [timeMode, setTimeMode] = useState<'relative' | 'absolute'>('relative');
  const scrollRef = useRef<HTMLDivElement>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const [scrollTop, setScrollTop] = useState(0);
  const isProgrammaticScroll = useRef(false);
  const ROW_HEIGHT = 20; // h-5 is 20px
  const VISIBLE_ROWS = 30;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollHeight, clientHeight, scrollTop: currentScroll } = e.currentTarget;
    setScrollTop(currentScroll);
    
    if (isProgrammaticScroll.current) return;

    // If user scrolls up significantly, disable auto-scroll
    // Increased threshold to 150px for mobile momentum scrolling
    const isAtBottom = scrollHeight - clientHeight - currentScroll < 150;
    
    if (!isAtBottom && autoScroll) {
      setAutoScroll(false);
    } else if (isAtBottom && !autoScroll) {
      // Re-enable if they manually scroll back to the very bottom
      setAutoScroll(true);
    }
  };

  useEffect(() => {
    if (autoScroll && !isPaused && scrollRef.current) {
      isProgrammaticScroll.current = true;
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      
      // Use a small timeout to clear the programmatic flag after the browser has processed the scroll
      const timeout = setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [frames.length, isPaused, autoScroll]);

  const { startIndex, endIndex, translateY } = useMemo(() => {
    const start = Math.floor(scrollTop / ROW_HEIGHT);
    const startIndex = Math.max(0, start - 10);
    const endIndex = Math.min(frames.length, startIndex + VISIBLE_ROWS + 20);
    return { startIndex, endIndex, translateY: startIndex * ROW_HEIGHT };
  }, [scrollTop, frames.length]);

  const visibleFrames = useMemo(() => {
    return frames.slice(startIndex, endIndex);
  }, [frames, startIndex, endIndex]);

  const totalHeight = frames.length * ROW_HEIGHT;

  const handleReload = () => {
    setIsResetting(true);
    onClearTrace?.();
    setTimeout(() => setIsResetting(false), 800);
  };

  const headerLine = ";---+-- ------+------ +- --+----- +- +- +- +- -- -- -- -- -- -- -- +-------+-------";

  const renderClassicHeaders = () => (
    <div className="sticky top-0 bg-white z-20 pt-2 pb-1 select-none font-mono text-[10px] md:text-[13px] text-slate-400 whitespace-pre border-b border-slate-100">
      <div className="mb-0.5">;   Time    Type ID     Rx/Tx                                Jitter  Expected</div>
      <div className="mb-0.5">{(timeMode === 'relative' ? ';   Offset  ' : ';   System  ') + "|    [hex]  |  Data Length                       [ms]    [ms]"}</div>
      <div className="mb-0.5">;   [ms]    |    |      |  |  Data [hex] ...</div>
      <div className="mb-0.5">;   |       |    |      |  |  |</div>
      <div className="text-slate-200">{headerLine}</div>
    </div>
  );

  const formatClassicRow = (frame: CANFrame, indexInVisible: number) => {
    const actualIndex = startIndex + indexInVisible + 1;
    const timeVal = (frame.timestamp / 1000);
    const timeStr = (timeMode === 'relative' ? timeVal.toFixed(3) : new Date(frame.absoluteTimestamp).toLocaleTimeString('en-GB', { hour12: false })).padStart(13, ' ');
    const type = "DT";
    const id = frame.id.replace('0x', '').toUpperCase().padStart(8, ' ');
    const rxtx = frame.direction.padStart(2, ' ');
    const dlc = frame.dlc.toString().padStart(1, ' ');
    const dataBytes = frame.data.map(d => d.padStart(2, '0')).join(' ').padEnd(24, ' ');
    
    const jitterStr = (frame.jitterMs || 0).toFixed(2).padStart(7, ' ');
    const expectedStr = (frame.expectedPeriodMs || 0) > 0 ? frame.expectedPeriodMs?.toString().padStart(7, ' ') : "    ---";

    return (
      <div key={`${frame.absoluteTimestamp}-${actualIndex}`} className="flex hover:bg-slate-50 transition-colors leading-tight h-5 items-center font-mono text-[10px] md:text-[13px] text-slate-800 whitespace-pre">
        <span>{timeStr + " " + type + " " + id + " " + rxtx + " " + dlc + "  "}</span>
        <span className="text-emerald-600">{dataBytes}</span>
        <span className="text-slate-400 ml-2">|</span>
        <span className={(frame.jitterMs || 0) > 5 ? 'text-red-500' : 'text-slate-500'}>{jitterStr}</span>
        <span className="text-slate-400 ml-2">|</span>
        <span className="text-indigo-500">{expectedStr}</span>
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

          <button onClick={() => setTimeMode(timeMode === 'relative' ? 'absolute' : 'relative')} className="p-1.5 rounded-lg text-slate-600 bg-white border border-slate-200">
            {timeMode === 'relative' ? <Timer size={12} /> : <Clock size={12} />}
          </button>
          
          <button onClick={() => setAutoScroll(!autoScroll)} className={`p-1.5 rounded-lg border ${autoScroll ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-400 border-slate-200'}`}>
            {autoScroll ? <Unlock size={12} /> : <Lock size={12} />}
          </button>
          
          <button onClick={handleReload} className={`p-1.5 rounded-lg border ${isResetting ? 'bg-red-500 text-white border-red-600' : 'bg-red-50 text-red-600 border-red-200'}`} disabled={isResetting}>
            <RefreshCw size={12} className={isResetting ? "animate-spin" : ""} />
          </button>

          <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block"></div>

          <button 
            onClick={onExportWideCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[8px] md:text-[9px] font-orbitron font-black uppercase transition-all border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-sm"
          >
            <Download size={10} />
            <span>Wide CSV</span>
          </button>

          <button 
            onClick={onSaveTrace}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[8px] md:text-[9px] font-orbitron font-black uppercase transition-all border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-sm"
          >
            <Save size={10} />
            <span>Trace</span>
          </button>
        </div>
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar bg-white font-mono min-h-0 z-10 relative">
        <div className="p-2 md:p-4 min-w-[700px] md:min-w-[1000px] text-slate-800 relative h-full">
          {renderClassicHeaders()}
          <div className="pt-2 space-y-0.5 pb-8 overflow-y-visible" style={{ height: totalHeight }}>
            <div style={{ transform: `translateY(${translateY}px)` }}>
              {!isResetting && visibleFrames.map((frame, idx) => formatClassicRow(frame, idx))}
            </div>
          </div>
        </div>
        {!isResetting && frames.length > 0 && (
          <div className="absolute bottom-2 left-4 flex items-center gap-2 z-30 pointer-events-none">
            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></div>
            <span className="text-[7px] font-orbitron font-black text-indigo-400 uppercase tracking-widest">TRACE_STREAM_ACTIVE</span>
          </div>
        )}
        {(frames.length === 0 || isResetting) && !isPaused && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 z-40 pointer-events-none">
            <p className="text-[8px] font-orbitron font-black text-indigo-400 uppercase tracking-[0.4em]">{isResetting ? 'PURGING' : 'AWAITING_BUS'}</p>
          </div>
        )}
      </div>

      <div className="bg-slate-50 px-3 md:px-6 py-1.5 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center text-[7px] md:text-[8px] font-orbitron font-black text-slate-400 uppercase shrink-0 z-[60] gap-1">
        <div className="flex flex-wrap gap-3 md:gap-6 justify-center items-center">
          <span className="text-indigo-600 font-bold">{(totalBufferCount || frames.length).toLocaleString()} BUFFER</span>
          <span className="text-emerald-600 font-bold">{msgPerSec?.toLocaleString() || 0} MSG/SEC</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden xs:block">BRIDGE_ACTIVE_LINK</div>
          <div className="hidden xs:block">HARDWARE_TELEMETRY_ENGINE</div>
        </div>
      </div>
    </div>
  );
};

export default CANMonitor;


import React, { useEffect, useRef } from 'react';
import { CANFrame, SignalAnalysis } from '../types.ts';
import { AlertCircle, BrainCircuit, Unlock, Lock, ArrowDownToLine, Radar, Zap, ShieldAlert, Loader2 } from 'lucide-react';

interface AIDiagnosticsProps {
  currentFrames: CANFrame[];
  analysis: (SignalAnalysis & { isAutomatic?: boolean }) | null;
  loading: boolean;
  onManualAnalyze: () => void;
  watcherActive: boolean;
  setWatcherActive: (active: boolean) => void;
}

const AIDiagnostics: React.FC<AIDiagnosticsProps> = ({ 
  currentFrames,
  analysis,
  loading,
  onManualAnalyze,
  watcherActive,
  setWatcherActive
}) => {
  const [autoScroll, setAutoScroll] = React.useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && analysis && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [analysis, autoScroll]);

  const scrollToBottom = () => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: contentRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-6 flex flex-col h-full overflow-hidden max-h-full shadow-lg">
      <div className="flex items-center justify-between mb-3 md:mb-4 shrink-0">
        <div className="flex flex-col">
          <h2 className="text-[8px] md:text-[10px] font-orbitron font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5 md:gap-2">
            Gemini_Insight {watcherActive && <Radar size={10} className="text-indigo-600 animate-pulse" />}
          </h2>
          <p className="text-[7px] md:text-[8px] text-indigo-500 font-bold uppercase tracking-widest mt-0.5">
            {watcherActive ? 'AUTONOMOUS_WATCHER' : 'Tactical_Signal_Logic'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          <button
            onClick={() => setWatcherActive(!watcherActive)}
            className={`flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-lg text-[7px] md:text-[8px] font-orbitron font-black uppercase transition-all border shadow-sm ${
              watcherActive ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-400'
            }`}
          >
            <Radar size={10} className={watcherActive ? 'animate-spin' : ''} />
            <span className="hidden xs:inline">{watcherActive ? 'ON' : 'OFF'}</span>
          </button>
          
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-1.5 rounded border transition-all shadow-sm ${autoScroll ? 'bg-indigo-600 border-indigo-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
          >
            {autoScroll ? <Unlock size={10} /> : <Lock size={10} />}
          </button>
          <button
            onClick={onManualAnalyze}
            disabled={loading || currentFrames.length === 0}
            className="flex items-center gap-1.5 px-3 md:px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white text-[8px] md:text-[9px] font-orbitron font-black uppercase tracking-widest rounded-lg shadow-md"
          >
            {loading ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : (analysis ? 'Re_Sync' : 'Analyze')}
          </button>
        </div>
      </div>

      <div ref={contentRef} className="flex-1 overflow-y-auto pr-1 md:pr-3 custom-scrollbar min-h-0 space-y-4 md:space-y-6 relative no-scrollbar">
        {loading && (
          <div className="flex flex-col items-center justify-center h-48 space-y-4">
            <div className="relative">
              <div className="w-10 h-10 border-2 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
              <BrainCircuit className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600" size={16} />
            </div>
            <p className="text-slate-400 text-[8px] font-orbitron font-black uppercase tracking-[0.3em] animate-pulse">
              {analysis?.isAutomatic ? 'INTERCEPTING...' : 'Scanning...'}
            </p>
          </div>
        )}

        {!loading && !analysis && (
          <div className="text-center py-10 md:py-12 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center">
             <div className="p-3 bg-slate-50 rounded-full mb-3">
               <ShieldAlert className="w-6 h-6 text-slate-200" />
             </div>
            <p className="text-slate-300 text-[8px] font-orbitron font-black uppercase tracking-widest max-w-[150px]">
              {watcherActive ? 'AWAITING_TRIGGER' : 'Establish_Link_To_Analyze'}
            </p>
          </div>
        )}

        {analysis && !loading && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 pb-6">
            {analysis.isAutomatic && (
              <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl flex items-center gap-2 animate-pulse shadow-sm">
                 <Zap size={12} className="text-amber-600" />
                 <span className="text-[8px] font-orbitron font-black text-amber-800 uppercase">Auto_Intercept_Active</span>
              </div>
            )}

            <div>
              <h4 className="text-[8px] font-orbitron font-black text-slate-400 uppercase tracking-widest mb-2 border-l-2 border-emerald-500 pl-2">Detected_Protocols</h4>
              <div className="flex flex-wrap gap-1.5">
                {analysis.detectedProtocols.map(p => (
                  <span key={p} className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded text-[7px] md:text-[8px] font-orbitron font-bold uppercase">
                    {p}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-[8px] font-orbitron font-black text-slate-400 uppercase tracking-widest mb-2 border-l-2 border-indigo-600 pl-2">Signal_Summary</h4>
              <div className="text-[10px] md:text-[11px] text-slate-800 leading-relaxed font-mono bg-slate-50 p-4 rounded-xl border border-slate-100 whitespace-pre-wrap shadow-inner">
                {analysis.summary}
              </div>
            </div>

            {analysis.anomalies.length > 0 && (
              <div>
                <h4 className="text-[8px] font-orbitron font-black text-slate-400 uppercase tracking-widest mb-2 border-l-2 border-red-500 pl-2">Anomalies</h4>
                <div className="space-y-1.5">
                  {analysis.anomalies.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-[8px] md:text-[9px] text-red-700 bg-red-50 p-2.5 rounded-lg border border-red-200 font-bold">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {a}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {analysis && !autoScroll && (
        <button 
          onClick={scrollToBottom}
          className="mt-2 flex items-center justify-center gap-1.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[7px] md:text-[8px] font-orbitron font-black text-slate-500 hover:text-slate-800 transition-all uppercase tracking-widest shadow-sm"
        >
          <ArrowDownToLine size={8} /> latest
        </button>
      )}
    </div>
  );
};

export default AIDiagnostics;

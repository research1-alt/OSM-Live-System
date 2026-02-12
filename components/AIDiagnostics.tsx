
import React, { useEffect, useRef } from 'react';
import { CANFrame, SignalAnalysis } from '../types.ts';
import { AlertCircle, BrainCircuit, Unlock, Lock, ArrowDownToLine, Radar, Zap, ShieldAlert, Loader2 } from 'lucide-react';

// Added lifted state props to match App.tsx requirements
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
  // Use lifted states from props instead of local ones to synchronize with App.tsx
  const [autoScroll, setAutoScroll] = React.useState(true);
  const [error] = React.useState<string | null>(null);
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
    <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col h-full overflow-hidden max-h-full shadow-lg">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex flex-col">
          <h2 className="text-[10px] font-orbitron font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            Gemini_Insight {watcherActive && <Radar size={12} className="text-indigo-600 animate-pulse" />}
          </h2>
          <p className="text-[8px] text-indigo-500 font-bold uppercase tracking-widest mt-0.5">
            {watcherActive ? 'AUTONOMOUS_WATCHER_ACTIVE' : 'Tactical_Signal_Logic'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWatcherActive(!watcherActive)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[8px] font-orbitron font-black uppercase transition-all border shadow-sm ${
              watcherActive ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-400'
            }`}
            title="Toggle Autonomous Fault Monitoring"
          >
            <Radar size={12} className={watcherActive ? 'animate-spin' : ''} />
            {watcherActive ? 'WATCHER_ON' : 'WATCHER_OFF'}
          </button>
          
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-1.5 rounded border transition-all shadow-sm ${autoScroll ? 'bg-indigo-600 border-indigo-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
          >
            {autoScroll ? <Unlock size={12} /> : <Lock size={12} />}
          </button>
          <button
            onClick={onManualAnalyze}
            disabled={loading || currentFrames.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-[9px] font-orbitron font-black uppercase tracking-widest rounded-lg transition-all active:scale-95 shadow-md"
          >
            {loading && <Loader2 className="w-3 h-3 animate-spin" />}
            {analysis ? 'Re_Sync' : 'Analyze'}
          </button>
        </div>
      </div>

      <div ref={contentRef} className="flex-1 overflow-y-auto pr-3 custom-scrollbar min-h-0 space-y-6 relative">
        {loading && (
          <div className="flex flex-col items-center justify-center h-48 space-y-4">
            <div className="relative">
              <div className="w-12 h-12 border-2 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
              <BrainCircuit className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600" size={20} />
            </div>
            <p className="text-slate-400 text-[9px] font-orbitron font-black uppercase tracking-[0.3em] animate-pulse">
              {analysis?.isAutomatic ? 'INTERCEPTING_ANOMALY...' : 'Scanning_Patterns...'}
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-red-700 font-medium">{error}</p>
          </div>
        )}

        {!loading && !analysis && !error && (
          <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center">
             <div className="p-4 bg-slate-50 rounded-full mb-4">
               <ShieldAlert className="w-8 h-8 text-slate-200" />
             </div>
            <p className="text-slate-300 text-[9px] font-orbitron font-black uppercase tracking-widest max-w-[180px]">
              {watcherActive ? 'AWAITING_ANOMALY_TRIGGER' : 'Establish_Hardware_Link_To_Analyze_Frames'}
            </p>
          </div>
        )}

        {analysis && !loading && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 pb-6">
            {analysis.isAutomatic && (
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center gap-3 animate-pulse shadow-sm">
                 <div className="p-1.5 bg-amber-600 text-white rounded-lg">
                   <Zap size={14} />
                 </div>
                 <span className="text-[10px] font-orbitron font-black text-amber-800 uppercase">Automated_Anomaly_Intercept</span>
              </div>
            )}

            <div>
              <h4 className="text-[9px] font-orbitron font-black text-slate-400 uppercase tracking-widest mb-3 border-l-2 border-emerald-500 pl-3">Detected_Protocols</h4>
              <div className="flex flex-wrap gap-2">
                {analysis.detectedProtocols.map(p => (
                  <span key={p} className="px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-md text-[9px] font-orbitron font-bold">
                    {p}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-[9px] font-orbitron font-black text-slate-400 uppercase tracking-widest mb-3 border-l-2 border-indigo-600 pl-3">Signal_Summary_&_Impact</h4>
              <div className="text-[11px] text-slate-800 leading-relaxed font-mono bg-slate-50 p-5 rounded-xl border border-slate-100 whitespace-pre-wrap shadow-inner relative">
                <div className="absolute top-4 right-4 opacity-10">
                  <BrainCircuit size={40} />
                </div>
                {analysis.summary}
              </div>
            </div>

            {analysis.anomalies.length > 0 && (
              <div>
                <h4 className="text-[9px] font-orbitron font-black text-slate-400 uppercase tracking-widest mb-3 border-l-2 border-red-500 pl-3">Anomalies_Alert</h4>
                <div className="space-y-2">
                  {analysis.anomalies.map((a, i) => (
                    <div key={i} className="flex items-center gap-3 text-[10px] text-red-700 bg-red-50 p-3 rounded-lg border border-red-200 font-bold">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
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
          className="mt-2 flex items-center justify-center gap-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[8px] font-orbitron font-black text-slate-500 hover:text-slate-800 transition-all uppercase tracking-widest shadow-sm"
        >
          <ArrowDownToLine size={10} /> Scroll_to_latest
        </button>
      )}
    </div>
  );
};

export default AIDiagnostics;

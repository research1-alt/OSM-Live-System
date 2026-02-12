
import React, { useState, useMemo } from 'react';
import { CANFrame, ConversionLibrary, DBCMessage, DBCSignal, SignalAnalysis } from '../types.ts';
import { normalizeId, decodeSignal, cleanMessageName } from '../utils/decoder.ts';
import AIDiagnostics from './AIDiagnostics.tsx';
import { ChevronRight, ChevronDown, Activity, BarChart3, TrendingUp, Search, BrainCircuit, XCircle } from 'lucide-react';

interface TraceAnalysisDashboardProps {
  frames: CANFrame[];
  library: ConversionLibrary;
  latestFrames: Record<string, CANFrame>;
  // Lifted state props from App.tsx
  selectedSignalNames: string[];
  setSelectedSignalNames: React.Dispatch<React.SetStateAction<string[]>>;
  watcherActive: boolean;
  setWatcherActive: React.Dispatch<React.SetStateAction<boolean>>;
  lastAiAnalysis: (SignalAnalysis & { isAutomatic?: boolean }) | null;
  aiLoading: boolean;
  onManualAnalyze: () => void;
}

const LIVE_TIMEOUT_MS = 5000;

const TraceAnalysisDashboard: React.FC<TraceAnalysisDashboardProps> = ({ 
  frames, 
  library, 
  latestFrames,
  selectedSignalNames,
  setSelectedSignalNames,
  watcherActive,
  setWatcherActive,
  lastAiAnalysis,
  aiLoading,
  onManualAnalyze
}) => {
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'stats' | 'ai'>('stats');
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Calculate Plot Data for Stats
  const plotData = useMemo(() => {
    const signalMap = new Map<string, { msg: DBCMessage; signals: DBCSignal[] }>();
    (Object.entries(library.database) as [string, DBCMessage][]).forEach(([rawId, msg]) => {
      signalMap.set(normalizeId(rawId), { msg, signals: Object.values(msg.signals) as DBCSignal[] });
    });

    return frames.map(f => {
      const data: any = { time: f.timestamp / 1000 };
      const mapping = signalMap.get(normalizeId(f.id));
      if (mapping) {
        mapping.signals.forEach(sig => {
          const valStr = decodeSignal(f.data, sig);
          const valNum = parseFloat(valStr);
          if (!isNaN(valNum)) data[sig.name] = valNum;
        });
      }
      return data;
    });
  }, [frames, library]);

  // 2. Identify strictly active signals for the matrix
  const signalGroups = useMemo(() => {
    const list: Array<{ id: string; name: string; signals: string[] }> = [];
    const searchLower = searchTerm.toLowerCase();
    const now = performance.now();

    Object.entries(latestFrames).forEach(([normId, frame]) => {
      if (now - frame.timestamp > LIVE_TIMEOUT_MS) return;

      const dbe = Object.entries(library.database).find(([decId]) => normalizeId(decId) === normId);
      if (dbe) {
        const [id, msg] = dbe;
        const cleanName = cleanMessageName(msg.name);
        
        const matchesMsg = cleanName.toLowerCase().includes(searchLower);
        const matchedSignals = Object.keys(msg.signals).filter(sigName => 
          matchesMsg || sigName.toLowerCase().includes(searchLower)
        );

        if (matchedSignals.length > 0) {
          list.push({ id, name: cleanName, signals: matchedSignals });
        }
      }
    });

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [library, latestFrames, searchTerm]);

  // 3. Multi-Signal Stats Calculation
  const allStats = useMemo(() => {
    if (selectedSignalNames.length === 0 || plotData.length === 0) return [];
    
    return selectedSignalNames.map(sName => {
      const values = plotData.map(d => d[sName]).filter(v => v !== undefined);
      if (values.length === 0) return { name: sName, min: 0, max: 0, avg: 0, count: 0 };
      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      return { name: sName, min, max, avg, count: values.length };
    });
  }, [selectedSignalNames, plotData]);

  const toggleSignalSelection = (sig: string) => {
    setSelectedSignalNames(prev => prev.includes(sig) ? prev.filter(s => s !== sig) : [...prev, sig]);
  };

  return (
    <div className="flex h-full w-full bg-white overflow-hidden">
      {/* LEFT: Signal Matrix */}
      <div className="w-80 bg-slate-50 shrink-0 border-r border-slate-200 flex flex-col h-full">
        <div className="p-6 pb-4 flex flex-col gap-4 shrink-0">
          <h3 className="text-[10px] font-orbitron font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
            <Activity size={14} /> SIGNAL_MATRIX
          </h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="text" 
              placeholder="FILTER_BUS..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-10 pr-4 text-[10px] font-mono text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-indigo-500/50 uppercase tracking-widest shadow-sm"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {signalGroups.length === 0 ? (
            <div className="text-center py-20 opacity-30 italic text-[9px] font-bold uppercase tracking-widest px-8">
              Awaiting live bus signals...
            </div>
          ) : (
            signalGroups.map(group => (
              <div key={group.id} className="mb-1">
                <button 
                  onClick={() => setExpandedGroups(prev => prev.includes(group.id) ? prev.filter(g => g !== group.id) : [...prev, group.id])} 
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white rounded text-left transition-colors group"
                >
                  {expandedGroups.includes(group.id) ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                  <span className="text-[10px] font-bold text-slate-700 group-hover:text-indigo-600 uppercase truncate">{group.name}</span>
                </button>
                {expandedGroups.includes(group.id) && (
                  <div className="ml-6 space-y-1 mt-1 border-l border-slate-200 pl-3">
                    {group.signals.map(sig => (
                      <button 
                        key={sig} 
                        onClick={() => toggleSignalSelection(sig)} 
                        className={`w-full flex items-center gap-2 px-3 py-1 rounded text-left text-[9px] transition-all ${selectedSignalNames.includes(sig) ? 'text-indigo-600 bg-indigo-50 font-black' : 'text-slate-400 hover:text-slate-600 font-medium'}`}
                      >
                        <div className={`w-2 h-2 rounded-sm border ${selectedSignalNames.includes(sig) ? 'bg-indigo-600 border-indigo-500' : 'border-slate-300'}`} />
                        {sig}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT: Stats Grid / AI Analysis */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden p-8">
        <div className="flex items-center justify-between mb-8 shrink-0">
          <div>
            <h2 className="text-2xl font-orbitron font-black text-slate-900 uppercase tracking-tight">LIVE_SIGNAL_ANALYSIS</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Real-time aggregate data metrics</p>
          </div>
          
          <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl">
             <button 
               onClick={() => setViewMode('stats')} 
               className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-orbitron font-black uppercase transition-all ${viewMode === 'stats' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
             >
               <BarChart3 size={16}/> LIVE_STATS
             </button>
             <button 
               onClick={() => setViewMode('ai')} 
               className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-orbitron font-black uppercase transition-all ${viewMode === 'ai' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
             >
               <BrainCircuit size={16}/> GEMINI_AI
             </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {viewMode === 'ai' ? (
            <div className="h-full max-w-4xl mx-auto">
              <AIDiagnostics 
                currentFrames={frames} 
                analysis={lastAiAnalysis}
                loading={aiLoading}
                onManualAnalyze={onManualAnalyze}
                watcherActive={watcherActive}
                setWatcherActive={setWatcherActive}
              />
            </div>
          ) : (
            <>
              {selectedSignalNames.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-12 opacity-30">
                  <BarChart3 size={64} className="mb-6 text-indigo-200" />
                  <h4 className="text-[12px] font-orbitron font-black uppercase tracking-[0.4em]">Ready_For_Deployment</h4>
                  <p className="text-[9px] font-bold uppercase mt-4 max-w-xs">Select signals from the matrix to begin live statistical computation</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
                  {allStats.map(stat => (
                    <div key={stat.name} className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm hover:shadow-xl transition-all group animate-in zoom-in duration-300">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                            <TrendingUp size={18} />
                          </div>
                          <h4 className="text-[11px] font-orbitron font-black uppercase tracking-wider text-slate-800 truncate max-w-[150px]">{stat.name.replace(/_/g, ' ')}</h4>
                        </div>
                        <button onClick={() => toggleSignalSelection(stat.name)} className="p-1 text-slate-300 hover:text-red-500 transition-colors">
                          <XCircle size={14} />
                        </button>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                          <span className="text-[9px] font-orbitron font-black text-slate-400 uppercase">Min_Value</span>
                          <span className="text-lg font-orbitron font-black text-emerald-600">{stat.min.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                          <span className="text-[9px] font-orbitron font-black text-slate-400 uppercase">Max_Value</span>
                          <span className="text-lg font-orbitron font-black text-indigo-600">{stat.max.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                          <span className="text-[9px] font-orbitron font-black text-slate-400 uppercase">Avg_Window</span>
                          <span className="text-lg font-orbitron font-black text-slate-900">{stat.avg.toFixed(2)}</span>
                        </div>
                      </div>
                      
                      <div className="mt-4 flex items-center justify-center">
                        <span className="text-[8px] font-mono text-slate-300 uppercase tracking-widest">Sample_Size: {stat.count} Frames</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TraceAnalysisDashboard;

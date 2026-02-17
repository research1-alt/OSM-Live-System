import React, { useState, useMemo } from 'react';
import { CANFrame, ConversionLibrary, DBCMessage, DBCSignal, SignalAnalysis } from '../types.ts';
import { normalizeId, decodeSignal, cleanMessageName } from '../utils/decoder.ts';
import AIDiagnostics from './AIDiagnostics.tsx';
import { ChevronRight, ChevronDown, Activity, BarChart3, TrendingUp, Search, BrainCircuit, XCircle, Menu, X } from 'lucide-react';

interface TraceAnalysisDashboardProps {
  frames: CANFrame[];
  library: ConversionLibrary;
  latestFrames: Record<string, CANFrame>;
  selectedSignalNames: string[];
  setSelectedSignalNames: React.Dispatch<React.SetStateAction<string[]>>;
  watcherActive: boolean;
  setWatcherActive: React.Dispatch<React.SetStateAction<boolean>>;
  lastAiAnalysis: (SignalAnalysis & { isAutomatic?: boolean }) | null;
  aiLoading: boolean;
  // Fix: changed from 'void' to '() => void' to correctly type the analysis trigger function
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);

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

  const signalGroups = useMemo(() => {
    const list: Array<{ id: string; name: string; signals: string[] }> = [];
    const searchLower = searchTerm.toLowerCase();
    const now = performance.now();

    (Object.entries(latestFrames) as [string, CANFrame][]).forEach(([normId, frame]) => {
      if (now - frame.timestamp > LIVE_TIMEOUT_MS) return;

      const dbe = (Object.entries(library.database) as [string, DBCMessage][]).find(([decId]) => normalizeId(decId) === normId);
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

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-4 md:p-6 pb-4 flex flex-col gap-4 shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-orbitron font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
            <Activity size={14} /> SIGNAL_MATRIX
          </h3>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 text-slate-400">
            <X size={18} />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input 
            type="text" 
            placeholder="FILTER_BUS..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-10 pr-4 text-[10px] font-mono text-slate-800 focus:outline-none focus:border-indigo-500/50 uppercase tracking-widest shadow-sm"
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
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white rounded text-left transition-colors group"
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
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left text-[9px] transition-all ${selectedSignalNames.includes(sig) ? 'text-indigo-600 bg-indigo-50 font-black' : 'text-slate-400 hover:text-slate-600 font-medium'}`}
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
  );

  return (
    <div className="flex h-full w-full bg-white overflow-hidden relative">
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[150] lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Pinned/Overlay Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-[160] w-72 lg:w-80 bg-slate-50 border-r border-slate-200 transform transition-all duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:-ml-80 lg:opacity-0'}
      `}>
        {sidebarContent}
      </aside>

      <div className="flex-1 flex flex-col bg-white overflow-hidden p-3 md:p-8 transition-all duration-300">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 md:mb-6 shrink-0 gap-3">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              className={`p-1.5 rounded-lg shadow-lg hover:scale-105 transition-all active:scale-95 ${isSidebarOpen ? 'bg-slate-100 text-slate-600' : 'bg-indigo-600 text-white'}`}
            >
              {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div>
              <h2 className="text-lg md:text-2xl font-orbitron font-black text-slate-900 uppercase tracking-tight">LIVE_ANALYSIS</h2>
              <p className="text-[7px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest">Aggregate Telemetry Matrix</p>
            </div>
          </div>
          
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto no-scrollbar">
             <button onClick={() => setViewMode('stats')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-3 md:px-6 py-1.5 rounded-lg text-[8px] md:text-[10px] font-orbitron font-black uppercase transition-all whitespace-nowrap ${viewMode === 'stats' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
               <BarChart3 size={14}/> STATS
             </button>
             <button onClick={() => setViewMode('ai')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-3 md:px-6 py-1.5 rounded-lg text-[8px] md:text-[10px] font-orbitron font-black uppercase transition-all whitespace-nowrap ${viewMode === 'ai' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
               <BrainCircuit size={14}/> GEMINI
             </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar no-scrollbar transition-all duration-300">
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
                <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-30">
                  <BarChart3 size={40} className="mb-4 text-indigo-200" />
                  <h4 className="text-[9px] font-orbitron font-black uppercase tracking-[0.4em]">Matrix_Idle</h4>
                  <p className="text-[7px] font-bold uppercase mt-2 max-w-xs px-6">Select signals from the matrix to begin computation</p>
                  {!isSidebarOpen && (
                    <button onClick={() => setIsSidebarOpen(true)} className="mt-6 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-[8px] font-orbitron font-black uppercase shadow-lg">Open Matrix</button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-6 pb-20">
                  {allStats.map(stat => (
                    <div key={stat.name} className="bg-white border border-slate-100 rounded-2xl md:rounded-[32px] p-4 md:p-6 shadow-sm hover:shadow-xl transition-all group animate-in zoom-in duration-300">
                      <div className="flex items-center justify-between mb-3 md:mb-6">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors shrink-0">
                            <TrendingUp size={14} />
                          </div>
                          <h4 className="text-[9px] md:text-[11px] font-orbitron font-black uppercase tracking-wider text-slate-800 truncate">{stat.name.replace(/_/g, ' ')}</h4>
                        </div>
                        <button onClick={() => toggleSignalSelection(stat.name)} className="p-1 text-slate-300 hover:text-red-500 transition-colors shrink-0">
                          <XCircle size={14} />
                        </button>
                      </div>
                      
                      <div className="space-y-1.5 md:space-y-3">
                        <div className="flex justify-between items-center p-2 md:p-4 bg-slate-50 rounded-xl border border-slate-100/50">
                          <span className="text-[7px] md:text-[9px] font-orbitron font-black text-slate-400 uppercase">Min</span>
                          <span className="text-sm md:text-lg font-orbitron font-black text-emerald-600">{stat.min.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center p-2 md:p-4 bg-slate-50 rounded-xl border border-slate-100/50">
                          <span className="text-[7px] md:text-[9px] font-orbitron font-black text-slate-400 uppercase">Max</span>
                          <span className="text-sm md:text-lg font-orbitron font-black text-indigo-600">{stat.max.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center p-2 md:p-4 bg-slate-50 rounded-xl border border-slate-100/50">
                          <span className="text-[7px] md:text-[9px] font-orbitron font-black text-slate-400 uppercase">Avg</span>
                          <span className="text-sm md:text-lg font-orbitron font-black text-slate-900">{stat.avg.toFixed(2)}</span>
                        </div>
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
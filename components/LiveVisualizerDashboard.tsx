import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CANFrame, ConversionLibrary, DBCMessage, DBCSignal } from '../types.ts';
import { normalizeId, decodeSignal, cleanMessageName } from '../utils/decoder.ts';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceArea
} from 'recharts';
import { Activity, Search, Unlock, Lock, RefreshCw, ZoomIn, ChevronRight, ChevronDown, Menu, X, LayoutGrid, Layers, MousePointer2, Hand, Info, BarChart4 } from 'lucide-react';

interface LiveVisualizerDashboardProps {
  frames: CANFrame[];
  library: ConversionLibrary;
  latestFrames: Record<string, CANFrame>;
  selectedSignalNames?: string[];
  setSelectedSignalNames: React.Dispatch<React.SetStateAction<string[]>>;
  isOffline?: boolean;
}

const LIVE_TIMEOUT_MS = 5000;

const LiveVisualizerDashboard: React.FC<LiveVisualizerDashboardProps> = ({ 
  frames = [], 
  library, 
  latestFrames = {},
  selectedSignalNames = [],
  setSelectedSignalNames,
  isOffline = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [liveSync, setLiveSync] = useState(!isOffline);
  const [isSplitView, setIsSplitView] = useState(false);
  const [controlMode, setControlMode] = useState<'select' | 'adjust'>('select');
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  
  const [refAreaLeft, setRefAreaLeft] = useState<number | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<number | null>(null);
  const [left, setLeft] = useState<number | string>('dataMin');
  const [right, setRight] = useState<number | string>('dataMax');

  const isPanning = useRef(false);
  const panStartX = useRef<number | null>(null);
  const panStartTimeLeft = useRef<number>(0);
  const panStartTimeRight = useRef<number>(0);

  const colors = [
    '#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444', '#f97316', '#a855f7', '#14b8a6',
  ];

  const activeSignals = useMemo(() => {
    const list: Array<{ id: string; cleanName: string; signals: DBCSignal[] }> = [];
    const searchLower = searchTerm.toLowerCase();
    const now = performance.now();

    const frameEntries = Object.entries(latestFrames || {});
    frameEntries.forEach(([normId, frame]) => {
      if (!isOffline && (now - frame.timestamp > LIVE_TIMEOUT_MS)) return;

      const dbe = (Object.entries(library?.database || {}) as [string, DBCMessage][]).find(([decId]) => normalizeId(decId) === normId);
      if (dbe) {
        const [id, message] = dbe;
        const cleanName = cleanMessageName(message.name);
        
        const matchesMsg = cleanName.toLowerCase().includes(searchLower);
        const matchedSignals = (Object.values(message.signals) as DBCSignal[]).filter(sig => 
          matchesMsg || sig.name.toLowerCase().includes(searchLower)
        );

        if (matchedSignals.length > 0) {
          list.push({ id, cleanName, signals: matchedSignals });
        }
      }
    });

    return list.sort((a, b) => a.cleanName.localeCompare(b.cleanName));
  }, [latestFrames, library, searchTerm, isOffline]);

  const busLatestTime = useMemo(() => {
    if (!frames || frames.length === 0) return 0;
    return frames[frames.length - 1].timestamp / 1000;
  }, [frames]);

  useEffect(() => {
    if (liveSync && busLatestTime > 0) {
      const windowSize = 15;
      setLeft(Math.max(0, busLatestTime - windowSize));
      setRight(busLatestTime);
    }
  }, [busLatestTime, liveSync]);

  const plotData = useMemo(() => {
    if (!selectedSignalNames || selectedSignalNames.length === 0) return [];
    
    const sigLookup = new Map<string, { normId: string; sig: DBCSignal }>();
    const targetIds = new Set<string>();

    (Object.values(library?.database || {}) as DBCMessage[]).forEach(msg => {
      const dbe = (Object.entries(library?.database || {}) as [string, DBCMessage][]).find(([_, v]) => v === msg);
      const normId = dbe ? normalizeId(dbe[0]) : "";
      (Object.values(msg.signals) as DBCSignal[]).forEach(s => {
        if (selectedSignalNames.includes(s.name)) {
          sigLookup.set(s.name, { normId, sig: s });
          targetIds.add(normId);
        }
      });
    });

    const relevantBuffer = frames.filter(f => {
      const fNormId = normalizeId(f.id.replace('0x', ''), true);
      return targetIds.has(fNormId);
    });

    const lkvMap: Record<string, number> = {};
    const processedPoints: any[] = [];

    relevantBuffer.forEach(f => {
      const fTime = f.timestamp / 1000;
      const fNormId = normalizeId(f.id.replace('0x', ''), true);
      
      let signalUpdated = false;
      selectedSignalNames.forEach(sName => {
        const mapping = sigLookup.get(sName);
        if (mapping && mapping.normId === fNormId) {
          const val = parseFloat(decodeSignal(f.data, mapping.sig));
          if (!isNaN(val)) {
            lkvMap[sName] = val;
            signalUpdated = true;
          }
        }
      });

      if (signalUpdated) {
        processedPoints.push({ time: fTime, ...lkvMap });
      }
    });

    return processedPoints;
  }, [frames, selectedSignalNames, library]);

  // CALCULATION ENGINE FOR RANGE STATISTICS
  const rangeStatistics = useMemo(() => {
    if (selectedSignalNames.length === 0 || plotData.length === 0) return null;
    
    const startTime = typeof left === 'number' ? left : plotData[0].time;
    const endTime = typeof right === 'number' ? right : plotData[plotData.length - 1].time;
    
    const filtered = plotData.filter(d => d.time >= startTime && d.time <= endTime);
    if (filtered.length < 2) return null;

    const stats: Record<string, {
      firstTime: number;
      lastTime: number;
      dt: number;
      min: number;
      max: number;
      avg: number;
      rms: number;
      std: number;
      delta: number;
      unit: string;
    }> = {};

    selectedSignalNames.forEach(sigName => {
      const values = filtered.map(d => d[sigName]).filter(v => v !== undefined);
      if (values.length === 0) return;

      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      
      const sumSq = values.reduce((a, b) => a + (b * b), 0);
      const rms = Math.sqrt(sumSq / values.length);
      
      const variance = values.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / values.length;
      const std = Math.sqrt(variance);
      
      const firstVal = values[0];
      const lastVal = values[values.length - 1];
      const delta = lastVal - firstVal;

      // Extract unit from library
      let unit = "";
      for (const msg of Object.values(library.database)) {
        if (msg.signals[sigName]) {
          unit = msg.signals[sigName].unit;
          break;
        }
      }

      stats[sigName] = {
        firstTime: filtered[0].time,
        lastTime: filtered[filtered.length - 1].time,
        dt: filtered[filtered.length - 1].time - filtered[0].time,
        min, max, avg, rms, std, delta, unit
      };
    });

    return stats;
  }, [plotData, left, right, selectedSignalNames, library]);

  const toggleSignal = (sName: string) => {
    setSelectedSignalNames(prev => 
      prev.includes(sName) ? prev.filter(n => n !== sName) : [...prev, sName]
    );
  };

  const onChartMouseDown = (e: any) => {
    if (!e) return;
    if (controlMode === 'select') {
      setRefAreaLeft(e.activeLabel ? Number(e.activeLabel) : null);
    } else if (controlMode === 'adjust') {
      isPanning.current = true;
      panStartX.current = e.chartX;
      panStartTimeLeft.current = Number(left === 'dataMin' ? (plotData[0]?.time || 0) : left);
      panStartTimeRight.current = Number(right === 'dataMax' ? (plotData[plotData.length - 1]?.time || 0) : right);
      setLiveSync(false);
    }
  };

  const onChartMouseMove = (e: any) => {
    if (!e) return;
    if (controlMode === 'select') {
      if (refAreaLeft !== null) setRefAreaRight(e.activeLabel ? Number(e.activeLabel) : null);
    } else if (controlMode === 'adjust' && isPanning.current && panStartX.current !== null) {
      const deltaX = e.chartX - panStartX.current;
      const range = panStartTimeRight.current - panStartTimeLeft.current;
      const timeDelta = (deltaX / 800) * range; 
      
      setLeft(panStartTimeLeft.current - timeDelta);
      setRight(panStartTimeRight.current - timeDelta);
    }
  };

  const onChartMouseUp = () => {
    if (controlMode === 'select') {
      handleZoom();
    } else {
      isPanning.current = false;
      panStartX.current = null;
    }
  };

  const handleZoom = () => {
    if (refAreaLeft === refAreaRight || refAreaRight === null || refAreaLeft === null) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }
    setLiveSync(false);
    let l = refAreaLeft;
    let r = refAreaRight;
    if (l > r) [l, r] = [r, l];
    setLeft(l);
    setRight(r);
    setRefAreaLeft(null);
    setRefAreaRight(null);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-50 border-r border-slate-200">
      <div className="p-4 md:p-6 pb-4 flex flex-col gap-4 shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-orbitron font-black text-indigo-600 tracking-[0.3em] uppercase flex items-center gap-2">
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
        {activeSignals.length === 0 ? (
          <div className="text-center py-20 opacity-30 italic text-[9px] font-bold uppercase tracking-widest px-8">
            {isOffline ? 'No signals found in log...' : 'Awaiting live bus signals...'}
          </div>
        ) : (
          activeSignals.map((group) => (
            <div key={group.id} className="mb-1">
              <button 
                onClick={() => setExpandedGroups(prev => prev.includes(group.id) ? prev.filter(g => g !== group.id) : [...prev, group.id])} 
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white rounded text-left transition-colors group"
              >
                {expandedGroups.includes(group.id) ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                <span className="text-[10px] font-bold text-slate-700 group-hover:text-indigo-600 uppercase truncate">{group.cleanName}</span>
              </button>
              {expandedGroups.includes(group.id) && (
                <div className="ml-6 space-y-1 mt-1 border-l border-slate-200 pl-3">
                  {group.signals.map((sig) => {
                    const isSelected = selectedSignalNames.includes(sig.name);
                    return (
                      <button 
                        key={sig.name} 
                        onClick={() => toggleSignal(sig.name)} 
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left text-[9px] transition-all ${isSelected ? 'text-indigo-600 bg-indigo-50 font-black' : 'text-slate-400 hover:text-slate-600 font-medium'}`}
                      >
                        <div className={`w-2 h-2 rounded-sm border ${isSelected ? 'bg-indigo-600 border-indigo-500' : 'border-slate-300'}`} />
                        {sig.name.replace(/_/g, ' ')}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderChart = (signalNames: string[], height: string = "100%", idxOffset: number = 0) => (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart 
        data={plotData} 
        onMouseDown={onChartMouseDown}
        onMouseMove={onChartMouseMove}
        onMouseUp={onChartMouseUp}
        margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="time" stroke="#94a3b8" fontSize={8} type="number" domain={[left, right]} allowDataOverflow tickFormatter={(val) => `${val.toFixed(1)}s`} />
        <YAxis stroke="#94a3b8" fontSize={8} domain={['auto', 'auto']} allowDataOverflow width={30} />
        <Tooltip 
          contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: 'none', borderRadius: '10px', fontSize: '9px', backdropFilter: 'blur(8px)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
          labelFormatter={(val) => `Time: ${Number(val).toFixed(4)}s`}
        />
        <Legend verticalAlign="top" height={30} iconType="circle" wrapperStyle={{ fontSize: '8px', fontWeight: '900', textTransform: 'uppercase' }} />
        {signalNames.map((sName, idx) => (
          <Line 
            key={sName} 
            type="monotone" 
            dataKey={sName} 
            stroke={colors[(idx + idxOffset) % colors.length]} 
            strokeWidth={2} 
            dot={false} 
            isAnimationActive={!liveSync} 
          />
        ))}
        {controlMode === 'select' && refAreaLeft !== null && refAreaRight !== null && (
          <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill="#4f46e5" fillOpacity={0.1} />
        )}
      </LineChart>
    </ResponsiveContainer>
  );

  return (
    <div className="flex h-full w-full bg-white overflow-hidden relative">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[150] lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}
      
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-[160] w-72 lg:w-80 bg-slate-50 border-r border-slate-200 transform transition-all duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:-ml-80 lg:opacity-0'}
      `}>
        {sidebarContent}
      </aside>

      <div className="flex-1 flex flex-col h-full bg-white overflow-hidden p-3 md:p-8 transition-all duration-300">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 md:mb-6 shrink-0 gap-3">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              className={`p-1.5 rounded-lg shadow-lg hover:scale-105 transition-all active:scale-95 ${isSidebarOpen ? 'bg-slate-100 text-slate-600' : 'bg-indigo-600 text-white'}`}
              title={isSidebarOpen ? "Hide Signal Matrix" : "Show Signal Matrix"}
            >
              {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div>
              <h2 className="text-lg md:text-2xl font-orbitron font-black text-slate-900 uppercase tracking-tight">LIVE_VISUALIZER</h2>
              <p className="text-[7px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                {isOffline ? 'Offline Telemetry Projection' : 'Real-time Telemetry Projection'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto no-scrollbar pb-1 md:pb-0">
            <div className="flex bg-slate-100 p-1 rounded-xl mr-2">
              <button 
                onClick={() => setControlMode('select')}
                className={`p-1.5 rounded-lg transition-all flex items-center gap-2 text-[8px] font-orbitron font-black uppercase ${controlMode === 'select' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                title="Select Mode (Drag to Zoom)"
              >
                <MousePointer2 size={14} /> <span className="hidden xs:inline">Select</span>
              </button>
              <button 
                onClick={() => setControlMode('adjust')}
                className={`p-1.5 rounded-lg transition-all flex items-center gap-2 text-[8px] font-orbitron font-black uppercase ${controlMode === 'adjust' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                title="Adjust Mode (Drag to Pan)"
              >
                <Hand size={14} /> <span className="hidden xs:inline">Adjust</span>
              </button>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-xl mr-2">
              <button 
                onClick={() => setIsSplitView(false)}
                className={`p-1.5 rounded-lg transition-all flex items-center gap-2 text-[8px] font-orbitron font-black uppercase ${!isSplitView ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                title="Overlay View"
              >
                <Layers size={14} /> <span className="hidden xs:inline">Overlay</span>
              </button>
              <button 
                onClick={() => setIsSplitView(true)}
                className={`p-1.5 rounded-lg transition-all flex items-center gap-2 text-[8px] font-orbitron font-black uppercase ${isSplitView ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                title="Split View"
              >
                <LayoutGrid size={14} /> <span className="hidden xs:inline">Split</span>
              </button>
            </div>

            {!isOffline && (
              <button
                onClick={() => { setLiveSync(!liveSync); if (!liveSync) { setLeft('dataMin'); setRight('dataMax'); } }}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg text-[8px] md:text-[9px] font-orbitron font-black uppercase transition-all border shadow-sm ${
                  liveSync ? 'bg-indigo-600 border-indigo-700 text-white shadow-md' : 'bg-white border-slate-200 text-slate-400'
                }`}
              >
                {liveSync ? <Unlock size={14} /> : <Lock size={14} />}
                <span>{liveSync ? 'Live' : 'Locked'}</span>
              </button>
            )}
            {(left !== 'dataMin' || right !== 'dataMax' || !liveSync) && (
              <button onClick={() => { setLiveSync(!isOffline); setLeft('dataMin'); setRight('dataMax'); }} className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[8px] md:text-[9px] font-orbitron font-black uppercase tracking-widest transition-all shadow-sm">
                <RefreshCw size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-h-0 bg-slate-50 rounded-2xl md:rounded-[32px] border border-slate-100 shadow-inner relative overflow-hidden flex flex-col">
            {selectedSignalNames.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 opacity-30">
                <Activity size={40} className="mb-4 text-indigo-200" />
                <h4 className="text-[9px] font-orbitron font-black uppercase tracking-[0.4em]">Ready_To_Project</h4>
                <p className="text-[7px] font-bold uppercase mt-2">Select items from the matrix</p>
                {!isSidebarOpen && (
                  <button onClick={() => setIsSidebarOpen(true)} className="mt-6 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-[8px] font-orbitron font-black uppercase shadow-lg hover:bg-indigo-700 transition-colors">Open Matrix</button>
                )}
              </div>
            ) : (
              <div className={`flex-1 p-1 md:p-4 ${controlMode === 'select' ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'} overflow-y-auto custom-scrollbar`}>
                {isSplitView ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 h-full">
                    {selectedSignalNames.map((sName, idx) => (
                      <div key={sName} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm h-[250px] md:h-[300px]">
                        {renderChart([sName], "100%", idx)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full">
                    {renderChart(selectedSignalNames)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RANGE SELECTION DETAILS HUD PANEL */}
          {selectedSignalNames.length > 0 && rangeStatistics && !liveSync && (
            <div className="w-full lg:w-72 xl:w-80 shrink-0 animate-in slide-in-from-right-4 duration-300">
              <div className="bg-slate-900 text-white rounded-[32px] p-6 shadow-2xl border border-slate-800 h-full overflow-y-auto custom-scrollbar no-scrollbar flex flex-col gap-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20">
                      <BarChart4 size={18} />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-orbitron font-black uppercase tracking-widest">Selected Range</h4>
                      <p className="text-[7px] text-slate-500 font-bold uppercase mt-0.5">Analytic Matrix HUD</p>
                    </div>
                  </div>
                  <button onClick={() => { setLiveSync(!isOffline); setLeft('dataMin'); setRight('dataMax'); }} className="p-2 hover:bg-slate-800 rounded-full text-slate-500">
                    <X size={16} />
                  </button>
                </div>

                {selectedSignalNames.slice(0, 3).map((sigName, idx) => {
                  const s = rangeStatistics[sigName];
                  if (!s) return null;
                  return (
                    <div key={sigName} className="space-y-4 animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${idx * 100}ms` }}>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: colors[idx % colors.length] }}></div>
                        <h5 className="text-[9px] font-orbitron font-black uppercase text-indigo-400 tracking-tight truncate">{sigName.replace(/_/g, ' ')}</h5>
                      </div>

                      <div className="grid grid-cols-1 gap-2 font-mono text-[10px]">
                        <div className="flex justify-between items-center px-4 py-2.5 bg-slate-800/50 rounded-xl border border-slate-700/50">
                          <span className="text-slate-500 uppercase text-[8px] font-bold">First Timestamp</span>
                          <span className="text-white font-bold">{s.firstTime.toFixed(4)} s</span>
                        </div>
                        <div className="flex justify-between items-center px-4 py-2.5 bg-slate-800/50 rounded-xl border border-slate-700/50">
                          <span className="text-slate-500 uppercase text-[8px] font-bold">Last Timestamp</span>
                          <span className="text-white font-bold">{s.lastTime.toFixed(4)} s</span>
                        </div>
                        <div className="flex justify-between items-center px-4 py-2.5 bg-slate-800/50 rounded-xl border border-slate-700/50">
                          <span className="text-slate-500 uppercase text-[8px] font-bold">Δt</span>
                          <span className="text-amber-400 font-bold">{s.dt.toFixed(4)} s</span>
                        </div>
                        
                        <div className="h-[1px] bg-slate-800 my-1"></div>

                        <div className="flex justify-between items-center px-4 py-2 bg-slate-800/20">
                          <span className="text-slate-500 uppercase text-[8px] font-bold">Min</span>
                          <span className="text-emerald-400 font-bold">{s.min.toFixed(2)} {s.unit}</span>
                        </div>
                        <div className="flex justify-between items-center px-4 py-2 bg-slate-800/20">
                          <span className="text-slate-500 uppercase text-[8px] font-bold">Max</span>
                          <span className="text-red-400 font-bold">{s.max.toFixed(2)} {s.unit}</span>
                        </div>
                        <div className="flex justify-between items-center px-4 py-2 bg-slate-800/20">
                          <span className="text-slate-500 uppercase text-[8px] font-bold">Average</span>
                          <span className="text-white font-bold">{s.avg.toFixed(4)} {s.unit}</span>
                        </div>
                        <div className="flex justify-between items-center px-4 py-2 bg-slate-800/20">
                          <span className="text-slate-500 uppercase text-[8px] font-bold">RMS</span>
                          <span className="text-white font-bold">{s.rms.toFixed(4)} {s.unit}</span>
                        </div>
                        <div className="flex justify-between items-center px-4 py-2 bg-slate-800/20">
                          <span className="text-slate-500 uppercase text-[8px] font-bold">STD</span>
                          <span className="text-white font-bold">{s.std.toFixed(4)} {s.unit}</span>
                        </div>
                        <div className="flex justify-between items-center px-4 py-2 bg-slate-800/20">
                          <span className="text-slate-500 uppercase text-[8px] font-bold">Δ</span>
                          <span className="text-indigo-400 font-bold">{s.delta.toFixed(2)} {s.unit}</span>
                        </div>
                      </div>
                      {idx < selectedSignalNames.slice(0, 3).length - 1 && <div className="border-b border-slate-800 pt-2"></div>}
                    </div>
                  );
                })}

                {selectedSignalNames.length > 3 && (
                  <div className="mt-auto pt-4 flex items-center gap-2 text-[8px] font-orbitron font-black text-slate-600 uppercase">
                    <Info size={12} /> Data truncated to first 3 signals
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveVisualizerDashboard;
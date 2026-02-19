
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CANFrame, ConversionLibrary, DBCMessage, DBCSignal } from '../types.ts';
import { normalizeId, decodeSignal, cleanMessageName } from '../utils/decoder.ts';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea, Label
} from 'recharts';
import { 
  Search, ChevronRight, ChevronDown, 
  FolderOpen, Hash, Calculator, Clock, MousePointer, Check, Hand, MousePointer2,
  Activity, ListFilter, LayoutPanelLeft, RefreshCw, PanelRightClose, PanelRightOpen,
  LayoutGrid, Maximize2, Minimize2
} from 'lucide-react';

interface LiveVisualizerDashboardProps {
  frames: CANFrame[];
  library: ConversionLibrary;
  latestFrames: Record<string, CANFrame>;
  selectedSignalNames?: string[];
  setSelectedSignalNames: React.Dispatch<React.SetStateAction<string[]>>;
  isOffline?: boolean;
}

const LiveVisualizerDashboard: React.FC<LiveVisualizerDashboardProps> = ({ 
  frames = [], 
  library, 
  latestFrames = {},
  selectedSignalNames: propsSelectedSignals = [],
  setSelectedSignalNames: propsSetSelectedSignals,
  isOffline = false
}) => {
  const [localSelectedSignals, setLocalSelectedSignals] = useState<string[]>([]);
  const selectedSignalNames = propsSelectedSignals || localSelectedSignals;
  const setSelectedSignalNames = propsSetSelectedSignals || setLocalSelectedSignals;

  const [isChannelTreeOpen, setIsChannelTreeOpen] = useState(true);
  const [isTracePoolOpen, setIsTracePoolOpen] = useState(true);
  const [isStatsOpen, setIsStatsOpen] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [activeSignalName, setActiveSignalName] = useState<string | null>(null);
  const [zoomedSignal, setZoomedSignal] = useState<string | null>(null);

  // Layout & Control Modes
  const [liveSync, setLiveSync] = useState(!isOffline);
  const [controlMode, setControlMode] = useState<'select' | 'adjust'>('select');
  const [cursorData, setCursorData] = useState<any>(null);
  
  const [refAreaLeft, setRefAreaLeft] = useState<number | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<number | null>(null);
  const [left, setLeft] = useState<number | string>('dataMin');
  const [right, setRight] = useState<number | string>('dataMax');

  const isPanning = useRef(false);
  const panStartX = useRef<number | null>(null);
  const panStartTimeLeft = useRef<number>(0);
  const panStartTimeRight = useRef<number>(0);

  const colors = [
    '#4f46e5', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444', '#f97316', '#a855f7', '#14b8a6',
  ];

  useEffect(() => {
    if (activeSignalName && !selectedSignalNames.includes(activeSignalName)) {
      setActiveSignalName(selectedSignalNames.length > 0 ? selectedSignalNames[0] : null);
    } else if (!activeSignalName && selectedSignalNames.length > 0) {
      setActiveSignalName(selectedSignalNames[0]);
    }
  }, [selectedSignalNames, activeSignalName]);

  const resetGraph = () => {
    setLeft('dataMin');
    setRight('dataMax');
    setLiveSync(!isOffline);
    setRefAreaLeft(null);
    setRefAreaRight(null);
  };

  const groupedSignals = useMemo(() => {
    const list: Array<{ id: string; cleanName: string; signals: DBCSignal[] }> = [];
    const searchLower = searchTerm.toLowerCase();

    (Object.entries(library?.database || {}) as [string, DBCMessage][]).forEach(([decId, message]) => {
      const normDbcId = normalizeId(decId);
      
      // Filter logic: Only show signals if their message ID has been seen in latest traffic/log
      if (!latestFrames[normDbcId]) return;

      const cleanName = cleanMessageName(message.name);
      const matchedSignals = (Object.values(message.signals) as DBCSignal[]).filter(sig => 
        cleanName.toLowerCase().includes(searchLower) || sig.name.toLowerCase().includes(searchLower)
      );
      
      if (matchedSignals.length > 0) {
        list.push({ id: decId, cleanName, signals: matchedSignals });
      }
    });
    return list.sort((a, b) => a.cleanName.localeCompare(b.cleanName));
  }, [library, searchTerm, latestFrames]);

  const plotData = useMemo(() => {
    if (!selectedSignalNames || selectedSignalNames.length === 0) return [];
    const sigLookup = new Map<string, { normId: string; sig: DBCSignal }>();
    (Object.values(library?.database || {}) as DBCMessage[]).forEach(msg => {
      const dbe = (Object.entries(library?.database || {}) as [string, DBCMessage][]).find(([_, v]) => v === msg);
      const normId = dbe ? normalizeId(dbe[0]) : "";
      (Object.values(msg.signals) as DBCSignal[]).forEach(s => {
        if (selectedSignalNames.includes(s.name)) sigLookup.set(s.name, { normId, sig: s });
      });
    });
    const lkvMap: Record<string, number> = {};
    const processedPoints: any[] = [];
    const step = Math.max(1, Math.floor(frames.length / 5000));
    for (let i = 0; i < frames.length; i += step) {
      const f = frames[i];
      const fTime = f.timestamp / 1000;
      const fNormId = normalizeId(f.id.replace('0x', ''), true);
      let updated = false;
      selectedSignalNames.forEach(sName => {
        const mapping = sigLookup.get(sName);
        if (mapping && mapping.normId === fNormId) {
          const valStr = decodeSignal(f.data, mapping.sig);
          const val = parseFloat(valStr.split(' ')[0]);
          if (!isNaN(val)) { lkvMap[sName] = val; updated = true; }
        }
      });
      if (updated) processedPoints.push({ time: fTime, ...lkvMap });
    }
    return processedPoints;
  }, [frames, selectedSignalNames, library]);

  const statistics = useMemo(() => {
    if (selectedSignalNames.length === 0 || plotData.length === 0) return null;
    
    const overall = { 
      start: plotData[0].time, 
      end: plotData[plotData.length - 1].time 
    };

    const computeRangeStats = (startTime: number, endTime: number) => {
      const filtered = plotData.filter(d => d.time >= startTime && d.time <= endTime);
      const stats: Record<string, any> = {};
      selectedSignalNames.forEach(sigName => {
        const vals = filtered.map(d => d[sigName]).filter(v => v !== undefined);
        if (vals.length === 0) return;
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        stats[sigName] = {
          first: filtered[0]?.time || 0,
          last: filtered[filtered.length - 1]?.time || 0,
          dt: (filtered[filtered.length - 1]?.time || 0) - (filtered[0]?.time || 0),
          min: Math.min(...vals), 
          max: Math.max(...vals), 
          avg, 
          rms: Math.sqrt(vals.reduce((a, b) => a + (b * b), 0) / vals.length),
          std: Math.sqrt(vals.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / vals.length),
          delta: vals[vals.length - 1] - vals[0]
        };
      });
      return stats;
    };

    const visLeft = typeof left === 'number' ? left : overall.start;
    const visRight = typeof right === 'number' ? right : overall.end;
    
    const selLeft = refAreaLeft !== null ? (refAreaRight !== null ? Math.min(refAreaLeft, refAreaRight) : refAreaLeft) : visLeft;
    const selRight = refAreaRight !== null ? Math.max(refAreaLeft!, refAreaRight) : visRight;

    return {
      visible: computeRangeStats(visLeft, visRight),
      selected: computeRangeStats(selLeft, selRight),
      overall
    };
  }, [plotData, left, right, refAreaLeft, refAreaRight, selectedSignalNames]);

  const activeSignalUnit = useMemo(() => {
    if (!activeSignalName) return "";
    for (const msg of Object.values(library.database)) {
      if (msg.signals[activeSignalName]) return msg.signals[activeSignalName].unit || "";
    }
    return "";
  }, [activeSignalName, library]);

  // Unified helper to get axis domain for any signal
  const getSignalDomain = (sigName: string | null) => {
    if (!sigName || !statistics?.visible?.[sigName]) return ['auto', 'auto'];
    const { min, max } = statistics.visible[sigName];
    const padding = (max - min) * 0.1 || 1;
    return [min - padding, max + padding];
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
    }
  };

  const onChartMouseMove = (e: any) => {
    if (!e) return;
    if (e.activePayload) setCursorData(e);
    if (controlMode === 'select' && refAreaLeft !== null) {
      setRefAreaRight(e.activeLabel ? Number(e.activeLabel) : null);
    } else if (controlMode === 'adjust' && isPanning.current && panStartX.current !== null) {
      const deltaX = e.chartX - panStartX.current;
      const timeDelta = (deltaX / 800) * (panStartTimeRight.current - panStartTimeLeft.current);
      setLeft(panStartTimeLeft.current - timeDelta);
      setRight(panStartTimeRight.current - timeDelta);
    }
  };

  const handleZoom = () => {
    if (refAreaLeft === refAreaRight || refAreaRight === null || refAreaLeft === null) return;
    setLiveSync(false);
    let l = refAreaLeft, r = refAreaRight;
    if (l > r) [l, r] = [r, l];
    setLeft(l); setRight(r);
    setRefAreaLeft(null); setRefAreaRight(null);
  };

  const toggleSignalSelection = (sName: string) => {
    setSelectedSignalNames(prev => prev.includes(sName) ? prev.filter(n => n !== sName) : [...prev, sName]);
  };

  const StatRow = ({ label, value, unit, indent = false }: { label: string; value: string | number; unit?: string; indent?: boolean }) => (
    <div className={`flex justify-between items-baseline font-mono text-[11px] leading-relaxed py-0.5 ${indent ? 'pl-2' : ''}`}>
      <span className="text-slate-900 pr-4">{label}</span>
      <div className="flex gap-1.5 min-w-0 flex-1 justify-end">
        <span className="text-slate-800 font-bold truncate text-right">{value}</span>
        {unit && <span className="text-slate-900 w-6 text-right shrink-0">{unit}</span>}
      </div>
    </div>
  );

  const displayedSignals = useMemo(() => {
    if (zoomedSignal) return [zoomedSignal];
    return selectedSignalNames;
  }, [selectedSignalNames, zoomedSignal]);

  return (
    <div className="flex flex-col h-full w-full bg-white font-inter text-slate-900 overflow-hidden">
      {/* Visualizer Global Header */}
      <div className="h-12 border-b bg-slate-50 flex items-center px-4 gap-4 shrink-0 shadow-sm z-50">
        <div className="flex items-center gap-2 border-r pr-4">
          <button onClick={() => setIsChannelTreeOpen(!isChannelTreeOpen)} className={`p-1.5 rounded border transition-all ${isChannelTreeOpen ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-400 border-slate-200'}`} title="Pane 1: Matrix Navigator"><LayoutPanelLeft size={16} /></button>
          <button onClick={() => setIsTracePoolOpen(!isTracePoolOpen)} className={`p-1.5 rounded border transition-all ${isTracePoolOpen ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-400 border-slate-200'}`} title="Pane 2: Trace Pool"><ListFilter size={16} /></button>
          <button onClick={() => setIsStatsOpen(!isStatsOpen)} className={`p-1.5 rounded border transition-all ${isStatsOpen ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-400 border-slate-200'}`} title="Pane 4: Advanced Stats">{isStatsOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}</button>
        </div>

        <div className="flex-1 flex justify-center"><span className="text-[10px] font-orbitron font-black text-slate-400 uppercase tracking-widest">{selectedSignalNames.length} Active Traces Allocated</span></div>
        
        <div className="flex items-center gap-2">
          <button onClick={resetGraph} className="p-2 rounded border bg-white text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all active:scale-95" title="Reset View"><RefreshCw size={14}/></button>
          <button onClick={() => setControlMode('select')} className={`p-2 rounded border transition-colors ${controlMode === 'select' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-400 hover:text-indigo-600'}`}><MousePointer2 size={14}/></button>
          <button onClick={() => setControlMode('adjust')} className={`p-2 rounded border transition-colors ${controlMode === 'adjust' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-400 hover:text-indigo-600'}`}><Hand size={14}/></button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Pane 1: Channel Tree */}
        {isChannelTreeOpen && (
          <aside className="w-64 md:w-72 border-r bg-white flex flex-col shrink-0 animate-in slide-in-from-left duration-300">
            <div className="p-4 border-b bg-slate-50/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Matrix Search..." className="w-full pl-9 pr-4 py-2 bg-white border rounded-lg text-[10px] font-bold outline-none focus:ring-1 ring-indigo-500 shadow-sm" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
              <div className="flex items-center gap-2 px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b mb-2"><FolderOpen size={12} /> Matrix_Navigator</div>
              {groupedSignals.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">
                    {isOffline ? 'No data in log' : 'Awaiting live bus traffic...'}
                  </p>
                </div>
              ) : (
                groupedSignals.map(group => (
                  <div key={group.id} className="mb-1">
                    <button onClick={() => setExpandedGroups(prev => prev.includes(group.id) ? prev.filter(g => g !== group.id) : [...prev, group.id])} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded text-left transition-colors">
                      {expandedGroups.includes(group.id) ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                      <span className="text-[10px] font-bold text-slate-700 truncate">{group.cleanName}</span>
                    </button>
                    {expandedGroups.includes(group.id) && (
                      <div className="ml-6 space-y-1 mt-1 border-l pl-3">
                        {group.signals.map(sig => {
                          const isSelected = selectedSignalNames.includes(sig.name);
                          return (
                            <button key={sig.name} onClick={() => toggleSignalSelection(sig.name)} className={`w-full flex items-center gap-3 px-3 py-1.5 rounded text-[10px] transition-all group ${isSelected ? 'bg-indigo-50 text-indigo-600 font-black' : 'text-slate-400 hover:text-slate-800'}`}>
                              <div className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white group-hover:border-slate-400'}`}>{isSelected && <Check size={10} className="text-white" />}</div>
                              <span className="truncate">{sig.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </aside>
        )}

        {/* Pane 2: Trace Pool */}
        {isTracePoolOpen && (
          <aside className="w-64 md:w-72 border-r bg-slate-50/30 flex flex-col shrink-0 animate-in fade-in duration-300">
            <div className="p-4 border-b bg-slate-50/50 flex items-center justify-between">
              <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2"><Activity size={12} /> Trace_Pool</span>
              <span className="text-[10px] font-mono text-slate-400">[{selectedSignalNames.length}]</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-1">
              {selectedSignalNames.map((sName, i) => {
                const isActive = sName === activeSignalName;
                const sigColor = colors[i % colors.length];
                return (
                  <button key={sName} onClick={() => setActiveSignalName(sName)} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl border transition-all text-left group ${isActive ? 'bg-white border-indigo-400 shadow-md ring-4 ring-indigo-500/5' : 'bg-transparent border-transparent text-slate-500 hover:bg-white hover:border-slate-200'}`}>
                    <div className="w-2.5 h-2.5 rounded-sm shrink-0 shadow-sm" style={{ backgroundColor: sigColor }} />
                    <div className="flex-1 min-w-0">
                      <span className={`text-[10px] block truncate ${isActive ? 'font-black text-indigo-600' : 'font-bold'}`}>{sName}</span>
                      <span className="text-[8px] font-mono text-slate-400 block mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">Δ={statistics?.visible?.[sName]?.delta?.toFixed(3) || '0.000'}</span>
                    </div>
                    {isActive && <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse" />}
                  </button>
                );
              })}
            </div>
          </aside>
        )}

        {/* Pane 3: Chart Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-white relative overflow-hidden">
          <div className={`flex-1 overflow-y-auto custom-scrollbar flex flex-col p-4 space-y-6 ${controlMode === 'select' ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}>
            {displayedSignals.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30 h-full">
                <Activity size={48} className="mb-4" />
                <p className="text-[12px] font-orbitron font-black uppercase tracking-[0.5em]">Awaiting_Signal_Selection</p>
              </div>
            ) : (
              displayedSignals.map((sName) => {
                const originalIndex = selectedSignalNames.indexOf(sName);
                const isActive = sName === activeSignalName;
                const sigColor = colors[originalIndex % colors.length];
                const isZoomed = zoomedSignal === sName;
                
                return (
                  <div 
                    key={sName} 
                    onClick={() => setActiveSignalName(sName)}
                    className={`${isZoomed ? 'flex-1 min-h-[400px]' : 'h-64'} shrink-0 border rounded-3xl transition-all overflow-hidden bg-white shadow-sm ${isActive ? 'ring-2 ring-indigo-500/20 border-indigo-200' : 'border-slate-100 hover:border-slate-200'}`}
                  >
                    <div className="h-6 bg-slate-50/50 border-b flex items-center px-4 justify-between">
                       <div className="flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sigColor }} />
                         <span className="text-[8px] font-orbitron font-black uppercase text-slate-400 tracking-widest">{sName}</span>
                       </div>
                       <button 
                         onClick={(e) => { e.stopPropagation(); setZoomedSignal(isZoomed ? null : sName); }}
                         className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-400"
                         title={isZoomed ? "Exit Zoom" : "Zoom Signal"}
                       >
                         {isZoomed ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                       </button>
                    </div>
                    <div className="h-[calc(100%-24px)] w-full py-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={plotData} onMouseDown={onChartMouseDown} onMouseMove={onChartMouseMove} onMouseUp={() => { handleZoom(); isPanning.current = false; }} margin={{ top: 10, right: 30, left: 40, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="time" type="number" domain={[left, right]} allowDataOverflow fontSize={10} stroke="#cbd5e1" tickFormatter={v => `${v.toFixed(0)}`} hide={false} />
                          <YAxis 
                            fontSize={10} 
                            stroke={sigColor} 
                            domain={getSignalDomain(sName)} 
                            allowDataOverflow 
                            width={60}
                          >
                            <Label 
                              value={sName} 
                              angle={-90} 
                              position="insideLeft" 
                              style={{ textAnchor: 'middle', fontSize: '9px', fontWeight: 'bold', fill: sigColor }} 
                              offset={-10}
                            />
                          </YAxis>
                          <Tooltip content={<div className="hidden" />} />
                          <Line key={sName} type="monotone" dataKey={sName} stroke={sigColor} strokeWidth={isActive ? 2.5 : 1.5} dot={false} isAnimationActive={!liveSync} />
                          {refAreaLeft !== null && refAreaRight !== null && <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={1} stroke="#eab308" fill="#4f46e5" fillOpacity={0.1} />}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="h-10 border-t bg-slate-50 flex items-center justify-center px-8 gap-12 shrink-0">
             <div className="flex gap-4 text-[10px] font-mono font-bold text-slate-500">
                <span>t1 = {statistics?.visible?.[activeSignalName || '']?.first?.toFixed(6) || '0.000000'}s</span>
                <span>t2 = {statistics?.visible?.[activeSignalName || '']?.last?.toFixed(6) || '0.000000'}s</span>
             </div>
             <div className="flex items-center gap-2 px-4 py-1 bg-white border rounded-md shadow-sm">
                <span className="text-[9px] font-orbitron font-black text-slate-400">Δt =</span>
                <span className="text-[10px] font-mono font-black text-indigo-600">{statistics?.visible?.[activeSignalName || '']?.dt?.toFixed(6) || '0.000000'} s</span>
             </div>
          </div>
        </main>

        {/* Pane 4: Advanced Stats Engine */}
        {isStatsOpen && (
          <aside className="w-80 md:w-96 border-l bg-white flex flex-col shrink-0 animate-in slide-in-from-right duration-300">
            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col p-6 space-y-6">
              <div className="mb-2">
                <h3 className="text-[14px] font-orbitron font-black text-indigo-600 truncate border-b pb-4 border-slate-200">
                  {activeSignalName || 'No Signal Selected'}
                </h3>
              </div>

              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-slate-900 font-orbitron tracking-tight">Cursor</h4>
                <div className="bg-slate-50 p-3 border rounded border-slate-200 space-y-1">
                  <StatRow label="Timestamp" value={cursorData?.activeLabel?.toFixed(6) || ''} unit="s" />
                  <StatRow label="Value" value={cursorData?.activePayload?.find((p: any) => p.dataKey === activeSignalName)?.value?.toFixed(6) || ''} unit={activeSignalUnit} />
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-slate-900 font-orbitron tracking-tight">Selected range</h4>
                <div className="bg-slate-50 p-3 border rounded border-slate-200 space-y-1">
                  {activeSignalName && statistics?.selected?.[activeSignalName] ? (
                    <>
                      <StatRow label="First timestamp" value={statistics.selected[activeSignalName].first.toFixed(14)} unit="s" />
                      <StatRow label="Last timestamp" value={statistics.selected[activeSignalName].last.toFixed(6)} unit="s" />
                      <StatRow label="Δt" value={statistics.selected[activeSignalName].dt.toFixed(6)} unit="s" />
                      <StatRow label="Min" value={statistics.selected[activeSignalName].min.toFixed(0)} unit={activeSignalUnit} />
                      <StatRow label="Max" value={statistics.selected[activeSignalName].max.toFixed(0)} unit={activeSignalUnit} />
                      <StatRow label="Average" value={statistics.selected[activeSignalName].avg.toFixed(10)} unit={activeSignalUnit} />
                      <StatRow label="RMS" value={statistics.selected[activeSignalName].rms.toFixed(10)} unit={activeSignalUnit} />
                      <StatRow label="STD" value={statistics.selected[activeSignalName].std.toFixed(10)} unit={activeSignalUnit} />
                      <StatRow label="Δ" value={statistics.selected[activeSignalName].delta.toFixed(0)} unit={activeSignalUnit} />
                    </>
                  ) : (
                    <div className="text-[10px] text-slate-400 italic py-2 text-center">No selection region active</div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-slate-900 font-orbitron tracking-tight">Visible range</h4>
                <div className="bg-slate-50 p-3 border rounded border-slate-200 space-y-1">
                  {activeSignalName && statistics?.visible?.[activeSignalName] ? (
                    <>
                      <StatRow label="First timestamp" value={statistics.visible[activeSignalName].first.toFixed(9)} unit="s" />
                      <StatRow label="Last timestamp" value={statistics.visible[activeSignalName].last.toFixed(6)} unit="s" />
                      <StatRow label="Δt" value={statistics.visible[activeSignalName].dt.toFixed(9)} unit="s" />
                      <StatRow label="Min" value={statistics.visible[activeSignalName].min.toFixed(0)} unit={activeSignalUnit} />
                      <StatRow label="Max" value={statistics.visible[activeSignalName].max.toFixed(0)} unit={activeSignalUnit} />
                      <StatRow label="Average" value={statistics.visible[activeSignalName].avg.toFixed(10)} unit={activeSignalUnit} />
                      <StatRow label="RMS" value={statistics.visible[activeSignalName].rms.toFixed(10)} unit={activeSignalUnit} />
                      <StatRow label="STD" value={statistics.visible[activeSignalName].std.toFixed(10)} unit={activeSignalUnit} />
                      <StatRow label="Δ" value={statistics.visible[activeSignalName].delta.toFixed(0)} unit={activeSignalUnit} />
                    </>
                  ) : (
                    <div className="text-[10px] text-slate-400 italic py-2 text-center">No visible data points</div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-slate-900 font-orbitron tracking-tight">Overall</h4>
                <div className="bg-slate-50 p-3 border rounded border-slate-200 space-y-1">
                  <StatRow label="First timestamp" value={statistics?.overall?.start?.toFixed(14) || '0.00000000000000'} unit="s" />
                  <StatRow label="Last timestamp" value={statistics?.overall?.end?.toFixed(6) || '0.000000'} unit="s" />
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>

      <div className="h-6 bg-slate-100 border-t flex items-center justify-between px-6 text-[8px] font-orbitron font-black text-slate-400 uppercase tracking-widest shrink-0">
         <div className="flex gap-6"><span className="flex items-center gap-1"><Hash size={10}/> {frames.length.toLocaleString()} Pkts_Buffer</span><span>OSM_TELEMETRY_ENGINE_v9.7</span></div>
         <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" /> BRIDGE_{isOffline ? 'OFFLINE_LOG' : 'HARDWARE_LIVE'}</div>
      </div>
    </div>
  );
};

export default LiveVisualizerDashboard;

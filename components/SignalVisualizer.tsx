import React, { useState, useMemo, useEffect } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, Label, ReferenceArea, Brush
} from 'recharts';
import { Search, Filter, Activity, Maximize2, RefreshCw, Compass, Unlock, Lock, GripVertical, ZoomIn, ZoomOut } from 'lucide-react';
import { ConversionLibrary } from '../types.ts';

interface DataPoint {
  time: number;
  [key: string]: number;
}

interface SignalVisualizerProps {
  logData: DataPoint[];
  availableSignals: string[];
  library: ConversionLibrary;
  fullMode?: boolean;
  navigatorWidth?: number;
  onResizeNav?: () => void;
  onEnterFullScreen?: () => void;
  onExit?: () => void;
}

const SignalVisualizer: React.FC<SignalVisualizerProps> = ({ 
  logData, 
  availableSignals, 
  fullMode = false, 
  navigatorWidth = 320,
  onResizeNav,
  onEnterFullScreen, 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSignals, setSelectedSignals] = useState<string[]>([]);
  const [liveSync, setLiveSync] = useState(true);
  
  const [refAreaLeft, setRefAreaLeft] = useState<number | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<number | null>(null);
  const [left, setLeft] = useState<number | string>('dataMin');
  const [right, setRight] = useState<number | string>('dataMax');

  useEffect(() => {
    if (liveSync && logData.length > 0) {
      const latestTime = logData[logData.length - 1].time;
      const windowSize = 10;
      setLeft(Math.max(0, latestTime - windowSize));
      setRight(latestTime);
    }
  }, [logData, liveSync]);

  const filteredSignalsList = useMemo(() => {
    return availableSignals.filter(s => 
      s.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort();
  }, [availableSignals, searchTerm]);

  const toggleSignal = (signal: string) => {
    setSelectedSignals(prev => 
      prev.includes(signal) 
        ? prev.filter(s => s !== signal) 
        : [...prev, signal]
    );
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

  const resetZoom = () => {
    setLeft('dataMin');
    setRight('dataMax');
    setLiveSync(false);
    setRefAreaLeft(null);
    setRefAreaRight(null);
  };

  const colors = [
    '#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444', '#f97316', '#a855f7', '#14b8a6',
  ];

  const signalMatrix = (
    <div className={`flex flex-col h-full bg-slate-50 border-r border-slate-200 relative`} style={{ width: `${navigatorWidth}px` }}>
      <div className="p-6 pb-4 flex flex-col gap-4 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-orbitron font-black text-slate-800 tracking-[0.3em] uppercase whitespace-nowrap">SIGNAL_NAVIGATOR</span>
        </div>
        
        <button
          onClick={() => {
            setLiveSync(!liveSync);
            if (!liveSync) resetZoom();
          }}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[8px] font-orbitron font-black uppercase transition-all border shadow-sm ${
            liveSync ? 'bg-indigo-600 border-indigo-700 text-white' : 'bg-white border-slate-200 text-slate-400'
          }`}
        >
          {liveSync ? <Unlock size={12} /> : <Lock size={12} />}
          {liveSync ? 'Live_Following_Active' : 'Data_Stream_Locked'}
        </button>

        <div className="relative">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search size={14} className="text-slate-400" />
          </div>
          <input 
            type="text" 
            placeholder="SEARCH_LOGIC..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-11 pr-4 text-[10px] font-mono text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-indigo-500/50 transition-all uppercase tracking-widest shadow-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 space-y-2 pb-12">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-[8px] font-orbitron font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Compass size={12} className="text-indigo-400" /> SIGNAL_MATRIX
          </span>
          <span className="text-[8px] font-orbitron font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
            {selectedSignals.length}/{availableSignals.length}
          </span>
        </div>

        {filteredSignalsList.map((sig) => {
          const isSelected = selectedSignals.includes(sig);
          const idx = availableSignals.indexOf(sig);
          const color = colors[idx % colors.length];

          return (
            <button
              key={sig}
              onClick={() => toggleSignal(sig)}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all group border ${
                isSelected 
                  ? 'bg-white border-indigo-200 shadow-md' 
                  : 'bg-transparent border-transparent hover:bg-white hover:shadow-sm'
              }`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div 
                  className="w-3.5 h-3.5 rounded-full border-2 border-slate-200 shrink-0 flex items-center justify-center transition-all"
                  style={{ 
                    borderColor: isSelected ? color : undefined,
                    backgroundColor: isSelected ? color : 'transparent' 
                  }}
                >
                  {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full shadow-sm"></div>}
                </div>
                <span className={`text-[10px] font-black tracking-tight uppercase truncate transition-colors ${
                  isSelected ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-600'
                }`}>
                  {sig.replace(/_/g, ' ')}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      
      {fullMode && onResizeNav && (
        <div 
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-indigo-500/50 transition-colors z-50 flex items-center justify-center group"
          onMouseDown={(e) => { e.stopPropagation(); onResizeNav(); }}
        >
          <GripVertical size={12} className="text-slate-300 opacity-0 group-hover:opacity-100" />
        </div>
      )}
    </div>
  );

  const mainArea = (
    <div className={`flex flex-col h-full bg-white overflow-hidden ${fullMode ? 'p-8 pb-12' : ''}`}>
      <div className="mb-4 flex items-center gap-4 relative z-10 shrink-0">
         <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
         <div className="text-[10px] font-orbitron font-black text-slate-300 tracking-[0.8em] uppercase">TACTICAL_SIGNAL_PROJECTOR</div>
         <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
      </div>

      <div className="flex items-center justify-between mb-4 shrink-0 relative z-10">
        <h3 className={`${fullMode ? 'text-2xl' : 'text-xl'} font-orbitron font-black text-slate-900 tracking-[0.1em] uppercase truncate pr-4`}>
          MISSION_CRITICAL_TELEMETRY
        </h3>

        <div className="flex items-center gap-3 shrink-0">
          {(left !== 'dataMin' || right !== 'dataMax' || !liveSync) && (
            <button 
              onClick={() => { resetZoom(); setLiveSync(true); }} 
              className="flex items-center gap-2 px-4 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 rounded-xl text-[9px] font-orbitron font-black uppercase tracking-widest transition-all shadow-sm active:scale-95"
            >
              <RefreshCw size={12} /> Resume_Live_Stream
            </button>
          )}

          {!fullMode && onEnterFullScreen && (
            <button 
              onClick={onEnterFullScreen} 
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-600 rounded-xl text-[9px] font-orbitron font-black uppercase tracking-widest transition-all group active:scale-95 shadow-sm"
            >
              <Maximize2 size={12} className="group-hover:scale-110 transition-transform" /> Full_HUD_Mode
            </button>
          )}
        </div>
      </div>

      <div className={`flex-1 min-h-0 bg-slate-50 rounded-[32px] border border-slate-100 shadow-inner relative z-10 overflow-hidden`}>
        <div className="absolute top-4 right-6 z-20 flex gap-2">
            <div className="px-3 py-1.5 bg-white/80 border border-slate-200 rounded-lg text-[8px] font-mono text-slate-400 uppercase tracking-widest flex items-center gap-2 shadow-sm">
                <ZoomIn size={10} /> Drag region to Zoom
            </div>
        </div>

        <div className="h-full w-full p-4 md:p-8 cursor-crosshair">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={logData} 
              margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
              onMouseDown={(e) => e && setRefAreaLeft(e.activeLabel ? Number(e.activeLabel) : null)}
              onMouseMove={(e) => e && refAreaLeft !== null && setRefAreaRight(e.activeLabel ? Number(e.activeLabel) : null)}
              onMouseUp={handleZoom}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis 
                dataKey="time" 
                stroke="#94a3b8" 
                fontSize={9} 
                type="number" 
                domain={[left, right]} 
                allowDataOverflow 
                tickFormatter={(val) => `${val.toFixed(2)}s`}
                tick={{ fill: '#94a3b8' }}
              />
              <YAxis 
                stroke="#94a3b8" 
                fontSize={9} 
                domain={['auto', 'auto']} 
                width={55} 
                allowDataOverflow 
                tick={{ fill: '#94a3b8' }}
              />
              <Tooltip 
                contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                    border: '1px solid rgba(79, 70, 229, 0.2)', 
                    borderRadius: '16px', 
                    fontSize: '11px', 
                    color: '#0f172a',
                    backdropFilter: 'blur(8px)',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
                }}
                itemStyle={{ padding: '2px 0' }}
                labelFormatter={(val) => `Time: ${Number(val).toFixed(4)}s`}
              />
              <Legend 
                verticalAlign="top" 
                height={40} 
                iconType="circle"
                wrapperStyle={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.15em', paddingBottom: '20px', color: '#1e293b' }} 
              />
              
              {selectedSignals.map((sig, idx) => (
                <Line 
                  key={sig} 
                  type="monotone" 
                  dataKey={sig} 
                  stroke={colors[idx % colors.length]} 
                  strokeWidth={2} 
                  dot={{ r: 2, strokeWidth: 1, fill: colors[idx % colors.length] }} 
                  activeDot={{ r: 6, strokeWidth: 0 }} 
                  connectNulls={true} 
                  animationDuration={300} 
                  isAnimationActive={!liveSync}
                />
              ))}

              {refAreaLeft !== null && refAreaRight !== null ? (
                <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.4} fill="#4f46e5" fillOpacity={0.1} />
              ) : null}

              {selectedSignals.length > 0 && (
                <Brush 
                  dataKey="time" 
                  height={30} 
                  stroke="#4f46e5" 
                  fill="#ffffff" 
                  gap={10} 
                  startIndex={0}
                  travellerWidth={10}
                  tickFormatter={() => ''}
                  className="custom-brush"
                >
                  <LineChart>
                    {selectedSignals.slice(0, 1).map((sig, idx) => (
                      <Line key={`brush-${sig}`} type="monotone" dataKey={sig} stroke="#4f46e5" dot={false} strokeWidth={1} />
                    ))}
                  </LineChart>
                </Brush>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  if (fullMode) {
    return (
      <div className="h-full w-full flex overflow-hidden bg-white animate-in fade-in duration-700">
        {signalMatrix}
        <div className="flex-1 h-full overflow-hidden relative">
          {mainArea}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 h-full bg-white overflow-hidden rounded-xl border border-slate-200 shadow-xl">
      <div className="col-span-12 lg:col-span-3 h-full overflow-hidden flex flex-col">
        {signalMatrix}
      </div>
      <div className="col-span-12 lg:col-span-9 h-full flex flex-col overflow-hidden relative">
        {selectedSignals.length > 0 ? mainArea : (
          <div className="h-full w-full flex flex-col items-center justify-center text-center p-12">
            <div className="relative mb-8">
                <div className="absolute inset-0 bg-indigo-50 blur-2xl rounded-full scale-150 animate-pulse"></div>
                <Activity size={48} className="text-indigo-200 relative z-10" />
            </div>
            <p className="text-[12px] font-orbitron font-black text-slate-300 uppercase tracking-[0.5em]">SELECT_SIGNAL_TO_PROJECT_HUD</p>
            <p className="text-[9px] font-mono text-slate-200 mt-4 uppercase tracking-widest">Awaiting signal allocation from matrix navigator...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SignalVisualizer;
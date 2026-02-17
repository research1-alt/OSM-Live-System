import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Upload, FileText, Activity, BarChart3, Trash2, ArrowLeft, Database, Search, ChevronRight, Save, MessageSquare, BrainCircuit, Send, Loader2, TrendingUp, Info, Zap, PieChart, ShieldAlert, AlertTriangle, Clock, Battery, Filter, XCircle, History, Gauge } from 'lucide-react';
import { CANFrame, ConversionLibrary, DBCMessage, DBCSignal } from '../types';
import { parseTrcFile } from '../utils/trcParser';
import { normalizeId, decodeSignal, cleanMessageName } from '../utils/decoder';
import LiveVisualizerDashboard from './LiveVisualizerDashboard';
import { GoogleGenAI } from "@google/genai";

interface DataDecoderProps {
  library: ConversionLibrary;
  onExit: () => void;
}

const ERROR_IDS = ["1038FF50", "18305040"];
const SOC_MSG_DEC_ID = "2418544720"; // Decimal for 0x10281050
const SOC_SIGNAL_NAME = "State_of_Charger_SOC";

const DataDecoder: React.FC<DataDecoderProps> = ({ library, onExit }) => {
  const [offlineFrames, setOfflineFrames] = useState<CANFrame[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [tab, setTab] = useState<'visualizer' | 'diagnostics' | 'data' | 'chat'>('visualizer');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSignals, setSelectedSignals] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  // Filter State
  const [filterStartSoc, setFilterStartSoc] = useState<string>('');
  const [filterEndSoc, setFilterEndSoc] = useState<string>('');
  const [activeRange, setActiveRange] = useState<{ start: number; end: number } | null>(null);
  
  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Pre-calculate SOC Timeline for filtering
  const socTimeline = useMemo(() => {
    if (offlineFrames.length === 0) return [];
    const socSig = library.database[SOC_MSG_DEC_ID]?.signals?.[SOC_SIGNAL_NAME];
    if (!socSig) return [];

    return offlineFrames
      .filter(f => normalizeId(f.id, true) === normalizeId(SOC_MSG_DEC_ID))
      .map(f => ({
        timestamp: f.timestamp,
        soc: parseFloat(decodeSignal(f.data, socSig))
      }))
      .filter(item => !isNaN(item.soc));
  }, [offlineFrames, library]);

  const availableSocRange = useMemo(() => {
    if (socTimeline.length === 0) return null;
    const values = socTimeline.map(t => t.soc);
    return {
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }, [socTimeline]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsed = parseTrcFile(content);
      setOfflineFrames(parsed);
      setActiveRange(null);
      setFilterStartSoc('');
      setFilterEndSoc('');
      setChatHistory([{ 
        role: 'ai', 
        text: `MISSION_RECAP: Successfully ingested ${parsed.length.toLocaleString()} tactical units from ${file.name}. SOC metrics mapped. Ready to analyze specific percentage ranges.` 
      }]);
    };
    reader.readAsText(file);
  };

  const applySocFilter = () => {
    const startSoc = parseFloat(filterStartSoc);
    const endSoc = parseFloat(filterEndSoc);
    
    if (isNaN(startSoc) || isNaN(endSoc) || socTimeline.length === 0) return;

    // Find the time window corresponding to these SOC values
    // We assume the user wants the segment where SOC was between these two values
    // Find the first occurrence of startSoc and the last occurrence of endSoc (or vice-versa)
    
    // Sort SOC points by time just in case
    const sortedTimeline = [...socTimeline].sort((a, b) => a.timestamp - b.timestamp);
    
    // Find timestamps where SOC is closest to start and end
    const findTimeForSoc = (targetSoc: number) => {
      let closest = sortedTimeline[0];
      let minDiff = Math.abs(sortedTimeline[0].soc - targetSoc);
      
      for (const point of sortedTimeline) {
        const diff = Math.abs(point.soc - targetSoc);
        if (diff < minDiff) {
          minDiff = diff;
          closest = point;
        }
      }
      return closest.timestamp;
    };

    const tStart = findTimeForSoc(startSoc);
    const tEnd = findTimeForSoc(endSoc);

    // Set the window based on time bounds found
    setActiveRange({
      start: Math.min(tStart, tEnd),
      end: Math.max(tStart, tEnd)
    });
  };

  const clearFilter = () => {
    setFilterStartSoc('');
    setFilterEndSoc('');
    setActiveRange(null);
  };

  // Filtered frames based on range selection
  const filteredFrames = useMemo(() => {
    if (!activeRange) return offlineFrames;
    return offlineFrames.filter(f => f.timestamp >= activeRange.start && f.timestamp <= activeRange.end);
  }, [offlineFrames, activeRange]);

  // Pre-calculate DBC lookup map for speed and accuracy
  const dbcLookup = useMemo(() => {
    const map = new Map<string, DBCMessage>();
    if (!library?.database) return map;
    
    (Object.entries(library.database) as [string, DBCMessage][]).forEach(([key, message]) => {
      const normId = normalizeId(key, false); 
      map.set(normId, message);
    });
    return map;
  }, [library]);

  const latestFramesMap = useMemo(() => {
    const map: Record<string, CANFrame> = {};
    filteredFrames.forEach(f => {
      map[normalizeId(f.id, true)] = f;
    });
    return map;
  }, [filteredFrames]);

  // Detected Faults Logic (using filtered frames)
  const detectedFaults = useMemo(() => {
    const faults: Array<{ timestamp: number, message: string, id: string, type: 'BATT' | 'MCU' }> = [];
    if (filteredFrames.length === 0) return [];
    
    filteredFrames.forEach(f => {
      const normId = normalizeId(f.id, true);
      if (ERROR_IDS.includes(normId)) {
        const message = dbcLookup.get(normId);
        if (message) {
          const signals = Object.values(message.signals) as DBCSignal[];
          signals.forEach(sig => {
            const val = decodeSignal(f.data, sig);
            if (val.trim() === '1') {
              faults.push({
                timestamp: f.timestamp,
                id: f.id,
                message: sig.name.replace(/_/g, ' '),
                type: normId === '1038FF50' ? 'BATT' : 'MCU'
              });
            }
          });
        }
      }
    });

    return faults.sort((a, b) => b.timestamp - a.timestamp);
  }, [filteredFrames, dbcLookup]);

  // Deep Statistics Calculation (using filtered frames)
  const signalStats = useMemo(() => {
    if (filteredFrames.length === 0) return [];
    const statsMap: Record<string, { 
      name: string; 
      msgId: string; 
      min: number; 
      max: number; 
      avg: number; 
      count: number; 
      sum: number;
      unit: string;
    }> = {};

    const step = Math.max(1, Math.floor(filteredFrames.length / 10000));
    for (let i = 0; i < filteredFrames.length; i += step) {
      const frame = filteredFrames[i];
      const normId = normalizeId(frame.id, true);
      const message = dbcLookup.get(normId);
      
      if (message) {
        Object.values(message.signals).forEach((sig: DBCSignal) => {
          const valStr = decodeSignal(frame.data, sig);
          const val = parseFloat(valStr);
          if (!isNaN(val)) {
            if (!statsMap[sig.name]) {
              statsMap[sig.name] = { 
                name: sig.name, 
                msgId: normId, 
                min: val, 
                max: val, 
                avg: 0, 
                count: 0, 
                sum: 0,
                unit: sig.unit || ''
              };
            }
            const s = statsMap[sig.name];
            s.min = Math.min(s.min, val);
            s.max = Math.max(s.max, val);
            s.sum += val;
            s.count++;
          }
        });
      }
    }

    return Object.values(statsMap).map(s => ({
      ...s,
      avg: s.sum / s.count
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredFrames, dbcLookup]);

  const handleSaveDecodedData = async () => {
    if (filteredFrames.length === 0) return;
    setIsExporting(true);
    
    setTimeout(async () => {
      try {
        const activeSignalMeta: { name: string; msgId: string; sig: DBCSignal }[] = [];
        const msgIdToSignalNames: Record<string, string[]> = {};

        const frameIdsInLog = new Set(filteredFrames.map(f => normalizeId(f.id.replace('0x', ''), true)));

        (Object.entries(library.database) as [string, DBCMessage][]).forEach(([decKey, msg]) => {
          const normId = normalizeId(decKey);
          if (frameIdsInLog.has(normId)) {
            msgIdToSignalNames[normId] = [];
            Object.values(msg.signals).forEach((sig: DBCSignal) => {
              activeSignalMeta.push({ name: sig.name, msgId: normId, sig });
              msgIdToSignalNames[normId].push(sig.name);
            });
          }
        });

        if (activeSignalMeta.length === 0) {
          alert("No DBC signals identified in this trace. Export aborted.");
          setIsExporting(false);
          return;
        }

        const header = ["Timestamp_ms", ...activeSignalMeta.map(s => `${s.name}_${s.sig.unit || 'raw'}`)].join(",");
        const csvRows: string[] = [header];

        const lastValues: Record<string, string> = {};
        activeSignalMeta.forEach(s => lastValues[s.name] = "0");

        filteredFrames.forEach((frame) => {
          const frameNormId = normalizeId(frame.id.replace('0x', ''), true);
          const signalsInThisMsg = msgIdToSignalNames[frameNormId];

          if (signalsInThisMsg) {
            const dbEntry = library.database[Object.keys(library.database).find(k => normalizeId(k) === frameNormId) || ""];
            if (dbEntry) {
              signalsInThisMsg.forEach(sName => {
                const sig = dbEntry.signals[sName];
                const val = decodeSignal(frame.data, sig);
                lastValues[sName] = val.split(' ')[0];
              });
              const row = [frame.timestamp.toFixed(3), ...activeSignalMeta.map(s => lastValues[s.name])].join(",");
              csvRows.push(row);
            }
          }
        });

        const blob = new Blob([csvRows.join("\n")], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        link.href = url;
        link.download = `OSM_DECODED_EXPORT_${stamp}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

      } catch (error) {
        console.error("Export failed:", error);
        alert("Decoded data export failed.");
      } finally {
        setIsExporting(false);
      }
    }, 100);
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userText = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: userText }]);
    setChatLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const faultStates = detectedFaults.slice(0, 10).map(f => {
        const nearestSocFrame = filteredFrames.find(fr => 
          normalizeId(fr.id, true) === normalizeId(SOC_MSG_DEC_ID) && 
          Math.abs(fr.timestamp - f.timestamp) < 500
        );
        let socVal = "Unknown";
        if (nearestSocFrame) {
           const socSig = library.database[SOC_MSG_DEC_ID]?.signals?.[SOC_SIGNAL_NAME];
           if (socSig) socVal = decodeSignal(nearestSocFrame.data, socSig);
        }
        return `Fault: ${f.message} at ${f.timestamp.toFixed(2)}ms (Vehicle State: SOC=${socVal})`;
      }).join('\n');

      const statsContext = signalStats.slice(0, 15).map(s => 
        `${s.name}: Min=${s.min}, Max=${s.max}, Avg=${s.avg.toFixed(2)}${s.unit}`
      ).join('\n');

      const prompt = `
        You are the Senior OSM Technical Support Engineer. 
        Mission: Diagnose vehicle behavior from log segment.
        Current Filter Range: ${filterStartSoc}% to ${filterEndSoc}% SOC.
        
        CRITICAL_DATA_SUMMARY:
        - Total Packets in Window: ${filteredFrames.length}
        - Detected Errors in Window: ${detectedFaults.length > 0 ? detectedFaults.length : 'NONE'}
        - Specific Fault Timeline & Correlation:
        ${faultStates || 'No critical fault triggers detected.'}
        
        SIGNAL_RANGES:
        ${statsContext}
        
        INSTRUCTIONS:
        1. Base findings ONLY on the data in the provided SOC window.
        2. Identify specific faults from the timeline.
        3. Correlate faults with state data (like SOC).
        4. Provide actionable engineering insights.
        
        USER_QUERY: "${userText}"
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      setChatHistory(prev => [...prev, { role: 'ai', text: response.text || "Diagnostic link lost." }]);
    } catch (error) {
      setChatHistory(prev => [...prev, { role: 'ai', text: "NEURAL_LINK_ERROR: Check system telemetry." }]);
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  return (
    <div className="h-full w-full flex flex-col bg-slate-50">
      <header className="h-16 bg-white border-b flex items-center justify-between px-6 shrink-0 z-[100] shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={onExit} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-lg font-orbitron font-black text-slate-900 uppercase tracking-tight">DATA_DECODER</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Tactical Analysis Suite</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {offlineFrames.length > 0 && (
            <div className="hidden md:flex items-center gap-4 mr-6 px-4 py-1.5 bg-slate-50 rounded-xl border border-slate-100">
               <span className="text-[8px] font-orbitron font-black text-slate-400 uppercase">Current Window:</span>
               <span className="text-[9px] font-mono font-bold text-indigo-600">{filteredFrames.length.toLocaleString()} / {offlineFrames.length.toLocaleString()} Frames</span>
            </div>
          )}
          
          {offlineFrames.length > 0 && (
            <button 
              onClick={handleSaveDecodedData}
              disabled={isExporting}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-orbitron font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 ${
                isExporting ? 'bg-amber-600 text-white animate-pulse' : 'bg-white border border-slate-200 text-indigo-600 hover:border-indigo-600'
              }`}
            >
              {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {isExporting ? 'EXPORTING...' : 'SAVE_WINDOW'}
            </button>
          )}

          <label className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-orbitron font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all cursor-pointer active:scale-95">
            <Upload size={14} />
            {offlineFrames.length > 0 ? 'REPLACE_LOG' : 'UPLOAD_TRC'}
            <input type="file" accept=".trc,.txt" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </header>

      {/* SOC Range Filter Bar */}
      {offlineFrames.length > 0 && (
        <div className="bg-slate-900 px-6 py-4 flex flex-col md:flex-row items-center gap-4 border-b border-slate-800 z-50">
          <div className="flex items-center gap-3 shrink-0">
             <div className="p-2 bg-indigo-600 rounded-lg text-white"><Battery size={16} /></div>
             <div className="flex flex-col">
                <span className="text-[10px] font-orbitron font-black text-white uppercase tracking-widest">SOC_BASED_FILTER</span>
                {availableSocRange && (
                  <span className="text-[8px] font-mono text-indigo-300 uppercase">Available: {availableSocRange.min}% - {availableSocRange.max}%</span>
                )}
             </div>
          </div>
          
          <div className="flex-1 flex flex-wrap items-center gap-3">
             <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-4 py-1.5 flex-1 min-w-[150px]">
                <span className="text-[8px] font-orbitron font-black text-slate-500 uppercase whitespace-nowrap">START SOC %:</span>
                <input 
                  type="number" 
                  value={filterStartSoc}
                  onChange={(e) => setFilterStartSoc(e.target.value)}
                  placeholder={availableSocRange ? `${availableSocRange.max}%` : '100'}
                  className="bg-transparent border-none text-[11px] font-mono text-emerald-400 focus:outline-none w-full placeholder:text-slate-600"
                />
             </div>
             <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-4 py-1.5 flex-1 min-w-[150px]">
                <span className="text-[8px] font-orbitron font-black text-slate-500 uppercase whitespace-nowrap">END SOC %:</span>
                <input 
                  type="number" 
                  value={filterEndSoc}
                  onChange={(e) => setFilterEndSoc(e.target.value)}
                  placeholder={availableSocRange ? `${availableSocRange.min}%` : '0'}
                  className="bg-transparent border-none text-[11px] font-mono text-emerald-400 focus:outline-none w-full placeholder:text-slate-600"
                />
             </div>
             <div className="flex gap-2 shrink-0">
               <button 
                  onClick={applySocFilter}
                  disabled={socTimeline.length === 0}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-orbitron font-black uppercase tracking-widest shadow-lg hover:bg-indigo-500 transition-all active:scale-95 disabled:opacity-30"
               >
                  UPDATE_RANGE
               </button>
               {activeRange && (
                 <button 
                    onClick={clearFilter}
                    className="p-2 bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all"
                 >
                    <XCircle size={18} />
                 </button>
               )}
             </div>
          </div>
          
          {activeRange && (
             <div className="hidden lg:flex items-center gap-2 px-4 py-1.5 bg-indigo-900/40 border border-indigo-500/30 rounded-xl animate-pulse">
                <span className="text-[8px] font-orbitron font-black text-indigo-300 uppercase">SOC_WINDOW_ACTIVE</span>
             </div>
          )}
        </div>
      )}

      <main className="flex-1 overflow-hidden flex flex-col min-h-0">
        {offlineFrames.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-24 h-24 bg-white border border-slate-100 text-indigo-600 rounded-[32px] flex items-center justify-center mb-8 shadow-2xl animate-pulse">
              <Database size={48} />
            </div>
            <h3 className="text-xl font-orbitron font-black text-slate-900 uppercase tracking-[0.4em]">AWAITING_FILE_STREAM</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-4 max-w-sm leading-relaxed">
              Import a PCAN-View .trc log file to begin deep-packet decoding with SOC windowing.
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <nav className="h-14 bg-white border-b px-6 flex items-center gap-2 md:gap-8 shrink-0 z-50 overflow-x-auto no-scrollbar">
               {[
                 { id: 'visualizer', label: 'Visualizer', icon: Activity },
                 { id: 'diagnostics', label: 'Diagnostics', icon: ShieldAlert },
                 { id: 'data', label: 'Data Stats', icon: TrendingUp },
                 { id: 'chat', label: 'Chat with AI', icon: BrainCircuit }
               ].map(t => (
                <button 
                  key={t.id}
                  onClick={() => setTab(t.id as any)}
                  className={`flex items-center gap-2.5 px-5 h-full border-b-2 transition-all whitespace-nowrap group ${tab === t.id ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                >
                  <t.icon size={16} className={tab === t.id ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'} />
                  <span className="text-[10px] font-orbitron font-black uppercase tracking-widest">{t.label}</span>
                </button>
               ))}
            </nav>

            <div className="flex-1 overflow-hidden relative">
              {tab === 'visualizer' ? (
                <LiveVisualizerDashboard 
                  frames={filteredFrames} 
                  library={library} 
                  latestFrames={latestFramesMap} 
                  selectedSignalNames={selectedSignals} 
                  setSelectedSignalNames={setSelectedSignals} 
                  isOffline={true} 
                />
              ) : tab === 'diagnostics' ? (
                <div className="h-full flex flex-col p-4 md:p-8 overflow-y-auto custom-scrollbar bg-white">
                  <div className="max-w-4xl mx-auto w-full space-y-8">
                    <header className="flex flex-col gap-2">
                       <h3 className="text-2xl font-orbitron font-black text-slate-900 uppercase flex items-center gap-4">
                         <ShieldAlert className="text-red-600" size={32} /> FAULT_DIAGNOSTICS_ENGINE
                       </h3>
                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Active scanning for Battery & MCU Fault Vectors</p>
                    </header>

                    {detectedFaults.length === 0 ? (
                      <div className="py-32 flex flex-col items-center justify-center text-center opacity-30">
                        <Zap size={64} className="text-emerald-500 mb-6" />
                        <h4 className="text-xl font-orbitron font-black uppercase tracking-widest text-emerald-600">All_Systems_Nominal</h4>
                        <p className="text-[10px] font-bold uppercase mt-2">No critical fault bits detected in the trace duration</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-red-50 border border-red-100 rounded-[32px] p-8 flex items-center justify-between shadow-sm mb-8">
                          <div>
                            <p className="text-[9px] font-orbitron font-black text-red-400 uppercase tracking-[0.3em]">Total_Fault_Events</p>
                            <p className="text-4xl font-orbitron font-black text-red-600">{detectedFaults.length}</p>
                          </div>
                          <div className="text-right">
                             <AlertTriangle size={48} className="text-red-500 animate-bounce" />
                          </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-[40px] shadow-2xl overflow-hidden">
                           <div className="p-6 border-b bg-slate-50 flex items-center justify-between">
                              <h4 className="text-[10px] font-orbitron font-black text-slate-800 uppercase tracking-widest">Fault_Event_Log</h4>
                           </div>
                           <div className="divide-y divide-slate-50">
                              {detectedFaults.map((f, i) => (
                                <div key={i} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                  <div className="flex items-center gap-5">
                                    <div className={`p-3 rounded-2xl ${f.type === 'BATT' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700 shadow-sm'}`}>
                                      {f.type === 'BATT' ? <Battery size={18} /> : <Zap size={18} />}
                                    </div>
                                    <div>
                                      <p className="text-[12px] font-black text-slate-900 uppercase tracking-tight">{f.message}</p>
                                      <p className="text-[9px] font-mono text-slate-400 uppercase mt-1">Source: {f.type}_VECTOR_ANALYSIS</p>
                                    </div>
                                  </div>
                                  <div className="text-right flex items-center gap-4">
                                    <div className="hidden md:block">
                                      <p className="text-[8px] font-orbitron font-black text-slate-300 uppercase">Timestamp</p>
                                      <p className="text-[11px] font-mono font-bold text-slate-500">{f.timestamp.toFixed(6)}ms</p>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-200" />
                                  </div>
                                </div>
                              ))}
                           </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : tab === 'data' ? (
                <div className="h-full flex flex-col p-4 md:p-8 overflow-y-auto custom-scrollbar bg-white">
                  <div className="max-w-6xl mx-auto w-full space-y-8">
                    <header className="flex flex-col gap-2">
                       <h3 className="text-2xl font-orbitron font-black text-slate-900 uppercase">SIGNAL_STATISTICS_MATRIX</h3>
                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Aggregated performance data</p>
                    </header>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-5">
                        <div className="p-4 bg-white text-indigo-600 rounded-2xl shadow-sm"><Zap size={24} /></div>
                        <div>
                          <p className="text-[9px] font-orbitron font-black text-slate-400 uppercase tracking-widest">Packets</p>
                          <p className="text-2xl font-orbitron font-black text-slate-900">{filteredFrames.length.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="bg-red-50 p-6 rounded-[32px] border border-red-100 shadow-sm flex items-center gap-5">
                        <div className="p-4 bg-white text-red-600 rounded-2xl shadow-sm"><ShieldAlert size={24} /></div>
                        <div>
                          <p className="text-[9px] font-orbitron font-black text-slate-400 uppercase tracking-widest">Faults Detected</p>
                          <p className="text-2xl font-orbitron font-black text-red-600">{detectedFaults.length}</p>
                        </div>
                      </div>
                      <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-5">
                        <div className="p-4 bg-white text-emerald-600 rounded-2xl shadow-sm"><Activity size={24} /></div>
                        <div>
                          <p className="text-[9px] font-orbitron font-black text-slate-400 uppercase tracking-widest">Signals</p>
                          <p className="text-2xl font-orbitron font-black text-slate-900">{signalStats.length}</p>
                        </div>
                      </div>
                      <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-5">
                        <div className="p-4 bg-white text-amber-600 rounded-2xl shadow-sm"><Clock size={24} /></div>
                        <div>
                          <p className="text-[9px] font-orbitron font-black text-slate-400 uppercase tracking-widest">Duration</p>
                          <p className="text-2xl font-orbitron font-black text-slate-900">
                            {filteredFrames.length > 0 ? ((filteredFrames[filteredFrames.length-1].timestamp - filteredFrames[0].timestamp) / 1000).toFixed(2) : 0}sec
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-[40px] shadow-2xl overflow-hidden flex flex-col mt-8">
                      <div className="p-8 border-b bg-slate-50/50 flex items-center justify-between">
                         <h4 className="text-[11px] font-orbitron font-black text-slate-800 uppercase tracking-widest">Decoded_Signal_Performance_Data</h4>
                         <span className="text-[9px] font-mono text-slate-400 uppercase">Window_Size: {filteredFrames.length} Frames</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse font-mono text-[11px]">
                          <thead className="bg-white text-slate-400 text-left border-b border-slate-100">
                            <tr>
                              <th className="px-8 py-5">SIGNAL_NAME</th>
                              <th className="px-6 py-5">MIN</th>
                              <th className="px-6 py-5">MAX</th>
                              <th className="px-6 py-5">AVG</th>
                              <th className="px-6 py-5">SAMPLES</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {signalStats.map(stat => (
                              <tr key={stat.name} className="hover:bg-slate-50 transition-colors h-14">
                                <td className="px-8 py-3 font-black text-slate-800 uppercase tracking-tighter">
                                  {stat.name.replace(/_/g, ' ')}
                                </td>
                                <td className="px-6 py-3 font-bold text-emerald-600">{stat.min.toFixed(2)} {stat.unit}</td>
                                <td className="px-6 py-3 font-bold text-red-600">{stat.max.toFixed(2)} {stat.unit}</td>
                                <td className="px-6 py-3 font-bold text-indigo-600 bg-indigo-50/30">{stat.avg.toFixed(2)} {stat.unit}</td>
                                <td className="px-6 py-3 text-slate-400">{stat.count.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col p-4 md:p-8 overflow-hidden">
                   <div className="bg-white border border-slate-200 rounded-[40px] flex-1 flex flex-col overflow-hidden shadow-2xl relative">
                      <div className="p-3 border-b flex items-center gap-2 shrink-0 bg-slate-900 text-white shadow-lg">
                         <div className="p-1.5 bg-indigo-600 rounded-lg shadow-lg"><BrainCircuit size={14} /></div>
                         <div>
                            <h4 className="text-xs font-orbitron font-black uppercase tracking-tight">OSM_CHAT_AGENT</h4>
                         </div>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col custom-scrollbar bg-slate-50">
                         {chatHistory.map((msg, i) => (
                           <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                              <div className={`max-w-[85%] p-5 rounded-[24px] text-[11px] leading-relaxed shadow-xl ${
                                msg.role === 'user' 
                                  ? 'bg-indigo-600 text-white border-indigo-700 rounded-tr-none' 
                                  : 'bg-white text-slate-800 border-slate-100 rounded-tl-none font-mono whitespace-pre-wrap'
                              }`}>
                                {msg.text}
                              </div>
                           </div>
                         ))}
                         {chatLoading && (
                           <div className="flex justify-start animate-pulse">
                              <div className="bg-white p-5 rounded-[24px] border border-slate-100 flex items-center gap-3 shadow-md">
                                 <Loader2 size={14} className="animate-spin text-indigo-600" />
                                 <span className="text-[9px] font-orbitron font-black text-slate-400 uppercase tracking-widest">Analyzing_Telemetry...</span>
                              </div>
                           </div>
                         )}
                         <div ref={chatEndRef} />
                      </div>

                      <div className="p-6 border-t bg-white shrink-0">
                         <form onSubmit={handleChat} className="flex gap-3 max-w-5xl mx-auto">
                            <input 
                              type="text" 
                              value={chatInput}
                              onChange={(e) => setChatInput(e.target.value)}
                              placeholder="Query the telemetry matrix..."
                              className="flex-1 bg-slate-50 border border-slate-200 rounded-[20px] px-6 py-4 text-[11px] font-bold tracking-widest focus:outline-none focus:border-indigo-500/50 shadow-inner"
                            />
                            <button 
                              type="submit"
                              disabled={chatLoading || !chatInput.trim()}
                              className="px-6 bg-indigo-600 text-white rounded-[20px] hover:bg-indigo-700 disabled:opacity-50 shadow-xl active:scale-95 transition-all flex items-center justify-center"
                            >
                              <Send size={20} />
                            </button>
                         </form>
                      </div>
                   </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default DataDecoder;

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Upload, FileText, Activity, BarChart3, Trash2, ArrowLeft, Database, Search, ChevronRight, Save, MessageSquare, BrainCircuit, Send, Loader2, TrendingUp, Info, Zap, PieChart, ShieldAlert, AlertTriangle, Clock, Battery, Filter, XCircle, History, Gauge, Menu, X } from 'lucide-react';
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
  const [tab, setTab] = useState<'visualizer' | 'diagnostics' | 'data' | 'chat' | null>(null);
  const [selectedSignals, setSelectedSignals] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showRangeModal, setShowRangeModal] = useState(false);

  // Filter State
  const [filterStartSoc, setFilterStartSoc] = useState<string>('');
  const [filterEndSoc, setFilterEndSoc] = useState<string>('');
  const [activeRange, setActiveRange] = useState<{ start: number; end: number } | null>(null);
  
  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setTab(null); // Do not open any dashboard until selection
      setIsMenuOpen(false);
      setChatHistory([{ 
        role: 'ai', 
        text: `LOG_READY: Ingested ${parsed.length.toLocaleString()} packets. Please open the menu to select an analysis module.` 
      }]);
    };
    reader.readAsText(file);
  };

  const applySocFilter = () => {
    const startSoc = parseFloat(filterStartSoc);
    const endSoc = parseFloat(filterEndSoc);
    if (isNaN(startSoc) || isNaN(endSoc) || socTimeline.length === 0) return;

    const sortedTimeline = [...socTimeline].sort((a, b) => a.timestamp - b.timestamp);
    const findTimeForSoc = (targetSoc: number) => {
      let closest = sortedTimeline[0];
      let minDiff = Math.abs(sortedTimeline[0].soc - targetSoc);
      for (const point of sortedTimeline) {
        const diff = Math.abs(point.soc - targetSoc);
        if (diff < minDiff) { minDiff = diff; closest = point; }
      }
      return closest.timestamp;
    };

    const tStart = findTimeForSoc(startSoc);
    const tEnd = findTimeForSoc(endSoc);
    setActiveRange({ start: Math.min(tStart, tEnd), end: Math.max(tStart, tEnd) });
    setShowRangeModal(false);
  };

  const clearFilter = () => {
    setFilterStartSoc('');
    setFilterEndSoc('');
    setActiveRange(null);
  };

  const filteredFrames = useMemo(() => {
    if (!activeRange) return offlineFrames;
    return offlineFrames.filter(f => f.timestamp >= activeRange.start && f.timestamp <= activeRange.end);
  }, [offlineFrames, activeRange]);

  const dbcLookup = useMemo(() => {
    const map = new Map<string, DBCMessage>();
    if (!library?.database) return map;
    (Object.entries(library.database) as [string, DBCMessage][]).forEach(([key, message]) => {
      map.set(normalizeId(key, false), message);
    });
    return map;
  }, [library]);

  const latestFramesMap = useMemo(() => {
    const map: Record<string, CANFrame> = {};
    filteredFrames.forEach(f => { map[normalizeId(f.id, true)] = f; });
    return map;
  }, [filteredFrames]);

  const detectedFaults = useMemo(() => {
    const faults: any[] = [];
    if (filteredFrames.length === 0) return [];
    filteredFrames.forEach(f => {
      const normId = normalizeId(f.id, true);
      if (ERROR_IDS.includes(normId)) {
        const message = dbcLookup.get(normId);
        if (message) {
          (Object.values(message.signals) as DBCSignal[]).forEach(sig => {
            if (decodeSignal(f.data, sig).trim() === '1') {
              faults.push({ timestamp: f.timestamp, message: sig.name.replace(/_/g, ' '), type: normId === '1038FF50' ? 'BATT' : 'MCU' });
            }
          });
        }
      }
    });
    return faults.sort((a, b) => b.timestamp - a.timestamp);
  }, [filteredFrames, dbcLookup]);

  const signalStats = useMemo(() => {
    if (filteredFrames.length === 0) return [];
    const statsMap: Record<string, any> = {};
    const step = Math.max(1, Math.floor(filteredFrames.length / 10000));
    for (let i = 0; i < filteredFrames.length; i += step) {
      const frame = filteredFrames[i];
      const normId = normalizeId(frame.id, true);
      const message = dbcLookup.get(normId);
      if (message) {
        Object.values(message.signals).forEach((sig: DBCSignal) => {
          const val = parseFloat(decodeSignal(frame.data, sig));
          if (!isNaN(val)) {
            if (!statsMap[sig.name]) statsMap[sig.name] = { name: sig.name, min: val, max: val, sum: 0, count: 0, unit: sig.unit || '' };
            const s = statsMap[sig.name];
            s.min = Math.min(s.min, val); s.max = Math.max(s.max, val); s.sum += val; s.count++;
          }
        });
      }
    }
    return Object.values(statsMap).map((s: any) => ({ ...s, avg: s.sum / s.count })).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredFrames, dbcLookup]);

  const handleSaveDecodedData = async () => {
    if (filteredFrames.length === 0) return;
    setIsExporting(true);
    setTimeout(async () => {
      try {
        const activeSignalMeta: any[] = [];
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
        if (activeSignalMeta.length === 0) { setIsExporting(false); return; }
        const header = ["Timestamp_ms", ...activeSignalMeta.map(s => `${s.name}_${s.sig.unit || 'raw'}`)].join(",");
        const csvRows: string[] = [header];
        const lastValues: Record<string, string> = {};
        activeSignalMeta.forEach(s => lastValues[s.name] = "0");
        filteredFrames.forEach((frame) => {
          const frameNormId = normalizeId(frame.id.replace('0x', ''), true);
          const signalsInThisMsg = msgIdToSignalNames[frameNormId];
          if (signalsInThisMsg) {
            const dbKey = Object.keys(library.database).find(k => normalizeId(k) === frameNormId);
            const dbEntry = dbKey ? library.database[dbKey] : null;
            if (dbEntry) {
              signalsInThisMsg.forEach(sName => {
                const sig = dbEntry.signals[sName];
                lastValues[sName] = decodeSignal(frame.data, sig).split(' ')[0];
              });
              csvRows.push([frame.timestamp.toFixed(3), ...activeSignalMeta.map(s => lastValues[s.name])].join(","));
            }
          }
        });
        const blob = new Blob([csvRows.join("\n")], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = `OSM_EXPORT_${Date.now()}.csv`;
        link.click();
      } catch (e) { console.error(e); } finally { setIsExporting(false); }
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
      const prompt = `Senior OSM Engineer analysis of log window (${filterStartSoc}%-${filterEndSoc}% SOC). ${userText}. Packets: ${filteredFrames.length}. Faults: ${detectedFaults.length}`;
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
      setChatHistory(prev => [...prev, { role: 'ai', text: response.text || "Diagnostic failed." }]);
    } catch { setChatHistory(prev => [...prev, { role: 'ai', text: "NEURAL_LINK_ERROR" }]); } finally { setChatLoading(false); }
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory]);

  return (
    <div className="h-full w-full flex flex-col bg-white overflow-hidden relative">
      <header className="h-16 md:h-20 bg-white border-b flex items-center justify-between px-4 md:px-8 shrink-0 z-[110] shadow-sm">
        <button 
          onClick={() => setIsMenuOpen(true)}
          className="p-2 hover:bg-slate-100 rounded-xl transition-all active:scale-95 text-slate-600"
        >
          <Menu size={24} />
        </button>

        <div className="flex-1 flex flex-col items-center min-w-0">
          <h2 className="text-[10px] md:text-[12px] font-orbitron font-black text-slate-400 uppercase tracking-[0.3em] truncate">
            {fileName || 'LOG_ANALYSIS_TERMINAL'}
          </h2>
          {activeRange && (
            <span className="text-[8px] font-mono text-indigo-600 font-bold">RANGE_ACTIVE: {filterStartSoc}% - {filterEndSoc}% SOC</span>
          )}
        </div>

        <button 
          onClick={onExit}
          className="p-2 hover:bg-slate-100 rounded-xl transition-all active:scale-95 text-slate-600"
        >
          <X size={24} />
        </button>
      </header>

      {/* Hamburger Menu Sidebar */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[200] flex">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)}></div>
          <aside className="relative w-72 md:w-80 bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
            <div className="p-6 border-b flex items-center justify-between">
              <span className="text-[10px] font-orbitron font-black text-indigo-600 uppercase tracking-widest">Main_Menu</span>
              <button onClick={() => setIsMenuOpen(false)} className="p-1 text-slate-400"><X size={20} /></button>
            </div>
            
            <nav className="flex-1 overflow-y-auto p-4 space-y-2">
              <button 
                onClick={() => { setIsMenuOpen(false); fileInputRef.current?.click(); }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl text-[10px] font-orbitron font-black uppercase text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all text-left"
              >
                <Upload size={18} /> Upload Log
              </button>
              
              <button 
                onClick={handleSaveDecodedData}
                disabled={offlineFrames.length === 0 || isExporting}
                className="w-full flex items-center gap-4 p-4 rounded-2xl text-[10px] font-orbitron font-black uppercase text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all text-left disabled:opacity-30"
              >
                <Save size={18} /> {isExporting ? 'Exporting...' : 'Saved Decoded File'}
              </button>

              <button 
                onClick={() => { setIsMenuOpen(false); setShowRangeModal(true); }}
                disabled={offlineFrames.length === 0}
                className="w-full flex items-center gap-4 p-4 rounded-2xl text-[10px] font-orbitron font-black uppercase text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all text-left disabled:opacity-30"
              >
                <Filter size={18} /> Range
              </button>

              <div className="h-px bg-slate-100 my-4"></div>

              {[
                { id: 'visualizer', label: 'Visualizer', icon: Activity },
                { id: 'diagnostics', label: 'Diagnostics', icon: ShieldAlert },
                { id: 'data', label: 'Data', icon: BarChart3 },
                { id: 'chat', label: 'Chat', icon: BrainCircuit }
              ].map(item => (
                <button 
                  key={item.id}
                  onClick={() => { setTab(item.id as any); setIsMenuOpen(false); }}
                  disabled={offlineFrames.length === 0}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl text-[10px] font-orbitron font-black uppercase transition-all text-left disabled:opacity-30 ${tab === item.id ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <item.icon size={18} /> {item.label}
                </button>
              ))}
            </nav>
            <div className="p-6 bg-slate-50 border-t">
              <div className="flex items-center gap-2 text-[8px] font-orbitron font-black text-slate-400 uppercase tracking-widest">
                <Database size={12} /> System_Registry_v8.4
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Range Input Modal */}
      {showRangeModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-[32px] w-full max-w-sm p-8 shadow-2xl animate-in zoom-in duration-200">
            <h3 className="text-xl font-orbitron font-black text-slate-900 uppercase mb-6 flex items-center gap-3">
              <Filter className="text-indigo-600" /> Set_Range
            </h3>
            <div className="space-y-4">
               <div>
                 <label className="text-[9px] font-orbitron font-black text-slate-400 uppercase ml-1">Start SOC %</label>
                 <input 
                   type="number" value={filterStartSoc} onChange={e => setFilterStartSoc(e.target.value)}
                   className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-lg outline-none focus:ring-2 ring-indigo-500/20"
                   placeholder="e.g. 100"
                 />
               </div>
               <div>
                 <label className="text-[9px] font-orbitron font-black text-slate-400 uppercase ml-1">End SOC %</label>
                 <input 
                   type="number" value={filterEndSoc} onChange={e => setFilterEndSoc(e.target.value)}
                   className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-lg outline-none focus:ring-2 ring-indigo-500/20"
                   placeholder="e.g. 20"
                 />
               </div>
               <div className="flex gap-3 pt-4">
                 <button onClick={() => { clearFilter(); setShowRangeModal(false); }} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-xl font-orbitron font-black uppercase text-[10px]">Clear</button>
                 <button onClick={applySocFilter} className="flex-2 py-4 bg-indigo-600 text-white rounded-xl font-orbitron font-black uppercase text-[10px] px-8">Execute</button>
               </div>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-hidden flex flex-col min-h-0 bg-white">
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
        
        {offlineFrames.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white">
            <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-[32px] flex items-center justify-center mb-8">
              <Upload size={48} />
            </div>
            <h3 className="text-2xl font-orbitron font-black text-slate-900 uppercase tracking-widest mb-4">Awaiting_Import</h3>
            <button onClick={() => fileInputRef.current?.click()} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-orbitron font-black uppercase shadow-xl active:scale-95 transition-all">
              Upload TRC File
            </button>
          </div>
        ) : !tab ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50">
            <div className="max-w-md w-full p-12 bg-white rounded-[40px] shadow-2xl flex flex-col items-center gap-8 border border-slate-100">
              <div className="p-6 bg-indigo-50 text-indigo-600 rounded-full animate-pulse">
                <Database size={48} />
              </div>
              <div>
                <h3 className="text-xl font-orbitron font-black text-slate-900 uppercase mb-2">Log_Ingested</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                  Mission data mapped. Use the hamburger menu to select an analysis dashboard.
                </p>
              </div>
              <button 
                onClick={() => setIsMenuOpen(true)}
                className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-orbitron font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all"
              >
                <Menu size={20} /> Open Dashboard Menu
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden relative min-h-0">
            {tab === 'visualizer' && (
              <LiveVisualizerDashboard frames={filteredFrames} library={library} latestFrames={latestFramesMap} setSelectedSignalNames={setSelectedSignals} selectedSignalNames={selectedSignals} isOffline={true} />
            )}
            {tab === 'diagnostics' && (
              <div className="h-full overflow-y-auto p-6 md:p-12 bg-slate-50">
                <div className="max-w-4xl mx-auto space-y-6">
                  <h3 className="text-2xl font-orbitron font-black text-slate-900 uppercase">Fault_Engine ({detectedFaults.length})</h3>
                  {detectedFaults.map((f, i) => (
                    <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 flex items-center gap-6">
                       <div className="p-4 bg-red-50 text-red-600 rounded-2xl"><ShieldAlert size={24} /></div>
                       <div>
                          <p className="text-lg font-black text-slate-900 uppercase">{f.message}</p>
                          <p className="text-[10px] font-mono text-slate-400 uppercase">Timestamp: {f.timestamp.toFixed(2)}ms | Type: {f.type}</p>
                       </div>
                    </div>
                  ))}
                  {detectedFaults.length === 0 && (
                    <div className="py-20 text-center opacity-30">
                      <Zap size={64} className="mx-auto mb-4 text-emerald-500" />
                      <p className="font-orbitron font-black uppercase">No Critical Faults Detected</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {tab === 'data' && (
              <div className="h-full overflow-y-auto p-6 md:p-12 bg-slate-50">
                <div className="max-w-6xl mx-auto space-y-12">
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white p-6 rounded-3xl shadow-sm border">
                        <p className="text-[8px] font-black text-slate-400 uppercase">Packets</p>
                        <p className="text-xl font-orbitron font-black">{filteredFrames.length}</p>
                      </div>
                      <div className="bg-white p-6 rounded-3xl shadow-sm border">
                        <p className="text-[8px] font-black text-slate-400 uppercase">Faults</p>
                        <p className="text-xl font-orbitron font-black text-red-600">{detectedFaults.length}</p>
                      </div>
                   </div>
                   <div className="bg-white rounded-[32px] shadow-xl overflow-hidden border">
                      <table className="w-full text-left font-mono">
                        <thead className="bg-slate-900 text-white text-[10px]">
                          <tr>
                            <th className="px-8 py-6 uppercase font-orbitron">Signal</th>
                            <th className="px-8 py-6 uppercase font-orbitron">Min</th>
                            <th className="px-8 py-6 uppercase font-orbitron">Max</th>
                            <th className="px-8 py-6 uppercase font-orbitron">Avg</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[11px]">
                          {signalStats.map(s => (
                            <tr key={s.name} className="hover:bg-slate-50 transition-colors">
                              <td className="px-8 py-5 font-black uppercase">{s.name.replace(/_/g, ' ')}</td>
                              <td className="px-8 py-5 text-emerald-600">{s.min.toFixed(2)}</td>
                              <td className="px-8 py-5 text-red-600">{s.max.toFixed(2)}</td>
                              <td className="px-8 py-5 text-indigo-600 font-bold">{s.avg.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                   </div>
                </div>
              </div>
            )}
            {tab === 'chat' && (
              <div className="h-full flex flex-col p-4 md:p-12 bg-slate-50">
                 <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col bg-white rounded-[40px] shadow-2xl overflow-hidden border">
                    <div className="flex-1 overflow-y-auto p-8 space-y-6 flex flex-col custom-scrollbar">
                       {chatHistory.map((msg, i) => (
                         <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-6 rounded-[32px] text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-50 text-slate-800 font-mono whitespace-pre-wrap rounded-tl-none border'}`}>
                              {msg.text}
                            </div>
                         </div>
                       ))}
                       <div ref={chatEndRef} />
                    </div>
                    <form onSubmit={handleChat} className="p-6 border-t flex gap-4 bg-white">
                      <input 
                        type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
                        placeholder="Inquire about log behavior..."
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:ring-4 ring-indigo-500/10"
                      />
                      <button type="submit" className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg active:scale-95"><Send size={24} /></button>
                    </form>
                 </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default DataDecoder;

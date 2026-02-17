
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Database, Plus, Trash2, RefreshCw, Box, Settings2, ArrowUpToLine, ArrowDownToLine, Zap, Activity, Info, Lock, Unlock, Hash, ShieldAlert, AlertTriangle, ShieldCheck, Save, Loader2 } from 'lucide-react';
import { ConversionLibrary, DBCMessage, DBCSignal, CANFrame } from '../types.ts';
import { MY_CUSTOM_DBC } from '../data/dbcProfiles.ts';
import { decToHex, normalizeId, decodeSignal, cleanMessageName } from '../utils/decoder.ts';

interface LibraryPanelProps {
  library: ConversionLibrary;
  onUpdateLibrary: (lib: ConversionLibrary) => void;
  latestFrames: Record<string, CANFrame>;
  onSaveDecoded?: () => void;
  isSavingDecoded?: boolean;
}

const FAULT_IDS = ["2419654480", "2553303104"];

const LibraryPanel: React.FC<LibraryPanelProps> = ({ library, onUpdateLibrary, latestFrames, onSaveDecoded, isSavingDecoded = false }) => {
  const [syncing, setSyncing] = useState(false);
  const [isLocked, setIsLocked] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const activeDBCMessages = useMemo(() => {
    const active: Array<{ id: string, message: DBCMessage, isFaultMessage: boolean }> = [];
    const searchLower = searchTerm.toLowerCase();
    
    (Object.entries(library.database) as [string, DBCMessage][]).forEach(([decId, message]) => {
      const normDbcId = normalizeId(decId);
      const latestFrame = latestFrames[normDbcId];
      if (!latestFrame) return;

      const isFaultMessage = FAULT_IDS.includes(decId);
      if (isFaultMessage) {
        const hasActiveError = (Object.values(message.signals) as DBCSignal[]).some(sig => {
          const val = decodeSignal(latestFrame.data, sig);
          return val.trim().startsWith('1');
        });
        if (!hasActiveError) return; 
      }

      const cleanName = cleanMessageName(message.name);
      const nameMatches = cleanName.toLowerCase().includes(searchLower);
      const hasMatchingSignal = (Object.values(message.signals) as DBCSignal[]).some(sig => 
        sig.name.toLowerCase().includes(searchLower)
      );
      
      if (searchTerm === '' || nameMatches || hasMatchingSignal) {
        active.push({ id: decId, message, isFaultMessage });
      }
    });
    return active.sort((a, b) => cleanMessageName(a.message.name).localeCompare(cleanMessageName(b.message.name)));
  }, [library.database, latestFrames, searchTerm]);

  useEffect(() => {
    if (isLocked && listRef.current) {
      setTimeout(() => {
        if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
      }, 50);
    }
  }, [activeDBCMessages.length, isLocked]);

  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => {
      onUpdateLibrary({ 
        ...library, 
        database: { ...library.database, ...MY_CUSTOM_DBC }, 
        lastUpdated: Date.now() 
      });
      setSyncing(false);
    }, 600);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl overflow-hidden border border-slate-200 shadow-xl relative">
      <div className="bg-slate-50/80 backdrop-blur-md px-6 py-4 flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 shrink-0 z-40 gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-indigo-600 text-white rounded shadow-md text-[9px] font-orbitron font-black">
            <Database size={12} /> TELEMETRY_MATRIX
          </div>
          
          <div className="hidden md:block h-6 w-[1px] bg-slate-200 mx-2"></div>
          
          <div className="relative flex-1 md:flex-none">
            <input 
              type="text" 
              placeholder="SEARCH_LOGIC..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[10px] font-mono text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-indigo-500/50 md:w-64 uppercase tracking-widest transition-all"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1 md:pb-0">
          <button 
            onClick={onSaveDecoded}
            disabled={isSavingDecoded}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[8px] font-orbitron font-black uppercase transition-all border shadow-sm shrink-0 ${
              isSavingDecoded 
                ? 'bg-indigo-600 text-white border-indigo-700 animate-pulse' 
                : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-500/50 hover:text-emerald-600'
            } disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            {isSavingDecoded ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
            {isSavingDecoded ? 'EXPORTING...' : 'SAVE_DECODED'}
          </button>

          <button
            onClick={() => setIsLocked(!isLocked)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[8px] font-orbitron font-black uppercase transition-all border shadow-sm shrink-0 ${
              isLocked ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-400'
            }`}
          >
            {isLocked ? <Lock size={10} /> : <Unlock size={10} />}
            {isLocked ? 'LOCKED' : 'FREE'}
          </button>
          
          <button 
            onClick={handleSync}
            className={`p-2 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 text-slate-500 transition-all shrink-0 ${syncing ? 'animate-spin' : ''}`}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div 
        ref={listRef}
        className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-white"
      >
        {activeDBCMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-24">
            <ShieldCheck className="w-16 h-16 text-emerald-100 mb-6" />
            <h4 className="text-[12px] font-orbitron font-black text-slate-300 uppercase tracking-[0.3em]">System_Nominal</h4>
            <p className="text-[9px] text-slate-400 font-bold uppercase mt-2 max-w-sm px-4">Awaiting bus activity or searching for active fault triggers</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
            {activeDBCMessages.map(({ id, message, isFaultMessage }) => {
              const normDbcId = normalizeId(id);
              const latestFrame = latestFrames[normDbcId];
              
              const signalsToRender = (Object.values(message.signals) as DBCSignal[]).filter(sig => {
                if (isFaultMessage) {
                  const val = latestFrame ? decodeSignal(latestFrame.data, sig) : "0";
                  return val.trim().startsWith('1');
                }
                return searchTerm === '' || sig.name.toLowerCase().includes(searchTerm.toLowerCase());
              });

              return (
                <div 
                  key={id} 
                  className={`group p-6 bg-white border rounded-3xl transition-all shadow-md flex flex-col animate-frame h-auto hover:shadow-xl ${
                    isFaultMessage 
                      ? 'border-red-500/30 bg-red-50/30 animate-pulse-slow' 
                      : 'border-slate-100 hover:border-indigo-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-2xl border transition-colors ${
                        isFaultMessage 
                          ? 'bg-red-500/10 border-red-500/20' 
                          : 'bg-indigo-50 border-indigo-100'
                      }`}>
                        {isFaultMessage ? (
                          <ShieldAlert className="w-5 h-5 text-red-500" />
                        ) : (
                          <Activity className="w-5 h-5 text-indigo-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className={`text-[12px] font-orbitron font-black uppercase tracking-wider block truncate pr-4 ${
                          isFaultMessage ? 'text-red-600' : 'text-slate-800'
                        }`}>
                          {cleanMessageName(message.name)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="text-[8px] bg-slate-100 border border-slate-200 px-2 py-1 rounded-md text-slate-500 font-black">DLC_{message.dlc}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {signalsToRender.map((sig: DBCSignal) => {
                      const liveValueStr = latestFrame ? decodeSignal(latestFrame.data, sig) : "---";
                      const isActiveError = isFaultMessage && liveValueStr.trim().startsWith('1');
                      
                      return (
                        <div key={sig.name} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                          isActiveError 
                            ? 'bg-red-100 border-red-200 shadow-sm' 
                            : 'bg-slate-50 border-slate-100 hover:bg-slate-100 hover:border-slate-200'
                        }`}>
                          <div className="flex flex-col gap-1 pr-4 min-w-0 flex-1">
                            <span className={`text-[9px] font-black uppercase tracking-tight leading-tight truncate ${
                              isActiveError ? 'text-red-700' : 'text-slate-500'
                            }`}>
                              {sig.name.replace(/_/g, ' ')}
                            </span>
                            <span className="text-[7px] text-slate-400 font-mono italic uppercase">
                              {sig.unit ? sig.unit : 'STATUS_BIT'}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`text-[14px] font-orbitron font-black leading-none ${
                              isActiveError ? 'text-red-600' : 'text-emerald-600'
                            }`}>
                              {liveValueStr}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-slate-50 px-6 py-2.5 border-t border-slate-200 flex justify-between items-center text-[8px] font-orbitron font-black text-slate-400 uppercase tracking-widest shrink-0">
        <div className="flex gap-6">
          <span>Active_Database: <span className="text-slate-600">{library.name}</span></span>
          <span className="flex items-center gap-1.5"><ShieldCheck size={10} className="text-emerald-500" /> HARDWARE_SYNC_LOCKED</span>
        </div>
        <div className="flex items-center gap-2">
           <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
           DATA_LINK: ACTIVE
        </div>
      </div>
    </div>
  );
};

export default LibraryPanel;

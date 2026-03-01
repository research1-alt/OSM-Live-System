import React, { useState, useEffect } from 'react';
import { Send, Plus, Trash2, Zap, Play, Square, Info, Save, List, ChevronRight } from 'lucide-react';
import { TransmitFrame } from '../types';

interface TransmitPanelProps {
  onSendMessage: (id: string, dlc: number, data: string[]) => void;
  onScheduleMessage: (frame: TransmitFrame) => void;
  onStopMessage: (id: string) => void;
  activeSchedules: Record<string, TransmitFrame>;
}

const TransmitPanel: React.FC<TransmitPanelProps> = ({ 
  onSendMessage, 
  onScheduleMessage, 
  onStopMessage,
  activeSchedules 
}) => {
  const [newId, setNewId] = useState('18FF0360');
  const [newDlc, setNewDlc] = useState(8);
  const [newData, setNewData] = useState('00 00 00 00 00 00 00 00');
  const [period, setPeriod] = useState(100);
  
  const [savedMessages, setSavedMessages] = useState<TransmitFrame[]>(() => {
    const saved = localStorage.getItem('osm_saved_tx_messages');
    try { return saved ? JSON.parse(saved) : []; } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('osm_saved_tx_messages', JSON.stringify(savedMessages));
  }, [savedMessages]);

  const handleSendOnce = (id: string, dlc: number, data: string[]) => {
    onSendMessage(id, dlc, data);
  };

  const handleToggleSchedule = (frame: TransmitFrame) => {
    if (activeSchedules[frame.id]) {
      onStopMessage(frame.id);
    } else {
      onScheduleMessage({ ...frame, isActive: true });
    }
  };

  const addToLibrary = () => {
    const dataArray = newData.split(' ').filter(x => x.length > 0);
    const newFrame: TransmitFrame = {
      id: newId,
      dlc: newDlc,
      data: dataArray,
      periodMs: period,
      isActive: false
    };
    
    // Check if ID already exists in library, if so update it, else add
    setSavedMessages(prev => {
      const exists = prev.findIndex(m => m.id === newId);
      if (exists >= 0) {
        const next = [...prev];
        next[exists] = newFrame;
        return next;
      }
      return [newFrame, ...prev];
    });
  };

  const removeFromLibrary = (id: string) => {
    setSavedMessages(prev => prev.filter(m => m.id !== id));
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 bg-white overflow-y-auto custom-scrollbar safe-pb">
      <div className="max-w-4xl mx-auto w-full space-y-8">
        <header className="flex flex-col gap-1">
          <h2 className="text-2xl font-orbitron font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
            <Zap className="text-indigo-600" /> Transmit_Control
          </h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">PCAN Master Command Center</p>
        </header>

        <div className="bg-slate-50 rounded-[32px] p-6 md:p-8 border border-slate-100 shadow-inner">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="space-y-2">
              <label className="text-[9px] font-orbitron font-black text-slate-400 uppercase tracking-widest ml-1">Message_ID (Hex)</label>
              <input 
                type="text" 
                value={newId} 
                onChange={(e) => setNewId(e.target.value.toUpperCase())}
                className="w-full bg-white border border-slate-200 rounded-2xl py-4 px-6 text-lg font-orbitron font-black text-indigo-600 focus:border-indigo-500/50 outline-none shadow-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-orbitron font-black text-slate-400 uppercase tracking-widest ml-1">DLC</label>
              <select 
                value={newDlc} 
                onChange={(e) => setNewDlc(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-2xl py-4 px-6 text-lg font-orbitron font-black text-slate-800 focus:border-indigo-500/50 outline-none shadow-sm appearance-none"
              >
                {[0,1,2,3,4,5,6,7,8].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-orbitron font-black text-slate-400 uppercase tracking-widest ml-1">Cycle_Time (ms)</label>
              <input 
                type="number" 
                value={period} 
                onChange={(e) => setPeriod(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-2xl py-4 px-6 text-lg font-orbitron font-black text-amber-600 focus:border-indigo-500/50 outline-none shadow-sm"
              />
            </div>
          </div>

          <div className="space-y-2 mb-8">
            <label className="text-[9px] font-orbitron font-black text-slate-400 uppercase tracking-widest ml-1">Data_Bytes (Hex Space Separated)</label>
            <input 
              type="text" 
              value={newData} 
              onChange={(e) => setNewData(e.target.value.toUpperCase())}
              placeholder="00 11 22 33 44 55 66 77"
              className="w-full bg-white border border-slate-200 rounded-2xl py-5 px-8 text-xl font-mono font-bold text-slate-800 tracking-widest focus:border-indigo-500/50 outline-none shadow-sm"
            />
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <button 
              onClick={() => handleSendOnce(newId, newDlc, newData.split(' ').filter(x => x.length > 0))}
              className="flex-1 py-5 bg-white border border-slate-200 hover:border-indigo-200 text-slate-800 rounded-[24px] font-orbitron font-black uppercase tracking-widest shadow-md transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              <Send size={18} /> Send_Single
            </button>
            <button 
              onClick={addToLibrary}
              className="flex-1 py-5 bg-slate-900 text-white rounded-[24px] font-orbitron font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              <Save size={18} /> Save_To_Library
            </button>
          </div>
        </div>

        {/* Saved Library Section */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-orbitron font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
            <List size={14} className="text-indigo-400" /> Message_Library
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {savedMessages.length === 0 ? (
              <div className="col-span-full py-12 border-2 border-dashed border-slate-100 rounded-[32px] flex flex-col items-center justify-center opacity-30">
                <List size={32} className="mb-2 text-slate-300" />
                <span className="text-[10px] font-orbitron font-black uppercase tracking-widest">Library is Empty</span>
              </div>
            ) : (
              savedMessages.map(frame => (
                <div key={frame.id} className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm hover:shadow-md transition-shadow group">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-orbitron font-black text-slate-900">0x{frame.id}</span>
                        <span className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-black">DLC_{frame.dlc}</span>
                      </div>
                      <span className="text-[9px] font-mono text-slate-400 mt-1">{frame.data.join(' ')}</span>
                    </div>
                    <button 
                      onClick={() => removeFromLibrary(frame.id)}
                      className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleSendOnce(frame.id, frame.dlc, frame.data)}
                      className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-[9px] font-orbitron font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Send size={12} /> Send
                    </button>
                    <button 
                      onClick={() => handleToggleSchedule(frame)}
                      className={`flex-1 py-3 rounded-xl text-[9px] font-orbitron font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 ${
                        activeSchedules[frame.id] 
                          ? 'bg-red-50 text-red-600 border border-red-100' 
                          : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                      }`}
                    >
                      {activeSchedules[frame.id] ? <Square size={12} /> : <Play size={12} />}
                      {activeSchedules[frame.id] ? 'Stop' : `Start (${frame.periodMs}ms)`}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4 pb-12">
          <h3 className="text-[10px] font-orbitron font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
            <Zap size={14} className="text-amber-400" /> Active_Schedules
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(Object.values(activeSchedules) as TransmitFrame[]).length === 0 ? (
              <div className="col-span-full py-12 border-2 border-dashed border-slate-100 rounded-[32px] flex flex-col items-center justify-center opacity-30">
                <Square size={32} className="mb-2 text-slate-300" />
                <span className="text-[10px] font-orbitron font-black uppercase tracking-widest">No Active Periodic Messages</span>
              </div>
            ) : (
              (Object.values(activeSchedules) as TransmitFrame[]).map(frame => (
                <div key={frame.id} className="bg-white border border-indigo-100 rounded-3xl p-6 shadow-md flex items-center justify-between animate-in slide-in-from-bottom-2">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-orbitron font-black text-indigo-600">0x{frame.id}</span>
                      <span className="text-[9px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-black">DLC_{frame.dlc}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 tracking-tighter">{frame.data.join(' ')}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                       <p className="text-[8px] font-orbitron font-black text-slate-300 uppercase">Rate</p>
                       <p className="text-xs font-orbitron font-black text-amber-500">{frame.periodMs}ms</p>
                    </div>
                    <button 
                      onClick={() => onStopMessage(frame.id)}
                      className="p-3 bg-red-50 text-red-500 hover:bg-red-100 rounded-2xl transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransmitPanel;

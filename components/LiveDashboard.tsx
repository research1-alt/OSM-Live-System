
import React, { useState, useRef, useEffect } from 'react';
import { Menu, X, Bluetooth, Zap, LayoutDashboard, Database, Send, ArrowLeft, ShieldCheck, Settings2, Smartphone, Cpu, PlayCircle } from 'lucide-react';
import { CANFrame, ConnectionStatus, ConversionLibrary, TransmitFrame } from '../types.ts';
import CANMonitor from './CANMonitor.tsx';
import LibraryPanel from './LibraryPanel.tsx';
import TransmitPanel from './TransmitPanel.tsx';

interface LiveDashboardProps {
  status: ConnectionStatus;
  frames: CANFrame[];
  library: ConversionLibrary;
  latestFrames: Record<string, CANFrame>;
  onDisconnect: () => void;
  isSimulated?: boolean;
  // Transmit handlers
  onSendMessage: (id: string, dlc: number, data: string[]) => void;
  onScheduleMessage: (frame: TransmitFrame) => void;
  onStopMessage: (id: string) => void;
  activeSchedules: Record<string, TransmitFrame>;
  // State for Trace
  isPaused: boolean;
  isSaving: boolean;
  autoSaveEnabled: boolean;
  onToggleAutoSave: () => void;
  onClearTrace: () => void;
  onSaveTrace: () => void;
  // State for Decoded Data
  onSaveDecoded: () => void;
  isSavingDecoded: boolean;
  msgPerSec: number;
  showBufferWarning: boolean;
  onCloseWarning: () => void;
  isLogging: boolean;
  loggingFileName: string | null;
  onStartLogging: () => void;
  onStopLogging: () => void;
  isLoggingDecoded: boolean;
}

const LiveDashboard: React.FC<LiveDashboardProps> = (props) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [tab, setTab] = useState<'trace' | 'data' | 'tx_tool'>('trace');

  const menuItems = [
    { id: 'trace', label: 'Live Trace', icon: LayoutDashboard },
    { id: 'data', label: 'Data', icon: Database },
    { id: 'tx_tool', label: 'TX Tool', icon: Send },
  ];

  return (
    <div className="h-full w-full flex flex-col bg-white overflow-hidden relative">
      {/* Header matching Data Decoder style */}
      <header className="safe-pt h-auto min-h-[64px] md:min-h-[80px] bg-white border-b flex items-center justify-between px-4 md:px-8 shrink-0 z-[110] shadow-sm">
        <button 
          onClick={() => {
            console.log("MENU_CLICKED");
            setIsMenuOpen(true);
          }}
          className="p-4 -ml-4 hover:bg-slate-100 rounded-xl transition-all active:scale-95 text-slate-600 relative z-[150]"
          aria-label="Open Menu"
        >
          <Menu size={28} />
        </button>

        <div className="flex-1 flex flex-col items-center min-w-0">
          {props.isLogging && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-50 border border-red-100 rounded-full mb-1 animate-pulse">
              <div className="w-1.5 h-1.5 bg-red-600 rounded-full"></div>
              <span className="text-[7px] font-orbitron font-black text-red-600 uppercase tracking-wider">REC</span>
            </div>
          )}
          <h2 className={`text-[10px] md:text-[12px] font-orbitron font-black uppercase tracking-[0.3em] truncate ${props.isSimulated ? 'text-amber-600' : 'text-indigo-600'}`}>
            {props.isSimulated ? 'HARDWARE_SIMULATION_ACTIVE' : 'HARDWARE_LIVE_SESSION'}
          </h2>
          <div className="flex items-center gap-2 mt-1">
             <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${props.isSimulated ? 'bg-amber-500' : 'bg-emerald-500'}`} />
             <span className="text-[8px] font-mono text-slate-400 font-bold uppercase tracking-widest">
               {props.isSimulated ? 'Simulating_Internal_Bus' : 'Linked_to_Bus'}
             </span>
          </div>
        </div>

        <button 
          onClick={props.onDisconnect}
          className="p-2 hover:bg-red-50 rounded-xl transition-all active:scale-95 text-red-400"
          title="Terminate Link"
        >
          <X size={24} />
        </button>
      </header>

      {/* Hamburger Sidebar */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[200] flex">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)}></div>
          <aside className="relative w-72 md:w-80 bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
            <div className="p-6 border-b flex items-center justify-between">
              <span className="text-[10px] font-orbitron font-black text-indigo-600 uppercase tracking-widest">Bridge_Menu</span>
              <button onClick={() => setIsMenuOpen(false)} className="p-1 text-slate-400"><X size={20} /></button>
            </div>
            
            <nav className="flex-1 overflow-y-auto p-4 space-y-2">
              {menuItems.map(item => (
                <button 
                  key={item.id}
                  onClick={() => { setTab(item.id as any); setIsMenuOpen(false); }}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl text-[10px] font-orbitron font-black uppercase transition-all text-left ${tab === item.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <item.icon size={18} /> {item.label}
                </button>
              ))}

              <div className="h-px bg-slate-100 my-4"></div>
              
              <button 
                onClick={() => { setIsMenuOpen(false); props.onDisconnect(); }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl text-[10px] font-orbitron font-black uppercase text-red-500 hover:bg-red-50 transition-all text-left"
              >
                <X size={18} /> {props.isSimulated ? 'Stop Simulation' : 'Terminate Link'}
              </button>
            </nav>
            <div className="p-6 bg-slate-50 border-t">
              <div className="flex items-center gap-2 text-[8px] font-orbitron font-black text-slate-400 uppercase tracking-widest">
                <ShieldCheck size={12} /> {props.isSimulated ? 'simulator_v4.2_active' : 'hardware_link_v12.0_enc'}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden flex flex-col min-h-0 bg-white">
        {tab === 'trace' && (
          <div className="flex-1 p-4 md:p-6 overflow-hidden relative">
            <CANMonitor 
              frames={props.frames}
              isPaused={props.isPaused}
              library={props.library}
              onClearTrace={props.onClearTrace}
              onSaveTrace={props.onSaveTrace}
              isSaving={props.isSaving}
              autoSaveEnabled={props.autoSaveEnabled}
              onToggleAutoSave={props.onToggleAutoSave}
              msgPerSec={props.msgPerSec}
              isLogging={props.isLogging}
              loggingFileName={props.loggingFileName}
              onStartLogging={props.onStartLogging}
              onStopLogging={props.onStopLogging}
              isLoggingDecoded={props.isLoggingDecoded}
            />

            {/* Buffer Warning Pop-up */}
            {props.showBufferWarning && (
              <div className="absolute inset-0 z-[150] flex items-center justify-center p-6">
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={props.onCloseWarning}></div>
                <div className="relative w-full max-w-sm bg-white rounded-[40px] p-8 shadow-2xl border border-amber-100 animate-in zoom-in duration-300">
                  <div className="w-16 h-16 bg-amber-100 rounded-3xl flex items-center justify-center text-amber-600 mb-6 mx-auto">
                    <Database size={32} className="animate-bounce" />
                  </div>
                  <h3 className="text-xl font-orbitron font-black text-slate-900 text-center uppercase tracking-tight mb-2">Buffer Critical</h3>
                  <p className="text-slate-500 text-center text-sm mb-8 leading-relaxed">
                    Trace buffer has reached <span className="text-amber-600 font-bold">950,000</span> frames. Please use <span className="text-indigo-600 font-bold">START LOGGING</span> to record data directly to your disk and clear memory.
                  </p>
                  <div className="space-y-3">
                    <button 
                      onClick={props.onCloseWarning}
                      className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-orbitron font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                    >
                      I Understand
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'data' && (
          <LibraryPanel 
            library={props.library}
            onUpdateLibrary={() => {}} // Read-only in live dashboard
            latestFrames={props.latestFrames}
            onSaveDecoded={props.onSaveDecoded}
            isSavingDecoded={props.isSavingDecoded}
          />
        )}

        {tab === 'tx_tool' && (
          <TransmitPanel 
            onSendMessage={props.onSendMessage}
            onScheduleMessage={props.onScheduleMessage}
            onStopMessage={props.onStopMessage}
            activeSchedules={props.activeSchedules}
          />
        )}
      </main>
      
      <div className="h-6 bg-slate-100 border-t flex items-center justify-between px-6 text-[8px] font-orbitron font-black text-slate-400 uppercase tracking-widest shrink-0">
         <div className="flex gap-6"><span>{props.frames.length.toLocaleString()} Pkts_{props.isSimulated ? 'Sim' : 'Live'}</span><span>{props.isSimulated ? 'INTERNAL_EMULATOR' : 'BRIDGE_ACTIVE_LINK'}</span></div>
         <div className="flex items-center gap-2">HARDWARE_TELEMETRY_ENGINE</div>
      </div>
    </div>
  );
};

export default LiveDashboard;

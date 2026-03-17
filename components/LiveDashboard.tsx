
import React, { useState, useRef, useEffect } from 'react';
import { Menu, X, LayoutDashboard, Database, Send, ShieldCheck, Sparkles, Save } from 'lucide-react';
import { CANFrame, ConnectionStatus, ConversionLibrary, TransmitFrame } from '../types.ts';
import CANMonitor from './CANMonitor.tsx';
import LibraryPanel from './LibraryPanel.tsx';
import TransmitPanel from './TransmitPanel.tsx';
import AIChatPanel from './AIChatPanel.tsx';

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
  busLoad?: number;
  busSpeed?: number;
  onBusSpeedChange?: (speed: number) => void;
  showBufferWarning: boolean;
  onCloseWarning: () => void;
  onExportWideCsv?: () => void;
  syncStatus?: 'idle' | 'syncing' | 'success' | 'error';
  onManualSync?: () => void;
  isHwClockSynced?: boolean;
}

const LiveDashboard: React.FC<LiveDashboardProps> = (props) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [tab, setTab] = useState<'trace' | 'data' | 'tx_tool' | 'ai_chat'>('trace');
  const [selectedSignalNames, setSelectedSignalNames] = useState<string[]>([]);

  const menuItems = [
    { id: 'trace', label: 'Live Trace', icon: LayoutDashboard },
    { id: 'data', label: 'Data Matrix', icon: Database },
    { id: 'tx_tool', label: 'TX Tool', icon: Send },
    { id: 'ai_chat', label: 'AI Intelligence', icon: Sparkles },
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
          <h2 className={`text-[10px] md:text-[12px] font-orbitron font-black uppercase tracking-[0.3em] truncate ${props.isSimulated ? 'text-amber-600' : 'text-indigo-600'}`}>
            {props.isSimulated ? 'HARDWARE_SIMULATION_ACTIVE' : 'HARDWARE_LIVE_SESSION'}
          </h2>
          <div className="flex items-center gap-2 mt-1">
             <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${props.isSimulated ? 'bg-amber-500' : 'bg-emerald-500'}`} />
             <span className="text-[8px] font-mono text-slate-400 font-bold uppercase tracking-widest">
               {props.isSimulated ? 'Simulating_Internal_Bus' : 'Linked_to_Bus'}
             </span>
             {props.isHwClockSynced && (
               <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-100">
                 <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                 <span className="text-[8px] font-mono text-blue-500 font-bold uppercase tracking-widest">
                   HW_Clock_Synced
                 </span>
                 <span className="ml-2 text-[8px] font-mono text-slate-400 font-bold uppercase tracking-widest">
                   Lag: {props.frames.length > 0 ? (props.frames[props.frames.length - 1].transportLatency || 0).toFixed(0) : 0}ms
                 </span>
               </div>
             )}
          </div>
        </div>

        <div className="w-12 md:w-16" /> {/* Spacer to keep title centered */}
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
          <div className="flex-1 p-4 md:p-6 overflow-hidden relative flex flex-col gap-4">
            {/* Bus Load Indicator */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-[8px] font-orbitron font-black text-slate-400 uppercase tracking-widest">Bus_Load</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          (props.busLoad || 0) > 80 ? 'bg-red-500' : (props.busLoad || 0) > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${props.busLoad || 0}%` }}
                      />
                    </div>
                    <span className={`text-xs font-orbitron font-black ${(props.busLoad || 0) > 80 ? 'text-red-600' : 'text-slate-700'}`}>
                      {(props.busLoad || 0).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="h-8 w-px bg-slate-200 mx-2" />
                <div className="flex flex-col">
                  <span className="text-[8px] font-orbitron font-black text-slate-400 uppercase tracking-widest">Bus_Speed</span>
                  <select 
                    value={props.busSpeed}
                    onChange={(e) => props.onBusSpeedChange?.(Number(e.target.value))}
                    className="bg-transparent text-xs font-orbitron font-black text-indigo-600 outline-none cursor-pointer"
                  >
                    <option value={125000}>125 kbps</option>
                    <option value={250000}>250 kbps</option>
                    <option value={500000}>500 kbps</option>
                    <option value={1000000}>1 Mbps</option>
                  </select>
                </div>
              </div>
              
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-slate-200 shadow-sm">
                <Sparkles size={12} className="text-indigo-500" />
                <span className="text-[9px] font-orbitron font-black text-slate-600 uppercase tracking-widest">
                  {props.msgPerSec?.toLocaleString() || 0} MSG/S
                </span>
              </div>
            </div>

            <div className="flex-1 min-h-0">
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
                onExportWideCsv={props.onExportWideCsv}
              />
            </div>

            {/* Buffer Warning Banner - Non-blocking */}
            {props.showBufferWarning && (
              <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl flex items-center justify-between shadow-sm animate-in slide-in-from-top duration-300">
                <div className="flex items-center gap-3">
                  <div className="text-amber-600">
                    <Database size={20} className="animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-[10px] font-orbitron font-black text-amber-900 uppercase tracking-tight">Buffer Critical</h3>
                    <p className="text-[9px] text-amber-700 font-medium">
                      Trace buffer has reached 90% capacity. Save your log now to avoid data loss.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={props.onSaveTrace}
                    className="px-4 py-1.5 bg-amber-600 text-white rounded-lg text-[9px] font-orbitron font-black uppercase tracking-widest shadow-sm active:scale-95 transition-all hover:bg-amber-700 flex items-center gap-1.5"
                  >
                    <Save size={12} />
                    Save Now
                  </button>
                  <button 
                    onClick={props.onCloseWarning}
                    className="p-1.5 text-amber-400 hover:text-amber-600 transition-colors"
                  >
                    <X size={16} />
                  </button>
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

        {tab === 'ai_chat' && (
          <AIChatPanel 
            latestFrames={props.latestFrames}
          />
        )}
      </main>
      
      <div className="h-6 bg-slate-100 border-t flex items-center justify-between px-6 text-[8px] font-orbitron font-black text-slate-400 uppercase tracking-widest shrink-0">
         <div className="flex gap-6"><span>{props.frames?.length?.toLocaleString() || 0} Pkts_{props.isSimulated ? 'Sim' : 'Live'}</span><span>{props.isSimulated ? 'INTERNAL_EMULATOR' : 'BRIDGE_ACTIVE_LINK'}</span></div>
         <div className="flex items-center gap-2">HARDWARE_TELEMETRY_ENGINE</div>
      </div>
    </div>
  );
};

export default LiveDashboard;

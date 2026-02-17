
import React, { useState, useEffect, useMemo } from 'react';
import { Zap, Cpu, Loader2, Bluetooth, Cable, Globe, AlertCircle, Settings, Info, ShieldCheck, Wifi, WifiOff, Search, Monitor, Smartphone, HelpCircle, RefreshCcw, Sliders } from 'lucide-react';
import { ConnectionStatus, HardwareStatus } from '../types.ts';

interface ConnectionPanelProps {
  status: ConnectionStatus;
  hwStatus?: HardwareStatus;
  hardwareMode: 'esp32-serial' | 'esp32-bt';
  onSetHardwareMode: (mode: 'esp32-serial' | 'esp32-bt') => void;
  onConnect: () => void;
  onDisconnect: () => void;
  debugLog?: string[];
}

const ConnectionPanel: React.FC<ConnectionPanelProps> = ({ 
  status, 
  hardwareMode,
  onSetHardwareMode,
  onConnect, 
  onDisconnect, 
  debugLog = []
}) => {
  const [isNative, setIsNative] = useState(false);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const isDesktop = useMemo(() => !isNative && /Windows|Macintosh|Linux/.test(navigator.userAgent), [isNative]);

  useEffect(() => {
    setIsNative(!!(window as any).NativeBleBridge);
  }, []);

  const hasGattError = useMemo(() => debugLog.some(log => log.includes('GATT') || log.includes('BLE_FAULT')), [debugLog]);

  const getStatusDetail = () => {
    if (status === 'connected') return {
      title: "LINK_ESTABLISHED",
      desc: `Tactical bridge active via ${hardwareMode === 'esp32-bt' ? 'Bluetooth' : 'Serial'}. Telemetry stream is live.`,
      icon: <Wifi className="text-emerald-500" size={24} />,
      color: "bg-emerald-50 border-emerald-100 text-emerald-700"
    };
    if (status === 'connecting') return {
      title: "HANDSHAKING...",
      desc: "Negotiating protocol with hardware. Check the popup/port selector.",
      icon: <Loader2 className="text-indigo-500 animate-spin" size={24} />,
      color: "bg-indigo-50 border-indigo-100 text-indigo-700"
    };
    if (hasGattError && isDesktop && hardwareMode === 'esp32-bt') return {
      title: "DESKTOP_GATT_LOCK",
      desc: "Device is locked by the OS. Unpair it from System Settings.",
      icon: <Monitor className="text-red-500" size={24} />,
      color: "bg-red-50 border-red-100 text-red-700"
    };
    if (status === 'error') return {
      title: "BRIDGE_ERROR",
      desc: "Protocol fault. Reset hardware power and try again.",
      icon: <AlertCircle className="text-red-500" size={24} />,
      color: "bg-red-50 border-red-100 text-red-700"
    };
    
    return {
      title: "READY_FOR_LINK",
      desc: "Link status is offline. Select mode to begin.",
      icon: <WifiOff className="text-slate-300" size={24} />,
      color: "bg-slate-50 border-slate-100 text-slate-500"
    };
  };

  const currentStatus = getStatusDetail();

  return (
    <div className="flex flex-col items-center justify-center w-full h-full max-w-5xl mx-auto py-6 md:py-10 px-4 overflow-y-auto">
      <div className="w-full max-w-xl">
        <div className="bg-white rounded-[40px] p-6 md:p-12 shadow-2xl border border-slate-200 flex flex-col justify-between min-h-[500px]">
          <div>
            <div className="flex items-center justify-between mb-8 md:mb-10">
              <div className="flex flex-col">
                <h3 className="text-xl md:text-2xl font-orbitron font-black text-slate-900 uppercase flex items-center gap-4">
                  <Cpu className="text-indigo-600" size={28} /> Link_Manager
                </h3>
                <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Hardware Interface</p>
              </div>
              <div className="flex items-center gap-2">
                 {isDesktop ? <Monitor size={14} className="text-slate-300" /> : <Smartphone size={14} className="text-slate-300" />}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-4 mb-6 md:mb-8">
              <button 
                onClick={() => onSetHardwareMode('esp32-serial')} 
                className={`flex flex-col items-center gap-3 p-4 md:p-5 rounded-[24px] border transition-all ${hardwareMode === 'esp32-serial' ? 'bg-indigo-600 border-indigo-700 text-white shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}
              >
                <Cable size={20}/><span className="text-[8px] font-orbitron font-black uppercase">Wired (USB)</span>
              </button>
              <button 
                onClick={() => onSetHardwareMode('esp32-bt')} 
                className={`flex flex-col items-center gap-3 p-4 md:p-5 rounded-[24px] border transition-all ${hardwareMode === 'esp32-bt' ? 'bg-indigo-600 border-indigo-700 text-white shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}
              >
                <Bluetooth size={20}/><span className="text-[8px] font-orbitron font-black uppercase">Bluetooth</span>
              </button>
            </div>

            <div className={`mb-6 p-5 md:p-6 rounded-[32px] border transition-all duration-500 shadow-inner ${currentStatus.color}`}>
               <div className="flex items-center gap-4 mb-3">
                  <div className="p-2 bg-white rounded-2xl shadow-sm">
                    {currentStatus.icon}
                  </div>
                  <div>
                    <h4 className="text-[11px] font-orbitron font-black uppercase tracking-widest">{currentStatus.title}</h4>
                  </div>
               </div>
               <p className="text-[10px] md:text-[11px] font-medium leading-relaxed">
                  {currentStatus.desc}
               </p>
            </div>

            {/* Device Not Visible Troubleshooting */}
            <div className="mb-6">
              <button 
                onClick={() => setShowTroubleshooting(!showTroubleshooting)}
                className="flex items-center gap-2 text-[9px] font-orbitron font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-700 transition-colors"
              >
                <HelpCircle size={14} /> {showTroubleshooting ? 'HIDE_GUIDE' : 'CONNECTION_ISSUES?'}
              </button>
              
              {showTroubleshooting && (
                <div className="mt-4 space-y-3 bg-slate-50 p-5 rounded-3xl border border-slate-100 animate-in slide-in-from-top-2">
                  <div className="flex gap-3">
                    <div className="text-[9px] font-orbitron font-black text-indigo-600 bg-white w-5 h-5 flex items-center justify-center rounded-lg shadow-sm shrink-0">1</div>
                    <p className="text-[10px] text-slate-600 font-medium leading-snug">
                      <b>Desktop/Laptop Users:</b> Use the <b>Wired (USB)</b> mode for 100% reliability. The default baud rate is locked to 115200.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <div className="text-[9px] font-orbitron font-black text-indigo-600 bg-white w-5 h-5 flex items-center justify-center rounded-lg shadow-sm shrink-0">2</div>
                    <p className="text-[10px] text-slate-600 font-medium leading-snug">
                      <b>Bluetooth Troubleshooting:</b> If device is invisible, go to System Settings and <b>Unpair/Forget</b> it. Then restart the ESP32.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <div className="text-[9px] font-orbitron font-black text-indigo-600 bg-white w-5 h-5 flex items-center justify-center rounded-lg shadow-sm shrink-0">3</div>
                    <p className="text-[10px] text-slate-600 font-medium leading-snug">
                      <b>Hard Reset:</b> Unplug and replug the hardware. Wait 5 seconds for the boot sequence to complete.
                    </p>
                  </div>
                  <button 
                    onClick={() => window.location.reload()}
                    className="w-full mt-2 flex items-center justify-center gap-2 py-2 bg-white border border-slate-200 rounded-xl text-[9px] font-orbitron font-black text-slate-400 uppercase hover:text-indigo-600 hover:border-indigo-200 transition-all"
                  >
                    <RefreshCcw size={12} /> Force HUD Refresh
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <button 
              onClick={() => status === 'connected' ? onDisconnect() : onConnect()} 
              disabled={status === 'connecting'} 
              className={`w-full py-6 md:py-8 rounded-[24px] text-[12px] md:text-[13px] font-orbitron font-black uppercase tracking-[0.4em] shadow-2xl transition-all flex items-center justify-center gap-4 ${
                status === 'connected' ? 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100' : 
                'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
               {status === 'connecting' ? <Loader2 className="animate-spin" size={24}/> : (
                 <>
                   {status === 'connected' ? 'TERMINATE_LINK' : 'ESTABLISH_LINK'}
                   <Zap size={20} />
                 </>
               )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectionPanel;

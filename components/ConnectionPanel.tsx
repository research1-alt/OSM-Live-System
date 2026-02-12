
import React, { useState, useEffect, useMemo } from 'react';
import { Zap, Cpu, Loader2, Bluetooth, Cable, Globe, AlertCircle, Settings, Info, ShieldCheck, Wifi, WifiOff, Search } from 'lucide-react';
import { ConnectionStatus, HardwareStatus } from '../types.ts';

interface ConnectionPanelProps {
  status: ConnectionStatus;
  hwStatus?: HardwareStatus;
  hardwareMode: 'pcan' | 'esp32-serial' | 'esp32-bt';
  onSetHardwareMode: (mode: 'pcan' | 'esp32-serial' | 'esp32-bt') => void;
  baudRate: number;
  setBaudRate: (rate: number) => void;
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

  useEffect(() => {
    setIsNative(!!(window as any).NativeBleBridge);
  }, []);

  const isStackFull = useMemo(() => debugLog.some(log => log.includes('Code 2')), [debugLog]);
  const isTimeout = useMemo(() => debugLog.some(log => log.includes('TIMEOUT')), [debugLog]);
  const isPermissionError = useMemo(() => debugLog.some(log => log.includes('denied') || log.includes('Permission')), [debugLog]);

  const getStatusDetail = () => {
    if (status === 'connected') return {
      title: "LINK_ESTABLISHED",
      desc: "Native Bridge active. Telemetry stream is live and secured.",
      icon: <Wifi className="text-emerald-500" size={24} />,
      color: "bg-emerald-50 border-emerald-100 text-emerald-700"
    };
    if (status === 'connecting') return {
      title: "HANDSHAKING...",
      desc: "Negotiating protocol with ESP32 gateway. Ensure hardware is within 2 meters.",
      icon: <Loader2 className="text-indigo-500 animate-spin" size={24} />,
      color: "bg-indigo-50 border-indigo-100 text-indigo-700"
    };
    if (isStackFull) return {
      title: "SYSTEM_STACK_FAULT",
      desc: "Android Bluetooth stack is saturated. Fix: Toggle Bluetooth OFF/ON in System Settings.",
      icon: <AlertCircle className="text-red-500" size={24} />,
      color: "bg-red-50 border-red-100 text-red-700"
    };
    if (isTimeout) return {
      title: "HARDWARE_NOT_FOUND",
      desc: "Search timeout reached. Ensure ESP32 is powered and flashing its status LED.",
      icon: <Search className="text-amber-500" size={24} />,
      color: "bg-amber-50 border-amber-100 text-amber-700"
    };
    if (isPermissionError) return {
      title: "ACCESS_DENIED",
      desc: "Hardware permissions were rejected. Check browser or OS privacy settings.",
      icon: <ShieldCheck className="text-red-500" size={24} />,
      color: "bg-red-50 border-red-100 text-red-700"
    };
    if (status === 'error') return {
      title: "BRIDGE_ERROR",
      desc: "An unexpected fault occurred in the hardware bridge. Check physical connections.",
      icon: <AlertCircle className="text-red-500" size={24} />,
      color: "bg-red-50 border-red-100 text-red-700"
    };
    
    return {
      title: "READY_FOR_LINK",
      desc: "Hardware is currently offline. Select a mode and establish link to begin capture.",
      icon: <WifiOff className="text-slate-300" size={24} />,
      color: "bg-slate-50 border-slate-100 text-slate-500"
    };
  };

  const currentStatus = getStatusDetail();

  const handleOpenSettings = () => {
    if ((window as any).NativeBleBridge?.openBluetoothSettings) {
        (window as any).NativeBleBridge.openBluetoothSettings();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full max-w-5xl mx-auto py-10 px-4 overflow-y-auto">
      <div className="w-full max-w-xl">
        <div className="bg-white rounded-[40px] p-8 lg:p-12 shadow-2xl border border-slate-200 flex flex-col justify-between min-h-[500px]">
          <div>
            <div className="flex items-center justify-between mb-10">
              <div className="flex flex-col">
                <h3 className="text-2xl font-orbitron font-black text-slate-900 uppercase flex items-center gap-4">
                  <Cpu className="text-indigo-600" size={32} /> Link_Manager
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Unified Hardware Bridge</p>
              </div>
              <div className={`px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest ${status === 'connected' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : status === 'error' || isStackFull ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                {status}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <button 
                onClick={() => onSetHardwareMode('pcan')} 
                className={`flex flex-col items-center gap-3 p-5 rounded-[24px] border transition-all ${hardwareMode === 'pcan' ? 'bg-indigo-600 border-indigo-700 text-white shadow-xl scale-105' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}
              >
                <Globe size={24}/><span className="text-[9px] font-orbitron font-black uppercase">PCAN</span>
              </button>
              <button 
                onClick={() => onSetHardwareMode('esp32-serial')} 
                className={`flex flex-col items-center gap-3 p-5 rounded-[24px] border transition-all ${hardwareMode === 'esp32-serial' ? 'bg-indigo-600 border-indigo-700 text-white shadow-xl scale-105' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}
              >
                <Cable size={24}/><span className="text-[9px] font-orbitron font-black uppercase">Wired</span>
              </button>
              <button 
                onClick={() => onSetHardwareMode('esp32-bt')} 
                className={`flex flex-col items-center gap-3 p-5 rounded-[24px] border transition-all ${hardwareMode === 'esp32-bt' ? 'bg-indigo-600 border-indigo-700 text-white shadow-xl scale-105' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}
              >
                <Bluetooth size={24}/><span className="text-[9px] font-orbitron font-black uppercase">BLE</span>
              </button>
            </div>

            {/* Link Intelligence Area - Replaces Bridge Console */}
            <div className={`mb-8 p-6 rounded-[32px] border transition-all duration-500 shadow-inner ${currentStatus.color}`}>
               <div className="flex items-center gap-4 mb-3">
                  <div className="p-2.5 bg-white rounded-2xl shadow-sm">
                    {currentStatus.icon}
                  </div>
                  <div>
                    <h4 className="text-[12px] font-orbitron font-black uppercase tracking-widest">{currentStatus.title}</h4>
                    <p className="text-[9px] font-bold opacity-60">Status ID: {status.toUpperCase()}</p>
                  </div>
               </div>
               <p className="text-[11px] font-medium leading-relaxed">
                  {currentStatus.desc}
               </p>
               
               {isStackFull && (
                 <button onClick={handleOpenSettings} className="w-full mt-4 py-3 bg-white text-red-600 rounded-xl text-[10px] font-orbitron font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all">
                   <Settings size={14} /> Open System Settings
                 </button>
               )}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <button 
              onClick={() => status === 'connected' ? onDisconnect() : onConnect()} 
              disabled={status === 'connecting'} 
              className={`w-full py-8 rounded-[24px] text-[13px] font-orbitron font-black uppercase tracking-[0.4em] shadow-2xl transition-all flex items-center justify-center gap-4 ${
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

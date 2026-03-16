
import React, { useState, useEffect, useMemo } from 'react';
import { Zap, Cpu, Loader2, Bluetooth, Cable, Globe, AlertCircle, Settings, Info, ShieldCheck, Wifi, WifiOff, Search, Monitor, Smartphone, HelpCircle, RefreshCcw, Sliders, PlayCircle, Database, CheckCircle2 } from 'lucide-react';
import { ConnectionStatus, HardwareStatus } from '../types.ts';

interface ConnectionPanelProps {
  status: ConnectionStatus;
  hwStatus?: HardwareStatus;
  hardwareMode: 'esp32-bt' | 'esp32-serial';
  onSetHardwareMode?: (mode: 'esp32-bt' | 'esp32-serial') => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onRequestHardwareId?: () => void;
  onStartSimulation?: () => void;
  isAdmin?: boolean;
  debugLog?: string[];
  hardwareId?: string | null;
  deviceHistory?: string[];
  syncStatus?: 'idle' | 'syncing' | 'success' | 'error';
  onManualSync?: () => void;
}

const ConnectionPanel: React.FC<ConnectionPanelProps> = ({ 
  status, 
  hardwareMode,
  onSetHardwareMode,
  onConnect, 
  onDisconnect,
  onRequestHardwareId,
  onStartSimulation,
  isAdmin = false,
  debugLog = [],
  hardwareId = null,
  deviceHistory = [],
  syncStatus = 'idle',
  onManualSync
}) => {
  const [isNative, setIsNative] = useState(false);
  const [btSupported, setBtSupported] = useState(true);
  const [serialSupported, setSerialSupported] = useState(true);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const isDesktop = useMemo(() => !isNative && /Windows|Macintosh|Linux/.test(navigator.userAgent), [isNative]);

  useEffect(() => {
    setIsNative(!!(window as any).NativeBleBridge);
    setBtSupported(!!(navigator as any).bluetooth || !!(window as any).NativeBleBridge);
    setSerialSupported(!!(navigator as any).serial || !!(window as any).NativeSerialBridge);
  }, []);

  const hasGattError = useMemo(() => debugLog.some(log => log.includes('GATT') || log.includes('BLE_FAULT')), [debugLog]);

  const getStatusDetail = () => {
    if (status === 'connected') return {
      title: "CONNECTED",
      desc: `Hardware bridge is active. Telemetry stream is live.`,
      icon: <Wifi className="text-emerald-500" size={24} />,
      color: "bg-emerald-50 border-emerald-100 text-emerald-400"
    };
    if (status === 'connecting') return {
      title: "SEARCHING HARDWARE",
      desc: "Scanning for OSM hardware and establishing link. Please wait.",
      icon: <Loader2 className="text-indigo-500 animate-spin" size={24} />,
      color: "bg-indigo-50 border-indigo-100 text-indigo-700 animate-pulse"
    };
    if (status === 'error') return {
      title: "CONNECTION ERROR",
      desc: "Hardware link failed. Please reset device and try again.",
      icon: <AlertCircle className="text-red-500" size={24} />,
      color: "bg-red-50 border-red-100 text-red-700"
    };
    
    return {
      title: "OFFLINE",
      desc: "Hardware bridge is currently offline. Tap below to begin search.",
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
                 {!btSupported && <Info size={12} className="text-red-400 animate-pulse" title="Bluetooth is not supported in this browser/system." />}
                 {isDesktop ? <Monitor size={14} className="text-slate-300" /> : <Smartphone size={14} className="text-slate-300" />}
              </div>
            </div>

            <div className="flex justify-center gap-4 mb-6 md:mb-8">
              <button 
                onClick={() => onSetHardwareMode?.('esp32-bt')}
                className={`flex flex-col items-center gap-3 p-4 md:p-5 rounded-[24px] border transition-all w-full max-w-[160px] ${!btSupported ? 'opacity-40 cursor-not-allowed grayscale' : hardwareMode === 'esp32-bt' ? 'bg-indigo-600 border-indigo-700 text-white shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}
              >
                <Bluetooth size={20}/><span className="text-[8px] font-orbitron font-black uppercase">{btSupported ? 'Bluetooth' : 'BT_NOT_SUPPORTED'}</span>
              </button>

              <button 
                onClick={() => onSetHardwareMode?.('esp32-serial')}
                className={`flex flex-col items-center gap-3 p-4 md:p-5 rounded-[24px] border transition-all w-full max-w-[160px] ${!serialSupported ? 'opacity-40 cursor-not-allowed grayscale' : hardwareMode === 'esp32-serial' ? 'bg-indigo-600 border-indigo-700 text-white shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}
              >
                <Cable size={20}/><span className="text-[8px] font-orbitron font-black uppercase">{serialSupported ? 'Serial Cable' : 'SERIAL_NOT_SUPPORTED'}</span>
              </button>
            </div>

            <div className={`mb-6 p-5 md:p-6 rounded-[32px] border transition-all duration-500 shadow-inner max-w-[90%] mx-auto ${currentStatus.color}`}>
               <div className="flex items-center gap-4 mb-3">
                  <div className="p-2 bg-white rounded-2xl shadow-sm">
                    {currentStatus.icon}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-[11px] font-orbitron font-black uppercase tracking-widest">{currentStatus.title}</h4>
                    {hardwareId && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <ShieldCheck size={10} className="text-emerald-500" />
                        <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-tighter">ID: {hardwareId}</span>
                        {isAdmin && (
                          <>
                            {syncStatus === 'syncing' && <Loader2 size={10} className="text-indigo-500 animate-spin ml-1" />}
                            {syncStatus === 'success' && <CheckCircle2 size={10} className="text-emerald-500 ml-1" />}
                            {syncStatus === 'error' && <AlertCircle size={10} className="text-red-500 ml-1" />}
                          </>
                        )}
                      </div>
                    )}
                  </div>
               </div>
               <p className="text-[10px] md:text-[11px] font-medium leading-relaxed">
                  {currentStatus.desc}
               </p>
               {status === 'connecting' && (
                 <div className="mt-4 flex items-center gap-2 text-[10px] font-orbitron font-black text-indigo-500 animate-pulse">
                   <Search size={14} className="animate-bounce" />
                   ACTIVE_SCAN_IN_PROGRESS...
                 </div>
               )}
               {status === 'connected' && (
                 <div className="mt-4 flex flex-wrap gap-2">
                   <button 
                     onClick={() => onRequestHardwareId?.()}
                     className="flex items-center gap-2 text-[9px] font-orbitron font-black text-indigo-600 bg-white/60 px-3 py-2 rounded-xl border border-indigo-100/50 uppercase tracking-widest hover:bg-white hover:shadow-sm transition-all active:scale-95"
                   >
                     <Search size={12} /> RE_SCAN_ID
                   </button>
                   
                   {isAdmin && hardwareId && (
                     <button 
                       onClick={onManualSync}
                       disabled={syncStatus === 'syncing'}
                       className="flex items-center gap-2 text-[9px] font-orbitron font-black text-emerald-600 bg-white/60 px-3 py-2 rounded-xl border border-emerald-100/50 uppercase tracking-widest hover:bg-white hover:shadow-sm transition-all active:scale-95 disabled:opacity-50"
                     >
                       <RefreshCcw size={12} className={syncStatus === 'syncing' ? 'animate-spin' : ''} /> 
                       {syncStatus === 'success' ? 'SYNC_VERIFIED' : syncStatus === 'error' ? 'RETRY_SYNC' : 'CLOUD_SYNC'}
                     </button>
                   )}
                 </div>
               )}
            </div>

            {isAdmin && (
               <div className="mb-6">
                 <button 
                   onClick={onStartSimulation}
                   className="w-full flex items-center justify-center gap-3 py-4 bg-amber-50 border border-amber-200 rounded-3xl text-[10px] font-orbitron font-black text-amber-600 uppercase tracking-widest hover:bg-amber-100 transition-all shadow-sm"
                 >
                   <PlayCircle size={18} /> Start_Admin_Simulation
                 </button>
               </div>
            )}

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
                      <b>Bluetooth Troubleshooting:</b> If device is invisible, go to System Settings and <b>Unpair/Forget</b> it. Then restart the ESP32.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <div className="text-[9px] font-orbitron font-black text-indigo-600 bg-white w-5 h-5 flex items-center justify-center rounded-lg shadow-sm shrink-0">2</div>
                    <p className="text-[10px] text-slate-600 font-medium leading-snug">
                      <b>Serial Troubleshooting:</b> Ensure you are using a <b>USB OTG adapter</b> on Android. Chrome for Android is required. Check if the cable is data-capable.
                    </p>
                  </div>
                  
                  {isNative && (
                    <button 
                      onClick={() => (window as any).NativeBleBridge?.openBluetoothSettings()}
                      className="w-full mt-2 flex items-center justify-center gap-2 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-[9px] font-orbitron font-black text-indigo-600 uppercase hover:bg-indigo-100 transition-all"
                    >
                      <Settings size={12} /> Open System BT Settings
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      onDisconnect();
                      setTimeout(() => window.location.reload(), 500);
                    }}
                    className="w-full mt-2 flex items-center justify-center gap-2 py-2 bg-red-50 border border-red-100 rounded-xl text-[9px] font-orbitron font-black text-red-600 uppercase hover:bg-red-100 transition-all"
                  >
                    <RefreshCcw size={12} /> Hard Reset Link Stack
                  </button>
                  <button 
                    onClick={() => onRequestHardwareId?.()}
                    className="w-full mt-2 flex items-center justify-center gap-2 py-2 bg-white border border-slate-200 rounded-xl text-[9px] font-orbitron font-black text-slate-400 uppercase hover:text-indigo-600 hover:border-indigo-200 transition-all"
                  >
                    <Search size={12} /> Re-Scan for Hardware ID
                  </button>
                </div>
              )}
            </div>

            {isAdmin && deviceHistory.length > 0 && (
              <div className="mb-8">
                <h4 className="text-[10px] font-orbitron font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Database size={12} /> Known_Devices_Registry
                </h4>
                <div className="flex flex-wrap gap-2">
                  {deviceHistory.map((id) => (
                    <div 
                      key={id} 
                      className={`px-3 py-1.5 rounded-full border text-[9px] font-mono font-bold flex items-center gap-2 ${hardwareId === id ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${hardwareId === id ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                      {id}
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                   {status === 'connected' ? 'TERMINATE_LINK' : 'START_HARDWARE_SEARCH'}
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

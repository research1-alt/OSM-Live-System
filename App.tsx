
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Play, Pause, Cpu, ArrowLeft, Activity, Bluetooth, Zap, BarChart3, Database, LogOut, ExternalLink, LayoutDashboard, ShieldCheck, Settings2, Smartphone, Tablet, Monitor, LineChart as ChartIcon, Info, HelpCircle } from 'lucide-react';
import CANMonitor from '@/components/CANMonitor';
import ConnectionPanel from '@/components/ConnectionPanel';
import LibraryPanel from '@/components/LibraryPanel';
import TraceAnalysisDashboard from '@/components/TraceAnalysisDashboard';
import LiveVisualizerDashboard from '@/components/LiveVisualizerDashboard';
import AuthScreen from '@/components/AuthScreen';
import { CANFrame, ConnectionStatus, HardwareStatus, ConversionLibrary, SignalAnalysis } from '@/types';
import { MY_CUSTOM_DBC, DEFAULT_LIBRARY_NAME } from '@/data/dbcProfiles';
import { normalizeId, formatIdForDisplay } from '@/utils/decoder';
import { User, authService } from '@/services/authService';
import { generateMockPacket } from '@/utils/canSim';
import { analyzeCANData } from '@/services/geminiService';

const MAX_FRAME_LIMIT = 50000; 
const BATCH_UPDATE_INTERVAL = 60; 
const STALE_SIGNAL_TIMEOUT = 5000; 
const CRITICAL_FAULT_IDS = ["2419654480", "2553303104", "2460002948"];

const UART_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const TX_CHAR_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

type PreviewMode = 'full' | 'mobile' | 'tablet';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('osm_currentUser');
    try { return savedUser ? JSON.parse(savedUser) : null; } catch { return null; }
  });
  
  const [sessionId, setSessionId] = useState<string | null>(() => localStorage.getItem('osm_sid'));
  const [view, setView] = useState<'home' | 'live'>('home');
  const [previewMode, setPreviewMode] = useState('full' as PreviewMode);
  const [dashboardTab, setDashboardTab] = useState<'link' | 'trace' | 'library' | 'analysis' | 'live-visualizer'>('link');
  const [hardwareMode, setHardwareMode] = useState<'pcan' | 'esp32-serial' | 'esp32-bt'>('pcan');
  const [frames, setFrames] = useState<CANFrame[]>([]);
  const [latestFrames, setLatestFrames] = useState<Record<string, CANFrame>>({});
  const [isPaused, setIsPaused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<ConnectionStatus>('disconnected');
  const [hwStatus, setHwStatus] = useState<HardwareStatus>('offline');
  const [baudRate, setBaudRate] = useState(115200);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  
  const [simulationEnabled, setSimulationEnabled] = useState(false);

  const [analysisSelectedSignals, setAnalysisSelectedSignals] = useState<string[]>([]);
  const [visualizerSelectedSignals, setVisualizerSelectedSignals] = useState<string[]>([]);
  const [watcherActive, setWatcherActive] = useState(false);
  const [lastAiAnalysis, setLastAiAnalysis] = useState<(SignalAnalysis & { isAutomatic?: boolean }) | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  
  const [library, setLibrary] = useState<ConversionLibrary>({
    id: 'default-pcan-lib',
    name: DEFAULT_LIBRARY_NAME,
    database: MY_CUSTOM_DBC,
    lastUpdated: Date.now(),
  });

  const frameMapRef = useRef<Map<string, CANFrame>>(new Map());
  const pendingFramesRef = useRef<CANFrame[]>([]);
  const bleBufferRef = useRef<string>("");
  const serialPortRef = useRef<any>(null);
  const serialReaderRef = useRef<any>(null);
  
  // FIX: Using 'any' instead of 'BluetoothDevice' to resolve 'Cannot find name BluetoothDevice' error.
  const webBleDeviceRef = useRef<any | null>(null);
  const keepReadingRef = useRef(false);
  const lastAnalyzedFaultTime = useRef<number>(0);

  const addDebugLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    setDebugLog(prev => [`[${time}] ${msg}`, ...prev].slice(0, 50));
  }, []);

  useEffect(() => {
    if (bridgeStatus === 'connected') {
      setWatcherActive(true);
      addDebugLog("AUTO_WATCHER: Hardware link established. Autonomous monitoring activated.");
    }
  }, [bridgeStatus, addDebugLog]);

  useEffect(() => {
    if (!watcherActive || aiLoading || frames.length === 0) return;

    const hasFault = Object.values(latestFrames).some(f => {
      const normId = f.id.replace('0x', '').toUpperCase();
      if (CRITICAL_FAULT_IDS.some(fid => fid.includes(normId))) {
        return f.data.some(d => parseInt(d, 16) > 0);
      }
      return false;
    });

    if (hasFault && Date.now() - lastAnalyzedFaultTime.current > 30000) { 
       triggerAiAnalysis(true);
    }
  }, [latestFrames, watcherActive, aiLoading]);

  const triggerAiAnalysis = async (isAuto = false) => {
    if (frames.length === 0) return;
    setAiLoading(true);
    try {
      const result = await analyzeCANData(frames, user || undefined, sessionId || undefined);
      setLastAiAnalysis({ ...result, isAutomatic: isAuto });
      if (isAuto) lastAnalyzedFaultTime.current = Date.now();
    } catch (e) {
      addDebugLog("AI_ERROR: Failed to fetch insights.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleNewFrame = useCallback((id: string, dlc: number, data: string[]) => {
    if (isPaused) return;
    const normId = normalizeId(id, true);
    if (!normId) return;
    const displayId = `0x${formatIdForDisplay(normId)}`;
    const prev = frameMapRef.current.get(normId);
    
    const newFrame: CANFrame = {
      id: displayId, dlc,
      data: data.map(d => d.toUpperCase().trim()), 
      timestamp: performance.now(),
      absoluteTimestamp: Date.now(),
      direction: 'Rx',
      count: (prev?.count || 0) + 1,
      periodMs: prev ? Math.round(performance.now() - prev.timestamp) : 0
    };
    frameMapRef.current.set(normId, newFrame);
    pendingFramesRef.current.push(newFrame);
  }, [isPaused]);

  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = performance.now();
      setLatestFrames(prev => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(id => {
          if (now - next[id].timestamp > STALE_SIGNAL_TIMEOUT) {
            delete next[id];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(cleanupInterval);
  }, []);

  useEffect(() => {
    (window as any).onNativeBleLog = (msg: string) => addDebugLog(msg);
    (window as any).onNativeBleStatus = (status: string) => {
      setBridgeStatus(status as ConnectionStatus);
      if (status === 'connected') {
          setHwStatus('active');
          setSimulationEnabled(false);
          setFrames([]);
          setLatestFrames({});
          frameMapRef.current.clear();
      }
      else if (status === 'error') setHwStatus('fault');
      else setHwStatus('offline');
    };
    (window as any).onNativeBleData = (chunk: string) => {
      bleBufferRef.current += chunk;
      processBleBuffer();
    };
    return () => {
      delete (window as any).onNativeBleLog;
      delete (window as any).onNativeBleStatus;
      delete (window as any).onNativeBleData;
    };
  }, [addDebugLog, handleNewFrame]);

  const processBleBuffer = () => {
    if (bleBufferRef.current.includes('\n')) {
      const lines = bleBufferRef.current.split('\n');
      bleBufferRef.current = lines.pop() || "";
      for (const line of lines) {
        const parts = line.trim().split('#');
        if (parts.length >= 3) handleNewFrame(parts[0], parseInt(parts[1]), parts[2].split(','));
      }
    }
  };

  useEffect(() => {
    if (!simulationEnabled || bridgeStatus === 'connected' || bridgeStatus === 'connecting') return;
    const interval = setInterval(() => {
        const mock = generateMockPacket(frameMapRef.current, performance.now());
        handleNewFrame(mock.id.replace('0x',''), mock.dlc, mock.data);
    }, 500);
    return () => clearInterval(interval);
  }, [simulationEnabled, bridgeStatus, handleNewFrame]);

  const connectSerial = async () => {
    if (!("serial" in navigator)) {
        addDebugLog("ERROR: Serial API not supported in this browser.");
        setBridgeStatus('error');
        return;
    }
    try {
      setBridgeStatus('connecting');
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate });
      serialPortRef.current = port;
      
      setSimulationEnabled(false);
      setFrames([]);
      setLatestFrames({});
      frameMapRef.current.clear();
      
      setBridgeStatus('connected');
      setHwStatus('active');

      keepReadingRef.current = true;
      const decoder = new TextDecoder();
      let buffer = "";
      
      const reader = port.readable.getReader();
      serialReaderRef.current = reader;

      try {
        while (keepReadingRef.current) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || "";
          for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine) continue;
            const parts = cleanLine.split('#');
            if (parts.length >= 3) handleNewFrame(parts[0], parseInt(parts[1]), parts[2].split(','));
          }
        }
      } catch (e: any) {
        if (keepReadingRef.current) addDebugLog(`SERIAL_READ_ERROR: ${e.message}`);
      } finally {
        reader.releaseLock();
        serialReaderRef.current = null;
      }
    } catch (err: any) { 
      setBridgeStatus('disconnected'); 
      addDebugLog(`SERIAL_FAULT: ${err.message}`);
    }
  };

  const connectWebBluetooth = async () => {
    // FIX: Casting navigator to 'any' to resolve 'Property bluetooth does not exist on type Navigator' error.
    const nav = navigator as any;
    if (!nav.bluetooth) {
      addDebugLog("ERROR: Web Bluetooth not supported on this browser.");
      setBridgeStatus('error');
      return;
    }

    try {
      setBridgeStatus('connecting');
      addDebugLog("WEB_BLE: Initializing scan for OSM devices...");
      
      // FIX: Accessing bluetooth from the casted 'nav' object.
      const device = await nav.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'OSM' },
          { namePrefix: 'ESP32' },
          { namePrefix: 'CAN' }
        ],
        optionalServices: [UART_SERVICE_UUID]
      });

      addDebugLog(`WEB_BLE: Found ${device.name}. Connecting...`);
      webBleDeviceRef.current = device;

      const server = await device.gatt?.connect();
      const service = await server?.getPrimaryService(UART_SERVICE_UUID);
      const characteristic = await service?.getCharacteristic(TX_CHAR_UUID);

      if (characteristic) {
        await characteristic.startNotifications();
        characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
          const decoder = new TextDecoder();
          const chunk = decoder.decode(event.target.value);
          bleBufferRef.current += chunk;
          processBleBuffer();
        });

        device.addEventListener('gattserverdisconnected', () => {
          addDebugLog("WEB_BLE: Connection lost.");
          setBridgeStatus('disconnected');
          setHwStatus('offline');
        });

        setBridgeStatus('connected');
        setHwStatus('active');
        addDebugLog("WEB_BLE: Bridge synchronized and live.");
      }
    } catch (err: any) {
      addDebugLog(`WEB_BLE_ERROR: ${err.message}`);
      setBridgeStatus('disconnected');
    }
  };

  const disconnectHardware = useCallback(async () => {
    keepReadingRef.current = false;
    addDebugLog("SYS: Initiating hardware shutdown...");

    if (serialReaderRef.current) {
      try {
        await serialReaderRef.current.cancel(); 
      } catch (e) {}
    }

    if (serialPortRef.current) {
      try { 
        await serialPortRef.current.close(); 
        addDebugLog("SYS: Serial Port closed.");
      } catch (e) {}
      serialPortRef.current = null;
    }

    if (webBleDeviceRef.current && webBleDeviceRef.current.gatt?.connected) {
      try {
        webBleDeviceRef.current.gatt.disconnect();
        addDebugLog("SYS: Web BLE disconnected.");
      } catch (e) {}
      webBleDeviceRef.current = null;
    }

    if ((window as any).NativeBleBridge) {
      try {
        (window as any).NativeBleBridge.disconnectBle();
        addDebugLog("SYS: Native BLE Link terminated.");
      } catch (e) {}
    }

    bleBufferRef.current = "";
    setBridgeStatus('disconnected');
    setHwStatus('offline');
    setFrames([]);
    setLatestFrames({});
    frameMapRef.current.clear();
    addDebugLog("SYS: Hardware resources fully released.");
  }, [addDebugLog]);

  const handleConnect = () => {
    setSimulationEnabled(false);
    frameMapRef.current.clear();
    setFrames([]);
    setLatestFrames({});
    
    if (hardwareMode === 'esp32-bt') {
        if ((window as any).NativeBleBridge) {
          setBridgeStatus('connecting');
          (window as any).NativeBleBridge?.startBleLink();
        } else {
          connectWebBluetooth();
        }
    } else {
        connectSerial();
    }
  };

  const handleSaveTrace = useCallback(() => {
    if (frames.length === 0) return;
    setIsSaving(true);
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `OSM_Trace_${timestamp}.trc`;
      let content = "; PCAN Trace File V2.0\n; Timestamp: " + new Date().toLocaleString() + "\n";
      frames.forEach((f, i) => {
        content += `${(i + 1).toString().padStart(6, ' ')}  ${(f.timestamp / 1000).toFixed(4).padStart(12, ' ')}  DT  ${f.id.replace('0x', '').toUpperCase().padStart(12, ' ')}  Rx ${f.dlc.toString().padStart(2, ' ')}  ${f.data.join(' ')}\n`;
      });
      if ((window as any).AndroidInterface?.saveFile) {
        (window as any).AndroidInterface.saveFile(content, fileName);
      } else {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
      }
      addDebugLog("SUCCESS: Session exported.");
    } catch (e: any) {
      addDebugLog("EXPORT_ERROR: " + e.message);
    } finally {
      setIsSaving(false);
    }
  }, [frames, addDebugLog]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (pendingFramesRef.current.length > 0) {
        const batch = [...pendingFramesRef.current];
        pendingFramesRef.current = [];
        setFrames(prev => prev.length + batch.length >= MAX_FRAME_LIMIT ? [] : [...prev, ...batch]);
        const latest: Record<string, CANFrame> = {};
        batch.forEach(f => { latest[normalizeId(f.id.replace('0x',''), true)] = f; });
        setLatestFrames(prev => ({ ...prev, ...latest }));
      }
    }, BATCH_UPDATE_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    setUser(null);
    setSessionId(null);
    localStorage.removeItem('osm_currentUser');
    localStorage.removeItem('osm_sid');
    setView('home');
    disconnectHardware();
  };

  const handleAuthenticated = (u: User, s: string) => {
    localStorage.setItem('osm_currentUser', JSON.stringify(u));
    localStorage.setItem('osm_sid', s);
    setUser(u);
    setSessionId(s);
  };

  if (!user) return <AuthScreen onAuthenticated={handleAuthenticated} />;

  const renderContent = () => {
    if (view === 'home') {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center bg-white px-6 relative overflow-hidden">
          <div className="bg-indigo-600 p-6 rounded-[32px] text-white shadow-2xl mb-12 animate-bounce"><Cpu size={64} /></div>
          <h1 className="text-4xl md:text-8xl font-orbitron font-black text-slate-900 uppercase text-center">OSM <span className="text-indigo-600">LIVE</span></h1>
          <div className="flex flex-col gap-4 w-full max-w-xs mt-12 text-center relative z-10">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mb-4">Operator: {user.userName}</p>
            <button onClick={() => setView('live')} className="w-full py-6 bg-indigo-600 text-white rounded-3xl font-orbitron font-black uppercase shadow-2xl transition-all active:scale-95">Launch HUD</button>
            <button onClick={handleLogout} className="w-full py-4 text-slate-400 font-bold uppercase text-[10px] tracking-widest flex items-center justify-center gap-2">Terminate Session</button>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full w-full flex flex-col bg-slate-50 safe-pt overflow-hidden relative">
        <header className="h-16 border-b flex items-center justify-between px-6 bg-white shrink-0 z-[100]">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('home')} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ArrowLeft size={20} /></button>
            <h2 className="text-[12px] font-orbitron font-black text-slate-900 uppercase">OSM_MOBILE_LINK</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${bridgeStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-slate-300'}`} />
          </div>
        </header>

        <main className="flex-1 overflow-hidden relative flex flex-col min-h-0">
          {dashboardTab === 'link' ? (
            <ConnectionPanel 
              status={bridgeStatus} 
              hardwareMode={hardwareMode} 
              onSetHardwareMode={setHardwareMode} 
              baudRate={baudRate} 
              setBaudRate={setBaudRate} 
              onConnect={handleConnect} 
              onDisconnect={disconnectHardware} 
              debugLog={debugLog}
            />
          ) : dashboardTab === 'analysis' ? (
            <TraceAnalysisDashboard 
              frames={frames} 
              library={library} 
              latestFrames={latestFrames} 
              selectedSignalNames={analysisSelectedSignals}
              setSelectedSignalNames={setAnalysisSelectedSignals}
              watcherActive={watcherActive}
              setWatcherActive={setWatcherActive}
              lastAiAnalysis={lastAiAnalysis}
              aiLoading={aiLoading}
              onManualAnalyze={() => triggerAiAnalysis(false)}
            />
          ) : dashboardTab === 'live-visualizer' ? (
            <LiveVisualizerDashboard 
              frames={frames} 
              library={library} 
              latestFrames={latestFrames} 
              selectedSignalNames={visualizerSelectedSignals}
              setSelectedSignalNames={setVisualizerSelectedSignals}
            />
          ) : dashboardTab === 'trace' ? (
            <div className="flex-1 flex flex-col overflow-hidden p-4 gap-4">
               <CANMonitor frames={frames} isPaused={isPaused} library={library} onClearTrace={() => setFrames([])} onSaveTrace={handleSaveTrace} isSaving={isSaving} />
            </div>
          ) : (
            <LibraryPanel library={library} onUpdateLibrary={setLibrary} latestFrames={latestFrames} />
          )}
        </main>

        <nav className="h-20 bg-white border-t flex items-center justify-around px-4 pb-2 shrink-0 safe-pb z-[100]">
          {[
              { id: 'link', icon: Bluetooth, label: 'LINK' },
              { id: 'trace', icon: LayoutDashboard, label: 'DASHBOARD' },
              { id: 'library', icon: Database, label: 'DATA' },
              { id: 'live-visualizer', icon: ChartIcon, label: 'LIVE VISUALIZER' },
              { id: 'analysis', icon: BarChart3, label: 'ANALYSIS' }
          ].map(tab => (
              <button key={tab.id} onClick={() => setDashboardTab(tab.id as any)} className={`flex flex-col items-center gap-1.5 px-4 py-2 rounded-2xl transition-all ${dashboardTab === tab.id ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}>
                  <tab.icon size={20} /><span className="text-[8px] font-orbitron font-black uppercase">{tab.label}</span>
              </button>
          ))}
        </nav>
      </div>
    );
  };

  return <div className="h-screen w-full">{renderContent()}</div>;
};

export default App;

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Play, Pause, Cpu, ArrowLeft, Activity, Bluetooth, Zap, BarChart3, Database, LogOut, ExternalLink, LayoutDashboard, ShieldCheck, Settings2, Smartphone, Tablet, Monitor, LineChart as ChartIcon, Info, HelpCircle, AlertTriangle, Send } from 'lucide-react';
import CANMonitor from '@/components/CANMonitor';
import ConnectionPanel from '@/components/ConnectionPanel';
import LibraryPanel from '@/components/LibraryPanel';
import TraceAnalysisDashboard from '@/components/TraceAnalysisDashboard';
import LiveVisualizerDashboard from '@/components/LiveVisualizerDashboard';
import TransmitPanel from '@/components/TransmitPanel';
import AuthScreen from '@/components/AuthScreen';
import FeatureSelector from '@/components/FeatureSelector';
import DataDecoder from '@/components/DataDecoder';
import PWAInstallOverlay from '@/components/PWAInstallOverlay';
import { CANFrame, ConnectionStatus, HardwareStatus, ConversionLibrary, SignalAnalysis, DBCMessage, DBCSignal, TransmitFrame } from '@/types';
import { MY_CUSTOM_DBC, DEFAULT_LIBRARY_NAME } from '@/data/dbcProfiles';
import { normalizeId, formatIdForDisplay, decodeSignal, cleanMessageName } from '@/utils/decoder';
import { User, authService } from '@/services/authService';
import { generateMockPacket } from '@/utils/canSim';
import { analyzeCANData } from '@/services/geminiService';

const MAX_FRAME_LIMIT = 1000000; 
const BATCH_UPDATE_INTERVAL = 60; 
const STALE_SIGNAL_TIMEOUT = 5000; 

// Nordic UART Service UUIDs
const UART_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const TX_CHAR_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
const RX_CHAR_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('osm_currentUser');
    try { return savedUser ? JSON.parse(savedUser) : null; } catch { return null; }
  });
  
  const [sessionId, setSessionId] = useState<string | null>(() => localStorage.getItem('osm_sid'));
  
  // Navigation
  const [view, setView] = useState<'home' | 'select' | 'live' | 'decoder'>('home');
  
  const [dashboardTab, setDashboardTab] = useState<'link' | 'trace' | 'library' | 'analysis' | 'live-visualizer' | 'transmit'>('link');
  const [hardwareMode, setHardwareMode] = useState<'esp32-serial' | 'esp32-bt'>('esp32-bt');
  const [frames, setFrames] = useState<CANFrame[]>([]);
  const [latestFrames, setLatestFrames] = useState<Record<string, CANFrame>>({});
  const [isPaused, setIsPaused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingDecoded, setIsSavingDecoded] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const hasTriggeredAutoSaveRef = useRef(false);

  const [bridgeStatus, setBridgeStatus] = useState<ConnectionStatus>('disconnected');
  const [hwStatus, setHwStatus] = useState<HardwareStatus>('offline');
  const [baudRate, setBaudRate] = useState(115200);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  
  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallOverlay, setShowInstallOverlay] = useState(false);

  // Transmit States
  const [activeSchedules, setActiveSchedules] = useState<Record<string, TransmitFrame>>({});
  const schedulesRef = useRef<Record<string, any>>({});

  // Persistent analysis states
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

  const sessionStartTimeRef = useRef<number>(0);
  const frameMapRef = useRef<Map<string, CANFrame>>(new Map());
  const pendingFramesRef = useRef<CANFrame[]>([]);
  const bleBufferRef = useRef<string>("");
  const serialPortRef = useRef<any>(null);
  const serialReaderRef = useRef<any>(null);
  const serialWriterRef = useRef<any>(null);
  const webBluetoothDeviceRef = useRef<any>(null);
  const bleRxCharacteristicRef = useRef<any>(null);
  const keepReadingRef = useRef(false);

  // Listen for PWA install prompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Wait a few seconds after load to show the custom HUD prompt
      setTimeout(() => setShowInstallOverlay(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    }
    setDeferredPrompt(null);
    setShowInstallOverlay(false);
  };

  const addDebugLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    setDebugLog(prev => [`[${time}] ${msg}`, ...prev].slice(0, 50));
  }, []);

  /**
   * TRANSMIT HANDLER - FOR REAL-TIME COMMANDS
   */
  const sendHardwareCommand = async (payload: string) => {
    if (bridgeStatus !== 'connected') return;
    
    try {
      if (hardwareMode === 'esp32-serial' && serialPortRef.current) {
        if (!serialWriterRef.current) {
          serialWriterRef.current = serialPortRef.current.writable.getWriter();
        }
        const encoder = new TextEncoder();
        await serialWriterRef.current.write(encoder.encode(payload + "\n"));
      } else if (hardwareMode === 'esp32-bt' && bleRxCharacteristicRef.current) {
        const encoder = new TextEncoder();
        await bleRxCharacteristicRef.current.writeValue(encoder.encode(payload + "\n"));
      } else if ((window as any).NativeBleBridge) {
        addDebugLog(`TX (Native): ${payload}`);
      }
    } catch (e: any) {
      addDebugLog(`TX_ERROR: ${e.message}`);
    }
  };

  const handleSendMessage = (id: string, dlc: number, data: string[]) => {
    const payload = `TX#${id}#${dlc}#${data.join(',')}`;
    sendHardwareCommand(payload);
    
    // Locally add to trace for confirmation
    const normId = normalizeId(id, true);
    const newFrame: CANFrame = {
      id: `0x${formatIdForDisplay(normId)}`,
      dlc,
      data: data.map(d => d.toUpperCase()),
      timestamp: performance.now() - sessionStartTimeRef.current,
      absoluteTimestamp: Date.now(),
      direction: 'Tx',
      count: 1,
      periodMs: 0
    };
    pendingFramesRef.current.push(newFrame);
  };

  const handleScheduleMessage = (frame: TransmitFrame) => {
    setActiveSchedules(prev => ({ ...prev, [frame.id]: frame }));
    if (schedulesRef.current[frame.id]) clearInterval(schedulesRef.current[frame.id]);
    schedulesRef.current[frame.id] = setInterval(() => {
      handleSendMessage(frame.id, frame.dlc, frame.data);
    }, frame.periodMs);
  };

  const handleStopMessage = (id: string) => {
    setActiveSchedules(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (schedulesRef.current[id]) {
      clearInterval(schedulesRef.current[id]);
      delete schedulesRef.current[id];
    }
  };

  const exportFile = async (data: string, fileName: string, mimeType: string = 'text/plain') => {
    const android = (window as any).AndroidInterface;
    
    if (android && android.saveFileWithPicker) {
      android.saveFileWithPicker(data, fileName, mimeType);
    } else if (android && android.saveFile) {
      android.saveFile(data, fileName);
    } else if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: mimeType === 'text/plain' ? 'CAN Trace File' : 'Telemetry CSV',
            accept: { [mimeType]: [fileName.endsWith('.trc') ? '.trc' : '.csv'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(data);
        await writable.close();
        addDebugLog("SYS: File saved successfully.");
      } catch (e: any) {
        if (e.name !== 'AbortError') addDebugLog("ERROR: Web save failed.");
      }
    } else {
      const blob = new Blob([data], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleSaveTrace = async (isAuto: boolean = false) => {
    if (frames.length === 0) return;
    if (!isAuto) setIsSaving(true);
    addDebugLog(isAuto ? "AUTOSAVE: Buffer limit reached. Generating Trace..." : "SYS: Compiling PCAN-View v5.x Trace...");
    
    try {
      const firstFrame = frames[0];
      const startDate = new Date(firstFrame.absoluteTimestamp);
      const excelSerialDate = (startDate.getTime() / (1000 * 60 * 60 * 24)) + 25569.0;
      
      const day = startDate.getDate();
      const month = startDate.getMonth() + 1;
      const year = startDate.getFullYear();
      const h = startDate.getHours().toString().padStart(2, '0');
      const m = startDate.getMinutes().toString().padStart(2, '0');
      const s = startDate.getSeconds().toString().padStart(2, '0');
      const ms = startDate.getMilliseconds().toString().padStart(3, '0');

      let content = ";$FILEVERSION=2.0\n";
      content += `;$STARTTIME=${excelSerialDate.toFixed(10)}\n`;
      content += ";$COLUMNS=N,O,T,I,d,l,D\n";
      content += ";\n";
      content += `;   Start time: ${day}/${month}/${year} ${h}:${m}:${s}.${ms}.0\n`;
      content += `;   Generated by OSM CAT 1.0 ${isAuto ? '(AUTO_EXPORT)' : ''}\n`;
      content += ";   Message   Time    Type ID     Rx/Tx\n";
      content += ";   Number    Offset  |    [hex]  |  Data Length\n";
      content += ";   |         [ms]    |    |      |  |  Data [hex] ...\n";
      content += ";   |         |       |    |      |  |  |\n";
      content += ";---+-- ------+------ +- --+----- +- +- +- +- -- -- -- -- -- -- --\n";
      
      const rows = frames.map((f, i) => {
        const msgNum = (i + 1).toString().padStart(7, ' ');
        const timeOffset = (f.timestamp).toFixed(3).padStart(13, ' ');
        const type = "DT";
        const id = f.id.replace('0x', '').toUpperCase().padStart(8, ' ');
        const rxtx = f.direction.padStart(2, ' ');
        const dlc = f.dlc.toString().padStart(1, ' ');
        const dataBytes = f.data.map(d => d.padStart(2, '0').toUpperCase()).join(' ');
        return `${msgNum} ${timeOffset} ${type} ${id} ${rxtx} ${dlc}  ${dataBytes}`;
      });
      
      content += rows.join('\n') + '\n';
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const prefix = isAuto ? 'AUTOSAVE_' : 'OSM_';
      await exportFile(content, `${prefix}TRACE_${stamp}.trc`, 'text/plain');
    } catch (e) {
      addDebugLog("ERROR: Trace compilation failed.");
      console.error(e);
    } finally {
      if (!isAuto) setIsSaving(false);
    }
  };
  
  const handleSaveDecoded = async (isAuto: boolean = false) => {
    if (frames.length === 0) return;
    if (!isAuto) setIsSavingDecoded(true);
    try {
      const activeNormalizedIds = new Set(Object.keys(latestFrames));
      const activeSignals: { name: string; msgId: string; sig: DBCSignal }[] = [];
      const msgIdToSignals: Record<string, string[]> = {};

      (Object.entries(library.database) as [string, DBCMessage][]).forEach(([rawId, msg]) => {
        const normId = normalizeId(rawId);
        if (activeNormalizedIds.has(normId)) {
          msgIdToSignals[normId] = [];
          Object.values(msg.signals).forEach((sig: any) => {
            activeSignals.push({ name: sig.name, msgId: normId, sig });
            msgIdToSignals[normId].push(sig.name);
          });
        }
      });

      if (activeSignals.length === 0) {
        if (!isAuto) addDebugLog("SYS: No decoded signals available to save.");
        if (!isAuto) setIsSavingDecoded(false);
        return;
      }

      const header = ["timestamp", ...activeSignals.map(s => s.name)].join(",");
      const csvRows: string[] = [header];
      const lkv: Record<string, string> = {};
      activeSignals.forEach(s => lkv[s.name] = "0");

      const processBuffer = frames.length > 100000 ? frames.slice(-100000) : frames;

      processBuffer.forEach(frame => {
        const frameNormId = normalizeId(frame.id.replace('0x', ''), true);
        const signalNamesInMsg = msgIdToSignals[frameNormId];

        if (signalNamesInMsg) {
          const dbEntry = library.database[Object.keys(library.database).find(k => normalizeId(k) === frameNormId) || ""];
          if (dbEntry) {
            signalNamesInMsg.forEach(sName => {
              const sig = dbEntry.signals[sName];
              const val = decodeSignal(frame.data, sig);
              lkv[sName] = val.split(' ')[0];
            });
            const row = [(frame.timestamp / 1000).toFixed(3), ...activeSignals.map(s => lkv[s.name])].join(",");
            csvRows.push(row);
          }
        }
      });

      const content = csvRows.join("\n");
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const prefix = isAuto ? 'AUTOSAVE_' : 'OSM_';
      await exportFile(content, `${prefix}DECODED_${stamp}.csv`, 'text/csv');
      if (!isAuto) addDebugLog("SYS: Wide-format export initiated.");
    } catch (e) {
      if (!isAuto) addDebugLog("ERROR: Decoded export failed.");
      console.error(e);
    } finally {
      if (!isAuto) setIsSavingDecoded(false);
    }
  };

  const triggerAiAnalysis = async (isAuto = false) => {
    if (frames.length === 0) return;
    setAiLoading(true);
    try {
      const result = await analyzeCANData(frames, user || undefined, sessionId || undefined);
      setLastAiAnalysis({ ...result, isAutomatic: isAuto });
    } catch (e) {
      addDebugLog("AI_ERROR: Analysis failed.");
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
    
    const nowPerf = performance.now();
    const newFrame: CANFrame = {
      id: displayId, dlc,
      data: data.map(d => d.toUpperCase().trim()), 
      timestamp: nowPerf - sessionStartTimeRef.current,
      absoluteTimestamp: Date.now(),
      direction: 'Rx',
      count: (prev?.count || 0) + 1,
      periodMs: prev ? Math.round(nowPerf - (prev.timestamp + sessionStartTimeRef.current)) : 0
    };
    frameMapRef.current.set(normId, newFrame);
    pendingFramesRef.current.push(newFrame);
  }, [isPaused]);

  const connectSerial = async () => {
    if (!("serial" in navigator)) {
      addDebugLog("ERROR: Web Serial API not supported. Use Chrome or Edge.");
      setBridgeStatus('error');
      return;
    }

    try {
      setBridgeStatus('connecting');
      addDebugLog("SERIAL: Opening Port Selector...");
      
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate });
      serialPortRef.current = port;
      
      setFrames([]);
      setLatestFrames({});
      frameMapRef.current.clear();
      hasTriggeredAutoSaveRef.current = false;
      sessionStartTimeRef.current = performance.now();
      
      setBridgeStatus('connected');
      setHwStatus('active');
      addDebugLog(`BRIDGE: Wired Link Active at ${baudRate} bps.`);

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
          if (buffer.includes('\n')) {
            const lines = buffer.split('\n');
            buffer = lines.pop() || "";
            for (const line of lines) {
              const cleanLine = line.trim();
              if (!cleanLine || !cleanLine.includes('#')) continue;
              const parts = cleanLine.split('#');
              if (parts.length >= 3) {
                handleNewFrame(parts[0], parseInt(parts[1]), parts[2].split(','));
              }
            }
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
    if (!(navigator as any).bluetooth) {
      addDebugLog("ERROR: Browser does not support Web Bluetooth.");
      setBridgeStatus('error');
      return;
    }

    try {
      if (webBluetoothDeviceRef.current && webBluetoothDeviceRef.current.gatt.connected) {
        addDebugLog("SCAN: Closing existing link...");
        await webBluetoothDeviceRef.current.gatt.disconnect();
      }

      setBridgeStatus('connecting');
      addDebugLog("SCAN: Opening OS Bluetooth Picker...");
      
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [
          { services: [UART_SERVICE_UUID] },
          { namePrefix: "OSM" },
          { namePrefix: "ESP32" }
        ],
        optionalServices: [UART_SERVICE_UUID]
      });

      webBluetoothDeviceRef.current = device;
      addDebugLog(`LINK: Connecting to ${device.name || 'OSM Hardware'}...`);

      device.addEventListener('gattserverdisconnected', () => {
        addDebugLog("LINK: Device lost connection.");
        setBridgeStatus('disconnected');
        setHwStatus('offline');
      });

      const server = await device.gatt.connect();
      addDebugLog("LINK: GATT connected. Cooling (1000ms)...");
      await new Promise(r => setTimeout(r, 1000));
      
      addDebugLog("LINK: Searching for Data Channels...");
      const service = await server.getPrimaryService(UART_SERVICE_UUID);
      
      const txChar = await service.getCharacteristic(TX_CHAR_UUID);
      await txChar.startNotifications();
      txChar.addEventListener('characteristicvaluechanged', (event: any) => {
        const value = event.target.value;
        const decoder = new TextDecoder();
        const chunk = decoder.decode(value);
        bleBufferRef.current += chunk;
        if (bleBufferRef.current.includes('\n')) {
          const lines = bleBufferRef.current.split('\n');
          bleBufferRef.current = lines.pop() || "";
          for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine || !cleanLine.includes('#')) continue;
            const parts = cleanLine.split('#');
            if (parts.length >= 3) handleNewFrame(parts[0], parseInt(parts[1]), parts[2].split(','));
          }
        }
      });

      try {
        const rxChar = await service.getCharacteristic(RX_CHAR_UUID);
        bleRxCharacteristicRef.current = rxChar;
        addDebugLog("LINK: Bidirectional channel established.");
      } catch (e) {
        addDebugLog("LINK: RX channel missing. Transmit disabled.");
      }

      setFrames([]);
      setLatestFrames({});
      frameMapRef.current.clear();
      hasTriggeredAutoSaveRef.current = false;
      sessionStartTimeRef.current = performance.now();
      
      setBridgeStatus('connected');
      setHwStatus('active');
      addDebugLog("BRIDGE: Secure Desktop Link Established.");

    } catch (err: any) {
      addDebugLog(`BLE_FAULT: ${err.message}`);
      setBridgeStatus('disconnected');
    }
  };

  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = performance.now();
      setLatestFrames(prev => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(id => {
          if (now - next[id].timestamp - sessionStartTimeRef.current > STALE_SIGNAL_TIMEOUT) {
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
          setFrames([]);
          setLatestFrames({});
          frameMapRef.current.clear();
          hasTriggeredAutoSaveRef.current = false;
          sessionStartTimeRef.current = performance.now();
      }
    };
    (window as any).onNativeBleData = (chunk: string) => {
      bleBufferRef.current += chunk;
      if (bleBufferRef.current.includes('\n')) {
        const lines = bleBufferRef.current.split('\n');
        bleBufferRef.current = lines.pop() || "";
        for (const line of lines) {
          const parts = line.trim().split('#');
          if (parts.length >= 3) handleNewFrame(parts[0], parseInt(parts[1]), parts[2].split(','));
        }
      }
    };
    return () => {
      delete (window as any).onNativeBleLog;
      delete (window as any).onNativeBleStatus;
      delete (window as any).onNativeBleData;
    };
  }, [addDebugLog, handleNewFrame]);

  const disconnectHardware = useCallback(async () => {
    keepReadingRef.current = false;
    addDebugLog("SYS: Closing all links...");

    Object.values(schedulesRef.current).forEach(clearInterval);
    schedulesRef.current = {};
    setActiveSchedules({});

    if (serialWriterRef.current) {
       try { serialWriterRef.current.releaseLock(); } catch(e){}
       serialWriterRef.current = null;
    }

    if (serialReaderRef.current) {
      try { await serialReaderRef.current.cancel(); } catch (e) {}
    }

    if (serialPortRef.current) {
      try { await serialPortRef.current.close(); } catch (e) {}
      serialPortRef.current = null;
    }

    if (webBluetoothDeviceRef.current?.gatt.connected) {
      await webBluetoothDeviceRef.current.gatt.disconnect();
    }

    if ((window as any).NativeBleBridge) {
      (window as any).NativeBleBridge.disconnectBle();
    }

    setBridgeStatus('disconnected');
    setHwStatus('offline');
    addDebugLog("SYS: Hardware offline.");
  }, [addDebugLog]);

  const handleConnect = () => {
    if (hardwareMode === 'esp32-bt') {
      if ((window as any).NativeBleBridge) {
        setBridgeStatus('connecting');
        (window as any).NativeBleBridge.startBleLink();
      } else {
        connectWebBluetooth();
      }
    } else {
      connectSerial();
    }
  };

  /**
   * FRAME BATCHING
   */
  useEffect(() => {
    const interval = setInterval(() => {
      if (pendingFramesRef.current.length > 0) {
        const batch = [...pendingFramesRef.current];
        pendingFramesRef.current = [];
        
        setFrames(prev => {
          const next = [...prev, ...batch];
          if (next.length > MAX_FRAME_LIMIT) {
            return next.slice(-MAX_FRAME_LIMIT);
          }
          return next;
        });
        
        const latest: Record<string, CANFrame> = {};
        batch.forEach(f => { latest[normalizeId(f.id.replace('0x',''), true)] = f; });
        setLatestFrames(prev => ({ ...prev, ...latest }));
      }
    }, BATCH_UPDATE_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  /**
   * AUTONOMOUS MONITORING: Watch for buffer limit
   */
  useEffect(() => {
    if (autoSaveEnabled && frames.length >= MAX_FRAME_LIMIT && !hasTriggeredAutoSaveRef.current) {
      hasTriggeredAutoSaveRef.current = true;
      handleSaveTrace(true);
      handleSaveDecoded(true);
    }
  }, [frames.length, autoSaveEnabled]);

  const handleAuthenticated = (u: User, s: string) => {
    localStorage.setItem('osm_currentUser', JSON.stringify(u));
    localStorage.setItem('osm_sid', s);
    setUser(u);
    setSessionId(s);
  };

  if (!user) return <AuthScreen onAuthenticated={handleAuthenticated} />;

  return (
    <div className="h-screen w-full font-inter">
      {/* PWA Install HUD Overlay */}
      {showInstallOverlay && (
        <PWAInstallOverlay 
          onInstall={handleInstallClick} 
          onDismiss={() => setShowInstallOverlay(false)} 
        />
      )}

      {view === 'home' ? (
        <div className="h-full w-full flex flex-col items-center justify-center bg-white px-6 relative overflow-hidden">
          <div className="bg-indigo-600 p-6 rounded-[32px] text-white shadow-2xl mb-12 animate-bounce"><Cpu size={64} /></div>
          <h1 className="text-4xl md:text-8xl font-orbitron font-black text-slate-900 uppercase text-center">OSM <span className="text-indigo-600">LIVE</span></h1>
          <div className="flex flex-col gap-4 w-full max-w-xs mt-12 text-center relative z-10">
            <button onClick={() => setView('select')} className="w-full py-6 bg-indigo-600 text-white rounded-3xl font-orbitron font-black uppercase shadow-2xl transition-all active:scale-95">Launch HUD</button>
          </div>
        </div>
      ) : view === 'select' ? (
        <FeatureSelector onSelect={(v) => setView(v)} />
      ) : view === 'decoder' ? (
        <DataDecoder library={library} onExit={() => setView('select')} />
      ) : (
        <div className="h-full w-full flex flex-col bg-slate-50 safe-pt overflow-hidden relative">
          <header className="h-14 md:h-16 border-b flex items-center justify-between px-4 md:px-6 bg-white shrink-0 z-[100]">
            <div className="flex items-center gap-3 md:gap-4">
              <button onClick={() => setView('select')} className="p-1.5 md:p-2 hover:bg-slate-100 rounded-full transition-colors"><ArrowLeft size={18} /></button>
              <h2 className="text-[10px] md:text-[12px] font-orbitron font-black text-slate-900 uppercase">OSM_MOBILE_LINK</h2>
            </div>
            <div className="flex items-center gap-2">
               {bridgeStatus === 'connected' && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[8px] font-orbitron font-black border border-emerald-100 shadow-sm">
                     <Zap size={10} /> BUS_LINK_ACTIVE
                  </div>
               )}
            </div>
          </header>

          <main className="flex-1 overflow-hidden relative flex flex-col min-h-0">
            {dashboardTab === 'link' ? (
              <ConnectionPanel 
                status={bridgeStatus} 
                hardwareMode={hardwareMode} 
                onSetHardwareMode={setHardwareMode} 
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
            ) : dashboardTab === 'transmit' ? (
              <TransmitPanel 
                onSendMessage={handleSendMessage}
                onScheduleMessage={handleScheduleMessage}
                onStopMessage={handleStopMessage}
                activeSchedules={activeSchedules}
              />
            ) : dashboardTab === 'trace' ? (
              <div className="flex-1 flex flex-col overflow-hidden p-2 md:p-4 gap-4">
                 <CANMonitor 
                    frames={frames} 
                    isPaused={isPaused} 
                    library={library} 
                    onClearTrace={() => { setFrames([]); hasTriggeredAutoSaveRef.current = false; }} 
                    onSaveTrace={handleSaveTrace} 
                    isSaving={isSaving}
                    autoSaveEnabled={autoSaveEnabled}
                    onToggleAutoSave={() => setAutoSaveEnabled(!autoSaveEnabled)}
                 />
              </div>
            ) : (
              <LibraryPanel 
                library={library} 
                onUpdateLibrary={setLibrary} 
                latestFrames={latestFrames} 
                onSaveDecoded={handleSaveDecoded} 
                isSavingDecoded={isSavingDecoded} 
              />
            )}
          </main>

          <nav className="h-16 md:h-20 bg-white border-t flex items-center justify-around px-2 md:px-4 pb-1 md:pb-2 shrink-0 safe-pb z-[100]">
            {[
                { id: 'link', icon: Bluetooth, label: 'LINK' },
                { id: 'trace', icon: LayoutDashboard, label: 'LIVE TRACE' },
                { id: 'library', icon: Database, label: 'DATA' },
                { id: 'transmit', icon: Send, label: 'TX_TOOL' },
                { id: 'live-visualizer', icon: ChartIcon, label: 'VISUALIZER' },
                { id: 'analysis', icon: BarChart3, label: 'ANALYSIS' }
            ].map(tab => (
                <button key={tab.id} onClick={() => setDashboardTab(tab.id as any)} className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${dashboardTab === tab.id ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}>
                    <tab.icon size={18} /><span className="text-[7px] md:text-[8px] font-orbitron font-black uppercase tracking-tighter md:tracking-normal">{tab.label}</span>
                </button>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
};

export default App;
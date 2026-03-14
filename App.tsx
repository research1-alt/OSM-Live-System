
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Cpu, LayoutDashboard, ShieldCheck, X, Menu } from 'lucide-react';
import CANMonitor from '@/components/CANMonitor';
import ConnectionPanel from '@/components/ConnectionPanel';
import LibraryPanel from '@/components/LibraryPanel';
import TransmitPanel from '@/components/TransmitPanel';
import AuthScreen from '@/components/AuthScreen';
import FeatureSelector from '@/components/FeatureSelector';
import LiveDashboard from '@/components/LiveDashboard';
import PWAInstallOverlay from '@/components/PWAInstallOverlay';
import { CANFrame, ConnectionStatus, HardwareStatus, ConversionLibrary, DBCMessage, DBCSignal, TransmitFrame } from '@/types';
import { MY_CUSTOM_DBC, DEFAULT_LIBRARY_NAME } from '@/data/dbcProfiles';
import { normalizeId, decodeSignal, formatIdForDisplay } from '@/utils/decoder';
import { User, authService } from '@/services/authService';
import { generateMockPacket } from '@/utils/canSim';

const MAX_FRAME_LIMIT = 1000000; 
const BATCH_UPDATE_INTERVAL = 10; 
const STALE_SIGNAL_TIMEOUT = 5000; 

// Common BLE UART Service UUIDs
const UART_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e"; // Nordic NUS
const HM10_SERVICE_UUID = "0000ffe0-0000-1000-8000-00805f9b34fb"; // HM-10
const TX_CHAR_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
const RX_CHAR_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";

const OPTIONAL_SERVICES = [
  UART_SERVICE_UUID,
  HM10_SERVICE_UUID,
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // Microchip
  "0000fefb-0000-1000-8000-00805f9b34fb"  // Telit
];

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('osm_currentUser');
    try { return savedUser ? JSON.parse(savedUser) : null; } catch { return null; }
  });
  
  const [sessionId, setSessionId] = useState<string | null>(() => localStorage.getItem('osm_sid'));
  
  // Navigation
  const [view, setView] = useState<'home' | 'select' | 'live'>('home');
  
  const [hardwareMode, setHardwareMode] = useState<'esp32-bt'>('esp32-bt');
  const [isSimulated, setIsSimulated] = useState(false);
  const simulationIntervalRef = useRef<any>(null);
  
  const [frames, setFrames] = useState<CANFrame[]>([]);
  const [latestFrames, setLatestFrames] = useState<Record<string, CANFrame>>({});
  const [isPaused, setIsPaused] = useState(false);
  const [isHwClockSynced, setIsHwClockSynced] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingDecoded, setIsSavingDecoded] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [msgPerSec, setMsgPerSec] = useState(0);
  const lastFrameCountRef = useRef(0);
  const hasTriggeredAutoSaveRef = useRef(false);

  const [bridgeStatus, setBridgeStatus] = useState<ConnectionStatus>('disconnected');
  const [hwStatus, setHwStatus] = useState<HardwareStatus>('offline');
  const [hardwareId, setHardwareId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const loggedHardwareRef = useRef<string | null>(null);
  const javaTimeOffsetRef = useRef<number | null>(null);
  const currentBatchTimestampRef = useRef<number>(performance.now());

  // Debug: Track state changes
  useEffect(() => {
    addDebugLog(`STATE_SYNC: Bridge=${bridgeStatus}, HW=${hwStatus}`);
    console.log(`[APP_STATE] View: ${view}, Bridge: ${bridgeStatus}, HW: ${hwStatus}`);
  }, [view, bridgeStatus, hwStatus]);
  const [deviceHistory, setDeviceHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem('osm_deviceHistory');
    try { return saved ? JSON.parse(saved) : []; } catch { return []; }
  });
  const [baudRate, setBaudRate] = useState(115200);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  
  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallOverlay, setShowInstallOverlay] = useState(false);

  // Process Sync Queue periodically
  useEffect(() => {
    // Initial process
    authService.processQueue();
    
    // Process every 30 seconds
    const interval = setInterval(() => {
      authService.processQueue();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Transmit States
  const [activeSchedules, setActiveSchedules] = useState<Record<string, TransmitFrame>>({});
  const schedulesRef = useRef<Record<string, any>>({});

  const [library, setLibrary] = useState<ConversionLibrary>({
    id: 'default-pcan-lib',
    name: DEFAULT_LIBRARY_NAME,
    database: MY_CUSTOM_DBC,
    lastUpdated: Date.now(),
  });

  const sessionStartTimeRef = useRef<number>(0);
  const appStartTimeRef = useRef<number>(0);
  const allFramesRef = useRef<CANFrame[]>([]);
  const frameMapRef = useRef<Map<string, CANFrame>>(new Map());
  const pendingFramesRef = useRef<CANFrame[]>([]);
  const bleBufferRef = useRef<string>("");
  const serialPortRef = useRef<any>(null);
  const serialReaderRef = useRef<any>(null);
  const serialWriterRef = useRef<any>(null);
  const webBluetoothDeviceRef = useRef<any>(null);
  const bleRxCharacteristicRef = useRef<any>(null);
  const keepReadingRef = useRef(false);
  const connectionTimeoutRef = useRef<any>(null);

  const isAdmin = useMemo(() => user ? authService.isAdmin(user.email) : false, [user]);

  // Listen for PWA install prompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowInstallOverlay(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowInstallOverlay(false);
  };

  const addDebugLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    setDebugLog(prev => [`[${time}] ${msg}`, ...prev].slice(0, 50));
  }, []);

  const startSimulation = () => {
    if (!isAdmin) return;
    import('./utils/canSim').then(m => m.resetSimulationState());
    setIsSimulated(true);
    setBridgeStatus('connected');
    setHwStatus('active');
    setHardwareId('SIM-OSM-BT-01');
    setFrames([]); 
    setLatestFrames({}); 
    frameMapRef.current.clear();
    allFramesRef.current = [];
    sessionStartTimeRef.current = performance.now();
    
    simulationIntervalRef.current = setInterval(() => {
      const mockFrames = generateMockPacket(frameMapRef.current, sessionStartTimeRef.current);
      if (mockFrames && Array.isArray(mockFrames)) {
        mockFrames.forEach(mockFrame => {
          handleNewFrame(mockFrame.id.replace('0x', ''), mockFrame.dlc, mockFrame.data, mockFrame.timestamp + sessionStartTimeRef.current);
        });
      }
    }, 10); // 100Hz Simulation (10ms)
  };

  const sendHardwareCommand = async (payload: string) => {
    if (isSimulated) {
      addDebugLog(`SIM_TX: ${payload}`);
      return;
    }
    if (bridgeStatus !== 'connected') return;
    try {
      if (hardwareMode === 'esp32-bt') {
        if (bleRxCharacteristicRef.current) {
          const encoder = new TextEncoder();
          await bleRxCharacteristicRef.current.writeValue(encoder.encode(payload + "\n"));
        } else if ((window as any).NativeBleBridge) {
          (window as any).NativeBleBridge.sendData(payload + "\n");
        }
      }
    } catch (e: any) {
      addDebugLog(`TX_ERROR: ${e.message}`);
    }
  };

  const handleSendMessage = (id: string, dlc: number, data: string[]) => {
    const payload = `TX#${id}#${dlc}#${data.join(',')}`;
    sendHardwareCommand(payload);
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

  const exportFile = useCallback(async (data: string, fileName: string, mimeType: string = '*/*') => {
    const android = (window as any).AndroidInterface;
    if (android && android.saveFileWithPicker) {
      android.saveFileWithPicker(data, fileName, mimeType);
    } else if (android && android.saveFile) {
      android.saveFile(data, fileName);
    } else if ('showSaveFilePicker' in window) {
      try {
        const isTrc = fileName.endsWith('.trc');
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [{ 
            description: isTrc ? 'PCAN Trace File (.trc)' : 'Telemetry CSV (.csv)', 
            accept: { 
              [isTrc ? 'application/octet-stream' : 'text/csv']: [isTrc ? '.trc' : '.csv'] 
            } 
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(data);
        await writable.close();
      } catch (e: any) {}
    } else {
      // Use Uint8Array for binary-like files to prevent browser from appending .txt
      const isBinary = fileName.endsWith('.trc') || mimeType.includes('octet-stream') || mimeType.includes('x-pcan-trace');
      const blobData = isBinary ? new TextEncoder().encode(data) : data;
      const blob = new Blob([blobData], { type: isBinary ? 'application/octet-stream' : mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = fileName;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 100);
    }
  }, []);

  const exportWideCsv = useCallback(() => {
    if (allFramesRef.current.length === 0) return;
    
    addDebugLog("EXPORT: Generating Wide-Format CSV...");
    
    // 1. Identify all unique signals in the library
    const allSignals: string[] = [];
    Object.values(library.database).forEach((msg: DBCMessage) => {
      Object.keys(msg.signals).forEach(sigName => {
        if (!allSignals.includes(sigName)) allSignals.push(sigName);
      });
    });
    allSignals.sort();

    // 2. Header
    let csv = "Time(ms),Message,ID(Hex),DLC," + allSignals.join(",") + "\n";
    
    // 3. Last Known Values (LKV) map
    const lkv: Record<string, string> = {};
    allSignals.forEach(s => lkv[s] = "");

    // 4. Process frames
    const rows = allFramesRef.current.map(frame => {
      const idHex = normalizeId(frame.id.replace('0x', ''), true);
      const msg = library.database[idHex] as DBCMessage | undefined;
      
      if (msg) {
        // Decode signals and update LKV
        Object.entries(msg.signals).forEach(([name, sig]: [string, DBCSignal]) => {
          const valStr = decodeSignal(frame.data, sig);
          // Extract numeric part for CSV
          const numericVal = parseFloat(valStr);
          lkv[name] = isNaN(numericVal) ? "" : numericVal.toFixed(3);
        });
      }

      const signalValues = allSignals.map(s => lkv[s]).join(",");
      return `${frame.timestamp.toFixed(3)},${msg?.name || 'Unknown'},${idHex},${frame.dlc},${signalValues}`;
    });

    csv += rows.join("\n");
    
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    exportFile(csv, `OSM_WIDE_EXPORT_${stamp}.csv`, 'text/csv');
  }, [library, exportFile, addDebugLog]);

  const handleSaveTrace = useCallback(async (isAuto: boolean = false) => {
  const traceSource = allFramesRef.current;
  if (traceSource.length === 0) return;
  if (!isAuto) setIsSaving(true);
  setTimeout(async () => {
    try {
      const firstFrame = traceSource[0];
      const firstTimestamp = firstFrame.timestamp;
      const startDate = new Date(firstFrame.absoluteTimestamp);
      const excelSerialDate = (startDate.getTime() / (1000 * 60 * 60 * 24)) + 25569.0;
      let content = ";$FILEVERSION=2.0\n";
      content += `;$STARTTIME=${excelSerialDate.toFixed(10)}\n`;
      content += ";$COLUMNS=N,O,T,I,d,l,D\n;\n";
      const rows = traceSource.map((f, i) => {
        const msgNum = (i + 1).toString().padStart(7, ' ');
        // Timestamps in TRC should be relative to the start of the recording (0.000)
        const timeOffset = (f.timestamp - firstTimestamp).toFixed(3).padStart(13, ' ');
        const id = f.id.replace('0x', '').toUpperCase().padStart(8, ' ');
        const rxtx = f.direction.padStart(2, ' ');
        const dlc = f.dlc.toString().padStart(1, ' ');
        const dataBytes = f.data.map(d => d.padStart(2, '0').toUpperCase()).join(' ');
        return `${msgNum} ${timeOffset} DT ${id} ${rxtx} ${dlc}  ${dataBytes}`;
      });
        content += rows.join('\n') + '\n';
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        await exportFile(content, `${isAuto ? 'AUTOSAVE_' : 'OSM_'}TRACE_${stamp}.trc`, '*/*');
      } catch (e) { console.error(e); } finally { if (!isAuto) setIsSaving(false); }
    }, 50);
  }, [frames, exportFile]);
  
  const handleSaveDecoded = useCallback(async (isAuto: boolean = false) => {
    const traceSource = allFramesRef.current;
    if (traceSource.length === 0) return;
    if (!isAuto) setIsSavingDecoded(true);
    setTimeout(async () => {
      try {
        const idToDbcMap = new Map<string, DBCMessage>();
        Object.entries(library.database).forEach(([decId, msg]) => idToDbcMap.set(normalizeId(decId), msg as DBCMessage));
        const uniqueIdsInTrace = new Set<string>();
        traceSource.slice(-50000).forEach(f => uniqueIdsInTrace.add(normalizeId(f.id.replace('0x', ''), true)));
        const activeSignalMeta: any[] = [];
        const msgIdToSignals: Record<string, string[]> = {};
        uniqueIdsInTrace.forEach(normId => {
          const msg = idToDbcMap.get(normId);
          if (msg) {
            msgIdToSignals[normId] = [];
            Object.values(msg.signals).forEach((sig: any) => {
              activeSignalMeta.push({ name: sig.name, msgId: normId, sig });
              msgIdToSignals[normId].push(sig.name);
            });
          }
        });
        if (activeSignalMeta.length === 0) { if (!isAuto) setIsSavingDecoded(false); return; }
        const header = ["timestamp_s", ...activeSignalMeta.map(s => `${s.name} [${s.sig.unit || 'raw'}]`)].join(",");
        const csvRows: string[] = [header];
        const lastKnownValues: Record<string, string> = {};
        activeSignalMeta.forEach(s => lastKnownValues[s.name] = "0");
        traceSource.slice(-50000).forEach((frame) => {
          const frameNormId = normalizeId(frame.id.replace('0x', ''), true);
          if (msgIdToSignals[frameNormId]) {
            const dbEntry = idToDbcMap.get(frameNormId);
            if (dbEntry) {
              msgIdToSignals[frameNormId].forEach(sName => lastKnownValues[sName] = decodeSignal(frame.data, dbEntry.signals[sName]).split(' ')[0]);
              csvRows.push([(frame.timestamp / 1000).toFixed(3), ...activeSignalMeta.map(s => lastKnownValues[s.name])].join(","));
            }
          }
        });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        await exportFile(csvRows.join("\n"), `${isAuto ? 'AUTOSAVE_' : 'OSM_'}DECODED_${stamp}.csv`, 'text/csv');
      } catch (e) { console.error(e); } finally { if (!isAuto) setIsSavingDecoded(false); }
    }, 50);
  }, [frames, library, exportFile]);

  const handleNewFrame = useCallback((id: string, dlc: number, data: string[], hwTimestamp?: number) => {
    // Handle System Messages (Always process these regardless of pause)
    if (id.startsWith('SYS:')) {
      if (id.includes('#')) {
        const parts = id.split('#');
        const hId = parts[parts.length - 1].trim();
        if (hId && hId !== hardwareId) {
          setHardwareId(hId);
          setDeviceHistory(prev => {
            if (prev.includes(hId)) return prev;
            const next = [hId, ...prev].slice(0, 10);
            localStorage.setItem('osm_deviceHistory', JSON.stringify(next));
            return next;
          });
          addDebugLog(`HW_RECOGNIZED: ${hId}`);
        }
      }
      return;
    }

    const normId = normalizeId(id, true);
    if (!normId) return;
    
    const prev = frameMapRef.current.get(normId);
    
    // 1. Use the raw hardware timestamp as the primary source of truth
    // 2. Synchronize the session start to the very first frame's hardware clock
    if (sessionStartTimeRef.current === 0 && hwTimestamp !== undefined) {
      sessionStartTimeRef.current = hwTimestamp;
      appStartTimeRef.current = performance.now();
      setIsHwClockSynced(true);
    }

    const appNow = performance.now();
    const arrivalTs = hwTimestamp !== undefined ? (hwTimestamp - sessionStartTimeRef.current) : (appNow - (appStartTimeRef.current || appNow));
    const latency = hwTimestamp !== undefined ? (appNow - appStartTimeRef.current) - (hwTimestamp - sessionStartTimeRef.current) : 0;
    
    // 3. Transparent Jitter Reduction (Clock Recovery)
    // We don't "limit" the data, we just "re-align" it to the most likely periodic grid
    // to compensate for BLE connection interval jitter (e.g. 7.5ms - 30ms bursts).
    let smoothedTimestamp = arrivalTs;
    let period = 0;

    if (prev) {
      const rawPeriod = arrivalTs - prev.timestamp;
      
      // If we have a hardware timestamp from the ESP32, we trust it 100%
      // Otherwise, we apply jitter reduction for arrival-based timestamps
      const isHwTimestamp = hwTimestamp !== undefined;
      
      if (isHwTimestamp) {
        smoothedTimestamp = arrivalTs;
        period = rawPeriod;
      } else {
        const isBurst = rawPeriod < 2; // Less than 2ms is likely a BLE burst
        
        if (isBurst && prev.periodMs > 0) {
          smoothedTimestamp = prev.timestamp + prev.periodMs;
        } else {
          // Update our period estimate using a very light EMA
          const alpha = 0.05; 
          period = prev.periodMs === 0 ? rawPeriod : (prev.periodMs * (1 - alpha) + rawPeriod * alpha);
          
          const drift = Math.abs(smoothedTimestamp - arrivalTs);
          if (drift > 50) smoothedTimestamp = arrivalTs;
        }
      }
    }

    const newFrame: CANFrame = {
      id: `0x${formatIdForDisplay(normId)}`, dlc,
      data: data.map(d => d.toUpperCase().trim()), 
      timestamp: Number(smoothedTimestamp.toFixed(3)), 
      absoluteTimestamp: Date.now(),
      direction: 'Rx',
      count: (prev?.count || 0) + 1,
      periodMs: Number((period || (arrivalTs - (prev?.timestamp || arrivalTs))).toFixed(2)),
      transportLatency: latency > 0 ? Number(latency.toFixed(1)) : 0
    };

    // Always update internal state for data consistency
    frameMapRef.current.set(normId, newFrame);
    
    allFramesRef.current.push(newFrame);
    
    // Efficient buffer management: Only prune when we exceed the limit by 10%
    // to avoid O(N) shift() operations on every frame.
    const limit = 1000000; 
    if (allFramesRef.current.length > limit + 10000) {
      allFramesRef.current = allFramesRef.current.slice(-limit);
    }

    // Only update UI-bound pending frames if not paused
    if (!isPaused) {
      pendingFramesRef.current.push(newFrame);
    }
  }, [isPaused, hardwareId, addDebugLog]);

  // Native BLE Bridge Callbacks
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).onNativeBleData = (data: string) => {
        const arrivalTime = performance.now();
        bleBufferRef.current += data;
        if (bleBufferRef.current.includes('\n')) {
          const lines = bleBufferRef.current.split('\n');
          bleBufferRef.current = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            
            if (trimmed.startsWith('TS:')) {
              const javaTs = parseFloat(trimmed.split(':')[1]);
              if (!isNaN(javaTs)) {
                if (javaTimeOffsetRef.current === null) {
                  javaTimeOffsetRef.current = performance.now() - javaTs;
                }
                currentBatchTimestampRef.current = javaTs + javaTimeOffsetRef.current;
              }
              continue;
            }

            if (trimmed.startsWith('SYS:')) {
              handleNewFrame(trimmed, 0, [], arrivalTime);
              continue;
            }
            
            const parts = trimmed.split('#');
            if (parts.length >= 3) {
              const id = parts[0];
              const dlc = parseInt(parts[1]);
              let dataParts = parts[2].split(',');
              
              // Support for "Serial Process" - Hardware Level Timestamping
              // If the ESP32 sends a 4th field (micros), we prioritize it over the phone's arrival time
              let frameHwTimestamp = currentBatchTimestampRef.current;
              
              // Check if TS: is accidentally in the data parts (some firmware versions do this)
              const tsIndex = dataParts.findIndex(p => p.startsWith('TS:'));
              if (tsIndex !== -1) {
                const tsPart = dataParts[tsIndex];
                const tsVal = parseFloat(tsPart.split(':')[1]);
                if (!isNaN(tsVal)) {
                  frameHwTimestamp = tsVal;
                }
                // Remove the TS part from data
                dataParts = dataParts.filter((_, i) => i !== tsIndex);
              }

              if (parts.length >= 4) {
                const esp32Micros = parseInt(parts[3]);
                if (!isNaN(esp32Micros)) {
                  // Convert ESP32 micros to milliseconds
                  frameHwTimestamp = esp32Micros / 1000.0;
                }
              }
              
              handleNewFrame(id, dlc, dataParts, frameHwTimestamp);
            }
          }
        }
      };

      (window as any).onNativeBleStatus = (status: ConnectionStatus, deviceName?: string) => {
        addDebugLog(`NATIVE_CALLBACK: Status=${status}, Device=${deviceName || 'N/A'}`);
        setBridgeStatus(status);
        
        // Clear timeout on any status change from native
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }

        if (status === 'connected') {
          setHwStatus('active');
          if (deviceName) setHardwareId(deviceName);
          // Reset session start - will be anchored to the first frame's HW clock
          sessionStartTimeRef.current = 0; 
          setIsHwClockSynced(false);
          addDebugLog(`NATIVE_BLE: Connected to ${deviceName || 'Device'}. Waiting for first frame...`);
          sendHardwareCommand("ID?");
        } else if (status === 'disconnected' || status === 'error') {
          setHwStatus('offline');
          setHardwareId(null);
          loggedHardwareRef.current = null;
        }
      };

      (window as any).onNativeBleLog = (msg: string) => addDebugLog(`NATIVE: ${msg}`);
    }

    return () => {
      delete (window as any).onNativeBleData;
      delete (window as any).onNativeBleStatus;
      delete (window as any).onNativeBleLog;
    };
  }, [handleNewFrame, addDebugLog]);

  const connectWebBluetooth = async () => {
    if (!(navigator as any).bluetooth) { 
      setBridgeStatus('error'); 
      addDebugLog("ERROR: Web Bluetooth not supported in this browser.");
      return; 
    }
    
    try {
      // 1. Check for location permission (often required for BLE scanning)
      if ('permissions' in navigator) {
        const status = await navigator.permissions.query({ name: 'geolocation' as any });
        if (status.state === 'denied') {
          addDebugLog("WARN: Location permission is denied. BLE scanning may fail.");
        }
      }

      // Ensure previous device is cleared
      if (webBluetoothDeviceRef.current) {
        try {
          if (webBluetoothDeviceRef.current.gatt.connected) {
            await webBluetoothDeviceRef.current.gatt.disconnect();
          }
        } catch (e) {}
        webBluetoothDeviceRef.current = null;
      }

      setBridgeStatus('connecting');
      addDebugLog("BLE: Requesting device selector...");
      
      const device = await (navigator as any).bluetooth.requestDevice({ 
        filters: [
          { namePrefix: 'OSM' },
          { namePrefix: 'CAN' },
          { namePrefix: 'ESP32' },
          { namePrefix: 'UART' }
        ],
        optionalServices: OPTIONAL_SERVICES 
      }).catch(async (err: any) => {
        if (err.name === 'NotFoundError') throw err;
        addDebugLog("BLE: Filter failed, showing all devices...");
        return await (navigator as any).bluetooth.requestDevice({ 
          acceptAllDevices: true,
          optionalServices: OPTIONAL_SERVICES 
        });
      });

      addDebugLog(`BLE: Selected ${device.name || 'Device'}. Connecting to GATT...`);
      webBluetoothDeviceRef.current = device;
      
      device.addEventListener('gattserverdisconnected', () => { 
        if (keepReadingRef.current) {
          addDebugLog("BLE: Unexpected disconnect. Attempting auto-reconnect...");
          setTimeout(() => {
            if (view === 'live' && bridgeStatus !== 'connected') connectWebBluetooth();
          }, 2000);
        } else {
          setBridgeStatus('disconnected'); 
          setHwStatus('offline'); 
          addDebugLog("BLE: Disconnected.");
        }
      });

      // Connection with retry logic
      let server = null;
      for (let i = 0; i < 3; i++) {
        try {
          server = await device.gatt.connect();
          break;
        } catch (e) {
          if (i === 2) throw e;
          addDebugLog(`BLE: Connection attempt ${i+1} failed, retrying...`);
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      addDebugLog("BLE: GATT Connected. Discovering Services...");
      
      // Attempt to find any of the supported UART services
      let service = null;
      const servicesToTry = [UART_SERVICE_UUID, HM10_SERVICE_UUID, "49535343-fe7d-4ae5-8fa9-9fafd205e455"];
      
      for (const uuid of servicesToTry) {
        try {
          service = await server.getPrimaryService(uuid);
          if (service) {
            addDebugLog(`BLE: Service ${uuid.substring(0, 8)} found.`);
            break;
          }
        } catch (e) {}
      }

      if (!service) {
        addDebugLog("BLE: Standard services not found, searching all...");
        const allServices = await server.getPrimaryServices();
        service = allServices.find((s: any) => 
          s.uuid.toLowerCase().includes('ffe0') || 
          s.uuid.toLowerCase().includes('6e40') ||
          s.uuid.toLowerCase().includes('dfb0')
        );
      }

      if (!service) throw new Error("No compatible UART service found.");

      addDebugLog("BLE: Discovering Characteristics...");
      const characteristics = await service.getCharacteristics();
      
      let txChar = characteristics.find((c: any) => c.properties.notify || c.properties.indicate);
      let rxChar = characteristics.find((c: any) => c.properties.write || c.properties.writeWithoutResponse);

      if (!txChar) throw new Error("TX Characteristic not found.");

      addDebugLog("BLE: Enabling Data Stream...");
      await txChar.startNotifications();
      txChar.addEventListener('characteristicvaluechanged', (event: any) => {
        const arrivalTime = performance.now();
        const value = event.target.value;
        const chunk = new TextDecoder().decode(value);
        
        // Robust line parsing
        bleBufferRef.current += chunk;
        const lines = bleBufferRef.current.split(/\r?\n/);
        bleBufferRef.current = lines.pop() || "";
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          
          if (trimmed.startsWith('SYS:')) {
            handleNewFrame(trimmed, 0, [], arrivalTime);
          } else {
            const parts = trimmed.split('#');
            if (parts.length >= 3) {
              const id = parts[0];
              const dlc = parseInt(parts[1]);
              const dataParts = parts[2].split(',');
              const hwTs = parts.length >= 4 ? parseFloat(parts[3]) : arrivalTime;
              handleNewFrame(id, dlc, dataParts, hwTs);
            }
          }
        }
      });

      if (rxChar) bleRxCharacteristicRef.current = rxChar;
      
      keepReadingRef.current = true;
      setFrames([]); 
      setLatestFrames({}); 
      frameMapRef.current.clear();
      allFramesRef.current = [];
      sessionStartTimeRef.current = performance.now();
      setHardwareId(device.name || 'OSM-BT-LINK');
      setBridgeStatus('connected'); 
      setHwStatus('active');
      
      // Send handshake
      setTimeout(() => sendHardwareCommand("ID?"), 100);
      addDebugLog("BLE: Link established successfully.");

    } catch (err: any) { 
      addDebugLog(`BLE_ERROR: ${err.message}`);
      setBridgeStatus('error');
      // Auto-reset to disconnected after 3 seconds so user can try again
      setTimeout(() => setBridgeStatus('disconnected'), 3000);
    }
  };

  const disconnectHardware = useCallback(async () => {
    // Log disconnection if we had a hardware ID
    if (hardwareId && user && sessionId) {
      authService.logHardwareIdentification(user, hardwareId, sessionId, 'N/A', 'DISCONNECTED').catch(() => {});
    }

    keepReadingRef.current = false;
    setHardwareId(null);
    loggedHardwareRef.current = null; // Clear log ref to allow re-logging on next connection
    if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
    Object.values(schedulesRef.current).forEach(clearInterval);
    schedulesRef.current = {};
    setActiveSchedules({});
    if (serialWriterRef.current) { try { serialWriterRef.current.releaseLock(); } catch(e){} serialWriterRef.current = null; }
    if (serialReaderRef.current) { try { await serialReaderRef.current.cancel(); } catch (e) {} }
    if (serialPortRef.current) { try { await serialPortRef.current.close(); } catch (e) {} serialPortRef.current = null; }
    if (webBluetoothDeviceRef.current?.gatt.connected) {
      try {
        await webBluetoothDeviceRef.current.gatt.disconnect();
      } catch (e) {
        console.warn("Error during disconnect:", e);
      }
    }
    webBluetoothDeviceRef.current = null;
    if ((window as any).NativeBleBridge) (window as any).NativeBleBridge.disconnectBle();
    setBridgeStatus('disconnected'); setHwStatus('offline'); setIsSimulated(false);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const currentCount = allFramesRef.current.length;
      setMsgPerSec(currentCount - lastFrameCountRef.current);
      lastFrameCountRef.current = currentCount;
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (pendingFramesRef.current.length > 0) {
        const batch = [...pendingFramesRef.current];
        pendingFramesRef.current = [];
        
        // Update Latest Frames (the grid) - always update this for real-time monitoring
        const latest: Record<string, CANFrame> = {};
        batch.forEach(f => latest[normalizeId(f.id.replace('0x', ''), true)] = f);
        setLatestFrames(prev => ({ ...prev, ...latest }));

        // Update Trace List (the scrolling list)
        setFrames(prev => {
          const next = [...prev, ...batch];
          // Keep UI buffer small (1000 frames) as requested for "less load"
          return next.length > 1000 ? next.slice(-1000) : next;
        });
      }
    }, 16); // 16ms cycle (60fps) for fluent processing
    return () => clearInterval(interval);
  }, []);

  // Hardware Identification Logging
  useEffect(() => {
    if (hardwareId && user && sessionId && loggedHardwareRef.current !== hardwareId) {
      loggedHardwareRef.current = hardwareId;
      
      const logHardware = async () => {
        setSyncStatus('syncing');
        let location = "Unknown";
        try {
          if ("geolocation" in navigator) {
            addDebugLog("GEO: Requesting current position...");
            // Use a shorter timeout for faster background activity
            const pos = await Promise.race([
              new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { 
                  timeout: 2000, 
                  enableHighAccuracy: false,
                  maximumAge: 300000 // Use cached position up to 5 mins old
                });
              }),
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error("GEO_TIMEOUT")), 2500))
            ]) as GeolocationPosition;
            location = `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
            addDebugLog(`GEO: Success - ${location}`);
          } else {
            addDebugLog("GEO: Not supported by browser.");
          }
        } catch (e: any) {
          addDebugLog(`GEO_ERROR: ${e.message || 'Unknown error'}`);
          location = "Permission Denied / Timeout";
        }

        addDebugLog(`CLOUD_SYNC: Registering ${hardwareId} [Session: ${sessionId?.substring(0, 8)}] at ${location}...`);
        
        try {
          await authService.logHardwareIdentification(user, hardwareId, sessionId || 'N/A', location);
          addDebugLog(`CLOUD_SYNC: ${hardwareId} logged successfully.`);
          setSyncStatus('success');
        } catch (err) {
          addDebugLog(`CLOUD_SYNC_ERROR: Failed to log hardware.`);
          setSyncStatus('error');
        }
      };
      
      logHardware();
    }
  }, [hardwareId, user, sessionId]);

  const handleManualSync = useCallback(() => {
    if (!hardwareId || !user || !sessionId) return;
    loggedHardwareRef.current = null; // Force re-log
    setHardwareId(prev => prev ? `${prev} ` : null); // Tiny state change to trigger useEffect
    setTimeout(() => setHardwareId(prev => prev ? prev.trim() : null), 50);
  }, [hardwareId, user, sessionId]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('osm_currentUser');
    localStorage.removeItem('osm_sid');
    setUser(null);
    setSessionId(null);
    setView('home');
    disconnectHardware();
  }, [disconnectHardware]);

  // Session Heartbeat: Detects if account is logged in elsewhere
  useEffect(() => {
    if (!user || !sessionId) return;

    const checkSession = async () => {
      // Skip session conflict check for admin users to allow multiple device access
      if (isAdmin) return;

      try {
        const remoteSid = await authService.fetchRemoteSessionId(user.email);
        // If remote session exists and doesn't match local one, force logout
        if (remoteSid && remoteSid !== "NOT_FOUND" && remoteSid !== "ERROR" && remoteSid !== sessionId) {
          addDebugLog("SESSION_CONFLICT: Account logged in on another device.");
          alert("SESSION_CONFLICT: Your account has been logged in on another device. You will be logged out.");
          handleLogout();
        }
      } catch (e) {
        console.warn("Heartbeat failed", e);
      }
    };

    // Initial check after 2 seconds to avoid race condition with login sync
    const initialTimeout = setTimeout(checkSession, 2000);
    const interval = setInterval(checkSession, 15000); // Check every 15 seconds
    
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [user, sessionId, handleLogout, addDebugLog]);

  if (!user) return <AuthScreen onAuthenticated={(u, s) => { localStorage.setItem('osm_currentUser', JSON.stringify(u)); localStorage.setItem('osm_sid', s); setUser(u); setSessionId(s); }} />;

  return (
    <div className="h-full w-full font-inter flex flex-col min-h-0 overflow-hidden bg-white">
      {showInstallOverlay && <PWAInstallOverlay onInstall={handleInstallClick} onDismiss={() => setShowInstallOverlay(false)} />}

      {view === 'home' ? (
        <div className="flex-1 w-full flex flex-col items-center justify-center bg-white px-6 relative overflow-hidden">
          <div className="bg-indigo-600 p-6 rounded-[32px] text-white shadow-2xl mb-12 animate-bounce"><Cpu size={64} /></div>
          <h1 className="text-4xl md:text-8xl font-orbitron font-black text-slate-900 uppercase text-center">OSM <span className="text-indigo-600">LIVE</span></h1>
          <button onClick={() => setView('select')} className="w-full max-w-xs mt-12 py-6 bg-indigo-600 text-white rounded-3xl font-orbitron font-black uppercase shadow-2xl transition-all active:scale-95">Launch HUD</button>
        </div>
      ) : view === 'select' ? (
        <FeatureSelector onSelect={setView} onLogout={handleLogout} />
      ) : (
        /* LIVE HARDWARE SESSION */
        <div className="flex-1 w-full flex flex-col overflow-hidden">
          {bridgeStatus !== 'connected' ? (
            <div className="h-full flex flex-col">
              <header className="h-16 md:h-20 bg-white border-b flex items-center justify-between px-4 md:px-8 shrink-0 z-[110] shadow-sm">
                <div className="p-2 text-slate-200"><Menu size={24} /></div> {/* Disabled Menu icon for consistency */}
                <div className="flex-1 flex flex-col items-center min-w-0">
                  <h2 className="text-[10px] md:text-[12px] font-orbitron font-black text-slate-400 uppercase tracking-[0.1em] truncate">HARDWARE_BRIDGE_TERMINAL</h2>
                </div>
                <button onClick={() => setView('select')} className="p-2 hover:bg-slate-100 rounded-xl transition-all active:scale-95 text-slate-600"><X size={24} /></button>
              </header>
              <div className="flex-1 overflow-y-auto">
                <ConnectionPanel 
                  status={bridgeStatus} hardwareMode={hardwareMode} 
                  onConnect={() => {
                    if (bridgeStatus === 'connecting' || bridgeStatus === 'connected') {
                      addDebugLog("LINK_GUARD: Connection already in progress or active.");
                      return;
                    }
                    loggedHardwareRef.current = null; // Reset log ref on every manual connect click
                    setSyncStatus('idle');
                    
                    // Connection Timeout Guard: Reset status if stuck in 'connecting'
                    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
                    connectionTimeoutRef.current = setTimeout(() => {
                      setBridgeStatus(prev => {
                        if (prev === 'connecting') {
                          addDebugLog("LINK_GUARD: Connection timed out. Resetting status.");
                          return 'disconnected';
                        }
                        return prev;
                      });
                      connectionTimeoutRef.current = null;
                    }, 15000);

                    // Background Activity: Pre-sync session to cloud immediately
                    if (user && sessionId) {
                      authService.syncSessionToCloud(user.email, user.userName, sessionId).catch(() => {});
                    }

                    if ((window as any).NativeBleBridge) {
                      addDebugLog("NATIVE_BLE: Triggering startBleLink...");
                      setBridgeStatus('connecting'); 
                      // Use requestAnimationFrame to ensure UI updates before heavy native call
                      requestAnimationFrame(() => {
                        try {
                          (window as any).NativeBleBridge.startBleLink();
                        } catch (err) {
                          addDebugLog(`ERROR: Native bridge call failed: ${err}`);
                          setBridgeStatus('error');
                          if (connectionTimeoutRef.current) {
                            clearTimeout(connectionTimeoutRef.current);
                            connectionTimeoutRef.current = null;
                          }
                        }
                      });
                    } else {
                      // Reduced delay for web bluetooth trigger
                      connectWebBluetooth().finally(() => {
                        if (connectionTimeoutRef.current) {
                          clearTimeout(connectionTimeoutRef.current);
                          connectionTimeoutRef.current = null;
                        }
                      });
                    }
                  }} 
                  onDisconnect={disconnectHardware} 
                  onRequestHardwareId={() => sendHardwareCommand("ID?")}
                  debugLog={debugLog} 
                  isAdmin={isAdmin} onStartSimulation={startSimulation}
                  hardwareId={hardwareId}
                  deviceHistory={deviceHistory}
                  syncStatus={syncStatus}
                  onManualSync={handleManualSync}
                />
              </div>
            </div>
          ) : (
            <LiveDashboard 
              status={bridgeStatus} frames={frames} library={library} latestFrames={latestFrames} onDisconnect={disconnectHardware}
              isSimulated={isSimulated} isHwClockSynced={isHwClockSynced}
              onSendMessage={handleSendMessage} onScheduleMessage={handleScheduleMessage} onStopMessage={handleStopMessage} activeSchedules={activeSchedules}
              isPaused={isPaused} isSaving={isSaving} autoSaveEnabled={autoSaveEnabled} onToggleAutoSave={() => setAutoSaveEnabled(!autoSaveEnabled)}
              onClearTrace={() => { 
                setFrames([]); 
                allFramesRef.current = [];
                frameMapRef.current.clear();
                hasTriggeredAutoSaveRef.current = false; 
                lastFrameCountRef.current = 0; 
              }} onSaveTrace={() => handleSaveTrace(false)}
              onSaveDecoded={() => handleSaveDecoded(false)} isSavingDecoded={isSavingDecoded}
              msgPerSec={msgPerSec}
              showBufferWarning={allFramesRef.current.length > 950000}
              onCloseWarning={() => {}}
              syncStatus={syncStatus}
              onManualSync={handleManualSync}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default App;

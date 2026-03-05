
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Play, Pause, Cpu, ArrowLeft, Activity, Bluetooth, Zap, BarChart3, Database, LogOut, ExternalLink, LayoutDashboard, ShieldCheck, Settings2, Smartphone, Tablet, Monitor, LineChart as ChartIcon, Info, HelpCircle, AlertTriangle, Send, X, Menu } from 'lucide-react';
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
import { normalizeId, formatIdForDisplay, decodeSignal, cleanMessageName } from '@/utils/decoder';
import { User, authService } from '@/services/authService';
import { generateMockPacket } from '@/utils/canSim';

const MAX_FRAME_LIMIT = 1000000; 
const BATCH_UPDATE_INTERVAL = 60; 
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
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingDecoded, setIsSavingDecoded] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [msgPerSec, setMsgPerSec] = useState(0);
  const lastFrameCountRef = useRef(0);
  const hasTriggeredAutoSaveRef = useRef(false);

  const [bridgeStatus, setBridgeStatus] = useState<ConnectionStatus>('disconnected');
  const [hwStatus, setHwStatus] = useState<HardwareStatus>('offline');
  const [hardwareId, setHardwareId] = useState<string | null>(null);
  const loggedHardwareRef = useRef<string | null>(null);

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
  const frameMapRef = useRef<Map<string, CANFrame>>(new Map());
  const pendingFramesRef = useRef<CANFrame[]>([]);
  const bleBufferRef = useRef<string>("");
  const serialPortRef = useRef<any>(null);
  const serialReaderRef = useRef<any>(null);
  const serialWriterRef = useRef<any>(null);
  const webBluetoothDeviceRef = useRef<any>(null);
  const bleRxCharacteristicRef = useRef<any>(null);
  const keepReadingRef = useRef(false);

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
    setIsSimulated(true);
    setBridgeStatus('connected');
    setHwStatus('active');
    setHardwareId('SIM-OSM-BT-01');
    setFrames([]); 
    setLatestFrames({}); 
    frameMapRef.current.clear();
    sessionStartTimeRef.current = performance.now();
    
    simulationIntervalRef.current = setInterval(() => {
      if (isPaused) return;
      const mockFrame = generateMockPacket(frameMapRef.current, sessionStartTimeRef.current);
      frameMapRef.current.set(normalizeId(mockFrame.id.replace('0x', ''), true), mockFrame);
      pendingFramesRef.current.push(mockFrame);
    }, 50); // 20Hz Simulation
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

  const exportFile = useCallback(async (data: string, fileName: string, mimeType: string = 'text/plain') => {
    const android = (window as any).AndroidInterface;
    if (android && android.saveFileWithPicker) {
      android.saveFileWithPicker(data, fileName, mimeType);
    } else if (android && android.saveFile) {
      android.saveFile(data, fileName);
    } else if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: mimeType === 'text/plain' ? 'CAN Trace File' : 'Telemetry CSV', accept: { [mimeType]: [fileName.endsWith('.trc') ? '.trc' : '.csv'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(data);
        await writable.close();
      } catch (e: any) {}
    } else {
      const blob = new Blob([data], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = fileName;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 100);
    }
  }, []);

  const handleSaveTrace = useCallback(async (isAuto: boolean = false) => {
    if (frames.length === 0) return;
    if (!isAuto) setIsSaving(true);
    setTimeout(async () => {
      try {
        const firstFrame = frames[0];
        const startDate = new Date(firstFrame.absoluteTimestamp);
        const excelSerialDate = (startDate.getTime() / (1000 * 60 * 60 * 24)) + 25569.0;
        let content = ";$FILEVERSION=2.0\n";
        content += `;$STARTTIME=${excelSerialDate.toFixed(10)}\n`;
        content += ";$COLUMNS=N,O,T,I,d,l,D\n;\n";
        const rows = frames.map((f, i) => {
          const msgNum = (i + 1).toString().padStart(7, ' ');
          const timeOffset = (f.timestamp).toFixed(3).padStart(13, ' ');
          const id = f.id.replace('0x', '').toUpperCase().padStart(8, ' ');
          const rxtx = f.direction.padStart(2, ' ');
          const dlc = f.dlc.toString().padStart(1, ' ');
          const dataBytes = f.data.map(d => d.padStart(2, '0').toUpperCase()).join(' ');
          return `${msgNum} ${timeOffset} DT ${id} ${rxtx} ${dlc}  ${dataBytes}`;
        });
        content += rows.join('\n') + '\n';
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        await exportFile(content, `${isAuto ? 'AUTOSAVE_' : 'OSM_'}TRACE_${stamp}.trc`, 'text/plain');
      } catch (e) { console.error(e); } finally { if (!isAuto) setIsSaving(false); }
    }, 50);
  }, [frames, exportFile]);
  
  const handleSaveDecoded = useCallback(async (isAuto: boolean = false) => {
    if (frames.length === 0) return;
    if (!isAuto) setIsSavingDecoded(true);
    setTimeout(async () => {
      try {
        const idToDbcMap = new Map<string, DBCMessage>();
        Object.entries(library.database).forEach(([decId, msg]) => idToDbcMap.set(normalizeId(decId), msg as DBCMessage));
        const uniqueIdsInTrace = new Set<string>();
        frames.slice(-50000).forEach(f => uniqueIdsInTrace.add(normalizeId(f.id.replace('0x', ''), true)));
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
        frames.slice(-50000).forEach((frame) => {
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

  const handleNewFrame = useCallback((id: string, dlc: number, data: string[]) => {
    if (isPaused) return;
    
    // Handle System Messages
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
    const nowPerf = performance.now();
    const newFrame: CANFrame = {
      id: `0x${formatIdForDisplay(normId)}`, dlc,
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

  // Native BLE Bridge Callbacks
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).onNativeBleData = (data: string) => {
        bleBufferRef.current += data;
        if (bleBufferRef.current.includes('\n')) {
          const lines = bleBufferRef.current.split('\n');
          bleBufferRef.current = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('SYS:')) {
              handleNewFrame(trimmed, 0, []);
              continue;
            }
            const parts = trimmed.split('#');
            if (parts.length >= 3) handleNewFrame(parts[0], parseInt(parts[1]), parts[2].split(','));
          }
        }
      };

      (window as any).onNativeBleStatus = (status: ConnectionStatus, deviceName?: string) => {
        addDebugLog(`NATIVE_CALLBACK: Status=${status}, Device=${deviceName || 'N/A'}`);
        setBridgeStatus(status);
        if (status === 'connected') {
          setHwStatus('active');
          if (deviceName) setHardwareId(deviceName);
          sessionStartTimeRef.current = performance.now();
          addDebugLog(`NATIVE_BLE: Connected to ${deviceName || 'Device'}. Requesting ID...`);
          // Use a slightly longer delay to ensure React has finished re-rendering the view
          setTimeout(() => {
            addDebugLog("NATIVE_BLE: Sending ID? command...");
            sendHardwareCommand("ID?");
          }, 1500);
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
      addDebugLog("BLE: Requesting device selector (Filtering for OSM hardware)...");
      
      // Prioritize OSM devices but allow others if needed
      const device = await (navigator as any).bluetooth.requestDevice({ 
        filters: [
          { namePrefix: 'OSM' },
          { namePrefix: 'CAN' },
          { namePrefix: 'ESP32' }
        ],
        optionalServices: OPTIONAL_SERVICES 
      }).catch(async (err: any) => {
        // Fallback to all devices if the filter fails or user wants something else
        if (err.name === 'NotFoundError') throw err;
        addDebugLog("BLE: Filter failed, showing all devices...");
        return await (navigator as any).bluetooth.requestDevice({ 
          acceptAllDevices: true,
          optionalServices: OPTIONAL_SERVICES 
        });
      });

      addDebugLog(`BLE: Selected ${device.name || 'Unknown Device'}`);
      webBluetoothDeviceRef.current = device;
      device.addEventListener('gattserverdisconnected', () => { 
        setBridgeStatus('disconnected'); 
        setHwStatus('offline'); 
        addDebugLog("BLE: Device disconnected.");
      });
      addDebugLog("BLE: Connecting to GATT Server...");
      const server = await device.gatt.connect();
      addDebugLog("BLE: GATT Connected. Discovering Services...");
      await new Promise(r => setTimeout(r, 1200)); // Increased delay for mobile stability
      
      let service;
      try {
        // Try Nordic NUS first
        service = await server.getPrimaryService(UART_SERVICE_UUID);
        addDebugLog("BLE: NUS Service Found.");
      } catch (e) {
        addDebugLog("BLE: NUS Service not found. Trying HM-10...");
        try {
          service = await server.getPrimaryService(HM10_SERVICE_UUID);
          addDebugLog("BLE: HM-10 Service Found.");
        } catch (e2) {
          if (!device.gatt.connected) {
            throw new Error("GATT_LOCK: Connection dropped by OS. Please UNPAIR the device from System Settings and try again.");
          }
          addDebugLog("ERROR: No compatible UART Service found (NUS/HM-10).");
          const allServices = await server.getPrimaryServices();
          allServices.forEach((s: any) => addDebugLog(` - Service: ${s.uuid}`));
          throw new Error("Required UART Service not found on this device.");
        }
      }

      addDebugLog("BLE: Discovering Characteristics...");
      let txChar;
      let rxChar;
      
      try {
        if (service.uuid.toLowerCase() === UART_SERVICE_UUID.toLowerCase()) {
          txChar = await service.getCharacteristic(TX_CHAR_UUID);
          try { rxChar = await service.getCharacteristic(RX_CHAR_UUID); } catch(e) { addDebugLog("BLE: RX Char not found in NUS."); }
        } else {
          // HM-10 uses the same UUID for both TX and RX usually
          txChar = await service.getCharacteristic("0000ffe1-0000-1000-8000-00805f9b34fb");
          rxChar = txChar;
        }
      } catch (e) {
        addDebugLog("ERROR: Characteristic discovery failed.");
        throw e;
      }

      addDebugLog("BLE: Starting Notifications...");
      await txChar.startNotifications();
      txChar.addEventListener('characteristicvaluechanged', (event: any) => {
        const chunk = new TextDecoder().decode(event.target.value);
        bleBufferRef.current += chunk;
        if (bleBufferRef.current.includes('\n')) {
          const lines = bleBufferRef.current.split('\n');
          bleBufferRef.current = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('SYS:')) {
              handleNewFrame(trimmed, 0, []);
              continue;
            }
            const parts = trimmed.split('#');
            if (parts.length >= 3) handleNewFrame(parts[0], parseInt(parts[1]), parts[2].split(','));
          }
        }
      });

      if (rxChar) {
        bleRxCharacteristicRef.current = rxChar;
        addDebugLog("BLE: Bi-directional link active.");
      } else {
        addDebugLog("BLE: Read-only mode active.");
      }
      setFrames([]); setLatestFrames({}); frameMapRef.current.clear();
      sessionStartTimeRef.current = performance.now();
      setHardwareId(device.name || 'BT-DEVICE');
      setBridgeStatus('connected'); setHwStatus('active'); setIsSimulated(false);
      
      // Request ID from hardware
      setTimeout(() => sendHardwareCommand("ID?"), 500);
    } catch (err: any) { 
      addDebugLog(`BLE_ERROR: ${err.message}`);
      setBridgeStatus('disconnected'); 
    }
  };

  const disconnectHardware = useCallback(async () => {
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
      const currentCount = frames.length;
      setMsgPerSec(currentCount - lastFrameCountRef.current);
      lastFrameCountRef.current = currentCount;
    }, 1000);
    return () => clearInterval(interval);
  }, [frames.length]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (pendingFramesRef.current.length > 0) {
        const batch = [...pendingFramesRef.current];
        pendingFramesRef.current = [];
        setFrames(prev => {
          const next = [...prev, ...batch];
          return next.length > MAX_FRAME_LIMIT ? next.slice(-MAX_FRAME_LIMIT) : next;
        });
        const latest: Record<string, CANFrame> = {};
        batch.forEach(f => latest[normalizeId(f.id.replace('0x', ''), true)] = f);
        setLatestFrames(prev => ({ ...prev, ...latest }));
      }
    }, BATCH_UPDATE_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Hardware Identification Logging
  useEffect(() => {
    if (hardwareId && user && sessionId && loggedHardwareRef.current !== hardwareId) {
      loggedHardwareRef.current = hardwareId;
      
      const logHardware = async () => {
        addDebugLog(`CLOUD_SYNC: Registering ${hardwareId}...`);
        let location = "Unknown";
        try {
          if ("geolocation" in navigator) {
            addDebugLog("GEO: Requesting current position...");
            // Use a race to prevent hanging if geolocation is unresponsive
            const pos = await Promise.race([
              new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { 
                  timeout: 6000, 
                  enableHighAccuracy: false,
                  maximumAge: 60000 
                });
              }),
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error("GEO_TIMEOUT")), 7000))
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
        
        try {
          await authService.logHardwareIdentification(user, hardwareId, sessionId, location);
          addDebugLog(`CLOUD_SYNC: ${hardwareId} logged successfully.`);
        } catch (err) {
          addDebugLog(`CLOUD_SYNC_ERROR: Failed to log hardware.`);
        }
      };
      
      logHardware();
    }
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
                    if ((window as any).NativeBleBridge) {
                      addDebugLog("NATIVE_BLE: Triggering startBleLink...");
                      (window as any).NativeBleBridge.startBleLink();
                    } else {
                      connectWebBluetooth();
                    }
                  }} 
                  onDisconnect={disconnectHardware} 
                  onRequestHardwareId={() => sendHardwareCommand("ID?")}
                  debugLog={debugLog} 
                  isAdmin={isAdmin} onStartSimulation={startSimulation}
                  hardwareId={hardwareId}
                  deviceHistory={deviceHistory}
                />
              </div>
            </div>
          ) : (
            <LiveDashboard 
              status={bridgeStatus} frames={frames} library={library} latestFrames={latestFrames} onDisconnect={disconnectHardware}
              isSimulated={isSimulated}
              onSendMessage={handleSendMessage} onScheduleMessage={handleScheduleMessage} onStopMessage={handleStopMessage} activeSchedules={activeSchedules}
              isPaused={isPaused} isSaving={isSaving} autoSaveEnabled={autoSaveEnabled} onToggleAutoSave={() => setAutoSaveEnabled(!autoSaveEnabled)}
              onClearTrace={() => { setFrames([]); hasTriggeredAutoSaveRef.current = false; lastFrameCountRef.current = 0; }} onSaveTrace={() => handleSaveTrace(false)}
              onSaveDecoded={() => handleSaveDecoded(false)} isSavingDecoded={isSavingDecoded}
              msgPerSec={msgPerSec}
              showBufferWarning={frames.length > 950000}
              onCloseWarning={() => setFrames(prev => prev.slice(-500000))}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default App;


export interface CANFrame {
  id: string; // Hex ID
  dlc: number;
  data: string[]; // Array of hex strings ["00", "FF", ...]
  timestamp: number; // Relative to session start (ms)
  absoluteTimestamp: number; // Unix epoch (ms) for RTC
  direction: 'Rx' | 'Tx';
  count: number;
  periodMs: number;
  isSimulated?: boolean;
}

export interface DBCSignal {
  name: string;
  startBit: number;
  length: number;
  isLittleEndian: boolean;
  isSigned: boolean;
  scale: number;
  offset: number;
  min: number;
  max: number;
  unit: string;
}

export interface DBCMessage {
  name: string;
  dlc: number;
  signals: Record<string, DBCSignal>;
}

export type DBCDatabase = Record<string, DBCMessage>;

export interface ConversionLibrary {
  id: string;
  name: string;
  database: DBCDatabase;
  lastUpdated: number;
}

export interface SignalAnalysis {
  summary: string;
  detectedProtocols: string[];
  anomalies: string[];
  recommendations: string;
  sources: any[];
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type HardwareStatus = 'offline' | 'searching' | 'active' | 'fault';
export type LoggingStatus = 'idle' | 'logging' | 'paused' | 'stopped';

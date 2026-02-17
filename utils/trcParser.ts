import { CANFrame } from '../types';

/**
 * Adaptive PCAN-View Trace Parser
 * Handles multiple versions (v1.1, v2.0) by detecting column offsets dynamically.
 */
export function parseTrcFile(content: string): CANFrame[] {
  const lines = content.split('\n');
  const frames: CANFrame[] = [];
  let lineCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip headers and comments
    if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('$')) continue;

    const parts = trimmed.split(/\s+/);
    if (parts.length < 5) continue;

    // Sniff the column layout by finding the Direction marker (Rx or Tx)
    // In v1.1 (Image 1), Rx/Tx is usually the "Type" at index 2.
    // In v2.0 (Image 2), Rx/Tx is a separate column at index 4.
    const rxTxIndex = parts.findIndex(p => p === 'Rx' || p === 'Tx');
    
    if (rxTxIndex === -1) continue;

    let id = "";
    let dlc = 0;
    let data: string[] = [];
    let timestamp = parseFloat(parts[1]);

    if (rxTxIndex === 2) {
      // Version 1.1 Layout (e.g., 1) 60.8 Rx 10281050 8 0F 00...)
      id = parts[3];
      dlc = parseInt(parts[4]);
      data = parts.slice(5, 5 + dlc);
    } else if (rxTxIndex === 4) {
      // Version 2.0 Layout (e.g., 1 3172153.400 DT 12A180AB Rx 8 13 88...)
      id = parts[3];
      dlc = parseInt(parts[5]);
      data = parts.slice(6, 6 + dlc);
    } else {
      // Fallback/Generic Heuristic
      // If DLC is valid (0-8) at index 5, use v2.0 style, else try v1.1
      const testDlc = parseInt(parts[5]);
      if (!isNaN(testDlc) && testDlc <= 8) {
        id = parts[3];
        dlc = testDlc;
        data = parts.slice(6, 6 + dlc);
      } else {
        id = parts[3];
        dlc = parseInt(parts[4]);
        data = parts.slice(5, 5 + dlc);
      }
    }

    // Clean hex suffixes if present (e.g., 1234h -> 1234)
    if (id.toUpperCase().endsWith('H')) {
      id = id.substring(0, id.length - 1);
    }

    if (id && !isNaN(dlc)) {
      frames.push({
        id: `0x${id.toUpperCase()}`,
        dlc,
        data: data.map(d => d.toUpperCase()),
        timestamp, // Original offset in ms
        absoluteTimestamp: Date.now(),
        direction: parts[rxTxIndex] as 'Rx' | 'Tx',
        count: ++lineCount,
        periodMs: 0
      });
    }
  }

  return frames;
}

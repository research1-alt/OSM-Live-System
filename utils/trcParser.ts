import { CANFrame } from '../types';
import { normalizeId } from './decoder';

/**
 * Adaptive PCAN-View Trace Parser
 * Handles multiple versions (v1.1, v2.0) by detecting column offsets dynamically.
 */
export function parseTrcFile(content: string): CANFrame[] {
  const lines = content.split('\n');
  const frames: CANFrame[] = [];
  const lastFrameById = new Map<string, CANFrame>();
  let isVersion2 = false;
  let lineCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect version from header
    if (trimmed.startsWith(';$FILEVERSION=')) {
      isVersion2 = trimmed.includes('2.0');
      continue;
    }

    // Skip other headers and comments
    if (trimmed.startsWith(';') || trimmed.startsWith('$')) continue;

    const parts = trimmed.split(/\s+/);
    if (parts.length < 5) continue;

    // Sniff the column layout by finding the Direction marker (Rx or Tx)
    // In v1.1 (Image 1), Rx/Tx is usually the "Type" at index 2.
    // In v2.0 (Image 2), Rx/Tx is a separate column at index 4.
    const rxTxIndex = parts.findIndex(p => p === 'Rx' || p === 'Tx');
    
    if (rxTxIndex === -1) continue;

    let timestamp = parseFloat(parts[1]);
    
    // PCAN TRC v2.0 uses seconds. v1.1 uses milliseconds.
    // If we couldn't detect version, use a heuristic.
    const useSeconds = isVersion2 || (timestamp < 1000000 && parts[1].includes('.') && timestamp < 10000);
    
    if (useSeconds) {
      timestamp *= 1000;
    }

    let id = "";
    let dlc = 0;
    let data: string[] = [];

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
      const normId = normalizeId(id, true);
      
      // Calculate period based on previous frame with same ID
      const prev = lastFrameById.get(normId);
      let periodMs = 0;
      
      if (prev) {
        const rawPeriod = timestamp - prev.timestamp;
        const burstCount = (prev as any)._burstCount || 1;
        const burstStartTime = (prev as any)._burstStartTime || prev.timestamp;

        if (rawPeriod > 0.5 || burstCount > 20) {
          // Gap detected, calculate average of previous burst
          const totalTime = timestamp - burstStartTime;
          periodMs = totalTime / burstCount;
          
          // For TRC files, we don't need EMA smoothing as much, but let's use a light one
          if (prev.periodMs > 0) {
            periodMs = (prev.periodMs * 0.7) + (periodMs * 0.3);
          }
          
          // Reset burst tracking
          (prev as any)._burstCount = 1;
          (prev as any)._burstStartTime = timestamp;
        } else {
          // Part of a burst
          periodMs = prev.periodMs; // Keep previous period during burst
          (prev as any)._burstCount = burstCount + 1;
          (prev as any)._burstStartTime = burstStartTime;
        }
      } else {
        // First frame
      }
      
      const frame: CANFrame = {
        id: `0x${id.toUpperCase()}`,
        normId,
        dlc,
        data: data.map(d => d.toUpperCase()),
        timestamp, // Original offset in ms
        absoluteTimestamp: Date.now(),
        direction: parts[rxTxIndex] as 'Rx' | 'Tx',
        count: ++lineCount,
        periodMs: Number(periodMs.toFixed(2))
      };
      
      // Transfer burst state to the new frame object for the next iteration
      if (prev) {
        (frame as any)._burstCount = (prev as any)._burstCount;
        (frame as any)._burstStartTime = (prev as any)._burstStartTime;
      } else {
        (frame as any)._burstCount = 1;
        (frame as any)._burstStartTime = timestamp;
      }

      frames.push(frame);
      lastFrameById.set(normId, frame);
    }
  }

  return frames;
}

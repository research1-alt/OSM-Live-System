
import { CANFrame } from '../types';

/**
 * HEX IDs as they appear on the bus.
 * Our decoder will normalize these to match the DBC keys.
 */
const CAN_IDS = [
  { id: "1827FF81", interval: 100 }, // Odo
  { id: "1038FF50", interval: 500 }, // Batt Error
  { id: "18305040", interval: 500 }, // MCU Error
  { id: "10281050", interval: 100 }, // IPC Status
  { id: "18FF0360", interval: 100 }, // Battery Info
  { id: "142EFF90", interval: 50 },  // IPC Capacity
  { id: "14244050", interval: 200 }, // Cell Info
  { id: "18265040", interval: 100 }, // Thermal
  { id: "18275040", interval: 20 }   // Dynamics (Fast)
];

let lastSimulatedTime: Record<string, number> = {};

export const resetSimulationState = () => {
  lastSimulatedTime = {};
};

export const generateMockPacket = (prevFrames: Map<string, CANFrame>, sessionStartTime: number): CANFrame[] => {
  const now = performance.now();
  const dueFrames: CANFrame[] = [];
  
  CAN_IDS.forEach(entry => {
    const id = entry.id;
    if (!lastSimulatedTime[id]) {
      lastSimulatedTime[id] = now;
      dueFrames.push(createMockFrame(id, now, entry.interval, prevFrames, sessionStartTime));
    } else {
      let catchUpCount = 0;
      while (now - lastSimulatedTime[id] >= entry.interval && catchUpCount < 10) {
        lastSimulatedTime[id] += entry.interval;
        dueFrames.push(createMockFrame(id, lastSimulatedTime[id], entry.interval, prevFrames, sessionStartTime));
        catchUpCount++;
      }
    }
  });

  return dueFrames;
};

function createMockFrame(id: string, timestamp: number, interval: number, prevFrames: Map<string, CANFrame>, sessionStartTime: number): CANFrame {
  const absNow = Date.now();
  const prev = prevFrames.get(id);
  const dlc = 8;
  const data = Array.from({ length: dlc }, () => "00");

  if (id === "10281050") { // SOC/IPC
    data[0] = Math.floor(40 + Math.random() * 60).toString(16);
    data[1] = "4A";
  } else if (id === "14244050") { // Cells
    data[0] = "2A"; data[1] = "0D";
    data[4] = "34"; data[5] = "0D";
  } else if (id === "142EFF90") { // Capacity
    data[6] = "C1"; data[7] = "13";
    data[0] = "F2"; data[1] = "01";
  } else if (id === "18265040") { // Thermal
    data[0] = "25"; data[1] = "40"; data[6] = "12";
  } else if (id === "18275040") { // RPM
    data[0] = "D0"; data[1] = "07";
  } else if (id === "1038FF50" || id === "18305040") {
    if (Math.random() > 0.95) data[0] = "01"; 
  }

  return {
    id: `0x${id}`,
    dlc,
    data,
    timestamp: timestamp - sessionStartTime,
    absoluteTimestamp: absNow,
    direction: 'Rx',
    count: (prev?.count || 0) + 1,
    periodMs: interval,
    isSimulated: true
  };
}

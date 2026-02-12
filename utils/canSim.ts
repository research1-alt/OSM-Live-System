
import { CANFrame } from '../types';

/**
 * HEX IDs as they appear on the bus.
 * Our decoder will normalize these to match the DBC keys.
 */
const CAN_IDS = [
  "1827FF81", // Odo
  "1038FF50", // Batt Error
  "18305040", // MCU Error
  "10281050", // IPC Status
  "18FF0360", // Battery Info
  "142EFF90", // IPC Capacity
  "14244050", // Cell Info
  "18265040", // Thermal
  "18275040"  // Dynamics
];

export const generateMockPacket = (prevFrames: Map<string, CANFrame>, sessionStartTime: number): CANFrame => {
  const id = CAN_IDS[Math.floor(Math.random() * CAN_IDS.length)];
  const now = Date.now();
  const perfNow = performance.now();
  const prev = prevFrames.get(id);
  
  const dlc = 8;
  const data = Array.from({ length: dlc }, () => "00");

  // Logic to generate somewhat realistic data
  if (id === "10281050") { // SOC/IPC
    data[0] = Math.floor(40 + Math.random() * 60).toString(16); // SOC 40-100%
    data[1] = "4A"; // DTE placeholder
  } else if (id === "14244050") { // Cells
    data[0] = "2A"; data[1] = "0D"; // ~3.37V Max
    data[4] = "34"; data[5] = "0D"; // ~3.38V Min
  } else if (id === "142EFF90") { // Capacity
    data[6] = "C1"; data[7] = "13"; // ~50.57V Pack
    data[0] = "F2"; data[1] = "01"; // ~49.8A Current
  } else if (id === "18265040") { // Thermal
    data[0] = "25"; // 37C
    data[1] = "40"; // 64C - 50 = 14C Motor
    data[6] = "12"; // 18 kmph
  } else if (id === "18275040") { // RPM
    data[0] = "D0"; data[1] = "07"; // 2000 RPM
  } else if (id === "1038FF50" || id === "18305040") {
    // Occasionally simulate a fault (1 in 20 chance)
    if (Math.random() > 0.95) {
      data[0] = "01"; 
    }
  }

  return {
    id: `0x${id}`,
    dlc,
    data,
    timestamp: perfNow - sessionStartTime,
    absoluteTimestamp: now,
    direction: 'Rx',
    count: (prev?.count || 0) + 1,
    periodMs: prev ? Math.round(perfNow - (prev.timestamp + sessionStartTime)) : 0,
    isSimulated: true
  };
};

import { DBCSignal } from '../types.ts';

/**
 * Strips technical prefixes (LV_ID_0x...) and formats underscores to spaces.
 */
export function cleanMessageName(name: string): string {
  if (!name) return "";
  // Removes pattern like "LV_ID_0x18FF0360_" case-insensitively
  return name.replace(/^LV_ID_0x[0-9A-F]+_/i, '').replace(/_/g, ' ').trim();
}

/**
 * Normalizes any ID to a clean Hex string.
 * @param id The raw ID string or number.
 * @param forceHex If true, treats numeric-only strings as Hex (used for Bus data).
 */
export function normalizeId(id: string | number | undefined, forceHex: boolean = false): string {
  if (id === undefined || id === null) return "";
  
  let numericId = 0n;
  
  if (typeof id === 'number') {
    numericId = BigInt(id);
  } else {
    // Clean string: remove 0x, h suffix, and trim
    let str = id.trim().toUpperCase();
    if (str.endsWith('H')) {
      str = str.substring(0, str.length - 1);
      numericId = BigInt('0x' + str);
    } else if (str.startsWith('0X')) {
      numericId = BigInt('0x' + str.substring(2));
    } else if (forceHex) {
      // For hardware bus data, always assume Hex even if it looks decimal
      try {
        numericId = BigInt('0x' + str);
      } catch (e) {
        // Fallback for non-hex characters if any
        return str;
      }
    } else if (/^\d+$/.test(str)) {
      // For DBC/Library keys, if it's all digits, it's usually Decimal
      numericId = BigInt(str);
    } else {
      // Contains A-F, must be Hex
      try {
        numericId = BigInt('0x' + str);
      } catch (e) {
        return str;
      }
    }
  }

  // MASK: 0x1FFFFFFF (29-bit). 
  // This strips hardware flags like 0x80000000 (Extended) or 0x40000000 (Error)
  // while preserving the actual 11-bit or 29-bit CAN Identifier.
  const masked = numericId & 0x1FFFFFFFn;
  return masked.toString(16).toUpperCase();
}

/**
 * Formats a normalized hex string for the UI.
 */
export function formatIdForDisplay(id: string): string {
  const numeric = parseInt(id, 16);
  if (isNaN(numeric)) return id.toUpperCase();
  
  // Standard CAN is 0x7FF or less
  if (numeric <= 0x7FF) {
    return id.toUpperCase().padStart(3, '0');
  } else {
    // Extended/J1939
    return id.toUpperCase().padStart(8, '0');
  }
}

export function decodeSignal(data: string[], signal: DBCSignal): string {
  if (!data || !signal) return "---";
  try {
    const bytes = data.map(hex => parseInt(hex, 16));
    let rawValue = 0n;

    if (signal.isLittleEndian) {
      let val = 0n;
      for (let i = 0; i < signal.length; i++) {
        const bitIndex = signal.startBit + i;
        const byteIdx = Math.floor(bitIndex / 8);
        const bitInByte = bitIndex % 8;
        if (byteIdx >= bytes.length) continue;
        const bit = BigInt((bytes[byteIdx] >> bitInByte) & 1);
        val |= (bit << BigInt(i));
      }
      rawValue = val;
    } else {
      let val = 0n;
      let currentBit = signal.startBit;
      for (let i = 0; i < signal.length; i++) {
        const byteIdx = Math.floor(currentBit / 8);
        const bitInByte = currentBit % 8;
        if (byteIdx >= bytes.length) continue;
        const bit = BigInt((bytes[byteIdx] >> bitInByte) & 1);
        val |= (bit << BigInt(signal.length - 1 - i));
        
        if (currentBit % 8 === 0) {
          currentBit += 15;
        } else {
          currentBit -= 1;
        }
      }
      rawValue = val;
    }

    let value = Number(rawValue);

    if (signal.isSigned) {
      const maxVal = Math.pow(2, signal.length);
      if (value >= maxVal / 2) {
        value -= maxVal;
      }
    }

    const physicalValue = (value * signal.scale) + signal.offset;
    
    if (signal.length === 1 && signal.scale === 1 && signal.offset === 0) {
      return `${Math.round(physicalValue)}${signal.unit ? ' ' + signal.unit : ''}`;
    }
    
    const decimals = signal.scale < 1 ? signal.scale.toString().split('.')[1]?.length || 2 : 1;
    return `${physicalValue.toFixed(decimals)}${signal.unit ? ' ' + signal.unit : ''}`;
  } catch (e) {
    return "ERR";
  }
}

export function decToHex(decId: string | number): string {
  const hex = normalizeId(decId, false);
  return `0x${formatIdForDisplay(hex)}`;
}
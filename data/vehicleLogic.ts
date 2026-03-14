
/**
 * Vehicle CAN Communication & Charging Logic Protocol
 * This file contains technical specifications for Battery, MCU, and Charger interactions.
 */

export const VEHICLE_CAN_PROTOCOL = {
  battery: {
    ksiSignal: {
      id: "10281050",
      name: "Battery KSI Signal",
      description: "Shows Battery ON/OFF status",
      values: {
        0: "Key ON signal OFF (Battery Output = 0)",
        1: "Key ON signal ON (Battery providing output)"
      }
    },
    ids: [
      "10281050",
      "143EFF90",
      "1038FF50",
      "10276050",
      "10276040",
      "14234050",
      "18FF0360",
      "14244050",
      "12A180AA",
      "12A180AB"
    ],
    driveCurrentLogic: {
      id: "14234040",
      messageName: "Battery Drive Current Limit",
      signals: [
        "Battery Drive Current Limit",
        "Battery Regen Current Limit",
        "Battery Drive Live Current",
        "Battery Vehicle Mode"
      ]
    },
    vehicleModeLogic: {
      id: "14234040",
      description: "Battery publishes Vehicle Mode via CAN. MCU changes its operating mode based on this message.",
      modes: {
        0: { 
          name: "Normal", 
          mcuBehavior: "MCU operates in Forward, Boost, Gradient, and Reverse modes" 
        },
        1: { 
          name: "Forward – Economy", 
          mcuBehavior: "If MCU is in Forward, Boost, or Gradient mode, it immediately switches to Forward Economy mode" 
        },
        2: { 
          name: "Forward – Limphome", 
          mcuBehavior: "If MCU is in Forward, Boost, or Gradient mode, it immediately switches to Forward Limphome mode" 
        }
      },
      importantNote: "Reverse mode is NOT affected by Vehicle Mode. Reverse continues operating normally regardless of battery mode."
    }
  },
  mcu: {
    description: "MCU sends CAN messages only after the MCU powers ON.",
    ids: [
      "18275040",
      "18265040",
      "1826FF81",
      "18305040",
      "18276020",
      "18276030",
      "1827FF81"
    ],
    behavior: {
      charging: "MCU does NOT turn ON during charging.",
      powerOn: "Once the battery provides output power, the MCU receives power (12V / 48V). After MCU powers ON, it starts transmitting its CAN messages."
    }
  },
  charger: {
    description: "Charger and Battery Handshake process.",
    ids: [
      "12A0AA80",
      "12A0AA81",
      "12A0AA82",
      "12A0AA83",
      "12A0AA84"
    ],
    handshakeProcess: "Charger sends CAN messages to Battery for handshaking. Battery receives and responds. Once successful, charging starts."
  },
  chargingProcess: {
    batteryIdsDuringCharging: ["12A180AA", "12A180AB"],
    chargerIdsDuringCharging: ["12A0AA80", "12A0AA81", "12A0AA82", "12A0AA83", "12A0AA84"]
  },
  operationFlow: {
    keyOn: [
      "Driver turns vehicle key ON",
      "Battery publishes CAN ID 10281050",
      "KSI signal changes from 0 to 1",
      "Battery provides output power",
      "MCU receives power and turns ON",
      "MCU starts transmitting CAN messages"
    ]
  }
};


import React, { useState, useMemo } from 'react';
import { X, Copy, Check, Info, Cpu, Cable, Bluetooth, Zap, ChevronRight } from 'lucide-react';

interface ESP32SetupGuideProps {
  onClose: () => void;
  baudRate: number;
}

const ESP32SetupGuide: React.FC<ESP32SetupGuideProps> = ({ onClose, baudRate: initialBaudRate }) => {
  const [copied, setCopied] = useState(false);
  const [firmwareType, setFirmwareType] = useState<'hybrid' | 'serial' | 'ble'>('hybrid');
  const [baudRate, setBaudRate] = useState(initialBaudRate);
  const [canBitrate, setCanBitrate] = useState<'250k' | '500k' | '1000k'>('500k');

  const hybridFirmware = useMemo(() => {
    const bitrateConfig = canBitrate === '250k' ? 'TWAI_TIMING_CONFIG_250KBITS()' : 
                         canBitrate === '1000k' ? 'TWAI_TIMING_CONFIG_1MBITS()' : 
                         'TWAI_TIMING_CONFIG_500KBITS()';

    return `#include <Arduino.h>
#include <driver/twai.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// --- CONFIGURATION ---
#define CAN_TX_PIN GPIO_NUM_5
#define CAN_RX_PIN GPIO_NUM_4
#define DEVICE_NAME "OSM-BT-05"

// BLE UUIDs (Standard Serial-over-BLE)
#define SERVICE_UUID           "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHARACTERISTIC_UUID_RX "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHARACTERISTIC_UUID_TX "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"

BLECharacteristic *pTxCharacteristic;
bool deviceConnected = false;

// --- CAN SETUP ---
void initCAN() {
    twai_general_config_t g_config = TWAI_GENERAL_CONFIG_DEFAULT(CAN_TX_PIN, CAN_RX_PIN, TWAI_MODE_NORMAL);
    twai_timing_config_t t_config = ${bitrateConfig}; 
    twai_filter_config_t f_config = TWAI_FILTER_CONFIG_ACCEPT_ALL();

    esp_err_t err = twai_driver_install(&g_config, &t_config, &f_config);
    if (err == ESP_OK) {
        twai_start();
        Serial.println("SYS:CAN_INIT_SUCCESS");
    } else {
        Serial.print("SYS:CAN_INIT_ERROR#");
        Serial.println(err);
    }
}

// --- BLE CALLBACKS ---
class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) { 
        deviceConnected = true; 
        Serial.println("SYS:BLE_CONNECTED");
    };
    void onDisconnect(BLEServer* pServer) { 
        deviceConnected = false;
        Serial.println("SYS:BLE_DISCONNECTED");
        BLEDevice::startAdvertising(); // Restart advertising
    }
};

void handleCommand(String input) {
    input.trim();
    if (input == "ID?") {
        Serial.print("SYS:ID#");
        Serial.println(DEVICE_NAME);
        if (deviceConnected) {
            String msg = "SYS:ID#" + String(DEVICE_NAME) + "\\n";
            pTxCharacteristic->setValue(msg.c_str());
            pTxCharacteristic->notify();
        }
    } 
    else if (input.startsWith("TX#")) {
        // Format: TX#ID#DLC#BYTE1,BYTE2...
        int firstHash = input.indexOf('#');
        int secondHash = input.indexOf('#', firstHash + 1);
        int thirdHash = input.indexOf('#', secondHash + 1);
        
        if (firstHash != -1 && secondHash != -1 && thirdHash != -1) {
            String idStr = input.substring(firstHash + 1, secondHash);
            int dlc = input.substring(secondHash + 1, thirdHash).toInt();
            String dataStr = input.substring(thirdHash + 1);
            
            twai_message_t tx_msg;
            tx_msg.identifier = strtoul(idStr.c_str(), NULL, 16);
            tx_msg.data_length_code = dlc;
            tx_msg.extd = (tx_msg.identifier > 0x7FF) ? 1 : 0;
            tx_msg.rtr = 0;
            
            int byteIdx = 0;
            int startPos = 0;
            int commaPos = dataStr.indexOf(',');
            while (byteIdx < dlc && byteIdx < 8) {
                String b;
                if (commaPos == -1) {
                    b = dataStr.substring(startPos);
                    tx_msg.data[byteIdx++] = (uint8_t)strtoul(b.c_str(), NULL, 16);
                    break;
                } else {
                    b = dataStr.substring(startPos, commaPos);
                    tx_msg.data[byteIdx++] = (uint8_t)strtoul(b.c_str(), NULL, 16);
                    startPos = commaPos + 1;
                    commaPos = dataStr.indexOf(',', startPos);
                }
            }
            twai_transmit(&tx_msg, pdMS_TO_TICKS(10));
        }
    }
}

class MyCharacteristicCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
        std::string value = pCharacteristic->getValue();
        if (value.length() > 0) {
            handleCommand(String(value.c_str()));
        }
    }
};

void setup() {
    Serial.begin(${baudRate});
    Serial.println("SYS:BOOT_START");

    // Initialize BLE
    BLEDevice::init(DEVICE_NAME);
    BLEServer *pServer = BLEDevice::createServer();
    pServer->setCallbacks(new MyServerCallbacks());
    BLEService *pService = pServer->createService(SERVICE_UUID);
    
    pTxCharacteristic = pService->createCharacteristic(CHARACTERISTIC_UUID_TX, BLECharacteristic::PROPERTY_NOTIFY);
    pTxCharacteristic->addDescriptor(new BLE2902());
    
    BLECharacteristic *pRxCharacteristic = pService->createCharacteristic(CHARACTERISTIC_UUID_RX, BLECharacteristic::PROPERTY_WRITE);
    pRxCharacteristic->setCallbacks(new MyCharacteristicCallbacks());

    pService->start();
    BLEDevice::startAdvertising();
    Serial.println("SYS:BLE_INIT_SUCCESS");

    initCAN();
    
    // Broadcast ID on startup
    Serial.print("SYS:ID#");
    Serial.println(DEVICE_NAME);
}

void loop() {
    twai_message_t message;
    
    // 1. RECEIVE FROM CAN -> SEND TO PC (USB & BLE)
    if (twai_receive(&message, 0) == ESP_OK) {
        String output = "";
        output += String(message.identifier, HEX);
        output += "#";
        output += String(message.data_length_code);
        output += "#";
        
        for (int i = 0; i < message.data_length_code; i++) {
            if (message.data[i] < 0x10) output += "0";
            output += String(message.data[i], HEX);
            if (i < message.data_length_code - 1) output += ",";
        }
        
        // Send to USB
        Serial.println(output);

        // Send to BLE (Add newline for app compatibility and handle chunking)
        if (deviceConnected) {
            String bleOutput = output + "\\n";
            int len = bleOutput.length();
            int pos = 0;
            while (pos < len) {
                int chunkLen = (len - pos) > 20 ? 20 : (len - pos);
                pTxCharacteristic->setValue(bleOutput.substring(pos, pos + chunkLen).c_str());
                pTxCharacteristic->notify();
                pos += chunkLen;
                delay(5);
            }
        }
    }

    // 2. RECEIVE FROM PC (USB) -> SEND TO CAN
    if (Serial.available()) {
        String input = Serial.readStringUntil('\\n');
        handleCommand(input);
    }
}`;
  }, [baudRate, canBitrate]);

  const serialFirmware = useMemo(() => {
    return `#include <Arduino.h>
#include "driver/twai.h"

#define CAN_TX_PIN GPIO_NUM_5
#define CAN_RX_PIN GPIO_NUM_4

void setup() {
  Serial.begin(${baudRate});
  twai_general_config_t g_config = TWAI_GENERAL_CONFIG_DEFAULT(CAN_TX_PIN, CAN_RX_PIN, TWAI_MODE_NORMAL);
  twai_timing_config_t t_config = TWAI_TIMING_CONFIG_500KBITS();
  twai_filter_config_t f_config = TWAI_FILTER_CONFIG_ACCEPT_ALL();
  twai_driver_install(&g_config, &t_config, &f_config);
  twai_start();
  Serial.println("SYS: SERIAL_ONLY_ACTIVE");
}

void loop() {
  twai_message_t msg;
  if (twai_receive(&msg, pdMS_TO_TICKS(1)) == ESP_OK) {
    if (!(msg.rtr)) {
      Serial.print(msg.identifier, HEX);
      Serial.print("#");
      Serial.print(msg.data_length_code);
      Serial.print("#");
      for (int i = 0; i < msg.data_length_code; i++) {
        if (msg.data[i] < 0x10) Serial.print("0");
        Serial.print(msg.data[i], HEX);
        if (i < msg.data_length_code - 1) Serial.print(",");
      }
      Serial.println();
    }
  }
}`;
  }, [baudRate]);

  const currentCode = firmwareType === 'hybrid' ? hybridFirmware : serialFirmware;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg">
              <Zap size={20} />
            </div>
            <div>
              <h2 className="text-lg font-orbitron font-black text-slate-900 uppercase tracking-tight">Flash_Firmware</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">ESP32 Tactical Bridge</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="flex gap-4 mb-8">
            <div className="flex-1 space-y-2">
              <label className="text-[9px] font-orbitron font-black text-slate-400 uppercase tracking-widest ml-2">Interface_Type</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => setFirmwareType('hybrid')}
                  className={`flex-1 flex flex-col items-center gap-3 p-4 rounded-3xl border transition-all ${
                    firmwareType === 'hybrid' ? 'bg-indigo-600 border-indigo-700 text-white shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex gap-2">
                    <Cable size={16} />
                    <Bluetooth size={16} />
                  </div>
                  <span className="text-[8px] font-orbitron font-black uppercase">Hybrid_Unified</span>
                </button>
                <button 
                  onClick={() => setFirmwareType('serial')}
                  className={`flex-1 flex flex-col items-center gap-3 p-4 rounded-3xl border transition-all ${
                    firmwareType === 'serial' ? 'bg-indigo-600 border-indigo-700 text-white shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  <Cable size={16} />
                  <span className="text-[8px] font-orbitron font-black uppercase">Serial_Only</span>
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-2">
              <label className="text-[9px] font-orbitron font-black text-slate-400 uppercase tracking-widest ml-2">CAN_Bus_Bitrate</label>
              <div className="flex gap-2">
                {(['250k', '500k', '1000k'] as const).map(rate => (
                  <button 
                    key={rate}
                    onClick={() => setCanBitrate(rate)}
                    className={`flex-1 py-4 rounded-3xl border text-[9px] font-orbitron font-black uppercase transition-all ${
                      canBitrate === rate ? 'bg-emerald-600 border-emerald-700 text-white shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    {rate}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-3xl mb-8 flex items-start gap-4">
             <div className="p-3 bg-white rounded-2xl shadow-sm text-emerald-600">
               <Info size={24} />
             </div>
             <div>
               <h4 className="text-[11px] font-orbitron font-black text-emerald-900 uppercase tracking-widest mb-1">Deployment Guide</h4>
               <p className="text-[10px] text-emerald-700 leading-relaxed">
                 The <b>Hybrid Mode</b> enables both interfaces. You can leave the ESP32 plugged into power and connect to it wirelessly via Bluetooth, or plug it into your computer and use high-speed Serial. The data format remains 100% compatible with both methods.
               </p>
             </div>
          </div>

          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-orbitron font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                Arduino_Source_IDE
              </h3>
              <button onClick={handleCopy} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-orbitron font-black uppercase tracking-widest transition-all shadow-md active:scale-95">
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy_to_Clipboard'}
              </button>
            </div>
            <div className="relative">
                <pre className="p-6 bg-slate-900 rounded-3xl font-mono text-[11px] text-emerald-500/90 overflow-x-auto shadow-2xl h-[450px] custom-scrollbar border border-slate-800">
                {currentCode}
                </pre>
                <div className="absolute top-0 right-0 p-4 pointer-events-none opacity-20">
                    <Zap size={100} className="text-emerald-500" />
                </div>
            </div>
          </section>

          <div className="space-y-4">
             <h4 className="text-[10px] font-orbitron font-black text-slate-400 uppercase tracking-widest">Pin_Layout</h4>
             <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-500">CAN_TX</span>
                    <span className="px-3 py-1 bg-white border border-slate-300 rounded-lg text-indigo-600 font-mono text-[10px] font-bold">GPIO_5</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-500">CAN_RX</span>
                    <span className="px-3 py-1 bg-white border border-slate-300 rounded-lg text-indigo-600 font-mono text-[10px] font-bold">GPIO_4</span>
                </div>
             </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
          <button onClick={onClose} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-orbitron font-black uppercase tracking-widest shadow-xl transition-all hover:bg-indigo-700 active:scale-95 flex items-center gap-3">
            Proceed_to_HUD <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ESP32SetupGuide;

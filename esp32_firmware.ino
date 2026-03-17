#include <Arduino.h>
#include <driver/twai.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// --- CONFIGURATION ---
#define CAN_TX_PIN GPIO_NUM_5
#define CAN_RX_PIN GPIO_NUM_4
#define DEVICE_NAME "OSM-BT-05"

// BLE UUIDs
#define SERVICE_UUID           "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHARACTERISTIC_UUID_RX "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHARACTERISTIC_UUID_TX "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"

BLECharacteristic *pTxCharacteristic;
bool deviceConnected = false;
String bleBuffer = "";
unsigned long lastBleSend = 0;
const int MAX_MTU = 512;

// --- COMMAND HANDLER ---
void handleCommand(String input) {
    input.trim();
    if (input.length() == 0) return;

    if (input == "ID?") {
        String response = "SYS:DEVICE_READY_AS_" + String(DEVICE_NAME) + "\n";
        Serial.print(response);
        if (deviceConnected) {
            pTxCharacteristic->setValue(response.c_str());
            pTxCharacteristic->notify();
        }
    } 
    else if (input.startsWith("TX#")) {
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
            twai_transmit(&tx_msg, pdMS_TO_TICKS(5));
        }
    }
}

// --- BLE CALLBACKS ---
class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) { 
        deviceConnected = true; 
        Serial.println("SYS:BLE_CONNECTED");
        // Request higher MTU for better performance
        pServer->updatePeerMTU(pServer->getConnId(), MAX_MTU);
    };
    void onDisconnect(BLEServer* pServer) { 
        deviceConnected = false;
        bleBuffer = "";
        Serial.println("SYS:BLE_DISCONNECTED");
        BLEDevice::startAdvertising(); 
    }
};

class MyCharacteristicCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
        String value = pCharacteristic->getValue();
        if (value.length() > 0) {
            handleCommand(value);
        }
    }
};

// --- CAN SETUP ---
void initCAN() {
    twai_general_config_t g_config = TWAI_GENERAL_CONFIG_DEFAULT(CAN_TX_PIN, CAN_RX_PIN, TWAI_MODE_NORMAL);
    g_config.rx_queue_len = 128; // Large queue to prevent drops
    twai_timing_config_t t_config = TWAI_TIMING_CONFIG_500KBITS(); 
    twai_filter_config_t f_config = TWAI_FILTER_CONFIG_ACCEPT_ALL();

    if (twai_driver_install(&g_config, &t_config, &f_config) == ESP_OK) {
        twai_start();
        Serial.println("SYS:CAN_INIT_SUCCESS");
    } else {
        Serial.println("SYS:CAN_INIT_FAILED");
    }
}

void setup() {
    Serial.begin(921600);
    Serial.println("SYS:BOOT_START");

    BLEDevice::init(DEVICE_NAME);
    BLEDevice::setMTU(MAX_MTU);
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
    Serial.println("SYS:DEVICE_READY_AS_" + String(DEVICE_NAME));
    bleBuffer.reserve(MAX_MTU);
}

void loop() {
    twai_message_t message;
    
    // Process ALL available CAN messages in a tight loop
    while (twai_receive(&message, 0) == ESP_OK) {
        uint32_t timestamp = micros();
        char frameStr[80];
        int len = 0;
        
        // Build frame string efficiently
        len += sprintf(frameStr + len, "%x#%d#", message.identifier, message.data_length_code);
        for (int i = 0; i < message.data_length_code; i++) {
            len += sprintf(frameStr + len, "%02x%s", message.data[i], (i < message.data_length_code - 1) ? "," : "");
        }
        len += sprintf(frameStr + len, "#%u\n", timestamp);
        
        // Send to Serial immediately
        Serial.print(frameStr);

        // Batch for BLE
        if (deviceConnected) {
            if (bleBuffer.length() + len >= MAX_MTU - 5) {
                pTxCharacteristic->setValue(bleBuffer.c_str());
                pTxCharacteristic->notify();
                bleBuffer = "";
            }
            bleBuffer += frameStr;
        }
    }

    // Periodically flush BLE buffer even if not full (prevents latency for slow messages)
    if (deviceConnected && bleBuffer.length() > 0 && (millis() - lastBleSend > 10)) {
        pTxCharacteristic->setValue(bleBuffer.c_str());
        pTxCharacteristic->notify();
        bleBuffer = "";
        lastBleSend = millis();
    }

    if (Serial.available()) {
        String input = Serial.readStringUntil('\n');
        handleCommand(input);
    }
}

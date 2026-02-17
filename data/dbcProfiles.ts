import { DBCDatabase } from '../types.ts';

/**
 * MASTER DBC DATABASE - OSM PCAN MASTER V8.4 FULL
 * Strictly mapped to provided DBC source text.
 * Endianness: Intel (@1) = isLittleEndian: true, Motorola (@0) = isLittleEndian: false
 */
export const MY_CUSTOM_DBC: DBCDatabase = {
  "2552758145": { // 0x1827FF81
    name: "LV_ID_0x1827FF81_Odo_Meter",
    dlc: 8,
    signals: {
      "Vehicle_Odo_Meter": { name: "Vehicle_Odo_Meter", startBit: 32, length: 32, isLittleEndian: true, isSigned: false, scale: 0.1, offset: 0, min: 0, max: 429496729, unit: "km" }
    }
  },
  "2419654480": { // 0x1038FF50
    name: "LV_ID_0x1038FF50_BattError",
    dlc: 8,
    signals: {
      "Battery_Fault": { name: "Battery_Fault", startBit: 0, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Batt_High_Temp": { name: "Batt_High_Temp", startBit: 1, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Battery_High_Temp_Cut_off": { name: "Battery_High_Temp_Cut_off", startBit: 2, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Battery_Low_Temp": { name: "Battery_Low_Temp", startBit: 3, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Battery_Low_Temp_Cut_off": { name: "Battery_Low_Temp_Cut_off", startBit: 4, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Battery_Over_Voltage_Cut_Off": { name: "Battery_Over_Voltage_Cut_Off", startBit: 5, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Battery_Over_Voltage": { name: "Battery_Over_Voltage", startBit: 6, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Battery_Low_Voltage": { name: "Battery_Low_Voltage", startBit: 7, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Battery_Low_Voltage_Cut_Off": { name: "Battery_Low_Voltage_Cut_Off", startBit: 8, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Output_Voltage_Failure": { name: "Output_Voltage_Failure", startBit: 9, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Battery_Internal_Fault": { name: "Battery_Internal_Fault", startBit: 10, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Postive_Busbar_High_Temperature": { name: "Postive_Busbar_High_Temperature", startBit: 11, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Negative_Busbar_High_Temperature": { name: "Negative_Busbar_High_Temperature", startBit: 12, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Positive_Bus_Over_Temperature": { name: "Positive_Bus_Over_Temperature", startBit: 13, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Negative_Bus_Over_Temperature": { name: "Negative_Bus_Over_Temperature", startBit: 14, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Low_SOC_During_Key_ON": { name: "Low_SOC_During_Key_ON", startBit: 15, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Low_SOC_During_Drive": { name: "Low_SOC_During_Drive", startBit: 16, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Permannet_Dock_Positive_Temp": { name: "Permannet_Dock_Positive_Temp", startBit: 17, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Permannet_Dock_Negative_Temp": { name: "Permannet_Dock_Negative_Temp", startBit: 18, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "TCU_Communication_Failure": { name: "TCU_Communication_Failure", startBit: 19, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "EV_Inverse_Malfunction": { name: "EV_Inverse_Malfunction", startBit: 20, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "EV_Out_Sense_Malfunction": { name: "EV_Out_Sense_Malfunction", startBit: 21, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Battery_Thermal_Runaway_Alert": { name: "Battery_Thermal_Runaway_Alert", startBit: 28, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Battery_Thermal_Runway": { name: "Battery_Thermal_Runway", startBit: 29, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Peak_Current_Warning": { name: "Peak_Current_Warning", startBit: 26, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" }
    }
  },
  "2418544720": { // 0x10281050
    name: "LV_ID_0x10281050_Batt_Live_Statu",
    dlc: 8,
    signals: {
      "State_of_Charger_SOC": { name: "State_of_Charger_SOC", startBit: 0, length: 8, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 100, unit: "%" },
      "Distance_To_Empty_DTE": { name: "Distance_To_Empty_DTE", startBit: 8, length: 8, isLittleEndian: true, isSigned: false, scale: 4, offset: 0, min: 0, max: 1000, unit: "km" },
      "Time_To_Charge": { name: "Time_To_Charge", startBit: 16, length: 8, isLittleEndian: true, isSigned: false, scale: 3, offset: 0, min: 0, max: 765, unit: "Minute" },
      "Battery_Temperature": { name: "Battery_Temperature", startBit: 24, length: 8, isLittleEndian: true, isSigned: true, scale: 1, offset: 0, min: -128, max: 127, unit: "C" },
      "Key_On_Indicator": { name: "Key_On_Indicator", startBit: 34, length: 2, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 3, unit: "" },
      "Battery_Fault_Light": { name: "Battery_Fault_Light", startBit: 36, length: 2, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 3, unit: "" },
      "Total_Battery_Capacity_kWh": { name: "Total_Battery_Capacity_kWh", startBit: 56, length: 8, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 250, unit: "kWh" },
      "Total_Battery_Capacity_Ah": { name: "Total_Battery_Capacity_Ah", startBit: 48, length: 8, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 510, unit: "Ah" },
      "Battery_DOD": { name: "Battery_DOD", startBit: 40, length: 8, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 100, unit: "%" },
      "Battery_Swap_Sucessfully": { name: "Battery_Swap_Sucessfully", startBit: 38, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" }
    }
  },
  "2418499664": { // 0x10276050
    name: "LV_ID_0x10276050_BMS_HWD_SW",
    dlc: 8,
    signals: {
      "Battery_BMS_Soft_Firmware": { name: "Battery_BMS_Soft_Firmware", startBit: 32, length: 32, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 4294967295, unit: "" },
      "Battery_BMS_HWD_Firmware": { name: "Battery_BMS_HWD_Firmware", startBit: 0, length: 32, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 4294967295, unit: "" }
    }
  },
  "2418499648": { // 0x10276040
    name: "LV_ID_0x10276040_Battery_VIN",
    dlc: 8,
    signals: {
      "Battery_VIN_Serial_Number": { name: "Battery_VIN_Serial_Number", startBit: 7, length: 64, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1e+16, unit: "" }
    }
  },
  "2418499632": { // 0x10276030
    name: "LV_ID_0x10276030_MCU_Serial_Number",
    dlc: 8,
    signals: {
      "MCU_Serial_Number": { name: "MCU_Serial_Number", startBit: 7, length: 64, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1e+14, unit: "" }
    }
  },
  "2418499616": { // 0x10276020
    name: "LV_ID_0x10276020_MCU_HWD_SW_SNO",
    dlc: 8,
    signals: {
      "MCU_HARDWARE_NUMBER": { name: "MCU_HARDWARE_NUMBER", startBit: 32, length: 32, isLittleEndian: true, isSigned: false, scale: 2, offset: 0, min: 0, max: 8500000000, unit: "" },
      "MCU_FIRMWARE_NUMBER": { name: "MCU_FIRMWARE_NUMBER", startBit: 0, length: 32, isLittleEndian: true, isSigned: false, scale: 2, offset: 0, min: 0, max: 8500000000, unit: "" }
    }
  },
  "2485338192": { // 0x14234050
    name: "LV_ID_0x14234050_Drive_Limit",
    dlc: 8,
    signals: {
      "Battery_Drive_Current_Live": { name: "Battery_Drive_Current_Live", startBit: 0, length: 16, isLittleEndian: true, isSigned: true, scale: 0.1, offset: 0, min: -3000, max: 3000, unit: "Amp" },
      "Battery_Drive_Current_Limit": { name: "Battery_Drive_Current_Limit", startBit: 16, length: 8, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 250, unit: "Amp" },
      "Battery_Regen_Current_Limit": { name: "Battery_Regen_Current_Limit", startBit: 24, length: 8, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 255, unit: "Amp" },
      "Battery_Vehicle_Mode": { name: "Battery_Vehicle_Mode", startBit: 32, length: 3, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 7, unit: "" },
      "Battery_MaxCurrent_Safety_Limit": { name: "Battery_MaxCurrent_Safety_Limit", startBit: 40, length: 8, isLittleEndian: true, isSigned: false, scale: 2, offset: 0, min: 0, max: 511, unit: "Amp" },
      "Battery_MaxRegen_Current_Safety": { name: "Battery_MaxRegen_Current_Safety", startBit: 48, length: 8, isLittleEndian: true, isSigned: false, scale: 2, offset: 0, min: 0, max: 511, unit: "Amp" }
    }
  },
  "2566849376": { // 0x18FF0360
    name: "LV_ID_0x18FF0360_Battery_Info",
    dlc: 8,
    signals: {
      "Battery_Charging_Cycle": { name: "Battery_Charging_Cycle", startBit: 40, length: 16, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 50000, unit: "Nos" },
      "Battery_State_of_Health_SOH": { name: "Battery_State_of_Health_SOH", startBit: 23, length: 16, isLittleEndian: false, isSigned: false, scale: 0.01, offset: 0, min: 0, max: 100, unit: "%" },
      "Battery_Pre_Charge_Time": { name: "Battery_Pre_Charge_Time", startBit: 0, length: 9, isLittleEndian: false, isSigned: false, scale: 5, offset: 0, min: 0, max: 2500, unit: "ms" },
      "Battery_Pre_Charge_Complete": { name: "Battery_Pre_Charge_Complete", startBit: 1, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Battery_Drive_State": { name: "Battery_Drive_State", startBit: 56, length: 8, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 255, unit: "" }
    }
  },
  "2486108048": { // 0x142EFF90
    name: "LV_ID_0x142EFF90_Batt_Live_Info",
    dlc: 8,
    signals: {
      "Battery_Live_Current": { name: "Battery_Live_Current", startBit: 0, length: 16, isLittleEndian: true, isSigned: true, scale: 0.1, offset: 0, min: 0, max: 3200, unit: "Amp" },
      "Battery_Capacity_Left_Ah": { name: "Battery_Capacity_Left_Ah", startBit: 16, length: 16, isLittleEndian: true, isSigned: false, scale: 0.01, offset: 0, min: 0, max: 320, unit: "Ah" },
      "Battery_Capacity_Left_kWh": { name: "Battery_Capacity_Left_kWh", startBit: 32, length: 16, isLittleEndian: true, isSigned: false, scale: 0.01, offset: 0, min: 0, max: 327, unit: "kWh" },
      "Battery_Live_Voltage": { name: "Battery_Live_Voltage", startBit: 48, length: 16, isLittleEndian: true, isSigned: false, scale: 0.01, offset: 0, min: 0, max: 654, unit: "V" }
    }
  },
  "2485403728": { // 0x14244050
    name: "LV_ID_0x14244050_Cell_Info",
    dlc: 8,
    signals: {
      "Max_Cell_Voltage_Limit": { name: "Max_Cell_Voltage_Limit", startBit: 48, length: 16, isLittleEndian: true, isSigned: false, scale: 0.001, offset: 0, min: 0, max: 65, unit: "V" },
      "Max_Cell_Voltage": { name: "Max_Cell_Voltage", startBit: 0, length: 16, isLittleEndian: true, isSigned: false, scale: 0.001, offset: 0, min: 0, max: 65, unit: "V" },
      "Mini_Cell_Voltage_Limit": { name: "Mini_Cell_Voltage_Limit", startBit: 16, length: 16, isLittleEndian: true, isSigned: false, scale: 0.001, offset: 0, min: 0, max: 65, unit: "V" },
      "Mini_Cell_Voltage": { name: "Mini_Cell_Voltage", startBit: 32, length: 16, isLittleEndian: true, isSigned: false, scale: 0.001, offset: 0, min: 0, max: 65, unit: "V" }
    }
  },
  "2553303104": { // 0x18305040
    name: "LV_ID_0x18305040_MCU_Error",
    dlc: 8,
    signals: {
      "MCU_Controller_Fault": { name: "MCU_Controller_Fault", startBit: 0, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_Controller_Over_Current": { name: "MCU_Controller_Over_Current", startBit: 1, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_Current_Sensor_Fault": { name: "MCU_Current_Sensor_Fault", startBit: 2, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_Precharge_Failed": { name: "MCU_Precharge_Failed", startBit: 3, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_Controller_Severe_Under_Temp": { name: "MCU_Controller_Severe_Under_Temp", startBit: 4, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_Controller_Severe_Over_Temp": { name: "MCU_Controller_Severe_Over_Temp", startBit: 5, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_Severe_B_Plus_OverVoltage": { name: "MCU_Severe_B_Plus_OverVoltage", startBit: 6, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_Servere_KSI_Under_Voltage": { name: "MCU_Servere_KSI_Under_Voltage", startBit: 7, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_Severe_B_Plus_Over_Voltage": { name: "MCU_Severe_B_Plus_Over_Voltage", startBit: 8, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_Severe_KSI_Over_Voltage": { name: "MCU_Severe_KSI_Over_Voltage", startBit: 9, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_Controller_Over_Temp_Cutback": { name: "MCU_Controller_Over_Temp_Cutback", startBit: 10, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_B_Plus_Under_Voltage_Cutback": { name: "MCU_B_Plus_Under_Voltage_Cutback", startBit: 11, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_B_Plus_Over_Voltage_Cutback": { name: "MCU_B_Plus_Over_Voltage_Cutback", startBit: 12, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_5V_Supply_Failure": { name: "MCU_5V_Supply_Failure", startBit: 13, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_Motor_Temp_Hot_Cutback": { name: "MCU_Motor_Temp_Hot_Cutback", startBit: 14, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_Motor_Temp_Sensor_Fault": { name: "MCU_Motor_Temp_Sensor_Fault", startBit: 15, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_Main_Contactor_Open_Short": { name: "MCU_Main_Contactor_Open_Short", startBit: 16, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_SIN_COS_Sensor_Fault": { name: "MCU_SIN_COS_Sensor_Fault", startBit: 17, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_Motor_Phase_Open": { name: "MCU_Motor_Phase_Open", startBit: 18, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_Main_Contactor_Weld": { name: "MCU_Main_Contactor_Weld", startBit: 19, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_Contactor_Did_Not_Close": { name: "MCU_Contactor_Did_Not_Close", startBit: 20, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_Throttle_WiperHigh": { name: "MCU_Throttle_WiperHigh", startBit: 21, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_Throttle_Wiper_Low": { name: "MCU_Throttle_Wiper_Low", startBit: 22, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_EEPROM_Failure": { name: "MCU_EEPROM_Failure", startBit: 23, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_VCL_Run_Time_Error": { name: "MCU_VCL_Run_Time_Error", startBit: 24, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_Motor_Characterisation_Fault": { name: "MCU_Motor_Characterisation_Fault", startBit: 25, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_Encoder_Plus_Count_Fault": { name: "MCU_Encoder_Plus_Count_Fault", startBit: 26, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_Encoder_LOS": { name: "MCU_Encoder_LOS", startBit: 27, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_Brake_Wiper_High": { name: "MCU_Brake_Wiper_High", startBit: 28, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_Brake_Wiper_Low": { name: "MCU_Brake_Wiper_Low", startBit: 29, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_High_Pedal_Disable": { name: "MCU_High_Pedal_Disable", startBit: 30, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_ActiveLowDriverOpenShort": { name: "MCU_ActiveLowDriverOpenShort", startBit: 31, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCUCoil3DriverOpenShort": { name: "MCUCoil3DriverOpenShort", startBit: 32, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_EMBrakeDriverOpenShort": { name: "MCU_EMBrakeDriverOpenShort", startBit: 33, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_SinCosMotorFeedback": { name: "MCU_SinCosMotorFeedback", startBit: 34, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_SupervisorFault": { name: "MCU_SupervisorFault", startBit: 35, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_BadCalibration": { name: "MCU_BadCalibration", startBit: 36, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_PMACCommissioningNeeded": { name: "MCU_PMACCommissioningNeeded", startBit: 37, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_PhasePWMMismatch": { name: "MCU_PhasePWMMismatch", startBit: 38, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_VehicleOverLoad": { name: "MCU_VehicleOverLoad", startBit: 39, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_MotorSevereTempHotCutbck": { name: "MCU_MotorSevereTempHotCutbck", startBit: 40, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_CoilSupply": { name: "MCU_CoilSupply", startBit: 41, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_MisAlignmentErr": { name: "MCU_MisAlignmentErr", startBit: 42, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_InternalHardwareFailure": { name: "MCU_InternalHardwareFailure", startBit: 43, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_OSGeneral": { name: "MCU_OSGeneral", startBit: 44, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "OEM_NoBatteryCAN": { name: "OEM_NoBatteryCAN", startBit: 45, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "OEM_BatterySTOPSignal": { name: "OEM_BatterySTOPSignal", startBit: 46, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_Controller_CompleteFaults": { name: "MCU_Controller_CompleteFaults", startBit: 47, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" }
    }
  },
  "2552692609": { // 0x1826FF81
    name: "LV_ID_0x1826FF81_MCU_VCU_Input",
    dlc: 8,
    signals: {
      "Vehicle_Speed": { name: "Vehicle_Speed", startBit: 48, length: 8, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 255, unit: "km/h" },
      "Vehicle_Drive_Modes": { name: "Vehicle_Drive_Modes", startBit: 56, length: 3, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 7, unit: "" },
      "Vehicle_Brake_Percentage": { name: "Vehicle_Brake_Percentage", startBit: 40, length: 8, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 100, unit: "%" },
      "Vehicle_Throttle_Percntage": { name: "Vehicle_Throttle_Percntage", startBit: 32, length: 8, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 100, unit: "%" },
      "MCU_Regen_Flag": { name: "MCU_Regen_Flag", startBit: 59, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Hill_Hold": { name: "Hill_Hold", startBit: 60, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_Temperature": { name: "MCU_Temperature", startBit: 0, length: 8, isLittleEndian: true, isSigned: false, scale: 1, offset: -50, min: -50, max: 205, unit: "DegC" },
      "Motor_Temperature": { name: "Motor_Temperature", startBit: 8, length: 8, isLittleEndian: true, isSigned: false, scale: 1, offset: -50, min: -50, max: 205, unit: "DegC" },
      "MOTOR_RMS_Current": { name: "MOTOR_RMS_Current", startBit: 16, length: 16, isLittleEndian: true, isSigned: false, scale: 0.1, offset: 0, min: 0, max: 510, unit: "A" }
    }
  },
  "2460002948": { // 0x12A0AA84 - CHG ERROR
    name: "LV_ID_0x12A0AA84_CHG_ERROR",
    dlc: 8,
    signals: {
      "ChargerTemperature": { name: "ChargerTemperature", startBit: 7, length: 8, isLittleEndian: false, isSigned: true, scale: 1, offset: 0, min: -128, max: 127, unit: "C" },
      "ChargerOutputOverVoltage": { name: "ChargerOutputOverVoltage", startBit: 8, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "ChargerOutputOverCurrent": { name: "ChargerOutputOverCurrent", startBit: 9, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "ChargerStartingState": { name: "ChargerStartingState", startBit: 21, length: 2, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 3, unit: "" },
      "ChargerInputUnderVoltage": { name: "ChargerInputUnderVoltage", startBit: 10, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "ChargerTempProtection": { name: "ChargerTempProtection", startBit: 14, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "ChargerHardwareFailure": { name: "ChargerHardwareFailure", startBit: 15, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "ChargerInternalFault": { name: "ChargerInternalFault", startBit: 16, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "ChargerCMDOutofRange": { name: "ChargerCMDOutofRange", startBit: 17, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "ChargerCANTimeout": { name: "ChargerCANTimeout", startBit: 18, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "ChargerBMSMissingMessage": { name: "ChargerBMSMissingMessage", startBit: 19, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "ChargerInputOverVoltage": { name: "ChargerInputOverVoltage", startBit: 11, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "ChargerTemperatureDerating": { name: "ChargerTemperatureDerating", startBit: 12, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "ChargerInputVoltageDerating": { name: "ChargerInputVoltageDerating", startBit: 13, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" }
    }
  },
  "2460002947": { // 0x12A0AA83 - CHG VER
    name: "LV_ID_0x12A0AA83_CHG_VER",
    dlc: 8,
    signals: {
      "ChargerHardware_Version": { name: "ChargerHardware_Version", startBit: 7, length: 32, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 4294967295, unit: "" },
      "ChargerFirmware_Version": { name: "ChargerFirmware_Version", startBit: 39, length: 32, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 4294967295, unit: "" }
    }
  },
  "2460002946": { // 0x12A0AA82 - CHG SRNO
    name: "LV_ID_0x12A0AA82_CHG_SRNO",
    dlc: 8,
    signals: {
      "Charger_Serial_Number": { name: "Charger_Serial_Number", startBit: 7, length: 64, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1e+15, unit: "" }
    }
  },
  "2460057770": { // 0x12A180AA - BMS_MAX_LIMITS_HSK
    name: "LV_ID_0x12A180AA_BMS_MAX_LIMITS_HSK",
    dlc: 8,
    signals: {
      "Batt_Charger_Hand_Shaking": { name: "Batt_Charger_Hand_Shaking", startBit: 7, length: 8, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "Charging_Current_MAXLIMIT": { name: "Charging_Current_MAXLIMIT", startBit: 31, length: 16, isLittleEndian: false, isSigned: false, scale: 0.01, offset: 0, min: 0, max: 163, unit: "A" },
      "Charging_Voltage_MAXLIMIT": { name: "Charging_Voltage_MAXLIMIT", startBit: 15, length: 16, isLittleEndian: false, isSigned: false, scale: 0.1, offset: 0, min: 0, max: 1310, unit: "V" },
      "Emergency_Shutdown": { name: "Emergency_Shutdown", startBit: 40, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" }
    }
  },
  "2460057771": { // 0x12A180AB - BMS_LIVE_REQ
    name: "LV_ID_0x12A180AB_BMS_LIVE_REQ",
    dlc: 8,
    signals: {
      "ChargingRequestVoltage": { name: "ChargingRequestVoltage", startBit: 23, length: 16, isLittleEndian: false, isSigned: false, scale: 0.1, offset: 0, min: 0, max: 6553, unit: "V" },
      "ChargingRequestCurrent": { name: "ChargingRequestCurrent", startBit: 7, length: 16, isLittleEndian: false, isSigned: false, scale: 0.01, offset: 0, min: 0, max: 655, unit: "A" },
      "Charging_On_Off": { name: "Charging_On_Off", startBit: 34, length: 2, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 2, unit: "" },
      "Charging_Activation": { name: "Charging_Activation", startBit: 32, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" }
    }
  },
  "2460002944": { // 0x12A0AA80 - CHG_INFO_HSK
    name: "LV_ID_0x12A0AA80_CHG_INFO_HSK",
    dlc: 8,
    signals: {
      "Charger_Batt_Hand_Shaking": { name: "Charger_Batt_Hand_Shaking", startBit: 7, length: 8, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 127, unit: "" },
      "ChargerMaxVoltageCapability": { name: "ChargerMaxVoltageCapability", startBit: 15, length: 16, isLittleEndian: false, isSigned: false, scale: 0.1, offset: 0, min: 0, max: 818, unit: "V" },
      "ChargerMaxCurrentCapability": { name: "ChargerMaxCurrentCapability", startBit: 31, length: 16, isLittleEndian: false, isSigned: false, scale: 0.1, offset: 0, min: 0, max: 400, unit: "A" },
      "ChargerEmergencyShutdown": { name: "ChargerEmergencyShutdown", startBit: 40, length: 1, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" }
    }
  },
  "2460002945": { // 0x12A0AA81 - CHG_LIVE
    name: "LV_ID_0x12A0AA81_CHG_LIVE",
    dlc: 8,
    signals: {
      "ChargerChargingVoltageLive": { name: "ChargerChargingVoltageLive", startBit: 7, length: 16, isLittleEndian: false, isSigned: false, scale: 0.1, offset: 0, min: 0, max: 1300, unit: "V" },
      "ChargerChargingCurrentLive": { name: "ChargerChargingCurrentLive", startBit: 23, length: 16, isLittleEndian: false, isSigned: false, scale: 0.01, offset: 0, min: 0, max: 160, unit: "A" },
      "ChargerChargingModeStatus": { name: "ChargerChargingModeStatus", startBit: 33, length: 2, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 3, unit: "" }
    }
  },
  "2552647744": { // 0x18265040
    name: "LV_ID_0x18265040_MCU_Motor_Temp",
    dlc: 8,
    signals: {
      "MCU_Controller_Temperature": { name: "MCU_Controller_Temperature", startBit: 0, length: 8, isLittleEndian: true, isSigned: true, scale: 1, offset: 0, min: -128, max: 127, unit: " C" },
      "MCU_Motor_Temperature": { name: "MCU_Motor_Temperature", startBit: 8, length: 8, isLittleEndian: true, isSigned: false, scale: 1, offset: -50, min: -50, max: 205, unit: " C" },
      "sigBrake": { name: "sigBrake", startBit: 40, length: 8, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 100, unit: "%" },
      "sigDriveMode": { name: "sigDriveMode", startBit: 56, length: 3, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 7, unit: "" },
      "sigSpeed": { name: "sigSpeed", startBit: 48, length: 8, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 100, unit: "kmph" },
      "sigThrottle": { name: "sigThrottle", startBit: 32, length: 8, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 100, unit: "%" }
    }
  },
  "2552713280": { // 0x18275040
    name: "LV_ID_0x18275040_MCU_Status",
    dlc: 8,
    signals: {
      "MCU_Motor_RPM": { name: "MCU_Motor_RPM", startBit: 0, length: 16, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 65535, unit: "RPM" },
      "MCU_PrechargerStatus": { name: "MCU_PrechargerStatus", startBit: 32, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_Ignition_Status": { name: "MCU_Ignition_Status", startBit: 33, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" },
      "MCU_Precharge_Capacitance": { name: "MCU_Precharge_Capacitance", startBit: 34, length: 12, isLittleEndian: true, isSigned: false, scale: 0.01, offset: 0, min: 0, max: 40, unit: "mF" },
      "MCU_Capacitor_Voltage_Pre": { name: "MCU_Capacitor_Voltage_Pre", startBit: 16, length: 16, isLittleEndian: true, isSigned: false, scale: 0.1, offset: 0, min: 0, max: 6000, unit: "V" },
      "MCU_Capacitor_Voltage_Post": { name: "MCU_Capacitor_Voltage_Post", startBit: 48, length: 16, isLittleEndian: true, isSigned: false, scale: 0.1, offset: 0, min: 0, max: 6000, unit: "V" },
      "Hill_Hold_Flag": { name: "Hill_Hold_Flag", startBit: 47, length: 1, isLittleEndian: true, isSigned: false, scale: 1, offset: 0, min: 0, max: 1, unit: "" }
    }
  },
  "2437982721": { // 0x1150AA01
    name: "LV_ID_0x1150AA01_TPMS",
    dlc: 8,
    signals: {
      "P1": { name: "TPMS_Tire_Pressure_1", startBit: 7, length: 8, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 255, unit: "psi" },
      "P2": { name: "TPMS_Tire_Pressure_2", startBit: 15, length: 8, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 255, unit: "psi" },
      "P3": { name: "TPMS_Tire_Pressure_3", startBit: 23, length: 8, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 255, unit: "psi" },
      "P4": { name: "TPMS_Tire_Pressure_4", startBit: 31, length: 8, isLittleEndian: false, isSigned: false, scale: 1, offset: 0, min: 0, max: 255, unit: "psi" }
    }
  }
};

export const DEFAULT_LIBRARY_NAME = "OSM_PCAN_MASTER_FULL_V8.4";
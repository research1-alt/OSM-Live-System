
import React from 'react';
import { X, Info, Zap, Battery, Cpu, ShieldAlert, Activity } from 'lucide-react';
import { VEHICLE_CAN_PROTOCOL } from '../data/vehicleLogic';

interface ProtocolModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProtocolModal: React.FC<ProtocolModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[32px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <header className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200">
              <Info size={24} />
            </div>
            <div>
              <h2 className="text-xl font-orbitron font-black text-slate-900 uppercase tracking-tight">Vehicle_Protocol_Reference</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">OSM CAN Communication & Charging Logic</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-xl transition-all active:scale-95 text-slate-400"
          >
            <X size={24} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Battery Section */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 text-indigo-600">
                <Battery size={20} />
                <h3 className="text-sm font-orbitron font-black uppercase tracking-widest">Battery_Systems</h3>
              </div>
              
              <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 space-y-4">
                <div>
                  <h4 className="text-[11px] font-orbitron font-black text-slate-900 uppercase mb-2">KSI_Signal (ID: {VEHICLE_CAN_PROTOCOL.battery.ksiSignal.id})</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(VEHICLE_CAN_PROTOCOL.battery.ksiSignal.values).map(([val, desc]) => (
                      <div key={val} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                        <span className="text-[10px] font-mono font-bold text-indigo-600 block mb-1">VALUE: {val}</span>
                        <p className="text-[9px] text-slate-600 font-medium leading-tight">{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-[11px] font-orbitron font-black text-slate-900 uppercase mb-2">Vehicle_Mode_Logic (ID: 14234040)</h4>
                  <div className="space-y-2">
                    {Object.entries(VEHICLE_CAN_PROTOCOL.battery.vehicleModeLogic.modes).map(([val, data]) => (
                      <div key={val} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex gap-3">
                        <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-mono font-black text-slate-400 border border-slate-100">
                          {val}
                        </div>
                        <div>
                          <span className="text-[10px] font-orbitron font-black text-slate-800 uppercase block">{data.name}</span>
                          <p className="text-[9px] text-slate-500 font-medium leading-tight mt-1">{data.mcuBehavior}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl flex gap-3">
                    <ShieldAlert size={16} className="text-amber-500 shrink-0" />
                    <p className="text-[9px] text-amber-700 font-bold leading-tight uppercase">
                      {VEHICLE_CAN_PROTOCOL.battery.vehicleModeLogic.importantNote}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* MCU Section */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 text-emerald-600">
                <Cpu size={20} />
                <h3 className="text-sm font-orbitron font-black uppercase tracking-widest">MCU_Controller</h3>
              </div>
              
              <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 space-y-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <h4 className="text-[10px] font-orbitron font-black text-slate-900 uppercase mb-2">Power_On_Sequence</h4>
                  <p className="text-[10px] text-slate-600 font-medium leading-relaxed">
                    {VEHICLE_CAN_PROTOCOL.mcu.behavior.powerOn}
                  </p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <h4 className="text-[10px] font-orbitron font-black text-slate-900 uppercase mb-2">Charging_Inhibition</h4>
                  <p className="text-[10px] text-slate-600 font-medium leading-relaxed">
                    {VEHICLE_CAN_PROTOCOL.mcu.behavior.charging}
                  </p>
                </div>

                <div>
                  <h4 className="text-[11px] font-orbitron font-black text-slate-900 uppercase mb-2">MCU_CAN_IDs</h4>
                  <div className="flex flex-wrap gap-2">
                    {VEHICLE_CAN_PROTOCOL.mcu.ids.map(id => (
                      <span key={id} className="px-2 py-1 bg-white border border-slate-200 rounded-md text-[9px] font-mono font-bold text-slate-500">
                        {id}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Charging Section */}
            <section className="space-y-6 md:col-span-2">
              <div className="flex items-center gap-3 text-amber-600">
                <Zap size={20} />
                <h3 className="text-sm font-orbitron font-black uppercase tracking-widest">Charging_Protocol</h3>
              </div>
              
              <div className="bg-amber-50/50 rounded-3xl p-6 border border-amber-100">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2">
                    <h4 className="text-[11px] font-orbitron font-black text-amber-900 uppercase mb-3">Handshake_Process</h4>
                    <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                      {VEHICLE_CAN_PROTOCOL.charger.handshakeProcess}
                    </p>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-[10px] font-orbitron font-black text-amber-900 uppercase mb-2">Charger_IDs</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {VEHICLE_CAN_PROTOCOL.charger.ids.map(id => (
                          <span key={id} className="px-1.5 py-0.5 bg-white border border-amber-200 rounded text-[8px] font-mono font-bold text-amber-600">
                            {id}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-orbitron font-black text-amber-900 uppercase mb-2">Battery_CHG_IDs</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {VEHICLE_CAN_PROTOCOL.chargingProcess.batteryIdsDuringCharging.map(id => (
                          <span key={id} className="px-1.5 py-0.5 bg-white border border-amber-200 rounded text-[8px] font-mono font-bold text-amber-600">
                            {id}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        <footer className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2 text-[9px] font-orbitron font-black text-slate-400 uppercase tracking-widest">
            <Activity size={12} /> System_Protocol_V1.0
          </div>
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-orbitron font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            Acknowledge
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ProtocolModal;

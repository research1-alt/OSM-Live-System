import React from 'react';
import { Bluetooth, Database, ArrowRight, Zap, LineChart, FileText, LogOut } from 'lucide-react';

interface FeatureSelectorProps {
  onSelect: (view: 'live') => void;
  onLogout?: () => void;
}

const FeatureSelector: React.FC<FeatureSelectorProps> = ({ onSelect, onLogout }) => {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center p-6 bg-white overflow-y-auto">
      <div className="max-w-4xl w-full">
        <header className="mb-12 text-center">
          <h2 className="text-[10px] font-orbitron font-black text-indigo-600 uppercase tracking-[0.5em] mb-3">MISSION_SELECT</h2>
          <h3 className="text-3xl md:text-5xl font-orbitron font-black text-slate-900 uppercase">CHOOSE_YOUR_HUD</h3>
        </header>

        <div className="flex justify-center">
          {/* HARDWARE LINK CARD */}
          <button 
            onClick={() => onSelect('live')}
            className="group relative max-w-md w-full bg-white border border-slate-200 rounded-[40px] p-8 md:p-12 text-left hover:border-indigo-500 hover:shadow-2xl transition-all active:scale-95 overflow-hidden shadow-xl"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <Bluetooth size={120} />
            </div>
            
            <div className="p-4 bg-indigo-600 rounded-3xl text-white inline-flex mb-8 shadow-lg group-hover:scale-110 transition-transform">
              <Bluetooth size={32} />
            </div>
            
            <h4 className="text-2xl font-orbitron font-black text-slate-900 uppercase mb-4 tracking-tight flex items-center gap-3">
              Hardware_Link <Zap size={20} className="text-amber-500" />
            </h4>
            
            <p className="text-[11px] text-slate-500 font-bold uppercase leading-relaxed mb-8 opacity-70">
              Connect to ESP32 via Bluetooth for real-time bus telemetry, live trace, and transmit commands.
            </p>
            <div className="flex items-center gap-3 text-[10px] font-orbitron font-black text-indigo-600 uppercase tracking-widest">
              Establish_Stream <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform" />
            </div>
          </button>
        </div>

        <div className="mt-16 flex justify-center relative">
           <div className="flex items-center gap-4 px-6 py-3 bg-slate-50 rounded-2xl border border-slate-100 text-[9px] font-orbitron font-black text-slate-400 uppercase tracking-widest">
              <Zap size={12} className="text-amber-500" /> BUS_PROTOCOL_v8.4_READY
           </div>

           {onLogout && (
             <button 
               onClick={onLogout}
               className="absolute right-0 bottom-0 flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-2xl text-[9px] font-orbitron font-black text-red-500 uppercase tracking-widest hover:bg-red-50 hover:border-red-100 transition-all active:scale-95 shadow-sm"
             >
               <LogOut size={14} /> Logout
             </button>
           )}
        </div>
      </div>
    </div>
  );
};

export default FeatureSelector;
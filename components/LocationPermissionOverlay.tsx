
import React from 'react';
import { MapPin, X, ShieldCheck } from 'lucide-react';

interface LocationPermissionOverlayProps {
  onDismiss: () => void;
}

const LocationPermissionOverlay: React.FC<LocationPermissionOverlayProps> = ({ onDismiss }) => {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onDismiss}></div>
      <div className="relative w-full max-w-sm bg-white rounded-[40px] p-8 shadow-2xl border border-indigo-100 animate-in zoom-in duration-300">
        <div className="w-16 h-16 bg-indigo-100 rounded-3xl flex items-center justify-center text-indigo-600 mb-6 mx-auto">
          <MapPin size={32} className="animate-bounce" />
        </div>
        <h3 className="text-xl font-orbitron font-black text-slate-900 text-center uppercase tracking-tight mb-2">Location Access</h3>
        <p className="text-slate-500 text-center text-sm mb-8 leading-relaxed">
          OSM Live requires location access to log hardware identification with geographic context. Please ensure location is enabled.
        </p>
        <div className="space-y-3">
          <button 
            onClick={onDismiss}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-orbitron font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <ShieldCheck size={18} /> I Understand
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationPermissionOverlay;

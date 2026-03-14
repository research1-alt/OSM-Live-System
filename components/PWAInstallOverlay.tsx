import React from 'react';
import { Download, X, Smartphone, Zap } from 'lucide-react';

interface PWAInstallOverlayProps {
  onInstall: () => void;
  onDismiss: () => void;
}

const PWAInstallOverlay: React.FC<PWAInstallOverlayProps> = ({ onInstall, onDismiss }) => {
  return (
    <div className="fixed bottom-6 left-6 right-6 z-[999] animate-in slide-in-from-bottom-10 fade-in duration-500">
      <div className="max-w-md mx-auto bg-slate-900 border border-indigo-500/30 rounded-[32px] p-6 shadow-2xl overflow-hidden relative group">
        {/* Glow Effect */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-600/20 blur-3xl rounded-full"></div>
        
        <div className="flex items-start gap-4 relative z-10">
          <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
            <Smartphone size={24} />
          </div>
          
          <div className="flex-1">
            <h4 className="text-white font-orbitron font-black text-sm uppercase tracking-wider flex items-center gap-2">
              INSTALL_TACTICAL_HUD <Zap size={12} className="text-amber-400 animate-pulse" />
            </h4>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1 leading-relaxed">
              Add OSM Live to your home screen for high-speed local bus analysis.
            </p>
            
            <div className="mt-4 flex gap-3">
              <button 
                onClick={onInstall}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-orbitron font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2"
              >
                <Download size={14} /> INSTALL_HUD
              </button>
              <button 
                onClick={onDismiss}
                className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl text-[10px] font-orbitron font-black uppercase transition-all"
              >
                DISMISS
              </button>
            </div>
          </div>
          
          <button onClick={onDismiss} className="text-slate-500 hover:text-slate-300">
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallOverlay;
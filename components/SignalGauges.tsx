
import React from 'react';

interface SignalGaugesProps {
  data: { rpm: number; temp: number; throttle: number; timestamp: number }[];
}

const Gauge: React.FC<{ label: string; value: string | number; unit: string; color: string; bgColor: string }> = ({ label, value, unit, color, bgColor }) => (
  <div className={`${bgColor} p-3 rounded-2xl border border-slate-100 flex flex-col items-center justify-center shadow-sm`}>
    <span className="text-slate-400 text-[8px] font-black uppercase tracking-widest mb-1">{label}</span>
    <div className="flex items-baseline gap-1">
      <span className={`text-xl font-orbitron font-black ${color}`}>{value}</span>
      <span className="text-[7px] text-slate-400 font-bold uppercase">{unit}</span>
    </div>
  </div>
);

const SignalGauges: React.FC<SignalGaugesProps> = ({ data }) => {
  const latest = data[data.length - 1] || { rpm: 0, temp: 0, throttle: 0 };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        <Gauge label="Motor Speed" value={Math.round(latest.rpm)} unit="RPM" color="text-indigo-600" bgColor="bg-indigo-50/30" />
        <Gauge label="Core Temp" value={latest.temp.toFixed(1)} unit="°C" color="text-amber-600" bgColor="bg-amber-50/30" />
        <Gauge label="Throttle" value={Math.round(latest.throttle)} unit="%" color="text-emerald-600" bgColor="bg-emerald-50/30" />
      </div>
    </div>
  );
};

export default SignalGauges;


import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Sparkles, Info } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { CANFrame } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIChatPanelProps {
  latestFrames: Record<string, CANFrame>;
}

const AIChatPanel: React.FC<AIChatPanelProps> = ({ latestFrames }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I am your OSM Vehicle Intelligence Assistant. I can help you analyze live CAN data and understand vehicle protocols. How can I assist you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    // Get current frames for context
    const framesContext = Object.values(latestFrames);

    const response = await geminiService.analyzeCanData(userMsg, framesContext);
    
    setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl overflow-hidden border border-slate-200 shadow-xl">
      <header className="bg-slate-50/80 backdrop-blur-md px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100">
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="text-[11px] font-orbitron font-black text-slate-900 uppercase tracking-widest">AI_Intelligence_Hub</h3>
            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">Powered by Gemini 3 Flash</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
          <span className="text-[8px] font-orbitron font-black text-emerald-600 uppercase">System_Ready</span>
        </div>
      </header>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/30"
      >
        {messages.map((msg, i) => (
          <div 
            key={i} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}
          >
            <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                msg.role === 'user' ? 'bg-slate-100 text-slate-600' : 'bg-indigo-600 text-white'
              }`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={`p-4 rounded-2xl text-[11px] leading-relaxed shadow-sm border ${
                msg.role === 'user' 
                  ? 'bg-white border-slate-100 text-slate-800 rounded-tr-none' 
                  : 'bg-indigo-600 text-white border-indigo-500 rounded-tl-none'
              }`}>
                {msg.content}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start animate-pulse">
            <div className="flex gap-3 max-w-[85%]">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <Bot size={16} />
              </div>
              <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-400 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-[9px] font-orbitron font-black uppercase tracking-widest">Analyzing_Bus_Telemetry...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-slate-100">
        <div className="relative flex items-center">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="ASK_ABOUT_CAN_LOGIC..."
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-[11px] font-medium text-slate-800 focus:outline-none focus:border-indigo-500/50 pr-16 transition-all"
          />
          <button 
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="absolute right-2 p-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none"
          >
            <Send size={18} />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[8px] font-orbitron font-black text-slate-300 uppercase tracking-widest px-2">
          <Info size={10} />
          AI has access to Vehicle Protocol Reference and Live Telemetry
        </div>
      </div>
    </div>
  );
};

export default AIChatPanel;

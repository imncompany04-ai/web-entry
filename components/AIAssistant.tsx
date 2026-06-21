
import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Bot, User, Loader2, TrendingUp, ExternalLink, Globe, Lock } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { LoadingEntry, Party, User as UserType, Permission } from '../types';

interface AIAssistantProps {
  entries: LoadingEntry[];
  parties: Party[];
  currentUser: UserType;
}

interface Message {
  id: string; role: 'user' | 'assistant'; text: string; timestamp: number; sources?: { title: string; uri: string }[];
}

const AIAssistant: React.FC<AIAssistantProps> = ({ entries, parties, currentUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ id: 'welcome', role: 'assistant', text: "Hello! I'm Itoli AI. I'm connected and ready to help you analyze your loading logs. How can I assist you?", timestamp: Date.now() }]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const hasAIAccess = currentUser.rights.includes(Permission.USE_AI) || currentUser.rights.includes(Permission.ADMIN_ACCESS);

  useEffect(() => { if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isOpen]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || !hasAIAccess) return;
    const userMessage: Message = { id: Math.random().toString(36).substr(2, 9), role: 'user', text: inputValue, timestamp: Date.now() };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputValue; setInputValue(''); setIsLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const systemInstruction = `You are "Itoli AI", for "Itoli Granito LLP - The Tile Composer". Current Logs: ${JSON.stringify(entries)}. Parties: ${JSON.stringify(parties)}. Be concise.`;
      
      // Use generateContent with Google Search tool as required for recent info
      const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: currentInput, 
        config: { 
          systemInstruction: systemInstruction, 
          tools: [{ googleSearch: {} }] 
        } 
      });

      // Extract sources for google search grounding as per guidelines
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const sources = groundingChunks?.map((chunk: any) => {
        if (chunk.web) {
          return { title: chunk.web.title, uri: chunk.web.uri };
        }
        return null;
      }).filter(Boolean) as { title: string; uri: string }[] | undefined;

      const assistantMessage: Message = { 
        id: Math.random().toString(36).substr(2, 9), 
        role: 'assistant', 
        text: response.text || "No response generated.", 
        timestamp: Date.now(),
        sources: sources
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (e) { 
      console.error(e);
      setMessages(prev => [...prev, { id: 'error', role: 'assistant', text: "Connection issue with Itoli Core.", timestamp: Date.now() }]); 
    } finally { 
      setIsLoading(false); 
    }
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)} className={`fixed bottom-10 right-10 w-16 h-16 bg-black text-white rounded-[24px] shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-90 z-[60] group ${isOpen ? 'scale-0' : 'scale-100'}`}><Sparkles size={28} /></button>
      <div className={`fixed inset-y-0 right-0 w-full sm:w-[500px] bg-white shadow-2xl z-[70] flex flex-col transition-transform duration-500 transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-8 bg-black text-white flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20"><Sparkles size={24} className="text-amber-300" /></div>
            <div><h3 className="font-black text-base uppercase tracking-widest leading-none">Itoli AI</h3><p className="text-[10px] text-white/50 mt-1 uppercase tracking-widest">Enterprise Logistics Intelligence</p></div>
          </div>
          <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X size={24} /></button>
        </div>
        {!hasAIAccess ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center gap-6">
            <div className="w-20 h-20 bg-stone-50 rounded-[32px] flex items-center justify-center text-stone-200"><Lock size={40} /></div>
            <div><h4 className="text-xl font-black text-stone-900 mb-2">Access Locked</h4><p className="text-stone-400 text-sm">You do not have the <span className="font-black text-black">USE_AI</span> permission assigned to your profile. Please contact your administrator.</p></div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-[#faf9f6] custom-scrollbar">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-4 max-w-[90%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${msg.role === 'user' ? 'bg-white border-stone-200 text-stone-400' : 'bg-black border-black text-white'}`}>{msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}</div>
                    <div className={`p-5 rounded-[28px] text-sm font-bold leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-white border border-stone-100 text-stone-800' : 'bg-stone-100 border border-stone-200 text-stone-800'}`}>
                      {msg.text}
                      {/* Render grounding sources as required by guidelines */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-stone-200 space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Sources</p>
                          <div className="flex flex-col gap-2">
                            {msg.sources.map((source, i) => (
                              <a 
                                key={i} 
                                href={source.uri} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="flex items-center gap-2 text-black hover:underline"
                              >
                                <Globe size={12} />
                                <span className="text-[10px] truncate max-w-[200px]">{source.title}</span>
                                <ExternalLink size={10} />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex gap-4 max-w-[90%]">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border bg-black border-black text-white">
                      <Loader2 size={18} className="animate-spin" />
                    </div>
                    <div className="p-5 rounded-[28px] bg-stone-100 border border-stone-200 text-stone-400 text-sm font-bold animate-pulse italic">
                      Analyzing data cluster...
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-8 bg-white border-t border-stone-100">
              <div className="relative">
                <input 
                  type="text" 
                  value={inputValue} 
                  onChange={(e) => setInputValue(e.target.value)} 
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} 
                  placeholder="Ask about daily logs..." 
                  className="w-full pl-6 pr-16 py-5 bg-stone-50 border border-stone-200 rounded-[28px] text-base font-bold focus:ring-8 focus:ring-black/5 transition-all outline-none" 
                  disabled={isLoading}
                />
                <button 
                  onClick={handleSendMessage} 
                  disabled={!inputValue.trim() || isLoading} 
                  className="absolute right-3 top-3 bottom-3 w-12 bg-black text-white rounded-2xl flex items-center justify-center shadow-lg transition-all disabled:opacity-30"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default AIAssistant;

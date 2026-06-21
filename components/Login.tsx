
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Lock, User } from 'lucide-react';
import { User as UserType } from '../types';
import Logo from './Logo';

interface LoginProps {
  onLogin: (user: UserType) => void;
  users: UserType[];
  logoUrl?: string;
  authError: string | null;
  isAuthenticated: boolean;
}

const Login: React.FC<LoginProps> = ({ onLogin, users, logoUrl, authError, isAuthenticated }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      onLogin(user);
    } else {
      setError('Invalid username or password');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafafa] p-4">
      <div className="absolute inset-0 bg-[radial-gradient(rgba(0,0,0,0.03)_1px,transparent_1px)] [background-size:24px_24px] opacity-80" />
      
      <div className="relative w-full max-w-md bg-white border border-stone-200 rounded-[40px] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)] overflow-hidden transform transition-all">
        {/* Glow accent */}
        <div className="absolute -top-16 -left-16 w-32 h-32 bg-stone-100 rounded-full blur-2xl" />
        <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-stone-150 rounded-full blur-2xl" />

        {/* Elegant glass container for logo to ensure compatibility with both light and dark logos */}
        <div className="bg-stone-50 border-b border-stone-200/60 p-12 pb-8 text-center flex flex-col items-center relative z-10">
          <div className="p-4 bg-white rounded-3xl shadow-sm max-w-[280px] w-full flex items-center justify-center border border-stone-200/60">
            <Logo className="w-full h-auto max-h-16 object-contain" src={logoUrl} />
          </div>
          <div className="mt-8 flex flex-col gap-1">
            <p className="text-stone-400 text-[10px] font-black tracking-[0.3em] uppercase">Enterprise Secure Portal</p>
            <div className="h-0.5 w-12 bg-black mx-auto rounded-full mt-2" />
          </div>
        </div>

        <form onSubmit={handleLogin} className="p-10 pt-8 space-y-6 relative z-10">
          {authError && (
            <div className="space-y-3">
              <div className="p-4 bg-stone-100 text-stone-900 text-[10px] rounded-2xl border border-stone-200 font-black uppercase tracking-widest text-center leading-relaxed">
                {authError}
              </div>
              <button 
                type="button"
                onClick={() => setShowSetupGuide(true)}
                className="w-full py-2 text-[9px] font-black text-stone-500 uppercase tracking-widest hover:text-black hover:underline transition-all"
              >
                View Setup Guide
              </button>
            </div>
          )}
          
          {error && (
            <div className="p-4 bg-red-50 text-red-600 text-xs rounded-2xl border border-red-250 font-black uppercase tracking-widest animate-shake text-center">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Personnel ID</label>
              <div className="relative group">
                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-black transition-colors" />
                <input 
                  type="text" 
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-stone-50 border border-stone-200 text-stone-900 placeholder-stone-400 rounded-2xl text-sm focus:outline-none focus:border-black focus:ring-4 focus:ring-black/5 transition-all font-bold"
                  placeholder="Username"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Security Key</label>
              <div className="relative group">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-black transition-colors" />
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-stone-50 border border-stone-200 text-stone-900 placeholder-stone-400 rounded-2xl text-sm focus:outline-none focus:border-black focus:ring-4 focus:ring-black/5 transition-all font-bold"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <button 
            type="submit"
            className="w-full py-5 bg-black hover:bg-stone-900 text-white font-black rounded-2xl shadow-md transition-all hover:scale-[1.01] active:scale-[0.98] uppercase tracking-[0.2em] text-xs mt-4 border border-black"
          >
            Authenticate Access
          </button>

          <div className="text-center pt-2">
            <p className="text-[10px] text-stone-500 font-black uppercase tracking-widest opacity-60">
              Secured Enterprise Environment
            </p>
          </div>
        </form>
      </div>

      {showSetupGuide && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-lg">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden p-10 space-y-8">
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-stone-900 tracking-tight">Firebase Setup Required</h3>
              <p className="text-stone-500 text-xs font-medium">Follow these steps to enable database access:</p>
            </div>

            <div className="space-y-4">
              <div className="flex gap-4 items-start">
                <div className="w-6 h-6 bg-black text-white text-[10px] font-black rounded-lg flex items-center justify-center shrink-0 mt-0.5">1</div>
                <p className="text-[11px] text-stone-600 leading-relaxed">Go to <b>Authentication</b> in your Firebase Console.</p>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-6 h-6 bg-black text-white text-[10px] font-black rounded-lg flex items-center justify-center shrink-0 mt-0.5">2</div>
                <p className="text-[11px] text-stone-600 leading-relaxed">Under <b>Sign-in method</b>, click "Add new provider".</p>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-6 h-6 bg-black text-white text-[10px] font-black rounded-lg flex items-center justify-center shrink-0 mt-0.5">3</div>
                <p className="text-[11px] text-stone-600 leading-relaxed">Enable the <b>Anonymous</b> provider.</p>
              </div>
            </div>

            <button 
              onClick={() => setShowSetupGuide(false)}
              className="w-full py-4 bg-stone-900 text-white font-black rounded-2xl uppercase tracking-widest text-[10px]"
            >
              I've Updated My Settings
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Login;

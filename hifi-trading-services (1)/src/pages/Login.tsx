import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { LogIn, UserPlus, AlertCircle, Loader2, Sun, Moon } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Login() {
  const { signInWithEmail, signUpWithEmail } = useAuth();
  const { theme, toggleTheme } = useTheme();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        if (!name.trim()) throw new Error('Please enter your full name');
        await signUpWithEmail(email, password, name);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn(
      "min-h-screen flex items-center justify-center p-4 font-sans relative transition-colors duration-200",
      theme === 'dark' ? "bg-[#0B0B0E] text-gray-100" : "bg-slate-50 text-slate-900"
    )}>
      {/* Top right theme toggle */}
      <button
        onClick={toggleTheme}
        className={cn(
          "absolute top-6 right-6 p-3 rounded-2xl border transition-all flex items-center gap-2 text-xs font-semibold shadow-xs",
          theme === 'dark' 
            ? "bg-[#15151A] border-[#2A2A35] text-amber-400 hover:bg-[#1F1F28]" 
            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
        )}
      >
        {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-[#1848A0]" />}
        <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
      </button>

      <div className={cn(
        "border rounded-3xl p-8 max-w-md w-full shadow-2xl transition-all",
        theme === 'dark' ? "bg-[#15151A] border-[#2A2A35]" : "bg-white border-slate-200"
      )}>
        <div className="flex flex-col items-center text-center mb-8">
          <div className="mb-4 p-2 bg-[#1848A0]/10 rounded-2xl border border-[#1848A0]/20 inline-block shadow-sm">
            <img src="/logo.jpg" alt="HIFI Trading Services Logo" className="h-16 w-auto object-contain rounded-xl" />
          </div>
          <h1 className={cn("text-2xl font-bold tracking-tight mb-1", theme === 'dark' ? "text-white" : "text-slate-900")}>
            {isSignUp ? 'Create an Account' : 'Welcome Back'}
          </h1>
          <p className={cn("text-sm", theme === 'dark' ? "text-gray-400" : "text-slate-500")}>
            {isSignUp ? 'Sign up to get started with HIFI ONE' : 'Sign in to access your HIFI ONE workspace'}
          </p>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className={cn("block text-xs font-semibold uppercase tracking-wider mb-1.5 ml-1", theme === 'dark' ? "text-gray-400" : "text-slate-600")}>
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className={cn(
                  "w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1848A0] transition-colors",
                  theme === 'dark' 
                    ? "bg-[#0B0B0E] border-[#2A2A35] text-white placeholder-gray-600" 
                    : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
                )}
                required={isSignUp}
              />
            </div>
          )}

          <div>
            <label className={cn("block text-xs font-semibold uppercase tracking-wider mb-1.5 ml-1", theme === 'dark' ? "text-gray-400" : "text-slate-600")}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className={cn(
                "w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1848A0] transition-colors",
                theme === 'dark' 
                  ? "bg-[#0B0B0E] border-[#2A2A35] text-white placeholder-gray-600" 
                  : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
              )}
              required
            />
          </div>

          <div>
            <label className={cn("block text-xs font-semibold uppercase tracking-wider mb-1.5 ml-1", theme === 'dark' ? "text-gray-400" : "text-slate-600")}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={cn(
                "w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1848A0] transition-colors",
                theme === 'dark' 
                  ? "bg-[#0B0B0E] border-[#2A2A35] text-white placeholder-gray-600" 
                  : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
              )}
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#1848A0] hover:bg-[#003880] disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors py-3.5 px-6 rounded-xl font-bold text-sm shadow-lg mt-6"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isSignUp ? (
              <>
                <UserPlus className="w-5 h-5" />
                Create Account
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                Sign In
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800/50 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className={cn("text-xs font-semibold transition-colors", theme === 'dark' ? "text-gray-400 hover:text-white" : "text-slate-500 hover:text-slate-900")}
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}


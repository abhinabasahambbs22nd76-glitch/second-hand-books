"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Lock, KeyRound, AlertCircle, Eye, EyeOff, ShieldCheck } from "lucide-react";

interface AuthLockContextType {
  isAuthenticated: boolean;
  lock: () => void;
  unlock: (pin: string) => boolean;
}

const AuthLockContext = createContext<AuthLockContextType>({
  isAuthenticated: false,
  lock: () => {},
  unlock: () => false,
});

export const useAuthLock = () => useContext(AuthLockContext);

const AUTH_STORAGE_KEY = "pos_shop_authenticated";

export function AuthLockProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  // Form states for lock screen
  const [enteredPin, setEnteredPin] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isShaking, setIsShaking] = useState<boolean>(false);

  // Retrieve expected PIN from environment variable (with fallback to 1234)
  const expectedPin = process.env.NEXT_PUBLIC_SHOP_PIN || "1234";

  // Check stored auth state on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored === "true") {
        setIsAuthenticated(true);
      }
    } catch {
      // localStorage may fail in restricted browser modes
    } finally {
      setIsInitializing(false);
    }

    // Sync across browser tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === AUTH_STORAGE_KEY) {
        setIsAuthenticated(e.newValue === "true");
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const unlock = useCallback(
    (pin: string): boolean => {
      if (pin.trim() === expectedPin.trim()) {
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, "true");
        } catch {}
        setIsAuthenticated(true);
        setErrorMsg(null);
        setEnteredPin("");
        return true;
      } else {
        setErrorMsg("Incorrect PIN / Password. Please try again.");
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 500);
        return false;
      }
    },
    [expectedPin]
  );

  const lock = useCallback(() => {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {}
    setIsAuthenticated(false);
    setEnteredPin("");
    setErrorMsg(null);
  }, []);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    unlock(enteredPin);
  };

  // While checking localStorage on first load, render clean blank background
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-slate-700 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // If not authenticated, render the clean retail Lock Screen
  if (!isAuthenticated) {
    return (
      <AuthLockContext.Provider value={{ isAuthenticated, lock, unlock }}>
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4 font-sans select-none">
          <div
            className={`bg-white border border-gray-200 rounded-md p-6 max-w-sm w-full text-center space-y-5 shadow-sm transition-transform ${
              isShaking ? "translate-x-1" : ""
            }`}
          >
            {/* Shop Logo & Header */}
            <div className="flex flex-col items-center space-y-2">
              <div className="w-12 h-12 rounded bg-white p-1 flex items-center justify-center border border-gray-200">
                <img src="/logo.png" alt="Shop logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900 leading-tight">
                  medicoessentials old book POS
                </h1>
                <p className="text-xs text-gray-500 mt-0.5">DH KUSMS · Register Lock Screen</p>
              </div>
            </div>

            {/* Lock Icon Badge */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold">
              <Lock className="w-3.5 h-3.5" />
              <span>Application Locked</span>
            </div>

            {/* Password / PIN Form */}
            <form onSubmit={handleFormSubmit} className="space-y-3.5 text-left">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Shop PIN / Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoFocus
                    required
                    placeholder="Enter PIN or password..."
                    value={enteredPin}
                    onChange={(e) => {
                      setEnteredPin(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    className="w-full pl-3 pr-9 py-2 bg-gray-50 border border-gray-300 rounded text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-slate-800 font-mono tracking-wider"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                    tabIndex={-1}
                    title={showPassword ? "Hide PIN" : "Show PIN"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {errorMsg && (
                <div className="p-2.5 rounded bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Unlock Button */}
              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Unlock Register</span>
              </button>
            </form>

            <div className="pt-2 border-t border-gray-100 flex items-center justify-center gap-1 text-[11px] text-gray-400">
              <ShieldCheck className="w-3.5 h-3.5 text-gray-400" />
              <span>Protected by Shop Security PIN</span>
            </div>
          </div>
        </div>
      </AuthLockContext.Provider>
    );
  }

  // If authenticated, provide context and render the full app
  return (
    <AuthLockContext.Provider value={{ isAuthenticated, lock, unlock }}>
      {children}
    </AuthLockContext.Provider>
  );
}

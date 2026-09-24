"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  UserPlus,
  Layers,
  ShoppingCart,
  Wallet,
  Database,
} from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  isActive: (pathname: string) => boolean;
  accentColor: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    name: "Book Intake",
    href: "/intake",
    icon: UserPlus,
    isActive: (pathname) => pathname.startsWith("/intake"),
    accentColor: "bg-blue-500 text-slate-950 font-bold shadow-md shadow-blue-500/20",
  },
  {
    name: "Inventory",
    href: "/inventory",
    icon: Layers,
    isActive: (pathname) => pathname.startsWith("/inventory"),
    accentColor: "bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20",
  },
  {
    name: "POS Checkout",
    href: "/checkout",
    icon: ShoppingCart,
    isActive: (pathname) => pathname === "/" || pathname.startsWith("/checkout"),
    accentColor: "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20",
  },
  {
    name: "Payouts Ledger",
    href: "/payouts",
    icon: Wallet,
    isActive: (pathname) => pathname.startsWith("/payouts"),
    accentColor: "bg-violet-500 text-white font-bold shadow-md shadow-violet-500/20",
  },
];

export default function Navbar() {
  const pathname = usePathname() || "/";
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-40 px-4 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
      {/* Brand Logo & Title */}
      <Link href="/" className="flex items-center gap-3 group">
        <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shadow-lg shadow-amber-500/10 border border-slate-700/80 overflow-hidden shrink-0 transition-transform group-hover:scale-105">
          <img
            src="/logo.png"
            alt="medicoessentials logo"
            className="w-full h-full object-contain"
          />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-black tracking-tight text-white flex items-center gap-2">
              medicoessentials old book POS
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                DH KUSMS
              </span>
            </h1>
          </div>
          <p className="text-[11px] text-slate-400">Medical Textbooks • Consignments • Register • Settlements</p>
        </div>
      </Link>

      {/* Navigation Tabs */}
      <nav className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800/90 shadow-inner">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.isActive(pathname);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 transition-all ${
                active
                  ? item.accentColor
                  : "text-slate-400 hover:text-white hover:bg-slate-800/80 font-medium"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Right Header Status Bar */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300">
          <Database className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-300 font-mono text-[11px]">
            {isSupabaseConfigured ? "Supabase Connected" : "Supabase: Ready"}
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>

        <div className="hidden sm:block text-xs font-mono bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 text-amber-300">
          {currentTime || "12:00:00"}
        </div>
      </div>
    </header>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserPlus, Layers, ShoppingCart, Wallet, Lock } from "lucide-react";
import { useAuthLock } from "@/context/AuthLockContext";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: (pathname: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  { name: "Book Intake", href: "/intake", icon: UserPlus, isActive: (p) => p.startsWith("/intake") },
  { name: "Inventory", href: "/inventory", icon: Layers, isActive: (p) => p.startsWith("/inventory") },
  { name: "POS Checkout", href: "/checkout", icon: ShoppingCart, isActive: (p) => p === "/" || p.startsWith("/checkout") },
  { name: "Payouts Ledger", href: "/payouts", icon: Wallet, isActive: (p) => p.startsWith("/payouts") },
];

export default function Navbar() {
  const pathname = usePathname() || "/";
  const [currentTime, setCurrentTime] = useState("");
  const { lock } = useAuthLock();

  useEffect(() => {
    const update = () =>
      setCurrentTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-40 px-4 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
      {/* Brand */}
      <Link href="/" className="flex items-center gap-3 group">
        <div className="w-9 h-9 rounded bg-white p-1 flex items-center justify-center border border-slate-300 overflow-hidden shrink-0">
          <img src="/logo.png" alt="medicoessentials logo" className="w-full h-full object-contain" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white leading-tight tracking-tight">
            medicoessentials old book POS
          </h1>
          <p className="text-xs text-slate-400">DH KUSMS · Medical Textbooks · Sellers</p>
        </div>
      </Link>

      {/* Nav Tabs */}
      <nav className="flex items-center gap-1 bg-slate-900/60 p-1 rounded border border-slate-700">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.isActive(pathname);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-all ${
                active
                  ? "bg-white text-slate-900 font-bold shadow-sm"
                  : "text-slate-300 hover:text-white hover:bg-slate-700"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Right Area: Clock & Lock App Button */}
      <div className="flex items-center gap-2">
        <div className="hidden sm:block text-xs font-mono bg-slate-900/60 px-3 py-1.5 rounded border border-slate-700 text-slate-300">
          {currentTime || "—"}
        </div>

        <button
          onClick={lock}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-slate-900/60 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition cursor-pointer"
          title="Lock POS Application"
        >
          <Lock className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Lock App</span>
        </button>
      </div>
    </header>
  );
}

"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Users,
  Phone,
  CheckCircle2,
  RefreshCw,
  Wallet,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  BookMarked,
  Receipt,
  BadgeCheck,
  BookOpen,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

interface RawSaleRow {
  sale_id: string;
  selling_price: number;
  shop_profit: number;
  seller_payout: number;
  date_sold: string;
  commission_percentage: number;
  books: {
    title: string;
    seller_id: string;
    sellers: {
      name: string;
      phone: string;
    } | null;
  } | null;
}

interface SaleRecord {
  sale_id: string;
  book_title: string;
  seller_id: string;
  seller_name: string;
  seller_phone: string;
  selling_price: number;
  shop_profit: number;
  seller_payout: number;
  commission_percentage: number;
  date_sold: string;
}

// Aggregated per student
interface SellerBalance {
  seller_id: string;
  seller_name: string;
  seller_phone: string;
  total_balance_owed: number;
  total_sales_count: number;
  sales: SaleRecord[];
  settled: boolean;
}

export default function PayoutsLedger() {
  const [rawSales, setRawSales] = useState<SaleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedSeller, setExpandedSeller] = useState<string | null>(null);
  const [settledSellerIds, setSettledSellerIds] = useState<Set<string>>(new Set());

  // ============================================================================
  // Data Fetching Function
  // Joins: Sales → Books → Sellers to pull seller name + phone
  // Aggregation happens client-side in React (see sellerBalances below)
  // ============================================================================
  const fetchPayoutsData = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase
        .from("sales")
        .select(`
          sale_id,
          selling_price,
          shop_profit,
          seller_payout,
          commission_percentage,
          date_sold,
          books (
            title,
            seller_id,
            sellers (
              name,
              phone
            )
          )
        `)
        .order("date_sold", { ascending: false });

      if (error) throw error;

      const flattened: SaleRecord[] = (data as any[])
        .filter((row) => row.books !== null && row.books !== undefined)
        .map((row) => {
          const rawBook = Array.isArray(row.books) ? row.books[0] : row.books;
          const rawSeller = Array.isArray(rawBook?.sellers) ? rawBook.sellers[0] : rawBook?.sellers;
          return {
            sale_id: row.sale_id,
            book_title: rawBook?.title || "Unknown Book",
            seller_id: rawBook?.seller_id || "unknown",
            seller_name: rawSeller?.name || "Unknown Consignor",
            seller_phone: rawSeller?.phone || "—",
            selling_price: Number(row.selling_price),
            shop_profit: Number(row.shop_profit),
            seller_payout: Number(row.seller_payout),
            commission_percentage: Number(row.commission_percentage),
            date_sold: row.date_sold,
          };
        });

      setRawSales(flattened);
    } catch (err: any) {
      console.error("Payouts fetch error:", err);
      setErrorMsg(err?.message || "Could not fetch sales data from Supabase.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayoutsData();
  }, [fetchPayoutsData]);

  // ============================================================================
  // Client-Side Aggregation
  // GROUP BY seller_id, SUM(shop_profit), SUM(seller_payout)
  // ============================================================================
  const { totalShopProfit, totalOutstandingPayouts, sellerBalances } = useMemo(() => {
    let totalShopProfit = 0;
    let totalOutstandingPayouts = 0;

    const sellerMap = new Map<string, SellerBalance>();

    for (const sale of rawSales) {
      totalShopProfit += sale.shop_profit;
      totalOutstandingPayouts += sale.seller_payout;

      if (!sellerMap.has(sale.seller_id)) {
        sellerMap.set(sale.seller_id, {
          seller_id: sale.seller_id,
          seller_name: sale.seller_name,
          seller_phone: sale.seller_phone,
          total_balance_owed: 0,
          total_sales_count: 0,
          sales: [],
          settled: settledSellerIds.has(sale.seller_id),
        });
      }

      const entry = sellerMap.get(sale.seller_id)!;
      entry.total_balance_owed += sale.seller_payout;
      entry.total_sales_count += 1;
      entry.sales.push(sale);
      entry.settled = settledSellerIds.has(sale.seller_id);
    }

    const sellerBalances = Array.from(sellerMap.values()).sort((a, b) => {
      if (a.settled !== b.settled) return a.settled ? 1 : -1;
      return b.total_balance_owed - a.total_balance_owed;
    });

    return {
      totalShopProfit: Number(totalShopProfit.toFixed(2)),
      totalOutstandingPayouts: Number(totalOutstandingPayouts.toFixed(2)),
      sellerBalances,
    };
  }, [rawSales, settledSellerIds]);

  const pendingCount = sellerBalances.filter((s) => !s.settled).length;

  // ============================================================================
  // Settle Balance Handler
  // Shows browser alert and marks settled in session state
  // ============================================================================
  const handleSettleBalance = async (sellerId: string, sellerName: string, amount: number) => {
    alert(`Payout recorded for ${sellerName} — Rs. ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} settled.`);
    setSettledSellerIds((prev) => new Set([...prev, sellerId]));
  };

  const toggleExpand = (sellerId: string) => {
    setExpandedSeller((prev) => (prev === sellerId ? null : sellerId));
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-violet-500 selection:text-white">

      {/* Page Title Banner */}
      <div className="border-b border-slate-800 bg-slate-950/60 px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              <Wallet className="w-5 h-5 text-violet-400" />
              Payouts Ledger
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Consignment settlements, shop revenue & student outstanding balance management (Nepali Rupees - Rs.)
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="px-3 py-1.5 rounded-xl bg-violet-500/10 text-violet-300 border border-violet-500/30 font-semibold font-mono">
              Pending Students: {pendingCount}
            </span>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 space-y-6">

        {/* Error Banner */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Supabase Error: {errorMsg}</span>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Card 1: Total Shop Profit All-Time */}
          <div className="col-span-1 p-5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/20">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500/70 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                Shop Revenue
              </span>
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-400/80 mb-1">
              Total Shop Profit All-Time
            </p>
            <p className="text-3xl font-black text-amber-300 font-mono tracking-tight">
              {isLoading ? "—" : `Rs. ${totalShopProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
            <p className="text-[11px] text-amber-400/60 mt-1">
              Σ shop_profit across {rawSales.length} sales
            </p>
          </div>

          {/* Card 2: Total Outstanding Payouts */}
          <div className="col-span-1 p-5 rounded-2xl bg-violet-500/10 border-2 border-violet-500/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-violet-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-lg bg-violet-500/15 text-violet-400 border border-violet-500/20">
                <Wallet className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-violet-500/70 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
                Held for Students
              </span>
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-400/80 mb-1">
              Total Outstanding Payouts
            </p>
            <p className="text-3xl font-black text-violet-300 font-mono tracking-tight">
              {isLoading ? "—" : `Rs. ${totalOutstandingPayouts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
            <p className="text-[11px] text-violet-400/60 mt-1">
              Cash held on behalf of student consignors
            </p>
          </div>

          {/* Card 3: Pending Sellers */}
          <div className="col-span-1 p-5 rounded-2xl bg-slate-950/70 border border-slate-800">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Students Awaiting Payout
            </p>
            <p className="text-3xl font-black text-white font-mono">
              {isLoading ? "—" : pendingCount}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              of {sellerBalances.length} registered students
            </p>
          </div>

          {/* Card 4: Total Transactions */}
          <div className="col-span-1 p-5 rounded-2xl bg-slate-950/70 border border-slate-800">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                <Receipt className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Total Sales Logged
            </p>
            <p className="text-3xl font-black text-white font-mono">
              {isLoading ? "—" : rawSales.length}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Transactions in Supabase `sales` table
            </p>
          </div>

        </div>

        {/* Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <BookMarked className="w-4 h-4 text-violet-400" />
            <span className="font-semibold text-white">Student Balance Ledger</span>
            <span className="text-[11px] text-slate-500 font-mono">— Aggregated client-side from Sales → Books → Sellers</span>
          </div>
          <button
            onClick={fetchPayoutsData}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-violet-400" : ""}`} />
            Refresh Ledger
          </button>
        </div>

        {/* Student Balances Table */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-900/90 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-4 px-6">Student Consignor</th>
                  <th className="py-4 px-6">Phone</th>
                  <th className="py-4 px-6 text-center">Books Sold</th>
                  <th className="py-4 px-6 text-right">Total Balance Owed</th>
                  <th className="py-4 px-6 text-center">Status</th>
                  <th className="py-4 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-14 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-violet-400" />
                        <span className="text-sm">Fetching Sales → Books → Sellers...</span>
                      </div>
                    </td>
                  </tr>
                ) : sellerBalances.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-14 text-center text-slate-500 text-sm italic">
                      No sales data found. Complete a sale in the POS to populate the ledger.
                    </td>
                  </tr>
                ) : (
                  sellerBalances.map((seller) => (
                    <React.Fragment key={seller.seller_id}>
                      {/* Main Row */}
                      <tr
                        className={`group transition-colors cursor-pointer ${
                          seller.settled
                            ? "opacity-50 bg-slate-900/20"
                            : "hover:bg-slate-900/40"
                        }`}
                        onClick={() => toggleExpand(seller.seller_id)}
                      >
                        {/* Seller Name */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${
                              seller.settled
                                ? "bg-slate-800 border-slate-700 text-slate-500"
                                : "bg-violet-500/15 border-violet-500/30 text-violet-300"
                            }`}>
                              {seller.seller_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-sm text-white">{seller.seller_name}</p>
                              <p className="text-[11px] text-slate-500 font-mono">ID: {seller.seller_id.slice(0, 8)}…</p>
                            </div>
                            <div className="ml-1 text-slate-600 group-hover:text-slate-400 transition">
                              {expandedSeller === seller.seller_id
                                ? <ChevronUp className="w-3.5 h-3.5" />
                                : <ChevronDown className="w-3.5 h-3.5" />}
                            </div>
                          </div>
                        </td>

                        {/* Phone */}
                        <td className="py-4 px-6 text-xs text-slate-300">
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-500" />
                            <span className="font-mono">{seller.seller_phone}</span>
                          </div>
                        </td>

                        {/* Sales Count */}
                        <td className="py-4 px-6 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold">
                            <BookOpen className="w-3 h-3" />
                            {seller.total_sales_count}
                          </span>
                        </td>

                        {/* Total Balance Owed in NPR */}
                        <td className="py-4 px-6 text-right">
                          <span className={`text-xl font-black font-mono ${
                            seller.settled ? "text-slate-500 line-through" : "text-violet-300"
                          }`}>
                            Rs. {seller.total_balance_owed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-6 text-center">
                          {seller.settled ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
                              <BadgeCheck className="w-3.5 h-3.5 text-emerald-400" />
                              Settled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                              Pending
                            </span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="py-4 px-6 text-right">
                          <button
                            disabled={seller.settled}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSettleBalance(
                                seller.seller_id,
                                seller.seller_name,
                                seller.total_balance_owed
                              );
                            }}
                            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition active:scale-[0.98] ${
                              seller.settled
                                ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                                : "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white shadow-md shadow-emerald-500/20 cursor-pointer"
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {seller.settled ? "Settled" : "Settle Balance"}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Sale Breakdown */}
                      {expandedSeller === seller.seller_id && (
                        <tr>
                          <td colSpan={6} className="bg-slate-900/50 border-t border-slate-800/50 px-6 py-4">
                            <div className="space-y-2">
                              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                                <Receipt className="w-3.5 h-3.5 text-violet-400" />
                                Individual Sales Breakdown for {seller.seller_name}
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {seller.sales.map((sale) => (
                                  <div
                                    key={sale.sale_id}
                                    className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1.5"
                                  >
                                    <div className="font-semibold text-white truncate">
                                      {sale.book_title}
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] font-mono">
                                      <div className="space-y-0.5">
                                        <div className="text-slate-400">
                                          Sold: <span className="text-white font-bold">Rs. {sale.selling_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="text-amber-400">
                                          Shop ({sale.commission_percentage}%): +Rs. {sale.shop_profit.toFixed(2)}
                                        </div>
                                        <div className="text-violet-300 font-bold">
                                          Student cut: Rs. {sale.seller_payout.toFixed(2)}
                                        </div>
                                      </div>
                                      <div className="text-right text-[10px] text-slate-500">
                                        <Clock className="w-3 h-3 inline-block mr-1" />
                                        {formatDate(sale.date_sold)}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="p-4 bg-slate-900/60 border-t border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
            <span>
              Aggregation: client-side GROUP BY seller_id — SUM(seller_payout) per consignor
            </span>
            <div className="flex items-center gap-4 font-mono">
              <span className="text-amber-400">Shop Revenue: <strong>Rs. {totalShopProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
              <span className="text-violet-300">Cash Held: <strong>Rs. {totalOutstandingPayouts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60 py-3.5 px-6 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
        <span>medicoessentials old book POS • Payouts Ledger</span>
        <span className="font-mono text-[11px] text-slate-400">
          Sales → Books → Sellers (relational join via Supabase)
        </span>
      </footer>

    </div>
  );
}

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
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Receipt,
  BadgeCheck,
  BookOpen,
  Edit2,
  Save,
  X,
  CreditCard,
  Sliders,
  Check,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export const SETTLEMENT_PAYMENT_MODES = [
  "Cash",
  "Fonepay",
  "eSewa",
  "Khalti",
  "Bank Transfer",
] as const;

interface SaleRecord {
  sale_id: string;
  book_title: string;
  seller_id: string;
  seller_name: string;
  seller_phone: string;
  selling_price: number;
  shop_profit: number | null;
  seller_payout: number | null;
  commission_percentage: number | null;
  customer_payment_mode: string;
  customer_description: string | null;
  settlement_payment_mode: string | null;
  date_sold: string;
}

interface SellerBalance {
  seller_id: string;
  seller_name: string;
  seller_phone: string;
  total_balance_owed: number;
  total_sales_count: number;
  pending_commission_count: number;
  sales: SaleRecord[];
  settled: boolean;
}

export default function PayoutsLedger() {
  const [rawSales, setRawSales] = useState<SaleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"balances" | "transactions">("balances");
  const [expandedSeller, setExpandedSeller] = useState<string | null>(null);
  const [settledSellerIds, setSettledSellerIds] = useState<Set<string>>(new Set());

  // Edit Customer Description Modal State
  const [editingDescriptionSale, setEditingDescriptionSale] = useState<SaleRecord | null>(null);
  const [newCustomerDescription, setNewCustomerDescription] = useState("");
  const [isSavingDescription, setIsSavingDescription] = useState(false);

  // Edit / Set Commission Modal State
  const [editingCommissionSale, setEditingCommissionSale] = useState<SaleRecord | null>(null);
  const [newCommissionPct, setNewCommissionPct] = useState<string>("");
  const [isSavingCommission, setIsSavingCommission] = useState(false);

  // Settle Balance Modal State
  const [settlingSeller, setSettlingSeller] = useState<SellerBalance | null>(null);
  const [settlementMode, setSettlementMode] = useState<string>("Fonepay");
  const [isSavingSettlement, setIsSavingSettlement] = useState(false);

  // Fetch sales data
  const fetchPayoutsData = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      let data: any[] | null = null;
      try {
        const res = await supabase
          .from("sales")
          .select(`
            sale_id,
            selling_price,
            shop_profit,
            seller_payout,
            commission_percentage,
            customer_payment_mode,
            customer_description,
            settlement_payment_mode,
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

        if (res.error) throw res.error;
        data = res.data;
      } catch {
        const res = await supabase
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

        if (res.error) throw res.error;
        data = res.data;
      }

      const flattened: SaleRecord[] = (data as any[])
        .filter((row) => row.books !== null && row.books !== undefined)
        .map((row) => {
          const rawBook = Array.isArray(row.books) ? row.books[0] : row.books;
          const rawSeller = Array.isArray(rawBook?.sellers) ? rawBook.sellers[0] : rawBook?.sellers;
          return {
            sale_id: row.sale_id,
            book_title: rawBook?.title || "Unknown Book",
            seller_id: rawBook?.seller_id || "unknown",
            seller_name: rawSeller?.name || "Unknown Seller",
            seller_phone: rawSeller?.phone || "—",
            selling_price: Number(row.selling_price),
            shop_profit: row.shop_profit !== null && row.shop_profit !== undefined ? Number(row.shop_profit) : null,
            seller_payout: row.seller_payout !== null && row.seller_payout !== undefined ? Number(row.seller_payout) : null,
            commission_percentage: row.commission_percentage !== null && row.commission_percentage !== undefined ? Number(row.commission_percentage) : null,
            customer_payment_mode: row.customer_payment_mode || "Cash",
            customer_description: row.customer_description || null,
            settlement_payment_mode: row.settlement_payment_mode || null,
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

  // Aggregation per seller
  const { totalShopProfit, totalOutstandingPayouts, sellerBalances } = useMemo(() => {
    let totalShopProfit = 0;
    let totalOutstandingPayouts = 0;

    const sellerMap = new Map<string, SellerBalance>();

    for (const sale of rawSales) {
      if (sale.shop_profit !== null) {
        totalShopProfit += sale.shop_profit;
      }
      if (sale.seller_payout !== null) {
        totalOutstandingPayouts += sale.seller_payout;
      } else {
        totalOutstandingPayouts += sale.selling_price;
      }

      if (!sellerMap.has(sale.seller_id)) {
        sellerMap.set(sale.seller_id, {
          seller_id: sale.seller_id,
          seller_name: sale.seller_name,
          seller_phone: sale.seller_phone,
          total_balance_owed: 0,
          total_sales_count: 0,
          pending_commission_count: 0,
          sales: [],
          settled: settledSellerIds.has(sale.seller_id),
        });
      }

      const entry = sellerMap.get(sale.seller_id)!;
      const payoutVal = sale.seller_payout !== null ? sale.seller_payout : sale.selling_price;
      entry.total_balance_owed += payoutVal;
      entry.total_sales_count += 1;
      if (sale.commission_percentage === null) {
        entry.pending_commission_count += 1;
      }
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

  const handleOpenEditDescription = (sale: SaleRecord) => {
    setEditingDescriptionSale(sale);
    setNewCustomerDescription(sale.customer_description || "");
  };

  const handleSaveCustomerDescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDescriptionSale) return;

    setIsSavingDescription(true);
    const updatedText = newCustomerDescription.trim() || null;

    try {
      const { error } = await supabase
        .from("sales")
        .update({ customer_description: updatedText })
        .eq("sale_id", editingDescriptionSale.sale_id);

      if (error) throw error;

      setRawSales((prev) =>
        prev.map((s) =>
          s.sale_id === editingDescriptionSale.sale_id
            ? { ...s, customer_description: updatedText }
            : s
        )
      );

      setEditingDescriptionSale(null);
    } catch (err: any) {
      alert(`Failed to update customer description: ${err?.message || err}`);
    } finally {
      setIsSavingDescription(false);
    }
  };

  const handleOpenEditCommission = (sale: SaleRecord) => {
    setEditingCommissionSale(sale);
    setNewCommissionPct(
      sale.commission_percentage !== null ? String(sale.commission_percentage) : ""
    );
  };

  const handleSaveCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCommissionSale) return;

    setIsSavingCommission(true);
    const pct = newCommissionPct.trim() !== "" ? parseFloat(newCommissionPct) : null;
    let shopProfit: number | null = null;
    let sellerPayout: number | null = null;

    if (pct !== null) {
      shopProfit = Number(((editingCommissionSale.selling_price * pct) / 100).toFixed(2));
      sellerPayout = Number((editingCommissionSale.selling_price - shopProfit).toFixed(2));
    }

    try {
      const { error } = await supabase
        .from("sales")
        .update({
          commission_percentage: pct,
          shop_profit: shopProfit,
          seller_payout: sellerPayout,
        })
        .eq("sale_id", editingCommissionSale.sale_id);

      if (error) throw error;

      setRawSales((prev) =>
        prev.map((s) =>
          s.sale_id === editingCommissionSale.sale_id
            ? {
                ...s,
                commission_percentage: pct,
                shop_profit: shopProfit,
                seller_payout: sellerPayout,
              }
            : s
        )
      );

      setEditingCommissionSale(null);
    } catch (err: any) {
      alert(`Failed to update commission: ${err?.message || err}`);
    } finally {
      setIsSavingCommission(false);
    }
  };

  const handleOpenSettleModal = (seller: SellerBalance) => {
    setSettlingSeller(seller);
    setSettlementMode("Fonepay");
  };

  const handleConfirmSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingSeller) return;

    setIsSavingSettlement(true);

    try {
      const saleIds = settlingSeller.sales.map((s) => s.sale_id);
      if (saleIds.length > 0) {
        try {
          await supabase
            .from("sales")
            .update({ settlement_payment_mode: settlementMode })
            .in("sale_id", saleIds);
        } catch {
          // ignore if column not present yet
        }
      }

      setSettledSellerIds((prev) => new Set([...prev, settlingSeller.seller_id]));

      setRawSales((prev) =>
        prev.map((s) =>
          s.seller_id === settlingSeller.seller_id
            ? { ...s, settlement_payment_mode: settlementMode }
            : s
        )
      );

      alert(`Settlement of Rs. ${settlingSeller.total_balance_owed.toFixed(2)} recorded for ${settlingSeller.seller_name} via ${settlementMode}.`);
      setSettlingSeller(null);
    } catch (err: any) {
      alert(`Failed to record settlement: ${err?.message || err}`);
    } finally {
      setIsSavingSettlement(false);
    }
  };

  const toggleExpand = (sellerId: string) => {
    setExpandedSeller((prev) => (prev === sellerId ? null : sellerId));
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">
      {/* Top Banner */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-slate-800" />
              Payouts & Sales Ledger
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Seller payouts, payment channels, editable customer notes and commission management
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 bg-gray-100 border border-gray-200 rounded text-gray-700 font-semibold font-mono">
              Pending Sellers: {pendingCount}
            </span>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 space-y-4">
        {errorMsg && (
          <div className="p-3 rounded bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Supabase Error: {errorMsg}</span>
          </div>
        )}

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 rounded-md bg-white border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Shop Profit All-Time
              </span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-gray-900 font-mono">
              {isLoading ? "—" : `Rs. ${totalShopProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">Sum of retained shop commissions</p>
          </div>

          <div className="p-4 rounded-md bg-white border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Outstanding Payouts
              </span>
              <Wallet className="w-4 h-4 text-slate-800" />
            </div>
            <p className="text-2xl font-black text-gray-900 font-mono">
              {isLoading ? "—" : `Rs. ${totalOutstandingPayouts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">Cash held on behalf of sellers</p>
          </div>

          <div className="p-4 rounded-md bg-white border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Sellers Awaiting Payout
              </span>
              <Users className="w-4 h-4 text-gray-500" />
            </div>
            <p className="text-2xl font-black text-gray-900 font-mono">
              {isLoading ? "—" : pendingCount}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">of {sellerBalances.length} active sellers</p>
          </div>

          <div className="p-4 rounded-md bg-white border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Total Sales Recorded
              </span>
              <Receipt className="w-4 h-4 text-gray-500" />
            </div>
            <p className="text-2xl font-black text-gray-900 font-mono">
              {isLoading ? "—" : rawSales.length}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">Completed transactions</p>
          </div>
        </div>

        {/* Tab Switcher & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-gray-200 rounded-md px-3.5 py-2.5">
          <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded border border-gray-200 text-xs">
            <button
              onClick={() => setActiveTab("balances")}
              className={`px-3 py-1 rounded transition text-xs font-semibold flex items-center gap-1.5 ${
                activeTab === "balances" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Seller Balances ({sellerBalances.length})
            </button>
            <button
              onClick={() => setActiveTab("transactions")}
              className={`px-3 py-1 rounded transition text-xs font-semibold flex items-center gap-1.5 ${
                activeTab === "transactions" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              All Transactions ({rawSales.length})
            </button>
          </div>

          <button
            onClick={fetchPayoutsData}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded text-xs font-semibold transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-slate-800" : ""}`} />
            Refresh
          </button>
        </div>

        {/* View 1: Seller Balances */}
        {activeTab === "balances" && (
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-600">
                    <th className="py-3 px-4">Seller</th>
                    <th className="py-3 px-4">Phone</th>
                    <th className="py-3 px-4 text-center">Books Sold</th>
                    <th className="py-3 px-4 text-right">Balance Owed</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-xs">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center gap-2">
                          <RefreshCw className="w-5 h-5 animate-spin text-slate-800" />
                          <span>Calculating seller balances...</span>
                        </div>
                      </td>
                    </tr>
                  ) : sellerBalances.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-400 italic">
                        No sales records found. Complete a sale in checkout to populate the ledger.
                      </td>
                    </tr>
                  ) : (
                    sellerBalances.map((seller) => (
                      <React.Fragment key={seller.seller_id}>
                        <tr
                          className={`cursor-pointer transition-colors ${
                            seller.settled ? "opacity-60 bg-gray-50" : "hover:bg-gray-50/80"
                          }`}
                          onClick={() => toggleExpand(seller.seller_id)}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div>
                                <p className="font-bold text-gray-900">{seller.seller_name}</p>
                                <p className="text-[10px] text-gray-400 font-mono">ID: {seller.seller_id.slice(0, 8)}…</p>
                              </div>
                              <div className="text-gray-400">
                                {expandedSeller === seller.seller_id ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-gray-600 font-mono text-xs">
                            {seller.seller_phone}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-800 font-semibold text-xs">
                              {seller.total_sales_count}
                            </span>
                            {seller.pending_commission_count > 0 && (
                              <span className="block text-[10px] text-amber-700 mt-0.5">
                                {seller.pending_commission_count} pending commission
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <span
                              className={`text-base font-bold font-mono ${
                                seller.settled ? "text-gray-400 line-through" : "text-gray-900"
                              }`}
                            >
                              Rs.{" "}
                              {seller.total_balance_owed.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center">
                            {seller.settled ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                                Settled
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                Pending
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <button
                              disabled={seller.settled}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenSettleModal(seller);
                              }}
                              className={`px-3 py-1 rounded text-xs font-semibold transition ${
                                seller.settled
                                  ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
                                  : "bg-slate-800 hover:bg-slate-900 text-white cursor-pointer"
                              }`}
                            >
                              {seller.settled ? "Settled" : "Settle Balance"}
                            </button>
                          </td>
                        </tr>

                        {expandedSeller === seller.seller_id && (
                          <tr>
                            <td colSpan={6} className="bg-gray-50 border-t border-gray-200 p-4">
                              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-2">
                                Sales Breakdown for {seller.seller_name}
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                {seller.sales.map((sale) => (
                                  <div
                                    key={sale.sale_id}
                                    className="p-3 rounded border border-gray-200 bg-white text-xs space-y-1.5"
                                  >
                                    <div className="font-semibold text-gray-900 truncate">{sale.book_title}</div>
                                    <div className="space-y-0.5 text-[11px] font-mono text-gray-600">
                                      <div className="flex justify-between">
                                        <span>Sold:</span>
                                        <span className="font-bold text-gray-900">
                                          Rs. {sale.selling_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                      </div>

                                      <div className="flex justify-between items-center">
                                        <span>Commission:</span>
                                        {sale.commission_percentage !== null ? (
                                          <span>
                                            {sale.commission_percentage}% (+Rs. {sale.shop_profit?.toFixed(2)})
                                          </span>
                                        ) : (
                                          <button
                                            onClick={() => handleOpenEditCommission(sale)}
                                            className="text-blue-900 underline font-semibold text-[10px]"
                                          >
                                            Set Commission
                                          </button>
                                        )}
                                      </div>

                                      <div className="flex justify-between">
                                        <span>Seller Payout:</span>
                                        <span className="font-bold text-gray-900">
                                          Rs. {(sale.seller_payout ?? sale.selling_price).toFixed(2)}
                                        </span>
                                      </div>

                                      <div className="flex justify-between pt-1 border-t border-gray-100 text-[10px] text-gray-400">
                                        <span>Payment: {sale.customer_payment_mode}</span>
                                        <span>{formatDate(sale.date_sold)}</span>
                                      </div>

                                      {sale.customer_description && (
                                        <div className="text-[10px] text-gray-700 bg-gray-50 p-1 rounded border border-gray-200">
                                          Note: {sale.customer_description}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
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

            <div className="p-3 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between text-xs text-gray-500 gap-2 font-mono">
              <span>GROUP BY seller_id</span>
              <div className="flex items-center gap-4">
                <span>Shop Profit: <strong>Rs. {totalShopProfit.toFixed(2)}</strong></span>
                <span>Outstanding: <strong>Rs. {totalOutstandingPayouts.toFixed(2)}</strong></span>
              </div>
            </div>
          </div>
        )}

        {/* View 2: All Sales Transactions */}
        {activeTab === "transactions" && (
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-600">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Book Title</th>
                    <th className="py-3 px-4">Seller</th>
                    <th className="py-3 px-4 text-right">Selling Price</th>
                    <th className="py-3 px-4 text-center">Payment Channel</th>
                    <th className="py-3 px-4">Customer Notes</th>
                    <th className="py-3 px-4 text-right">Commission & Profit</th>
                    <th className="py-3 px-4 text-center">Settlement Mode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-xs font-mono">
                  {rawSales.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-400 font-sans italic">
                        No sales recorded yet.
                      </td>
                    </tr>
                  ) : (
                    rawSales.map((sale) => (
                      <tr key={sale.sale_id} className="hover:bg-gray-50/80 transition">
                        <td className="py-3 px-4 text-gray-500 whitespace-nowrap text-[11px]">
                          {formatDate(sale.date_sold)}
                        </td>

                        <td className="py-3 px-4 font-sans font-bold text-gray-900 max-w-[180px] truncate">
                          {sale.book_title}
                        </td>

                        <td className="py-3 px-4 font-sans text-gray-700">
                          <div>
                            <span className="font-medium text-gray-900">{sale.seller_name}</span>
                            <span className="block text-[10px] text-gray-400 font-mono">{sale.seller_phone}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right font-bold text-gray-900">
                          Rs. {sale.selling_price.toFixed(2)}
                        </td>

                        <td className="py-3 px-4 text-center whitespace-nowrap font-sans">
                          <span className="px-2 py-0.5 rounded bg-gray-100 border border-gray-200 text-gray-800 font-semibold text-[11px]">
                            {sale.customer_payment_mode}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-sans max-w-[180px]">
                          <div className="flex items-center justify-between gap-1 group">
                            <span className="truncate text-gray-700 text-xs">
                              {sale.customer_description || <em className="text-gray-400">None</em>}
                            </span>
                            <button
                              onClick={() => handleOpenEditDescription(sale)}
                              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition shrink-0 opacity-70 group-hover:opacity-100"
                              title="Edit notes"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 group">
                            {sale.commission_percentage !== null ? (
                              <div className="text-right">
                                <span className="font-bold text-gray-900">{sale.commission_percentage}%</span>
                                <span className="block text-[10px] text-gray-500">
                                  Profit: Rs. {sale.shop_profit?.toFixed(2)}
                                </span>
                              </div>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-sans font-semibold">
                                Pending
                              </span>
                            )}
                            <button
                              onClick={() => handleOpenEditCommission(sale)}
                              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition shrink-0"
                              title="Edit commission %"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-center whitespace-nowrap font-sans">
                          {sale.settlement_payment_mode ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
                              ✓ {sale.settlement_payment_mode}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-[11px] italic">Unsettled</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Modal 1: Edit Customer Notes */}
      {editingDescriptionSale && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-md max-w-md w-full p-5 space-y-3.5 shadow-lg text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200">
              <div className="flex items-center gap-1.5">
                <Edit2 className="w-4 h-4 text-slate-800" />
                <h3 className="font-bold text-sm text-gray-900">Edit Customer Description</h3>
              </div>
              <button
                onClick={() => setEditingDescriptionSale(null)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomerDescription} className="space-y-3">
              <div className="p-2.5 rounded bg-gray-50 border border-gray-200 font-mono text-[11px]">
                <span className="text-gray-900 font-bold block">{editingDescriptionSale.book_title}</span>
                <span className="text-gray-500 block">ID: {editingDescriptionSale.sale_id}</span>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Customer Description / Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Dr. Rohan 2022 batch, Ref #4928"
                  value={newCustomerDescription}
                  onChange={(e) => setNewCustomerDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-gray-900 text-xs focus:outline-none focus:border-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setEditingDescriptionSale(null)}
                  className="px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingDescription}
                  className="px-3.5 py-1.5 rounded bg-slate-800 hover:bg-slate-900 text-white font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSavingDescription ? "Saving..." : "Save Note"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Edit Shop Commission % */}
      {editingCommissionSale && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-md max-w-md w-full p-5 space-y-3.5 shadow-lg text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200">
              <div className="flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-slate-800" />
                <h3 className="font-bold text-sm text-gray-900">Set Shop Commission</h3>
              </div>
              <button
                onClick={() => setEditingCommissionSale(null)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCommission} className="space-y-3">
              <div className="p-2.5 rounded bg-gray-50 border border-gray-200 font-mono text-[11px]">
                <span className="text-gray-900 font-bold block">{editingCommissionSale.book_title}</span>
                <span className="text-gray-700 block">
                  Selling Price: Rs. {editingCommissionSale.selling_price.toFixed(2)}
                </span>
                <span className="text-gray-500 block">Seller: {editingCommissionSale.seller_name}</span>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Shop Commission % (0 to 100)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    placeholder="e.g. 20"
                    value={newCommissionPct}
                    onChange={(e) => setNewCommissionPct(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-gray-900 text-xs font-mono focus:outline-none focus:border-slate-800"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-mono">%</span>
                </div>
              </div>

              {newCommissionPct.trim() !== "" && (
                <div className="p-2.5 rounded bg-gray-50 border border-gray-200 space-y-1 text-[11px] font-mono">
                  <div className="flex justify-between text-gray-700">
                    <span>Shop Profit:</span>
                    <span className="font-bold">
                      +Rs.{" "}
                      {(
                        (editingCommissionSale.selling_price * (parseFloat(newCommissionPct) || 0)) /
                        100
                      ).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>Seller Payout:</span>
                    <span className="font-bold">
                      Rs.{" "}
                      {(
                        editingCommissionSale.selling_price -
                        (editingCommissionSale.selling_price * (parseFloat(newCommissionPct) || 0)) / 100
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setEditingCommissionSale(null)}
                  className="px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCommission}
                  className="px-3.5 py-1.5 rounded bg-slate-800 hover:bg-slate-900 text-white font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSavingCommission ? "Saving..." : "Save Commission"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Settle Balance */}
      {settlingSeller && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-md max-w-md w-full p-5 space-y-3.5 shadow-lg text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200">
              <div className="flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-slate-800" />
                <h3 className="font-bold text-sm text-gray-900">Settle Balance with Seller</h3>
              </div>
              <button
                onClick={() => setSettlingSeller(null)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmSettlement} className="space-y-3">
              <div className="p-3 rounded bg-gray-50 border border-gray-200 font-mono space-y-1">
                <p className="font-bold text-gray-900 text-sm font-sans">{settlingSeller.seller_name}</p>
                <p className="text-gray-500 text-xs">Phone: {settlingSeller.seller_phone}</p>
                <p className="text-gray-900 text-base font-bold pt-1 border-t border-gray-200">
                  Total Payout: Rs. {settlingSeller.total_balance_owed.toFixed(2)}
                </p>
                <p className="text-gray-500 text-[10px]">{settlingSeller.total_sales_count} book(s) sold</p>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Settlement Payment Mode (How you paid the seller) *
                </label>
                <select
                  value={settlementMode}
                  onChange={(e) => setSettlementMode(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-gray-900 text-xs font-semibold focus:outline-none focus:border-slate-800"
                >
                  {SETTLEMENT_PAYMENT_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setSettlingSeller(null)}
                  className="px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingSettlement}
                  className="px-3.5 py-1.5 rounded bg-slate-800 hover:bg-slate-900 text-white font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  {isSavingSettlement ? "Recording..." : "Confirm Settlement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className="border-t border-gray-200 bg-white py-3 px-6 text-center text-xs text-gray-500 flex flex-wrap items-center justify-between gap-2">
        <span>medicoessentials old book POS · Payouts</span>
        <span className="font-mono text-[11px] text-gray-400">All data live from Supabase</span>
      </footer>
    </div>
  );
}

"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Percent,
  Receipt,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  SlidersHorizontal,
  BookmarkCheck,
  TrendingUp,
  History,
  RefreshCw,
  ShoppingCart,
  ArrowRight,
  BookOpen,
  PackageOpen,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useSalesCalculation } from "@/hooks/useSalesCalculation";

// ─── Types ────────────────────────────────────────────────────────────────────
interface BookOption {
  book_id: string;
  title: string;
  seller_id?: string;
  seller_name: string;
  condition: string;
}

interface InsertedSaleRecord {
  sale_id: string;
  book_id: string | null;
  book_title: string;
  selling_price: number;
  commission_percentage: number;
  shop_profit: number;
  seller_payout: number;
  date_sold: string;
  status: "persisted";
}

// ─── Main Page Content ────────────────────────────────────────────────────────
function CheckoutContent() {
  const searchParams = useSearchParams();
  const prefillBookId = searchParams.get("bookId");

  // Live books from Supabase only — no fallback array
  const [books, setBooks] = useState<BookOption[]>([]);
  const [isLoadingBooks, setIsLoadingBooks] = useState<boolean>(true);
  const [booksError, setBooksError] = useState<string | null>(null);

  // Selling price & commission inputs (in Nepali Rupees)
  const [sellingPrice, setSellingPrice] = useState<number>(500);
  const [commissionPercentage, setCommissionPercentage] = useState<number>(20);

  // Selected book
  const [selectedBookId, setSelectedBookId] = useState<string>("");
  const [bookTitle, setBookTitle] = useState<string>("");
  const [sellerName, setSellerName] = useState<string>("");

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
    details?: string;
  } | null>(null);

  // Sales history (loaded from Supabase + appended on confirm)
  const [salesLog, setSalesLog] = useState<InsertedSaleRecord[]>([]);
  const [isLoadingSales, setIsLoadingSales] = useState<boolean>(true);

  // ── Real-time Calculation Hook ───────────────────────────────────────────
  const { sellingPrice: calcSellingPrice, commissionPercentage: calcCommission, shop_profit, seller_payout } =
    useSalesCalculation(sellingPrice, commissionPercentage);

  // ── Fetch In-Stock Books from Supabase ────────────────────────────────────
  const loadBooksFromSupabase = useCallback(async () => {
    setIsLoadingBooks(true);
    setBooksError(null);
    try {
      const { data, error } = await supabase
        .from("books")
        .select(`book_id, title, seller_id, sellers ( name )`)
        .eq("status", "In Stock")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped: BookOption[] = (data ?? []).map((b: any) => {
        const sellerObj = Array.isArray(b.sellers) ? b.sellers[0] : b.sellers;
        return {
          book_id: b.book_id,
          title: b.title,
          seller_id: b.seller_id,
          seller_name: sellerObj?.name || "Direct Consignor",
          condition: "N/A",
        };
      });

      setBooks(mapped);

      // Handle ?bookId= prefill
      if (prefillBookId) {
        const target = mapped.find((b) => b.book_id === prefillBookId);
        if (target) {
          setSelectedBookId(target.book_id);
          setBookTitle(target.title);
          setSellerName(target.seller_name);
          return;
        }
      }

      // Auto-select first book if nothing selected yet
      if (mapped.length > 0 && !selectedBookId) {
        setSelectedBookId(mapped[0].book_id);
        setBookTitle(mapped[0].title);
        setSellerName(mapped[0].seller_name);
      }
    } catch (err: any) {
      console.error("Failed to load books:", err);
      setBooksError(err?.message || "Could not connect to Supabase.");
    } finally {
      setIsLoadingBooks(false);
    }
  }, [prefillBookId, selectedBookId]);

  // ── Fetch Recent Sales History from Supabase ──────────────────────────────
  const loadRecentSales = useCallback(async () => {
    setIsLoadingSales(true);
    try {
      const { data, error } = await supabase
        .from("sales")
        .select(`sale_id, book_id, selling_price, commission_percentage, shop_profit, seller_payout, date_sold, books ( title )`)
        .order("date_sold", { ascending: false })
        .limit(15);

      if (!error && data) {
        const mapped: InsertedSaleRecord[] = data.map((s: any) => {
          const bookObj = Array.isArray(s.books) ? s.books[0] : s.books;
          return {
            sale_id: s.sale_id,
            book_id: s.book_id,
            book_title: bookObj?.title || "Book Sale",
            selling_price: Number(s.selling_price),
            commission_percentage: Number(s.commission_percentage),
            shop_profit: Number(s.shop_profit),
            seller_payout: Number(s.seller_payout),
            date_sold: new Date(s.date_sold).toLocaleString("en-NP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
            status: "persisted",
          };
        });
        setSalesLog(mapped);
      }
    } catch (err) {
      console.warn("Could not load sales history:", err);
    } finally {
      setIsLoadingSales(false);
    }
  }, []);

  useEffect(() => {
    loadBooksFromSupabase();
    loadRecentSales();
  }, []);

  // Handle selecting a book card
  const handleSelectBook = (book: BookOption) => {
    setSelectedBookId(book.book_id);
    setBookTitle(book.title);
    setSellerName(book.seller_name);
    setNotification(null);
  };

  // ── Confirm Sale → insert into Supabase `sales` ────────────────────────────
  const handleConfirmSale = async () => {
    if (calcSellingPrice <= 0) {
      setNotification({ type: "error", message: "Invalid Selling Price", details: "Enter a price greater than Rs. 0." });
      return;
    }
    if (!selectedBookId) {
      setNotification({ type: "error", message: "No Book Selected", details: "Select a book from the stock list first." });
      return;
    }

    setIsSubmitting(true);
    setNotification(null);

    try {
      const { data, error } = await supabase
        .from("sales")
        .insert([{
          book_id: selectedBookId,
          selling_price: calcSellingPrice,
          commission_percentage: calcCommission,
          shop_profit,
          seller_payout,
          date_sold: new Date().toISOString(),
        }])
        .select();

      if (error) throw error;

      // Mark book as sold in Supabase
      await supabase.from("books").update({ status: "sold" }).eq("book_id", selectedBookId);

      const newSaleId = data?.[0]?.sale_id ?? `TXN-${Date.now().toString().slice(-6)}`;
      const record: InsertedSaleRecord = {
        sale_id: newSaleId,
        book_id: selectedBookId,
        book_title: bookTitle,
        selling_price: calcSellingPrice,
        commission_percentage: calcCommission,
        shop_profit,
        seller_payout,
        date_sold: new Date().toLocaleString("en-NP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
        status: "persisted",
      };

      setSalesLog((prev) => [record, ...prev]);
      setNotification({
        type: "success",
        message: "Sale recorded in Supabase!",
        details: `ID: ${newSaleId} · Shop: Rs. ${shop_profit.toFixed(2)} · Student payout: Rs. ${seller_payout.toFixed(2)}`,
      });

      // Reset book selection and reload stock
      setSelectedBookId("");
      setBookTitle("");
      setSellerName("");
      loadBooksFromSupabase();
    } catch (err: any) {
      setNotification({ type: "error", message: "Supabase insert failed", details: err?.message || "Check table permissions." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSellingPrice(500);
    setCommissionPercentage(20);
    setNotification(null);
  };

  const sessionProfit = salesLog.reduce((acc, s) => acc + s.shop_profit, 0);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">

      {/* Page Banner */}
      <div className="border-b border-slate-800 bg-slate-950/60 px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-amber-400" />
              POS Checkout Register
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">All amounts in Nepali Rupees (Rs.) · Live data from Supabase</p>
          </div>
          {sessionProfit > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              Session Profit: <strong className="text-amber-400 font-mono ml-1">Rs. {sessionProfit.toFixed(2)}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Prefill Banner */}
      {prefillBookId && bookTitle && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-2.5 text-xs text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookmarkCheck className="w-4 h-4 text-amber-400" />
            Pre-filled from Inventory: <strong className="text-white ml-1">{bookTitle}</strong>
          </div>
          <Link href="/inventory" className="text-amber-400 hover:underline flex items-center gap-1 font-semibold">
            Back to Inventory <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ── Left Column: Book Selector + Calculator ── */}
        <div className="lg:col-span-7 space-y-5">

          {/* Book Stock Selector */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-400" />
                Select Book from In-Stock Inventory
              </h2>
              <button
                onClick={() => { setSelectedBookId(""); loadBooksFromSupabase(); }}
                disabled={isLoadingBooks}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="Refresh stock"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBooks ? "animate-spin text-amber-400" : ""}`} />
              </button>
            </div>

            {/* Loading State */}
            {isLoadingBooks && (
              <div className="flex items-center justify-center gap-2 py-8 text-slate-400 text-sm">
                <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
                <span>Loading live stock from Supabase...</span>
              </div>
            )}

            {/* Error State */}
            {!isLoadingBooks && booksError && (
              <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Supabase error: {booksError}</span>
              </div>
            )}

            {/* Empty State — no mock data, clean message */}
            {!isLoadingBooks && !booksError && books.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
                <PackageOpen className="w-10 h-10 text-slate-600" />
                <p className="text-sm font-bold text-slate-300">No books currently in stock</p>
                <p className="text-xs text-slate-500 max-w-xs">
                  Use the <Link href="/intake" className="text-blue-400 hover:underline font-semibold">Book Intake</Link> page to register new textbooks from student consignors.
                </p>
              </div>
            )}

            {/* Book Cards Grid */}
            {!isLoadingBooks && books.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {books.map((book) => (
                  <button
                    key={book.book_id}
                    onClick={() => handleSelectBook(book)}
                    className={`text-left p-3 rounded-xl border transition flex flex-col gap-1 ${
                      selectedBookId === book.book_id
                        ? "bg-amber-500/10 border-amber-500/60 text-white shadow-sm"
                        : "bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300"
                    }`}
                  >
                    <span className="font-semibold text-xs text-white truncate w-full">{book.title}</span>
                    <span className="text-[11px] text-slate-400">Student: {book.seller_name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Manual override fields */}
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-800/60">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Book Title Override</label>
                <input
                  type="text"
                  value={bookTitle}
                  onChange={(e) => setBookTitle(e.target.value)}
                  placeholder="Or type a custom title..."
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Consignor Name</label>
                <input
                  type="text"
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                  placeholder="Student / seller name..."
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Price & Commission Calculator Card */}
          <div className="bg-gradient-to-b from-slate-950 to-slate-900 border-2 border-amber-500/30 rounded-2xl p-6 shadow-xl space-y-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                  <SlidersHorizontal className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">Price & Commission</h3>
                  <p className="text-xs text-slate-400">Real-time split calculation (Rs.)</p>
                </div>
              </div>
              <button onClick={handleReset} className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition">
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            </div>

            {/* Selling Price Input */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-amber-400">Final Selling Price (Rs.)</label>
              <div className="relative flex items-center">
                <span className="absolute left-4 text-lg font-bold text-amber-400 select-none">Rs.</span>
                <input
                  type="number"
                  step="10"
                  min="0"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                  className="w-full pl-14 pr-4 py-3 bg-slate-950 border-2 border-slate-700 rounded-xl text-3xl font-extrabold text-white focus:outline-none focus:border-amber-400 transition font-mono"
                />
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-800/80">
                <span className="text-[11px] text-slate-400 self-center">Presets:</span>
                {[150, 300, 500, 800, 1200, 1800, 2500, 3500].map((val) => (
                  <button
                    key={val}
                    onClick={() => setSellingPrice(val)}
                    className={`px-2 py-0.5 text-xs rounded font-semibold border transition ${
                      sellingPrice === val ? "bg-amber-500 text-slate-950 border-amber-400" : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                    }`}
                  >
                    Rs.{val.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Commission % Slider */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Percent className="w-4 h-4" /> Shop Commission %
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={commissionPercentage}
                    onChange={(e) => setCommissionPercentage(parseFloat(e.target.value) || 0)}
                    className="w-14 px-2 py-0.5 bg-slate-950 border border-slate-700 rounded text-right font-mono font-bold text-amber-400 text-base focus:outline-none focus:border-amber-400"
                  />
                  <span className="text-slate-400 text-sm">%</span>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={commissionPercentage}
                onChange={(e) => setCommissionPercentage(parseInt(e.target.value))}
                className="w-full h-3 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-800/80">
                {[10, 15, 20, 25, 30, 40, 50].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setCommissionPercentage(pct)}
                    className={`px-2 py-0.5 text-xs rounded font-semibold border transition ${
                      commissionPercentage === pct ? "bg-amber-500 text-slate-950 border-amber-400" : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* Split Result Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-amber-500/10 border-2 border-amber-500/40">
                <span className="text-[11px] uppercase font-bold text-amber-400 tracking-wider block mb-1">Shop Profit</span>
                <span className="text-2xl font-black text-amber-300 font-mono">Rs. {shop_profit.toFixed(2)}</span>
                <p className="text-[11px] text-amber-400/70 mt-0.5">{calcCommission}% retained</p>
              </div>
              <div className="p-4 rounded-xl bg-emerald-500/10 border-2 border-emerald-500/40">
                <span className="text-[11px] uppercase font-bold text-emerald-400 tracking-wider block mb-1">Student Payout</span>
                <span className="text-2xl font-black text-emerald-300 font-mono">Rs. {seller_payout.toFixed(2)}</span>
                <p className="text-[11px] text-emerald-400/70 mt-0.5">{100 - calcCommission}% to student</p>
              </div>
            </div>

            {/* Visual split bar */}
            <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
              <div style={{ width: `${calcCommission}%` }} className="bg-amber-500 transition-all duration-150" />
              <div style={{ width: `${100 - calcCommission}%` }} className="bg-emerald-500 transition-all duration-150" />
            </div>
          </div>
        </div>

        {/* ── Right Column: Receipt + Confirm + History ── */}
        <div className="lg:col-span-5 space-y-5">

          {/* Sale Confirmation Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-dashed border-slate-800">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white">Sale Confirmation</h3>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 font-mono">Supabase: `sales`</span>
            </div>

            {/* Book summary line */}
            <div className="py-3 border-b border-slate-800/80">
              {bookTitle ? (
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h4 className="font-bold text-sm text-white line-clamp-2">{bookTitle}</h4>
                    <p className="text-xs text-slate-400">Consignor: <span className="text-slate-300">{sellerName || "—"}</span></p>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5 truncate max-w-[220px]">{selectedBookId || "—"}</p>
                  </div>
                  <span className="font-mono font-bold text-lg text-white whitespace-nowrap">Rs. {calcSellingPrice.toFixed(2)}</span>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No book selected — pick one from the stock list</p>
              )}
            </div>

            {/* Breakdown table */}
            <div className="space-y-1.5 text-xs font-mono text-slate-300 border-b border-dashed border-slate-800 pb-4">
              {[
                { label: "selling_price", val: `Rs. ${calcSellingPrice.toFixed(2)}`, color: "text-white" },
                { label: "commission_percentage", val: `${calcCommission}%`, color: "text-amber-400" },
                { label: "shop_profit", val: `+Rs. ${shop_profit.toFixed(2)}`, color: "text-amber-300" },
                { label: "seller_payout", val: `Rs. ${seller_payout.toFixed(2)}`, color: "text-emerald-400" },
                { label: "date_sold", val: "CURRENT_TIMESTAMP", color: "text-slate-500" },
              ].map(({ label, val, color }) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans">{label}:</span>
                  <span className={`font-bold ${color}`}>{val}</span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Total Charged</span>
                <p className="text-[11px] text-slate-500">Customer pays (NPR)</p>
              </div>
              <span className="text-3xl font-black text-amber-400 font-mono">Rs. {calcSellingPrice.toFixed(2)}</span>
            </div>

            {/* Notification */}
            {notification && (
              <div className={`p-3.5 rounded-xl border text-xs flex items-start gap-2 ${
                notification.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : notification.type === "error" ? "bg-red-500/10 border-red-500/30 text-red-300"
                : "bg-blue-500/10 border-blue-500/30 text-blue-300"
              }`}>
                {notification.type === "success"
                  ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
                  : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                <div>
                  <p className="font-bold">{notification.message}</p>
                  {notification.details && <p className="mt-0.5 opacity-90 leading-relaxed font-sans">{notification.details}</p>}
                </div>
              </div>
            )}

            {/* Confirm Button */}
            <button
              onClick={handleConfirmSale}
              disabled={isSubmitting || !selectedBookId}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm uppercase tracking-wide shadow-lg shadow-amber-500/25 active:scale-[0.99] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Recording Sale...</>
              ) : (
                <><CheckCircle2 className="w-5 h-5" /> Confirm Sale — Rs. {calcSellingPrice.toFixed(2)}</>
              )}
            </button>
          </div>

          {/* Sales History */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-amber-400" />
                Completed Sales
              </h4>
              <span className="text-[11px] text-slate-500 font-mono">{salesLog.length} records</span>
            </div>

            {isLoadingSales ? (
              <div className="flex items-center justify-center gap-2 py-6 text-slate-400 text-xs">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" /> Loading sales history...
              </div>
            ) : salesLog.length === 0 ? (
              <div className="py-6 text-center text-slate-500 text-xs italic">
                No sales recorded yet. Confirm your first sale above.
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {salesLog.map((sale) => (
                  <div key={sale.sale_id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-white truncate max-w-[180px]">{sale.book_title}</span>
                      <span className="font-mono font-bold text-amber-400 whitespace-nowrap">Rs. {sale.selling_price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                      <span>Shop: <strong className="text-amber-400">+Rs. {sale.shop_profit.toFixed(2)}</strong></span>
                      <span>Student: <strong className="text-emerald-400">Rs. {sale.seller_payout.toFixed(2)}</strong></span>
                      <span className="text-slate-500">{sale.date_sold}</span>
                    </div>
                    <p className="text-[10px] text-slate-600 font-mono truncate border-t border-slate-800/60 pt-1">
                      sale_id: {sale.sale_id}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-800/80 bg-slate-950/60 py-3 px-6 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
        <span>medicoessentials old book POS • DH KUSMS</span>
        <span className="font-mono text-[11px] text-slate-400">All data live from Supabase · No mock data</span>
      </footer>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center gap-3 text-sm">
        <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
        Loading POS Register...
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}

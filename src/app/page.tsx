"use client";

import React, { useState, useEffect, useCallback, Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  History,
  RefreshCw,
  ShoppingCart,
  BookOpen,
  PackageOpen,
  Search,
  Plus,
  Trash2,
  CreditCard,
  User,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// ─── Payment Modes ───────────────────────────────────────────────────────────
export const PAYMENT_MODES = [
  "Cash",
  "Fonepay",
  "Qr to abhinav",
  "Qr to adwait",
  "Saha esewa",
  "Unpaid",
] as const;

export type CustomerPaymentMode = typeof PAYMENT_MODES[number];

// ─── Types ────────────────────────────────────────────────────────────────────
interface BookStockItem {
  book_id: string;
  title: string;
  target_price: number | null;
  seller_id?: string;
  seller_name: string;
}

interface CartItem {
  book_id: string;
  title: string;
  seller_name: string;
  target_price: number | null;
  selling_price: number;
  commission_percentage: number | null;
  shop_profit: number | null;
  seller_payout: number | null;
}

interface CompletedSaleRecord {
  sale_id: string;
  book_id: string | null;
  book_title: string;
  seller_name: string;
  selling_price: number;
  commission_percentage: number | null;
  shop_profit: number | null;
  seller_payout: number | null;
  customer_payment_mode?: string;
  customer_description?: string | null;
  date_sold: string;
}

// ─── Main Checkout & Cart Component ──────────────────────────────────────────
function CheckoutContent() {
  const searchParams = useSearchParams();
  const prefillBookId = searchParams.get("bookId");

  // In-stock books list
  const [stockBooks, setStockBooks] = useState<BookStockItem[]>([]);
  const [isLoadingStock, setIsLoadingStock] = useState<boolean>(true);
  const [stockError, setStockError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);

  // Checkout Payment Form State
  const [paymentMode, setPaymentMode] = useState<CustomerPaymentMode>("Cash");
  const [customerDescription, setCustomerDescription] = useState<string>("");

  // UI State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
    details?: string;
  } | null>(null);

  // Completed Sales History
  const [salesLog, setSalesLog] = useState<CompletedSaleRecord[]>([]);
  const [isLoadingSales, setIsLoadingSales] = useState<boolean>(true);

  // ── Fetch In-Stock Books from Supabase ────────────────────────────────────
  const loadStockBooks = useCallback(async () => {
    setIsLoadingStock(true);
    setStockError(null);
    try {
      let data: any[] | null = null;
      try {
        const res = await supabase
          .from("books")
          .select(`book_id, title, target_price, seller_id, sellers ( name )`)
          .eq("status", "In Stock")
          .order("created_at", { ascending: false });

        if (res.error) throw res.error;
        data = res.data;
      } catch {
        const res = await supabase
          .from("books")
          .select(`book_id, title, seller_id, sellers ( name )`)
          .eq("status", "In Stock")
          .order("created_at", { ascending: false });

        if (res.error) throw res.error;
        data = res.data;
      }

      const mapped: BookStockItem[] = (data ?? []).map((b: any) => {
        const sellerObj = Array.isArray(b.sellers) ? b.sellers[0] : b.sellers;
        return {
          book_id: b.book_id,
          title: b.title,
          target_price: b.target_price !== undefined && b.target_price !== null ? Number(b.target_price) : null,
          seller_id: b.seller_id,
          seller_name: sellerObj?.name || "Direct Seller",
        };
      });

      setStockBooks(mapped);

      // Handle ?bookId= prefill
      if (prefillBookId) {
        const target = mapped.find((b) => b.book_id === prefillBookId);
        if (target) {
          setCart((prev) => {
            if (prev.some((item) => item.book_id === target.book_id)) return prev;
            const defaultPrice = target.target_price ?? 0;
            return [
              ...prev,
              {
                book_id: target.book_id,
                title: target.title,
                seller_name: target.seller_name,
                target_price: target.target_price,
                selling_price: defaultPrice,
                commission_percentage: null,
                shop_profit: null,
                seller_payout: null,
              },
            ];
          });
        }
      }
    } catch (err: any) {
      console.error("Failed to load stock books:", err);
      setStockError(err?.message || "Could not connect to Supabase.");
    } finally {
      setIsLoadingStock(false);
    }
  }, [prefillBookId]);

  // ── Fetch Recent Sales History from Supabase ──────────────────────────────
  const loadRecentSales = useCallback(async () => {
    setIsLoadingSales(true);
    try {
      let data: any[] | null = null;
      try {
        const res = await supabase
          .from("sales")
          .select(`
            sale_id,
            book_id,
            selling_price,
            commission_percentage,
            shop_profit,
            seller_payout,
            customer_payment_mode,
            customer_description,
            date_sold,
            books (
              title,
              sellers ( name )
            )
          `)
          .order("date_sold", { ascending: false })
          .limit(15);
        if (res.error) throw res.error;
        data = res.data;
      } catch {
        const res = await supabase
          .from("sales")
          .select(`
            sale_id,
            book_id,
            selling_price,
            commission_percentage,
            shop_profit,
            seller_payout,
            date_sold,
            books (
              title,
              sellers ( name )
            )
          `)
          .order("date_sold", { ascending: false })
          .limit(15);
        if (res.error) throw res.error;
        data = res.data;
      }

      if (data) {
        const mapped: CompletedSaleRecord[] = data.map((s: any) => {
          const bookObj = Array.isArray(s.books) ? s.books[0] : s.books;
          const sellerObj = Array.isArray(bookObj?.sellers) ? bookObj.sellers[0] : bookObj?.sellers;
          return {
            sale_id: s.sale_id,
            book_id: s.book_id,
            book_title: bookObj?.title || "Book Sale",
            seller_name: sellerObj?.name || "Seller",
            selling_price: Number(s.selling_price),
            commission_percentage: s.commission_percentage !== null ? Number(s.commission_percentage) : null,
            shop_profit: s.shop_profit !== null ? Number(s.shop_profit) : null,
            seller_payout: s.seller_payout !== null ? Number(s.seller_payout) : null,
            customer_payment_mode: s.customer_payment_mode || "Cash",
            customer_description: s.customer_description || null,
            date_sold: new Date(s.date_sold).toLocaleString("en-NP", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
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
    loadStockBooks();
    loadRecentSales();
  }, [loadStockBooks, loadRecentSales]);

  // ── Cart Operations ───────────────────────────────────────────────────────
  const handleAddToCart = (book: BookStockItem) => {
    if (cart.some((item) => item.book_id === book.book_id)) return;

    const defaultPrice = book.target_price !== null ? book.target_price : 0;
    setCart((prev) => [
      ...prev,
      {
        book_id: book.book_id,
        title: book.title,
        seller_name: book.seller_name,
        target_price: book.target_price,
        selling_price: defaultPrice,
        commission_percentage: null,
        shop_profit: null,
        seller_payout: null,
      },
    ]);
    setNotification(null);
  };

  const handleRemoveFromCart = (bookId: string) => {
    setCart((prev) => prev.filter((item) => item.book_id !== bookId));
  };

  const handleUpdateCartPrice = (bookId: string, price: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.book_id !== bookId) return item;
        const validPrice = Math.max(0, price);
        let profit = item.shop_profit;
        let payout = item.seller_payout;
        if (item.commission_percentage !== null) {
          profit = Number(((validPrice * item.commission_percentage) / 100).toFixed(2));
          payout = Number((validPrice - profit).toFixed(2));
        }
        return {
          ...item,
          selling_price: validPrice,
          shop_profit: profit,
          seller_payout: payout,
        };
      })
    );
  };

  const handleUpdateCartCommission = (bookId: string, commissionStr: string) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.book_id !== bookId) return item;
        if (commissionStr.trim() === "") {
          return {
            ...item,
            commission_percentage: null,
            shop_profit: null,
            seller_payout: null,
          };
        }
        const pct = Math.min(100, Math.max(0, parseFloat(commissionStr) || 0));
        const profit = Number(((item.selling_price * pct) / 100).toFixed(2));
        const payout = Number((item.selling_price - profit).toFixed(2));
        return {
          ...item,
          commission_percentage: pct,
          shop_profit: profit,
          seller_payout: payout,
        };
      })
    );
  };

  const handleClearCart = () => {
    setCart([]);
    setCustomerDescription("");
  };

  // ── Cart Calculations ─────────────────────────────────────────────────────
  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.selling_price || 0), 0);
  }, [cart]);

  const cartEstimatedProfit = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.shop_profit || 0), 0);
  }, [cart]);

  const cartEstimatedPayout = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.seller_payout || 0), 0);
  }, [cart]);

  // ── Confirm Sale (Checkout Cart) ──────────────────────────────────────────
  const handleConfirmCheckout = async () => {
    if (cart.length === 0) {
      setNotification({
        type: "error",
        message: "Cart is Empty",
        details: "Search and add at least one book to the cart before checking out.",
      });
      return;
    }

    const invalidItem = cart.find((item) => !item.selling_price || item.selling_price <= 0);
    if (invalidItem) {
      setNotification({
        type: "error",
        message: "Invalid Selling Price",
        details: `"${invalidItem.title}" has a price of Rs. 0. Please enter a valid selling price.`,
      });
      return;
    }

    setIsSubmitting(true);
    setNotification(null);

    try {
      const nowIso = new Date().toISOString();
      const newRecordedSales: CompletedSaleRecord[] = [];

      for (const item of cart) {
        let insertedSaleId: string = `TXN-${Date.now().toString().slice(-6)}`;

        const salePayload: any = {
          book_id: item.book_id,
          selling_price: item.selling_price,
          commission_percentage: item.commission_percentage,
          shop_profit: item.shop_profit,
          seller_payout: item.seller_payout,
          customer_payment_mode: paymentMode,
          customer_description: customerDescription.trim() || null,
          date_sold: nowIso,
        };

        try {
          const { data, error } = await supabase.from("sales").insert([salePayload]).select();
          if (error) throw error;
          if (data && data[0]?.sale_id) insertedSaleId = data[0].sale_id;
        } catch (err: any) {
          if (err?.message?.includes("customer_payment_mode") || err?.message?.includes("customer_description")) {
            const fallbackPayload = {
              book_id: item.book_id,
              selling_price: item.selling_price,
              commission_percentage: item.commission_percentage ?? 0,
              shop_profit: item.shop_profit ?? 0,
              seller_payout: item.seller_payout ?? item.selling_price,
              date_sold: nowIso,
            };
            const { data, error } = await supabase.from("sales").insert([fallbackPayload]).select();
            if (error) throw error;
            if (data && data[0]?.sale_id) insertedSaleId = data[0].sale_id;
          } else {
            throw err;
          }
        }

        await supabase.from("books").update({ status: "sold" }).eq("book_id", item.book_id);

        newRecordedSales.push({
          sale_id: insertedSaleId,
          book_id: item.book_id,
          book_title: item.title,
          seller_name: item.seller_name,
          selling_price: item.selling_price,
          commission_percentage: item.commission_percentage,
          shop_profit: item.shop_profit,
          seller_payout: item.seller_payout,
          customer_payment_mode: paymentMode,
          customer_description: customerDescription.trim() || null,
          date_sold: new Date().toLocaleString("en-NP", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
        });
      }

      setSalesLog((prev) => [...newRecordedSales, ...prev]);
      setNotification({
        type: "success",
        message: `Successfully checked out ${cart.length} book(s)!`,
        details: `Total: Rs. ${cartTotal.toFixed(2)} · Payment Channel: ${paymentMode}${
          customerDescription ? ` · Note: "${customerDescription}"` : ""
        }`,
      });

      setCart([]);
      setCustomerDescription("");
      loadStockBooks();
    } catch (err: any) {
      console.error("Checkout error:", err);
      setNotification({
        type: "error",
        message: "Failed to complete checkout",
        details: err?.message || "Please check network or database permissions.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredStock = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return stockBooks;
    return stockBooks.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.book_id.toLowerCase().includes(q) ||
        b.seller_name.toLowerCase().includes(q)
    );
  }, [stockBooks, searchQuery]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">
      {/* Top Header Banner */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-slate-800" />
              POS Cart & Checkout Register
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Select books into cart, review target prices, select payment mode and complete checkout
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 bg-gray-100 border border-gray-200 rounded text-gray-700 font-mono">
              In Stock: <strong className="text-gray-900">{stockBooks.length}</strong>
            </span>
            <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded text-slate-900 font-mono font-bold">
              Cart: {cart.length} item(s) · Rs. {cartTotal.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ── Left Column: Inventory Search (5 cols) ── */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-gray-200 rounded-md p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-slate-800" />
                Available Inventory
              </h2>
              <button
                onClick={loadStockBooks}
                disabled={isLoadingStock}
                className="p-1 rounded text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition"
                title="Refresh stock"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStock ? "animate-spin text-slate-800" : ""}`} />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search title, Book ID, or seller..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-7 py-2 bg-gray-50 border border-gray-300 rounded text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-slate-800"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 px-1"
                >
                  ×
                </button>
              )}
            </div>

            {/* Loading / Error States */}
            {isLoadingStock && (
              <div className="flex items-center justify-center gap-2 py-8 text-gray-500 text-xs">
                <RefreshCw className="w-4 h-4 animate-spin text-slate-800" /> Loading in-stock inventory...
              </div>
            )}

            {!isLoadingStock && stockError && (
              <div className="p-3 rounded bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{stockError}</span>
              </div>
            )}

            {/* Empty State */}
            {!isLoadingStock && !stockError && stockBooks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
                <PackageOpen className="w-8 h-8 text-gray-400" />
                <p className="text-xs font-bold text-gray-700">No books currently in stock</p>
                <p className="text-[11px] text-gray-500 max-w-xs">
                  Register new books on the{" "}
                  <Link href="/intake" className="text-blue-900 underline font-semibold">
                    Book Intake
                  </Link>{" "}
                  page.
                </p>
              </div>
            )}

            {/* Book Cards */}
            {!isLoadingStock && filteredStock.length > 0 && (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {filteredStock.map((book) => {
                  const isInCart = cart.some((c) => c.book_id === book.book_id);
                  return (
                    <div
                      key={book.book_id}
                      className={`p-3 rounded border transition flex items-center justify-between gap-3 ${
                        isInCart ? "bg-slate-50 border-slate-300" : "bg-white border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="truncate flex-1">
                        <p className="font-semibold text-xs text-gray-900 truncate">{book.title}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                          Seller: <span className="text-gray-700 font-medium">{book.seller_name}</span>
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                            Target Price:
                          </span>
                          {book.target_price !== null ? (
                            <span className="text-xs font-bold font-mono text-emerald-700">
                              Rs. {book.target_price.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-[11px] text-gray-400 italic">Not set</span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleAddToCart(book)}
                        disabled={isInCart}
                        className={`px-3 py-1.5 rounded text-xs font-semibold transition flex items-center gap-1 shrink-0 ${
                          isInCart
                            ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
                            : "bg-slate-800 hover:bg-slate-900 text-white cursor-pointer active:scale-95"
                        }`}
                      >
                        {isInCart ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-gray-500" />
                            <span>In Cart</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add to Cart</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {!isLoadingStock && filteredStock.length === 0 && stockBooks.length > 0 && (
              <p className="text-xs text-gray-500 py-6 text-center italic">
                No matching books found for &quot;{searchQuery}&quot;.
              </p>
            )}
          </div>
        </div>

        {/* ── Right Column: Checkout & Cart (7 cols) ── */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-gray-200 rounded-md p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-slate-800" />
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Checkout Window</h2>
                <span className="px-2 py-0.5 rounded bg-gray-100 border border-gray-200 text-gray-700 text-xs font-mono font-semibold">
                  {cart.length} {cart.length === 1 ? "item" : "items"}
                </span>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={handleClearCart}
                  className="text-xs text-red-600 hover:text-red-700 font-medium flex items-center gap-1 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Clear Cart
                </button>
              )}
            </div>

            {/* Cart Items */}
            {cart.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-2 border border-dashed border-gray-200 rounded p-6 bg-gray-50">
                <ShoppingCart className="w-8 h-8 text-gray-400" />
                <p className="text-xs font-bold text-gray-700">Your Cart is Empty</p>
                <p className="text-[11px] text-gray-500 max-w-sm">
                  Search inventory on the left and click &quot;+ Add to Cart&quot; to begin building this transaction.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {cart.map((item, index) => (
                  <div key={item.book_id} className="p-3.5 rounded border border-gray-200 bg-gray-50 space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="truncate flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded bg-slate-800 text-white text-[10px] font-bold flex items-center justify-center">
                            {index + 1}
                          </span>
                          <p className="font-bold text-xs text-gray-900 truncate">{item.title}</p>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5 pl-5">
                          Seller: <span className="text-gray-700 font-medium">{item.seller_name}</span>
                          {item.target_price !== null && (
                            <span className="text-gray-400 ml-2">
                              (Target: Rs. {item.target_price.toLocaleString()})
                            </span>
                          )}
                        </p>
                      </div>

                      <button
                        onClick={() => handleRemoveFromCart(item.book_id)}
                        className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-white transition"
                        title="Remove from cart"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Price and Commission Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-200">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-700 mb-1">
                          Selling Price (Rs.) *
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xs">
                            Rs.
                          </span>
                          <input
                            type="number"
                            step="10"
                            min="0"
                            value={item.selling_price}
                            onChange={(e) =>
                              handleUpdateCartPrice(item.book_id, parseFloat(e.target.value) || 0)
                            }
                            className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-gray-300 rounded text-xs text-gray-900 font-mono font-bold focus:outline-none focus:border-slate-800"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-700">
                            Shop Commission %
                          </label>
                          <span className="text-[10px] text-gray-400 font-mono">(Optional)</span>
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="Optional (e.g. 20)"
                            value={item.commission_percentage !== null ? item.commission_percentage : ""}
                            onChange={(e) => handleUpdateCartCommission(item.book_id, e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded text-xs text-gray-900 font-mono placeholder:text-gray-400 focus:outline-none focus:border-slate-800"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                        </div>
                      </div>
                    </div>

                    {item.commission_percentage !== null && item.shop_profit !== null && item.seller_payout !== null && (
                      <div className="flex justify-between items-center bg-white px-2.5 py-1 rounded text-[11px] font-mono border border-gray-200 text-gray-600">
                        <span>Shop cut: +Rs. {item.shop_profit.toFixed(2)}</span>
                        <span>Seller payout: Rs. {item.seller_payout.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Payment Details & Total */}
            {cart.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-gray-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1 flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5 text-gray-500" />
                      Payment Mode *
                    </label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value as CustomerPaymentMode)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-xs text-gray-900 font-medium focus:outline-none focus:border-slate-800"
                    >
                      {PAYMENT_MODES.map((mode) => (
                        <option key={mode} value={mode}>
                          {mode}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-gray-500" />
                      Customer Notes
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Dr. Aryan 2022 batch, Ref #4928"
                      value={customerDescription}
                      onChange={(e) => setCustomerDescription(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-slate-800"
                    />
                  </div>
                </div>

                {/* Total Summary */}
                <div className="p-3.5 rounded border border-gray-200 bg-gray-50 space-y-1.5">
                  <div className="flex justify-between items-center text-xs text-gray-600 font-mono">
                    <span>Items Count:</span>
                    <span className="font-bold text-gray-900">{cart.length}</span>
                  </div>

                  {cartEstimatedProfit > 0 && (
                    <div className="flex justify-between items-center text-xs text-gray-700 font-mono">
                      <span>Calculated Shop Profit:</span>
                      <span className="font-bold">+Rs. {cartEstimatedProfit.toFixed(2)}</span>
                    </div>
                  )}

                  {cartEstimatedPayout > 0 && (
                    <div className="flex justify-between items-center text-xs text-gray-700 font-mono">
                      <span>Calculated Seller Payout:</span>
                      <span className="font-bold">Rs. {cartEstimatedPayout.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-gray-200 flex justify-between items-baseline">
                    <div>
                      <span className="text-xs uppercase tracking-wider font-bold text-gray-900">
                        Total Amount Due
                      </span>
                      <p className="text-[11px] text-gray-500 font-sans">Payment channel: {paymentMode}</p>
                    </div>
                    <span className="text-2xl font-black text-slate-900 font-mono">
                      Rs. {cartTotal.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Notification */}
                {notification && (
                  <div
                    className={`p-3 rounded border text-xs flex items-start gap-2 ${
                      notification.type === "success"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : "bg-red-50 border-red-200 text-red-800"
                    }`}
                  >
                    {notification.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
                    )}
                    <div>
                      <p className="font-bold">{notification.message}</p>
                      {notification.details && <p className="mt-0.5 text-gray-600">{notification.details}</p>}
                    </div>
                  </div>
                )}

                {/* Checkout Submit Button */}
                <button
                  onClick={handleConfirmCheckout}
                  disabled={isSubmitting || cart.length === 0}
                  className="w-full py-3 px-4 rounded bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Processing Sale...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Confirm Checkout ({cart.length} Books · Rs.{" "}
                      {cartTotal.toFixed(2)})
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Sales History Log */}
          <div className="bg-white border border-gray-200 rounded-md p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-slate-800" />
                Recent Sales
              </h4>
              <span className="text-[11px] text-gray-500 font-mono">{salesLog.length} recorded</span>
            </div>

            {isLoadingSales ? (
              <div className="flex items-center justify-center gap-2 py-6 text-gray-500 text-xs">
                <RefreshCw className="w-4 h-4 animate-spin text-slate-800" /> Loading sales history...
              </div>
            ) : salesLog.length === 0 ? (
              <div className="py-6 text-center text-gray-400 text-xs italic">
                No sales recorded yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {salesLog.map((sale) => (
                  <div key={sale.sale_id} className="p-2.5 rounded border border-gray-200 bg-gray-50 text-xs space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-gray-900 truncate max-w-[200px]">{sale.book_title}</span>
                      <span className="font-mono font-bold text-gray-900 whitespace-nowrap">
                        Rs. {sale.selling_price.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-600 font-mono">
                      <span className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-800 font-semibold text-[10px]">
                        {sale.customer_payment_mode || "Cash"}
                      </span>
                      <span>Seller: {sale.seller_name}</span>
                      <span className="text-gray-400">{sale.date_sold}</span>
                    </div>

                    {sale.customer_description && (
                      <p className="text-[10px] text-gray-600 bg-white px-2 py-0.5 rounded border border-gray-200">
                        Note: {sale.customer_description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 bg-white py-3 px-6 text-center text-xs text-gray-500 flex flex-wrap items-center justify-between gap-2">
        <span>medicoessentials old book POS · DH KUSMS</span>
        <span className="font-mono text-[11px] text-gray-400">All data live from Supabase</span>
      </footer>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center gap-2 text-xs">
          <RefreshCw className="w-4 h-4 animate-spin text-slate-800" />
          Loading POS Register...
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}

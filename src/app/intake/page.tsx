"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookPlus,
  CheckCircle2,
  Copy,
  Check,
  Printer,
  ArrowRight,
  Barcode,
  Search,
  BookOpen,
  Phone,
  AlertCircle,
  Trash2,
  Lock,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface Seller {
  seller_id: string;
  name: string;
  phone: string;
  total_pending_balance: number;
}

interface IntakeRecord {
  book_id: string;
  title: string;
  seller_id: string;
  seller_name: string;
  seller_phone: string;
  target_price: number | null;
  created_at: string;
}

export default function BookIntakePage() {
  const router = useRouter();

  // Mode: "new" seller or "existing" seller
  const [sellerMode, setSellerMode] = useState<"new" | "existing">("new");

  // New Seller Fields
  const [sellerName, setSellerName] = useState("");
  const [sellerPhone, setSellerPhone] = useState("");

  // Existing Sellers List & Selection
  const [existingSellers, setExistingSellers] = useState<Seller[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState("");
  const [sellerSearch, setSellerSearch] = useState("");

  // Map of seller_id -> number of unsold books (status !== 'sold')
  const [sellerUnsoldCounts, setSellerUnsoldCounts] = useState<Record<string, number>>({});
  const [isDeletingSeller, setIsDeletingSeller] = useState<string | null>(null);

  // Book Intake Fields - price starts completely blank
  const [bookTitle, setBookTitle] = useState("");
  const [targetPrice, setTargetPrice] = useState<string>("");

  // States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastIntake, setLastIntake] = useState<IntakeRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [recentIntakes, setRecentIntakes] = useState<IntakeRecord[]>([]);

  // Fetch registered sellers and their unsold book counts
  const fetchSellersAndCounts = useCallback(async () => {
    try {
      const [sellersRes, booksRes] = await Promise.all([
        supabase
          .from("sellers")
          .select("seller_id, name, phone, total_pending_balance")
          .order("name", { ascending: true }),
        supabase
          .from("books")
          .select("book_id, seller_id, status"),
      ]);

      if (sellersRes.data) {
        setExistingSellers(sellersRes.data);
        if (sellersRes.data.length > 0 && !selectedSellerId) {
          setSelectedSellerId(sellersRes.data[0].seller_id);
        }
      }

      if (booksRes.data) {
        const counts: Record<string, number> = {};
        for (const b of booksRes.data) {
          if (b.seller_id) {
            const isUnsold = b.status !== "sold";
            if (isUnsold) {
              counts[b.seller_id] = (counts[b.seller_id] || 0) + 1;
            } else if (!(b.seller_id in counts)) {
              counts[b.seller_id] = 0;
            }
          }
        }
        setSellerUnsoldCounts(counts);
      }
    } catch (err) {
      console.warn("Could not fetch sellers and counts:", err);
    }
  }, [selectedSellerId]);

  // Fetch recent intake books
  const fetchRecentIntakes = useCallback(async () => {
    try {
      let data: any[] | null = null;
      try {
        const res = await supabase
          .from("books")
          .select(`
            book_id,
            title,
            seller_id,
            target_price,
            created_at,
            sellers (
              name,
              phone
            )
          `)
          .order("created_at", { ascending: false })
          .limit(8);
        if (res.data) data = res.data;
      } catch {
        const res = await supabase
          .from("books")
          .select(`
            book_id,
            title,
            seller_id,
            created_at,
            sellers (
              name,
              phone
            )
          `)
          .order("created_at", { ascending: false })
          .limit(8);
        if (res.data) data = res.data;
      }

      if (data) {
        const formatted: IntakeRecord[] = data.map((b: any) => {
          const sellerObj = Array.isArray(b.sellers) ? b.sellers[0] : b.sellers;
          return {
            book_id: b.book_id,
            title: b.title,
            seller_id: b.seller_id,
            seller_name: sellerObj?.name || "Direct Seller",
            seller_phone: sellerObj?.phone || "N/A",
            target_price: b.target_price ? Number(b.target_price) : null,
            created_at: new Date(b.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
        });
        setRecentIntakes(formatted);
      }
    } catch (err) {
      console.warn("Could not fetch recent intakes:", err);
    }
  }, []);

  useEffect(() => {
    fetchSellersAndCounts();
    fetchRecentIntakes();
  }, [fetchSellersAndCounts, fetchRecentIntakes]);

  // Handle Complete Intake
  const handleIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!bookTitle.trim()) {
      setErrorMessage("Please enter a valid Book Title.");
      return;
    }

    let targetSellerId = selectedSellerId;
    let targetSellerName = "";
    let targetSellerPhone = "";

    if (sellerMode === "new") {
      if (!sellerName.trim()) {
        setErrorMessage("Please enter the seller's name.");
        return;
      }
      targetSellerName = sellerName.trim();
      targetSellerPhone = sellerPhone.trim() || "N/A";
    } else {
      const found = existingSellers.find((s) => s.seller_id === selectedSellerId);
      if (!found) {
        setErrorMessage("Please select an existing seller.");
        return;
      }
      targetSellerId = found.seller_id;
      targetSellerName = found.name;
      targetSellerPhone = found.phone;
    }

    setIsSubmitting(true);

    try {
      if (sellerMode === "new") {
        const { data: newSeller, error: sellerErr } = await supabase
          .from("sellers")
          .insert([{ name: targetSellerName, phone: targetSellerPhone, total_pending_balance: 0.0 }])
          .select()
          .single();

        if (sellerErr) throw sellerErr;
        targetSellerId = newSeller.seller_id;
      }

      const parsedTargetPrice = targetPrice.trim() !== "" ? parseFloat(targetPrice) : null;

      let newBook: any = null;
      try {
        const res = await supabase
          .from("books")
          .insert([
            {
              seller_id: targetSellerId,
              title: bookTitle.trim(),
              target_price: parsedTargetPrice,
              status: "In Stock",
            },
          ])
          .select()
          .single();
        if (res.error) throw res.error;
        newBook = res.data;
      } catch (err: any) {
        if (err?.message?.includes("target_price")) {
          const res = await supabase
            .from("books")
            .insert([
              {
                seller_id: targetSellerId,
                title: bookTitle.trim(),
                status: "In Stock",
              },
            ])
            .select()
            .single();
          if (res.error) throw res.error;
          newBook = res.data;
        } else {
          throw err;
        }
      }

      const record: IntakeRecord = {
        book_id: newBook.book_id,
        title: newBook.title,
        seller_id: targetSellerId,
        seller_name: targetSellerName,
        seller_phone: targetSellerPhone,
        target_price: parsedTargetPrice,
        created_at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setLastIntake(record);
      setRecentIntakes((prev) => [record, ...prev]);
      fetchSellersAndCounts();

      setBookTitle("");
      setTargetPrice("");
    } catch (err: any) {
      console.error("Intake Error:", err);
      setErrorMessage(err?.message || "Failed to complete book intake.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSeller = async (seller: Seller, e: React.MouseEvent) => {
    e.stopPropagation();
    const unsold = sellerUnsoldCounts[seller.seller_id] || 0;
    if (unsold > 0) {
      alert(`Cannot delete seller "${seller.name}". They have ${unsold} book(s) in stock. All books must be marked as sold before deleting.`);
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to delete seller "${seller.name}"?`);
    if (!confirmed) return;

    setIsDeletingSeller(seller.seller_id);
    try {
      const { error } = await supabase
        .from("sellers")
        .delete()
        .eq("seller_id", seller.seller_id);

      if (error) throw error;

      setExistingSellers((prev) => prev.filter((s) => s.seller_id !== seller.seller_id));
      if (selectedSellerId === seller.seller_id) {
        const remaining = existingSellers.filter((s) => s.seller_id !== seller.seller_id);
        setSelectedSellerId(remaining.length > 0 ? remaining[0].seller_id : "");
      }
    } catch (err: any) {
      alert(`Failed to delete seller: ${err?.message || err}`);
    } finally {
      setIsDeletingSeller(null);
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredExistingSellers = useMemo(() => {
    return existingSellers.filter(
      (s) =>
        s.name.toLowerCase().includes(sellerSearch.toLowerCase()) ||
        s.phone.includes(sellerSearch)
    );
  }, [existingSellers, sellerSearch]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">
      {/* Top Banner */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <BookPlus className="w-5 h-5 text-slate-800" />
              Book Intake & Seller Registration
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Register book sellers, record textbooks, and assign Book IDs
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/inventory"
              className="px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 transition flex items-center gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5 text-slate-700" />
              View Stock
            </Link>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Intake Form (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <form onSubmit={handleIntakeSubmit} className="bg-white border border-gray-200 rounded-md p-5 space-y-5">
            {/* Step 1: Seller Details */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-slate-800 text-white font-bold text-xs flex items-center justify-center">
                    1
                  </span>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                    Seller Information
                  </h2>
                </div>

                {/* Seller Mode Selector */}
                <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded border border-gray-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setSellerMode("new")}
                    className={`px-2.5 py-1 rounded transition text-xs font-semibold ${
                      sellerMode === "new"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    + New Seller
                  </button>
                  <button
                    type="button"
                    onClick={() => setSellerMode("existing")}
                    className={`px-2.5 py-1 rounded transition text-xs font-semibold ${
                      sellerMode === "existing"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    Existing Seller ({existingSellers.length})
                  </button>
                </div>
              </div>

              {sellerMode === "new" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Seller Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Aarav Sharma"
                      value={sellerName}
                      onChange={(e) => setSellerName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. +977 9841234567"
                      value={sellerPhone}
                      onChange={(e) => setSellerPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-slate-800 font-mono"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search existing sellers..."
                      value={sellerSearch}
                      onChange={(e) => setSellerSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-300 rounded text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-slate-800"
                    />
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {filteredExistingSellers.length === 0 ? (
                      <p className="text-xs text-gray-400 py-3 text-center italic">No sellers found.</p>
                    ) : (
                      filteredExistingSellers.map((seller) => {
                        const unsold = sellerUnsoldCounts[seller.seller_id] || 0;
                        const canDelete = unsold === 0;
                        const isSelected = selectedSellerId === seller.seller_id;
                        return (
                          <div
                            key={seller.seller_id}
                            onClick={() => setSelectedSellerId(seller.seller_id)}
                            className={`p-2.5 rounded border transition flex items-center justify-between text-xs cursor-pointer ${
                              isSelected
                                ? "bg-slate-50 border-slate-400"
                                : "bg-white border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            <div className="truncate flex-1 mr-2">
                              <p className="font-bold text-gray-900 truncate">{seller.name}</p>
                              <p className="text-[11px] text-gray-500 font-mono">{seller.phone || "No phone"}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">
                                {unsold > 0 ? (
                                  <span className="text-amber-700 font-medium">{unsold} book(s) in stock</span>
                                ) : (
                                  <span className="text-emerald-700 font-medium">✓ All books sold (can delete)</span>
                                )}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {isSelected && <CheckCircle2 className="w-4 h-4 text-slate-800" />}

                              {canDelete ? (
                                <button
                                  type="button"
                                  disabled={isDeletingSeller === seller.seller_id}
                                  onClick={(e) => handleDeleteSeller(seller, e)}
                                  className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-semibold flex items-center gap-1 transition"
                                  title="Delete Seller"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Delete</span>
                                </button>
                              ) : (
                                <span
                                  className="px-2 py-1 rounded bg-gray-100 text-gray-400 border border-gray-200 text-[11px] flex items-center gap-1 cursor-not-allowed"
                                  title={`Cannot delete: ${unsold} book(s) unsold`}
                                >
                                  <Lock className="w-3 h-3" />
                                  <span>In Stock ({unsold})</span>
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Book Details */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                <span className="w-5 h-5 rounded bg-slate-800 text-white font-bold text-xs flex items-center justify-center">
                  2
                </span>
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                  Textbook Information
                </h2>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Book Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BD Chaurasia Human Anatomy (Vol 2)"
                  value={bookTitle}
                  onChange={(e) => setBookTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Target Selling Price (Rs.)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">Rs.</span>
                  <input
                    type="number"
                    step="10"
                    min="0"
                    placeholder="e.g. 1200 (starts blank)"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded text-xs text-gray-900 font-mono font-bold placeholder:text-gray-400 focus:outline-none focus:border-slate-800"
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  Target selling price is visible in Inventory and pre-filled at Checkout.
                </p>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 rounded bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Registering Book...</span>
              ) : (
                <>
                  <BookPlus className="w-4 h-4" />
                  Complete Intake & Generate Book ID
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Slip & History (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {lastIntake ? (
            <div className="bg-white border border-gray-200 rounded-md p-5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Intake Confirmed
                </span>
                <span className="text-[11px] font-mono text-gray-500">{lastIntake.created_at}</span>
              </div>

              {/* Book ID */}
              <div className="p-3 rounded bg-gray-50 border border-gray-200 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Book ID (UUID)
                </span>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-xs font-mono font-bold text-gray-900 break-all select-all">
                    {lastIntake.book_id}
                  </code>
                  <button
                    onClick={() => handleCopyId(lastIntake.book_id)}
                    className="p-1 rounded bg-white hover:bg-gray-100 border border-gray-200 text-gray-600 transition shrink-0"
                    title="Copy UUID"
                  >
                    {copiedId === lastIntake.book_id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Summary Details */}
              <div className="space-y-1.5 text-xs py-2 border-y border-gray-200">
                <div className="flex justify-between">
                  <span className="text-gray-500">Title:</span>
                  <span className="font-bold text-gray-900 truncate max-w-[200px]">{lastIntake.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Seller:</span>
                  <span className="font-medium text-gray-800">{lastIntake.seller_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Phone:</span>
                  <span className="font-mono text-gray-700">{lastIntake.seller_phone}</span>
                </div>
                {lastIntake.target_price !== null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Target Price:</span>
                    <span className="font-mono font-bold text-gray-900">Rs. {lastIntake.target_price.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Initial Status:</span>
                  <span className="font-semibold text-emerald-700">● In Stock</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <Link
                  href={`/checkout?bookId=${encodeURIComponent(lastIntake.book_id)}`}
                  className="w-full py-2.5 px-3 rounded bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <span>Go to Checkout with this Book</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>

                <div className="flex gap-2">
                  <button
                    onClick={() => window.print()}
                    className="flex-1 py-1.5 px-2 rounded border border-gray-300 bg-white hover:bg-gray-50 text-xs font-medium text-gray-700 flex items-center justify-center gap-1 transition"
                  >
                    <Printer className="w-3 h-3" />
                    Print Tag Slip
                  </button>
                  <Link
                    href="/inventory"
                    className="flex-1 py-1.5 px-2 rounded border border-gray-300 bg-white hover:bg-gray-50 text-xs font-medium text-gray-700 flex items-center justify-center gap-1 transition text-center"
                  >
                    View Stock
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-dashed border-gray-300 rounded-md p-8 text-center space-y-2">
              <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-slate-700 mx-auto">
                <Barcode className="w-5 h-5" />
              </div>
              <h3 className="text-xs font-bold text-gray-800">Book ID Tag Generator</h3>
              <p className="text-[11px] text-gray-500 max-w-xs mx-auto">
                Submit seller and book details to generate a unique UUID and consignment slip.
              </p>
            </div>
          )}

          {/* Recent Intakes */}
          <div className="bg-white border border-gray-200 rounded-md p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                Recent Intakes
              </h4>
              <span className="text-[11px] text-gray-500 font-mono">{recentIntakes.length} items</span>
            </div>

            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {recentIntakes.length === 0 ? (
                <p className="text-xs text-gray-400 py-3 text-center italic">No recent intakes.</p>
              ) : (
                recentIntakes.map((record) => (
                  <div
                    key={record.book_id}
                    className="p-2 rounded border border-gray-200 bg-gray-50 text-xs flex items-center justify-between gap-2"
                  >
                    <div className="truncate flex-1">
                      <p className="font-semibold text-gray-900 truncate">{record.title}</p>
                      <p className="text-[11px] text-gray-500 truncate">
                        Seller: {record.seller_name} {record.target_price ? `• Rs. ${record.target_price.toLocaleString()}` : ""}
                      </p>
                    </div>

                    <Link
                      href={`/checkout?bookId=${encodeURIComponent(record.book_id)}`}
                      className="p-1 rounded bg-white hover:bg-slate-800 hover:text-white border border-gray-200 text-gray-500 transition"
                      title="Send to Checkout"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 bg-white py-3 px-6 text-center text-xs text-gray-500 flex flex-wrap items-center justify-between gap-2">
        <span>medicoessentials old book POS · Intake</span>
        <span className="font-mono text-[11px] text-gray-400">All data live from Supabase</span>
      </footer>
    </div>
  );
}

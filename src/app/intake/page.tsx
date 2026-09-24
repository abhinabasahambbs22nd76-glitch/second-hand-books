"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  BookPlus,
  CheckCircle2,
  Copy,
  Check,
  Printer,
  ArrowRight,
  Database,
  Users,
  Barcode,
  Sparkles,
  RefreshCw,
  Search,
  BookOpen,
  Phone,
  Tag,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

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
  created_at: string;
}

export default function BookIntakePage() {
  const router = useRouter();

  // Mode: "new" student or "existing" student
  const [studentMode, setStudentMode] = useState<"new" | "existing">("new");

  // New Student Fields
  const [studentName, setStudentName] = useState("");
  const [studentPhone, setStudentPhone] = useState("");

  // Existing Students List & Selection
  const [existingSellers, setExistingSellers] = useState<Seller[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState("");
  const [sellerSearch, setSellerSearch] = useState("");

  // Book Intake Fields
  const [bookTitle, setBookTitle] = useState("");
  const [bookCondition, setBookCondition] = useState("Good");
  const [estimatedPrice, setEstimatedPrice] = useState<number>(20.0);

  // States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastIntake, setLastIntake] = useState<IntakeRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [recentIntakes, setRecentIntakes] = useState<IntakeRecord[]>([]);

  const fetchSellers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("sellers")
        .select("seller_id, name, phone, total_pending_balance")
        .order("name", { ascending: true });

      if (!error && data) {
        setExistingSellers(data);
        if (data.length > 0 && !selectedSellerId) {
          setSelectedSellerId(data[0].seller_id);
        }
      }
    } catch (err) {
      console.warn("Could not fetch sellers:", err);
    }
  }, [selectedSellerId]);

  const fetchRecentIntakes = useCallback(async () => {
    try {
      const { data, error } = await supabase
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

      if (!error && data) {
        const formatted: IntakeRecord[] = data.map((b: any) => {
          const sellerObj = Array.isArray(b.sellers) ? b.sellers[0] : b.sellers;
          return {
            book_id: b.book_id,
            title: b.title,
            seller_id: b.seller_id,
            seller_name: sellerObj?.name || "Direct Consignor",
            seller_phone: sellerObj?.phone || "N/A",
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
    fetchSellers();
    fetchRecentIntakes();
  }, [fetchSellers, fetchRecentIntakes]);

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

    if (studentMode === "new") {
      if (!studentName.trim()) {
        setErrorMessage("Please enter the student's name.");
        return;
      }
      targetSellerName = studentName.trim();
      targetSellerPhone = studentPhone.trim() || "+1 (555) 000-0000";
    } else {
      const found = existingSellers.find((s) => s.seller_id === selectedSellerId);
      if (!found) {
        setErrorMessage("Please select an existing student.");
        return;
      }
      targetSellerId = found.seller_id;
      targetSellerName = found.name;
      targetSellerPhone = found.phone;
    }

    setIsSubmitting(true);

    try {
      // If new student, insert into sellers first
      if (studentMode === "new") {
        const { data: newSeller, error: sellerErr } = await supabase
          .from("sellers")
          .insert([{ name: targetSellerName, phone: targetSellerPhone, total_pending_balance: 0.0 }])
          .select()
          .single();

        if (sellerErr) throw sellerErr;
        targetSellerId = newSeller.seller_id;
      }

      // Insert book into books table with status 'In Stock'
      const { data: newBook, error: bookErr } = await supabase
        .from("books")
        .insert([{ seller_id: targetSellerId, title: bookTitle.trim(), status: "In Stock" }])
        .select()
        .single();

      if (bookErr) throw bookErr;

      const record: IntakeRecord = {
        book_id: newBook.book_id,
        title: newBook.title,
        seller_id: targetSellerId,
        seller_name: targetSellerName,
        seller_phone: targetSellerPhone,
        created_at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setLastIntake(record);
      setRecentIntakes((prev) => [record, ...prev]);
      fetchSellers();

      // Reset book fields for subsequent intake
      setBookTitle("");
    } catch (err: any) {
      console.error("Intake Error:", err);
      setErrorMessage(err?.message || "Failed to complete book intake.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredExistingSellers = existingSellers.filter(
    (s) =>
      s.name.toLowerCase().includes(sellerSearch.toLowerCase()) ||
      s.phone.includes(sellerSearch)
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      
      {/* Page Title & Breadcrumb Header */}
      <div className="border-b border-slate-800 bg-slate-950/60 px-4 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2.5">
              <BookPlus className="w-5 h-5 text-blue-400" />
              Book Intake & Student Registration
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Register student consignors, record incoming textbooks, and generate Book IDs
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/inventory"
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 text-xs font-semibold text-slate-300 transition flex items-center gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
              View Stock ({recentIntakes.length})
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Intake Form (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">

          <form onSubmit={handleIntakeSubmit} className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            
            {/* Step 1: Student Information */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold text-xs flex items-center justify-center border border-blue-500/30">
                    1
                  </span>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                    Student / Consignor Details
                  </h2>
                </div>

                {/* Mode Selector Tabs */}
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setStudentMode("new")}
                    className={`px-3 py-1 rounded-lg transition font-medium ${
                      studentMode === "new"
                        ? "bg-blue-500 text-slate-950 font-bold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    + New Student
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudentMode("existing")}
                    className={`px-3 py-1 rounded-lg transition font-medium ${
                      studentMode === "existing"
                        ? "bg-blue-500 text-slate-950 font-bold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Existing Student ({existingSellers.length})
                  </button>
                </div>
              </div>

              {/* Form depending on studentMode */}
              {studentMode === "new" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Student Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Aarav Sharma"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Phone Number *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. +977 9841234567"
                      value={studentPhone}
                      onChange={(e) => setStudentPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search existing student by name or phone..."
                      value={sellerSearch}
                      onChange={(e) => setSellerSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                    {filteredExistingSellers.map((seller) => (
                      <button
                        key={seller.seller_id}
                        type="button"
                        onClick={() => setSelectedSellerId(seller.seller_id)}
                        className={`text-left p-2.5 rounded-xl border transition flex items-center justify-between text-xs ${
                          selectedSellerId === seller.seller_id
                            ? "bg-blue-500/15 border-blue-500 text-white font-semibold"
                            : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850"
                        }`}
                      >
                        <div className="truncate">
                          <p className="font-bold truncate">{seller.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{seller.phone}</p>
                        </div>
                        {selectedSellerId === seller.seller_id && (
                          <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 ml-2" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Book Details */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold text-xs flex items-center justify-center border border-blue-500/30">
                  2
                </span>
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                  Textbook / Book Information
                </h2>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Book Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BD Chaurasia Human Anatomy (Vol 2) or Class 12 Physics"
                  value={bookTitle}
                  onChange={(e) => setBookTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />

                {/* Quick Sugggestions */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                  <span className="text-[10px] text-slate-400">Quick fill:</span>
                  {[
                    "BD Chaurasia Anatomy",
                    "Organic Chemistry (Class 12)",
                    "CEE Medical Prep Guide",
                    "IOE Engineering Entrance",
                    "Principles of Economics",
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setBookTitle(preset)}
                      className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] text-slate-400 hover:text-slate-200 border border-slate-800 transition"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Condition Grading
                  </label>
                  <select
                    value={bookCondition}
                    onChange={(e) => setBookCondition(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Like New">Like New (Unmarked)</option>
                    <option value="Very Good">Very Good (Lightly Used)</option>
                    <option value="Good">Good (Minor Notes/Highlights)</option>
                    <option value="Acceptable">Acceptable (Noticeable Wear)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Target Selling Price (Rs.)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">Rs.</span>
                    <input
                      type="number"
                      step="10"
                      min="0"
                      value={estimatedPrice}
                      onChange={(e) => setEstimatedPrice(parseFloat(e.target.value) || 0)}
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-sm text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-blue-500/25 active:scale-[0.99] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Registering Book into Stock...</span>
              ) : (
                <>
                  <BookPlus className="w-4 h-4 font-bold" />
                  Complete Intake & Generate Book ID
                </>
              )}
            </button>
          </form>

        </div>

        {/* Right Column: Generated Book ID Slip & Recent Intakes (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">

          {/* Generated Book ID Slip (Appears after successful intake) */}
          {lastIntake ? (
            <div className="bg-gradient-to-b from-blue-950/70 to-slate-950 border-2 border-blue-500/40 rounded-2xl p-6 shadow-2xl relative overflow-hidden animate-in fade-in duration-300">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-center justify-between pb-3 border-b border-blue-500/30">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Intake Confirmed
                </span>
                <span className="text-[11px] font-mono text-slate-400">{lastIntake.created_at}</span>
              </div>

              {/* Prominent Book ID Card */}
              <div className="my-4 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Unique Book ID (UUID)
                </span>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-sm font-mono font-bold text-amber-300 break-all select-all">
                    {lastIntake.book_id}
                  </code>
                  <button
                    onClick={() => handleCopyId(lastIntake.book_id)}
                    className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition shrink-0"
                    title="Copy Book ID"
                  >
                    {copiedId === lastIntake.book_id ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Tag Details */}
              <div className="space-y-2 text-xs py-2 border-y border-slate-800/80">
                <div className="flex justify-between">
                  <span className="text-slate-400">Title:</span>
                  <span className="font-bold text-white text-right max-w-[200px] truncate">{lastIntake.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Student Consignor:</span>
                  <span className="font-semibold text-slate-200">{lastIntake.seller_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Phone:</span>
                  <span className="font-mono text-slate-300">{lastIntake.seller_phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Initial Status:</span>
                  <span className="font-bold text-emerald-400">● In Stock</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 space-y-2">
                <Link
                  href={`/?bookId=${encodeURIComponent(lastIntake.book_id)}`}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-md transition"
                >
                  <span>Go to Checkout with this Book</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <div className="flex gap-2">
                  <button
                    onClick={() => window.print()}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 text-xs font-medium text-slate-300 flex items-center justify-center gap-1.5 transition"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print Tag Slip
                  </button>
                  <Link
                    href="/inventory"
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 text-xs font-medium text-slate-300 flex items-center justify-center gap-1.5 transition"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    View Stock
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-2xl p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
                <Barcode className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Book ID & Barcode Generator</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Fill out the student and book details on the left to immediately generate a unique UUID and consignment slip.
                </p>
              </div>
            </div>
          )}

          {/* Recent Intakes Ledger */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-400" />
                Recent Intakes in System
              </h4>
              <span className="text-[11px] text-slate-500 font-mono">{recentIntakes.length} items</span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {recentIntakes.map((record) => (
                <div
                  key={record.book_id}
                  className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80 text-xs flex items-center justify-between gap-3 group hover:border-slate-700 transition"
                >
                  <div className="truncate flex-1">
                    <p className="font-semibold text-white truncate">{record.title}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                      By {record.seller_name} • <span className="font-mono">{record.book_id.slice(0, 8)}...</span>
                    </p>
                  </div>

                  <Link
                    href={`/?bookId=${encodeURIComponent(record.book_id)}`}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-400 transition"
                    title="Send to POS Checkout"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60 py-3.5 px-6 text-center text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
        <span>medicoessentials old book POS • Student Registration & Tagging</span>
        <span className="font-mono text-[11px] text-slate-400">
          Writes to Supabase Sellers & Books tables
        </span>
      </footer>

    </div>
  );
}

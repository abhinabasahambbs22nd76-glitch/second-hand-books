"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Search,
  ShoppingCart,
  Database,
  RefreshCw,
  User,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  GraduationCap,
  Layers,
  Tag,
  Copy,
  Check,
  BookMarked,
  Filter,
  Edit2,
  Trash2,
  X,
  Save,
  AlertTriangle,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

interface InventoryBook {
  book_id: string;
  title: string;
  status: string;
  seller_id: string | null;
  seller_name: string;
}

export default function InventoryDashboard() {
  const router = useRouter();

  // State
  const [books, setBooks] = useState<InventoryBook[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Edit Modal State
  const [editingBook, setEditingBook] = useState<InventoryBook | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editStatus, setEditStatus] = useState("In Stock");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // ============================================================================
  // Supabase Query:
  // Fetches records from Books where status = 'In Stock'
  // Relational join to Sellers table using seller_id to get student's name
  // ============================================================================
  const fetchInStockBooks = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase
        .from("books")
        .select(`
          book_id,
          title,
          status,
          seller_id,
          sellers (
            name
          )
        `)
        .eq("status", "In Stock")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formatted: InventoryBook[] = (data ?? []).map((item: any) => {
        const sellerObj = Array.isArray(item.sellers) ? item.sellers[0] : item.sellers;
        return {
          book_id: item.book_id,
          title: item.title,
          status: item.status,
          seller_id: item.seller_id,
          seller_name: sellerObj?.name || "Direct Consignor",
        };
      });
      setBooks(formatted);
    } catch (err: any) {
      console.error("Error fetching In Stock books:", err);
      setErrorMsg(err.message || "Failed to query the books table.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInStockBooks();
  }, [fetchInStockBooks]);

  // Real-time filtering by 'Book ID' or 'Title'
  const filteredBooks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return books;

    return books.filter((book) => {
      const matchId = book.book_id.toLowerCase().includes(query);
      const matchTitle = book.title.toLowerCase().includes(query);
      const matchSeller = book.seller_name.toLowerCase().includes(query);
      return matchId || matchTitle || matchSeller;
    });
  }, [books, searchQuery]);

  // Quick preset search filters
  const applyQuickFilter = (term: string) => {
    setSearchQuery(term);
  };

  // Copy book ID helper
  const handleCopyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Unique sellers count
  const uniqueSellersCount = useMemo(() => {
    const set = new Set(books.map((b) => b.seller_name));
    return set.size;
  }, [books]);

  // ============================================================================
  // Delete Book Handler
  // Must show a browser confirmation popup before using Supabase to delete,
  // then instantly removes the row from the screen.
  // ============================================================================
  const handleDeleteBook = async (bookId: string, title: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${title}" from inventory?`
    );
    if (!confirmed) return;

    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from("books")
          .delete()
          .eq("book_id", bookId);

        if (error) throw error;
      }

      // Instantly remove from screen state
      setBooks((prev) => prev.filter((b) => b.book_id !== bookId));
    } catch (err: any) {
      alert(`Failed to delete book: ${err?.message || err}`);
    }
  };

  // Open Edit Modal
  const openEditModal = (book: InventoryBook) => {
    setEditingBook(book);
    setEditTitle(book.title);
    setEditStatus(book.status);
  };

  // Save Edit Changes to Supabase
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBook || !editTitle.trim()) return;

    setIsSavingEdit(true);

    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from("books")
          .update({
            title: editTitle.trim(),
            status: editStatus,
          })
          .eq("book_id", editingBook.book_id);

        if (error) throw error;
      }

      // Instantly update table in state
      setBooks((prev) =>
        prev.map((b) =>
          b.book_id === editingBook.book_id
            ? { ...b, title: editTitle.trim(), status: editStatus }
            : b
        )
      );

      setEditingBook(null);
    } catch (err: any) {
      alert(`Failed to update book: ${err?.message || err}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      
      {/* Page Title Banner */}
      <div className="border-b border-slate-800 bg-slate-950/60 px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              Inventory Dashboard
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Available textbook stock with relational student consignor data (Prices in NPR / Rs.)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/intake"
              className="px-3.5 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-semibold transition flex items-center gap-1.5"
            >
              + Intake New Book
            </Link>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 space-y-6">

        {/* Stat Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total In Stock</p>
              <p className="text-2xl font-black text-emerald-400 mt-1">{books.length} Books</p>
              <p className="text-[11px] text-slate-500">Live query: status = &apos;In Stock&apos;</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <BookOpen className="w-6 h-6" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Student Consignors</p>
              <p className="text-2xl font-black text-amber-400 mt-1">{uniqueSellersCount} Students</p>
              <p className="text-[11px] text-slate-500">Joined via seller_id</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <GraduationCap className="w-6 h-6" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Filtered Matches</p>
              <p className="text-2xl font-black text-white mt-1">{filteredBooks.length} of {books.length}</p>
              <p className="text-[11px] text-slate-500">Real-time title & ID filter</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Filter className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Control & Search Bar Card */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            
            {/* Real-time Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Type to filter by Book ID or Title (e.g. Anatomy, Organic Chemistry, CEE)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-3 bg-slate-900 border border-slate-700/80 rounded-xl text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 text-white transition font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white bg-slate-800 px-1.5 py-0.5 rounded"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Refresh Button */}
            <button
              onClick={fetchInStockBooks}
              disabled={isLoading}
              className="px-4 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
              title="Re-query Supabase"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-emerald-400" : ""}`} />
              <span>Refresh Stock</span>
            </button>
          </div>

          {/* Quick Filter Keyword Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80 text-xs">
            <span className="text-slate-400 text-[11px] font-medium flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              Quick Searches:
            </span>
            {[
              { label: "Anatomy", term: "Anatomy" },
              { label: "Organic Chemistry", term: "Organic Chemistry" },
              { label: "CEE Guide", term: "CEE" },
              { label: "Class 12", term: "Class 12" },
              { label: "Gatsby", term: "Gatsby" },
              { label: "All Stock", term: "" },
            ].map((tag) => (
              <button
                key={tag.label}
                onClick={() => applyQuickFilter(tag.term)}
                className={`px-2.5 py-1 rounded-lg border transition ${
                  searchQuery.toLowerCase() === tag.term.toLowerCase()
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold"
                    : "bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800 hover:bg-slate-800"
                }`}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <span>Query Error: {errorMsg}</span>
          </div>
        )}

        {/* Responsive Modern Tailwind Table */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/90 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th scope="col" className="py-4 px-6">Book ID</th>
                  <th scope="col" className="py-4 px-6">Title</th>
                  <th scope="col" className="py-4 px-6">Original Seller</th>
                  <th scope="col" className="py-4 px-6 text-center">Status</th>
                  <th scope="col" className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                        <span>Querying Supabase Books & Sellers join...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredBooks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <div className="max-w-sm mx-auto space-y-2">
                        <BookOpen className="w-8 h-8 text-slate-600 mx-auto" />
                        <p className="font-semibold text-white">No matching books found</p>
                        <p className="text-[11px] text-slate-500">
                          No available book matched your search for &quot;{searchQuery}&quot;. Try clearing your filter or refreshing stock.
                        </p>
                        <button
                          onClick={() => setSearchQuery("")}
                          className="mt-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
                        >
                          Show All Books
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredBooks.map((book) => {
                    const isCopied = copiedId === book.book_id;
                    const isInStock = book.status === "In Stock";
                    return (
                      <tr
                        key={book.book_id}
                        className="hover:bg-slate-900/50 transition-colors group"
                      >
                        {/* 1. Book ID Column */}
                        <td className="py-4 px-6 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="truncate max-w-[130px] font-semibold text-slate-300" title={book.book_id}>
                              {book.book_id}
                            </span>
                            <button
                              onClick={(e) => handleCopyId(book.book_id, e)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
                              title="Copy full UUID"
                            >
                              {isCopied ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* 2. Title Column */}
                        <td className="py-4 px-6">
                          <div className="font-bold text-white text-sm group-hover:text-emerald-300 transition-colors">
                            {book.title}
                          </div>
                        </td>

                        {/* 3. Original Seller Column (Joined from Sellers table) */}
                        <td className="py-4 px-6 text-slate-300">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                              <User className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <span className="font-semibold text-slate-200">{book.seller_name}</span>
                              <span className="block text-[10px] text-slate-500 font-mono">Consignor</span>
                            </div>
                          </div>
                        </td>

                        {/* 4. Status Column (Green 'In Stock' Badge) */}
                        <td className="py-4 px-6 text-center">
                          {isInStock ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-500/10">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                              In Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
                              {book.status}
                            </span>
                          )}
                        </td>

                        {/* 5. Actions Column: 'Go to Checkout', 'Edit', and 'Delete' */}
                        <td className="py-4 px-6 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Go to Checkout */}
                            <Link
                              href={`/?bookId=${encodeURIComponent(book.book_id)}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 font-bold text-xs border border-amber-500/30 transition cursor-pointer"
                              title="Checkout this book"
                            >
                              <span>Checkout</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>

                            {/* Edit Button */}
                            <button
                              onClick={() => openEditModal(book)}
                              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-blue-600 text-slate-300 hover:text-white border border-slate-700 transition"
                              title="Edit Book Title or Status"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={() => handleDeleteBook(book.book_id, book.title)}
                              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-red-600 text-slate-300 hover:text-white border border-slate-700 transition"
                              title="Delete Book"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer info */}
          <div className="p-4 bg-slate-900/60 border-t border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
            <span>Showing {filteredBooks.length} available inventory items</span>
            <span className="font-mono text-[11px] text-slate-500">
              Query: Books WHERE status = &apos;In Stock&apos; JOIN Sellers USING (seller_id)
            </span>
          </div>
        </div>

      </main>

      {/* Edit Book Modal */}
      {editingBook && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm text-white">Edit Book Record</h3>
              </div>
              <button
                onClick={() => setEditingBook(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px]">
                <span className="text-slate-500 block mb-0.5">Book ID:</span>
                <span className="text-amber-300 break-all">{editingBook.book_id}</span>
                <span className="text-slate-500 block mt-1">Consignor: {editingBook.seller_name}</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">
                  Book Title *
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">
                  Status *
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="In Stock">In Stock (Available for sale)</option>
                  <option value="sold">Sold</option>
                  <option value="reserved">Reserved</option>
                  <option value="damaged">Damaged / Clearance</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Note: Updating status to anything other than &apos;In Stock&apos; will remove it from the available active shelf.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingBook(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSavingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60 py-3.5 px-6 text-center text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
        <span>medicoessentials old book POS • Inventory Control</span>
        <span className="font-mono text-[11px] text-slate-400">
          Connected to {process.env.NEXT_PUBLIC_SUPABASE_URL || "Supabase"}
        </span>
      </footer>

    </div>
  );
}

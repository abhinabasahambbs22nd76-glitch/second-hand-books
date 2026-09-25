"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Search,
  ShoppingCart,
  RefreshCw,
  User,
  CheckCircle2,
  ArrowRight,
  Layers,
  Tag,
  Copy,
  Check,
  Filter,
  Edit2,
  Trash2,
  X,
  Save,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface InventoryBook {
  book_id: string;
  title: string;
  target_price: number | null;
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
  const [editTargetPrice, setEditTargetPrice] = useState("");
  const [editStatus, setEditStatus] = useState("In Stock");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Fetch In Stock books
  const fetchInStockBooks = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      let data: any[] | null = null;

      try {
        const res = await supabase
          .from("books")
          .select(`
            book_id,
            title,
            target_price,
            status,
            seller_id,
            sellers (
              name
            )
          `)
          .eq("status", "In Stock")
          .order("created_at", { ascending: false });

        if (res.error) throw res.error;
        data = res.data;
      } catch {
        const res = await supabase
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

        if (res.error) throw res.error;
        data = res.data;
      }

      if (data) {
        const formatted: InventoryBook[] = data.map((item: any) => {
          const sellerObj = Array.isArray(item.sellers) ? item.sellers[0] : item.sellers;
          return {
            book_id: item.book_id,
            title: item.title,
            target_price: item.target_price !== undefined && item.target_price !== null ? Number(item.target_price) : null,
            status: item.status,
            seller_id: item.seller_id,
            seller_name: sellerObj?.name || "Direct Seller",
          };
        });
        setBooks(formatted);
      }
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

  const handleCopyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const uniqueSellersCount = useMemo(() => {
    const set = new Set(books.map((b) => b.seller_name));
    return set.size;
  }, [books]);

  const handleDeleteBook = async (bookId: string, title: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${title}" from inventory?`
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("books")
        .delete()
        .eq("book_id", bookId);

      if (error) throw error;
      setBooks((prev) => prev.filter((b) => b.book_id !== bookId));
    } catch (err: any) {
      alert(`Failed to delete book: ${err?.message || err}`);
    }
  };

  const openEditModal = (book: InventoryBook) => {
    setEditingBook(book);
    setEditTitle(book.title);
    setEditTargetPrice(book.target_price !== null ? String(book.target_price) : "");
    setEditStatus(book.status);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBook || !editTitle.trim()) return;

    setIsSavingEdit(true);
    const parsedPrice = editTargetPrice.trim() !== "" ? parseFloat(editTargetPrice) : null;

    try {
      try {
        const { error } = await supabase
          .from("books")
          .update({
            title: editTitle.trim(),
            target_price: parsedPrice,
            status: editStatus,
          })
          .eq("book_id", editingBook.book_id);

        if (error) throw error;
      } catch (err: any) {
        if (err?.message?.includes("target_price")) {
          const { error } = await supabase
            .from("books")
            .update({
              title: editTitle.trim(),
              status: editStatus,
            })
            .eq("book_id", editingBook.book_id);
          if (error) throw error;
        } else {
          throw err;
        }
      }

      setBooks((prev) =>
        prev.map((b) =>
          b.book_id === editingBook.book_id
            ? { ...b, title: editTitle.trim(), target_price: parsedPrice, status: editStatus }
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
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">
      {/* Top Banner */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-slate-800" />
              Inventory Dashboard
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Available textbooks in stock with seller ownership and target selling prices (Rs.)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/intake"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-semibold transition flex items-center gap-1.5"
            >
              + Intake New Book
            </Link>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 space-y-4">
        {/* Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-md bg-white border border-gray-200 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">In Stock Books</p>
              <p className="text-2xl font-black text-gray-900 mt-0.5">{books.length}</p>
              <p className="text-[11px] text-gray-500">Status = &apos;In Stock&apos;</p>
            </div>
            <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-slate-700">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-md bg-white border border-gray-200 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Active Sellers</p>
              <p className="text-2xl font-black text-gray-900 mt-0.5">{uniqueSellersCount}</p>
              <p className="text-[11px] text-gray-500">Registered consignors</p>
            </div>
            <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-slate-700">
              <User className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-md bg-white border border-gray-200 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Search Matches</p>
              <p className="text-2xl font-black text-gray-900 mt-0.5">{filteredBooks.length} / {books.length}</p>
              <p className="text-[11px] text-gray-500">Active filter results</p>
            </div>
            <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-slate-700">
              <Filter className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Search & Actions Bar */}
        <div className="bg-white border border-gray-200 rounded-md p-3.5 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by Title, Book ID, or Seller Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-300 rounded text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-slate-800"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 px-1"
                >
                  Clear
                </button>
              )}
            </div>

            <button
              onClick={fetchInStockBooks}
              disabled={isLoading}
              className="px-3 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-slate-800" : ""}`} />
              <span>Refresh Stock</span>
            </button>
          </div>

          {/* Quick Filter Tags */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-gray-100 text-xs">
            <span className="text-gray-500 text-[11px] font-medium mr-1 flex items-center gap-1">
              <Tag className="w-3 h-3 text-gray-400" /> Filter:
            </span>
            {["Anatomy", "Histology", "Physiology", "Pharmacology", "Pathology"].map((tag) => (
              <button
                key={tag}
                onClick={() => setSearchQuery(tag)}
                className={`px-2 py-0.5 rounded border text-[11px] transition ${
                  searchQuery.toLowerCase() === tag.toLowerCase()
                    ? "bg-slate-800 text-white border-slate-800 font-semibold"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200"
                }`}
              >
                {tag}
              </button>
            ))}
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="px-2 py-0.5 rounded border border-gray-300 bg-white text-gray-500 hover:text-gray-800 text-[11px]"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="p-3 rounded bg-red-50 border border-red-200 text-red-700 text-xs">
            Query Error: {errorMsg}
          </div>
        )}

        {/* Main Inventory Table */}
        <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-600">
                  <th className="py-3 px-4">Book ID</th>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4">Seller</th>
                  <th className="py-3 px-4 text-right">Target Price</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin text-slate-800" />
                        <span>Loading inventory from Supabase...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredBooks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-500">
                      <div className="max-w-sm mx-auto space-y-1.5">
                        <BookOpen className="w-7 h-7 text-gray-400 mx-auto" />
                        <p className="font-semibold text-gray-800">No matching books found</p>
                        <p className="text-[11px] text-gray-500">
                          {searchQuery
                            ? `No available books match "${searchQuery}".`
                            : "No books currently in stock. Go to Book Intake to register new stock."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredBooks.map((book) => {
                    const isCopied = copiedId === book.book_id;
                    const isInStock = book.status === "In Stock";
                    return (
                      <tr key={book.book_id} className="hover:bg-gray-50/80 transition-colors group">
                        {/* Book ID */}
                        <td className="py-3 px-4 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate max-w-[120px] font-medium text-gray-700" title={book.book_id}>
                              {book.book_id}
                            </span>
                            <button
                              onClick={(e) => handleCopyId(book.book_id, e)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 text-gray-500 transition"
                              title="Copy UUID"
                            >
                              {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        </td>

                        {/* Title */}
                        <td className="py-3 px-4 font-bold text-gray-900 text-xs">
                          {book.title}
                        </td>

                        {/* Seller */}
                        <td className="py-3 px-4 text-gray-700">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3 h-3 text-gray-400" />
                            <span className="font-medium text-xs text-gray-800">{book.seller_name}</span>
                          </div>
                        </td>

                        {/* Target Selling Price */}
                        <td className="py-3 px-4 text-right font-mono">
                          {book.target_price !== null ? (
                            <span className="font-bold text-gray-900 text-xs">
                              Rs. {book.target_price.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic text-[11px]">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center">
                          {isInStock ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              ● In Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                              {book.status}
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={`/checkout?bookId=${encodeURIComponent(book.book_id)}`}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs transition"
                              title="Checkout this book"
                            >
                              Checkout
                            </Link>

                            <button
                              onClick={() => openEditModal(book)}
                              className="p-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 transition"
                              title="Edit book"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDeleteBook(book.book_id, book.title)}
                              className="p-1 rounded border border-gray-300 text-gray-600 hover:text-red-600 hover:bg-gray-100 transition"
                              title="Delete book"
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

          <div className="p-3 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between text-xs text-gray-500 gap-2">
            <span>Showing {filteredBooks.length} available items</span>
            <span className="font-mono text-[11px] text-gray-400">Books WHERE status = &apos;In Stock&apos;</span>
          </div>
        </div>
      </main>

      {/* Edit Book Modal */}
      {editingBook && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-md max-w-md w-full p-5 space-y-4 shadow-lg text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200">
              <div className="flex items-center gap-1.5">
                <Edit2 className="w-4 h-4 text-slate-800" />
                <h3 className="font-bold text-sm text-gray-900">Edit Book Record</h3>
              </div>
              <button
                onClick={() => setEditingBook(null)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div className="p-2.5 rounded bg-gray-50 border border-gray-200 font-mono text-[11px]">
                <span className="text-gray-500 block">ID: {editingBook.book_id}</span>
                <span className="text-gray-700 font-bold block mt-0.5">Seller: {editingBook.seller_name}</span>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Book Title *
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-gray-900 text-xs focus:outline-none focus:border-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Target Selling Price (Rs.)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">Rs.</span>
                  <input
                    type="number"
                    step="10"
                    min="0"
                    placeholder="e.g. 1500"
                    value={editTargetPrice}
                    onChange={(e) => setEditTargetPrice(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded text-gray-900 text-xs font-mono focus:outline-none focus:border-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Status *
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded text-gray-900 text-xs focus:outline-none focus:border-slate-800"
                >
                  <option value="In Stock">In Stock (Available for sale)</option>
                  <option value="sold">Sold</option>
                  <option value="reserved">Reserved</option>
                  <option value="damaged">Damaged / Clearance</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setEditingBook(null)}
                  className="px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-3.5 py-1.5 rounded bg-slate-800 hover:bg-slate-900 text-white font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSavingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className="border-t border-gray-200 bg-white py-3 px-6 text-center text-xs text-gray-500 flex flex-wrap items-center justify-between gap-2">
        <span>medicoessentials old book POS · Inventory</span>
        <span className="font-mono text-[11px] text-gray-400">All data live from Supabase</span>
      </footer>
    </div>
  );
}

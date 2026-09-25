-- ==============================================================================
-- Schema for medicoessentials Second-Hand Bookstore POS System
-- Tables: Sellers, Books, Sales
-- ==============================================================================

-- 1. Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Sellers Table
-- Tracks sellers / book owners and their accumulated pending payouts
CREATE TABLE IF NOT EXISTS sellers (
    seller_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    total_pending_balance NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Books Table
-- Tracks inventory items linked to a seller
CREATE TABLE IF NOT EXISTS books (
    book_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID REFERENCES sellers(seller_id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    target_price NUMERIC(10, 2) DEFAULT NULL, -- Target selling price in NPR
    status TEXT DEFAULT 'In Stock' NOT NULL, -- e.g., 'In Stock', 'sold', 'reserved', 'damaged'
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. Sales Table
-- Records completed transactions with profit, payout splits, and payment channels
CREATE TABLE IF NOT EXISTS sales (
    sale_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES books(book_id) ON DELETE SET NULL,
    selling_price NUMERIC(10, 2) NOT NULL,
    commission_percentage NUMERIC(5, 2) DEFAULT NULL, -- Optional at checkout, can be decided later in ledger
    shop_profit NUMERIC(10, 2) DEFAULT NULL,
    seller_payout NUMERIC(10, 2) DEFAULT NULL,
    customer_payment_mode TEXT DEFAULT 'Cash', -- 'Cash', 'Fonepay', 'Qr to abhinav', 'Qr to adwait', 'Saha esewa', 'Unpaid'
    customer_description TEXT DEFAULT NULL, -- Editable notes about buyer, batch, or sale details
    settlement_payment_mode TEXT DEFAULT NULL, -- Mode used to pay original seller (e.g., Cash, eSewa, Bank Transfer)
    date_sold TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ==============================================================================
-- Helpful Indexes for POS Performance
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_books_seller_id ON books(seller_id);
CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);
CREATE INDEX IF NOT EXISTS idx_sales_book_id ON sales(book_id);
CREATE INDEX IF NOT EXISTS idx_sales_date_sold ON sales(date_sold DESC);
CREATE INDEX IF NOT EXISTS idx_sales_customer_payment_mode ON sales(customer_payment_mode);

-- ==============================================================================
-- Enable Row Level Security (RLS) & Public Policies (for POS Client Demo)
-- ==============================================================================
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on sellers" ON sellers FOR SELECT USING (true);
CREATE POLICY "Allow public insert on sellers" ON sellers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on sellers" ON sellers FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on sellers" ON sellers FOR DELETE USING (true);

CREATE POLICY "Allow public read access on books" ON books FOR SELECT USING (true);
CREATE POLICY "Allow public insert on books" ON books FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on books" ON books FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on books" ON books FOR DELETE USING (true);

CREATE POLICY "Allow public read access on sales" ON sales FOR SELECT USING (true);
CREATE POLICY "Allow public insert on sales" ON sales FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on sales" ON sales FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on sales" ON sales FOR DELETE USING (true);

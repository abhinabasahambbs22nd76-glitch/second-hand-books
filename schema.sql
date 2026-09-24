-- ==============================================================================
-- Schema for Second-Hand Bookstore POS System
-- Tables: Sellers, Books, Sales
-- ==============================================================================

-- 1. Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Sellers Table
-- Tracks consignors / book sellers and their accumulated pending payouts
CREATE TABLE IF NOT EXISTS sellers (
    seller_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    total_pending_balance NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Books Table
-- Tracks inventory items linked to a seller/consignor
CREATE TABLE IF NOT EXISTS books (
    book_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID REFERENCES sellers(seller_id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'available' NOT NULL, -- e.g., 'available', 'sold', 'reserved'
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. Sales Table
-- Records completed transactions with profit and payout splits
CREATE TABLE IF NOT EXISTS sales (
    sale_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES books(book_id) ON DELETE SET NULL,
    selling_price NUMERIC(10, 2) NOT NULL,
    commission_percentage NUMERIC(5, 2) NOT NULL,
    shop_profit NUMERIC(10, 2) NOT NULL,
    seller_payout NUMERIC(10, 2) NOT NULL,
    date_sold TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ==============================================================================
-- Helpful Indexes for POS Performance
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_books_seller_id ON books(seller_id);
CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);
CREATE INDEX IF NOT EXISTS idx_sales_book_id ON sales(book_id);
CREATE INDEX IF NOT EXISTS idx_sales_date_sold ON sales(date_sold DESC);

-- ==============================================================================
-- Enable Row Level Security (RLS) & Public Policies (for POS Client Demo)
-- Note: Modify these policies according to your production authentication needs.
-- ==============================================================================
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on sellers" ON sellers FOR SELECT USING (true);
CREATE POLICY "Allow public insert on sellers" ON sellers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on sellers" ON sellers FOR UPDATE USING (true);

CREATE POLICY "Allow public read access on books" ON books FOR SELECT USING (true);
CREATE POLICY "Allow public insert on books" ON books FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on books" ON books FOR UPDATE USING (true);

CREATE POLICY "Allow public read access on sales" ON sales FOR SELECT USING (true);
CREATE POLICY "Allow public insert on sales" ON sales FOR INSERT WITH CHECK (true);

-- ==============================================================================
-- Optional Sample Seed Data (Useful for testing immediately in Supabase)
-- ==============================================================================
INSERT INTO sellers (seller_id, name, phone, total_pending_balance)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Arthur Pendelton', '+1 (555) 234-5678', 0.00),
    ('22222222-2222-2222-2222-222222222222', 'Clara Oswald', '+1 (555) 876-5432', 0.00),
    ('33333333-3333-3333-3333-333333333333', 'Eleanor Vance', '+1 (555) 345-6789', 0.00)
ON CONFLICT (seller_id) DO NOTHING;

INSERT INTO books (book_id, seller_id, title, status)
VALUES 
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'The Great Gatsby (1953 Scribner Ed.)', 'available'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'To Kill a Mockingbird (Vintage Paperback)', 'available'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', 'Dune (First Book Club Edition)', 'available'),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'A Brief History of Time', 'available')
ON CONFLICT (book_id) DO NOTHING;

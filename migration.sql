-- ==============================================================================
-- Migration: Add Target Selling Price, Payment Modes, Customer Details & Payout Tracking
-- Run this in your Supabase Project -> SQL Editor
-- ==============================================================================

-- 1. Add target_price to books table if it doesn't already exist
ALTER TABLE books ADD COLUMN IF NOT EXISTS target_price NUMERIC(10, 2) DEFAULT NULL;

-- 2. Add customer_payment_mode, customer_description, and settlement_payment_mode to sales table
ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_payment_mode TEXT DEFAULT 'Cash';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_description TEXT DEFAULT NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS settlement_payment_mode TEXT DEFAULT NULL;

-- 3. Make commission fields optional (nullable) on sales so commission can be decided later in the ledger
ALTER TABLE sales ALTER COLUMN commission_percentage DROP NOT NULL;
ALTER TABLE sales ALTER COLUMN shop_profit DROP NOT NULL;
ALTER TABLE sales ALTER COLUMN seller_payout DROP NOT NULL;

-- 4. Enable full RLS policies for updates and deletions
CREATE POLICY "Allow public update on sales" ON sales FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete on sales" ON sales FOR DELETE USING (true);
CREATE POLICY "Allow public delete on sellers" ON sellers FOR DELETE USING (true);
CREATE POLICY "Allow public delete on books" ON books FOR DELETE USING (true);

-- 5. Add helpful index on customer_payment_mode
CREATE INDEX IF NOT EXISTS idx_sales_customer_payment_mode ON sales(customer_payment_mode);

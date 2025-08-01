-- Comprehensive database schema fix for QR scanning workflow

-- ========== FIX PRE_REGISTRATIONS TABLE ==========
-- Add missing timestamp columns for check-in/check-out tracking
ALTER TABLE pre_registrations 
ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP NULL;

ALTER TABLE pre_registrations 
ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMP NULL;

-- ========== FIX VISITS TABLE ==========
-- Add pre_registration_id column to link visits with pre-registrations
ALTER TABLE visits 
ADD COLUMN IF NOT EXISTS pre_registration_id INT NULL;

-- Add status column for visit tracking
ALTER TABLE visits 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'checked_in';

-- Update existing visit records to have status
UPDATE visits 
SET status = 'checked_in' 
WHERE status IS NULL OR status = '';

-- ========== VERIFY CHANGES ==========
-- Show table structures to verify all columns exist
SELECT 'PRE_REGISTRATIONS TABLE STRUCTURE:' as Info;
DESCRIBE pre_registrations;

SELECT 'VISITS TABLE STRUCTURE:' as Info;
DESCRIBE visits;

-- Show row counts
SELECT 
    'PRE_REGISTRATIONS' as table_name, 
    COUNT(*) as row_count 
FROM pre_registrations
UNION ALL
SELECT 
    'VISITS' as table_name, 
    COUNT(*) as row_count 
FROM visits;

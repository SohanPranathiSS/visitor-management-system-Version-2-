-- Add missing columns to pre_registrations table
ALTER TABLE pre_registrations 
ADD COLUMN IF NOT EXISTS status ENUM('pending', 'approved', 'rejected', 'checked_in', 'checked_out') DEFAULT 'pending';

ALTER TABLE pre_registrations 
ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMP NULL;

-- Update existing records to have pending status if null
UPDATE pre_registrations SET status = 'pending' WHERE status IS NULL;

-- Show updated table structure
DESCRIBE pre_registrations;

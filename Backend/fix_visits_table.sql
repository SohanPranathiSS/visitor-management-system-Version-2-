-- Add missing columns to visits table

-- Add pre_registration_id column if it doesn't exist
ALTER TABLE visits 
ADD COLUMN IF NOT EXISTS pre_registration_id INT NULL;

-- Add status column if it doesn't exist
ALTER TABLE visits 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'checked_in';

-- Update existing records to have checked_in status
UPDATE visits 
SET status = 'checked_in' 
WHERE status IS NULL OR status = '';

-- Show the updated table structure
DESCRIBE visits;

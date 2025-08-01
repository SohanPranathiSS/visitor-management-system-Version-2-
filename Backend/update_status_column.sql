-- Update status column from ENUM to VARCHAR
ALTER TABLE pre_registrations 
MODIFY COLUMN status VARCHAR(50) DEFAULT 'pending';

-- Update any existing records to ensure they have valid status values
UPDATE pre_registrations 
SET status = 'pending' 
WHERE status IS NULL OR status = '';

-- Show the updated table structure
DESCRIBE pre_registrations;

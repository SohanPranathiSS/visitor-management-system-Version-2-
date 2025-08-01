-- Database Setup for QR Check-in Functionality
-- Run this script to ensure all required tables exist with the correct structure

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS vms_db;
USE vms_db;

-- Table: visitors
-- Stores visitor information
CREATE TABLE IF NOT EXISTS visitors (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  company VARCHAR(255),
  purpose TEXT,
  host_id INT,
  photo_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_host_id (host_id)
);

-- Table: visits
-- Stores individual visit records
CREATE TABLE IF NOT EXISTS visits (
  id INT PRIMARY KEY AUTO_INCREMENT,
  visitor_id INT NOT NULL,
  visitor_name VARCHAR(255) NOT NULL,
  visitor_email VARCHAR(255) NOT NULL,
  visitor_phone VARCHAR(20),
  host_id INT NOT NULL,
  host_name VARCHAR(255),
  purpose TEXT,
  company VARCHAR(255),
  check_in_time TIMESTAMP NOT NULL,
  check_out_time TIMESTAMP NULL,
  status ENUM('checked_in', 'checked_out') DEFAULT 'checked_in',
  qr_code TEXT,
  scan_method ENUM('camera', 'manual') DEFAULT 'camera',
  pre_registration_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_visitor_id (visitor_id),
  INDEX idx_host_id (host_id),
  INDEX idx_visitor_email (visitor_email),
  INDEX idx_check_in_time (check_in_time),
  INDEX idx_status (status),
  INDEX idx_pre_registration_id (pre_registration_id)
);

-- Table: pre_registrations
-- Stores pre-registration information
CREATE TABLE IF NOT EXISTS pre_registrations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  visitor_name VARCHAR(255) NOT NULL,
  visitor_email VARCHAR(255) NOT NULL,
  visitor_phone VARCHAR(20),
  visitor_company VARCHAR(255),
  host_id INT NOT NULL,
  visit_date DATE,
  visit_time TIME,
  purpose TEXT,
  duration VARCHAR(50),
  qr_code TEXT UNIQUE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_pattern VARCHAR(50),
  recurring_end_date DATE,
  special_requirements TEXT,
  emergency_contact VARCHAR(255),
  vehicle_number VARCHAR(50),
  number_of_visitors INT DEFAULT 1,
  photo_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  checked_in_at TIMESTAMP NULL,
  checked_out_at TIMESTAMP NULL,
  UNIQUE INDEX idx_qr_code (qr_code),
  INDEX idx_visitor_email (visitor_email),
  INDEX idx_host_id (host_id),
  INDEX idx_status (status),
  INDEX idx_visit_date (visit_date)
);

-- Table: users
-- Stores user information (hosts, admins, etc.)
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'host', 'security', 'visitor') DEFAULT 'host',
  company_id INT DEFAULT 1,
  company_name VARCHAR(255),
  department VARCHAR(255),
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role),
  INDEX idx_company_id (company_id)
);

-- Add foreign key constraints (only if they don't exist)
-- Note: MySQL doesn't have IF NOT EXISTS for constraints, so we use a procedure

DELIMITER $$

CREATE PROCEDURE AddForeignKeyIfNotExists()
BEGIN
    -- Check and add foreign key for visits.visitor_id
    IF NOT EXISTS (
        SELECT NULL FROM information_schema.TABLE_CONSTRAINTS 
        WHERE CONSTRAINT_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'visits' 
        AND CONSTRAINT_NAME = 'fk_visits_visitor_id'
    ) THEN
        ALTER TABLE visits 
        ADD CONSTRAINT fk_visits_visitor_id 
        FOREIGN KEY (visitor_id) REFERENCES visitors(id) 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- Check and add foreign key for visits.host_id
    IF NOT EXISTS (
        SELECT NULL FROM information_schema.TABLE_CONSTRAINTS 
        WHERE CONSTRAINT_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'visits' 
        AND CONSTRAINT_NAME = 'fk_visits_host_id'
    ) THEN
        ALTER TABLE visits 
        ADD CONSTRAINT fk_visits_host_id 
        FOREIGN KEY (host_id) REFERENCES users(id) 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- Check and add foreign key for visits.pre_registration_id
    IF NOT EXISTS (
        SELECT NULL FROM information_schema.TABLE_CONSTRAINTS 
        WHERE CONSTRAINT_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'visits' 
        AND CONSTRAINT_NAME = 'fk_visits_pre_registration_id'
    ) THEN
        ALTER TABLE visits 
        ADD CONSTRAINT fk_visits_pre_registration_id 
        FOREIGN KEY (pre_registration_id) REFERENCES pre_registrations(id) 
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    -- Check and add foreign key for pre_registrations.host_id
    IF NOT EXISTS (
        SELECT NULL FROM information_schema.TABLE_CONSTRAINTS 
        WHERE CONSTRAINT_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'pre_registrations' 
        AND CONSTRAINT_NAME = 'fk_pre_registrations_host_id'
    ) THEN
        ALTER TABLE pre_registrations 
        ADD CONSTRAINT fk_pre_registrations_host_id 
        FOREIGN KEY (host_id) REFERENCES users(id) 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- Check and add foreign key for visitors.host_id
    IF NOT EXISTS (
        SELECT NULL FROM information_schema.TABLE_CONSTRAINTS 
        WHERE CONSTRAINT_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'visitors' 
        AND CONSTRAINT_NAME = 'fk_visitors_host_id'
    ) THEN
        ALTER TABLE visitors 
        ADD CONSTRAINT fk_visitors_host_id 
        FOREIGN KEY (host_id) REFERENCES users(id) 
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END$$

DELIMITER ;

-- Execute the procedure to add foreign keys
CALL AddForeignKeyIfNotExists();

-- Drop the procedure as it's no longer needed
DROP PROCEDURE AddForeignKeyIfNotExists;

-- Sample data for testing (optional)
-- Insert a sample admin user if not exists
INSERT IGNORE INTO users (id, name, email, password, role, company_id, company_name) 
VALUES (1, 'Admin User', 'admin@example.com', '$2b$10$placeholder_hash', 'admin', 1, 'Default Company');

-- Insert a sample host user if not exists
INSERT IGNORE INTO users (id, name, email, password, role, company_id, company_name) 
VALUES (2, 'Host User', 'host@example.com', '$2b$10$placeholder_hash', 'host', 1, 'Default Company');

-- Insert a sample pre-registration for testing
INSERT IGNORE INTO pre_registrations (
  id, visitor_name, visitor_email, visitor_phone, visitor_company,
  host_id, visit_date, visit_time, purpose, qr_code, status
) VALUES (
  1, 'Test Visitor', 'test@example.com', '1234567890', 'Test Company',
  2, CURDATE(), '10:00:00', 'Business Meeting', 
  'VMS-TEST-123456789', 'approved'
);

-- Show table status
SELECT 'Database setup completed successfully!' as Status;

-- Show table information
SELECT 
  TABLE_NAME as 'Table Name',
  TABLE_ROWS as 'Rows',
  CREATE_TIME as 'Created'
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME IN ('users', 'visitors', 'visits', 'pre_registrations')
ORDER BY TABLE_NAME;

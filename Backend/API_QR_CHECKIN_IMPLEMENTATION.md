# QR Check-in API Implementation Guide

## Endpoint: POST /api/visitors/qr-checkin

This endpoint handles QR code scanning for visitor check-ins and creates records in both `visitors` and `visits` tables.

### Request Format

```javascript
POST /api/visitors/qr-checkin
Headers: {
  "Content-Type": "application/json",
  "Authorization": "Bearer <token>"
}
Body: {
  "qr_code": "scanned_qr_code_value",
  "host_id": 123,
  "check_in_time": "2025-07-31T10:30:00.000Z",
  "scan_method": "camera" // or "manual"
}
```

### Response Format

#### Success Response (200)
```javascript
{
  "success": true,
  "message": "Visitor checked in successfully",
  "visitor_name": "John Doe",
  "visitor_id": 456,
  "visit_id": 789,
  "check_in_time": "2025-07-31T10:30:00.000Z",
  "host_name": "Jane Smith"
}
```

#### Error Responses
```javascript
// QR Code not found (404)
{
  "success": false,
  "message": "QR code not found in pre-registrations"
}

// Already checked in (409)
{
  "success": false,
  "message": "Visitor already checked in"
}

// Authentication error (401)
{
  "success": false,
  "message": "Unauthorized access"
}

// Server error (500)
{
  "success": false,
  "message": "Internal server error"
}
```

## Implementation Steps

### 1. Database Operations Required

The endpoint should perform these operations in sequence:

1. **Verify QR Code**: Check if QR code exists in `pre_registrations` table
2. **Check Duplicate**: Ensure visitor hasn't already checked in today
3. **Insert/Update Visitor**: Add or update visitor in `visitors` table
4. **Create Visit Record**: Insert new record in `visits` table
5. **Update Pre-registration**: Mark as checked in

### 2. Sample Implementation (Node.js/Express)

```javascript
// routes/visitors.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.post('/qr-checkin', async (req, res) => {
  const { qr_code, host_id, check_in_time, scan_method } = req.body;
  
  try {
    // Start transaction
    await db.query('START TRANSACTION');
    
    // 1. Verify QR code in pre_registrations
    const preRegQuery = `
      SELECT pr.*, h.name as host_name 
      FROM pre_registrations pr 
      LEFT JOIN hosts h ON pr.host_id = h.id 
      WHERE pr.qr_code = ? AND pr.status = 'approved'
    `;
    const [preRegResult] = await db.query(preRegQuery, [qr_code]);
    
    if (preRegResult.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'QR code not found in pre-registrations'
      });
    }
    
    const preReg = preRegResult[0];
    
    // 2. Check if already checked in today
    const todayStart = new Date().toISOString().split('T')[0] + ' 00:00:00';
    const todayEnd = new Date().toISOString().split('T')[0] + ' 23:59:59';
    
    const existingVisitQuery = `
      SELECT id FROM visits 
      WHERE visitor_email = ? 
      AND check_in_time BETWEEN ? AND ?
      AND status = 'checked_in'
    `;
    const [existingVisit] = await db.query(existingVisitQuery, [
      preReg.email, todayStart, todayEnd
    ]);
    
    if (existingVisit.length > 0) {
      await db.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Visitor already checked in today'
      });
    }
    
    // 3. Insert or update visitor in visitors table
    const visitorQuery = `
      INSERT INTO visitors (
        name, email, phone, company, purpose, 
        host_id, photo_url, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE 
        name = VALUES(name),
        phone = VALUES(phone),
        company = VALUES(company),
        purpose = VALUES(purpose),
        host_id = VALUES(host_id),
        updated_at = NOW()
    `;
    
    const [visitorResult] = await db.query(visitorQuery, [
      preReg.name,
      preReg.email,
      preReg.phone,
      preReg.company,
      preReg.purpose,
      host_id,
      preReg.photo_url
    ]);
    
    const visitor_id = visitorResult.insertId || (
      await db.query('SELECT id FROM visitors WHERE email = ?', [preReg.email])
    )[0][0].id;
    
    // 4. Create visit record
    const visitQuery = `
      INSERT INTO visits (
        visitor_id, visitor_name, visitor_email, visitor_phone,
        host_id, host_name, purpose, company,
        check_in_time, status, qr_code, scan_method,
        pre_registration_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'checked_in', ?, ?, ?, NOW())
    `;
    
    const [visitResult] = await db.query(visitQuery, [
      visitor_id,
      preReg.name,
      preReg.email,
      preReg.phone,
      host_id,
      preReg.host_name,
      preReg.purpose,
      preReg.company,
      check_in_time,
      qr_code,
      scan_method,
      preReg.id
    ]);
    
    const visit_id = visitResult.insertId;
    
    // 5. Update pre-registration status
    await db.query(
      'UPDATE pre_registrations SET status = ?, checked_in_at = NOW() WHERE id = ?',
      ['checked_in', preReg.id]
    );
    
    // Commit transaction
    await db.query('COMMIT');
    
    // Success response
    res.status(200).json({
      success: true,
      message: 'Visitor checked in successfully',
      visitor_name: preReg.name,
      visitor_id: visitor_id,
      visit_id: visit_id,
      check_in_time: check_in_time,
      host_name: preReg.host_name
    });
    
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('QR Check-in error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
```

### 3. Database Schema Requirements

Ensure your tables have the following structure:

#### pre_registrations table
```sql
CREATE TABLE pre_registrations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  company VARCHAR(255),
  purpose TEXT,
  host_id INT,
  qr_code TEXT UNIQUE,
  status ENUM('pending', 'approved', 'rejected', 'checked_in') DEFAULT 'pending',
  photo_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  checked_in_at TIMESTAMP NULL
);
```

#### visitors table
```sql
CREATE TABLE visitors (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20),
  company VARCHAR(255),
  purpose TEXT,
  host_id INT,
  photo_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### visits table
```sql
CREATE TABLE visits (
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
  FOREIGN KEY (visitor_id) REFERENCES visitors(id),
  FOREIGN KEY (host_id) REFERENCES hosts(id),
  FOREIGN KEY (pre_registration_id) REFERENCES pre_registrations(id)
);
```

### 4. Authentication Middleware

Ensure you have authentication middleware to verify the JWT token:

```javascript
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Apply to the route
router.post('/qr-checkin', authenticateToken, async (req, res) => {
  // ... implementation
});
```

### 5. Integration with Express App

```javascript
// server.js or app.js
const visitorsRoutes = require('./routes/visitors');
app.use('/api/visitors', visitorsRoutes);
```

## Testing the Implementation

### Test Cases

1. **Valid QR Code**: Should create visitor and visit records
2. **Invalid QR Code**: Should return 404 error
3. **Duplicate Check-in**: Should return 409 error
4. **Unauthorized Access**: Should return 401 error
5. **Database Error**: Should return 500 error and rollback

### Sample Test Data

```javascript
// Test with valid pre-registration
{
  "qr_code": "PRE_REG_123_UNIQUE_CODE",
  "host_id": 1,
  "check_in_time": "2025-07-31T10:30:00.000Z",
  "scan_method": "camera"
}
```

## Notes

- All database operations are wrapped in a transaction to ensure data consistency
- QR codes must exist in the `pre_registrations` table with 'approved' status
- Duplicate check-ins for the same day are prevented
- Both `visitors` and `visits` tables are updated atomically
- Comprehensive error handling with appropriate HTTP status codes
- Authentication is required for all requests

This implementation ensures that successful QR scans result in proper data insertion into both the `visitors` and `visits` tables while maintaining data integrity and preventing duplicate entries.

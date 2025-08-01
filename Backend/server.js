require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer'); // Import Nodemailer

const app = express();

// --- Middleware ---
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json({ limit: '50mb' }));

// --- Database Connection Pool ---
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});


// --- Nodemailer Transporter for sending emails ---
// This uses your Gmail account credentials from the .env file
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Your Gmail address from .env
        pass: process.env.EMAIL_PASS, // Your Gmail App Password from .env
    },
});


// --- JWT Authentication Middleware ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Access token required.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token.' });
    }
    req.user = user;
    next();
  });
};

// --- API Endpoints ---

// Test database connection endpoint
app.get('/api/test-db', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [result] = await connection.query('SELECT 1 as test');
    connection.release();
    res.json({ success: true, message: 'Database connection successful', result });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({ success: false, message: 'Database connection failed', error: error.message });
  }
});

// Test pre-registrations endpoint
app.get('/api/test-preregistrations', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [result] = await connection.query('SELECT * FROM pre_registrations LIMIT 5');
    connection.release();
    res.json({ success: true, message: 'Pre-registrations retrieved', data: result });
  } catch (error) {
    console.error('Pre-registrations test error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve pre-registrations', error: error.message });
  }
});

/**
 * @route   POST /api/register
 * @desc    Register a new user (For admin creating users under their company)
 * @access  Protected (admin only)
 */
app.post('/api/register', authenticateToken, async (req, res) => {
  // Only admins can create new users
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Only admins can create new users.' });
  }

  const { email, firstName, lastName, password } = req.body;
  if (!email || !firstName || !password) {
    return res.status(400).json({ message: 'Please provide email, first name, and password.' });
  }

  try {
    const name = `${firstName} ${lastName}`.trim();
    
    // Get the admin's company information
    const [adminCompany] = await pool.query(
      'SELECT company_name FROM companies WHERE id = ?',
      [req.user.id]
    );

    if (!adminCompany.length) {
      return res.status(400).json({ message: 'Admin company information not found.' });
    }

    const companyName = adminCompany[0].company_name;

    // Create the new user with 'host' role and company name
    const [userResult] = await pool.query(
      'INSERT INTO users (name, email, password, role, company_name) VALUES (?, ?, ?, ?, ?)',
      [name, email, password, 'host', companyName]
    );

    // Create company record for the new user linked to the admin's company
    await pool.query(
      'INSERT INTO companies (id, firstname, lastname, email, password, role, company_name, created_at, admin_company_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userResult.insertId, firstName, lastName, email, password, 'host', companyName, new Date(), req.user.id]
    );

    res.status(201).json({ 
      id: userResult.insertId, 
      name, 
      email, 
      role: 'host',
      company_name: companyName
    });
  } catch (error) {
    // Handle case where email already exists
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }
    console.error('Registration Error:', error);
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

/**
 * @route   POST /api/registerCompany
 * @desc    Register a new user and their company (New endpoint)
 * @access  Public
 */
app.post('/api/registerCompany', async (req, res) => {
    // Destructure all fields from the registration form body
    const { email, firstName, lastName, password, companyName, mobileNumber } = req.body;

    // Validate that all required fields are present
    if (!email || !firstName || !password || !companyName) {
        return res.status(400).json({ message: 'Please provide email, first name, password, and company name.' });
    }

    // Get a connection from the pool to handle the transaction
    const connection = await pool.getConnection();

    try {
        // Start a database transaction to ensure data integrity across two tables
        await connection.beginTransaction();

        // 1. Insert the new user into the 'users' table
        const name = `${firstName} ${lastName}`.trim();
        // New users are given the 'admin' role by default
        const [userResult] = await connection.query(
            'INSERT INTO users (name, email, password, role, company_name) VALUES (?, ?, ?, ?, ?)',
            [name, email, password, 'admin', companyName]
        );
        const userId = userResult.insertId;

        // 2. Insert the new company into the 'companies' table, linking it to the user
        // CORRECTED: The columns now match the values being provided.
        await connection.query(
            'INSERT INTO companies (id, firstname,lastname, email, password, role, company_name, mobile_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [userId, firstName,lastName, email, password, 'admin', companyName, mobileNumber || null, new Date()]
        );

        // If both inserts are successful, commit the transaction
        await connection.commit();



         // --- 3. Send Verification Email ---
        const verificationToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1d' });
        const verificationLink = `http://localhost:4000/api/verify-email?token=${verificationToken}`;

        const mailOptions = {
          from: `"Visitor Management System" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: 'Welcome! Please Verify Your Email Address',
          html: `
            <div style="font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f7f7f7;">
              <div style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); padding: 40px;">
                <div style="text-align: center; margin-bottom: 20px;">
                  <h1 style="color: #1a3c7a; font-size: 24px; margin: 0;">Welcome to Visitor Management System</h1>
                </div>
                <div style="padding: 20px; background-color: #f9f9f9; border-radius: 6px;">
                  <p style="font-size: 16px; margin: 0 0 15px;">Hello ${firstName},</p>
                  <p style="font-size: 16px; margin: 0 0 25px;">Thank you for registering with us! To get started, please verify your email address by clicking the button below.</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${verificationLink}" style="background-color: #007bff; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold; display: inline-block; transition: background-color 0.3s;">Verify Your Email</a>
                  </div>
                  <p style="font-size: 14px; color: #666666; margin: 0 0 15px;">If the button doesn't work, copy and paste this link into your browser:</p>
                  <p style="font-size: 14px; word-break: break-all; margin: 0 0 25px;"><a href="${verificationLink}" style="color: #007bff; text-decoration: none;">${verificationLink}</a></p>
                  <p style="font-size: 14px; color: #666666; margin: 0;">If you didn't create this account, you can safely ignore this email.</p>
                </div>
                <div style="text-align: center; margin-top: 30px; font-size: 12px; color: #999999;">
                  <p style="margin: 0;">Visitor Management System &copy; ${new Date().getFullYear()}</p>
                  <p style="margin: 5px 0 0;">Questions? Contact us at <a href="mailto:support@vms.com" style="color: #007bff; text-decoration: none;">support@vms.com</a></p>
                </div>
              </div>
            </div>
          `
        };

        await transporter.sendMail(mailOptions);
        console.log('Verification email sent successfully to:', email);
        
        // --- End of Email Sending ---


        // Send a success response back to the client
        res.status(201).json({ id: userId, name, email, role: 'admin', companyName });

    } catch (error) {
        // If any error occurs during the transaction, roll it back
        await connection.rollback();

        // Handle the specific error for a duplicate email address
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'An account with this email already exists.' });
        }

        // Log the full error for debugging purposes
        console.error('Registration Error:', error);
        // Send a generic server error message
        res.status(500).json({ message: 'Server error during registration.' });

    } finally {
        // IMPORTANT: Always release the database connection back to the pool
        connection.release();
    }
});

/**
 * @route   GET /api/verify-email
 * @desc    Verifies the user's email address using the token.
 * @access  Public
 */
app.get('/api/verify-email', async (req, res) => {
    const { token } = req.query;
    if (!token) {
        return res.status(400).send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Email Verification Error</title>
                <style>
                    body {
                        font-family: 'Roboto', Arial, sans-serif;
                        background-color: #f4f7fa;
                        margin: 0;
                        padding: 0;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                        color: #333333;
                    }
                    .container {
                        max-width: 500px;
                        background: #ffffff;
                        border-radius: 10px;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                        padding: 40px;
                        text-align: center;
                    }
                    h1 {
                        color: #c53030;
                        font-size: 28px;
                        margin-bottom: 20px;
                    }
                    p {
                        font-size: 16px;
                        color: #4a5568;
                        margin-bottom: 30px;
                        line-height: 1.5;
                    }
                    .btn {
                        display: inline-block;
                        background-color: #3b82f6;
                        color: #ffffff;
                        padding: 12px 30px;
                        text-decoration: none;
                        border-radius: 50px;
                        font-size: 16px;
                        font-weight: 500;
                        transition: background-color 0.3s ease;
                    }
                    .btn:hover {
                        background-color: #2563eb;
                    }
                    .footer {
                        margin-top: 20px;
                        font-size: 12px;
                        color: #718096;
                    }
                    .footer a {
                        color: #3b82f6;
                        text-decoration: none;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Verification Failed</h1>
                    <p>Verification token is missing. Please check the link or request a new verification email.</p>
                    <a href="/request-new-verification" class="btn">Request New Link</a>
                    <div class="footer">
                        <p>Need help? Contact us at <a href="mailto:support@vms.com">support@vms.com</a></p>
                        <p>&copy; ${new Date().getFullYear()} Visitor Management System</p>
                    </div>
                </div>
            </body>
            </html>
        `);
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        // Update the user in the database to mark them as verified.
        await pool.query('UPDATE users SET is_verified = ? WHERE id = ?', [true, userId]);

        // Serve the success page
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Email Verification Success</title>
                <style>
                    body {
                        font-family: 'Roboto', Arial, sans-serif;
                        background-color: #f4f7fa;
                        margin: 0;
                        padding: 0;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                        color: #333333;
                    }
                    .container {
                        max-width: 500px;
                        background: #ffffff;
                        border-radius: 10px;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                        padding: 40px;
                        text-align: center;
                    }
                    h1 {
                        color: #2c5282;
                        font-size: 28px;
                        margin-bottom: 20px;
                    }
                    p {
                        font-size: 16px;
                        color: #4a5568;
                        margin-bottom: 30px;
                        line-height: 1.5;
                    }
                    .btn {
                        display: inline-block;
                        background-color: #3b82f6;
                        color: #ffffff;
                        padding: 12px 30px;
                        text-decoration: none;
                        border-radius: 50px;
                        font-size: 16px;
                        font-weight: 500;
                        transition: background-color 0.3s ease;
                    }
                    .btn:hover {
                        background-color: #2563eb;
                    }
                    .footer {
                        margin-top: 20px;
                        font-size: 12px;
                        color: #718096;
                    }
                    .footer a {
                        color: #3b82f6;
                        text-decoration: none;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Email Verified Successfully!</h1>
                    <p>Your email has been verified, and your account is now active. You can now log in to the Visitor Management System and start exploring.</p>
                    <a href="http://localhost:3000/login" class="btn">Go to Login</a>
                    <div class="footer">
                        <p>Need help? Contact us at <a href="mailto:support@vms.com">support@vms.com</a></p>
                        <p>&copy; ${new Date().getFullYear()} Visitor Management System</p>
                    </div>
                </div>
            </body>
            </html>
        `);

    } catch (error) {
        console.error('Email verification error:', error);
        res.status(400).send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Email Verification Error</title>
                <style>
                    body {
                        font-family: 'Roboto', Arial, sans-serif;
                        background-color: #f4f7fa;
                        margin: 0;
                        padding: 0;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                        color: #333333;
                    }
                    .container {
                        max-width: 500px;
                        background: #ffffff;
                        border-radius: 10px;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                        padding: 40px;
                        text-align: center;
                    }
                    h1 {
                        color: #c53030;
                        font-size: 28px;
                        margin-bottom: 20px;
                    }
                    p {
                        font-size: 16px;
                        color: #4a5568;
                        margin-bottom: 30px;
                        line-height: 1.5;
                    }
                    .btn {
                        display: inline-block;
                        background-color: #3b82f6;
                        color: #ffffff;
                        padding: 12px 30px;
                        text-decoration: none;
                        border-radius: 50px;
                        font-size: 16px;
                        font-weight: 500;
                        transition: background-color 0.3s ease;
                    }
                    .btn:hover {
                        background-color: #2563eb;
                    }
                    .footer {
                        margin-top: 20px;
                        font-size: 12px;
                        color: #718096;
                    }
                    .footer a {
                        color: #3b82f6;
                        text-decoration: none;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Verification Failed</h1>
                    <p>The verification link is invalid or has expired. Please request a new verification email.</p>
                    <a href="/request-new-verification" class="btn">Request New Link</a>
                    <div class="footer">
                        <p>Need help? Contact us at <a href="mailto:support@vms.com">support@vms.com</a></p>
                        <p>&copy; ${new Date().getFullYear()} Visitor Management System</p>
                    </div>
                </div>
            </body>
            </html>
        `);
    }
});



/**
 * @route   POST /api/login
 * @desc    Authenticate a user and get a token
 * @access  Public
 */
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];

    // Note: Passwords should be hashed in a real application.
    if (!user || user.password !== password) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Skip email verification for users with the 'host' role
    if (user.role !== 'host' && !user.is_verified) {
      return res.status(403).json({ message: 'Please verify your email address before logging in.' });
    }

    // Company name is now directly available in the users table
    const companyInfo = user.company_name || null;

    // Create a JWT with user ID and role, expiring in 1 day
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({
      token,
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        role: user.role,
        company_name: companyInfo
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
});



/**
 * @route   POST /api/visits
 * @desc    Create a new visit (Check-In) by always creating a new visitor record.
 * @access  Protected (admin or host)
 */
app.post('/api/visits', authenticateToken, async (req, res) => {
    // Destructure all fields from the request body
    const {
        name, email, phone, designation, company, companyTel, website, address,
        reason, itemsCarried, photo, idCardPhoto, idCardNumber, idCardType,
        qr_code, pre_registration_id // New fields for QR scan check-in
    } = req.body;
    
    let hostName = req.body.hostName; // Allow hostName to be modified for QR scans
    
    // Debug: Log received data for QR scans
    console.log('Check-in request received:');
    console.log('- User role:', req.user.role);
    console.log('- QR Code:', qr_code);
    console.log('- Pre-registration ID:', pre_registration_id);
    console.log('- Host Name from request:', hostName);
    console.log('- ID Card Type:', idCardType);
    console.log('- ID Card Number:', idCardNumber);
    console.log('- Request body keys:', Object.keys(req.body));

    if (!name || !email || !hostName || !idCardNumber || !idCardType) {
        return res.status(400).json({ message: 'Missing required fields for check-in.' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        let host_id;

        if (req.user.role === 'host') {
            // For QR scan check-ins, allow the scanning host to check in any visitor
            if (qr_code && pre_registration_id) {
                console.log('QR scan check-in detected - allowing host to check in visitor');
                host_id = req.user.id;
                
                // Update the hostName to be the scanning host's name
                const [scanningHost] = await connection.query("SELECT name FROM users WHERE id = ?", [req.user.id]);
                if (scanningHost.length > 0) {
                    // Override hostName with the scanning host's name
                    hostName = scanningHost[0].name;
                }
            } else {
                // Regular check-in: host can only check in visitors for themselves
                const [hostUser] = await connection.query("SELECT name FROM users WHERE id = ?", [req.user.id]);
                if (hostUser.length === 0 || hostUser[0].name.toLowerCase() !== hostName.toLowerCase()) {
                    await connection.rollback();
                    return res.status(403).json({ message: 'Hosts can only check in visitors for themselves.' });
                }
                host_id = req.user.id;
            }
        } else if (req.user.role === 'admin') {
            // If the logged-in user is an admin, find the host within their company
            const [adminUser] = await connection.query(
                'SELECT company_name FROM users WHERE id = ?',
                [req.user.id]
            );

            if (!adminUser.length || !adminUser[0].company_name) {
                await connection.rollback();
                return res.status(400).json({ message: 'Admin company information not found.' });
            }

            const adminCompanyName = adminUser[0].company_name;

            // Find the host by name within the admin's company
            const [hostRows] = await connection.query(`
                SELECT u.id 
                FROM users u
                WHERE u.name = ? 
                  AND u.role = 'host' 
                  AND u.company_name = ?
            `, [hostName, adminCompanyName]);

            if (hostRows.length === 0) {
                await connection.rollback();
                return res.status(404).json({ message: 'Host not found in your company.' });
            }

            host_id = hostRows[0].id;
        } else {
            await connection.rollback();
            return res.status(403).json({ message: 'Unauthorized access.' });
        }

        // Get the company name of the host to check for same-company active visits
        const [hostCompanyInfo] = await connection.query(
            'SELECT company_name FROM users WHERE id = ?',
            [host_id]
        );

        if (!hostCompanyInfo.length) {
            await connection.rollback();
            return res.status(400).json({ message: 'Host company information not found.' });
        }

        const hostCompanyName = hostCompanyInfo[0].company_name;

        // Check for an active visit using the VISITOR'S EMAIL within the SAME COMPANY only
        const [activeVisits] = await connection.query(
           `SELECT v.id FROM visits v
            JOIN visitors vis ON v.visitor_id = vis.id
            JOIN users h ON v.host_id = h.id
            WHERE vis.email = ? AND v.check_out_time IS NULL AND h.company_name = ?`,
           [email, hostCompanyName]
        );

        if (activeVisits.length > 0) {
            // If an active visit for this email exists in the same company, prevent check-in.
            await connection.rollback();
            return res.status(409).json({ message: `This visitor is already checked in to ${hostCompanyName} and has not checked out yet. Please check out first before checking in again to the same company.` });
        }

        // Always insert a new record into the 'visitors' table for this visit.
        const [newVisitorResult] = await connection.query(
            `INSERT INTO visitors 
              (name, email, phone, designation, company, companyTel, website, address, photo, idCardPhoto, idCardNumber, type_of_card) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name, email, phone, designation, company, companyTel, website, address,
                photo, idCardPhoto, idCardNumber, idCardType
            ]
        );
        const visitor_id = newVisitorResult.insertId;

        // Insert the new visit record, linking it to the newly created visitor record.
        const check_in_time = new Date();
        const [newVisitResult] = await connection.query(
            'INSERT INTO visits (visitor_id, host_id, reason, itemsCarried, check_in_time, qr_code, pre_registration_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [visitor_id, host_id, reason, itemsCarried, check_in_time, qr_code || null, pre_registration_id || null]
        );

        // If this is from a QR scan (pre-registration), update the pre-registration status
        if (pre_registration_id) {
            await connection.query(
                'UPDATE pre_registrations SET status = ?, check_in_time = NOW() WHERE id = ?',
                ['checked_in', pre_registration_id]
            );
            console.log(`Updated pre-registration ${pre_registration_id} status to 'checked_in'`);
        }

        await connection.commit();
        res.status(201).json({ 
            message: 'Check-in successful!', 
            visitId: newVisitResult.insertId,
            visitor_id: visitor_id,
            fromPreRegistration: !!pre_registration_id
        });

    } catch (error) {
        await connection.rollback();
        console.error('Check-in error:', error);
        res.status(500).json({ message: 'Database transaction failed.', error: error.message });
    } finally {
        connection.release();
    }
});



/**
 * @route   GET /api/visits
 * @desc    Get all visits with filtering (admin only) - filtered by admin's company
 * @access  Protected (admin only)
 */
app.get('/api/visits', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required.' });
  }

  const { hostId, startDate, endDate, hostName, visitorName } = req.query;

  try {
    // First, get the admin's company name from users table
    const [adminUser] = await pool.query(
      'SELECT company_name FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!adminUser.length || !adminUser[0].company_name) {
      return res.status(400).json({ message: 'Admin company information not found.' });
    }

    const adminCompanyName = adminUser[0].company_name;

    // Build the query to get visits only from hosts in the same company
    let query = `
      SELECT DISTINCT
        v.id, v.reason, v.itemsCarried, v.check_in_time, v.check_out_time,
        vis.id AS visitor_id, vis.name AS visitorName, vis.email AS visitorEmail, vis.phone AS visitorPhone, 
        vis.designation, vis.company, vis.photo AS visitorPhoto, vis.idCardPhoto, vis.idCardNumber,
        h.id AS host_id, h.name AS hostName, h.company_name AS hostCompany
      FROM visits v
      JOIN visitors vis ON v.visitor_id = vis.id
      JOIN users h ON v.host_id = h.id
      WHERE h.company_name = ?
    `;
    const params = [adminCompanyName];
    const conditions = [];

    if (hostId) {
      conditions.push('v.host_id = ?');
      params.push(hostId);
    }
    if (startDate) {
      conditions.push('DATE(v.check_in_time) >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('DATE(v.check_in_time) <= ?');
      params.push(endDate);
    }
    if (hostName) {
      conditions.push('h.name LIKE ?');
      params.push(`%${hostName}%`);
    }
    if (visitorName) {
      conditions.push('vis.name LIKE ?');
      params.push(`%${visitorName}%`);
    }

    if (conditions.length) {
      query += ' AND ' + conditions.join(' AND ');
    }
    query += ' ORDER BY v.check_in_time DESC';

    const [visits] = await pool.query(query, params);
    res.json(visits);
  } catch (error) {
    console.error('Fetch visits error:', error);
    res.status(500).json({ message: 'Failed to fetch visits.' });
  }
});

/**
 * @route   GET /api/host-visits
 * @desc    Get visits for the authenticated host
 * @access  Protected (host only)
 */
app.get('/api/host-visits', authenticateToken, async (req, res) => {
  if (req.user.role !== 'host') {
    return res.status(403).json({ message: 'Host access required.' });
  }

  const hostId = req.user.id;

  let query = `
    SELECT
      v.id, v.reason, v.itemsCarried, v.check_in_time, v.check_out_time,
      vis.id AS visitor_id, vis.name AS visitorName, vis.email AS visitorEmail, vis.phone AS visitorPhone,
      vis.designation, vis.company, vis.photo AS visitorPhoto, vis.idCardPhoto, vis.idCardNumber,
      h.id AS host_id, h.name AS hostName
    FROM visits v
    JOIN visitors vis ON v.visitor_id = vis.id
    JOIN users h ON v.host_id = h.id
    WHERE v.host_id = ?
    ORDER BY v.check_in_time DESC
  `;

  try {
    const [visits] = await pool.query(query, [hostId]);
    res.json(visits);
  } catch (error) {
    console.error('Fetch host visits error:', error);
    res.status(500).json({ message: 'Failed to fetch visits.' });
  }
});

/**
 * @route   PUT /api/visits/:id/checkout
 * @desc    Check out a visitor
 * @access  Protected (admin or host)
 */
app.put('/api/visits/:id/checkout', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  if (req.user.role === 'host') {
    const [visitRows] = await pool.query('SELECT host_id FROM visits WHERE id = ?', [id]);
    if (visitRows.length === 0 || visitRows[0].host_id !== req.user.id) {
      return res.status(403).json({ message: 'Hosts can only check out their own visitors.' });
    }
  }

  const check_out_time = new Date();
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // First, get the visit details to check if it's from a pre-registration
    const [visitDetails] = await connection.query(
      'SELECT pre_registration_id FROM visits WHERE id = ? AND check_out_time IS NULL',
      [id]
    );
    
    if (visitDetails.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Visit not found or visitor already checked out.' });
    }
    
    // Update the visit checkout time
    const [result] = await connection.query(
      'UPDATE visits SET check_out_time = ? WHERE id = ? AND check_out_time IS NULL',
      [check_out_time, id]
    );
    
    // If this visit was from a pre-registration, update the pre-registration status
    if (visitDetails[0].pre_registration_id) {
      await connection.query(
        'UPDATE pre_registrations SET status = ?, checked_out_at = NOW() WHERE id = ?',
        ['checked_out', visitDetails[0].pre_registration_id]
      );
      console.log(`Updated pre-registration ${visitDetails[0].pre_registration_id} status to 'checked_out'`);
    }
    
    await connection.commit();
    
    if (result.affectedRows > 0) {
      res.json({ 
        message: 'Check-out successful.',
        fromPreRegistration: !!visitDetails[0].pre_registration_id
      });
    } else {
      res.status(404).json({ message: 'Visit not found or visitor already checked out.' });
    }
  } catch (error) {
    await connection.rollback();
    console.error('Check-out error:', error);
    res.status(500).json({ message: 'Failed to check out visitor.' });
  } finally {
    connection.release();
  }
});

/**
 * @route   PUT /api/visitors/:id/blacklist
 * @desc    Blacklist or unblacklist a visitor based on email (affects all visits by this email)
 * @access  Protected (admin only)
 */
app.put('/api/visitors/:id/blacklist', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { isBlacklisted } = req.body;
  
  // Only admins can blacklist/unblacklist visitors
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required to blacklist visitors.' });
  }

  try {
    // First check if the visitor exists and get their email
    const [visitorCheck] = await pool.query(`
      SELECT v.id, v.name, v.email
      FROM visitors v
      WHERE v.id = ?
    `, [id]);

    if (!visitorCheck.length) {
      return res.status(404).json({ message: 'Visitor not found.' });
    }

    const visitor = visitorCheck[0];
    const visitorEmail = visitor.email;

    if (!visitorEmail) {
      return res.status(400).json({ message: 'Visitor email not found. Cannot blacklist without email.' });
    }

    // Update the blacklist status for ALL visitors with this email
    const [result] = await pool.query(
      'UPDATE visitors SET is_blacklisted = ?, updated_at = NOW() WHERE email = ?',
      [isBlacklisted, visitorEmail]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'No visitors found with this email or no changes made.' });
    }

    // Log the action for audit trail
    console.log(`Admin ${req.user.id} ${isBlacklisted ? 'blacklisted' : 'unblacklisted'} all visitors with email ${visitorEmail} (${result.affectedRows} records affected)`);

    res.json({ 
      message: `All visitors with email ${visitorEmail} ${isBlacklisted ? 'blacklisted' : 'unblacklisted'} successfully. ${result.affectedRows} records updated.`,
      visitorId: id,
      visitorName: visitor.name,
      visitorEmail: visitorEmail,
      isBlacklisted: isBlacklisted,
      affectedRecords: result.affectedRows
    });

  } catch (error) {
    console.error('Blacklist update error:', error);
    res.status(500).json({ message: 'Failed to update visitor blacklist status.' });
  }
});

/**
 * @route   GET /api/users
 * @desc    Get all users from admin's company (for admin dashboard)
 * @access  Protected (admin only)
 */
app.get('/api/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required.' });
  }
  try {
    // First, get the admin's company name from users table
    const [adminUser] = await pool.query(
      'SELECT company_name FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!adminUser.length || !adminUser[0].company_name) {
      return res.status(400).json({ message: 'Admin company information not found.' });
    }

    const adminCompanyName = adminUser[0].company_name;

    // Get users that belong to the same company as the admin
    const [users] = await pool.query(`
      SELECT u.id, u.name, u.email, u.role, u.company_name 
      FROM users u
      WHERE u.company_name = ?
      ORDER BY u.role, u.name
    `, [adminCompanyName]);
    res.json(users);
  } catch (error) {
    console.error('Fetch users error:', error);
    res.status(500).json({ message: 'Failed to fetch users.' });
  }
});

/**
 * @route   GET /api/hosts
 * @desc    Get all hosts from the current user's company (for dropdown in visitor check-in)
 * @access  Protected (admin or host)
 */
app.get('/api/hosts', authenticateToken, async (req, res) => {
  try {
    let companyName;
    
    if (req.user.role === 'admin') {
      // Get the admin's company name from users table
      const [adminUser] = await pool.query(
        'SELECT company_name FROM users WHERE id = ?',
        [req.user.id]
      );
      
      if (!adminUser.length || !adminUser[0].company_name) {
        return res.status(400).json({ message: 'Admin company information not found.' });
      }
      
      companyName = adminUser[0].company_name;
      
      // Get all hosts from the same company
      const [hosts] = await pool.query(`
        SELECT u.id, u.name, u.email, u.company_name 
        FROM users u
        WHERE u.role = 'host' AND u.company_name = ?
        ORDER BY u.name
      `, [companyName]);
      
      res.json(hosts);
    } else if (req.user.role === 'host') {
      // For hosts, only return themselves
      const [hostUser] = await pool.query(`
        SELECT u.id, u.name, u.email, u.company_name 
        FROM users u
        WHERE u.id = ?
      `, [req.user.id]);
      
      res.json(hostUser);
    } else {
      return res.status(403).json({ message: 'Access denied.' });
    }
  } catch (error) {
    console.error('Fetch hosts error:', error);
    res.status(500).json({ message: 'Failed to fetch hosts.' });
  }
});

// ============== REPORTING & ANALYTICS ENDPOINTS ==============

/**
 * @route   GET /api/reports
 * @desc    Get comprehensive reports data for the admin's company.
 * @access  Protected (admin only)
 */
app.get('/api/reports', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required.' });
    }

    const { startDate, endDate } = req.query;

    // 1. Get the admin's company name to scope all queries
    const [adminUser] = await pool.query('SELECT company_name FROM users WHERE id = ?', [req.user.id]);
    if (!adminUser.length || !adminUser[0].company_name) {
      return res.status(400).json({ message: 'Admin company information not found.' });
    }
    const adminCompanyName = adminUser[0].company_name;

    // 2. Prepare dynamic parts of the queries
    const queryParams = [adminCompanyName];
    let dateFilterClause = '';
    if (startDate && endDate) {
      dateFilterClause = 'AND DATE(v.check_in_time) BETWEEN ? AND ?';
      queryParams.push(startDate, endDate);
    }

    // 3. Execute all queries for the report, scoped by company name
    // Overview Stats
    const [overviewResult] = await pool.query(`
      SELECT
        COUNT(v.id) AS totalVisits,
        COUNT(DISTINCT vis.email) AS uniqueVisitors,
        AVG(TIMESTAMPDIFF(MINUTE, v.check_in_time, v.check_out_time)) AS avgDuration
      FROM visits v
      JOIN users h ON v.host_id = h.id
      LEFT JOIN visitors vis ON v.visitor_id = vis.id
      WHERE h.company_name = ? ${dateFilterClause}
    `, queryParams);

    // Daily Stats
    const [dailyResult] = await pool.query(`
      SELECT
        DATE(v.check_in_time) as date,
        COUNT(v.id) as visits
      FROM visits v
      JOIN users h ON v.host_id = h.id
      WHERE h.company_name = ? ${dateFilterClause}
      GROUP BY DATE(v.check_in_time)
      ORDER BY date ASC
    `, queryParams);

    // Host Performance
    const [hostResult] = await pool.query(`
      SELECT
        h.name as host_name,
        COUNT(v.id) as visits
      FROM visits v
      JOIN users h ON v.host_id = h.id
      WHERE h.company_name = ? ${dateFilterClause}
      GROUP BY h.name
      ORDER BY visits DESC
    `, queryParams);

    // Visit Purposes
    const [purposeResult] = await pool.query(`
      SELECT
        COALESCE(v.reason, 'Not Specified') as purpose,
        COUNT(v.id) as count
      FROM visits v
      JOIN users h ON v.host_id = h.id
      WHERE h.company_name = ? ${dateFilterClause}
      GROUP BY COALESCE(v.reason, 'Not Specified')
      ORDER BY count DESC
    `, queryParams);

    // 4. Assemble and send the response
    res.json({
      overview: overviewResult[0] || { totalVisits: 0, uniqueVisitors: 0, avgDuration: 0 },
      dailyStats: dailyResult || [],
      hostStats: hostResult || [],
      purposeStats: purposeResult || []
    });

  } catch (error) {
    console.error('Reports error:', error);
    res.status(500).json({ message: 'Failed to generate reports.' });
  }
});

/**
 * @route   GET /api/reports/export
 * @desc    Export report data for the admin's company.
 * @access  Protected (admin only)
 */
app.get('/api/reports/export', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required.' });
    }
    
    const { format, startDate, endDate } = req.query;

    // 1. Get the admin's company name
    const [adminUser] = await pool.query('SELECT company_name FROM users WHERE id = ?', [req.user.id]);
    if (!adminUser.length || !adminUser[0].company_name) {
      return res.status(400).json({ message: 'Admin company information not found.' });
    }
    const adminCompanyName = adminUser[0].company_name;
    
    // 2. Prepare query params and date filter
    const queryParams = [adminCompanyName];
    let dateFilterClause = '';
    if (startDate && endDate) {
      dateFilterClause = 'AND DATE(v.check_in_time) BETWEEN ? AND ?';
      queryParams.push(startDate, endDate);
    }
    
    // 3. Fetch data similar to the main reports endpoint
    // Overview
    const [overviewResult] = await pool.query(`
      SELECT COUNT(v.id) AS totalVisits, COUNT(DISTINCT vis.email) AS uniqueVisitors,
      AVG(TIMESTAMPDIFF(MINUTE, v.check_in_time, v.check_out_time)) AS avgDuration
      FROM visits v JOIN users h ON v.host_id = h.id LEFT JOIN visitors vis ON v.visitor_id = vis.id
      WHERE h.company_name = ? ${dateFilterClause}
    `, queryParams);

    // Daily
    const [dailyResult] = await pool.query(`
      SELECT DATE(v.check_in_time) as date, COUNT(v.id) as visits
      FROM visits v JOIN users h ON v.host_id = h.id
      WHERE h.company_name = ? ${dateFilterClause} GROUP BY DATE(v.check_in_time) ORDER BY date ASC
    `, queryParams);

    // Host
    const [hostResult] = await pool.query(`
      SELECT h.name as host_name, COUNT(v.id) as visits
      FROM visits v JOIN users h ON v.host_id = h.id
      WHERE h.company_name = ? ${dateFilterClause} GROUP BY h.name ORDER BY visits DESC
    `, queryParams);

    // Purpose
    const [purposeResult] = await pool.query(`
      SELECT COALESCE(v.reason, 'Not Specified') as purpose, COUNT(v.id) as count
      FROM visits v JOIN users h ON v.host_id = h.id
      WHERE h.company_name = ? ${dateFilterClause} GROUP BY COALESCE(v.reason, 'Not Specified') ORDER BY count DESC
    `, queryParams);

    const reportData = {
      overview: overviewResult[0] || { totalVisits: 0, uniqueVisitors: 0, avgDuration: 0 },
      dailyStats: dailyResult || [],
      hostStats: hostResult || [],
      purposeStats: purposeResult || []
    };

    // 4. Generate and send file based on format
    if (format === 'pdf') {
      const htmlContent = generateHTMLContent(reportData, startDate, endDate);
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `attachment; filename="visitor-report-${Date.now()}.html"`);
      res.send(htmlContent);
    } else if (format === 'excel') {
      const excelContent = generateExcelContent(reportData, startDate, endDate);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="visitor-report-${Date.now()}.csv"`);
      res.send(excelContent);
    } else {
      res.status(400).json({ message: 'Invalid format. Use pdf or excel.' });
    }

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ message: 'Failed to export data.' });
  }
});


// Helper function to generate HTML content for PDF
function generateHTMLContent(data, startDate, endDate) {
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Visitor Management System Report</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            color: #333;
            line-height: 1.6;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #007bff;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #007bff;
            margin: 0;
            font-size: 28px;
        }
        .meta-info {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 30px;
        }
        .section {
            margin-bottom: 30px;
        }
        .section h2 {
            color: #007bff;
            border-bottom: 1px solid #dee2e6;
            padding-bottom: 10px;
        }
        .stats-grid {
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }
        .stat-card {
            flex: 1;
            min-width: 200px;
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            text-align: center;
        }
        .stat-number {
            font-size: 24px;
            font-weight: bold;
            color: #007bff;
        }
        .stat-label {
            font-size: 14px;
            color: #666;
            margin-top: 5px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        th, td {
            padding: 10px;
            text-align: left;
            border-bottom: 1px solid #dee2e6;
        }
        th {
            background-color: #007bff;
            color: white;
            font-weight: bold;
        }
        tr:nth-child(even) {
            background-color: #f8f9fa;
        }
        .print-only {
            display: none;
        }
        @media print {
            .print-only {
                display: block;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>VISITOR MANAGEMENT SYSTEM</h1>
        <h2>Analytics Report</h2>
    </div>

    <div class="meta-info">
        <strong>Generated:</strong> ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}<br>
        <strong>Report Period:</strong> ${startDate || 'All time'} to ${endDate || 'Present'}<br>
        <strong>Report Type:</strong> Comprehensive Visitor Analytics
    </div>

    <div class="section">
        <h2>投 Overview Statistics</h2>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">${data.overview.totalVisits}</div>
                <div class="stat-label">Total Visits</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${data.overview.uniqueVisitors}</div>
                <div class="stat-label">Unique Visitors</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${data.overview.todayVisits || 0}</div>
                <div class="stat-label">Today's Visits</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${Math.round(parseFloat(data.overview.avgDuration || 0))} min</div>
                <div class="stat-label">Average Duration</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>嶋 Daily Visitor Trends</h2>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Total Visits</th>
                </tr>
            </thead>
            <tbody>
                ${data.dailyStats.map(day => `
                    <tr>
                        <td>${new Date(day.date).toLocaleDateString()}</td>
                        <td>${day.visits}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>則 Host Performance</h2>
        <table>
            <thead>
                <tr>
                    <th>Host Name</th>
                    <th>Total Visits</th>
                </tr>
            </thead>
            <tbody>
                ${data.hostStats.map(host => `
                    <tr>
                        <td>${host.host_name}</td>
                        <td>${host.visits}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>識 Visit Purposes</h2>
        <table>
            <thead>
                <tr>
                    <th>Purpose</th>
                    <th>Number of Visits</th>
                    <th>Percentage</th>
                </tr>
            </thead>
            <tbody>
                ${data.purposeStats.map(purpose => {
                    const percentage = data.overview.totalVisits > 0 ? 
                        ((purpose.count / data.overview.totalVisits) * 100).toFixed(1) : 0;
                    return `
                        <tr>
                            <td>${purpose.purpose}</td>
                            <td>${purpose.count}</td>
                            <td>${percentage}%</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    </div>

    <div class="print-only" style="margin-top: 50px; text-align: center; color: #666; font-size: 12px;">
        <p>This report was generated by the Visitor Management System</p>
        <p>For more information, please contact your system administrator</p>
    </div>

    <script>
        // Auto-print when opened (optional)
        // window.onload = function() { window.print(); }
    </script>
</body>
</html>
  `;
  
  return htmlContent;
}

// Helper function to generate Excel content
function generateExcelContent(data, startDate, endDate) {
  // Simple CSV format - in production, use a proper Excel library like xlsx
  const csvContent = [
    'VISITOR MANAGEMENT SYSTEM REPORT',
    `Generated: ${new Date().toLocaleDateString()}`,
    `Period: ${startDate || 'All time'} to ${endDate || 'Present'}`,
    '',
    'OVERVIEW STATISTICS',
    'Metric,Value',
    `Total Visits,${data.overview.totalVisits}`,
    `Unique Visitors,${data.overview.uniqueVisitors}`,
    `Today's Visits,${data.overview.todayVisits || 0}`,
    `Average Duration (minutes),${Math.round(parseFloat(data.overview.avgDuration || 0))}`,
    '',
    'DAILY STATISTICS',
    'Date,Visits',
    ...data.dailyStats.map(day => 
      `${new Date(day.date).toLocaleDateString()},${day.visits}`
    ),
    '',
    'HOST PERFORMANCE',
    'Host Name,Visits',
    ...data.hostStats.map(host => 
      `${host.host_name},${host.visits}`
    ),
    '',
    'VISIT PURPOSES',
    'Purpose,Count',
    ...data.purposeStats.map(purpose => 
      `${purpose.purpose},${purpose.count}`
    )
  ].join('\n');
  
  return Buffer.from(csvContent, 'utf-8');
}


// ============== ADVANCED VISITOR FEATURES ENDPOINTS ==============

// Pre-register a visitor
app.post('/api/visitors/pre-register', authenticateToken, async (req, res) => {
  try {
    const {
      visitorName, visitorEmail, visitorPhone, visitorCompany,
      hostName, visitDate, visitTime, purpose, duration,
      isRecurring, recurringPattern, recurringEndDate,
      specialRequirements, emergencyContact, vehicleNumber, numberOfVisitors
    } = req.body;

    // Handle legacy users without company_id by defaulting to 1
    let companyId = req.user.company_id;
    if (!companyId) {
      // Update the user's company_id in database but preserve existing company_name
      await pool.query('UPDATE users SET company_id = 1 WHERE id = ?', 
        [req.user.id]);
      companyId = 1;
    }

    const qrCode = `VMS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Handle empty date values - convert empty strings to null
    const cleanRecurringEndDate = recurringEndDate && recurringEndDate.trim() !== '' ? recurringEndDate : null;
    const cleanRecurringPattern = recurringPattern && recurringPattern.trim() !== '' ? recurringPattern : null;

    const [result] = await pool.query(`
      INSERT INTO pre_registrations (
        company_id, visitor_name, visitor_email, visitor_phone, visitor_company,
        host_name, visit_date, visit_time, purpose, duration,
        is_recurring, recurring_pattern, recurring_end_date,
        special_requirements, emergency_contact, vehicle_number, 
        number_of_visitors, qr_code, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      companyId, visitorName, visitorEmail, visitorPhone, visitorCompany,
      hostName, visitDate, visitTime, purpose, duration,
      isRecurring, cleanRecurringPattern, cleanRecurringEndDate,
      specialRequirements, emergencyContact, vehicleNumber,
      numberOfVisitors, qrCode
    ]);

    res.json({ 
      message: 'Visitor pre-registered successfully',
      id: result.insertId,
      qrCode
    });

  } catch (error) {
    console.error('Pre-registration error:', error);
    res.status(500).json({ message: 'Failed to pre-register visitor.' });
  }
});

// Test endpoint to check database and pre-registrations
app.get('/api/test/db', authenticateToken, async (req, res) => {
  try {
    const [result] = await pool.query('SELECT COUNT(*) as count FROM pre_registrations');
    const [samplePreReg] = await pool.query('SELECT qr_code, visitor_name, status FROM pre_registrations LIMIT 3');
    
    res.json({
      success: true,
      message: 'Database connection successful',
      preRegistrationCount: result[0].count,
      samplePreRegistrations: samplePreReg
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message
    });
  }
});

// QR Code Verification endpoint (returns visitor data for form pre-fill)
app.post('/api/visitors/qr-checkin', authenticateToken, async (req, res) => {
  const { qr_code, host_id, check_in_time, scan_method } = req.body;
  
  // Add debugging logs
  console.log('QR verification request received:', {
    qr_code,
    host_id,
    check_in_time,
    scan_method,
    user: req.user
  });
  
  if (!qr_code) {
    console.log('QR code validation failed: QR code is required');
    return res.status(400).json({ 
      success: false, 
      message: 'QR code is required' 
    });
  }

  let connection;
  try {
    // Test database connection first
    console.log('Getting database connection...');
    connection = await pool.getConnection();
    console.log('Database connection successful');
    
    // 1. Verify QR code in pre_registrations
    console.log('Searching for QR code:', qr_code);
    const [preRegResult] = await connection.query(`
      SELECT * FROM pre_registrations
      WHERE qr_code = ? AND status IN ('approved', 'pending')
    `, [qr_code]);
    
    console.log('Pre-registration query result:', preRegResult.length, 'records found');
    
    if (preRegResult.length === 0) {
      console.log('QR code not found');
      return res.status(404).json({
        success: false,
        message: 'QR code not found in pre-registrations or not approved'
      });
    }
    
    const preReg = preRegResult[0];
    console.log('Found pre-registration:', {
      id: preReg.id,
      visitor_name: preReg.visitor_name,
      visitor_email: preReg.visitor_email,
      status: preReg.status
    });

    // Get host name separately if host_id exists in pre_registrations
    let hostName = 'Unknown Host';
    let effectiveHostId = host_id; // Use the host_id from request first
    
    if (preReg.host_id) {
      effectiveHostId = effectiveHostId || preReg.host_id;
      try {
        const [hostResult] = await connection.query('SELECT name FROM users WHERE id = ?', [preReg.host_id]);
        if (hostResult.length > 0) {
          hostName = hostResult[0].name;
        }
      } catch (hostError) {
        console.log('Could not fetch host name:', hostError.message);
      }
    } else if (preReg.host_name) {
      // Fallback: if host_name is directly stored in pre_registrations
      hostName = preReg.host_name;
    }
    
    // Fallback for host_id if not available
    if (!effectiveHostId) {
      effectiveHostId = req.user.id; // Use the logged-in user as host
    }

    // 2. Check if already checked in today
    const today = new Date().toISOString().split('T')[0];
    const todayStart = `${today} 00:00:00`;
    const todayEnd = `${today} 23:59:59`;
    
    const [existingVisit] = await connection.query(`
      SELECT id FROM visits 
      WHERE visitor_email = ? 
      AND check_in_time BETWEEN ? AND ?
      AND status = 'checked_in'
    `, [preReg.visitor_email, todayStart, todayEnd]);
    
    if (existingVisit.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Visitor already checked in today'
      });
    }

    // Return visitor data for form pre-fill (don't create records yet)
    res.status(200).json({
      success: true,
      message: 'QR code verified successfully',
      visitor_name: preReg.visitor_name,
      visitor_email: preReg.visitor_email,
      visitor_phone: preReg.visitor_phone,
      visitor_company: preReg.visitor_company,
      purpose: preReg.purpose,
      host_name: hostName,
      host_id: effectiveHostId,
      pre_registration_id: preReg.id,
      visit_date: preReg.visit_date,
      visit_time: preReg.visit_time
    });
    
  } catch (error) {
    console.error('QR verification error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
      qr_code_received: qr_code,
      host_id_received: host_id
    });
    res.status(500).json({
      success: false,
      message: 'Internal server error during QR verification',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      debug: process.env.NODE_ENV === 'development' ? {
        code: error.code,
        errno: error.errno,
        sqlMessage: error.sqlMessage
      } : undefined
    });
  } finally {
    // Release connection
    if (connection) {
      connection.release();
    }
  }
});// Get pre-registrations
app.get('/api/visitors/pre-registrations', authenticateToken, async (req, res) => {
  try {
    // Handle legacy users without company_id by defaulting to 1
    let companyId = req.user.company_id;
    if (!companyId) {
      // Update the user's company_id in database but preserve existing company_name
      await pool.query('UPDATE users SET company_id = 1 WHERE id = ?', 
        [req.user.id]);
      companyId = 1;
    }
    
    const [preRegistrations] = await pool.query(`
      SELECT pr.*, 
        CASE 
          WHEN v.check_out_time IS NOT NULL THEN 'completed'
          WHEN v.check_in_time IS NOT NULL THEN 'in_progress'
          WHEN CONCAT(pr.visit_date, ' ', pr.visit_time) > NOW() THEN 'scheduled'
          ELSE 'missed'
        END as status,
        v.check_in_time, v.check_out_time
      FROM pre_registrations pr
      LEFT JOIN visits v ON pr.visitor_email = v.visitor_email 
        AND DATE(v.check_in_time) = pr.visit_date
      WHERE pr.company_id = ?
      ORDER BY pr.visit_date DESC, pr.visit_time DESC
    `, [companyId]);

    res.json(preRegistrations);

  } catch (error) {
    console.error('Pre-registrations fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch pre-registrations.' });
  }
});

// Generate visitor badge
app.get('/api/visitors/:visitId/badge', authenticateToken, async (req, res) => {
  try {
    const { visitId } = req.params;
    
    // Handle legacy users without company_id by defaulting to 1
    let companyId = req.user.company_id;
    if (!companyId) {
      await pool.query('UPDATE users SET company_id = 1 WHERE id = ?', 
        [req.user.id]);
      companyId = 1;
    }

    // First try to find the visit with company_id, then fallback to just visitId for legacy data
    let [visit] = await pool.query(`
      SELECT v.*, vis.name as visitor_name, vis.company as visitor_company, u.name as host_name
      FROM visits v
      LEFT JOIN visitors vis ON v.visitor_id = vis.id
      LEFT JOIN users u ON v.host_id = u.id
      WHERE v.id = ? AND (v.company_id = ? OR v.company_id IS NULL)
    `, [visitId, companyId]);

    if (visit.length === 0) {
      return res.status(404).json({ message: 'Visit not found.' });
    }

    const visitData = visit[0];
    
    // Use visitor_name from visits table if available, otherwise from joined visitors table
    const visitorName = visitData.visitor_name || visitData.name || 'Unknown Visitor';
    const visitorCompany = visitData.visitor_company || visitData.company || 'N/A';
    const hostName = visitData.host_name || visitData.name || 'Unknown Host';
    const purpose = visitData.purpose || visitData.reason || 'Visit';

    // Generate badge HTML
    const badgeHtml = `
      <div style="width: 400px; padding: 20px; border: 2px solid #000; text-align: center; font-family: Arial, sans-serif;">
        <h2 style="color: #333; margin: 0 0 20px 0;">VISITOR BADGE</h2>
        <h3 style="color: #0066cc; margin: 0 0 15px 0;">${visitorName}</h3>
        <p style="margin: 5px 0;"><strong>Company:</strong> ${visitorCompany}</p>
        <p style="margin: 5px 0;"><strong>Host:</strong> ${hostName}</p>
        <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(visitData.check_in_time || Date.now()).toLocaleDateString()}</p>
        <p style="margin: 5px 0;"><strong>Purpose:</strong> ${purpose}</p>
        <div style="margin-top: 20px; font-size: 12px; color: #666;">
          Visit ID: ${visitId}
        </div>
      </div>
    `;

    res.json({ html: badgeHtml, visitData });

  } catch (error) {
    console.error('Badge generation error:', error);
    res.status(500).json({ message: 'Failed to generate badge.' });
  }
});

// Generate badge for pre-registered visitor
app.get('/api/pre-registrations/:preRegId/badge', authenticateToken, async (req, res) => {
  try {
    const { preRegId } = req.params;
    
    // Handle legacy users without company_id by defaulting to 1
    let companyId = req.user.company_id;
    if (!companyId) {
      await pool.query('UPDATE users SET company_id = 1 WHERE id = ?', 
        [req.user.id]);
      companyId = 1;
    }

    // Get pre-registration data
    const [preRegistration] = await pool.query(`
      SELECT * FROM pre_registrations 
      WHERE id = ? AND company_id = ?
    `, [preRegId, companyId]);

    if (preRegistration.length === 0) {
      return res.status(404).json({ message: 'Pre-registration not found.' });
    }

    const preRegData = preRegistration[0];
    
    // Generate badge HTML for pre-registered visitor
    const badgeHtml = `
      <div style="width: 400px; padding: 20px; border: 2px solid #000; text-align: center; font-family: Arial, sans-serif; margin: 20px auto;">
        <div style="background-color: #f0f0f0; padding: 10px; margin: -20px -20px 20px -20px;">
          <h2 style="color: #333; margin: 0;">VISITOR BADGE</h2>
          <p style="margin: 5px 0; color: #666; font-size: 12px;">PRE-REGISTERED</p>
        </div>
        <h3 style="color: #0066cc; margin: 0 0 15px 0; font-size: 24px;">${preRegData.visitor_name}</h3>
        <div style="text-align: left; margin: 20px 0;">
          <p style="margin: 8px 0; font-size: 14px;"><strong>Company:</strong> ${preRegData.visitor_company || 'N/A'}</p>
          <p style="margin: 8px 0; font-size: 14px;"><strong>Host:</strong> ${preRegData.host_name}</p>
          <p style="margin: 8px 0; font-size: 14px;"><strong>Date:</strong> ${new Date(preRegData.visit_date).toLocaleDateString()}</p>
          <p style="margin: 8px 0; font-size: 14px;"><strong>Time:</strong> ${preRegData.visit_time}</p>
          <p style="margin: 8px 0; font-size: 14px;"><strong>Purpose:</strong> ${preRegData.purpose}</p>
          ${preRegData.visitor_phone ? `<p style="margin: 8px 0; font-size: 14px;"><strong>Phone:</strong> ${preRegData.visitor_phone}</p>` : ''}
        </div>
        <div style="border-top: 1px solid #ccc; padding-top: 15px; margin-top: 20px;">
          <p style="margin: 5px 0; font-size: 12px; color: #666;">QR Code: ${preRegData.qr_code}</p>
          <p style="margin: 5px 0; font-size: 10px; color: #999;">Pre-Registration ID: ${preRegId}</p>
        </div>
      </div>
      <div style="page-break-after: always;"></div>
    `;

    res.json({ 
      html: badgeHtml, 
      preRegData,
      qrCode: preRegData.qr_code 
    });

  } catch (error) {
    console.error('Pre-registration badge generation error:', error);
    res.status(500).json({ message: 'Failed to generate pre-registration badge.' });
  }
});

// Get visitor history
app.get('/api/visitors/history', authenticateToken, async (req, res) => {
  try {
    // Handle legacy users without company_id by defaulting to 1
    let companyId = req.user.company_id;
    if (!companyId) {
      await pool.query('UPDATE users SET company_id = 1 WHERE id = ?', 
        [req.user.id]);
      companyId = 1;
    }

    const { limit = 100, startDate, endDate, visitorEmail, hostName } = req.query;

    let query = `
      SELECT v.*, vis.name as visitor_name, vis.email as visitor_email, 
             vis.company as visitor_company, vis.is_blacklisted, u.name as host_name,
             CASE 
               WHEN v.check_out_time IS NOT NULL THEN 'completed'
               WHEN v.check_in_time IS NOT NULL THEN 'active'
               ELSE 'pending'
             END as status
      FROM visits v
      LEFT JOIN visitors vis ON v.visitor_id = vis.id
      LEFT JOIN users u ON v.host_id = u.id
      WHERE (v.company_id = ? OR (v.company_id IS NULL AND u.company_name = (SELECT company_name FROM users WHERE id = ?)))
    `;
    
    const params = [companyId, req.user.id];
    
    if (startDate) {
      query += ' AND DATE(v.check_in_time) >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND DATE(v.check_in_time) <= ?';
      params.push(endDate);
    }
    
    if (visitorEmail) {
      query += ' AND (vis.email LIKE ? OR v.visitor_email LIKE ?)';
      params.push(`%${visitorEmail}%`, `%${visitorEmail}%`);
    }
    
    if (hostName) {
      query += ' AND (u.name LIKE ? OR v.host_name LIKE ?)';
      params.push(`%${hostName}%`, `%${hostName}%`);
    }
    
    query += ' ORDER BY v.check_in_time DESC LIMIT ?';
    params.push(parseInt(limit));

    const [history] = await pool.query(query, params);

    res.json(history);

  } catch (error) {
    console.error('Visitor history error:', error);
    res.status(500).json({ message: 'Failed to fetch visitor history.' });
  }
});

// Get pending visitors from pre-registrations
app.get('/api/visitors/pending', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required.' });
    }

    // Get the admin's company name
    const [adminUser] = await pool.query(
      'SELECT company_name FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!adminUser.length || !adminUser[0].company_name) {
      return res.status(400).json({ message: 'Admin company information not found.' });
    }

    const adminCompanyName = adminUser[0].company_name;
    const { limit = 100, startDate, endDate, visitorName, visitorId } = req.query;

    // Get pending pre-registrations - those that haven't been checked in yet
    let query = `
      SELECT pr.*, 
        'pending' as status,
        'Pending' as category,
        NULL as check_in_time,
        NULL as check_out_time,
        pr.id as visitor_id
      FROM pre_registrations pr
      WHERE pr.id NOT IN (
        SELECT DISTINCT pr2.id 
        FROM pre_registrations pr2
        INNER JOIN visits v ON pr2.visitor_email = v.visitor_email 
        INNER JOIN visitors vis ON v.visitor_id = vis.id
        INNER JOIN users h ON v.host_id = h.id
        WHERE h.company_name = ? 
        AND DATE(v.check_in_time) = pr2.visit_date
      )
      AND EXISTS (
        SELECT 1 FROM users u WHERE u.name = pr.host_name AND u.company_name = ?
      )
    `;
    
    const params = [adminCompanyName, adminCompanyName];
    
    if (startDate) {
      query += ' AND DATE(pr.visit_date) >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND DATE(pr.visit_date) <= ?';
      params.push(endDate);
    }
    
    if (visitorName) {
      query += ' AND pr.visitor_name LIKE ?';
      params.push(`%${visitorName}%`);
    }

    if (visitorId) {
      query += ' AND pr.id = ?';
      params.push(visitorId);
    }
    
    query += ' ORDER BY pr.visit_date DESC, pr.visit_time DESC LIMIT ?';
    params.push(parseInt(limit));

    const [pending] = await pool.query(query, params);

    // Format the data to match the expected structure
    const formattedPending = pending.map(visit => ({
      id: visit.id,
      visitor_id: visit.id,
      visitor_name: visit.visitor_name,
      visitor_email: visit.visitor_email,
      visitor_phone: visit.visitor_phone,
      visitor_company: visit.visitor_company,
      host_name: visit.host_name,
      purpose: visit.purpose,
      visit_date: visit.visit_date,
      visit_time: visit.visit_time,
      check_in_time: null,
      check_out_time: null,
      status: 'pending',
      category: 'Pending',
      special_requirements: visit.special_requirements,
      qr_code: visit.qr_code,
      is_blacklisted: false
    }));

    res.json(formattedPending);

  } catch (error) {
    console.error('Pending visitors error:', error);
    res.status(500).json({ message: 'Failed to fetch pending visitors.' });
  }
});

// Get blacklisted visitors for the admin's company
app.get('/api/visitors/blacklisted', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required.' });
    }

    // Get the admin's company name
    const [adminUser] = await pool.query(
      'SELECT company_name FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!adminUser.length || !adminUser[0].company_name) {
      return res.status(400).json({ message: 'Admin company information not found.' });
    }

    const adminCompanyName = adminUser[0].company_name;
    const { limit = 100, startDate, endDate, visitorName, visitorId } = req.query;

    // Get blacklisted visitors who have visited the admin's company
    let query = `
      SELECT DISTINCT
        vis.id as visitor_id,
        vis.name as visitor_name,
        vis.email as visitor_email,
        vis.phone as visitor_phone,
        vis.company as visitor_company,
        vis.photo as visitor_photo,
        vis.is_blacklisted,
        'blacklisted' as status,
        'Blacklisted' as category,
        v.check_in_time,
        v.check_out_time,
        v.reason as purpose,
        h.name as host_name,
        v.id as visit_id
      FROM visitors vis
      INNER JOIN visits v ON vis.id = v.visitor_id
      INNER JOIN users h ON v.host_id = h.id
      WHERE vis.is_blacklisted = 1 
      AND h.company_name = ?
    `;
    
    const params = [adminCompanyName];
    
    if (startDate) {
      query += ' AND DATE(v.check_in_time) >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND DATE(v.check_in_time) <= ?';
      params.push(endDate);
    }
    
    if (visitorName) {
      query += ' AND vis.name LIKE ?';
      params.push(`%${visitorName}%`);
    }

    if (visitorId) {
      query += ' AND vis.id = ?';
      params.push(visitorId);
    }
    
    query += ' ORDER BY v.check_in_time DESC LIMIT ?';
    params.push(parseInt(limit));

    const [blacklisted] = await pool.query(query, params);

    res.json(blacklisted);

  } catch (error) {
    console.error('Blacklisted visitors error:', error);
    res.status(500).json({ message: 'Failed to fetch blacklisted visitors.' });
  }
});

// Get recurring visits
app.get('/api/visitors/recurring', authenticateToken, async (req, res) => {
  try {
    // Handle legacy users without company_id by defaulting to 1
    let companyId = req.user.company_id;
    if (!companyId) {
      await pool.query('UPDATE users SET company_id = 1 WHERE id = ?', 
        [req.user.id]);
      companyId = 1;
    }

    const [recurringVisits] = await pool.query(`
      SELECT *, 
        CASE 
          WHEN recurring_pattern = 'daily' THEN DATE_ADD(visit_date, INTERVAL 1 DAY)
          WHEN recurring_pattern = 'weekly' THEN DATE_ADD(visit_date, INTERVAL 1 WEEK)
          WHEN recurring_pattern = 'monthly' THEN DATE_ADD(visit_date, INTERVAL 1 MONTH)
          ELSE visit_date
        END as next_visit_date,
        CASE 
          WHEN recurring_end_date IS NULL OR recurring_end_date > CURDATE() THEN 'active'
          ELSE 'expired'
        END as recurring_status
      FROM pre_registrations 
      WHERE company_id = ? AND is_recurring = TRUE
      ORDER BY visit_date DESC
    `, [companyId]);

    res.json(recurringVisits);

  } catch (error) {
    console.error('Recurring visits error:', error);
    res.status(500).json({ message: 'Failed to fetch recurring visits.' });
  }
});

// Update recurring visit
app.put('/api/visitors/recurring/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { recurringPattern, recurringEndDate, status } = req.body;
    
    // Handle legacy users without company_id by defaulting to 1
    let companyId = req.user.company_id;
    if (!companyId) {
      await pool.query('UPDATE users SET company_id = 1 WHERE id = ?', 
        [req.user.id]);
      companyId = 1;
    }

    let updateQuery = 'UPDATE pre_registrations SET ';
    const params = [];
    const updates = [];
    
    if (recurringPattern) {
      updates.push('recurring_pattern = ?');
      params.push(recurringPattern);
    }
    
    if (recurringEndDate !== undefined) {
      updates.push('recurring_end_date = ?');
      params.push(recurringEndDate || null);
    }
    
    if (status === 'paused') {
      updates.push('status = ?');
      params.push('pending');
    } else if (status === 'stopped') {
      updates.push('is_recurring = ?');
      params.push(false);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ message: 'No updates provided.' });
    }
    
    updateQuery += updates.join(', ') + ' WHERE id = ? AND company_id = ?';
    params.push(id, companyId);

    const [result] = await pool.query(updateQuery, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Recurring visit not found.' });
    }

    res.json({ message: 'Recurring visit updated successfully.' });

  } catch (error) {
    console.error('Update recurring visit error:', error);
    res.status(500).json({ message: 'Failed to update recurring visit.' });
  }
});

// Generate recurring visit instances
app.post('/api/visitors/recurring/:id/generate', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Handle legacy users without company_id by defaulting to 1
    let companyId = req.user.company_id;
    if (!companyId) {
      await pool.query('UPDATE users SET company_id = 1 WHERE id = ?', 
        [req.user.id]);
      companyId = 1;
    }

    // Get the recurring visit template
    const [template] = await pool.query(`
      SELECT * FROM pre_registrations 
      WHERE id = ? AND company_id = ? AND is_recurring = TRUE
    `, [id, companyId]);

    if (template.length === 0) {
      return res.status(404).json({ message: 'Recurring visit template not found.' });
    }

    const visit = template[0];
    const instances = [];
    const maxInstances = 10; // Limit to prevent infinite loops

    let currentDate = new Date(visit.visit_date);
    const endDate = visit.recurring_end_date ? new Date(visit.recurring_end_date) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 3 months if no end date

    for (let i = 0; i < maxInstances && currentDate <= endDate; i++) {
      const qrCode = `VMS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const [result] = await pool.query(`
        INSERT INTO pre_registrations (
          company_id, visitor_name, visitor_email, visitor_phone, visitor_company,
          host_name, visit_date, visit_time, purpose, duration,
          is_recurring, recurring_pattern, recurring_end_date,
          special_requirements, emergency_contact, vehicle_number, 
          number_of_visitors, qr_code, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        visit.company_id, visit.visitor_name, visit.visitor_email, visit.visitor_phone, visit.visitor_company,
        visit.host_name, currentDate.toISOString().split('T')[0], visit.visit_time, visit.purpose, visit.duration,
        false, null, null, // Individual instances are not recurring
        visit.special_requirements, visit.emergency_contact, visit.vehicle_number,
        visit.number_of_visitors, qrCode, 'pending'
      ]);

      instances.push({
        id: result.insertId,
        visit_date: currentDate.toISOString().split('T')[0],
        qr_code: qrCode
      });

      // Calculate next date based on pattern
      switch (visit.recurring_pattern) {
        case 'daily':
          currentDate.setDate(currentDate.getDate() + 1);
          break;
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case 'monthly':
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
        default:
          break;
      }
    }

    res.json({ 
      message: `Generated ${instances.length} recurring visit instances`,
      instances: instances
    });

  } catch (error) {
    console.error('Generate recurring visits error:', error);
    res.status(500).json({ message: 'Failed to generate recurring visits.' });
  }
});

// ============== SYSTEM ADMINISTRATION ENDPOINTS ==============

// Get system settings
app.get('/api/admin/settings', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required.' });
    }

    const companyId = req.user.company_id;
    
    const [settings] = await pool.query(`
      SELECT * FROM company_settings WHERE company_id = ?
    `, [companyId]);

    if (settings.length === 0) {
      // Return default settings
      res.json({
        companyName: req.user.company_name,
        maxVisitDuration: 8,
        autoCheckoutEnabled: true,
        emailNotificationsEnabled: true,
        requirePhotoCapture: true,
        allowWalkIns: true,
        workingHoursStart: '09:00',
        workingHoursEnd: '18:00'
      });
    } else {
      res.json(settings[0]);
    }

  } catch (error) {
    console.error('Settings fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch settings.' });
  }
});

// Update system settings
app.put('/api/admin/settings', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required.' });
    }

    const companyId = req.user.company_id;
    const settings = req.body;

    await pool.query(`
      INSERT INTO company_settings (company_id, settings, updated_at)
      VALUES (?, ?, NOW())
      ON DUPLICATE KEY UPDATE settings = ?, updated_at = NOW()
    `, [companyId, JSON.stringify(settings), JSON.stringify(settings)]);

    res.json({ message: 'Settings updated successfully.' });

  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({ message: 'Failed to update settings.' });
  }
});

// Create admin user
app.post('/api/admin/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required.' });
    }

    const { username, email, password, role, department, isActive } = req.body;
    const companyId = req.user.company_id;

    const [result] = await pool.query(`
      INSERT INTO users (name, email, password, role, company_id, department, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `, [username, email, password, role, companyId, department, isActive]);

    res.json({ 
      message: 'User created successfully',
      id: result.insertId 
    });

  } catch (error) {
    console.error('User creation error:', error);
    res.status(500).json({ message: 'Failed to create user.' });
  }
});

// Get audit logs
app.get('/api/admin/audit-logs', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required.' });
    }

    const companyId = req.user.company_id;
    const { startDate, endDate, action, limit = 100 } = req.query;

    let query = `
      SELECT al.*, u.name as username
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.company_id = ?
    `;
    const params = [companyId];

    if (startDate && endDate) {
      query += ' AND DATE(al.timestamp) BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    if (action) {
      query += ' AND al.action = ?';
      params.push(action);
    }

    query += ' ORDER BY al.timestamp DESC LIMIT ?';
    params.push(parseInt(limit));

    const [logs] = await pool.query(query, params);
    res.json(logs);

  } catch (error) {
    console.error('Audit logs error:', error);
    res.status(500).json({ message: 'Failed to fetch audit logs.' });
  }
});

// Export system data
app.get('/api/admin/export', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required.' });
    }

    const companyId = req.user.company_id;

    // Get all company data
    const [users] = await pool.query('SELECT * FROM users WHERE company_id = ?', [companyId]);
    const [visits] = await pool.query('SELECT * FROM visits WHERE company_id = ?', [companyId]);
    const [preRegs] = await pool.query('SELECT * FROM pre_registrations WHERE company_id = ?', [companyId]);

    const exportData = {
      exportDate: new Date().toISOString(),
      companyId,
      users,
      visits,
      preRegistrations: preRegs
    };

    res.json(exportData);

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ message: 'Failed to export data.' });
  }
});

// Get system backups
app.get('/api/admin/backups', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required.' });
    }

    // Mock backup data - in production, this would list actual backup files
    const mockBackups = [
      {
        id: 1,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        size: 1024000,
        type: 'Full',
        status: 'completed',
        downloadUrl: '/api/downloads/backup-1.sql'
      },
      {
        id: 2,
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        size: 856000,
        type: 'Full',
        status: 'completed',
        downloadUrl: '/api/downloads/backup-2.sql'
      }
    ];

    res.json(mockBackups);

  } catch (error) {
    console.error('Backups fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch backups.' });
  }
});

// Create backup
app.post('/api/admin/backups', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required.' });
    }

    // Mock backup creation - in production, this would create actual backup
    res.json({ 
      message: 'Backup created successfully',
      id: Date.now()
    });

  } catch (error) {
    console.error('Backup creation error:', error);
    res.status(500).json({ message: 'Failed to create backup.' });
  }
});

// --- Start Server ---
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend server running on http://localhost:${PORT}`));
const mysql = require('mysql2/promise');

async function testQRQuery() {
  let connection;
  try {
    // Use the same connection settings as the main app
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '', 
      database: 'vms_db'
    });
    
    console.log('Connected to database successfully');
    
    // Test the exact query that's failing
    const qr_code = 'VMS-1753875036090-5ozemhz1u';
    
    console.log(`Testing QR query for: ${qr_code}`);
    
    const [result] = await connection.query(`
      SELECT * FROM pre_registrations
      WHERE qr_code = ? AND status IN ('approved', 'pending')
    `, [qr_code]);
    
    console.log('Query result:', result.length, 'records found');
    
    if (result.length > 0) {
      console.log('Found record:', {
        id: result[0].id,
        visitor_name: result[0].visitor_name,
        visitor_email: result[0].visitor_email,
        status: result[0].status
      });
    }
    
    // Also test without status filter to see if record exists
    const [allResults] = await connection.query(`
      SELECT * FROM pre_registrations WHERE qr_code = ?
    `, [qr_code]);
    
    console.log('All records with this QR code:', allResults.length);
    if (allResults.length > 0) {
      console.log('Record details:', allResults[0]);
    }
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testQRQuery();

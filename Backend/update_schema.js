const mysql = require('mysql2/promise');

async function updateSchema() {
  let connection;
  try {
    // Try connecting with common default settings
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '', // Empty password for XAMPP default
      database: 'vms_db'
    });
    
    console.log('Connected to database successfully');
    
    // Check if status column exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'vms_db' 
      AND TABLE_NAME = 'pre_registrations' 
      AND COLUMN_NAME = 'status'
    `);
    
    if (columns.length === 0) {
      console.log('Status column does not exist. Adding it...');
      await connection.execute(`
        ALTER TABLE pre_registrations 
        ADD COLUMN status ENUM('pending', 'approved', 'rejected', 'checked_in', 'checked_out') DEFAULT 'pending'
      `);
      console.log('Status column added successfully');
    } else {
      console.log('Status column already exists');
    }
    
    // Check if checked_out_at column exists
    const [checkoutColumns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'vms_db' 
      AND TABLE_NAME = 'pre_registrations' 
      AND COLUMN_NAME = 'checked_out_at'
    `);
    
    if (checkoutColumns.length === 0) {
      console.log('checked_out_at column does not exist. Adding it...');
      await connection.execute(`
        ALTER TABLE pre_registrations 
        ADD COLUMN checked_out_at TIMESTAMP NULL
      `);
      console.log('checked_out_at column added successfully');
    } else {
      console.log('checked_out_at column already exists');
    }
    
    // Show final table structure
    const [finalColumns] = await connection.execute('DESCRIBE pre_registrations');
    console.log('\nFinal table structure:');
    finalColumns.forEach(col => {
      console.log(`- ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Default ? 'DEFAULT ' + col.Default : ''}`);
    });
    
  } catch (error) {
    console.error('Database error:', error.message);
    console.log('\nPlease ensure:');
    console.log('1. MySQL server is running');
    console.log('2. Database "vms_db" exists');
    console.log('3. User has proper permissions');
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

updateSchema();

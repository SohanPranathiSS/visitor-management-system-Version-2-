const mysql = require('mysql2/promise');

async function fixAllTables() {
  let connection;
  try {
    // Create connection (update password as needed)
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '', // Update with your MySQL password if needed
      database: 'vms_db'
    });
    
    console.log('Connected to database successfully');
    
    // ========== FIX PRE_REGISTRATIONS TABLE ==========
    console.log('\n🔧 Fixing pre_registrations table...');
    
    // Check and add checked_in_at column
    const [checkedInAtCols] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'vms_db' 
      AND TABLE_NAME = 'pre_registrations' 
      AND COLUMN_NAME = 'checked_in_at'
    `);
    
    if (checkedInAtCols.length === 0) {
      console.log('Adding checked_in_at column to pre_registrations...');
      await connection.execute(`
        ALTER TABLE pre_registrations 
        ADD COLUMN checked_in_at TIMESTAMP NULL
      `);
      console.log('✅ checked_in_at column added');
    } else {
      console.log('✅ checked_in_at column already exists');
    }
    
    // Check and add checked_out_at column
    const [checkedOutAtCols] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'vms_db' 
      AND TABLE_NAME = 'pre_registrations' 
      AND COLUMN_NAME = 'checked_out_at'
    `);
    
    if (checkedOutAtCols.length === 0) {
      console.log('Adding checked_out_at column to pre_registrations...');
      await connection.execute(`
        ALTER TABLE pre_registrations 
        ADD COLUMN checked_out_at TIMESTAMP NULL
      `);
      console.log('✅ checked_out_at column added');
    } else {
      console.log('✅ checked_out_at column already exists');
    }
    
    // ========== FIX VISITS TABLE ==========
    console.log('\n🔧 Fixing visits table...');
    
    // Check and add pre_registration_id column
    const [preRegIdCols] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'vms_db' 
      AND TABLE_NAME = 'visits' 
      AND COLUMN_NAME = 'pre_registration_id'
    `);
    
    if (preRegIdCols.length === 0) {
      console.log('Adding pre_registration_id column to visits...');
      await connection.execute(`
        ALTER TABLE visits 
        ADD COLUMN pre_registration_id INT NULL
      `);
      console.log('✅ pre_registration_id column added');
    } else {
      console.log('✅ pre_registration_id column already exists');
    }
    
    // Check and add status column to visits
    const [statusCols] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'vms_db' 
      AND TABLE_NAME = 'visits' 
      AND COLUMN_NAME = 'status'
    `);
    
    if (statusCols.length === 0) {
      console.log('Adding status column to visits...');
      await connection.execute(`
        ALTER TABLE visits 
        ADD COLUMN status VARCHAR(50) DEFAULT 'checked_in'
      `);
      console.log('✅ status column added');
      
      // Update existing records
      const [updateResult] = await connection.execute(`
        UPDATE visits 
        SET status = 'checked_in' 
        WHERE status IS NULL OR status = ''
      `);
      console.log(`✅ Updated ${updateResult.affectedRows} existing visit records`);
    } else {
      console.log('✅ status column already exists in visits');
    }
    
    // ========== SHOW FINAL STRUCTURES ==========
    console.log('\n📋 Final table structures:');
    
    const [preRegColumns] = await connection.execute('DESCRIBE pre_registrations');
    console.log('\n📝 pre_registrations table:');
    preRegColumns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Default ? 'DEFAULT ' + col.Default : ''}`);
    });
    
    const [visitsColumns] = await connection.execute('DESCRIBE visits');
    console.log('\n📝 visits table:');
    visitsColumns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Default ? 'DEFAULT ' + col.Default : ''}`);
    });
    
    console.log('\n🎉 All tables fixed successfully!');
    
  } catch (error) {
    console.error('❌ Database error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixAllTables();

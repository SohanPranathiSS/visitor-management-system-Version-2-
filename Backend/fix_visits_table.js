const mysql = require('mysql2/promise');

async function updateVisitsTable() {
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
    
    // Check if pre_registration_id column exists in visits table
    const [preRegIdColumns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'vms_db' 
      AND TABLE_NAME = 'visits' 
      AND COLUMN_NAME = 'pre_registration_id'
    `);
    
    if (preRegIdColumns.length === 0) {
      console.log('pre_registration_id column does not exist in visits table. Adding it...');
      
      // Add pre_registration_id column to visits table
      await connection.execute(`
        ALTER TABLE visits 
        ADD COLUMN pre_registration_id INT NULL
      `);
      
      console.log('pre_registration_id column added to visits table successfully!');
      
    } else {
      console.log('pre_registration_id column already exists in visits table');
    }
    
    // Check if status column exists in visits table
    const [statusColumns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'vms_db' 
      AND TABLE_NAME = 'visits' 
      AND COLUMN_NAME = 'status'
    `);
    
    if (statusColumns.length === 0) {
      console.log('status column does not exist in visits table. Adding it...');
      
      // Add status column to visits table
      await connection.execute(`
        ALTER TABLE visits 
        ADD COLUMN status VARCHAR(50) DEFAULT 'checked_in'
      `);
      
      console.log('status column added to visits table successfully!');
      
      // Update existing records to have checked_in status
      const [updateResult] = await connection.execute(`
        UPDATE visits 
        SET status = 'checked_in' 
        WHERE status IS NULL OR status = ''
      `);
      
      console.log(`Updated ${updateResult.affectedRows} existing visit records with status 'checked_in'`);
      
    } else {
      console.log('status column already exists in visits table');
    }
    
    // Show final visits table structure
    const [finalColumns] = await connection.execute('DESCRIBE visits');
    console.log('\nFinal visits table structure:');
    finalColumns.forEach(col => {
      console.log(`- ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Default ? 'DEFAULT ' + col.Default : ''}`);
    });
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

updateVisitsTable();

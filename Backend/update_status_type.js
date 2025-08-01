const mysql = require('mysql2/promise');

async function updateStatusColumn() {
  let connection;
  try {
    // Create a direct connection using the same config as your working server
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'sohan123', // Update this with your actual MySQL password
      database: 'vms_db'
    });
    
    console.log('Connected to database successfully');
    
    // First, check current column type
    const [currentStructure] = await connection.execute(`
      SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'vms_db' 
      AND TABLE_NAME = 'pre_registrations' 
      AND COLUMN_NAME = 'status'
    `);
    
    if (currentStructure.length > 0) {
      console.log('Current status column:', currentStructure[0]);
    }
    
    // Update the column type from ENUM to VARCHAR
    console.log('Updating status column to VARCHAR(50)...');
    await connection.execute(`
      ALTER TABLE pre_registrations 
      MODIFY COLUMN status VARCHAR(50) DEFAULT 'pending'
    `);
    
    console.log('Status column updated successfully!');
    
    // Verify the change
    const [newStructure] = await connection.execute(`
      SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'vms_db' 
      AND TABLE_NAME = 'pre_registrations' 
      AND COLUMN_NAME = 'status'
    `);
    
    console.log('New status column structure:', newStructure[0]);
    
    // Update any NULL status values to 'pending'
    const [updateResult] = await connection.execute(`
      UPDATE pre_registrations 
      SET status = 'pending' 
      WHERE status IS NULL OR status = ''
    `);
    
    console.log(`Updated ${updateResult.affectedRows} records with NULL/empty status to 'pending'`);
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

updateStatusColumn();

const mysql = require('mysql2/promise');
const dbConfig = require('./config/database');

async function checkSchema() {
  try {
    const connection = await mysql.createConnection(dbConfig);
    console.log('Connected to database');
    
    // Check current table structure for pre_registrations
    const [preRegColumns] = await connection.execute('DESCRIBE pre_registrations');
    console.log('Current pre_registrations table structure:');
    preRegColumns.forEach(col => {
      console.log(`- ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Default ? 'DEFAULT ' + col.Default : ''}`);
    });
    
    console.log('\n' + '='.repeat(50));
    
    // Check current table structure for visits
    const [visitsColumns] = await connection.execute('DESCRIBE visits');
    console.log('Current visits table structure:');
    visitsColumns.forEach(col => {
      console.log(`- ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Default ? 'DEFAULT ' + col.Default : ''}`);
    });
    
    await connection.end();
  } catch (error) {
    console.error('Database error:', error.message);
  }
}

checkSchema();

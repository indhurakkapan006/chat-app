const mysql = require('mysql2/promise');
require('dotenv').config();

// Create a connection pool using the single Aiven URI
const pool = mysql.createPool({
    uri: process.env.DATABASE_URL, // This handles Host, User, Pass, Port, and DB Name automatically
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test the database connection
pool.getConnection()
    .then(connection => {
        console.log('✅ Successfully connected to the MySQL database.');
        connection.release();
    })
    .catch(err => {
        console.error('❌ Error connecting to the database:', err.message);
    });

module.exports = pool;
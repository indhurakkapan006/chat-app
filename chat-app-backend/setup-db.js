const mysql = require('mysql2/promise');

async function setupDatabase() {
    try {
        console.log("⏳ Connecting to Aiven to build tables...");
        // Change this line to use the environment variable
const connection = await mysql.createConnection(process.env.DATABASE_URL);

        console.log("✅ Connected! Creating missing tables...");

        // 1. Ensure users table is fully structured
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                is_online BOOLEAN DEFAULT FALSE
            )
        `);

        // 2. Create the rooms table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS rooms (
                room_id BIGINT PRIMARY KEY,
                room_name VARCHAR(255) NOT NULL
            )
        `);

        // 3. Create the room participants linking table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS room_participants (
                room_id BIGINT,
                user_id INT,
                PRIMARY KEY (room_id, user_id)
            )
        `);

        // 4. Create the messages table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                room_id BIGINT NOT NULL,
                sender_id INT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log("✅ SUCCESS! All tables are built and ready for chat.");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error setting up database:", error.message);
        process.exit(1);
    }
}

setupDatabase();
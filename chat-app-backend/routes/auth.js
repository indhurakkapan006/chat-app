const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db'); // Imports the database connection
require('dotenv').config();

// --- SIGNUP API ---
router.post('/signup', async (req, res) => {
    const { username, email, password } = req.body;

    try {
        // 1. Check if the email already exists in the database
        const [existingUsers] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        
        if (existingUsers.length > 0) {
            // Return a 400 Bad Request error to the frontend if it exists
            return res.status(400).json({ error: 'An account with this email already exists.' });
        }
        
        // 2. Hash the password for security
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 3. Save the new user to MySQL
        const [result] = await db.query(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [username, email, hashedPassword]
        );

        res.status(201).json({ message: 'User created successfully!' });

    } catch (error) {
        console.error('Signup Error:', error);
        res.status(500).json({ error: 'Server error during signup.' });
    }
});

// --- LOGIN API ---
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // 1. Find the user in the database
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        
        if (users.length === 0) {
            return res.status(400).json({ error: 'Invalid email or password.' });
        }

        const user = users[0];

        // 2. Compare the typed password with the hashed password in DB
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid email or password.' });
        }

        // 3. Generate a JWT Token to keep the user logged in
        const token = jwt.sign(
            { id: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' } // Token lasts for 7 days
        );

        res.status(200).json({
            message: 'Logged in successfully!',
            token,
            user: { id: user.id, username: user.username, email: user.email }
        });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

module.exports = router;
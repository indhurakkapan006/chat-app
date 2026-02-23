const express = require('express');
const router = express.Router();
const db = require('../db');

// --- 1. GET ALL ROOMS ---
// Used to populate your sidebar and power the room search bar
router.get('/rooms', async (req, res) => {
    try {
        const [rooms] = await db.query('SELECT * FROM rooms ORDER BY created_at DESC');
        res.status(200).json(rooms);
    } catch (error) {
        console.error('Error fetching rooms:', error);
        res.status(500).json({ error: 'Server error fetching rooms.' });
    }
});

// --- 2. GET ALL USERS ---
// Used for the 1-on-1 direct messages list and showing the green online indicator
router.get('/users', async (req, res) => {
    try {
        // We purposefully exclude the password column here for security!
        const [users] = await db.query('SELECT id, username, email, is_online FROM users');
        res.status(200).json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Server error fetching users.' });
    }
});

// --- 3. GET MESSAGE HISTORY ---
// Loads the past messages when a user clicks into a room
router.get('/messages/:roomId', async (req, res) => {
    const { roomId } = req.params;
    
    try {
        // We join the users table so we can send the sender's username along with the message text
        const [messages] = await db.query(
            `SELECT m.id, m.content, m.created_at, m.sender_id, u.username 
             FROM messages m 
             JOIN users u ON m.sender_id = u.id 
             WHERE m.room_id = ? 
             ORDER BY m.created_at ASC`,
            [roomId]
        );
        res.status(200).json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Server error fetching messages.' });
    }
});

module.exports = router;
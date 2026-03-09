const express = require('express');
const router = express.Router();
const db = require('../db');

// --- 1. GET ALL ROOMS ---
// Used to populate your sidebar and power the room search bar
// Now filters rooms by userId - only returns rooms where the user is a participant
router.get('/rooms', async (req, res) => {
    const { userId } = req.query;
    
    try {
        if (!userId) {
            return res.status(400).json({ error: 'userId query parameter is required.' });
        }

        const [rooms] = await db.query(
            `SELECT r.room_id, r.room_name 
             FROM rooms r 
             JOIN room_participants rp ON r.room_id = rp.room_id 
             WHERE rp.user_id = ? 
             ORDER BY r.room_id DESC`,
            [userId]
        );
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
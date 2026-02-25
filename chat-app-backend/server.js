const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const db = require('./db'); 
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat'); 

const app = express();
const server = http.createServer(app);

// --- UPDATED ROBUST CORS MIDDLEWARE ---
app.use(cors({
    origin: ["https://chat-app-one-sage-64.vercel.app", "http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
}));

// Explicitly handle pre-flight OPTIONS requests before other routes
app.options('*', cors()); 
// --------------------------------------

app.use(express.json()); 

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

// --- UPDATE USER PROFILE ROUTE ---
app.put('/api/users/update', async (req, res) => {
    const { userId, newUsername } = req.body;

    try {
        await db.query('UPDATE users SET username = ? WHERE id = ?', [newUsername, userId]);
        res.json({ success: true, newUsername });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Initialize Socket.io with trusted origin
const io = new Server(server, {
    cors: {
        origin: ["https://chat-app-one-sage-64.vercel.app", "http://localhost:5173"],
        methods: ["GET", "POST"],
        credentials: true
    }
});

// 

// Listen for real-time socket connections
io.on('connection', (socket) => {
    console.log(`🔌 User Connected: ${socket.id}`);

    socket.on('user_connected', async (userId) => {
        socket.data.userId = userId;
        await db.query('UPDATE users SET is_online = TRUE WHERE id = ?', [userId]);
        io.emit('update_users_status'); 
    });

    socket.on('join_room', async ({ roomId, roomName, userId }) => {
        const parsedRoomId = parseInt(roomId);
        const upperRoomName = roomName.toUpperCase();

        try {
            await db.query(
                'INSERT IGNORE INTO rooms (room_id, room_name) VALUES (?, ?)',
                [parsedRoomId, upperRoomName]
            );
            await db.query(
                'INSERT IGNORE INTO room_participants (room_id, user_id) VALUES (?, ?)',
                [parsedRoomId, userId]
            );
            socket.join(parsedRoomId);
            console.log(`User ${userId} joined room ${upperRoomName} (${parsedRoomId})`);
        } catch (error) {
            console.error('Error joining room:', error);
        }
    });

    socket.on('send_message', async (data) => {
        const { roomId, senderId, content } = data;
        try {
            await db.query(
                'INSERT INTO messages (room_id, sender_id, content) VALUES (?, ?, ?)',
                [roomId, senderId, content]
            );
            io.to(roomId).emit('receive_message', data);
        } catch (error) {
            console.error('Error saving message:', error);
        }
    });

    socket.on('typing', ({ roomId, username }) => {
        socket.to(roomId).emit('user_typing', { username });
    });

    socket.on('stop_typing', ({ roomId }) => {
        socket.to(roomId).emit('user_stopped_typing');
    });

    socket.on('profile_updated', () => {
        io.emit('update_users_status');
    });

    socket.on('disconnect', async () => {
        console.log(`🔌 User Disconnected: ${socket.id}`);
        if (socket.data.userId) {
            await db.query('UPDATE users SET is_online = FALSE WHERE id = ?', [socket.data.userId]);
            io.emit('update_users_status');
        }
    });
});

app.get('/', (req, res) => {
    res.send('Chat App Backend is running securely!');
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
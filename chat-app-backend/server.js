const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const db = require('./db'); // This imports and runs your database connection
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat'); 

const app = express();
const server = http.createServer(app);

// Middleware
// UPDATED: Express CORS now trusts your Vercel URL
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true
}));
app.use(express.json()); 

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

// --- UPDATE USER PROFILE ROUTE ---
app.put('/api/users/update', async (req, res) => {
    const { userId, newUsername } = req.body;

    try {
        // Update the username in the MySQL database
        await db.query('UPDATE users SET username = ? WHERE id = ?', [newUsername, userId]);
        
        // Return success response to the frontend
        res.json({ success: true, newUsername });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Database error' });
    }
});
// ---------------------------------

// Initialize Socket.io
// UPDATED: Socket.io CORS now trusts your Vercel URL
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Listen for real-time socket connections
io.on('connection', (socket) => {
    console.log(`🔌 User Connected: ${socket.id}`);

    // 1. User comes online
    socket.on('user_connected', async (userId) => {
        socket.data.userId = userId; // Store their DB ID on this socket session
        
        // Update MySQL to show them as online
        await db.query('UPDATE users SET is_online = TRUE WHERE id = ?', [userId]);
        
        // Broadcast an event so the frontend updates the green online indicators
        io.emit('update_users_status'); 
    });

    // 2. Joining or Creating a Room
    socket.on('join_room', async ({ roomId, roomName, userId }) => {
        // Enforce your specific validation rules on the backend too
        const parsedRoomId = parseInt(roomId); // Ensures it's a number
        const upperRoomName = roomName.toUpperCase(); // Ensures it's uppercase

        try {
            // Insert room into DB (Uses IGNORE so it doesn't crash if the room already exists)
            await db.query(
                'INSERT IGNORE INTO rooms (room_id, room_name) VALUES (?, ?)',
                [parsedRoomId, upperRoomName]
            );

            // Link the user to this room in the database
            await db.query(
                'INSERT IGNORE INTO room_participants (room_id, user_id) VALUES (?, ?)',
                [parsedRoomId, userId]
            );

            // Connect the socket to the specific room channel
            socket.join(parsedRoomId);
            console.log(`User ${userId} joined room ${upperRoomName} (${parsedRoomId})`);
            
        } catch (error) {
            console.error('Error joining room:', error);
        }
    });

    // 3. Handling Messages
    socket.on('send_message', async (data) => {
        const { roomId, senderId, content } = data;
        
        try {
            // Save the chat history to MySQL
            await db.query(
                'INSERT INTO messages (room_id, sender_id, content) VALUES (?, ?, ?)',
                [roomId, senderId, content]
            );

            // Emit the message ONLY to users inside this specific room
            io.to(roomId).emit('receive_message', data);
        } catch (error) {
            console.error('Error saving message:', error);
        }
    });

    // 4. Typing Indicators
    socket.on('typing', ({ roomId, username }) => {
        // .to() sends it to everyone in the room EXCEPT the person typing
        socket.to(roomId).emit('user_typing', { username });
    });

    socket.on('stop_typing', ({ roomId }) => {
        socket.to(roomId).emit('user_stopped_typing');
    });

    // 5. User updates their profile
    socket.on('profile_updated', () => {
        // Broadcast to EVERYONE to re-fetch the users list from the database
        io.emit('update_users_status');
    });

    // 6. User goes offline (Disconnects)
    socket.on('disconnect', async () => {
        console.log(`🔌 User Disconnected: ${socket.id}`);
        
        // If we know who they were, set them offline in MySQL
        if (socket.data.userId) {
            await db.query('UPDATE users SET is_online = FALSE WHERE id = ?', [socket.data.userId]);
            io.emit('update_users_status');
        }
    });
});

// Basic route to test if the server is running
app.get('/', (req, res) => {
    res.send('Chat App Backend is running!');
});

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
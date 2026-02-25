import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { MessageSquare, MessageCircle, Users, LogOut, Plus, Search, Hash, X, Send, UserCircle, ArrowLeft } from 'lucide-react';

export default function ChatRoom() {
  // UI Tabs: 'CHATS' (Public), 'DMS' (Private), 'USERS', or 'PROFILE'
  const [activeTab, setActiveTab] = useState('CHATS'); 
  const [rooms, setRooms] = useState([]);
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [socket, setSocket] = useState(null);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [toast, setToast] = useState(null); // NEW: Custom popup state

  // States for Messages & Notifications
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [typingUser, setTypingUser] = useState('');
  const [unreadCounts, setUnreadCounts] = useState({});
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // States for the Create Room Modal
  const [showModal, setShowModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomId, setNewRoomId] = useState('');

  const userId = localStorage.getItem('userId');
  const username = localStorage.getItem('username');
  const [profileName, setProfileName] = useState(username || '');

  // --- HELPER: Custom Popup Trigger ---
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000); // Disappears after 3 seconds
  };

  // --- 1. INITIAL SETUP ---
  useEffect(() => {
    // UPDATED: Socket connection
    const newSocket = io(import.meta.env.VITE_BACKEND_URL);
    setSocket(newSocket);
    newSocket.emit('user_connected', userId);

    const fetchRooms = async () => {
      try {
        // UPDATED: Fetch rooms
        const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/chat/rooms`);
        setRooms(response.data);
        response.data.forEach(room => {
          newSocket.emit('join_room', { roomId: room.room_id, roomName: room.room_name, userId });
        });
      } catch (error) {
        console.error('Error fetching rooms:', error);
      }
    };

    const fetchUsers = async () => {
      try {
        // UPDATED: Fetch users
        const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/chat/users`);
        setUsers(response.data);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    fetchRooms();
    fetchUsers();
    newSocket.on('update_users_status', fetchUsers);

    return () => newSocket.disconnect();
  }, [userId]);

  // --- 2. LOAD MESSAGES ---
  useEffect(() => {
    if (!currentRoom || !socket) return;
    socket.emit('join_room', { roomId: currentRoom.id, roomName: currentRoom.name, userId });

    const fetchMessages = async () => {
      try {
        // UPDATED: Fetch messages
        const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/chat/messages/${currentRoom.id}`);
        setMessages(response.data);
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };
    fetchMessages();

    socket.on('user_typing', (data) => setTypingUser(data.username));
    socket.on('user_stopped_typing', () => setTypingUser(''));

    return () => {
      socket.off('user_typing');
      socket.off('user_stopped_typing');
    };
  }, [currentRoom, socket, userId]);

  // --- 3. GLOBAL LISTENERS ---
  useEffect(() => {
    if (!socket) return;
    const handleNewMessage = (data) => {
      if (currentRoom && currentRoom.id === data.roomId) {
        setMessages((prev) => [...prev, data]);
      } else {
        setUnreadCounts((prev) => ({ ...prev, [data.roomId]: (prev[data.roomId] || 0) + 1 }));
      }
    };
    socket.on('receive_message', handleNewMessage);
    return () => socket.off('receive_message', handleNewMessage);
  }, [socket, currentRoom]);

  // --- 4. AUTO-SCROLL ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUser]);

  // --- 5. SEND & TYPE ---
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentRoom || !socket) return;

    const messageData = { roomId: currentRoom.id, senderId: parseInt(userId), username, content: newMessage };
    socket.emit('send_message', messageData);
    socket.emit('stop_typing', { roomId: currentRoom.id });
    setNewMessage('');
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (!socket || !currentRoom) return;
    socket.emit('typing', { roomId: currentRoom.id, username });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => socket.emit('stop_typing', { roomId: currentRoom.id }), 2000);
  };

  // --- 6. UI ACTIONS ---
  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!profileName.trim()) return;

    try {
      // UPDATED: Update profile
      await axios.put(`${import.meta.env.VITE_BACKEND_URL}/api/users/update`, { userId, newUsername: profileName });
      localStorage.setItem('username', profileName);
      
      // NEW: Tell the socket server to notify all other online users!
      socket.emit('profile_updated');
      
      showToast('Profile updated successfully!', 'success');
      setTimeout(() => window.location.reload(), 1500); 
    } catch (error) {
      console.error(error);
      showToast('Failed to update profile.', 'error');
    }
  };
  
  const createRoom = (e) => {
    e.preventDefault();
    if (!newRoomName || !newRoomId || !socket) return;

    socket.emit('join_room', { roomId: newRoomId, roomName: newRoomName, userId });
    setRooms([{ room_id: newRoomId, room_name: newRoomName }, ...rooms]);
    setCurrentRoom({ id: newRoomId, name: newRoomName });
    setShowModal(false);
    setNewRoomName('');
    setNewRoomId('');
    showToast(`Room #${newRoomName} created!`);
  };

  const startDirectMessage = (targetUser) => {
    if (targetUser.id === parseInt(userId)) return;

    const u1 = Math.min(parseInt(userId), targetUser.id);
    const u2 = Math.max(parseInt(userId), targetUser.id);
    const dmRoomId = parseInt(`${u1}9999${u2}`);
    const dmRoomName = `DM: ${targetUser.username}`.toUpperCase();

    socket.emit('join_room', { roomId: dmRoomId, roomName: dmRoomName, userId });
    setCurrentRoom({ id: dmRoomId, name: dmRoomName });
    setUnreadCounts(prev => ({ ...prev, [dmRoomId]: 0 }));
    
    if (!rooms.some(r => r.room_id === dmRoomId)) {
      setRooms([{ room_id: dmRoomId, room_name: dmRoomName }, ...rooms]);
    }
    setActiveTab('DMS'); // Switch directly to the DMS tab
  };

  // --- SEPARATE CHATS AND DMS ---
  const publicRooms = rooms.filter(room => !room.room_name.startsWith('DM: '));
  const dmRooms = rooms.filter(room => room.room_name.startsWith('DM: '));

  return (
    <div className={`chat-container ${currentRoom ? 'in-room' : ''}`}>
      {/* RENDER THE TOAST NOTIFICATION IF IT EXISTS */}
      {toast && (
        <div className={`toast-popup ${toast.type}`}>
          {toast.message}
        </div>
      )}

      {/* LEFT NAV */}
      <div className="left-nav">
        <div className={`nav-item ${activeTab === 'CHATS' ? 'active' : ''}`} onClick={() => setActiveTab('CHATS')} title="Public Rooms">
          <MessageSquare size={24} />
        </div>
        {/* NEW: 1-on-1 Messages Tab */}
        <div className={`nav-item ${activeTab === 'DMS' ? 'active' : ''}`} onClick={() => setActiveTab('DMS')} title="Direct Messages">
          <MessageCircle size={24} />
        </div>
        <div className={`nav-item ${activeTab === 'USERS' ? 'active' : ''}`} onClick={() => setActiveTab('USERS')} title="Users">
          <Users size={24} />
        </div>
        <div className={`nav-item ${activeTab === 'PROFILE' ? 'active' : ''}`} onClick={() => setActiveTab('PROFILE')} title="Profile">
          <UserCircle size={24} />
        </div>
        <div className="nav-item nav-bottom" onClick={handleLogout} title="Logout">
          <LogOut size={24} />
        </div>
      </div>

      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-title">{activeTab === 'DMS' ? 'DIRECT MESSAGES' : activeTab}</span>
          {activeTab === 'CHATS' && (
            <Plus size={20} color="#2dd4bf" style={{ cursor: 'pointer' }} onClick={() => setShowModal(true)} />
          )}
        </div>
        
        {activeTab !== 'PROFILE' && (
          <div className="search-container">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              className="search-input" 
              placeholder={`Search...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}

        <div className="list-container">
          
          {/* PUBLIC CHATS LIST */}
          {activeTab === 'CHATS' && publicRooms
            .filter(room => room.room_name.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((room) => (
            <div 
              key={room.room_id} 
              className={`list-item ${currentRoom?.id === room.room_id ? 'active' : ''}`}
              onClick={() => {
                setCurrentRoom({ id: room.room_id, name: room.room_name });
                setUnreadCounts(prev => ({ ...prev, [room.room_id]: 0 })); 
              }}
            >
              <div className="room-hash"><Hash size={16} /></div>
              <div style={{ display: 'flex', flex: 1, alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{room.room_name}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>ID: {room.room_id}</div>
                </div>
                {unreadCounts[room.room_id] > 0 && <div className="unread-badge">{unreadCounts[room.room_id]}</div>}
              </div>
            </div>
          ))}

          {/* DIRECT MESSAGES LIST */}
          {activeTab === 'DMS' && dmRooms
            .filter(room => room.room_name.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((room) => (
            <div 
              key={room.room_id} 
              className={`list-item ${currentRoom?.id === room.room_id ? 'active' : ''}`}
              onClick={() => {
                setCurrentRoom({ id: room.room_id, name: room.room_name });
                setUnreadCounts(prev => ({ ...prev, [room.room_id]: 0 })); 
              }}
            >
              <div className="room-hash" style={{ borderRadius: '50%' }}><MessageCircle size={16} /></div>
              <div style={{ display: 'flex', flex: 1, alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{room.room_name.replace('DM: ', '')}</div>
                </div>
                {unreadCounts[room.room_id] > 0 && <div className="unread-badge">{unreadCounts[room.room_id]}</div>}
              </div>
            </div>
          ))}

          {/* USERS LIST */}
          {activeTab === 'USERS' && users
            .filter(user => user.username.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((user) => {
              const u1 = Math.min(parseInt(userId), user.id);
              const u2 = Math.max(parseInt(userId), user.id);
              const dmRoomId = parseInt(`${u1}9999${u2}`);

              return (
                <div 
                  key={user.id} 
                  className="list-item" 
                  style={{ cursor: user.id === parseInt(userId) ? 'default' : 'pointer' }}
                  onClick={() => startDirectMessage(user)}
                >
                  <div className="room-hash" style={{ borderRadius: '50%' }}>
                    <Users size={16} />
                  </div>
                  <div style={{ display: 'flex', flex: 1, alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>
                        {user.username} {user.id === parseInt(userId) ? '(You)' : ''}
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                        {user.is_online ? 'Online' : 'Offline'}
                      </div>
                    </div>
                    {unreadCounts[dmRoomId] > 0 && (
                      <div className="unread-badge" style={{ marginRight: '10px' }}>{unreadCounts[dmRoomId]}</div>
                    )}
                    {user.is_online === 1 && (
                      <div style={{ width: '10px', height: '10px', backgroundColor: '#2dd4bf', borderRadius: '50%', boxShadow: '0 0 6px #2dd4bf' }}></div>
                    )}
                  </div>
                </div>
              );
          })}

          {/* PROFILE EDIT SECTION */}
          {activeTab === 'PROFILE' && (
            <div style={{ padding: '20px' }}>
              <h3 style={{ marginBottom: '20px', color: '#e2e8f0', fontSize: '14px', letterSpacing: '1px' }}>EDIT PROFILE</h3>
              <form onSubmit={handleUpdateProfile}>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: '#94a3b8' }}>USERNAME</label>
                  <input 
                    type="text" 
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    style={{ width: '100%', padding: '12px', backgroundColor: '#131920', border: '1px solid #2a3241', color: 'white', borderRadius: '8px', outline: 'none' }}
                  />
                </div>
                <button type="submit" className="submit-btn" style={{ width: '100%' }}>
                  Save Changes
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* MAIN CHAT AREA */}
      <div className="main-chat">
        {currentRoom ? (
          <>
            <div className="chat-header">
              {/* NEW: Mobile Back Button */}
              <button className="mobile-back-btn" onClick={() => setCurrentRoom(null)}>
                <ArrowLeft size={24} />
              </button>
              
              <h2>{currentRoom.name.startsWith('DM: ') ? currentRoom.name.replace('DM: ', '@') : `#${currentRoom.name}`}</h2>
            </div>
            
            <div className="messages-feed">
              {messages.map((msg, index) => {
                const isMine = parseInt(msg.senderId || msg.sender_id) === parseInt(userId);
                return (
                  <div key={index} className={`message-wrapper ${isMine ? 'sent' : 'received'}`}>
                    {!isMine && <span className="message-sender">{msg.username}</span>}
                    <div className="message-bubble">{msg.content}</div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {typingUser && <div className="typing-indicator">{typingUser} is typing...</div>}

            <div className="chat-input-container">
              <form className="chat-input-wrapper" onSubmit={handleSendMessage}>
                <input 
                  type="text" 
                  placeholder="Type a message..." 
                  value={newMessage}
                  onChange={handleTyping}
                />
                <button type="submit" className="send-btn">
                  <Send size={18} />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="empty-chat">
            <MessageSquare size={48} color="#2a3241" style={{ marginBottom: '16px' }} />
            <h2>Select a chat</h2>
            <p>Choose a room or click a user to start a direct message</p>
          </div>
        )}
      </div>

      {/* CREATE ROOM MODAL */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create a Room</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={createRoom}>
              <div className="form-group">
                <input 
                  type="text" 
                  placeholder="ROOM NAME (uppercase only)" 
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value.toUpperCase())}
                  required
                />
              </div>
              <div className="form-group">
                <input 
                  type="text" 
                  placeholder="Room ID (numbers only)" 
                  value={newRoomId}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^[0-9\b]+$/.test(val)) setNewRoomId(val);
                  }}
                  required
                />
              </div>
              <button type="submit" className="submit-btn">Create Room</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
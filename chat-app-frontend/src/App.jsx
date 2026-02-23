import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Notice the '/pages/' added to these paths!
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import ChatRoom from './pages/ChatRoom.jsx';

function App() {
  const isAuthenticated = !!localStorage.getItem('token');

  return (
    <Router>
      <div style={{ backgroundColor: '#131920', minHeight: '100vh', fontFamily: 'sans-serif' }}>
        <Routes>
          <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/chat" />} />
          <Route path="/signup" element={!isAuthenticated ? <Signup /> : <Navigate to="/chat" />} />
          <Route path="/chat" element={isAuthenticated ? <ChatRoom /> : <Navigate to="/login" />} />
          <Route path="/" element={<Navigate to={isAuthenticated ? "/chat" : "/login"} />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
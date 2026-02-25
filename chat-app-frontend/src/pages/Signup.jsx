import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import axios from 'axios';

export default function Signup() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    try {
      // 1. Send data to the backend to create the user in MySQL
      await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/auth/signup`, {
        username,
        email,
        password
      });

      // 2. Automatically log them in right after!
      const loginResponse = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/auth/login`, {
        email,
        password
      });

      // 3. Save their new tokens and info to localStorage
      localStorage.setItem('token', loginResponse.data.token);
      localStorage.setItem('username', loginResponse.data.user.username);
      localStorage.setItem('userId', loginResponse.data.user.id);

      // 4. Hard redirect directly into the chat app to refresh the state!
      window.location.href = '/chat';
      
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create account.');
    }
  };

  return (
    <div className="auth-container">
      <div className="icon-container">
        <MessageSquare size={32} color="#2dd4bf" />
      </div>
      
      <h1>Create an Account</h1>
      <p className="subtitle">Sign up to start chatting</p>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSignup} style={{ width: '100%' }}>
        <div className="form-group">
          <input 
            type="text" 
            placeholder="Username" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <input 
            type="email" 
            placeholder="Email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        
        <div className="form-group">
          <input 
            type="password" 
            placeholder="Password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength="6"
          />
        </div>

        <button type="submit" className="submit-btn">
          Sign Up
        </button>
      </form>

      <p className="toggle-text">
        Already have an account? 
        <Link to="/login" className="toggle-link">Sign in</Link>
      </p>
    </div>
  );
}
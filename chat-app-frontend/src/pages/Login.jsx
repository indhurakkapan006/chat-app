import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import axios from 'axios';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
      // Connect to your Node.js backend
      const response = await axios.post('http://localhost:5000/api/auth/login', {
        email,
        password
      });

      // Save the JWT token and user info to keep the user logged in
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('username', response.data.user.username);
      localStorage.setItem('userId', response.data.user.id);

      // Hard redirect to refresh the app's state instantly!
      window.location.href = '/chat';
      
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to login. Please try again.');
    }
  };

  return (
    <div className="auth-container">
      <div className="icon-container">
        <MessageSquare size={32} color="#2dd4bf" />
      </div>
      
      <h1>Welcome back</h1>
      <p className="subtitle">Sign in to continue chatting</p>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleLogin} style={{ width: '100%' }}>
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
          />
        </div>

        <button type="submit" className="submit-btn">
          Sign In
        </button>
      </form>

      <p className="toggle-text">
        Don't have an account? 
        <Link to="/signup" className="toggle-link">Sign up</Link>
      </p>
    </div>
  );
}
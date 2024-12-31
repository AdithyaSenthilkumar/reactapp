import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
    const { login } = useAuth();

  const handleSubmit = async (e) => {
      e.preventDefault();
      setLoading(true);
    setError(''); // Clear any previous errors

    try {
      const response = await fetch('http://localhost:5000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
          login({ username, role: data.role }, data.token, rememberMe);
          navigate('/');
      } else {
          setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Failed to connect to server.');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <div className="mb-6 text-center">
          <img
            src="/logo.png"
            alt="Company Logo"
            className="mx-auto h-16 w-auto"
          />
        </div>
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          )}
            <div className="mb-4">
                <label className="block text-gray-700 mb-2">Username</label>
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:border-blue-500"
                />
            </div>
            <div className="mb-6">
                <label className="block text-gray-700 mb-2">Password</label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:border-blue-500"
                />
            </div>
            <div className="mb-6 flex items-center">
                <input
                  id="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="mr-2 h-4 w-4 text-blue-500 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="rememberMe" className="text-gray-700 text-sm">
                Remember me
              </label>
            </div>
          <button
              type="submit"
              className={`w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={loading}
          >
              {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;

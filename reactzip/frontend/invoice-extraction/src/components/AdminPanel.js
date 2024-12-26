import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card } from './ui/card';


const AdminPanel = () => {
    const { token } = useAuth();
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState('');
    const [registrationMessage, setRegistrationMessage] = useState('');
    const [registrationError, setRegistrationError] = useState('');

    const handleRegister = async () => {
        try {
          const response = await fetch('http://localhost:5000/register', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              username: newUsername,
              password: newPassword,
              role: newRole,
            }),
          });
    
          const data = await response.json();
          if (response.ok) {
            setNewUsername('');
            setNewPassword('');
            setNewRole('');
            setRegistrationMessage(data.message);
            setRegistrationError('');
          } else {
            setRegistrationError(data.error);
            setRegistrationMessage('');
          }
        } catch (error) {
          setRegistrationError('An error occurred during registration.');
          setRegistrationMessage('');
        }
      };

  return (
      <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">User Management</h2>
          {registrationMessage && (
               <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md">
                  {registrationMessage}
               </div>
          )}
           {registrationError && (
               <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
                    {registrationError}
               </div>
           )}
          <div className="space-y-4">
             <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                      Username
                  </label>
                  <input
                      type="text"
                      id="username"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="mt-1 p-2 border rounded-md w-full"
                       />
             </div>
              <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                      Password
                   </label>
                   <input
                       type="password"
                        id="password"
                       value={newPassword}
                       onChange={(e) => setNewPassword(e.target.value)}
                       className="mt-1 p-2 border rounded-md w-full"
                        />
             </div>
              <div>
                  <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                       Role
                  </label>
                  <select
                       id="role"
                       value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      className="mt-1 p-2 border rounded-md w-full"
                      >
                       <option value="">Select Role</option>
                       <option value="gate">Gate User</option>
                       <option value="store">Store User</option>
                 </select>
              </div>
               <button
                  onClick={handleRegister}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                  disabled={!newUsername || !newPassword || !newRole}
                  >
                 Register
               </button>
           </div>
     </Card>
  );
};


export default AdminPanel;
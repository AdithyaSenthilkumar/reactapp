// src/components/Layout.js
import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    FileText,
    Upload,
    CheckCircle,
    LogOut,
    Users,
    Home,
    List,
    Download
} from 'lucide-react'

const Layout = ({ children }) => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

    const isDashboardActive = location.pathname === '/';

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 text-white flex flex-col">
          <div className="p-6">
              <img
                src="/logo.png"
                alt="Company Logo"
                className="mx-auto h-16 w-auto"
              />
          </div>
        <nav className="flex-1 p-4 space-y-2">
            {/* Always show the Dashboard link for all roles */}
            <Link
                to="/"
                className={`flex items-center space-x-2 p-2 rounded-md hover:bg-gray-700 ${
                    isDashboardActive ? 'bg-gray-700' : ''
                }`}
            >
                <Home className="h-4 w-4" />
                <span>Dashboard</span>
            </Link>


             {/* Conditionally render other links based on user role */}
            {user && user.role === 'admin' && (
             <>
                <Link to="/upload" className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-700">
                    <Upload className="h-4 w-4" />
                    <span>Upload Invoice</span>
                 </Link>
                  <Link to="/approval" className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-700">
                      <CheckCircle className="h-4 w-4" />
                      <span>Approval Queue</span>
                 </Link>
                 <Link to="/invoices" className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-700">
                   <List className="h-4 w-4" />
                   <span>View Invoices</span>
                 </Link>
                  <Link to="/admin" className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-700">
                      <Users className="h-4 w-4" />
                      <span>User Management</span>
                 </Link>
                 
             </>
            )}
            {user && user.role === 'gate' && (
                <Link to="/upload" className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-700">
                  <Upload className="h-4 w-4" />
                  <span>Upload Invoice</span>
                </Link>
            )}
            {user && user.role === 'store' && (
             <>
             <Link to="/invoices" className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-700">
                   <List className="h-4 w-4" />
                   <span>View Invoices</span>
              </Link>
               <Link to="/approval" className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-700">
                 <CheckCircle className="h-4 w-4" />
                 <span>Approval Queue</span>
              </Link>
              
              
             </>

            )}
        </nav>
        <div className="p-4 border-t border-gray-700">
            <button
              onClick={handleLogout}
               className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-700 w-full text-left"
             >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
            </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {children}
      </div>
    </div>
  );
};

export default Layout;

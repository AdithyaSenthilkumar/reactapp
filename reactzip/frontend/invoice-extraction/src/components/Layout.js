import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Home, 
  FileUp, 
  CheckSquare, 
  LogOut, 
  Menu, 
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDivisionsOpen, setIsDivisionsOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const divisions = [
    { name: 'Engineering', path: '/division/engineering' },
    { name: 'Ultra Filtration', path: '/division/ultra-filtration' },
    { name: 'Water', path: '/division/water' }
  ];

  const isActivePath = (path) => {
    return location.pathname === path;
  };

  const isActiveDivision = () => {
    return divisions.some(div => location.pathname.includes(div.path));
  };

  const navigationItems = [
    {
      icon: <Home size={20} />,
      text: 'Dashboard',
      path: '/',
      show: true
    },
    {
      icon: <FileUp size={20} />,
      text: 'Upload Invoice',
      path: '/upload',
      show: user?.role === 'user'
    },
    {
      icon: <CheckSquare size={20} />,
      text: 'Approval Queue',
      path: '/approval',
      show: user?.role === 'admin'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar Toggle Button for Mobile */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-md shadow-md"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <div
        className={`${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed lg:relative lg:translate-x-0 z-40 w-64 min-h-screen bg-white shadow-lg transition-transform duration-300 ease-in-out`}
      >
        {/* Logo Section */}
        <div className="p-6 border-b">
          <img
            src="/logo.png"
            alt="Company Logo"
            className="h-8 w-auto mx-auto"
          />
        </div>

        {/* User Info */}
        <div className="p-4 border-b">
          <p className="text-sm font-medium text-gray-900">{user?.username}</p>
          <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
        </div>

        {/* Navigation */}
        <nav className="p-4">
          <ul className="space-y-2">
            {navigationItems.map((item, index) => (
              item.show && (
                <li key={index}>
                  <Link
                    to={item.path}
                    className={`flex items-center space-x-3 px-4 py-2 rounded-md transition-colors ${
                      isActivePath(item.path)
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {item.icon}
                    <span>{item.text}</span>
                  </Link>
                </li>
              )
            ))}

            {/* Divisions Dropdown */}
            <li>
              <button
                onClick={() => setIsDivisionsOpen(!isDivisionsOpen)}
                className={`w-full flex items-center justify-between px-4 py-2 rounded-md transition-colors ${
                  isActiveDivision()
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span>Divisions</span>
                </div>
                {isDivisionsOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
              {isDivisionsOpen && (
                <ul className="ml-6 mt-2 space-y-2">
                  {divisions.map((division, index) => (
                    <li key={index}>
                      <Link
                        to={division.path}
                        className={`flex items-center space-x-3 px-4 py-2 rounded-md transition-colors ${
                          isActivePath(division.path)
                            ? 'bg-blue-50 text-blue-600'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <span>{division.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          </ul>
        </nav>

        {/* Logout Button */}
        <div className="absolute bottom-0 w-full p-4 border-t">
          <button
            onClick={handleLogout}
            className="flex items-center space-x-3 w-full px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="bg-white shadow-sm h-16 flex items-center px-6">
          <h1 className="text-xl font-semibold text-gray-800">
            {navigationItems.find(item => isActivePath(item.path))?.text || 'Division'}
          </h1>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
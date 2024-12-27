import React from 'react';
import './styles/globals.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.js';
import Login from './components/Login.js';
import Dashboard from './components/Dashboard.js';
import Layout from './components/Layout.js';
import InvoiceUpload from './components/InvoiceUpload.js';
import InvoiceView from './components/InvoiceView.js';
import ApprovalQueue from './components/ApprovalQueue.js';
import InvoiceEdit from './components/InvoiceEdit.js'
import AdminPanel from './components/AdminPanel';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
    React.useEffect(() => {
    if (!isAuthenticated) {
      window.location.href = '/login';
    }
  }, [isAuthenticated]);

  return isAuthenticated ? children : <Navigate to="/login" />;
};


const App = () => {

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/upload"
            element={
              <PrivateRoute>
                <Layout>
                  <InvoiceUpload />
                </Layout>
              </PrivateRoute>
            }
          />
           <Route
            path="/edit/:division/:id"
            element={
              <PrivateRoute>
                <Layout>
                  <InvoiceEdit />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/view/:division/:id"
            element={
              <PrivateRoute>
                <Layout>
                  <InvoiceView />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/approval"
            element={
              <PrivateRoute>
                <Layout>
                  <ApprovalQueue />
                </Layout>
              </PrivateRoute>
            }
          />
            <Route
            path="/admin"
            element={
              <PrivateRoute>
                <Layout>
                  <AdminPanel />
                </Layout>
              </PrivateRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;

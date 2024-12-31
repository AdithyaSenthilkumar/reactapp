// src/App.js
import React from 'react';
import './styles/globals.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.js';
import Login from './components/Login.js';
import Dashboard from './components/Dashboard.js';
import Layout from './components/Layout.js';
import InvoiceUpload from './components/InvoiceUpload.js';
import InvoiceView from './components/InvoiceView.js';
import ApprovalQueue from './components/ApprovalQueue.js';
import InvoiceEdit from './components/InvoiceEdit.js';
import AdminPanel from './components/AdminPanel';
import Loading from './components/Loading';
import InvoiceList from './components/InvoiceList';


const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return children;
};

const AppRoutes = () => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return <Loading />; // Or a loading spinner
    }


  return (
    <Routes>
        <Route
            path="/login"
            element={
                isAuthenticated ? <Navigate to="/" /> : <Login />
            }
        />
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
       <Route
         path="/invoices"
         element={
           <PrivateRoute>
             <Layout>
               <InvoiceList />
             </Layout>
           </PrivateRoute>
         }
     />
    </Routes>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;

import React, { createContext, useContext, useState, useEffect } from 'react';
import Cookies from 'js-cookie';


const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true); // Add loading state

    useEffect(() => {
        const storedToken = Cookies.get('token');
        const storedUser = Cookies.get('user');

        if (storedToken && storedUser) {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
        }
      setLoading(false);
    }, []);

  const login = (userData, token, rememberMe) => {
      setUser(userData);
      setToken(token);
      const cookieOptions = rememberMe
        ? { expires: 7 } // 7 days expiration for "remember me"
        : {}; // Session-based cookie

      Cookies.set('user', JSON.stringify(userData), cookieOptions);
      Cookies.set('token', token, cookieOptions);
    };

    const logout = () => {
      setUser(null);
        setToken(null);
        Cookies.remove('user');
        Cookies.remove('token');
    };

    const contextValue = {
        user,
        token,
        login,
        logout,
        isAuthenticated: !!token,
      loading,
    };

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);

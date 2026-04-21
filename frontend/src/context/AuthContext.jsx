import React, { useState, useEffect } from 'react';
import AuthContext from './authContextInstance';
import api from '../api';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const loadCurrentUser = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUser(null);
      setAuthLoading(false);
      return;
    }

    try {
      const res = await api.get('/auth/me');
      setUser({ token, ...res.data });
    } catch (error) {
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    loadCurrentUser();
  }, []);

  const login = async (token) => {
    localStorage.setItem('token', token);
    setAuthLoading(true);
    try {
      const res = await api.get('/auth/me');
      setUser({ token, ...res.data });
    } catch (error) {
      localStorage.removeItem('token');
      setUser(null);
      throw error;
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setAuthLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, authLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

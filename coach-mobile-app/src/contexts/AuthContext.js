import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI, setUnauthorizedCallback, setTokenCache } from '../services/api';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async () => {
    try {
      const token = await authAPI.getToken();
      if (token) {
        setTokenCache(token); // Peupler le cache mémoire dès l'init
        // Vérifier que le token est encore valide côté serveur
        try {
          const response = await authAPI.getMe();
          if (response.data.success) {
            const freshUser = response.data.data;
            await authAPI.saveUser(freshUser);
            setUser(freshUser);
          }
        } catch {
          // Token expiré ou invalide → on nettoie
          setTokenCache(null);
          await authAPI.logout();
          setUser(null);
        }
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Déconnecter l'utilisateur dans le state React si le token expire (401).
    // Le cache mémoire est prioritaire sur le stockage : sans ce reset, les requêtes
    // suivantes continueraient d'envoyer le token périmé.
    setUnauthorizedCallback(() => {
      setTokenCache(null);
      setUser(null);
    });
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const register = async (data) => {
    try {
      const response = await authAPI.register(data);
      const { token, user: userData } = response.data.data;

      await authAPI.saveToken(token);
      await authAPI.saveUser(userData);
      setTokenCache(token);
      setUser(userData);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Erreur lors de la création du compte'
      };
    }
  };

  const login = async (email, password) => {
    try {
      const response = await authAPI.login(email, password);

      const { token, user: userData } = response.data.data;

      await authAPI.saveToken(token);
      await authAPI.saveUser(userData);
      setTokenCache(token);
      setUser(userData);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Erreur de connexion'
      };
    }
  };

  const logout = async () => {
    try {
      setTokenCache(null);
      await authAPI.logout();
      setUser(null);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const updateUser = async (updatedUser) => {
    try {
      await authAPI.saveUser(updatedUser);
      setUser(updatedUser);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

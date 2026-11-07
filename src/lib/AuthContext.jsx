// @ts-nocheck -- Auth context supports local and hosted adapter response shapes.
const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';

import { appParams } from '@/lib/app-params';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }
  const [roles, setRoles] = useState([]);

  // Role adalah data lokal. Sediakan satu refresh resmi agar halaman
  // manajemen role dan seluruh guard/navigation memakai snapshot yang sama.
  const refreshRoles = useCallback(async () => {
    try {
      const roleEntities = await db.entities.Role.list();
      const nextRoles = roleEntities || [];
      setRoles(nextRoles);
      return nextRoles;
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);

      // Local demo sessions are scoped to sessionStorage per browser tab so
      // different roles can be tested in parallel without replacing each
      // other's active identity.
      const localUser = await db.auth.me();
      if (localUser) {
        setAppPublicSettings({ id: 'demo', public_settings: {} });
        setIsLoadingPublicSettings(false);
        await checkUserAuth();
        return;
      }

      try {
        const publicSettings = await db.app.getPublicSettings();
        setAppPublicSettings(publicSettings);
        
        // If we got the app public settings successfully, check if user is authenticated
        if (appParams.token) {
          await checkUserAuth();
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
          setAuthChecked(true);
        }
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('App state check failed:', appError);
        
        // Handle app-level errors
        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          if (reason === 'auth_required') {
            setAuthError({
              type: 'auth_required',
              message: 'Authentication required'
            });
          } else if (reason === 'user_not_registered') {
            setAuthError({
              type: 'user_not_registered',
              message: 'User not registered for this app'
            });
          } else {
            setAuthError({
              type: reason,
              message: appError.message
            });
          }
        } else {
          setAuthError({
            type: 'unknown',
            message: appError.message || 'Failed to load app'
          });
        }
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await db.auth.me();
      if (!currentUser) throw Object.assign(new Error('Authentication required'), { status: 401 });
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthChecked(true);
      // Load roles for dynamic RBAC
      await refreshRoles();
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);
      
      // If user auth fails, it might be an expired token
      if (error.status === 401 || error.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
      }
    }
  };

  // Sinkronkan perubahan role di tab yang sama maupun tab lain. localDb
  // memancarkan event entity setelah localStorage berhasil disimpan.
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const unsubscribe = db.entities.Role.subscribe?.(() => { refreshRoles(); });
    const syncCurrentSession = () => {
      db.auth.me().then((nextUser) => {
        if (nextUser) setUser(nextUser);
        refreshRoles();
      }).catch(() => {
        // Sesi yang rusak akan ditangani oleh pemeriksaan auth berikutnya.
      });
    };
    const handleStorage = (event) => {
      if (event.key === 'klinikfarmasios.local-db') syncCurrentSession();
    };
    globalThis.addEventListener?.('storage', handleStorage);
    globalThis.addEventListener?.('local-user-role-changed', syncCurrentSession);
    return () => {
      unsubscribe?.();
      globalThis.removeEventListener?.('storage', handleStorage);
      globalThis.removeEventListener?.('local-user-role-changed', syncCurrentSession);
    };
  }, [isAuthenticated, refreshRoles]);

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    
    if (shouldRedirect) {
      // Use the SDK's logout method which handles token cleanup and redirect
      db.auth.logout(window.location.href);
    } else {
      // Just remove the token without redirect
      db.auth.logout();
    }
  };

  const navigateToLogin = () => {
    // Use the SDK's redirectToLogin method
    db.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      roles,
      refreshRoles,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

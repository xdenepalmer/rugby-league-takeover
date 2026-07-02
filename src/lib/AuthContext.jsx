import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { appParams } from '@/lib/app-params';
import { hasAdminRole, hasModeratorRole } from '@/lib/auth-roles';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  // Kept for API compatibility with previous Base44 host checks — Supabase
  // needs no app-level public-settings round trip.
  const [appPublicSettings] = useState({ public_settings: {} });

  const normalizeUser = (currentUser) => ({
    ...currentUser,
    ...(currentUser?.data || {}),
  });

  const checkUserAuth = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();
      setUser(normalizeUser(currentUser));
      setIsAuthenticated(true);
      setAuthError(null);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      console.error('User auth check failed:', error);
      setUser(null);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);
      if (error.status === 401 || error.status === 403) {
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      }
    }
  }, []);

  const checkAppState = useCallback(async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);

      if (!appParams.hasBase44Config) {
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
        setIsAuthenticated(false);
        setAuthChecked(true);
        return;
      }

      const authenticated = await base44.auth.isAuthenticated();
      if (authenticated) {
        await checkUserAuth();
      } else {
        setUser(null);
        setAuthError(null);
        setIsLoadingAuth(false);
        setIsAuthenticated(false);
        setAuthChecked(true);
      }
      setIsLoadingPublicSettings(false);
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred',
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  }, [checkUserAuth]);

  useEffect(() => {
    checkAppState();

    // Keep local state in sync with Supabase session changes (OAuth redirects,
    // token refresh failures, sign-out in another tab).
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        checkUserAuth();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsAuthenticated(false);
      }
    });
    return () => subscription?.subscription?.unsubscribe?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = useCallback((shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);

    if (shouldRedirect) {
      base44.auth.logout('/');
    } else {
      base44.auth.logout();
    }
  }, []);

  const navigateToLogin = useCallback(() => {
    base44.auth.redirectToLogin(window.location.href);
  }, []);

  // Re-fetch the current user (e.g. after a profile or password change).
  const refreshUser = useCallback(async () => {
    const currentUser = normalizeUser(await base44.auth.me());
    setUser(currentUser);
    setIsAuthenticated(true);
    return currentUser;
  }, []);

  // Persist profile / custom user fields, then refresh local state.
  const updateProfile = useCallback(async (data) => {
    await base44.auth.updateMe(data);
    return refreshUser();
  }, [refreshUser]);

  const isAdmin = useMemo(() => hasAdminRole(user), [user]);
  const isModerator = useMemo(() => hasModeratorRole(user), [user]);

  const contextValue = useMemo(() => ({
    user,
    isAuthenticated,
    isAdmin,
    isModerator,
    isLoadingAuth,
    isLoadingPublicSettings,
    authError,
    appPublicSettings,
    authChecked,
    logout,
    navigateToLogin,
    checkUserAuth,
    checkAppState,
    refreshUser,
    updateProfile
  }), [user, isAuthenticated, isAdmin, isModerator, isLoadingAuth,
       isLoadingPublicSettings, authError, appPublicSettings, authChecked,
       logout, navigateToLogin, checkUserAuth, checkAppState, refreshUser, updateProfile]);

  return (
    <AuthContext.Provider value={contextValue}>
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

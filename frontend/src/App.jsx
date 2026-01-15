import { useState, useEffect, useCallback } from 'react';
import api from './services/api';
import AuthScreen from './components/AuthScreen';
import MainApp from './MainApp';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      // Check demo mode first
      if (localStorage.getItem('smartinbox_demo') === 'true') {
        setIsDemo(true);
        setIsAuthenticated(true);
        setUser({ name: 'Demo User', email: 'demo@smartinbox.app' });
        setIsLoading(false);
        return;
      }

      try {
        const data = await api.getAuthStatus();
        if (data.authenticated) {
          setIsAuthenticated(true);
          setUser({ name: data.name, email: data.email, id: data.user_id });
        }
      } catch (err) {
        console.log('Auth check:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    // Handle OAuth callback
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      handleOAuthCallback(code);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleOAuthCallback = async (code) => {
    try {
      setIsLoading(true);
      const redirectUri = `${window.location.origin}${window.location.pathname}`;
      await api.authCallback(code, redirectUri);
      const status = await api.getAuthStatus();
      if (status.authenticated) {
        setIsAuthenticated(true);
        setUser({ name: status.name, email: status.email });
      }
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Email/Password Login
  const handleLogin = useCallback(async ({ email, password }) => {
    try {
      setIsLoading(true);
      setAuthError(null);
      const data = await api.login(email, password);
      if (data.success) {
        setIsAuthenticated(true);
        setUser(data.user);
      }
    } catch (err) {
      setAuthError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Register
  const handleRegister = useCallback(async ({ email, password, name }) => {
    try {
      setIsLoading(true);
      setAuthError(null);
      const data = await api.register(email, password, name);
      if (data.success) {
        setIsAuthenticated(true);
        setUser(data.user);
      }
    } catch (err) {
      setAuthError(err.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Google Login
  const handleGoogleLogin = useCallback(async () => {
    try {
      setIsLoading(true);
      setAuthError(null);
      const redirectUri = `${window.location.origin}${window.location.pathname}`;
      console.log('Requesting OAuth URL with redirect_uri:', redirectUri);
      const response = await api.getAuthUrl(redirectUri);
      console.log('OAuth URL received:', response);
      if (response.auth_url) {
        window.location.href = response.auth_url;
      } else {
        throw new Error('No auth_url in response');
      }
    } catch (err) {
      console.error('Google login error:', err);
      const errorMsg = err.message || 'Google login unavailable. Use email login or try Demo Mode.';
      setAuthError(errorMsg);
      setIsLoading(false);
    }
  }, []);

  // Demo Mode
  const handleDemoMode = useCallback(() => {
    localStorage.setItem('smartinbox_demo', 'true');
    setIsDemo(true);
    setIsAuthenticated(true);
    setUser({ name: 'Demo User', email: 'demo@smartinbox.app' });
  }, []);

  // Logout
  const handleLogout = useCallback(async () => {
    try {
      await api.logout();
    } catch (err) {
      console.error(err);
    }
    localStorage.removeItem('smartinbox_demo');
    setIsAuthenticated(false);
    setIsDemo(false);
    setUser(null);
  }, []);

  // Loading State
  if (isLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-center animate-fadeIn">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center text-5xl animate-glow"
               style={{ background: 'var(--accent-gradient)' }}>
            📧
          </div>
          <div className="w-10 h-10 mx-auto border-3 border-indigo-900 border-t-indigo-400 rounded-full animate-spin" />
          <p className="mt-4 text-zinc-500">Loading SmartInbox...</p>
        </div>
      </div>
    );
  }

  // Auth Screen
  if (!isAuthenticated) {
    return (
      <AuthScreen
        onLogin={handleLogin}
        onRegister={handleRegister}
        onGoogleLogin={handleGoogleLogin}
        onDemoMode={handleDemoMode}
        isLoading={isLoading}
        error={authError}
      />
    );
  }

  // Main App
  return <MainApp onLogout={handleLogout} isDemo={isDemo} user={user} />;
}

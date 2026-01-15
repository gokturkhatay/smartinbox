import { useState } from 'react';

// Premium SVG Icons
const Icons = {
  mail: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  classification: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>,
  zap: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  shield: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  chart: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  lock: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
  play: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  google: <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>,
};

const AuthScreen = ({ onLogin, onRegister, onGoogleLogin, onDemoMode, isLoading, error }) => {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (mode === 'register') {
      if (!form.name.trim()) {
        setLocalError('Name is required');
        return;
      }
      if (form.password.length < 8) {
        setLocalError('Password must be at least 8 characters');
        return;
      }
      // Password strength check: must contain both letters and numbers
      const hasLetter = /[a-zA-Z]/.test(form.password);
      const hasNumber = /[0-9]/.test(form.password);
      if (!hasLetter || !hasNumber) {
        setLocalError('Password must contain both letters and numbers');
        return;
      }
      onRegister(form);
    } else {
      onLogin(form);
    }
  };

  const displayError = error || localError;

  const features = [
    { icon: Icons.classification, title: 'AI Classification', desc: 'Intelligent categorization powered by semantic analysis' },
    { icon: Icons.zap, title: 'Lightning Fast', desc: 'Sub-100ms interactions for maximum productivity' },
    { icon: Icons.shield, title: 'Privacy First', desc: 'Your data stays secure with local processing' },
    { icon: Icons.chart, title: 'Smart Insights', desc: 'Understand your email patterns at a glance' },
  ];

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-base)' }}>
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-[55%] flex-col justify-center px-16 xl:px-24 relative">
        {/* Subtle gradient orb */}
        <div className="absolute top-1/4 right-0 w-[500px] h-[500px] rounded-full opacity-[0.07]"
             style={{ background: 'radial-gradient(circle, var(--accent-primary) 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />

        <div className="max-w-lg relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white" style={{ background: 'var(--accent-gradient)', boxShadow: 'var(--shadow-md), var(--shadow-glow)' }}>
              {Icons.mail}
            </div>
            <div>
              <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>SmartInbox</h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>AI-Powered Email</p>
            </div>
          </div>

          {/* Hero Text */}
          <h2 className="text-5xl font-semibold mb-6 leading-[1.1]" style={{ color: 'var(--text-primary)' }}>
            Your inbox,<br />
            <span style={{ color: 'var(--accent-primary)' }}>intelligently organized</span>
          </h2>

          <p className="text-lg mb-16 leading-relaxed max-w-md" style={{ color: 'var(--text-secondary)' }}>
            Experience email the way it should be. AI-powered classification, lightning-fast interface, and complete privacy.
          </p>

          {/* Features Grid */}
          <div className="grid grid-cols-2 gap-4">
            {features.map((f, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-xl transition-all hover:scale-[1.02]"
                   style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)' }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                     style={{ background: 'var(--accent-subtle)', color: 'var(--accent-primary)' }}>
                  {f.icon}
                </div>
                <div>
                  <h3 className="font-medium text-sm mb-0.5" style={{ color: 'var(--text-primary)' }}>{f.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Social proof */}
          <div className="mt-12 flex items-center gap-3" style={{ color: 'var(--text-muted)' }}>
            <div className="flex -space-x-2">
              {['A', 'B', 'C', 'D'].map((letter, i) => (
                <div key={i} className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white"
                     style={{ background: `hsl(${i * 60 + 220}, 70%, 50%)`, border: '2px solid var(--bg-base)' }}>
                  {letter}
                </div>
              ))}
            </div>
            <span className="text-sm">Trusted by professionals worldwide</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="w-full lg:w-[45%] flex items-center justify-center p-6 sm:p-8 relative" style={{ background: 'var(--bg-surface)' }}>
        <div className="w-full max-w-[400px]">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="w-14 h-14 mx-auto rounded-xl flex items-center justify-center text-white mb-4"
                 style={{ background: 'var(--accent-gradient)', boxShadow: 'var(--shadow-md)' }}>
              {Icons.mail}
            </div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>SmartInbox</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>AI-Powered Email</p>
          </div>

          {/* Auth Card */}
          <div className="rounded-2xl p-8" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-lg)' }}>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                {mode === 'login' ? 'Welcome back' : 'Create account'}
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {mode === 'login' ? 'Sign in to access your smart inbox' : 'Start organizing your inbox today'}
              </p>
            </div>

            {/* Error Alert */}
            {displayError && (
              <div className="mb-6 p-4 rounded-lg" style={{ background: 'var(--danger-muted)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <p className="text-sm" style={{ color: 'var(--danger)' }}>{displayError}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Full Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="input"
                    placeholder="John Doe"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="input"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input"
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary w-full py-3"
                style={{ marginTop: '24px' }}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    Processing...
                  </span>
                ) : mode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px" style={{ background: 'var(--border-default)' }} />
              <span className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--text-muted)' }}>or</span>
              <div className="flex-1 h-px" style={{ background: 'var(--border-default)' }} />
            </div>

            {/* Social Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={onGoogleLogin}
                disabled={isLoading}
                className="btn btn-secondary py-3"
              >
                {Icons.google}
                <span>Google</span>
              </button>

              <button
                onClick={onDemoMode}
                disabled={isLoading}
                className="btn btn-secondary py-3"
              >
                {Icons.play}
                <span>Try Demo</span>
              </button>
            </div>

            {/* Toggle Mode */}
            <p className="text-center text-sm mt-8" style={{ color: 'var(--text-muted)' }}>
              {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setLocalError(''); }}
                className="font-medium transition-colors"
                style={{ color: 'var(--accent-primary)' }}
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-xs flex items-center justify-center gap-2" style={{ color: 'var(--text-muted)' }}>
              {Icons.lock}
              <span>End-to-end encrypted</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;

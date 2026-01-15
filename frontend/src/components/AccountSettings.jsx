import { useState } from 'react';

const Icons = {
  close: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>,
  save: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" /></svg>,
  theme: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>,
  layout: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>,
  email: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  refresh: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
};

const AccountSettings = ({ user, onClose, onSave }) => {
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('smartinbox_settings');
    return saved ? JSON.parse(saved) : {
      theme: 'dark',
      emailLayout: 'split', // split, list-only, detail-only
      emailsPerPage: 200,
      showPriorityScore: true,
      showUnreadBadge: true,
      compactMode: false,
      autoMarkRead: false,
      notificationSound: false,
      defaultReplyTemplate: '',
      autoSync: true,
      autoSyncInterval: 30,
    };
  });

  const handleSave = () => {
    localStorage.setItem('smartinbox_settings', JSON.stringify(settings));
    onSave?.(settings);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--bg-overlay)] rounded-xl border border-[var(--border-default)] w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col" style={{ boxShadow: 'var(--shadow-xl)' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Settings</h2>
            <p className="text-xs text-[var(--text-muted)]">{user?.email}</p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon">{Icons.close}</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 min-h-0 space-y-6">
          {/* Theme Settings */}
          <section>
            <div className="flex items-center gap-2.5 mb-4">
              <span className="text-[var(--text-muted)]">{Icons.theme}</span>
              <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Appearance</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-2">Theme</label>
                <select
                  value={settings.theme}
                  onChange={(e) => setSettings({ ...settings, theme: e.target.value })}
                  className="input text-[13px] w-full"
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="auto">Auto (System)</option>
                </select>
              </div>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={settings.compactMode}
                  onChange={(e) => setSettings({ ...settings, compactMode: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent-primary)]"
                />
                <span className="text-[13px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">Compact Mode</span>
              </label>
            </div>
          </section>

          {/* Layout Settings */}
          <section>
            <div className="flex items-center gap-2.5 mb-4">
              <span className="text-[var(--text-muted)]">{Icons.layout}</span>
              <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Layout</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-2">Email Layout</label>
                <select
                  value={settings.emailLayout}
                  onChange={(e) => setSettings({ ...settings, emailLayout: e.target.value })}
                  className="input text-[13px] w-full"
                >
                  <option value="split">Split View</option>
                  <option value="list-only">List Only</option>
                  <option value="detail-only">Detail Only</option>
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-2">Emails Per Page</label>
                <input
                  type="number"
                  min="50"
                  max="500"
                  value={settings.emailsPerPage}
                  onChange={(e) => setSettings({ ...settings, emailsPerPage: parseInt(e.target.value) || 200 })}
                  className="input text-[13px] w-full"
                />
              </div>
            </div>
          </section>

          {/* Email Settings */}
          <section>
            <div className="flex items-center gap-2.5 mb-4">
              <span className="text-[var(--text-muted)]">{Icons.email}</span>
              <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Email Preferences</h3>
            </div>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={settings.showPriorityScore}
                  onChange={(e) => setSettings({ ...settings, showPriorityScore: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent-primary)]"
                />
                <span className="text-[13px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">Show Priority Score</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={settings.showUnreadBadge}
                  onChange={(e) => setSettings({ ...settings, showUnreadBadge: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent-primary)]"
                />
                <span className="text-[13px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">Show Unread Badge</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={settings.autoMarkRead}
                  onChange={(e) => setSettings({ ...settings, autoMarkRead: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent-primary)]"
                />
                <span className="text-[13px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">Auto Mark as Read</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={settings.notificationSound}
                  onChange={(e) => setSettings({ ...settings, notificationSound: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent-primary)]"
                />
                <span className="text-[13px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">Notification Sound</span>
              </label>
            </div>
          </section>

          {/* Auto-Sync Settings */}
          <section>
            <div className="flex items-center gap-2.5 mb-4">
              <span className="text-[var(--text-muted)]">{Icons.refresh}</span>
              <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Auto-Sync</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={settings.autoSync !== false}
                    onChange={(e) => setSettings({ ...settings, autoSync: e.target.checked })}
                    className="w-4 h-4 rounded accent-[var(--accent-primary)]"
                  />
                  <span className="text-[13px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">Enable Auto-Sync</span>
                </label>
              </div>
              {settings.autoSync !== false && (
                <div>
                  <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-2">
                    Sync Interval (seconds)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="300"
                    step="10"
                    value={settings.autoSyncInterval || 30}
                    onChange={(e) => setSettings({ ...settings, autoSyncInterval: parseInt(e.target.value) || 30 })}
                    className="input text-[13px] w-full"
                  />
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-subtle)] flex gap-3 shrink-0">
          <button onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} className="btn btn-primary flex-1">
            {Icons.save}
            <span>Save</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;



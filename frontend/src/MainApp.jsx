import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import DOMPurify from 'dompurify';
import api from './services/api';
import AccountSettings from './components/AccountSettings';
import ComposeEmail from './components/ComposeEmail';

// Icons - Clean SVG icons
const Icons = {
  inbox: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>,
  star: <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>,
  starOutline: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
  refresh: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
  search: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  filter: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>,
  menu: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" /></svg>,
  back: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" /></svg>,
  logout: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
  close: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>,
  reply: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>,
  forward: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>,
  trash: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  x: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>,
  snooze: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  bell: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
  zap: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  link: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
  settings: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  compose: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>,
  // Category icons
  send: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>,
  mail: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  briefcase: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  user: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  users: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  tag: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>,
  dollar: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  file: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  // Additional icons for new features
  check: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
  checkSquare: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  square: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={1.5} /></svg>,
  archive: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>,
  folder: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>,
  calendar: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  paperclip: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>,
  threads: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>,
  sparkles: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>,
  plus: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
};

const CATEGORIES = [
  { id: 'all', name: 'All Mail', icon: 'inbox' },
  { id: 'important', name: 'Starred', icon: 'star' },
  { id: 'sent', name: 'Sent', icon: 'send' },
  { id: 'drafts', name: 'Drafts', icon: 'file' },
  { id: 'primary', name: 'Primary', icon: 'mail' },
  { id: 'work', name: 'Work', icon: 'briefcase' },
  { id: 'personal', name: 'Personal', icon: 'user' },
  { id: 'social', name: 'Social', icon: 'users' },
  { id: 'promotions', name: 'Promotions', icon: 'tag' },
  { id: 'updates', name: 'Updates', icon: 'bell' },
  { id: 'finance', name: 'Finance', icon: 'dollar' },
  { id: 'newsletters', name: 'Newsletters', icon: 'file' },
];

// Valid categories for moving emails
const VALID_MOVE_CATEGORIES = ['primary', 'work', 'personal', 'social', 'promotions', 'updates', 'finance', 'newsletters'];

// Quick Reply Templates
const QUICK_REPLIES = [
  { id: 'thanks', label: 'Thank You', text: 'Thank you for your email. I appreciate your message.' },
  { id: 'received', label: 'Received', text: 'I have received your email. I will get back to you soon.' },
  { id: 'meeting', label: 'Schedule Meeting', text: 'Thank you for reaching out. Would you be available for a quick call this week?' },
  { id: 'busy', label: 'Busy', text: 'Thank you for your email. I am currently busy but will respond in detail soon.' },
  { id: 'info', label: 'Request Info', text: 'Thank you for your email. Could you please provide more information about...' },
];

// Calculate Priority Score - More balanced algorithm
const calculatePriorityScore = (email) => {
  let score = 30; // Lower base score
  
  // Starred emails get moderate priority boost
  if (email.is_starred) score += 15;
  
  // Unread emails get small priority boost
  if (!email.is_read) score += 10;
  
  // Category-based priority (more conservative)
  const categoryPriority = {
    'primary': 20,
    'finance': 15,
    'work': 10,
    'updates': 5,
    'personal': 3,
    'social': -5,
    'promotions': -15,
    'newsletters': -20,
  };
  score += categoryPriority[email.predicted_category] || 0;
  
  // Keywords in subject (moderate boost)
  const urgentKeywords = ['urgent', 'asap', 'important', 'critical', 'immediate'];
  if (urgentKeywords.some(kw => email.subject?.toLowerCase().includes(kw))) {
    score += 12;
  }
  
  // Only show high priority (70+) for truly important emails
  return Math.min(100, Math.max(0, score));
};

// Extract Unsubscribe Link
const extractUnsubscribeLink = (body) => {
  if (!body) return null;
  const patterns = [
    /unsubscribe[^<]*<a[^>]*href=["']([^"']+)["'][^>]*>/i,
    /href=["']([^"']*unsubscribe[^"']*)["']/i,
    /mailto:[^?]*\?subject=unsubscribe/i,
  ];
  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match) return match[1] || match[0];
  }
  return null;
};

// Sidebar Component - Premium Superhuman-style
const Sidebar = ({ category, setCategory, stats, onLogout, onRefresh, isLoading, user, isMobile, onClose, onOpenSettings, onCompose }) => (
  <aside className={`${isMobile ? 'fixed inset-0 z-50 flex' : 'w-[240px] h-screen sticky top-0'}`} onClick={isMobile ? onClose : undefined}>
    {isMobile && <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />}
    <div className={`${isMobile ? 'relative z-10 w-[240px]' : 'w-full'} h-full flex flex-col bg-[var(--bg-raised)] border-r border-[var(--border-subtle)]`} onClick={e => e.stopPropagation()}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white" style={{ background: 'var(--accent-gradient)', boxShadow: 'var(--shadow-sm)' }}>
              {Icons.mail}
            </div>
            <div>
              <span className="text-[15px] font-semibold text-[var(--text-primary)]">SmartInbox</span>
              <p className="text-[11px] text-[var(--text-muted)]">AI-powered email</p>
            </div>
          </div>
          {isMobile && <button onClick={onClose} className="btn btn-ghost btn-icon">{Icons.close}</button>}
        </div>

        {/* Compose Button - Premium gradient */}
        {onCompose && (
          <button onClick={onCompose} className="btn btn-primary w-full mb-2" style={{ boxShadow: 'var(--shadow-sm), var(--shadow-glow)' }}>
            {Icons.compose}
            <span>Compose</span>
            <span className="kbd ml-auto">C</span>
          </button>
        )}
      </div>

      {/* Navigation - Clean list */}
      <nav className="flex-1 px-3 overflow-y-auto min-h-0">
        <div className="space-y-0.5">
          {CATEGORIES.map((cat) => {
            const count = cat.id === 'all' ? stats.total :
                          cat.id === 'important' ? stats.starred :
                          cat.id === 'sent' ? stats.sent :
                          cat.id === 'drafts' ? stats.drafts :
                          (stats.categories?.[cat.id] || 0);
            const IconComponent = Icons[cat.icon];
            const isActive = category === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => { setCategory(cat.id); isMobile && onClose?.(); }}
                className={`nav-item w-full ${isActive ? 'active' : ''}`}
              >
                <span className={isActive ? 'text-[var(--accent-primary)]' : ''}>{IconComponent}</span>
                <span className="flex-1 text-left">{cat.name}</span>
                {count > 0 && (
                  <span className={`text-[11px] tabular-nums ${isActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Sync button - subtle */}
      <div className="px-3 py-2">
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="btn btn-ghost w-full text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
        >
          <span className={isLoading ? 'animate-spin' : ''}>{Icons.refresh}</span>
          <span className="text-[13px]">{isLoading ? 'Syncing...' : 'Sync emails'}</span>
          <span className="kbd ml-auto">R</span>
        </button>
      </div>

      {/* User section - Premium feel */}
      <div className="p-3 border-t border-[var(--border-subtle)]">
        {user && (
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--bg-spotlight)] transition-colors cursor-pointer mb-2" onClick={onOpenSettings}>
            <div className="avatar w-9 h-9 text-xs">
              {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{user.name || 'User'}</p>
              <p className="text-[11px] text-[var(--text-muted)] truncate">{user.email}</p>
            </div>
            {Icons.settings}
          </div>
        )}
        <button
          onClick={onLogout}
          className="btn btn-ghost w-full text-[var(--danger)] hover:bg-[var(--danger-muted)]"
        >
          {Icons.logout}
          <span>Sign out</span>
        </button>
      </div>
    </div>
  </aside>
);

// Searchable Sender Filter Component - Compact & Clean
const SearchableSenderFilter = ({ uniqueSenders, filterSender, setFilterSender }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  const filteredSenders = useMemo(() => {
    if (!searchTerm) return uniqueSenders;
    return uniqueSenders.filter(sender =>
      sender.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [uniqueSenders, searchTerm]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedSenderName = filterSender || 'All Senders';
  const displayName = selectedSenderName.length > 15 ? selectedSenderName.slice(0, 15) + '...' : selectedSenderName;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 px-2.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] hover:bg-[var(--bg-spotlight)] text-[var(--text-secondary)] text-xs flex items-center gap-1.5 transition-colors w-full"
        title={selectedSenderName}
      >
        <span className="text-[var(--text-muted)]">{Icons.filter}</span>
        <span className="truncate flex-1 text-left">{displayName}</span>
        <svg className="w-3 h-3 text-[var(--text-muted)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg-overlay)] border border-[var(--border-default)] rounded-lg overflow-hidden z-50 max-h-64 flex flex-col" style={{ boxShadow: 'var(--shadow-lg)' }}>
          <div className="p-1.5 border-b border-[var(--border-subtle)]">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-full px-2 py-1 text-xs bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md text-[var(--text-secondary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto max-h-48">
            <button
              onClick={() => { setFilterSender(null); setIsOpen(false); setSearchTerm(''); }}
              className={`w-full text-left px-2.5 py-1.5 text-xs transition-colors ${
                !filterSender ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-spotlight)]'
              }`}
            >
              All Senders
            </button>
            {filteredSenders.length === 0 ? (
              <div className="px-2.5 py-2 text-xs text-[var(--text-muted)]">No senders found</div>
            ) : (
              filteredSenders.map(sender => (
                <button
                  key={sender}
                  onClick={() => { setFilterSender(sender); setIsOpen(false); setSearchTerm(''); }}
                  className={`w-full text-left px-2.5 py-1.5 text-xs transition-colors ${
                    filterSender === sender ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-spotlight)]'
                  }`}
                  title={sender}
                >
                  <div className="truncate">{sender}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Advanced Search Panel Component
const AdvancedSearchPanel = ({ isOpen, onClose, onSearch }) => {
  const [filters, setFilters] = useState({
    q: '',
    sender: '',
    subject: '',
    hasAttachment: null,
    isStarred: null,
    isRead: null,
    category: '',
    dateFrom: '',
    dateTo: ''
  });

  const handleSearch = () => {
    const activeFilters = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== '' && value !== null) {
        activeFilters[key] = value;
      }
    });
    onSearch(activeFilters);
    onClose();
  };

  const handleReset = () => {
    setFilters({
      q: '', sender: '', subject: '', hasAttachment: null,
      isStarred: null, isRead: null, category: '', dateFrom: '', dateTo: ''
    });
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-[var(--bg-overlay)] border border-[var(--border-default)] rounded-lg p-4 animate-scaleIn" style={{ boxShadow: 'var(--shadow-lg)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">Advanced Search</h3>
        <button onClick={onClose} className="btn btn-ghost btn-icon">{Icons.close}</button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-[12px] text-[var(--text-muted)] mb-1 block">Full text search</label>
          <input type="text" className="input text-[13px]" placeholder="Search in body..." value={filters.q} onChange={e => setFilters({...filters, q: e.target.value})} />
        </div>
        <div>
          <label className="text-[12px] text-[var(--text-muted)] mb-1 block">Sender</label>
          <input type="text" className="input text-[13px]" placeholder="email@example.com" value={filters.sender} onChange={e => setFilters({...filters, sender: e.target.value})} />
        </div>
        <div>
          <label className="text-[12px] text-[var(--text-muted)] mb-1 block">Subject contains</label>
          <input type="text" className="input text-[13px]" placeholder="Subject keywords" value={filters.subject} onChange={e => setFilters({...filters, subject: e.target.value})} />
        </div>
        <div>
          <label className="text-[12px] text-[var(--text-muted)] mb-1 block">Category</label>
          <select className="input text-[13px]" value={filters.category} onChange={e => setFilters({...filters, category: e.target.value})}>
            <option value="">Any category</option>
            {VALID_MOVE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[12px] text-[var(--text-muted)] mb-1 block">Date from</label>
          <input type="date" className="input text-[13px]" value={filters.dateFrom} onChange={e => setFilters({...filters, dateFrom: e.target.value})} />
        </div>
        <div>
          <label className="text-[12px] text-[var(--text-muted)] mb-1 block">Date to</label>
          <input type="date" className="input text-[13px]" value={filters.dateTo} onChange={e => setFilters({...filters, dateTo: e.target.value})} />
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <label className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)] cursor-pointer">
          <input type="checkbox" checked={filters.hasAttachment === true} onChange={e => setFilters({...filters, hasAttachment: e.target.checked ? true : null})} className="accent-[var(--accent-primary)]" />
          Has attachment
        </label>
        <label className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)] cursor-pointer">
          <input type="checkbox" checked={filters.isStarred === true} onChange={e => setFilters({...filters, isStarred: e.target.checked ? true : null})} className="accent-[var(--accent-primary)]" />
          Starred only
        </label>
        <label className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)] cursor-pointer">
          <input type="checkbox" checked={filters.isRead === false} onChange={e => setFilters({...filters, isRead: e.target.checked ? false : null})} className="accent-[var(--accent-primary)]" />
          Unread only
        </label>
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={handleReset} className="btn btn-ghost">Reset</button>
        <button onClick={handleSearch} className="btn btn-primary">Search</button>
      </div>
    </div>
  );
};

// Bulk Actions Bar Component
const BulkActionsBar = ({ selectedCount, onAction, onClearSelection }) => {
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-xl px-4 py-2.5 flex items-center gap-3 animate-slideUp" style={{ boxShadow: 'var(--shadow-lg)' }}>
      <span className="text-[13px] text-[var(--text-primary)] font-medium">{selectedCount} selected</span>
      <div className="h-4 w-px bg-[var(--border-default)]" />

      <button onClick={() => onAction('mark_read')} className="btn btn-ghost btn-sm" title="Mark as read">
        {Icons.check}
      </button>
      <button onClick={() => onAction('mark_unread')} className="btn btn-ghost btn-sm" title="Mark as unread">
        {Icons.mail}
      </button>
      <button onClick={() => onAction('star')} className="btn btn-ghost btn-sm" title="Star">
        {Icons.starOutline}
      </button>
      <button onClick={() => onAction('archive')} className="btn btn-ghost btn-sm" title="Archive">
        {Icons.archive}
      </button>

      <div className="relative">
        <button onClick={() => setShowCategoryMenu(!showCategoryMenu)} className="btn btn-ghost btn-sm" title="Move to category">
          {Icons.folder}
        </button>
        {showCategoryMenu && (
          <div className="absolute bottom-full left-0 mb-2 bg-[var(--bg-overlay)] border border-[var(--border-default)] rounded-lg p-1.5 min-w-[140px] animate-scaleIn" style={{ boxShadow: 'var(--shadow-lg)' }}>
            {VALID_MOVE_CATEGORIES.map(cat => (
              <button key={cat} onClick={() => { onAction('move_category', cat); setShowCategoryMenu(false); }} className="w-full text-left px-3 py-1.5 rounded-md hover:bg-[var(--bg-spotlight)] text-[13px] text-[var(--text-secondary)] capitalize">
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      <button onClick={() => onAction('delete')} className="btn btn-ghost btn-sm text-[var(--danger)]" title="Delete">
        {Icons.trash}
      </button>

      <div className="h-4 w-px bg-[var(--border-default)]" />
      <button onClick={onClearSelection} className="btn btn-ghost btn-sm" title="Clear selection">
        {Icons.x}
      </button>
    </div>
  );
};

// Email List Component - Premium Superhuman-style with bulk actions
const EmailList = ({ emails, selected, onSelect, loading, search, setSearch, filterSender, setFilterSender, uniqueSenders, selectedEmails, onToggleSelect, onBulkAction, onClearSelection, onAdvancedSearch, viewMode, onToggleViewMode }) => {
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    if (diff < 86400000) return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return date.toLocaleDateString('en-US', { weekday: 'short' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getBadgeClass = (cat) => {
    const map = { primary: 'badge-primary', work: 'badge-work', personal: 'badge-personal', social: 'badge-social', promotions: 'badge-promotions', updates: 'badge-updates', finance: 'badge-finance', newsletters: 'badge-newsletters' };
    return map[cat] || 'badge-primary';
  };

  const handleSelectAll = () => {
    if (selectedEmails.length === emails.length) {
      onClearSelection();
    } else {
      emails.forEach(e => !selectedEmails.includes(e.id) && onToggleSelect(e.id));
    }
  };

  return (
    <div className="w-full lg:w-[340px] h-full flex flex-col bg-[var(--bg-surface)] border-r border-[var(--border-subtle)]">
      {/* Search Header */}
      <div className="p-3 border-b border-[var(--border-subtle)] relative">
        <div className="flex items-center gap-2 mb-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">{Icons.search}</span>
            <input
              type="text"
              placeholder="Search emails..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10 pr-12"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button onClick={() => setShowAdvancedSearch(!showAdvancedSearch)} className="btn btn-ghost btn-icon p-1" title="Advanced search">
                {Icons.filter}
              </button>
              <span className="kbd text-[10px]">/</span>
            </div>
          </div>
        </div>

        {/* Advanced Search Panel */}
        <AdvancedSearchPanel isOpen={showAdvancedSearch} onClose={() => setShowAdvancedSearch(false)} onSearch={onAdvancedSearch} />

        {/* Sender Filter & Bulk Select */}
        <div className="flex items-center gap-2">
          {emails.length > 0 && (
            <button onClick={handleSelectAll} className="btn btn-ghost btn-icon shrink-0" title={selectedEmails.length === emails.length ? 'Deselect all' : 'Select all'}>
              {selectedEmails.length === emails.length ? Icons.checkSquare : Icons.square}
            </button>
          )}
          {uniqueSenders.length > 0 && (
            <div className="flex-1">
              <SearchableSenderFilter uniqueSenders={uniqueSenders} filterSender={filterSender} setFilterSender={setFilterSender} />
            </div>
          )}
        </div>
      </div>

      {/* Email List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="p-3 space-y-1">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex gap-3 p-3 rounded-lg">
                <div className="w-10 h-10 rounded-lg skeleton" />
                <div className="flex-1 space-y-2.5">
                  <div className="h-4 skeleton w-2/5" />
                  <div className="h-3.5 skeleton w-4/5" />
                  <div className="h-3 skeleton w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <div className="w-16 h-16 rounded-xl bg-[var(--bg-raised)] flex items-center justify-center mb-4 text-[var(--text-muted)]">
              {Icons.inbox}
            </div>
            <h3 className="text-[15px] font-medium text-[var(--text-primary)] mb-1">No emails</h3>
            <p className="text-[13px] text-[var(--text-muted)] text-center">No emails found matching your criteria</p>
          </div>
        ) : (
          <div className="stagger">
            {emails.map((email, index) => {
              const priorityScore = calculatePriorityScore(email);
              const isSelected = selected?.id === email.id;
              const isChecked = selectedEmails.includes(email.id);
              const isUnread = !email.is_read;
              return (
                <div
                  key={email.id}
                  className={`email-item flex gap-3 ${isSelected ? 'selected' : ''} ${isUnread ? 'unread' : ''} ${isChecked ? 'bg-[var(--accent-subtle)]' : ''}`}
                >
                  <button onClick={(e) => { e.stopPropagation(); onToggleSelect(email.id); }} className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${isChecked ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)] text-white' : 'border-[var(--border-default)] hover:border-[var(--accent-primary)]'}`}>
                    {isChecked && Icons.check}
                  </button>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelect(email)}>
                    <div className="flex items-center gap-2">
                      <div className="avatar w-8 h-8 text-[10px]">
                        {email.sender_name?.[0]?.toUpperCase() || email.sender?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <h4 className={`truncate text-[13px] ${isUnread ? 'font-semibold text-[var(--text-primary)]' : 'font-medium text-[var(--text-secondary)]'}`}>
                            {email.sender_name || email.sender?.split('@')[0] || 'Unknown'}
                          </h4>
                          <span className="text-[11px] text-[var(--text-muted)] tabular-nums shrink-0">{formatDate(email.received_at)}</span>
                        </div>
                        <p className={`truncate text-[13px] mb-1 ${isUnread ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'}`}>
                          {email.subject || '(No subject)'}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className={`badge ${getBadgeClass(email.predicted_category)}`}>
                            {email.predicted_category}
                          </span>
                          {email.is_starred && <span className="text-amber-400">{Icons.star}</span>}
                          {email.has_attachments && <span className="text-[var(--text-muted)]">{Icons.paperclip}</span>}
                          {email.is_draft && <span className="badge" style={{ background: 'var(--warning-muted)', color: 'var(--warning)' }}>Draft</span>}
                          {priorityScore >= 70 && <span className="badge" style={{ background: 'var(--danger-muted)', color: 'var(--danger)' }}>Priority</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bulk Actions Bar */}
      <BulkActionsBar selectedCount={selectedEmails.length} onAction={onBulkAction} onClearSelection={onClearSelection} />

      {/* Footer status bar */}
      <div className="px-4 py-2 border-t border-[var(--border-subtle)] flex items-center justify-between">
        <p className="text-[12px] text-[var(--text-muted)]">
          {emails.length} {emails.length === 1 ? 'email' : 'emails'}
          {filterSender && <span className="text-[var(--text-secondary)]"> from {filterSender}</span>}
        </p>
        <div className="flex items-center gap-1 text-[var(--text-muted)]">
          <span className="kbd">J</span>
          <span className="kbd">K</span>
          <span className="text-[11px] ml-1">to navigate</span>
        </div>
      </div>
    </div>
  );
};

// Email Detail Component - Premium Superhuman-style
const EmailDetail = ({ email, onBack, onToggleStar, onReply, onForward, onDelete, onSnooze, onUnsubscribe }) => {
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);

  if (!email) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[var(--bg-base)] min-h-0">
        <div className="text-center animate-fadeIn">
          <div className="w-20 h-20 rounded-2xl bg-[var(--bg-raised)] flex items-center justify-center mb-5 mx-auto text-[var(--text-muted)]" style={{ boxShadow: 'var(--shadow-md)' }}>
            {Icons.mail}
          </div>
          <h3 className="text-[17px] font-semibold text-[var(--text-primary)] mb-2">Select an email</h3>
          <p className="text-[14px] text-[var(--text-muted)] mb-4">Choose an email from the list to view its contents</p>
          <div className="flex items-center justify-center gap-2 text-[var(--text-muted)]">
            <span className="kbd">J</span>
            <span className="kbd">K</span>
            <span className="text-[12px]">to navigate</span>
            <span className="mx-2 text-[var(--border-default)]">|</span>
            <span className="kbd">Enter</span>
            <span className="text-[12px]">to open</span>
          </div>
        </div>
      </div>
    );
  }

  const getBadgeClass = (cat) => {
    const map = { primary: 'badge-primary', work: 'badge-work', personal: 'badge-personal', social: 'badge-social', promotions: 'badge-promotions', updates: 'badge-updates', finance: 'badge-finance', newsletters: 'badge-newsletters' };
    return map[cat] || 'badge-primary';
  };

  const priorityScore = calculatePriorityScore(email);
  const unsubscribeLink = extractUnsubscribeLink(email.body || email.snippet);

  const snoozeOptions = [
    { label: 'Later Today', hours: 4, kbd: 'H' },
    { label: 'Tomorrow', hours: 24, kbd: 'T' },
    { label: 'This Weekend', hours: 48, kbd: 'W' },
    { label: 'Next Week', hours: 168, kbd: 'N' },
  ];

  const handleSnooze = (hours) => {
    onSnooze?.(email, hours);
    setShowSnoozeMenu(false);
  };

  const handleReply = (replyText) => {
    onReply?.(email, replyText);
  };

  const handleForward = () => {
    onForward?.(email);
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${email.subject || 'this email'}"?`)) {
      onDelete?.(email);
    }
  };

  return (
    <>
      <div className="flex-1 flex flex-col bg-[var(--bg-base)] min-h-0 animate-fadeIn">
        {/* Header - Clean and spacious */}
        <div className="p-5 border-b border-[var(--border-subtle)] shrink-0 bg-[var(--bg-surface)]">
          <div className="flex items-start gap-4">
            <button onClick={onBack} className="lg:hidden btn btn-ghost btn-icon">{Icons.back}</button>

            <div className="avatar w-12 h-12 text-sm shrink-0">
              {email.sender_name?.[0]?.toUpperCase() || '?'}
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-[17px] font-semibold text-[var(--text-primary)] mb-2 leading-tight">{email.subject || '(No subject)'}</h2>
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <span className="text-[14px] font-medium text-[var(--text-secondary)]">{email.sender_name || 'Unknown'}</span>
                <span className="text-[13px] text-[var(--text-muted)]">&lt;{email.sender}&gt;</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`badge ${getBadgeClass(email.predicted_category)}`}>{email.predicted_category}</span>
                <span className="text-[12px] text-[var(--text-muted)]">{new Date(email.received_at).toLocaleString()}</span>
                {priorityScore >= 70 && (
                  <span className="badge" style={{ background: 'var(--danger-muted)', color: 'var(--danger)' }}>High Priority</span>
                )}
              </div>
            </div>

            <button
              onClick={() => onToggleStar?.(email)}
              className={`btn btn-ghost btn-icon ${
                email.is_starred ? 'text-amber-400' : 'text-[var(--text-muted)]'
              }`}
              title={email.is_starred ? 'Unstar (S)' : 'Star (S)'}
            >
              {email.is_starred ? Icons.star : Icons.starOutline}
            </button>
          </div>
        </div>

        {/* Body - Email content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {(() => {
            const body = email.body || email.snippet || 'No content available';
            // Check if body contains HTML tags
            const isHTML = /<[a-z][\s\S]*>/i.test(body);

            if (isHTML) {
              // Sanitize HTML content to prevent XSS attacks
              const sanitizedHTML = DOMPurify.sanitize(body, {
                ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                  'ul', 'ol', 'li', 'a', 'img', 'div', 'span', 'blockquote', 'pre', 'code',
                  'table', 'thead', 'tbody', 'tr', 'td', 'th', 'hr', 'b', 'i', 'font', 'center'],
                ALLOWED_ATTR: ['href', 'title', 'target', 'src', 'alt', 'width', 'height', 'style',
                  'border', 'cellpadding', 'cellspacing', 'colspan', 'rowspan', 'class', 'id', 'align', 'color', 'size', 'face'],
                ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
                ALLOW_DATA_ATTR: false,
                FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
                FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
              });

              // Render HTML email (like Gmail) - sanitized with better styling
              return (
                <div
                  className="email-html-content"
                  dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
                  style={{
                    maxWidth: '100%',
                    overflow: 'hidden',
                    wordWrap: 'break-word',
                    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    color: 'var(--text-primary)',
                  }}
                />
              );
            } else {
              // Render plain text - escape HTML entities
              const escapedBody = DOMPurify.sanitize(body, { ALLOWED_TAGS: [] });
              return (
                <div
                  className="text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed break-words"
                  style={{
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    maxWidth: '100%',
                    overflow: 'hidden',
                  }}
                >
                  {escapedBody}
                </div>
              );
            }
          })()}
        </div>

        {/* Actions - Premium toolbar */}
        <div className="p-4 border-t border-[var(--border-subtle)] flex items-center gap-2 shrink-0 bg-[var(--bg-surface)]">
          <button
            onClick={handleReply}
            className="btn btn-primary"
            title="Reply (R)"
          >
            {Icons.reply}
            <span>Reply</span>
            <span className="kbd ml-1">R</span>
          </button>
          <button
            onClick={handleForward}
            className="btn btn-secondary"
            title="Forward (F)"
          >
            {Icons.forward}
            <span>Forward</span>
          </button>

          <div className="flex-1" />

          {/* Snooze */}
          <div className="relative">
            <button
              onClick={() => setShowSnoozeMenu(!showSnoozeMenu)}
              className="btn btn-ghost"
              title="Snooze (Z)"
            >
              {Icons.snooze}
              <span className="hidden sm:inline">Snooze</span>
            </button>
            {showSnoozeMenu && (
              <div className="absolute bottom-full right-0 mb-2 bg-[var(--bg-overlay)] border border-[var(--border-default)] rounded-lg p-1.5 min-w-[180px] z-10 animate-scaleIn" style={{ boxShadow: 'var(--shadow-lg)' }}>
                {snoozeOptions.map(option => (
                  <button
                    key={option.label}
                    onClick={() => handleSnooze(option.hours)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-[var(--bg-spotlight)] text-[13px] text-[var(--text-secondary)] transition-colors"
                  >
                    <span>{option.label}</span>
                    <span className="kbd">{option.kbd}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Unsubscribe Helper */}
          {unsubscribeLink && (
            <button
              onClick={() => onUnsubscribe?.(unsubscribeLink)}
              className="btn btn-ghost"
              title="Unsubscribe from this sender"
            >
              {Icons.link}
              <span className="hidden sm:inline">Unsubscribe</span>
            </button>
          )}

          <button
            onClick={handleDelete}
            className="btn btn-ghost text-[var(--danger)] hover:bg-[var(--danger-muted)]"
            title="Delete this email"
          >
            {Icons.trash}
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>
      </div>

    </>
  );
};

// Main App Component
export default function MainApp({ onLogout, isDemo, user }) {
  const [emails, setEmails] = useState([]);
  const [allEmails, setAllEmails] = useState([]);
  const [category, setCategory] = useState('all');
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [search, setSearch] = useState('');
  const [filterSender, setFilterSender] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [stats, setStats] = useState({ total: 0, starred: 0, drafts: 0, categories: {} });
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [replyToEmail, setReplyToEmail] = useState(null);
  const [forwardEmail, setForwardEmail] = useState(null);
  // New state for bulk actions
  const [selectedEmails, setSelectedEmails] = useState([]);
  // New state for view mode (list vs threads)
  const [viewMode, setViewMode] = useState('list');
  // New state for drafts
  const [drafts, setDrafts] = useState([]);
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('smartinbox_settings');
    return saved ? JSON.parse(saved) : {
      theme: 'dark',
      emailLayout: 'split',
      emailsPerPage: 200,
      showPriorityScore: true,
      showUnreadBadge: true,
      compactMode: false,
      autoMarkRead: false,
      notificationSound: false,
      autoSync: true,
      autoSyncInterval: 30,
    };
  });

  // Apply theme settings
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'light') {
      root.classList.add('light-theme');
      root.classList.remove('dark-theme');
    } else if (settings.theme === 'dark') {
      root.classList.add('dark-theme');
      root.classList.remove('light-theme');
    } else {
      // Auto - use system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark-theme');
        root.classList.remove('light-theme');
      } else {
        root.classList.add('light-theme');
        root.classList.remove('dark-theme');
      }
    }
  }, [settings.theme]);

  // Fetch all emails (both inbox and sent) and drafts
  const fetchEmails = useCallback(async () => {
    try {
      setLoading(true);
      const limit = settings.emailsPerPage || 200;

      // Fetch inbox emails (default)
      const inboxData = await api.getEmails({ limit, demo: isDemo });
      const inboxEmails = inboxData.emails || [];

      // Fetch sent emails separately (if not demo mode)
      let sentEmails = [];
      let userDrafts = [];
      if (!isDemo) {
        try {
          const sentData = await api.getEmails({ limit, category: 'sent', demo: false });
          sentEmails = sentData.emails || [];
        } catch (err) {
          console.log('Failed to fetch sent emails:', err);
        }

        // Fetch drafts
        try {
          const draftsData = await api.getDrafts();
          userDrafts = draftsData.drafts || [];
          setDrafts(userDrafts);
        } catch (err) {
          console.log('Failed to fetch drafts:', err);
        }
      }

      // Combine all emails (inbox + sent)
      const allFetched = [...inboxEmails, ...sentEmails];
      setAllEmails(allFetched);

      // Calculate stats
      const newStats = {
        total: inboxEmails.length,
        starred: allFetched.filter(e => e.is_starred).length,
        sent: sentEmails.length,
        drafts: userDrafts.length,
        categories: {}
      };
      CATEGORIES.forEach(cat => {
        if (cat.id === 'sent') {
          newStats.categories[cat.id] = sentEmails.length;
        } else if (cat.id === 'drafts') {
          newStats.categories[cat.id] = userDrafts.length;
        } else if (!['all', 'important'].includes(cat.id)) {
          newStats.categories[cat.id] = inboxEmails.filter(e => e.predicted_category === cat.id).length;
        }
      });
      setStats(newStats);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [isDemo, settings.emailsPerPage]);

  // Get unique senders for filter
  const uniqueSenders = useMemo(() => {
    const senders = new Set();
    allEmails.forEach(email => {
      const sender = email.sender_name || email.sender?.split('@')[0] || 'Unknown';
      if (sender) senders.add(sender);
    });
    return Array.from(senders).sort();
  }, [allEmails]);

  // Filter emails based on category, search, and sender filter
  useEffect(() => {
    let filtered = [];

    // Handle drafts category specially
    if (category === 'drafts') {
      filtered = [...drafts];
    } else {
      filtered = [...allEmails];

      // Category filter
      if (category === 'important') {
        // Starred emails (exclude sent)
        filtered = filtered.filter(e => e.is_starred && !e.is_sent);
      } else if (category === 'sent') {
        // Only sent emails
        filtered = filtered.filter(e => e.is_sent === true);
      } else if (category === 'all') {
        // All Mail = only received emails (exclude sent)
        filtered = filtered.filter(e => !e.is_sent);
      } else {
        // Category filter (exclude sent)
        filtered = filtered.filter(e => e.predicted_category === category && !e.is_sent);
      }
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(e =>
        e.subject?.toLowerCase().includes(q) ||
        e.sender?.toLowerCase().includes(q) ||
        e.sender_name?.toLowerCase().includes(q) ||
        e.snippet?.toLowerCase().includes(q) ||
        e.body?.toLowerCase().includes(q)
      );
    }

    // Sender filter
    if (filterSender) {
      filtered = filtered.filter(e => {
        const sender = e.sender_name || e.sender?.split('@')[0] || 'Unknown';
        return sender === filterSender;
      });
    }

    setEmails(filtered);
  }, [allEmails, drafts, category, search, filterSender]);

  // Auto-sync function (silent background sync)
  const autoSync = useCallback(async () => {
    if (isDemo || !settings.autoSync) return;
    
    try {
      // Silent sync - don't show loading state
      await api.syncEmails(settings.emailsPerPage || 200);
      // Refresh emails after sync
      await fetchEmails();
    } catch (err) {
      // Silent fail - don't show error to user
      console.log('Auto-sync error:', err);
    }
  }, [isDemo, settings.autoSync, settings.emailsPerPage, fetchEmails]);

  // Initial load with auto-sync - only run once on mount
  useEffect(() => {
    const init = async () => {
      if (isDemo) {
        setSyncing(true);
        try {
          await api.loadDemoEmails();
        } catch (e) {
          console.error(e);
        }
        setSyncing(false);
      } else {
        // Giriş yaptıktan sonra otomatik olarak bir kez sync yap (HIZLI)
        // Sync ve fetch'i paralel çalıştır - çok daha hızlı
        const syncPromise = settings.autoSync ? api.syncEmails(50) : Promise.resolve(); // Sadece 50 email sync için hızlı başlangıç
        const fetchPromise = fetchEmails();

        setSyncing(true);
        await Promise.all([syncPromise, fetchPromise]);
        setSyncing(false);
        return;
      }
      await fetchEmails();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Sadece mount'ta çalış

  // Auto-sync interval (belirli aralıklarla otomatik sync) - BASİT versiyon
  useEffect(() => {
    if (isDemo || !settings.autoSync) return;

    const intervalSeconds = (settings.autoSyncInterval || 30) * 1000;

    // Sadece interval ile sync - visibility tracking YOK
    const intervalId = setInterval(() => {
      autoSync();
    }, intervalSeconds);

    return () => {
      clearInterval(intervalId);
    };
  }, [isDemo, settings.autoSync, settings.autoSyncInterval, autoSync]);

  // Refresh handler
  const handleRefresh = async () => {
    setSyncing(true);
    try {
      if (isDemo) {
        await api.loadDemoEmails();
      } else {
        await api.syncEmails();
      }
      await fetchEmails();
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  // Star toggle
  const handleToggleStar = async (email) => {
    try {
      await api.starEmail(email.id, !email.is_starred);
      const updated = { ...email, is_starred: !email.is_starred };
      setAllEmails(prev => prev.map(e => e.id === email.id ? updated : e));
      if (selectedEmail?.id === email.id) setSelectedEmail(updated);
    } catch (err) {
      console.error(err);
    }
  };

  // Compose handler
  const handleCompose = () => {
    setReplyToEmail(null);
    setForwardEmail(null);
    setShowCompose(true);
  };

  // Handle email sent
  const handleEmailSent = async () => {
    await fetchEmails(); // Refresh emails after sending
  };

  // Reply handler
  const handleReply = async (email, replyText) => {
    try {
      // In a real app, this would send the reply via API
      console.log('Replying to:', email.sender, 'Message:', replyText);
      alert(`Reply sent to ${email.sender_name || email.sender}!\n\nMessage: ${replyText}`);
      // You could also mark as read after replying
      await api.markEmailRead(email.id, true);
      const updated = { ...email, is_read: true };
      setAllEmails(prev => prev.map(e => e.id === email.id ? updated : e));
      if (selectedEmail?.id === email.id) setSelectedEmail(updated);
    } catch (err) {
      console.error('Reply error:', err);
      alert('Failed to send reply. Please try again.');
    }
  };

  // Snooze handler
  const handleSnooze = async (email, hours) => {
    try {
      const snoozeUntil = new Date();
      snoozeUntil.setHours(snoozeUntil.getHours() + hours);
      console.log('Snoozing email until:', snoozeUntil);
      alert(`Email snoozed until ${snoozeUntil.toLocaleString()}`);
      // In a real app, this would update the email's snooze_until field
    } catch (err) {
      console.error('Snooze error:', err);
    }
  };

  // Unsubscribe handler
  const handleUnsubscribe = (link) => {
    if (link.startsWith('http')) {
      window.open(link, '_blank');
    } else if (link.startsWith('mailto:')) {
      window.location.href = link;
    } else {
      alert(`Unsubscribe link: ${link}\n\nIn a real app, this would open the unsubscribe page.`);
    }
  };

  // Delete handler
  const handleDelete = async (email) => {
    try {
      await api.deleteEmail(email.id);
      // Remove from local state
      setAllEmails(prev => prev.filter(e => e.id !== email.id));
      setDrafts(prev => prev.filter(e => e.id !== email.id));
      // Clear selection if deleted email was selected
      if (selectedEmail?.id === email.id) {
        setSelectedEmail(null);
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete email. Please try again.');
    }
  };

  // Bulk action handler
  const handleBulkAction = async (action, category = null) => {
    if (selectedEmails.length === 0) return;

    try {
      await api.bulkAction(selectedEmails, action, category);
      // Refresh emails after bulk action
      await fetchEmails();
      // Clear selection
      setSelectedEmails([]);
      setSelectedEmail(null);
    } catch (err) {
      console.error('Bulk action error:', err);
      alert(`Failed to perform bulk action: ${err.message}`);
    }
  };

  // Toggle email selection for bulk actions
  const handleToggleSelect = (emailId) => {
    setSelectedEmails(prev =>
      prev.includes(emailId)
        ? prev.filter(id => id !== emailId)
        : [...prev, emailId]
    );
  };

  // Clear all selections
  const handleClearSelection = () => {
    setSelectedEmails([]);
  };

  // Advanced search handler
  const handleAdvancedSearch = async (filters) => {
    try {
      setLoading(true);
      const result = await api.advancedSearch(filters);
      setEmails(result.emails || []);
    } catch (err) {
      console.error('Advanced search error:', err);
      alert('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Toggle view mode (list vs threads)
  const handleToggleViewMode = () => {
    setViewMode(prev => prev === 'list' ? 'threads' : 'list');
  };

  return (
    <div className="h-screen flex overflow-hidden theme-bg-primary">
      {/* Sidebar - Desktop */}
      <div className="hidden lg:block">
        <Sidebar
          category={category}
          setCategory={setCategory}
          stats={stats}
          onLogout={onLogout}
          onRefresh={handleRefresh}
          isLoading={syncing}
          user={user}
          onOpenSettings={() => setShowAccountSettings(true)}
          onCompose={handleCompose}
        />
      </div>

      {/* Sidebar - Mobile */}
      {mobileMenu && (
        <Sidebar
          category={category}
          setCategory={setCategory}
          stats={stats}
          onLogout={onLogout}
          onRefresh={handleRefresh}
          isLoading={syncing}
          user={user}
          isMobile
          onClose={() => setMobileMenu(false)}
          onOpenSettings={() => { setShowAccountSettings(true); setMobileMenu(false); }}
          onCompose={() => { handleCompose(); setMobileMenu(false); }}
        />
      )}

      {/* Account Settings Modal */}
      {showAccountSettings && (
        <AccountSettings
          user={user}
          onClose={() => setShowAccountSettings(false)}
          onSave={(newSettings) => {
            setSettings(newSettings);
            // Apply settings
            if (newSettings.emailsPerPage !== settings.emailsPerPage) {
              fetchEmails();
            }
          }}
        />
      )}

      {/* Compose Email Modal */}
      {showCompose && (
        <ComposeEmail
          onClose={() => { setShowCompose(false); setReplyToEmail(null); setForwardEmail(null); }}
          replyTo={replyToEmail}
          forwardTo={forwardEmail}
          onSent={handleEmailSent}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center gap-4 p-4 theme-bg-primary border-b theme-border-subtle">
          <button onClick={() => setMobileMenu(true)} className="btn btn-ghost p-2">{Icons.menu}</button>
          <h1 className="text-lg font-bold theme-text-primary flex-1">SmartInbox</h1>
          <button onClick={handleRefresh} disabled={syncing} className="btn btn-ghost p-2">
            <span className={syncing ? 'animate-spin' : ''}>{Icons.refresh}</span>
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Email List */}
          <div className={`${selectedEmail ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-auto`}>
            <EmailList
              emails={emails}
              selected={selectedEmail}
              onSelect={setSelectedEmail}
              loading={loading}
              search={search}
              setSearch={setSearch}
              filterSender={filterSender}
              setFilterSender={setFilterSender}
              uniqueSenders={uniqueSenders}
              selectedEmails={selectedEmails}
              onToggleSelect={handleToggleSelect}
              onBulkAction={handleBulkAction}
              onClearSelection={handleClearSelection}
              onAdvancedSearch={handleAdvancedSearch}
              viewMode={viewMode}
              onToggleViewMode={handleToggleViewMode}
            />
          </div>

          {/* Email Detail */}
          <div className={`${selectedEmail ? 'flex' : 'hidden lg:flex'} flex-1 flex-col min-w-0`}>
            <EmailDetail
              email={selectedEmail}
              onBack={() => setSelectedEmail(null)}
              onToggleStar={handleToggleStar}
              onReply={() => { setReplyToEmail(selectedEmail); setForwardEmail(null); setShowCompose(true); }}
              onForward={() => { setForwardEmail(selectedEmail); setReplyToEmail(null); setShowCompose(true); }}
              onDelete={handleDelete}
              onSnooze={handleSnooze}
              onUnsubscribe={handleUnsubscribe}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

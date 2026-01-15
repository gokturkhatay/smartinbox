import { useState, useRef } from 'react';
import api from '../services/api';

const Icons = {
  close: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  send: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>,
  paperclip: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>,
  x: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
};

const ComposeEmail = ({ onClose, replyTo = null, forwardTo = null, onSent }) => {
  const email = replyTo || forwardTo;
  const [to, setTo] = useState(replyTo?.sender || '');
  const [subject, setSubject] = useState(
    replyTo ? `Re: ${replyTo.subject || ''}` :
    forwardTo ? `Fwd: ${forwardTo.subject || ''}` :
    ''
  );
  const [body, setBody] = useState(
    replyTo ? `\n\n--- Original Message ---\n${replyTo.body || replyTo.snippet || ''}` :
    forwardTo ? `\n\n--- Forwarded Message ---\nFrom: ${forwardTo.sender_name || forwardTo.sender}\nDate: ${new Date(forwardTo.received_at).toLocaleString()}\nSubject: ${forwardTo.subject || ''}\n\n${forwardTo.body || forwardTo.snippet || ''}` :
    ''
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    setError('');

    for (const file of files) {
      // Check file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        setError(`File "${file.name}" is too large. Max size is 10MB.`);
        continue;
      }

      try {
        const result = await api.uploadAttachment(file);
        if (result.success && result.attachment) {
          setAttachments(prev => [...prev, result.attachment]);
        }
      } catch (err) {
        setError(`Failed to upload "${file.name}": ${err.message}`);
      }
    }

    setUploading(false);
    // Clear input so same file can be selected again
    e.target.value = '';
  };

  const handleRemoveAttachment = async (attachmentId) => {
    try {
      await api.deleteAttachment(attachmentId);
      setAttachments(prev => prev.filter(a => a.id !== attachmentId));
    } catch (err) {
      console.error('Failed to remove attachment:', err);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSend = async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      setError('Please fill in all fields');
      return;
    }

    setSending(true);
    setError('');

    try {
      await api.sendEmail(
        to.trim(),
        subject.trim(),
        body.trim(),
        replyTo?.id || null
      );
      onSent?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center theme-overlay backdrop-blur-sm" onClick={onClose}>
      <div className="theme-bg-primary rounded-2xl border theme-border-default w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col shadow-lg" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b theme-border-subtle flex items-center justify-between">
          <h2 className="text-2xl font-bold theme-text-primary">
            {replyTo ? 'Reply' : forwardTo ? 'Forward' : 'Compose Email'}
          </h2>
          <button onClick={onClose} className="btn btn-ghost p-2">{Icons.close}</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0 space-y-4">
          {/* To */}
          <div>
            <label className="block text-sm font-medium theme-text-secondary mb-2">To</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="input"
              disabled={!!replyTo}
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium theme-text-secondary mb-2">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              className="input"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium theme-text-secondary mb-2">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your message..."
              className="input min-h-[200px] resize-none"
            />
          </div>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div>
              <label className="block text-sm font-medium theme-text-secondary mb-2">Attachments</label>
              <div className="flex flex-wrap gap-2">
                {attachments.map(att => (
                  <div key={att.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-raised)] border border-[var(--border-subtle)]">
                    {Icons.paperclip}
                    <span className="text-sm text-[var(--text-primary)]">{att.filename}</span>
                    <span className="text-xs text-[var(--text-muted)]">({formatFileSize(att.size)})</span>
                    <button
                      onClick={() => handleRemoveAttachment(att.id)}
                      className="p-1 hover:bg-[var(--bg-spotlight)] rounded transition-colors text-[var(--text-muted)] hover:text-[var(--danger)]"
                    >
                      {Icons.x}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t theme-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.gif,.zip"
            />
            <button
              onClick={handleAttachClick}
              className="btn btn-ghost text-sm"
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <span className="animate-spin">...</span>
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  {Icons.paperclip}
                  <span>Attach</span>
                </>
              )}
            </button>
            {attachments.length > 0 && (
              <span className="text-xs text-[var(--text-muted)]">
                {attachments.length} file{attachments.length > 1 ? 's' : ''} attached
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-secondary" disabled={sending}>
              Cancel
            </button>
            <button
              onClick={handleSend}
              className="btn btn-primary"
              disabled={sending || !to.trim() || !subject.trim() || !body.trim()}
            >
              {sending ? (
                <>
                  <span className="animate-spin">...</span>
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  {Icons.send}
                  <span>Send</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComposeEmail;

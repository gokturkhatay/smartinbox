// Dynamic API base - works with localhost and remote access
// When accessed via nginx (port 80), use same origin. Otherwise use port 8000
const API_BASE = window.location.port === '' || window.location.port === '80'
  ? `${window.location.protocol}//${window.location.hostname}/api`
  : `${window.location.protocol}//${window.location.hostname}:8000/api`;

class ApiClient {
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      credentials: 'include', // Include cookies for session
      ...options,
    };

    try {
      console.log(`API Request: ${url}`);
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const errorMsg = error.detail || `HTTP ${response.status}: ${response.statusText}`;
        console.error(`API Error [${endpoint}]:`, errorMsg, error);
        throw new Error(errorMsg);
      }
      
      const data = await response.json();
      console.log(`API Success [${endpoint}]:`, data);
      return data;
    } catch (error) {
      // Network errors, CORS errors, etc.
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.error(`API Network Error [${endpoint}]:`, error);
        throw new Error(`Cannot connect to backend at ${API_BASE}. Make sure backend is running.`);
      }
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  // User Auth
  register = (email, password, name) => this.request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name })
  });
  
  login = (email, password) => this.request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  
  getMe = () => this.request('/auth/me');
  
  // OAuth
  getAuthStatus = () => this.request('/auth/status');
  getAuthUrl = (uri) => this.request(`/auth/url?redirect_uri=${encodeURIComponent(uri)}`);
  authCallback = (code, uri) => this.request('/auth/callback', {
    method: 'POST',
    body: JSON.stringify({ code, redirect_uri: uri })
  });
  logout = () => this.request('/auth/logout', { method: 'POST' });

  // Emails
  getEmails = (params = {}) => {
    const q = new URLSearchParams();
    if (params.category) q.set('category', params.category);
    if (params.search) q.set('search', params.search);
    if (params.limit) q.set('limit', params.limit);
    if (params.demo) q.set('demo', 'true');
    return this.request(`/emails${q.toString() ? `?${q}` : ''}`);
  };
  getEmail = (id) => this.request(`/emails/${id}`);
  syncEmails = (limit = 200) => this.request(`/emails/sync?limit=${limit}`, { method: 'POST' });
  loadDemoEmails = () => this.request('/emails/demo', { method: 'POST' });
  markEmailRead = (id, read = true) => this.request(`/emails/${id}/read?is_read=${read}`, { method: 'PATCH' });
  starEmail = (id, star = true) => this.request(`/emails/${id}/star?is_starred=${star}`, { method: 'PATCH' });
  updateEmailCategory = (id, cat) => this.request(`/emails/${id}/category?category=${cat}`, { method: 'PATCH' });
  deleteEmail = (id) => this.request(`/emails/${id}`, { method: 'DELETE' });
  sendEmail = (to, subject, body, replyToEmailId = null) => {
    return this.request('/emails/send', {
      method: 'POST',
      body: JSON.stringify({
        to: to.trim(),
        subject: subject.trim(),
        body: body.trim(),
        reply_to_email_id: replyToEmailId || null
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });
  };

  // Threaded Emails (Conversation View)
  getThreadedEmails = (params = {}) => {
    const q = new URLSearchParams();
    if (params.category) q.set('category', params.category);
    if (params.search) q.set('search', params.search);
    if (params.limit) q.set('limit', params.limit);
    if (params.demo) q.set('demo', 'true');
    return this.request(`/emails/threads${q.toString() ? `?${q}` : ''}`);
  };

  // Bulk Actions
  bulkAction = (emailIds, action, category = null) => {
    return this.request('/emails/bulk', {
      method: 'POST',
      body: JSON.stringify({
        email_ids: emailIds,
        action: action,
        category: category
      })
    });
  };

  // Advanced Search
  advancedSearch = (params = {}) => {
    const q = new URLSearchParams();
    if (params.q) q.set('q', params.q);
    if (params.sender) q.set('sender', params.sender);
    if (params.subject) q.set('subject', params.subject);
    if (params.hasAttachment !== undefined && params.hasAttachment !== null) q.set('has_attachment', params.hasAttachment);
    if (params.isStarred !== undefined && params.isStarred !== null) q.set('is_starred', params.isStarred);
    if (params.isRead !== undefined && params.isRead !== null) q.set('is_read', params.isRead);
    if (params.category) q.set('category', params.category);
    // Convert dates to ISO format for backend
    if (params.dateFrom && params.dateFrom.trim()) {
      q.set('date_from', new Date(params.dateFrom).toISOString());
    }
    if (params.dateTo && params.dateTo.trim()) {
      q.set('date_to', new Date(params.dateTo).toISOString());
    }
    if (params.limit) q.set('limit', params.limit);
    if (params.offset) q.set('offset', params.offset);
    return this.request(`/emails/search?${q.toString()}`);
  };

  // Drafts
  getDrafts = () => this.request('/drafts');
  saveDraft = (draft) => {
    return this.request('/drafts', {
      method: 'POST',
      body: JSON.stringify(draft)
    });
  };
  updateDraft = (draftId, draft) => {
    return this.request(`/drafts/${draftId}`, {
      method: 'PUT',
      body: JSON.stringify(draft)
    });
  };
  deleteDraft = (draftId) => this.request(`/drafts/${draftId}`, { method: 'DELETE' });

  // Labels
  getLabels = () => this.request('/labels');
  createLabel = (name, color, description = '') => {
    return this.request('/labels', {
      method: 'POST',
      body: JSON.stringify({ name, color, description })
    });
  };
  updateLabel = (labelId, name, color, description = '') => {
    return this.request(`/labels/${labelId}`, {
      method: 'PUT',
      body: JSON.stringify({ name, color, description })
    });
  };
  deleteLabel = (labelId) => this.request(`/labels/${labelId}`, { method: 'DELETE' });

  // AI Feedback
  submitCategoryFeedback = (emailId, correctedCategory) => {
    return this.request('/ai/feedback', {
      method: 'POST',
      body: JSON.stringify({
        email_id: emailId,
        corrected_category: correctedCategory
      })
    });
  };
  getFeedbackStats = () => this.request('/ai/feedback/stats');

  // Attachments
  uploadAttachment = async (file, emailId = null) => {
    const formData = new FormData();
    formData.append('file', file);
    if (emailId) formData.append('email_id', emailId);

    const response = await fetch(`${API_BASE}/attachments/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Upload failed');
    }
    return response.json();
  };

  getAttachment = (attachmentId) => this.request(`/attachments/${attachmentId}`);
  downloadAttachmentUrl = (attachmentId) => `${API_BASE}/attachments/${attachmentId}/download`;
  deleteAttachment = (attachmentId) => this.request(`/attachments/${attachmentId}`, { method: 'DELETE' });

  // Stats
  getStats = () => this.request('/stats');
}

export const api = new ApiClient();
export { API_BASE };
export default api;

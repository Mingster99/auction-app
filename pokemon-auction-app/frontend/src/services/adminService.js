import api from './api';

// Returns the short-lived admin token stored in localStorage (set after TOTP validation).
function adminTokenHeader() {
  const t = localStorage.getItem('admin_token');
  return t ? { 'X-Admin-Token': t } : {};
}

export const adminService = {
  // ── TOTP ────────────────────────────────────────────────────────────────
  setupTotp: async () => {
    const res = await api.get('/admin/totp/setup');
    return res.data;
  },

  activateTotp: async (code) => {
    const res = await api.post('/admin/totp/setup', { code });
    return res.data;
  },

  validateTotp: async (code) => {
    const res = await api.post('/admin/totp/validate', { code });
    if (res.data.admin_token) {
      localStorage.setItem('admin_token', res.data.admin_token);
    }
    return res.data;
  },

  clearAdminToken: () => localStorage.removeItem('admin_token'),

  // Returns true if admin_token exists and its admin_verified_at is < 1 h ago
  isTotpVerified: () => {
    const t = localStorage.getItem('admin_token');
    if (!t) return false;
    try {
      const payload = JSON.parse(atob(t.split('.')[1]));
      return payload.admin_verified_at && (Date.now() - payload.admin_verified_at < 3600 * 1000);
    } catch {
      return false;
    }
  },

  // ── Delivery dashboard ───────────────────────────────────────────────────
  getAllSales: async (params = {}) => {
    const res = await api.get('/admin/sales', { params });
    return res.data;
  },

  getAuditLog: async (params = {}) => {
    const res = await api.get('/admin/audit-log', { params });
    return res.data;
  },

  schedulePickup: async (id, pickup_note) => {
    const res = await api.post(`/admin/invoices/${id}/schedule-pickup`, { pickup_note }, { headers: adminTokenHeader() });
    return res.data;
  },

  scheduleBatchPickup: async (sellerId, pickup_note) => {
    const res = await api.post(`/admin/sellers/${sellerId}/schedule-pickup-batch`, { pickup_note }, { headers: adminTokenHeader() });
    return res.data;
  },

  confirmPickup: async (id) => {
    const res = await api.post(`/admin/invoices/${id}/confirm-pickup`, {}, { headers: adminTokenHeader() });
    return res.data;
  },

  confirmDelivery: async (id) => {
    const res = await api.post(`/admin/invoices/${id}/confirm-delivery`, {}, { headers: adminTokenHeader() });
    return res.data;
  },
};

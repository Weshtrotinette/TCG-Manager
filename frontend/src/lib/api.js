const API_URL = process.env.REACT_APP_BACKEND_URL;

class ApiClient {
  constructor() {
    this.baseUrl = `${API_URL}/api`;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const config = {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    if (options.body && typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, config);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Une erreur est survenue' }));
      throw new Error(error.detail || `HTTP error ${response.status}`);
    }

    return response.json();
  }

  // Dashboard
  getDashboard() {
    return this.request('/dashboard');
  }

  // Members
  getMembers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/members${query ? `?${query}` : ''}`);
  }

  getMember(memberId) {
    return this.request(`/members/${memberId}`);
  }

  createMember(data) {
    return this.request('/members', { method: 'POST', body: data });
  }

  updateMember(memberId, data) {
    return this.request(`/members/${memberId}`, { method: 'PUT', body: data });
  }

  archiveMember(memberId) {
    return this.request(`/members/${memberId}`, { method: 'DELETE' });
  }

  unarchiveMember(memberId) {
    return this.request(`/members/${memberId}/unarchive`, { method: 'PUT' });
  }

  // Subscriptions
  getSubscriptions(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/subscriptions${query ? `?${query}` : ''}`);
  }

  createSubscription(data) {
    return this.request('/subscriptions', { method: 'POST', body: data });
  }

  addPayment(subscriptionId, data) {
    return this.request(`/subscriptions/${subscriptionId}/payments`, { method: 'POST', body: data });
  }

  updateSubscription(subscriptionId, params) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/subscriptions/${subscriptionId}?${query}`, { method: 'PUT' });
  }

  deleteSubscription(subscriptionId) {
    return this.request(`/subscriptions/${subscriptionId}`, { method: 'DELETE' });
  }

  startNewSeason() {
    return this.request('/subscriptions/new-season', { method: 'POST' });
  }

  getSubscriptionArchives() {
    return this.request('/subscriptions/archives');
  }

  getSubscriptionArchive(season) {
    return this.request(`/subscriptions/archives/${encodeURIComponent(season)}`);
  }

  // Events
  getEvents(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/events${query ? `?${query}` : ''}`);
  }

  getEvent(eventId) {
    return this.request(`/events/${eventId}`);
  }

  createEvent(data) {
    return this.request('/events', { method: 'POST', body: data });
  }

  updateEvent(eventId, data) {
    return this.request(`/events/${eventId}`, { method: 'PUT', body: data });
  }

  deleteEvent(eventId) {
    return this.request(`/events/${eventId}`, { method: 'DELETE' });
  }

  // Participations
  addParticipation(data) {
    return this.request('/participations', { method: 'POST', body: data });
  }

  updateParticipation(participationId, data) {
    const query = new URLSearchParams(data).toString();
    return this.request(`/participations/${participationId}?${query}`, { method: 'PUT' });
  }

  removeParticipation(participationId) {
    return this.request(`/participations/${participationId}`, { method: 'DELETE' });
  }

  // Products
  getProducts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/products${query ? `?${query}` : ''}`);
  }

  getProduct(productId) {
    return this.request(`/products/${productId}`);
  }

  createProduct(data) {
    return this.request('/products', { method: 'POST', body: data });
  }

  updateProduct(productId, data) {
    return this.request(`/products/${productId}`, { method: 'PUT', body: data });
  }

  restockProduct(productId, data) {
    return this.request(`/products/${productId}/restock`, { method: 'POST', body: data });
  }

  deleteProduct(productId) {
    return this.request(`/products/${productId}`, { method: 'DELETE' });
  }

  deleteProductImage(productId) {
    return this.request(`/products/${productId}/image`, { method: 'DELETE' });
  }

  async uploadProductImage(productId, file) {
    const url = `${this.baseUrl}/products/${productId}/upload-image`;
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Erreur upload' }));
      throw new Error(error.detail || `HTTP error ${response.status}`);
    }
    return response.json();
  }

  // Sales
  getSales(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/sales${query ? `?${query}` : ''}`);
  }

  createSale(data) {
    return this.request('/sales', { method: 'POST', body: data });
  }

  cancelSale(saleId) {
    return this.request(`/sales/${saleId}/cancel`, { method: 'PUT' });
  }

  // Expenses
  getExpenses(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/expenses${query ? `?${query}` : ''}`);
  }

  createExpense(data) {
    return this.request('/expenses', { method: 'POST', body: data });
  }

  updateExpense(expenseId, data) {
    return this.request(`/expenses/${expenseId}`, { method: 'PUT', body: data });
  }

  deleteExpense(expenseId) {
    return this.request(`/expenses/${expenseId}`, { method: 'DELETE' });
  }

  // Reports
  getFinancialReport(year) {
    const query = year ? `?year=${year}` : '';
    return this.request(`/reports/financial${query}`);
  }

  getMembersReport() {
    return this.request('/reports/members');
  }

  // Settings
  getSettings() {
    return this.request('/settings');
  }

  updateSettings(data) {
    return this.request('/settings', { method: 'PUT', body: data });
  }

  // Users
  getUsers() {
    return this.request('/users');
  }

  updateUserRoles(userId, roles) {
    return this.request(`/users/${userId}/roles`, { method: 'PUT', body: roles });
  }

  updateUserStatus(userId, isActive) {
    return this.request(`/users/${userId}/status?is_active=${isActive}`, { method: 'PUT' });
  }

  // Roles
  getRoles() {
    return this.request('/roles');
  }

  createRole(data) {
    return this.request('/roles', { method: 'POST', body: data });
  }

  updateRole(roleId, data) {
    return this.request(`/roles/${roleId}`, { method: 'PUT', body: data });
  }

  deleteRole(roleId) {
    return this.request(`/roles/${roleId}`, { method: 'DELETE' });
  }

  // Permissions
  getPermissions() {
    return this.request('/permissions');
  }

  // Audit Logs
  getAuditLogs(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/audit-logs${query ? `?${query}` : ''}`);
  }

  // Whitelist
  getWhitelist() {
    return this.request('/whitelist');
  }

  addToWhitelist(data) {
    return this.request('/whitelist', { method: 'POST', body: data });
  }

  addBulkToWhitelist(emails) {
    return this.request('/whitelist/bulk', { method: 'POST', body: emails });
  }

  removeFromWhitelist(email) {
    return this.request(`/whitelist/${encodeURIComponent(email)}`, { method: 'DELETE' });
  }

  // Tournaments
  getTournamentByEvent(eventId) {
    return this.request(`/tournaments/event/${eventId}`);
  }

  createTournament(data) {
    return this.request('/tournaments', { method: 'POST', body: data });
  }

  updateMatchResult(tournamentId, matchId, data) {
    return this.request(`/tournaments/${tournamentId}/match/${matchId}`, { method: 'PUT', body: data });
  }

  generateNextRound(tournamentId) {
    return this.request(`/tournaments/${tournamentId}/next-round`, { method: 'POST' });
  }

  deleteTournament(tournamentId) {
    return this.request(`/tournaments/${tournamentId}`, { method: 'DELETE' });
  }

  // Snack Cards
  getSnackCards(activeOnly = true) {
    return this.request(`/snack-cards?active_only=${activeOnly}`);
  }

  deductSnackCard(cardId, amount) {
    return this.request(`/snack-cards/${cardId}/deduct?amount=${amount}`, { method: 'POST' });
  }

  // Pack Tournois
  getMemberPackTournois(memberId) {
    return this.request(`/members/${memberId}/pack-tournois`);
  }

  usePackTournois(memberId) {
    return this.request(`/members/${memberId}/use-pack-tournois`, { method: 'POST' });
  }

  removePackTournois(memberId) {
    return this.request(`/members/${memberId}/pack-tournois`, { method: 'DELETE' });
  }

  removeMemberSnackCards(memberId) {
    return this.request(`/members/${memberId}/snack-cards`, { method: 'DELETE' });
  }

  createSnackCardDirect(memberId) {
    return this.request(`/snack-cards?member_id=${memberId}`, { method: 'POST' });
  }

  resetFinancialData() {
    return this.request('/admin/reset-financial-data', { method: 'POST' });
  }
}

export const api = new ApiClient();

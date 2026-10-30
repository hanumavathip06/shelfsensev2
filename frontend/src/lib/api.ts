import api from './axios';

// Analytics
export const getSummary = async () => (await api.get('/analytics/summary')).data;
export const getTrends = async (days = 30) => (await api.get(`/analytics/trends?days=${days}`)).data;
export const getTopProducts = async (by = 'value') => (await api.get(`/analytics/top-products?by=${by}`)).data;
export const getCategoryStock = async () => (await api.get('/analytics/category-stock')).data;
export const getAbcXyzClassification = async () => (await api.get('/analytics/abc-xyz')).data;
export const getAnomalies = async (days = 90) => (await api.get(`/analytics/anomalies?days=${days}`)).data;

// Products
export const getProducts = async (params: { page?: number; limit?: number; q?: string; category_id?: number; low_stock?: boolean }) => 
  (await api.get('/products', { params })).data;
export const createProduct = async (data: any) => (await api.post('/products', data)).data;
export const updateProduct = async ({ id, data }: { id: number; data: any }) => (await api.put(`/products/${id}`, data)).data;
export const deleteProduct = async (id: number) => (await api.delete(`/products/${id}`)).data;
export const adjustStock = async ({ id, data }: { id: number; data: { change_qty: number; reason: string } }) => 
  (await api.post(`/products/${id}/movements`, data)).data;

// Categories
export const getCategories = async () => (await api.get('/categories?limit=100')).data;

// Alerts & Notifications
export const getRestockAlerts = async () => (await api.get('/restock-alerts')).data;
export const getNotifications = async (params: { page?: number; limit?: number }) => (await api.get('/notifications', { params })).data;
export const markNotificationRead = async (id: number) => (await api.patch(`/notifications/${id}`, { is_read: true })).data;

// Users
export const getUsers = async (params: { page?: number; limit?: number }) => (await api.get('/users', { params })).data;
export const createUser = async (data: any) => (await api.post('/users', data)).data;
export const deleteUser = async (id: number) => (await api.delete(`/users/${id}`)).data;
export const updateUserRole = async ({ id, role }: { id: number; role: string }) => (await api.put(`/users/${id}`, { role })).data;
export const getLocations = async () => (await api.get('/admin/locations')).data;

// Forecast (ML)
export const getForecast = async (productId: number, horizon = 30, model = 'ensemble') =>
  (await api.get(`/forecast/${productId}?horizon=${horizon}&model=${model}`)).data;
export const compareModels = async (productId: number) =>
  (await api.get(`/forecast/${productId}/compare`)).data;
export const trainModels = async (productId: number, horizon = 30) =>
  (await api.post(`/forecast/${productId}/train`, { horizon })).data;

// Smart Reorder
export const getSmartReorderAll = async () => (await api.get('/smart-reorder')).data;
export const getSmartReorder = async (productId: number) =>
  (await api.get(`/smart-reorder/${productId}`)).data;

// Staff Phase B
export const getMyTasks = async () => (await api.get('/staff/tasks')).data;
export const updateTaskStatus = async (taskId: number, status: string) => 
  (await api.put(`/staff/tasks/${taskId}/status`, { status })).data;
export const recordStockMovement = async (data: any) => 
  (await api.post('/staff/stock-movements', data)).data;
export const createCycleCount = async (data: any) => 
  (await api.post('/staff/cycle-counts', data)).data;
export const reportIssue = async (data: any) => 
  (await api.post('/staff/issues', data)).data;
export const getMyActivity = async () => (await api.get('/staff/activity')).data;
export const getLowStockLocation = async () => (await api.get('/staff/low-stock')).data;

// Manager Phase C
export const getApprovals = async () => (await api.get('/manager/approvals')).data;
export const approveItem = async ({ type, id, reason }: { type: string, id: number, reason: string }) => 
  (await api.post(`/manager/approvals/${type}/${id}/approve`, { reason })).data;
export const rejectItem = async ({ type, id, reason }: { type: string, id: number, reason: string }) => 
  (await api.post(`/manager/approvals/${type}/${id}/reject`, { reason })).data;
export const getSuppliers = async () => (await api.get('/manager/suppliers')).data;
export const createSupplier = async (data: any) => (await api.post('/manager/suppliers', data)).data;
export const updateSupplier = async (id: number, data: any) => (await api.put(`/manager/suppliers/${id}`, data)).data;
export const deleteSupplier = async (id: number) => (await api.delete(`/manager/suppliers/${id}`)).data;
export const updateReorderSettings = async (plId: number, data: any) => (await api.put(`/manager/reorder-settings/${plId}`, data)).data;
export const getReorderHistory = async (plId: number) => (await api.get(`/manager/reorder-settings/history/${plId}`)).data;
export const getTeamActivity = async () => (await api.get('/manager/team/activity')).data;
export const assignTask = async (data: any) => (await api.post('/manager/team/tasks', data)).data;
export const getDiscrepancies = async () => (await api.get('/manager/discrepancies')).data;
export const acceptDiscrepancy = async (id: number, data: any) => (await api.post(`/manager/discrepancies/${id}/accept`, data)).data;
export const dismissDiscrepancy = async (id: number, reason: string) => (await api.post(`/manager/discrepancies/${id}/dismiss`, { reason })).data;

// Admin Phase D
export const updateUser = async (id: number, data: any) => (await api.put(`/users/${id}`, data)).data;
export const revokeUserSessions = async (id: number) => (await api.post(`/users/${id}/revoke-sessions`)).data;
export const getSystemSettings = async () => (await api.get('/admin/settings')).data;
export const updateSystemSettings = async (data: any) => (await api.put('/admin/settings', data)).data;
export const getAuditLogs = async (params: any) => (await api.get('/admin/audit-logs', { params })).data;
export const getJobs = async () => (await api.get('/admin/jobs')).data;
export const retryJob = async (id: number) => (await api.post(`/admin/jobs/${id}/retry`)).data;
export const getSecurityStats = async () => (await api.get('/admin/security')).data;
export const unlockUser = async (id: number) => (await api.post(`/admin/security/unlock/${id}`)).data;
export const getRolesPermissions = async () => (await api.get('/admin/roles-permissions')).data;

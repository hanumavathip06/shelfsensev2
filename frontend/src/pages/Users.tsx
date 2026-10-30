import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { UserPlus, Trash2 } from 'lucide-react';
import { getUsers, updateUser, revokeUserSessions, createUser, deleteUser, getLocations } from '../lib/api';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { DataTable } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { RolesPermissions } from './RolesPermissions';
import { Security } from './Security';
import { useAuth } from '../contexts/AuthContext';

export function Users() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'security'>('users');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => getUsers({ limit: 100 }),
  });

  const { data: locationsData } = useQuery({
    queryKey: ['admin-locations'],
    queryFn: getLocations,
  });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User created successfully');
      setIsAddModalOpen(false);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error?.message || err.response?.data?.error || err.response?.data?.message || 'Failed to create user';
      toast.error(typeof msg === 'string' ? msg : 'Failed to create user');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User updated successfully');
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Failed to update user'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User deleted successfully');
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Failed to delete user'),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: number) => revokeUserSessions(id),
    onSuccess: () => toast.success('Sessions revoked'),
    onError: () => toast.error('Failed to revoke sessions'),
  });

  const handleCreateUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const locId = formData.get('location_id');
    const payload = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      role: formData.get('role') as string,
      location_id: locId ? Number(locId) : null,
    };
    createMutation.mutate(payload);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-primary">User Management</h1>
          <p className="text-secondary text-sm mt-1">Manage team members, roles, permissions and account access</p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === 'users' && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-accent/90 transition-colors"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Add User
            </button>
          )}
          <div className="flex bg-surface border border-border p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'users' ? 'bg-primary text-surface' : 'text-secondary hover:text-primary'}`}
            >
              Users
            </button>
            <button
              onClick={() => setActiveTab('roles')}
              className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'roles' ? 'bg-primary text-surface' : 'text-secondary hover:text-primary'}`}
            >
              Roles & Permissions
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'security' ? 'bg-primary text-surface' : 'text-secondary hover:text-primary'}`}
            >
              Security
            </button>
          </div>
        </div>
      </div>
      
      {activeTab === 'users' && (
        <div className="w-full">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : usersData?.items?.length === 0 ? (
            <EmptyState title="No users found" description="Click 'Add User' above to add staff, managers, or admins." />
          ) : (
            <DataTable headers={['Name', 'Email', 'Role', 'Location', 'Status', 'Actions']}>
              {usersData?.items?.map((user: any) => {
                const assignedLocation = locationsData?.find((l: any) => l.id === user.location_id);
                return (
                  <tr key={user.id} className="hover:bg-background/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary">
                      {user.name}
                      {user.id === currentUser?.id && (
                        <span className="ml-2 text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded font-mono">You</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-secondary">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary">
                      <select
                        value={user.role}
                        onChange={(e) => updateMutation.mutate({ id: user.id, data: { role: e.target.value } })}
                        disabled={updateMutation.isPending}
                        className="px-3 py-1.5 rounded-md border border-border bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-accent font-sans text-xs uppercase tracking-widest font-bold shadow-sm"
                      >
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="staff">Staff</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary">
                      {assignedLocation ? assignedLocation.name : <span className="text-secondary/60 italic">All / None</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary">
                      <button
                        onClick={() => updateMutation.mutate({ id: user.id, data: { is_active: !user.is_active } })}
                        className={`px-2 py-1 rounded text-xs font-bold ${user.is_active ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}
                      >
                        {user.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary space-x-2">
                      <button 
                        onClick={() => updateMutation.mutate({ id: user.id, data: { needs_password_reset: true } })}
                        className="text-accent hover:underline text-xs"
                      >
                        Force PW Reset
                      </button>
                      <button 
                        onClick={() => revokeMutation.mutate(user.id)}
                        className="text-secondary hover:text-primary hover:underline text-xs"
                      >
                        Revoke Sessions
                      </button>
                      {user.id !== currentUser?.id && (
                        <button 
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete user "${user.name}" (${user.email})?`)) {
                              deleteMutation.mutate(user.id);
                            }
                          }}
                          className="text-danger hover:text-danger/80 p-1 rounded inline-flex items-center ml-1"
                          title="Delete User"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </div>
      )}

      {activeTab === 'roles' && <RolesPermissions />}
      {activeTab === 'security' && <Security />}

      {/* Add User Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New User"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary mb-1">Full Name</label>
            <input
              name="name"
              type="text"
              required
              placeholder="e.g. Alex Morgan"
              className="w-full px-3 py-2 rounded-md border border-border bg-surface text-primary placeholder:text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-1">Work Email</label>
            <input
              name="email"
              type="email"
              required
              placeholder="e.g. alex@shelfsense.com"
              className="w-full px-3 py-2 rounded-md border border-border bg-surface text-primary placeholder:text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent sm:text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-1">Password</label>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              placeholder="Minimum 6 characters"
              className="w-full px-3 py-2 rounded-md border border-border bg-surface text-primary placeholder:text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent sm:text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Role</label>
              <select
                name="role"
                defaultValue="staff"
                className="w-full px-3 py-2 rounded-md border border-border bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-accent sm:text-sm"
              >
                <option value="staff">Staff (Operations)</option>
                <option value="manager">Manager (Oversight & Analytics)</option>
                <option value="admin">Admin (Full System)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary mb-1">Store / Location</label>
              <select
                name="location_id"
                defaultValue=""
                className="w-full px-3 py-2 rounded-md border border-border bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-accent sm:text-sm"
              >
                <option value="">None / All Locations</option>
                {locationsData?.map((loc: any) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 border border-border rounded-md text-sm text-secondary hover:text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent/90 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

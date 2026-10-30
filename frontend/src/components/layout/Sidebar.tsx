import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, AlertTriangle, BarChart3, Users, Brain, Zap, Grid3X3, UploadCloud, Settings } from 'lucide-react';
import { useAuth, Permission } from '../../contexts/AuthContext';
import React from 'react';

type Role = 'admin' | 'manager' | 'staff';

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  requiredPermission: Permission;
  section?: 'main' | 'ai' | 'admin';
  visibleToRoles?: Role[]; // If undefined, visible to any role with the requiredPermission
};

import { FEATURE_FLAGS } from '../../lib/features';

const NAV_CONFIG: NavItem[] = [
  // ── Main ──
  { label: 'Dashboard', href: '/', icon: LayoutDashboard, requiredPermission: Permission.DASHBOARD_VIEW, section: 'main' },
  { label: 'Inventory', href: '/inventory', icon: Package, requiredPermission: Permission.INVENTORY_VIEW, section: 'main' },
  { label: 'Stock Movements', href: '/movements', icon: Package, requiredPermission: Permission.MOVEMENT_RECORD, section: 'main', visibleToRoles: ['manager', 'staff'] },
  
  // ── Staff-only items ──
  { label: 'Low Stock', href: '/low-stock', icon: AlertTriangle, requiredPermission: Permission.DASHBOARD_VIEW, section: 'main', visibleToRoles: ['staff'] },
  { label: 'Report Issue', href: '/report-issue', icon: AlertTriangle, requiredPermission: Permission.DASHBOARD_VIEW, section: 'main', visibleToRoles: ['staff'] },
  ...(FEATURE_FLAGS.ENABLE_MY_TASKS ? [{ label: 'My Tasks', href: '/my-tasks', icon: Package, requiredPermission: Permission.MOVEMENT_RECORD, section: 'main' as const, visibleToRoles: ['staff'] as Role[] }] : []),

  // ── Manager items ──
  ...(FEATURE_FLAGS.ENABLE_APPROVALS ? [{ label: 'Approvals', href: '/approvals', icon: AlertTriangle, requiredPermission: Permission.ORDERS_APPROVE, section: 'main' as const, visibleToRoles: ['manager'] as Role[] }] : []),
  ...(FEATURE_FLAGS.ENABLE_PURCHASE_ORDERS ? [{ label: 'Purchase Orders', href: '/purchase-orders', icon: Package, requiredPermission: Permission.ORDERS_VIEW, section: 'main' as const, visibleToRoles: ['manager'] as Role[] }] : []),
  ...(FEATURE_FLAGS.ENABLE_SUPPLIERS ? [{ label: 'Suppliers', href: '/suppliers', icon: Users, requiredPermission: Permission.SETTINGS_EDIT, section: 'main' as const, visibleToRoles: ['manager'] as Role[] }] : []),
  { label: 'Reports', href: '/reports', icon: BarChart3, requiredPermission: Permission.REPORTS_VIEW, section: 'main', visibleToRoles: ['manager'] },

  // ── AI & Analytics (Manager only) ──
  { label: 'AI Forecast', href: '/forecast', icon: Brain, requiredPermission: Permission.FORECAST_VIEW, section: 'ai', visibleToRoles: ['manager'] },
  { label: 'Smart Reorder', href: '/smart-reorder', icon: Zap, requiredPermission: Permission.FORECAST_VIEW, section: 'ai', visibleToRoles: ['manager'] },
  { label: 'Classification', href: '/classification', icon: Grid3X3, requiredPermission: Permission.FORECAST_VIEW, section: 'ai', visibleToRoles: ['manager'] },

  // ── Administration (Admin only) ──
  { label: 'Users', href: '/users', icon: Users, requiredPermission: Permission.USERS_MANAGE, section: 'admin', visibleToRoles: ['admin'] },
  { label: 'System Settings', href: '/system-settings', icon: Settings, requiredPermission: Permission.SYSTEM_SETTINGS_EDIT, section: 'admin', visibleToRoles: ['admin'] },
  { label: 'Audit Log', href: '/audit-log', icon: UploadCloud, requiredPermission: Permission.AUDIT_LOG_VIEW, section: 'admin', visibleToRoles: ['admin'] },
  { label: 'Stores & Locations', href: '/locations', icon: Zap, requiredPermission: Permission.SYSTEM_SETTINGS_EDIT, section: 'admin', visibleToRoles: ['admin'] },
];

export function Sidebar() {
  const location = useLocation();
  const { hasPermission, role } = useAuth();
  
  const allowedNav = NAV_CONFIG.filter(item => {
    // Check permission first
    if (!hasPermission(item.requiredPermission)) return false;
    
    // Check role restrictions if defined
    if (item.visibleToRoles && role) {
      if (!item.visibleToRoles.includes(role as Role)) return false;
    }
    
    return true;
  });
  
  const mainNav = allowedNav.filter(item => item.section === 'main');
  const aiNav = allowedNav.filter(item => item.section === 'ai');
  const adminNav = allowedNav.filter(item => item.section === 'admin');

  const renderLinks = (items: NavItem[]) => items.map(item => {
    const isActive = location.pathname === item.href;
    return (
      <Link
        key={item.label}
        to={item.href}
        className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${
          isActive
            ? 'bg-accent/10 text-accent'
            : 'text-secondary hover:bg-background hover:text-primary'
        }`}
      >
        <item.icon
          className={`mr-3 h-5 w-5 flex-shrink-0 ${
            isActive ? 'text-accent' : 'text-secondary group-hover:text-primary'
          }`}
          aria-hidden="true"
        />
        {item.label}
      </Link>
    );
  });

  return (
    <div className="flex h-full w-64 flex-col border-r border-border bg-surface">
      <div className="flex h-16 items-center px-6 border-b border-border">
        <h1 className="text-xl font-bold text-primary">ShelfSense</h1>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {renderLinks(mainNav)}

        {aiNav.length > 0 && (
          <div className="pt-4 mt-4 border-t border-border">
            <p className="px-3 mb-2 text-xs font-semibold text-secondary uppercase tracking-wider">
              AI & Analytics
            </p>
            {renderLinks(aiNav)}
          </div>
        )}

        {adminNav.length > 0 && (
          <div className="pt-4 mt-4 border-t border-border">
            <p className="px-3 mb-2 text-xs font-semibold text-secondary uppercase tracking-wider">
              Administration
            </p>
            {renderLinks(adminNav)}
          </div>
        )}
      </nav>
    </div>
  );
}

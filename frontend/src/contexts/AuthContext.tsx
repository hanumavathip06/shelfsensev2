import React, { createContext, useContext, useState, useEffect } from 'react';

export enum Permission {
  DASHBOARD_VIEW = "dashboard.view",
  INVENTORY_VIEW = "inventory.view",
  INVENTORY_VIEW_COST = "inventory.view_cost",
  INVENTORY_EDIT = "inventory.edit",
  MOVEMENT_RECORD = "movement.record",
  ORDERS_VIEW = "orders.view",
  ORDERS_APPROVE = "orders.approve",
  ORDERS_RECEIVE = "orders.receive",
  ALERTS_VIEW = "alerts.view",
  REPORTS_VIEW = "reports.view",
  USERS_MANAGE = "users.manage",
  SETTINGS_EDIT = "settings.edit",
  IMPORTS_EXECUTE = "imports.execute",
  FORECAST_VIEW = "forecast.view",
  FORECAST_EDIT = "forecast.edit",
  SYSTEM_SETTINGS_EDIT = "system_settings.edit",
  AUDIT_LOG_VIEW = "audit_log.view",
  JOBS_MANAGE = "jobs.manage",
  SECURITY_MANAGE = "security.manage"
}

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: Object.values(Permission),
  manager: [
    Permission.DASHBOARD_VIEW,
    Permission.INVENTORY_VIEW,
    Permission.INVENTORY_VIEW_COST,
    Permission.INVENTORY_EDIT,
    Permission.MOVEMENT_RECORD,
    Permission.ORDERS_VIEW,
    Permission.ORDERS_APPROVE,
    Permission.ORDERS_RECEIVE,
    Permission.ALERTS_VIEW,
    Permission.REPORTS_VIEW,
    Permission.FORECAST_VIEW,
    Permission.FORECAST_EDIT,
    Permission.IMPORTS_EXECUTE
  ],
  staff: [
    Permission.DASHBOARD_VIEW,
    Permission.INVENTORY_VIEW,
    Permission.MOVEMENT_RECORD,
    Permission.ORDERS_RECEIVE
  ]
};

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'staff';
}

interface AuthContextType {
  user: User | null;
  role: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  hasPermission: (permission: Permission) => boolean;
}

import api from '../lib/axios';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    if (storedUser && storedToken) {
      return JSON.parse(storedUser);
    }
    return null;
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    api.get('/auth/me')
      .then((res) => {
        if (res.data?.user) {
          const freshUser = res.data.user;
          setUser((prev) => {
            if (!prev || prev.role !== freshUser.role || prev.name !== freshUser.name || prev.email !== freshUser.email) {
              localStorage.setItem('user', JSON.stringify(freshUser));
              return freshUser;
            }
            return prev;
          });
        }
      })
      .catch((err) => {
        console.error('Failed to sync auth user profile:', err);
      });
  }, []);

  const login = (token: string, userData: User) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/login';
  };

  const hasPermission = (permission: Permission) => {
    if (!user) return false;
    const perms = ROLE_PERMISSIONS[user.role] || [];
    return perms.includes(permission);
  };

  return (
    <AuthContext.Provider value={{ user, role: user?.role || null, login, logout, isAuthenticated: !!user, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};


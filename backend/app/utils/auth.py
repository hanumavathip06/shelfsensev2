from functools import wraps
from flask_jwt_extended import get_jwt, verify_jwt_in_request, get_jwt_identity
from app.utils.errors import api_error
from enum import Enum

class Permission(Enum):
    DASHBOARD_VIEW = "dashboard.view"
    INVENTORY_VIEW = "inventory.view"
    INVENTORY_VIEW_COST = "inventory.view_cost"
    INVENTORY_EDIT = "inventory.edit"
    MOVEMENT_RECORD = "movement.record"
    ORDERS_VIEW = "orders.view"
    ORDERS_APPROVE = "orders.approve"
    ORDERS_RECEIVE = "orders.receive"
    ALERTS_VIEW = "alerts.view"
    REPORTS_VIEW = "reports.view"
    USERS_MANAGE = "users.manage"
    SETTINGS_EDIT = "settings.edit"
    IMPORTS_EXECUTE = "imports.execute"
    FORECAST_VIEW = "forecast.view"
    FORECAST_EDIT = "forecast.edit"
    SYSTEM_SETTINGS_EDIT = "system_settings.edit"
    AUDIT_LOG_VIEW = "audit_log.view"
    JOBS_MANAGE = "jobs.manage"
    SECURITY_MANAGE = "security.manage"

ROLE_PERMISSIONS = {
    'admin': set(Permission), # Admin has all permissions
    'manager': {
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
    },
    'staff': {
        Permission.DASHBOARD_VIEW,
        Permission.INVENTORY_VIEW,
        Permission.MOVEMENT_RECORD,
        Permission.ORDERS_RECEIVE
    }
}

def has_permission(role, permission):
    permissions = ROLE_PERMISSIONS.get(role, set())
    return permission in permissions

import inspect

def requires_permission(permission: Permission):
    def wrapper(fn):
        sig = inspect.signature(fn)
        wants_current_user = 'current_user' in sig.parameters

        @wraps(fn)
        def decorator(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            
            from app.models import User
            user_id = get_jwt_identity()
            user = User.query.get(int(user_id)) if user_id else None
            if not user or not user.is_active:
                return api_error("User not found or account deactivated.", 401)
                
            # Check session revocation if session_version is in token
            token_session_version = claims.get('session_version')
            if token_session_version is not None and user.session_version != token_session_version:
                return api_error("Session expired, revoked, or account deactivated.", 401)
            
            user_role = user.role or claims.get('role', 'staff')
            if not has_permission(user_role, permission):
                return api_error(f"Forbidden: requires {permission.name}", 403)
            
            if wants_current_user:
                kwargs['current_user'] = user
                    
            return fn(*args, **kwargs)
        return decorator
    return wrapper

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from werkzeug.security import generate_password_hash
from app.models import User
from app.schemas import user_schema, users_schema
from app.extensions import db
from app.utils.auth import requires_permission, Permission
from app.utils.errors import api_error

users_bp = Blueprint('users', __name__)

@users_bp.route('', methods=['GET'])
@jwt_required()
@requires_permission(Permission.USERS_MANAGE)
def get_users():
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 10, type=int)
    pagination = User.query.paginate(page=page, per_page=limit, error_out=False)
    
    # We will build a manual dump to include the new fields since user_schema might not have them
    items = []
    for u in pagination.items:
        items.append({
            'id': u.id, 'name': u.name, 'email': u.email, 'role': u.role, 
            'location_id': u.location_id, 'is_active': u.is_active,
            'needs_password_reset': u.needs_password_reset,
            'two_factor_enabled': u.two_factor_enabled,
            'locked_until': u.locked_until.isoformat() if u.locked_until else None,
            'failed_login_attempts': u.failed_login_attempts
        })
        
    return jsonify({
        'items': items,
        'total': pagination.total,
        'page': pagination.page,
        'pages': pagination.pages
    })

@users_bp.route('/<int:id>', methods=['GET'])
@jwt_required()
@requires_permission(Permission.USERS_MANAGE)
def get_user(id):
    user = User.query.get(id)
    if not user:
        return api_error("User not found", 404)
    return jsonify(user_schema.dump(user))

@users_bp.route('', methods=['POST'])
@jwt_required()
@requires_permission(Permission.USERS_MANAGE)
def create_user():
    data = request.get_json() or {}
    errors = user_schema.validate(data)
    if errors:
        return api_error(str(errors), 400)
    
    if not data.get('password'):
        return api_error("Password is required", 400)
        
    email = data['email'].strip().lower()
    if User.query.filter_by(email=email).first():
        return api_error("Email already registered", 409)

    user = User(
        name=data['name'].strip(),
        email=email,
        password_hash=generate_password_hash(data['password']),
        role=data.get('role', 'staff'),
        location_id=data.get('location_id') or None,
        is_active=True
    )
    db.session.add(user)
    db.session.commit()
    return jsonify({
        'id': user.id,
        'name': user.name,
        'email': user.email,
        'role': user.role,
        'location_id': user.location_id,
        'is_active': user.is_active
    }), 201

@users_bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
@requires_permission(Permission.USERS_MANAGE)
def update_user(id):
    from flask_jwt_extended import current_user as jwt_user
    user = User.query.get(id)
    if not user:
        return api_error("User not found", 404)
        
    data = request.get_json()

    if 'email' in data:
        existing = User.query.filter_by(email=data['email']).first()
        if existing and existing.id != id:
            return api_error("Email already exists", 409)
        user.email = data['email']
        
    if 'name' in data: user.name = data['name']
    
    # Last admin protection
    is_demoting = 'role' in data and data['role'] != 'admin' and user.role == 'admin'
    is_deactivating = 'is_active' in data and data['is_active'] is False and user.role == 'admin'
    if is_demoting or is_deactivating:
        admin_count = User.query.filter_by(role='admin', is_active=True).count()
        if admin_count <= 1:
            return api_error("Cannot demote or deactivate the last remaining active Admin", 400)
            
    if 'role' in data: user.role = data['role']
    if 'is_active' in data: user.is_active = data['is_active']
    if 'location_id' in data: user.location_id = data['location_id']
    if 'needs_password_reset' in data: user.needs_password_reset = data['needs_password_reset']
    
    if 'password' in data and data['password']: 
        user.password_hash = generate_password_hash(data['password'])

    db.session.commit()
    
    from app.models import AuditLog
    from flask_jwt_extended import get_jwt_identity
    log = AuditLog(
        user_id=get_jwt_identity(),
        action='update_user',
        target_resource='users',
        target_id=user.id,
        details=f"Updated user #{user.id}. Role: {user.role}, Active: {user.is_active}"
    )
    db.session.add(log)
    db.session.commit()
    
    return jsonify({'status': 'success', 'id': user.id})

@users_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
@requires_permission(Permission.USERS_MANAGE)
def delete_user(id):
    user = User.query.get(id)
    if not user:
        return api_error("User not found", 404)
    db.session.delete(user)
    db.session.commit()
    return '', 204

@users_bp.route('/<int:id>/revoke-sessions', methods=['POST'])
@jwt_required()
@requires_permission(Permission.USERS_MANAGE)
def revoke_sessions(id):
    user = User.query.get(id)
    if not user:
        return api_error("User not found", 404)
        
    user.session_version += 1
    db.session.commit()
    
    from app.models import AuditLog
    from flask_jwt_extended import get_jwt_identity
    log = AuditLog(
        user_id=get_jwt_identity(),
        action='revoke_sessions',
        target_resource='users',
        target_id=user.id,
        details=f"Revoked sessions for user #{user.id}"
    )
    db.session.add(log)
    db.session.commit()
    
    return jsonify({'status': 'success'})

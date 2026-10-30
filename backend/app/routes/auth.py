import os
from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from app.models import User, AuditLog
from app.extensions import db

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/bootstrap', methods=['POST'])
def bootstrap():
    data = request.get_json()
    token = data.get('token')
    
    expected_token = os.environ.get('BOOTSTRAP_TOKEN')
    if not expected_token or token != expected_token:
        return jsonify({'error': 'Invalid or missing bootstrap token'}), 403
        
    if User.query.filter_by(role='admin').first():
        return jsonify({'error': 'System is already bootstrapped'}), 400
        
    if not data.get('email') or not data.get('password') or not data.get('name'):
        return jsonify({'error': 'Missing required fields'}), 400
        
    admin_user = User(
        name=data['name'],
        email=data['email'],
        password_hash=generate_password_hash(data['password']),
        role='admin'
    )
    
    db.session.add(admin_user)
    db.session.commit()
    
    return jsonify({'message': 'Admin user bootstrapped successfully'}), 201

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password') or not data.get('name'):
        return jsonify({'error': 'Missing required fields'}), 400

    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already registered'}), 409

    role = data.get('role', 'staff') # Default to staff for now

    new_user = User(
        name=data['name'],
        email=data['email'],
        password_hash=generate_password_hash(data['password']),
        role=role
    )

    db.session.add(new_user)
    db.session.commit()

    return jsonify({'message': 'User registered successfully'}), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Missing email or password'}), 400

    email = data['email'].strip().lower()
    user = User.query.filter_by(email=email).first()

    if not user:
        return jsonify({'error': 'Invalid credentials'}), 401
        
    if not user.is_active:
        return jsonify({'error': 'Account deactivated'}), 403
        
    from datetime import datetime, timezone
    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        return jsonify({'error': 'Account locked'}), 403

    if not check_password_hash(user.password_hash, data['password']):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= 5:
            from datetime import timedelta
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=15)
        db.session.commit()
        return jsonify({'error': 'Invalid credentials'}), 401

    user.failed_login_attempts = 0
    
    # Audit log login
    audit = AuditLog(user_id=user.id, action='login', ip_address=request.remote_addr)
    db.session.add(audit)
    db.session.commit()
    
    additional_claims = {'role': user.role, 'session_version': user.session_version}
    access_token = create_access_token(identity=str(user.id), additional_claims=additional_claims)
    refresh_token = create_refresh_token(identity=str(user.id), additional_claims=additional_claims)

    return jsonify({
        'access_token': access_token,
        'refresh_token': refresh_token,
        'user': {
            'id': user.id,
            'name': user.name,
            'email': user.email,
            'role': user.role
        }
    }), 200

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id)) if user_id else None
    if not user or not user.is_active:
        return jsonify({'error': 'User not found or inactive'}), 401
    return jsonify({
        'user': {
            'id': user.id,
            'name': user.name,
            'email': user.email,
            'role': user.role
        }
    }), 200


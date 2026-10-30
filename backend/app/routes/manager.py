from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, current_user
from app.utils.auth import requires_permission, Permission
from app.models import (
    PurchaseOrder, PurchaseOrderItem, StockMovement, Supplier, 
    ProductLocation, StaffTask, Issue, User, AuditLog, Product
)
from app.extensions import db
from datetime import datetime, timezone
import json

manager_bp = Blueprint('manager', __name__)

@manager_bp.route('/approvals', methods=['GET'])
@jwt_required()
@requires_permission(Permission.ORDERS_APPROVE)
def get_approvals(current_user):
    pos = PurchaseOrder.query.filter(PurchaseOrder.status == 'pending_approval').all()
    movements = StockMovement.query.filter(StockMovement.status == 'pending_approval').order_by(StockMovement.created_at.desc()).all()
    
    return jsonify({
        'purchase_orders': [{
            'id': po.id,
            'supplier': po.supplier.name if po.supplier else None,
            'total_amount': po.total_amount,
            'created_by': po.created_by.name if po.created_by else 'System',
            'created_by_id': po.created_by_id,
            'status': po.status,
            'created_at': po.created_at.isoformat() if po.created_at else None,
            'items': [{
                'product_id': item.product_id,
                'quantity': item.quantity,
                'forecast_qty': item.forecast_qty,
                'safety_stock': item.safety_stock,
                'on_hand': item.on_hand
            } for item in po.items]
        } for po in pos],
        
        'stock_adjustments': [{
            'id': m.id,
            'product_id': m.product_id,
            'product_name': m.product.name if m.product else f"Product #{m.product_id}",
            'product_sku': m.product.sku if m.product else "",
            'change_qty': m.change_qty,
            'reason': m.reason,
            'source_location_id': m.source_location_id,
            'destination_location_id': m.destination_location_id,
            'performed_by': m.performed_by,
            'performed_by_name': m.performed_by_user.name if m.performed_by_user else f"User #{m.performed_by}",
            'status': m.status,
            'created_at': m.created_at.isoformat() if m.created_at else None
        } for m in movements]
    }), 200

@manager_bp.route('/approvals/<type>/<int:id>/approve', methods=['POST'])
@jwt_required()
@requires_permission(Permission.ORDERS_APPROVE)
def approve_item(current_user, type, id):
    data = request.get_json() or {}
    reason = data.get('reason') or 'Approved by manager'
        
    if type == 'po':
        po = PurchaseOrder.query.get_or_404(id)
        if po.created_by_id == current_user.id:
            return jsonify({'error': 'Separation of duties: Cannot approve your own PO'}), 403
        po.status = 'approved'
        po.approval_reason = reason
        db.session.commit()
        return jsonify({'status': 'success', 'message': 'Purchase order approved'})
    
    elif type in ['adjustment', 'movement']:
        adj = StockMovement.query.get_or_404(id)
        adj.status = 'approved'
        adj.approval_reason = reason
        
        loc_id = adj.source_location_id or adj.destination_location_id
        if loc_id:
            pl = ProductLocation.query.filter_by(product_id=adj.product_id, location_id=loc_id).first()
            if not pl:
                pl = ProductLocation(product_id=adj.product_id, location_id=loc_id, quantity=0)
                db.session.add(pl)
            pl.quantity += adj.change_qty
            
        if adj.reason == 'transfer' and adj.destination_location_id:
            dest_pl = ProductLocation.query.filter_by(product_id=adj.product_id, location_id=adj.destination_location_id).first()
            if not dest_pl:
                dest_pl = ProductLocation(product_id=adj.product_id, location_id=adj.destination_location_id, quantity=0)
                db.session.add(dest_pl)
            dest_pl.quantity += abs(adj.change_qty)

        product = Product.query.get(adj.product_id)
        if product and adj.reason != 'transfer':
            product.quantity += adj.change_qty
            if product.quantity < 0:
                product.quantity = 0

        try:
            from app.models import Notification
            db.session.add(Notification(
                user_id=adj.performed_by,
                type='approval_decision',
                message=f"Your stock movement of {adj.change_qty} units of {product.sku if product else ''} has been approved by {current_user.name}."
            ))
        except Exception:
            pass

        db.session.commit()
        return jsonify({'status': 'success', 'message': 'Stock movement approved'})
        
    return jsonify({'error': 'Invalid approval type'}), 400

@manager_bp.route('/approvals/<type>/<int:id>/reject', methods=['POST'])
@jwt_required()
@requires_permission(Permission.ORDERS_APPROVE)
def reject_item(current_user, type, id):
    data = request.get_json() or {}
    reason = data.get('reason') or 'Rejected by manager'
        
    if type == 'po':
        po = PurchaseOrder.query.get_or_404(id)
        po.status = 'rejected'
        po.approval_reason = reason
        db.session.commit()
        return jsonify({'status': 'success', 'message': 'Purchase order rejected'})
    
    elif type in ['adjustment', 'movement']:
        adj = StockMovement.query.get_or_404(id)
        adj.status = 'rejected'
        adj.approval_reason = reason

        try:
            product = Product.query.get(adj.product_id)
            from app.models import Notification
            db.session.add(Notification(
                user_id=adj.performed_by,
                type='approval_decision',
                message=f"Your stock movement of {adj.change_qty} units of {product.sku if product else ''} was rejected by {current_user.name}. Reason: {reason}"
            ))
        except Exception:
            pass

        db.session.commit()
        return jsonify({'status': 'success', 'message': 'Stock movement rejected'})
        
    return jsonify({'error': 'Invalid approval type'}), 400

@manager_bp.route('/suppliers', methods=['GET', 'POST'])
@jwt_required()
@requires_permission(Permission.SETTINGS_EDIT) # Maybe give manager a specific permission? Requirements say admin-only for trusted flags
def manage_suppliers(current_user):
    if request.method == 'GET':
        suppliers = Supplier.query.all()
        return jsonify([{
            'id': s.id,
            'name': s.name,
            'email': s.email,
            'contact_email': s.contact_email,
            'lead_time_days': s.lead_time_days,
            'moq': s.moq,
            'pack_size': s.pack_size,
            'is_trusted': s.is_trusted,
            'auto_send_orders': s.auto_send_orders
        } for s in suppliers]), 200
        
    # POST - Create
    data = request.get_json()
    new_s = Supplier(
        name=data['name'],
        email=data['email'],
        contact_email=data.get('contact_email'),
        lead_time_days=data.get('lead_time_days', 7),
        moq=data.get('moq', 1),
        pack_size=data.get('pack_size', 1)
    )
    # Manager cannot set trusted/auto_send
    if current_user.role == 'admin':
        new_s.is_trusted = data.get('is_trusted', False)
        new_s.auto_send_orders = data.get('auto_send_orders', False)
        
    db.session.add(new_s)
    db.session.commit()
    return jsonify({'status': 'success', 'id': new_s.id}), 201

@manager_bp.route('/suppliers/<int:id>', methods=['PUT', 'DELETE'])
@jwt_required()
@requires_permission(Permission.SETTINGS_EDIT)
def modify_supplier(current_user, id):
    s = Supplier.query.get_or_404(id)
    if request.method == 'DELETE':
        db.session.delete(s)
        db.session.commit()
        return jsonify({'status': 'success'}), 200
        
    data = request.get_json()
    if 'name' in data: s.name = data['name']
    if 'email' in data: s.email = data['email']
    if 'contact_email' in data: s.contact_email = data['contact_email']
    if 'lead_time_days' in data: s.lead_time_days = data['lead_time_days']
    if 'moq' in data: s.moq = data['moq']
    if 'pack_size' in data: s.pack_size = data['pack_size']
    
    if current_user.role == 'admin':
        if 'is_trusted' in data: s.is_trusted = data['is_trusted']
        if 'auto_send_orders' in data: s.auto_send_orders = data['auto_send_orders']
        
    db.session.commit()
    return jsonify({'status': 'success'})

@manager_bp.route('/reorder-settings/<int:product_location_id>', methods=['PUT'])
@jwt_required()
@requires_permission(Permission.INVENTORY_EDIT)
def edit_reorder_settings(current_user, product_location_id):
    pl = ProductLocation.query.get_or_404(product_location_id)
    data = request.get_json()
    
    old_vals = {'reorder_threshold': pl.reorder_threshold, 'max_order_quantity': pl.max_order_quantity}
    new_vals = {'reorder_threshold': data.get('reorder_threshold', pl.reorder_threshold), 
                'max_order_quantity': data.get('max_order_quantity', pl.max_order_quantity)}
    
    pl.reorder_threshold = new_vals['reorder_threshold']
    pl.max_order_quantity = new_vals['max_order_quantity']
    
    # Audit log
    log = AuditLog(
        user_id=current_user.id,
        action='update_reorder_settings',
        target_resource='product_locations',
        target_id=pl.id,
        details=json.dumps({'old': old_vals, 'new': new_vals})
    )
    db.session.add(log)
    db.session.commit()
    return jsonify({'status': 'success'})

@manager_bp.route('/reorder-settings/history/<int:product_location_id>', methods=['GET'])
@jwt_required()
@requires_permission(Permission.INVENTORY_VIEW)
def get_reorder_settings_history(current_user, product_location_id):
    logs = AuditLog.query.filter_by(
        action='update_reorder_settings', 
        target_resource='product_locations', 
        target_id=product_location_id
    ).order_by(AuditLog.created_at.desc()).all()
    
    return jsonify([{
        'id': l.id,
        'user_id': l.user_id,
        'details': json.loads(l.details),
        'created_at': l.created_at.isoformat()
    } for l in logs]), 200

@manager_bp.route('/team/tasks', methods=['POST'])
@jwt_required()
@requires_permission(Permission.INVENTORY_EDIT)
def assign_task(current_user):
    data = request.get_json()
    task = StaffTask(
        user_id=data['user_id'],
        type=data['type'],
        description=data.get('description'),
        status='todo'
    )
    db.session.add(task)
    db.session.commit()
    return jsonify({'status': 'success'}), 201

@manager_bp.route('/team/activity', methods=['GET'])
@jwt_required()
@requires_permission(Permission.DASHBOARD_VIEW)
def team_activity(current_user):
    # Activity for manager's location
    users = User.query.filter_by(location_id=current_user.location_id).all()
    user_ids = [u.id for u in users]
    
    movements = StockMovement.query.filter(StockMovement.performed_by.in_(user_ids)).order_by(StockMovement.created_at.desc()).limit(20).all()
    return jsonify([{
        'id': m.id,
        'product_id': m.product_id,
        'change_qty': m.change_qty,
        'reason': m.reason,
        'performed_by': m.performed_by,
        'created_at': m.created_at.isoformat()
    } for m in movements]), 200

@manager_bp.route('/discrepancies', methods=['GET'])
@jwt_required()
@requires_permission(Permission.DASHBOARD_VIEW)
def list_discrepancies(current_user):
    issues = Issue.query.filter_by(status='open').all()
    return jsonify([{
        'id': i.id,
        'user_id': i.user_id,
        'product_id': i.product_id,
        'type': i.type,
        'notes': i.notes,
        'status': i.status,
        'created_at': i.created_at.isoformat()
    } for i in issues]), 200

@manager_bp.route('/discrepancies/<int:id>/accept', methods=['POST'])
@jwt_required()
@requires_permission(Permission.INVENTORY_EDIT)
def accept_discrepancy(current_user, id):
    issue = Issue.query.get_or_404(id)
    issue.status = 'accepted'
    
    # Creates a stock adjustment for approval
    adj = StockMovement(
        product_id=issue.product_id,
        change_qty=0, # Need to compute or pass from frontend for actual adjustment
        reason='discrepancy_adjustment',
        source_location_id=current_user.location_id,
        performed_by=current_user.id,
        status='pending_approval'
    )
    data = request.get_json()
    if data and 'change_qty' in data:
        adj.change_qty = data['change_qty']
        
    db.session.add(adj)
    db.session.commit()
    return jsonify({'status': 'success'})

@manager_bp.route('/discrepancies/<int:id>/dismiss', methods=['POST'])
@jwt_required()
@requires_permission(Permission.INVENTORY_EDIT)
def dismiss_discrepancy(current_user, id):
    issue = Issue.query.get_or_404(id)
    data = request.get_json()
    if not data or not data.get('reason'):
        return jsonify({'error': 'Reason required'}), 400
        
    issue.status = 'dismissed'
    issue.resolution_notes = data['reason']
    db.session.commit()
    return jsonify({'status': 'success'})

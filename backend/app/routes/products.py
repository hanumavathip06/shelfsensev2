from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.models import Product, StockMovement, Notification, User, Category, Supplier
from app.schemas import product_schema, products_schema, stock_movements_schema
from app.extensions import db
from app.utils.auth import requires_permission, Permission, has_permission
from app.utils.errors import api_error

products_bp = Blueprint('products', __name__)

@products_bp.route('', methods=['GET'])
@jwt_required()
@requires_permission(Permission.INVENTORY_VIEW)
def get_products():
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 10, type=int)
    q = (request.args.get('q') or request.args.get('search') or '').strip()
    category_id = request.args.get('category_id', type=int)
    low_stock = request.args.get('low_stock', 'false').lower() == 'true'

    query = Product.query.outerjoin(Category, Product.category_id == Category.id)
    if q:
        for term in q.split():
            pat = f'%{term}%'
            query = query.filter(
                (Product.name.ilike(pat)) |
                (Product.sku.ilike(pat)) |
                (Category.name.ilike(pat))
            )
    if category_id:
        query = query.filter(Product.category_id == category_id)
    if low_stock:
        query = query.filter(Product.quantity <= Product.reorder_threshold)

    pagination = query.paginate(page=page, per_page=limit, error_out=False)
    
    items = products_schema.dump(pagination.items)
    role = get_jwt().get('role', 'staff')
    if not has_permission(role, Permission.INVENTORY_VIEW_COST):
        for item in items:
            item.pop('unit_price', None)
            item.pop('supplier', None)
            
    return jsonify({
        'items': items,
        'total': pagination.total,
        'page': pagination.page,
        'pages': pagination.pages
    })

@products_bp.route('/<int:id>', methods=['GET'])
@jwt_required()
@requires_permission(Permission.INVENTORY_VIEW)
def get_product(id):
    product = Product.query.get(id)
    if not product:
        return api_error("Product not found", 404)
        
    data = product_schema.dump(product)
    role = get_jwt().get('role', 'staff')
    if not has_permission(role, Permission.INVENTORY_VIEW_COST):
        data.pop('unit_price', None)
        data.pop('supplier', None)
        
    return jsonify(data)

def _get_or_create_supplier(name):
    if not name:
        return None
    supplier = Supplier.query.filter_by(name=name).first()
    if not supplier:
        supplier = Supplier(name=name, email=f"{name.lower().replace(' ', '')}@example.com")
        db.session.add(supplier)
    return supplier

@products_bp.route('', methods=['POST'])
@jwt_required()
@requires_permission(Permission.INVENTORY_EDIT)
def create_product():
    data = request.get_json()
    errors = product_schema.validate(data)
    if errors:
        return api_error(str(errors), 400)
        
    if Product.query.filter_by(sku=data['sku']).first():
        return api_error("SKU already exists", 409)
    if not Category.query.get(data['category_id']):
        return api_error("Category not found", 404)

    product = Product(
        name=data['name'],
        sku=data['sku'],
        category_id=data['category_id'],
        quantity=data.get('quantity', 0),
        reorder_threshold=data.get('reorder_threshold', 0),
        unit_price=data['unit_price'],
        supplier=_get_or_create_supplier(data.get('supplier'))
    )
    db.session.add(product)
    db.session.commit()
    return jsonify(product_schema.dump(product)), 201

@products_bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
@requires_permission(Permission.INVENTORY_EDIT)
def update_product(id):
    product = Product.query.get(id)
    if not product:
        return api_error("Product not found", 404)
    data = request.get_json()
    errors = product_schema.validate(data, partial=True)
    if errors:
        return api_error(str(errors), 400)

    if 'sku' in data:
        existing = Product.query.filter_by(sku=data['sku']).first()
        if existing and existing.id != id:
            return api_error("SKU already exists", 409)
        product.sku = data['sku']
    if 'category_id' in data:
        if not Category.query.get(data['category_id']):
            return api_error("Category not found", 404)
        product.category_id = data['category_id']
    
    if 'name' in data: product.name = data['name']
    if 'quantity' in data: product.quantity = data['quantity']
    if 'reorder_threshold' in data: product.reorder_threshold = data['reorder_threshold']
    if 'unit_price' in data: product.unit_price = data['unit_price']
    if 'supplier' in data: product.supplier = _get_or_create_supplier(data['supplier'])

    db.session.commit()
    return jsonify(product_schema.dump(product))

@products_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
@requires_permission(Permission.INVENTORY_EDIT)
def delete_product(id):
    product = Product.query.get(id)
    if not product:
        return api_error("Product not found", 404)
    db.session.delete(product)
    db.session.commit()
    return '', 204

@products_bp.route('/<int:id>/movements', methods=['POST'])
@jwt_required()
@requires_permission(Permission.DASHBOARD_VIEW)
def create_movement(id):
    product = Product.query.get(id)
    if not product:
        return api_error("Product not found", 404)
    
    data = request.get_json()
    if not data or 'change_qty' not in data or 'reason' not in data:
        return api_error("Missing change_qty or reason", 400)
    
    reason = data['reason']
    if reason not in ['sale', 'manual_adjustment', 'restock']:
        return api_error("Invalid reason", 400)
        
    change_qty = int(data['change_qty'])
    user_id = int(get_jwt_identity())
    
    try:
        # Atomic operation using transaction
        product.quantity += change_qty
        
        movement = StockMovement(
            product_id=product.id,
            change_qty=change_qty,
            reason=reason,
            performed_by=user_id
        )
        db.session.add(movement)
        
        # Check for low stock notification
        if product.quantity <= product.reorder_threshold and change_qty < 0:
            admins_managers = User.query.filter(User.role.in_(['admin', 'manager'])).all()
            for user in admins_managers:
                notification = Notification(
                    user_id=user.id,
                    type='low_stock',
                    message=f"Product {product.name} ({product.sku}) is low on stock. Current quantity: {product.quantity}"
                )
                db.session.add(notification)
                
        db.session.commit()
        return jsonify(product_schema.dump(product)), 201
    except Exception as e:
        db.session.rollback()
        return api_error("Transaction failed: " + str(e), 500)

@products_bp.route('/<int:id>/history', methods=['GET'])
@jwt_required()
@requires_permission(Permission.DASHBOARD_VIEW)
def get_movement_history(id):
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 10, type=int)
    pagination = StockMovement.query.filter_by(product_id=id).order_by(StockMovement.created_at.desc()).paginate(page=page, per_page=limit, error_out=False)
    return jsonify({
        'items': stock_movements_schema.dump(pagination.items),
        'total': pagination.total,
        'page': pagination.page,
        'pages': pagination.pages
    })

from datetime import datetime, timedelta, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import func
from app.models import Product, StockMovement, Notification, Category, PurchaseOrder
from app.extensions import db
from app.utils.auth import requires_permission, Permission

analytics_bp = Blueprint('analytics', __name__)

@analytics_bp.route('/summary', methods=['GET'])
@jwt_required()
@requires_permission(Permission.REPORTS_VIEW)
def get_summary():
    total_skus = db.session.query(func.count(Product.id)).scalar()
    inventory_value = db.session.query(func.sum(Product.quantity * Product.unit_price)).scalar()
    low_stock_count = Product.query.filter(Product.quantity <= Product.reorder_threshold).count()
    pending_notifications = Notification.query.filter_by(is_read=False).count()
    pending_approvals = (
        PurchaseOrder.query.filter_by(status='pending_approval').count() +
        StockMovement.query.filter_by(status='pending_approval').count()
    )
    
    return jsonify({
        'total_skus': total_skus or 0,
        'inventory_value': float(inventory_value or 0),
        'low_stock_count': low_stock_count,
        'pending_notifications': pending_notifications,
        'pending_approvals': pending_approvals
    })

@analytics_bp.route('/trends', methods=['GET'])
@jwt_required()
@requires_permission(Permission.REPORTS_VIEW)
def get_trends():
    days = request.args.get('days', 30, type=int)
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Simple aggregation by day
    # Note: DB specific date functions might be needed for real production, 
    # but pulling records and aggregating in Python works for this MVP.
    movements = StockMovement.query.filter(StockMovement.created_at >= start_date).all()
    
    trends = {}
    for mov in movements:
        day_str = mov.created_at.strftime('%Y-%m-%d')
        if day_str not in trends:
            trends[day_str] = 0
        trends[day_str] += abs(mov.change_qty)
        
    return jsonify(trends)

@analytics_bp.route('/top-products', methods=['GET'])
@jwt_required()
@requires_permission(Permission.REPORTS_VIEW)
def get_top_products():
    by = request.args.get('by', 'value')
    limit = request.args.get('limit', 5, type=int)
    
    if by == 'value':
        products = Product.query.order_by((Product.quantity * Product.unit_price).desc()).limit(limit).all()
        result = [{'id': p.id, 'name': p.name, 'value': float(p.quantity * p.unit_price)} for p in products]
        return jsonify(result)
    elif by == 'movement':
        # Products with most absolute quantity changes
        movements = db.session.query(
            StockMovement.product_id,
            func.sum(func.abs(StockMovement.change_qty)).label('total_movement')
        ).group_by(StockMovement.product_id).order_by(func.sum(func.abs(StockMovement.change_qty)).desc()).limit(limit).all()
        
        result = []
        for p_id, total_mov in movements:
            product = Product.query.get(p_id)
            if product:
                result.append({'id': product.id, 'name': product.name, 'movement': int(total_mov)})
        return jsonify(result)
    
    return jsonify({'error': 'Invalid by parameter'}), 400

@analytics_bp.route('/category-stock', methods=['GET'])
@jwt_required()
@requires_permission(Permission.REPORTS_VIEW)
def get_category_stock():
    results = db.session.query(
        Category.name,
        func.coalesce(func.sum(Product.quantity), 0).label('stock')
    ).outerjoin(Product, Category.id == Product.category_id)\
     .group_by(Category.id, Category.name)\
     .all()
    
    return jsonify([{'name': name, 'stock': int(stock)} for name, stock in results])

@analytics_bp.route('/abc-xyz', methods=['GET'])
@jwt_required()
@requires_permission(Permission.REPORTS_VIEW)
def get_abc_xyz_classification():
    """
    Perform ABC-XYZ inventory classification on all products.
    ABC = by revenue value, XYZ = by demand variability (CV).
    """
    from app.ml.abc_xyz_classifier import get_combined_classification, get_classification_summary
    from app.ml.data_preprocessor import get_daily_demand
    
    products = Product.query.all()
    
    products_data = [{
        'id': p.id,
        'name': p.name,
        'sku': p.sku,
        'quantity': p.quantity,
        'unit_price': float(p.unit_price)
    } for p in products]
    
    # Build demand history for each product
    products_demand_data = {}
    for product in products:
        movements = StockMovement.query.filter_by(product_id=product.id).all()
        movements_list = [{
            'created_at': m.created_at,
            'change_qty': m.change_qty,
            'reason': m.reason
        } for m in movements]
        
        daily = get_daily_demand(movements_list)
        products_demand_data[product.id] = daily['demand'].values.tolist()
    
    classification = get_combined_classification(products_data, products_demand_data)
    summary = get_classification_summary(classification)
    
    # Update product records with classification
    for item in classification:
        product = Product.query.get(item['product_id'])
        if product:
            product.abc_class = item['abc_class']
            product.xyz_class = item['xyz_class']
    db.session.commit()
    
    return jsonify({
        'classification': classification,
        'summary': summary
    })


@analytics_bp.route('/anomalies', methods=['GET'])
@jwt_required()
@requires_permission(Permission.REPORTS_VIEW)
def get_anomalies():
    """
    Detect anomalous stock movements using Z-Score and Isolation Forest.
    
    Query params:
        days: Number of days to analyze (default: 90)
        threshold: Z-score threshold (default: 2.5)
    """
    from app.ml.anomaly_detector import detect_anomalies_combined
    from datetime import timedelta
    
    days = request.args.get('days', 90, type=int)
    threshold = request.args.get('threshold', 2.5, type=float)
    
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    movements = StockMovement.query.filter(
        StockMovement.created_at >= start_date
    ).all()
    
    movements_data = []
    for m in movements:
        product = Product.query.get(m.product_id)
        movements_data.append({
            'id': m.id,
            'product_id': m.product_id,
            'product_name': product.name if product else 'Unknown',
            'change_qty': m.change_qty,
            'reason': m.reason,
            'created_at': m.created_at.isoformat() if m.created_at else ''
        })
    
    result = detect_anomalies_combined(movements_data, z_threshold=threshold)
    
    return jsonify(result)


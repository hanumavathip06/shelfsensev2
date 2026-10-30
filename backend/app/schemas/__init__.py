from marshmallow import Schema, fields, validate

class UserSchema(Schema):
    id = fields.Int(dump_only=True)
    name = fields.Str(required=True, validate=validate.Length(min=1))
    email = fields.Email(required=True)
    role = fields.Str(validate=validate.OneOf(['admin', 'manager', 'staff']))
    password = fields.Str(load_only=True)
    location_id = fields.Int(allow_none=True)
    is_active = fields.Bool(dump_only=True)
    created_at = fields.DateTime(dump_only=True)

class CategorySchema(Schema):
    id = fields.Int(dump_only=True)
    name = fields.Str(required=True, validate=validate.Length(min=1))

class ProductSchema(Schema):
    id = fields.Int(dump_only=True)
    name = fields.Str(required=True, validate=validate.Length(min=1))
    sku = fields.Str(required=True, validate=validate.Length(min=1))
    category_id = fields.Int(required=True)
    quantity = fields.Int(missing=0)
    reorder_threshold = fields.Int(missing=0)
    unit_price = fields.Decimal(required=True, as_string=True)
    supplier = fields.Function(lambda obj: obj.supplier.name if getattr(obj, 'supplier', None) else None, deserialize=lambda x: x)
    lead_time_days = fields.Int(missing=7)
    service_level = fields.Float(missing=0.95)
    abc_class = fields.Str(dump_only=True)
    xyz_class = fields.Str(dump_only=True)
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

class StockMovementSchema(Schema):
    id = fields.Int(dump_only=True)
    product_id = fields.Int(dump_only=True)
    change_qty = fields.Int(required=True)
    reason = fields.Str(required=True, validate=validate.OneOf(['sale', 'manual_adjustment', 'restock']))
    performed_by = fields.Int(dump_only=True)
    created_at = fields.DateTime(dump_only=True)

class NotificationSchema(Schema):
    id = fields.Int(dump_only=True)
    user_id = fields.Int(dump_only=True)
    type = fields.Str(dump_only=True)
    message = fields.Str(dump_only=True)
    is_read = fields.Bool(dump_only=True)
    created_at = fields.DateTime(dump_only=True)

class ForecastResultSchema(Schema):
    id = fields.Int(dump_only=True)
    product_id = fields.Int(dump_only=True)
    model_name = fields.Str(dump_only=True)
    horizon_days = fields.Int(dump_only=True)
    predictions = fields.Str(dump_only=True)
    confidence_lower = fields.Str(dump_only=True)
    confidence_upper = fields.Str(dump_only=True)
    rmse = fields.Float(dump_only=True)
    mae = fields.Float(dump_only=True)
    mape = fields.Float(dump_only=True)
    r2_score = fields.Float(dump_only=True)
    created_at = fields.DateTime(dump_only=True)

user_schema = UserSchema()
users_schema = UserSchema(many=True)
category_schema = CategorySchema()
categories_schema = CategorySchema(many=True)
product_schema = ProductSchema()
products_schema = ProductSchema(many=True)
stock_movement_schema = StockMovementSchema()
stock_movements_schema = StockMovementSchema(many=True)
notification_schema = NotificationSchema()
notifications_schema = NotificationSchema(many=True)
forecast_result_schema = ForecastResultSchema()
forecast_results_schema = ForecastResultSchema(many=True)


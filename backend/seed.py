"""
Enhanced seed script for ShelfSense with rich stock movement history.
Generates realistic demand patterns for ML model training and evaluation.
Safe and idempotent: creates tables and default records without dropping data unless explicitly requested.
"""

import os
import sys
import random
from datetime import datetime, timedelta, timezone

os.environ.setdefault('DISABLE_SCHEDULER', '1')

from app import create_app
from app.extensions import db
from app.models import (
    User, Category, Product, StockMovement,
    Location, Supplier, ProductLocation, SystemSetting
)
from werkzeug.security import generate_password_hash
from sqlalchemy import text

app = create_app()

def seed_data(reset=False):
    with app.app_context():
        if reset:
            print("Resetting database (dropping and creating all tables)...")
            db.drop_all()
            db.create_all()
        else:
            print("Ensuring database schema exists...")
            db.create_all()

        # Ensure background_jobs table exists
        with db.engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS background_jobs (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    status VARCHAR(50) DEFAULT 'pending',
                    last_run_at TIMESTAMP,
                    error_message TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))
            conn.commit()

        # 1. Locations
        loc1 = Location.query.filter_by(name="Main Warehouse").first()
        if not loc1:
            loc1 = Location(name="Main Warehouse", address="123 Logistics Blvd")
            db.session.add(loc1)

        loc2 = Location.query.filter_by(name="Downtown Store").first()
        if not loc2:
            loc2 = Location(name="Downtown Store", address="456 High St")
            db.session.add(loc2)

        db.session.commit()
        print("Locations verified.")

        # 2. Users (Both test.com and shelfsense.com for easy local & production access)
        password_hash = generate_password_hash("password123")
        default_users = [
            {"name": "Admin User", "email": "admin@test.com", "role": "admin", "loc": loc1.id},
            {"name": "Admin User", "email": "admin@shelfsense.com", "role": "admin", "loc": loc1.id},
            {"name": "Manager User", "email": "manager@test.com", "role": "manager", "loc": loc1.id},
            {"name": "Manager User", "email": "manager@shelfsense.com", "role": "manager", "loc": loc1.id},
            {"name": "Staff User", "email": "staff@test.com", "role": "staff", "loc": loc1.id},
            {"name": "Staff User", "email": "staff@shelfsense.com", "role": "staff", "loc": loc1.id},
        ]

        seeded_users = {}
        for u_data in default_users:
            user = User.query.filter_by(email=u_data["email"]).first()
            if not user:
                user = User(
                    name=u_data["name"],
                    email=u_data["email"],
                    password_hash=password_hash,
                    role=u_data["role"],
                    location_id=u_data["loc"],
                    is_active=True
                )
                db.session.add(user)
                db.session.flush()
            else:
                user.role = u_data["role"]
                user.name = u_data["name"]
            seeded_users[u_data["email"]] = user

        db.session.commit()
        print("Default users verified.")

        # 3. Suppliers
        suppliers_data = [
            {"name": "TechCorp", "email": "orders@techcorp.example.com", "lead_time_days": 10, "is_trusted": True, "auto_send_orders": True, "moq": 5, "pack_size": 1},
            {"name": "PeripheralsPro", "email": "orders@peripheralspro.example.com", "lead_time_days": 5, "is_trusted": True, "auto_send_orders": False, "moq": 10, "pack_size": 5},
            {"name": "PaperInc", "email": "orders@paperinc.example.com", "lead_time_days": 3, "is_trusted": True, "auto_send_orders": True, "moq": 20, "pack_size": 10},
            {"name": "PenMaker", "email": "orders@penmaker.example.com", "lead_time_days": 3, "is_trusted": False, "auto_send_orders": False, "moq": 10, "pack_size": 10},
            {"name": "Furnishings LLC", "email": "orders@furnishings.example.com", "lead_time_days": 21, "is_trusted": False, "auto_send_orders": False, "moq": 2, "pack_size": 1},
            {"name": "CleanCo", "email": "orders@cleanco.example.com", "lead_time_days": 5, "is_trusted": True, "auto_send_orders": True, "moq": 50, "pack_size": 25},
            {"name": "SafetyFirst", "email": "orders@safetyfirst.example.com", "lead_time_days": 7, "is_trusted": True, "auto_send_orders": False, "moq": 10, "pack_size": 5},
        ]
        suppliers_map = {}
        for s_data in suppliers_data:
            sup = Supplier.query.filter_by(name=s_data["name"]).first()
            if not sup:
                sup = Supplier(**s_data)
                db.session.add(sup)
                db.session.flush()
            suppliers_map[s_data["name"]] = sup

        db.session.commit()
        print("Suppliers verified.")

        # 4. Categories
        cat_names = [
            "Electronics",
            "Office Supplies",
            "Furniture",
            "Cleaning Supplies",
            "Safety Equipment"
        ]
        categories_map = {}
        for name in cat_names:
            cat = Category.query.filter_by(name=name).first()
            if not cat:
                cat = Category(name=name)
                db.session.add(cat)
                db.session.flush()
            categories_map[name] = cat

        db.session.commit()
        print("Categories verified.")

        # 5. Products
        products_defs = [
            {"name": "Laptop", "sku": "ELC-001", "category": "Electronics", "quantity": 50, "reorder_threshold": 10, "unit_price": 999.99, "supplier": "TechCorp", "lead_time_days": 14, "service_level": 0.95},
            {"name": "Smartphone", "sku": "ELC-002", "category": "Electronics", "quantity": 150, "reorder_threshold": 20, "unit_price": 499.50, "supplier": "TechCorp", "lead_time_days": 10, "service_level": 0.95},
            {"name": "Wireless Mouse", "sku": "ELC-003", "category": "Electronics", "quantity": 200, "reorder_threshold": 30, "unit_price": 29.99, "supplier": "PeripheralsPro", "lead_time_days": 5, "service_level": 0.90},
            {"name": "USB-C Hub", "sku": "ELC-004", "category": "Electronics", "quantity": 80, "reorder_threshold": 15, "unit_price": 45.00, "supplier": "PeripheralsPro", "lead_time_days": 7, "service_level": 0.90},
            {"name": "Notebook", "sku": "OFF-001", "category": "Office Supplies", "quantity": 300, "reorder_threshold": 50, "unit_price": 2.50, "supplier": "PaperInc", "lead_time_days": 3, "service_level": 0.85},
            {"name": "Pens (Box)", "sku": "OFF-002", "category": "Office Supplies", "quantity": 200, "reorder_threshold": 30, "unit_price": 15.00, "supplier": "PenMaker", "lead_time_days": 3, "service_level": 0.85},
            {"name": "Printer Paper (Ream)", "sku": "OFF-003", "category": "Office Supplies", "quantity": 100, "reorder_threshold": 20, "unit_price": 8.99, "supplier": "PaperInc", "lead_time_days": 5, "service_level": 0.90},
            {"name": "Sticky Notes", "sku": "OFF-004", "category": "Office Supplies", "quantity": 400, "reorder_threshold": 80, "unit_price": 3.50, "supplier": "PaperInc", "lead_time_days": 3, "service_level": 0.80},
            {"name": "Office Chair", "sku": "FUR-001", "category": "Furniture", "quantity": 20, "reorder_threshold": 5, "unit_price": 249.99, "supplier": "Furnishings LLC", "lead_time_days": 21, "service_level": 0.95},
            {"name": "Standing Desk", "sku": "FUR-002", "category": "Furniture", "quantity": 15, "reorder_threshold": 3, "unit_price": 599.99, "supplier": "Furnishings LLC", "lead_time_days": 30, "service_level": 0.95},
            {"name": "Hand Sanitizer", "sku": "CLN-001", "category": "Cleaning Supplies", "quantity": 500, "reorder_threshold": 100, "unit_price": 4.99, "supplier": "CleanCo", "lead_time_days": 5, "service_level": 0.90},
            {"name": "Disinfectant Spray", "sku": "CLN-002", "category": "Cleaning Supplies", "quantity": 300, "reorder_threshold": 60, "unit_price": 7.99, "supplier": "CleanCo", "lead_time_days": 5, "service_level": 0.90},
            {"name": "Safety Goggles", "sku": "SAF-001", "category": "Safety Equipment", "quantity": 100, "reorder_threshold": 20, "unit_price": 12.50, "supplier": "SafetyFirst", "lead_time_days": 7, "service_level": 0.95},
            {"name": "Hard Hat", "sku": "SAF-002", "category": "Safety Equipment", "quantity": 50, "reorder_threshold": 10, "unit_price": 25.00, "supplier": "SafetyFirst", "lead_time_days": 10, "service_level": 0.95},
            {"name": "First Aid Kit", "sku": "SAF-003", "category": "Safety Equipment", "quantity": 30, "reorder_threshold": 5, "unit_price": 45.00, "supplier": "SafetyFirst", "lead_time_days": 7, "service_level": 0.97},
        ]

        products_list = []
        for p_def in products_defs:
            prod = Product.query.filter_by(sku=p_def["sku"]).first()
            if not prod:
                cat = categories_map[p_def["category"]]
                sup = suppliers_map[p_def["supplier"]]
                prod = Product(
                    name=p_def["name"],
                    sku=p_def["sku"],
                    category_id=cat.id,
                    quantity=p_def["quantity"],
                    reorder_threshold=p_def["reorder_threshold"],
                    unit_price=p_def["unit_price"],
                    supplier_id=sup.id,
                    lead_time_days=p_def["lead_time_days"],
                    service_level=p_def["service_level"]
                )
                db.session.add(prod)
                db.session.flush()
            products_list.append(prod)

        db.session.commit()
        print("Products verified.")

        # 6. Product Locations
        for prod in products_list:
            pl1 = ProductLocation.query.filter_by(product_id=prod.id, location_id=loc1.id).first()
            if not pl1:
                pl1 = ProductLocation(
                    product_id=prod.id,
                    location_id=loc1.id,
                    quantity=int(prod.quantity * 0.7),
                    reorder_threshold=prod.reorder_threshold,
                    max_order_quantity=prod.reorder_threshold * 5
                )
                db.session.add(pl1)

            pl2 = ProductLocation.query.filter_by(product_id=prod.id, location_id=loc2.id).first()
            if not pl2:
                pl2 = ProductLocation(
                    product_id=prod.id,
                    location_id=loc2.id,
                    quantity=int(prod.quantity * 0.3),
                    reorder_threshold=max(2, int(prod.reorder_threshold * 0.5)),
                    max_order_quantity=prod.reorder_threshold * 3
                )
                db.session.add(pl2)

        db.session.commit()
        print("Product Locations verified.")

        # 7. System Settings
        settings_defs = [
            ("GLOBAL_PO_KILLSWITCH", "False", "Killswitch to prevent auto-sending purchase orders"),
            ("DAILY_SPEND_LIMIT", "10000.0", "Maximum daily spend on auto POs"),
            ("COMPANY_NAME", "ShelfSense Inc.", "Application business name"),
        ]
        for key, val, desc in settings_defs:
            setting = SystemSetting.query.get(key)
            if not setting:
                setting = SystemSetting(key=key, value=val, description=desc)
                db.session.add(setting)

        db.session.commit()
        print("System Settings verified.")

        # 8. Stock Movement History (only generate if stock_movements is empty)
        existing_movements_count = StockMovement.query.count()
        if existing_movements_count == 0:
            print("Generating stock movement history (180 days)...")
            user_ids = [u.id for u in seeded_users.values()]
            admin_user = seeded_users.get("admin@test.com") or seeded_users.get("admin@shelfsense.com")

            demand_patterns = {
                'ELC-001': {'avg': 2, 'std': 1.5, 'spike_chance': 0.05},
                'ELC-002': {'avg': 5, 'std': 3, 'spike_chance': 0.08},
                'ELC-003': {'avg': 8, 'std': 2, 'spike_chance': 0.03},
                'ELC-004': {'avg': 3, 'std': 2, 'spike_chance': 0.05},
                'OFF-001': {'avg': 15, 'std': 4, 'spike_chance': 0.02},
                'OFF-002': {'avg': 10, 'std': 3, 'spike_chance': 0.02},
                'OFF-003': {'avg': 6, 'std': 2, 'spike_chance': 0.03},
                'OFF-004': {'avg': 20, 'std': 5, 'spike_chance': 0.02},
                'FUR-001': {'avg': 1, 'std': 0.8, 'spike_chance': 0.10},
                'FUR-002': {'avg': 0.5, 'std': 0.5, 'spike_chance': 0.15},
                'CLN-001': {'avg': 25, 'std': 8, 'spike_chance': 0.05},
                'CLN-002': {'avg': 15, 'std': 6, 'spike_chance': 0.05},
                'SAF-001': {'avg': 4, 'std': 2, 'spike_chance': 0.04},
                'SAF-002': {'avg': 2, 'std': 1.5, 'spike_chance': 0.06},
                'SAF-003': {'avg': 1, 'std': 0.5, 'spike_chance': 0.03},
            }

            movements = []
            now = datetime.now(timezone.utc)

            for product in products_list:
                pattern = demand_patterns.get(product.sku, {'avg': 5, 'std': 2, 'spike_chance': 0.05})
                running_qty = product.quantity + 300

                for day_offset in range(180, 0, -1):
                    date = now - timedelta(days=day_offset)
                    is_weekend = date.weekday() >= 5
                    demand_multiplier = 0.3 if is_weekend else 1.0

                    month = date.month
                    seasonal_multiplier = 1.3 if month in [11, 12, 1] else (0.8 if month in [6, 7, 8] else 1.0)

                    base_demand = max(0, int(
                        random.gauss(pattern['avg'], pattern['std'])
                        * demand_multiplier
                        * seasonal_multiplier
                    ))

                    if random.random() < pattern['spike_chance']:
                        base_demand = int(base_demand * random.uniform(3, 5))

                    if base_demand > 0 and running_qty > 0:
                        sale_qty = min(base_demand, running_qty)
                        running_qty -= sale_qty
                        movements.append(StockMovement(
                            product_id=product.id,
                            change_qty=-sale_qty,
                            reason='sale',
                            source_location_id=loc1.id,
                            performed_by=random.choice(user_ids),
                            status='approved',
                            created_at=date + timedelta(hours=random.randint(8, 18), minutes=random.randint(0, 59))
                        ))

                    # Restock when low
                    if running_qty < product.reorder_threshold * 2 and random.random() < 0.35:
                        restock_qty = random.randint(40, 100)
                        running_qty += restock_qty
                        movements.append(StockMovement(
                            product_id=product.id,
                            change_qty=restock_qty,
                            reason='restock',
                            destination_location_id=loc1.id,
                            performed_by=admin_user.id if admin_user else 1,
                            status='approved',
                            created_at=date + timedelta(hours=random.randint(6, 10), minutes=random.randint(0, 59))
                        ))

                product.quantity = max(0, running_qty)

            db.session.add_all(movements)
            db.session.commit()
            print(f"Seeded {len(movements)} stock movements across {len(products_list)} products.")
        else:
            print(f"Stock movements already present ({existing_movements_count} rows). Skipping movement generation.")

        print("Seeding process completed successfully!")

if __name__ == '__main__':
    reset_flag = '--reset' in sys.argv or '--force' in sys.argv
    seed_data(reset=reset_flag)

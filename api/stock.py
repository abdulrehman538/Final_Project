from django.db.models import F

from .models import Product


def aggregate_cart_quantities(cart_items):
    """Sum requested quantities per product id (handles duplicate lines in one cart)."""
    quantities = {}

    for item in cart_items:
        product_id = item.get("product_id")
        if product_id is None:
            continue

        try:
            pid = int(product_id)
        except (TypeError, ValueError):
            continue

        try:
            qty = int(item.get("quantity", 1))
        except (TypeError, ValueError):
            qty = 1

        quantities[pid] = quantities.get(pid, 0) + max(1, qty)

    return quantities


def restore_order_stock(order):
    """Return reserved units to inventory when an order is rejected/cancelled."""
    for item in order.items.all():
        if item.product_id and item.quantity:
            Product.objects.filter(pk=item.product_id).update(
                stock=F("stock") + item.quantity
            )


def deduct_product_stock(product, quantity):
    """Decrease live stock for a product after a successful checkout line."""
    product.stock = max(0, product.stock - quantity)
    product.save(update_fields=["stock"])

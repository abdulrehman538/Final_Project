"""Shared demo product image catalog for seeding and bulk image assignment."""

import urllib.request
from pathlib import Path

from django.conf import settings
from django.core.files import File

# Product-specific photos (Unsplash) — one file per product type.
DEMO_PRODUCT_IMAGES = {
    "demo_headphones.jpg": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80",
    "demo_keyboard.jpg": "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=800&q=80",
    "demo_usb_hub.jpg": "https://images.unsplash.com/photo-1625842268584-8f3296236761?auto=format&fit=crop&w=800&q=80",
    "demo_speaker.jpg": "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=800&q=80",
    "demo_coffee_set.jpg": "https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=800&q=80",
    "demo_blanket.jpg": "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&q=80",
    "demo_cutting_board.jpg": "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=800&q=80",
    "demo_sneakers.jpg": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80",
    "demo_weekender_bag.jpg": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80",
    "demo_sunglasses.jpg": "https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=800&q=80",
    "demo_vegetable_box.jpg": "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80",
    "demo_sourdough.jpg": "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80",
    "demo_olive_oil.jpg": "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=800&q=80",
}

# Keyword rules — first match wins (name + category searched together).
IMAGE_KEYWORD_RULES = [
    (("headphone", "headset", "noise cancelling", "noise-canceling"), "demo_headphones.jpg"),
    (("keyboard", "key board", "key-board"), "demo_keyboard.jpg"),
    (("speaker",), "demo_speaker.jpg"),
    (("usb", "hub", "charger", "charging"), "demo_usb_hub.jpg"),
    (("coffee", "arabica", "flask", "thermal"), "demo_coffee_set.jpg"),
    (("blanket", "linen", "throw"), "demo_blanket.jpg"),
    (("cutting board", "chopping board"), "demo_cutting_board.jpg"),
    (("sneaker", "shoe", "footwear"), "demo_sneakers.jpg"),
    (("weekender", "duffel", "handbag"), "demo_weekender_bag.jpg"),
    (("bag", "canvas"), "demo_weekender_bag.jpg"),
    (("sunglass", "eyewear", "bangle", "bangles"), "demo_sunglasses.jpg"),
    (("sourdough", "bread", "loaf", "bakery"), "demo_sourdough.jpg"),
    (("olive oil", "olive"), "demo_olive_oil.jpg"),
    (("mango", "apple", "banana", "berry", "vegetable", "fruit", "produce"), "demo_vegetable_box.jpg"),
    (("jacket", "bomber", "leather"), "demo_sneakers.jpg"),
    (("chair", "office", "lumbar", "ergonomic"), "demo_blanket.jpg"),
    (("ipad", "tablet", "laptop", "lenovo", "computer"), "demo_keyboard.jpg"),
    (("panadol", "medicine", "pharmacy", "pill"), "demo_olive_oil.jpg"),
]

CATEGORY_IMAGE_FALLBACK = {
    "electronics": "demo_usb_hub.jpg",
    "fashion": "demo_sneakers.jpg",
    "groceries": "demo_vegetable_box.jpg",
    "home & kitchen": "demo_coffee_set.jpg",
    "home": "demo_coffee_set.jpg",
    "kitchen": "demo_cutting_board.jpg",
    "general": "demo_vegetable_box.jpg",
}

DEFAULT_IMAGE = "demo_vegetable_box.jpg"


def ensure_demo_images(media_products: Path | None = None, stdout=None):
    media_products = media_products or Path(settings.MEDIA_ROOT) / "products"
    media_products.mkdir(parents=True, exist_ok=True)

    for filename, url in DEMO_PRODUCT_IMAGES.items():
        target = media_products / filename
        if target.exists() and target.stat().st_size > 5000:
            continue
        if target.exists():
            target.unlink()
        if stdout:
            stdout.write(f"Downloading {filename}...")
        urllib.request.urlretrieve(url, target)


def pick_image_filename(product) -> str:
    text = f"{product.name} {product.category or ''}".lower()

    for keywords, filename in IMAGE_KEYWORD_RULES:
        if any(keyword in text for keyword in keywords):
            return filename

    category = (product.category or "").strip().lower()
    if category in CATEGORY_IMAGE_FALLBACK:
        return CATEGORY_IMAGE_FALLBACK[category]

    return DEFAULT_IMAGE


def assign_image_to_product(product, media_products: Path | None = None):
    media_products = media_products or Path(settings.MEDIA_ROOT) / "products"
    filename = pick_image_filename(product)
    source = media_products / filename

    if not source.exists():
        ensure_demo_images(media_products)
        source = media_products / filename

    if not source.exists():
        return False

    if product.image:
        product.image.delete(save=False)

    with source.open("rb") as image_file:
        product.image.save(filename, File(image_file), save=True)

    return True

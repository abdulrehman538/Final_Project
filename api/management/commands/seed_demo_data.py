import shutil
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.contrib.auth.models import Group, User
from django.core.files import File
from django.core.management.base import BaseCommand
from django.utils import timezone

from api.models import Order, OrderItem, Product, UserProfile


DEMO_USERNAMES = [
    "techvault",
    "homehaven",
    "stylestreet",
    "freshfarm",
    "craftbox",
]

DEMO_STORES = [
    {
        "username": "techvault",
        "email": "techvault@demo.cartgo.com",
        "store_name": "TechVault",
        "business_description": "Curated electronics, audio gear, and smart accessories for everyday life.",
        "contact_phone": "555-0101",
        "approved": True,
        "products": [
            {
                "name": "Wireless Noise-Canceling Headphones",
                "description": "40-hour battery, plush ear cushions, and crisp balanced sound for travel and focus.",
                "price": "129.99",
                "stock": 18,
                "category": "Electronics",
                "image": "pexels-cmonphotography-1809644.jpg",
            },
            {
                "name": "Mechanical Keyboard RGB",
                "description": "Hot-swappable switches with soft linear feel and per-key lighting.",
                "price": "89.50",
                "stock": 12,
                "category": "Electronics",
                "image": "gm1.jpg",
            },
            {
                "name": "USB-C Fast Charging Hub",
                "description": "7-port desktop hub with 100W pass-through charging for laptops.",
                "price": "54.00",
                "stock": 25,
                "category": "Electronics",
                "image": "bbcc9dd12f8853ddd37922e1003d913d.jpg",
            },
            {
                "name": "Portable Bluetooth Speaker",
                "description": "Water-resistant outdoor speaker with deep bass and 12-hour playtime.",
                "price": "39.99",
                "stock": 4,
                "category": "Electronics",
                "image": "071341d0aeb9a301ca53f2814abd5105.jpg",
            },
        ],
    },
    {
        "username": "homehaven",
        "email": "homehaven@demo.cartgo.com",
        "store_name": "HomeHaven",
        "business_description": "Comfort-first home essentials, kitchen tools, and cozy decor.",
        "contact_phone": "555-0102",
        "approved": True,
        "products": [
            {
                "name": "Ceramic Pour-Over Coffee Set",
                "description": "Hand-glazed dripper and carafe set for smooth morning brews.",
                "price": "42.00",
                "stock": 15,
                "category": "Home & Kitchen",
                "image": "gm2.jfif",
            },
            {
                "name": "Linen Throw Blanket",
                "description": "Breathable stonewashed linen in neutral tones for all seasons.",
                "price": "68.00",
                "stock": 9,
                "category": "Home & Kitchen",
                "image": "s.jpg",
            },
            {
                "name": "Bamboo Cutting Board Set",
                "description": "Three sized boards with juice grooves and non-slip feet.",
                "price": "34.50",
                "stock": 22,
                "category": "Home & Kitchen",
                "image": "gm1.jpg",
            },
        ],
    },
    {
        "username": "stylestreet",
        "email": "stylestreet@demo.cartgo.com",
        "store_name": "StyleStreet",
        "business_description": "Trend-led fashion, sneakers, and accessories with weekly drops.",
        "contact_phone": "555-0103",
        "approved": True,
        "products": [
            {
                "name": "Classic Leather Sneakers",
                "description": "Minimal white leather sneakers with cushioned insole.",
                "price": "79.00",
                "stock": 14,
                "category": "Fashion",
                "image": "s.jpg",
            },
            {
                "name": "Canvas Weekender Bag",
                "description": "Spacious carry-all with reinforced straps and interior pockets.",
                "price": "56.00",
                "stock": 11,
                "category": "Fashion",
                "image": "bbcc9dd12f8853ddd37922e1003d913d.jpg",
            },
            {
                "name": "Polarized Sunglasses",
                "description": "UV400 protection with lightweight metal frame.",
                "price": "29.00",
                "stock": 3,
                "category": "Fashion",
                "image": "pexels-cmonphotography-1809644.jpg",
            },
        ],
    },
    {
        "username": "freshfarm",
        "email": "freshfarm@demo.cartgo.com",
        "store_name": "FreshFarm Market",
        "business_description": "Farm-direct produce boxes and pantry staples delivered fresh.",
        "contact_phone": "555-0104",
        "approved": True,
        "products": [
            {
                "name": "Organic Vegetable Box",
                "description": "Weekly mixed seasonal vegetables from local partner farms.",
                "price": "24.99",
                "stock": 30,
                "category": "Groceries",
                "image": "071341d0aeb9a301ca53f2814abd5105.jpg",
            },
            {
                "name": "Artisan Sourdough Loaf",
                "description": "Slow-fermented bakery loaf baked daily.",
                "price": "6.50",
                "stock": 20,
                "category": "Groceries",
                "image": "gm2.jfif",
            },
            {
                "name": "Cold-Pressed Olive Oil",
                "description": "Single-origin extra virgin olive oil in 500ml bottle.",
                "price": "18.00",
                "stock": 16,
                "category": "Groceries",
                "image": "gm1.jpg",
            },
        ],
    },
    {
        "username": "craftbox",
        "email": "craftbox@demo.cartgo.com",
        "store_name": "CraftBox Studio",
        "business_description": "Handmade gifts, stationery, and DIY craft kits from independent makers.",
        "contact_phone": "555-0105",
        "approved": False,
        "products": [],
    },
]


class Command(BaseCommand):
    help = "Seed demo stores, products with images, and sample orders for testing."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Remove previously seeded demo users and their data before seeding.",
        )

    def handle(self, *args, **options):
        if options["reset"]:
            self._reset_demo_data()

        media_products = Path(settings.MEDIA_ROOT) / "products"
        media_products.mkdir(parents=True, exist_ok=True)

        seller_group, _ = Group.objects.get_or_create(name="Seller")
        created_products = 0

        for store in DEMO_STORES:
            user, user_created = User.objects.get_or_create(
                username=store["username"],
                defaults={"email": store["email"]},
            )
            if user_created or not user.has_usable_password():
                user.set_password("demoshop123")
                user.save(update_fields=["password"])

            profile, _ = UserProfile.objects.get_or_create(user=user)
            profile.store_name = store["store_name"]
            profile.business_description = store["business_description"]
            profile.contact_phone = store["contact_phone"]
            profile.terms_accepted = True
            profile.full_name = store["store_name"]
            if store["approved"]:
                profile.is_seller = True
                profile.seller_status = "approved"
                user.groups.add(seller_group)
            else:
                profile.is_seller = False
                profile.seller_status = "pending"
            profile.save()

            if store["approved"]:
                for item in store["products"]:
                    product, created = Product.objects.get_or_create(
                        owner=user,
                        name=item["name"],
                        defaults={
                            "description": item["description"],
                            "price": Decimal(item["price"]),
                            "stock": item["stock"],
                            "category": item["category"],
                            "store_name": store["store_name"],
                        },
                    )
                    if not created:
                        product.description = item["description"]
                        product.price = Decimal(item["price"])
                        product.stock = item["stock"]
                        product.category = item["category"]
                        product.store_name = store["store_name"]
                        product.save()

                    source_image = media_products / item["image"]
                    if source_image.exists():
                        seed_name = f"seed_{store['username']}_{item['image']}"
                        seed_path = media_products / seed_name
                        if not seed_path.exists():
                            shutil.copy2(source_image, seed_path)
                        with seed_path.open("rb") as image_file:
                            product.image.save(seed_name, File(image_file), save=True)

                    created_products += 1

        self._seed_sample_orders()
        self.stdout.write(self.style.SUCCESS(
            f"Demo data ready: {len(DEMO_STORES)} stores, {created_products} products. "
            "Login any seller with password: demoshop123"
        ))

    def _reset_demo_data(self):
        demo_users = User.objects.filter(username__in=DEMO_USERNAMES)
        Product.objects.filter(owner__in=demo_users).delete()
        Order.objects.filter(customer_name__startswith="Demo Buyer").delete()
        demo_users.delete()
        self.stdout.write("Removed previous demo users and related catalog data.")

    def _seed_sample_orders(self):
        products = list(
            Product.objects.filter(owner__username__in=DEMO_USERNAMES[:4])
            .select_related("owner")
            .order_by("id")[:6]
        )
        if not products:
            return

        now = timezone.now()
        day_offsets = [6, 5, 4, 3, 2, 1, 0]
        buyers = [
            ("Demo Buyer A", "555-2001", "buyer.a@demo.com"),
            ("Demo Buyer B", "555-2002", "buyer.b@demo.com"),
            ("Demo Buyer C", "555-2003", "buyer.c@demo.com"),
        ]

        for index, offset in enumerate(day_offsets):
            buyer = buyers[index % len(buyers)]
            product = products[index % len(products)]
            quantity = 1 + (index % 3)
            total = Decimal(product.price) * quantity
            created_at = now - timezone.timedelta(days=offset, hours=index)

            order = Order.objects.create(
                customer_name=buyer[0],
                customer_phone=buyer[1],
                customer_email=buyer[2],
                shipping_address='{"address1":"100 Demo Street","postal_code":"44000"}',
                status="confirmed" if index % 2 == 0 else "pending",
                total_price=total,
            )
            Order.objects.filter(pk=order.pk).update(created_at=created_at)

            OrderItem.objects.create(
                order=order,
                product=product,
                quantity=quantity,
                price=product.price,
                seller=product.owner,
            )

            if product.stock >= quantity:
                product.stock -= quantity
                product.save(update_fields=["stock"])

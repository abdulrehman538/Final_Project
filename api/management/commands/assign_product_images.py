from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from api.demo_product_images import assign_image_to_product, ensure_demo_images
from api.models import Product


class Command(BaseCommand):
    help = "Assign a product-specific photo to every product in the catalog."

    def add_arguments(self, parser):
        parser.add_argument(
            "--only-missing",
            action="store_true",
            help="Only update products that have no image.",
        )

    def handle(self, *args, **options):
        media_products = Path(settings.MEDIA_ROOT) / "products"
        ensure_demo_images(media_products, stdout=self.stdout)

        products = Product.objects.all().order_by("id")
        updated = 0
        skipped = 0

        for product in products:
            if options["only_missing"] and product.image:
                skipped += 1
                continue

            if assign_image_to_product(product, media_products):
                updated += 1
                self.stdout.write(f"  {product.id}: {product.name} -> {product.image.name}")
            else:
                self.stdout.write(self.style.WARNING(f"  Skipped {product.id}: {product.name}"))

        self.stdout.write(self.style.SUCCESS(
            f"Done. Updated {updated} product(s), skipped {skipped}."
        ))

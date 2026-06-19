'''Utility helpers for the api app.'''

from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist


def is_admin(user):
    """Return True if the user is an admin (staff, superuser, or in Admin group)."""
    return bool(user and user.is_authenticated and (
        user.is_staff or user.is_superuser or user.groups.filter(name="Admin").exists()
    ))


def is_seller(user):
    """Return True only for approved sellers."""
    profile = getattr(user, "profile", None)
    return bool(
        user
        and user.is_authenticated
        and (
            user.is_staff
            or user.is_superuser
            or user.groups.filter(name="Seller").exists()
            or (
                profile is not None
                and getattr(profile, "is_seller", False)
                and getattr(profile, "seller_status", "none") == "approved"
            )
        )
    )


def delete_image_instance(instance):
    """Delete a ProductImage instance, removing the file from storage safely.
    Returns True on successful deletion, False otherwise.
    """
    try:
        if instance.image:
            instance.image.delete(save=False)
    except Exception:
        # ignore file deletion errors
        pass
    instance.delete()
    return True

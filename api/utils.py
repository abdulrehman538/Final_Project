"""Utility helpers for the api app."""


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


def get_user_role(user):
    """Return the official app role for an authenticated user.

    Only ``admin`` and ``seller`` are official roles. Everyone else is a
    regular account that can browse and purchase without a separate role.
    """
    if is_admin(user):
        return "admin"
    if is_seller(user):
        return "seller"
    return "user"


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

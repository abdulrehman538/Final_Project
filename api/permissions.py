from rest_framework.permissions import BasePermission, SAFE_METHODS


def is_admin(user):
    return bool(user and user.is_authenticated and (user.is_staff or user.is_superuser or user.groups.filter(name="Admin").exists()))


def is_seller(user):
    return bool(
        user
        and user.is_authenticated
        and (
            user.is_staff
            or user.is_superuser
            or user.groups.filter(name="Seller").exists()
            or (
                getattr(user, "profile", None) is not None
                and getattr(user.profile, "is_seller", False)
            )
        )
    )


class IsSellerOrAdminOrReadOnly(BasePermission):
    message = "You do not have permission to modify products."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True

        if not request.user or not request.user.is_authenticated:
            return False

        return is_admin(request.user) or is_seller(request.user)

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True

        if is_admin(request.user):
            return True

        return is_seller(request.user) and getattr(obj, "owner_id", None) == request.user.id

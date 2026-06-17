from rest_framework.permissions import BasePermission, SAFE_METHODS

# Permission helper imports
from .utils import is_admin, is_seller


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

from django.contrib import admin
from .models import (
    Product,
    ProductImage,
    UserProfile,
    ProductComment,
    Order,
    OrderItem,
    Cart,
    CartItem,
)


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "owner",
        "store_name",
        "category",
        "price",
        "stock",
        "created_at",
    )
    search_fields = (
        "name",
        "category",
        "store_name",
        "owner__username",
    )
    list_filter = (
        "category",
        "created_at",
    )
    ordering = ("-created_at",)
    inlines = [ProductImageInline]


@admin.register(ProductImage)
class ProductImageAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "product",
        "uploaded_at",
    )
    search_fields = (
        "product__name",
    )
    ordering = ("-uploaded_at",)


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "full_name",
        "is_seller",
        "store_name",
        "phone",
        "updated_at",
    )
    search_fields = (
        "user__username",
        "user__email",
        "full_name",
        "store_name",
        "phone",
    )
    list_filter = (
        "is_seller",
    )
    ordering = ("user__username",)


@admin.register(ProductComment)
class ProductCommentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "product",
        "user",
        "created_at",
    )
    search_fields = (
        "product__name",
        "user__username",
        "body",
    )
    list_filter = (
        "created_at",
    )
    ordering = ("-created_at",)


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "buyer",
        "status",
        "total_price",
        "created_at",
    )
    search_fields = (
        "buyer__username",
    )
    list_filter = (
        "status",
        "created_at",
    )
    ordering = ("-created_at",)
    inlines = [OrderItemInline]


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "order",
        "product",
        "seller",
        "quantity",
        "price",
    )
    search_fields = (
        "product__name",
        "seller__username",
    )


class CartItemInline(admin.TabularInline):
    model = CartItem
    extra = 0


@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "created_at",
        "updated_at",
    )
    search_fields = (
        "user__username",
    )
    inlines = [CartItemInline]


@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "cart",
        "product",
        "quantity",
        "added_at",
    )
    search_fields = (
        "product__name",
        "cart__user__username",
    )
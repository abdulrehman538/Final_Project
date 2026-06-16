from rest_framework import serializers
from django.contrib.auth.models import User, Group
from .models import Product, ProductImage, UserProfile, ProductComment, Order, OrderItem

class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ["id", "image"]

class ProductSerializer(serializers.ModelSerializer):
    owner_username = serializers.CharField(
        source="owner.username",
        read_only=True
    )

    images = ProductImageSerializer(
        many=True,
        read_only=True
    )

    class Meta:
        model = Product
        fields = [
            "id",
            "owner",
            "owner_username",
            "name",
            "description",
            "price",
            "stock",
            "image",
            "images",
            "category",
            "store_name",
            "created_at",
        ]

        read_only_fields = [
            "owner",
            "owner_username",
            "created_at",
        ]

class UserRegisterSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True, write_only=True)
    address = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = User
        fields = ["username", "password", "email", "phone", "address"]

    def create(self, validated_data):
        email = validated_data.pop("email", "")
        phone = validated_data.pop("phone", "")
        address = validated_data.pop("address", "")

        user = User.objects.create_user(
            username=validated_data["username"],
            password=validated_data["password"],
            email=email,
        )

        user_group, _ = Group.objects.get_or_create(name="Buyer")
        user.groups.add(user_group)
        profile, created = UserProfile.objects.get_or_create(
            user=user,
            defaults={"phone": phone, "address": address}
        )
        if not created:
            update_fields = []
            if phone:
                profile.phone = phone
                update_fields.append("phone")
            if address:
                profile.address = address
                update_fields.append("address")
            if update_fields:
                profile.save(update_fields=update_fields)

        return user


class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", required=False, allow_blank=True)

    class Meta:
        model = UserProfile
        fields = [
            "username",
            "email",
            "is_seller",
            "store_name",
            "full_name",
            "phone",
            "address",
            "bio",
            "avatar_url",
        ]
        read_only_fields = ["is_seller"]

    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})
        email = user_data.get("email")
        if email is not None:
            instance.user.email = email
            instance.user.save(update_fields=["email"])

        store_name = validated_data.get("store_name")
        if store_name:
            instance.is_seller = True
            seller_group, _ = Group.objects.get_or_create(name="Seller")
            instance.user.groups.add(seller_group)

        updated = super().update(instance, validated_data)
        if store_name:
            updated.is_seller = True
            updated.save(update_fields=["is_seller"])

        return updated


class ProductCommentSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = ProductComment
        fields = ["id", "username", "body", "created_at"]


class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    store_name = serializers.CharField(source="product.store_name", read_only=True)
    seller_username = serializers.CharField(source="seller.username", read_only=True)

    class Meta:
        model = OrderItem
        fields = ["id", "product", "product_name", "store_name", "quantity", "price", "seller_username"]


class OrderSerializer(serializers.ModelSerializer):
    buyer_username = serializers.CharField(source="buyer.username", read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = ["id", "buyer_username", "status", "total_price", "items", "created_at", "updated_at"]
        read_only_fields = ["id", "buyer_username", "created_at", "updated_at"]

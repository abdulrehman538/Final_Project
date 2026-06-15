from rest_framework import serializers
from django.contrib.auth.models import User, Group
from .models import Product, ProductImage, UserProfile, ProductComment

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

    class Meta:
        model = User
        fields = ["username", "password", "email", "phone"]

    def create(self, validated_data):
        email = validated_data.pop("email", "")
        phone = validated_data.pop("phone", "")

        user = User.objects.create_user(
            username=validated_data["username"],
            password=validated_data["password"],
            email=email,
        )

        user_group, _ = Group.objects.get_or_create(name="Buyer")
        user.groups.add(user_group)
        UserProfile.objects.get_or_create(user=user, defaults={"phone": phone})
        if phone:
            profile = user.profile
            profile.phone = phone
            profile.save(update_fields=["phone"])

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

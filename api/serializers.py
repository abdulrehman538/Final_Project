from django.contrib.auth.models import User
from rest_framework import serializers

from .models import (
    Cart,
    CartItem,
    Order,
    OrderItem,
    Product,
    ProductComment,
    ProductImage,
    UserProfile,
)


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ["id", "image"]


class ProductSerializer(serializers.ModelSerializer):
    owner_username = serializers.CharField(
        source="owner.username",
        read_only=True,
    )

    images = ProductImageSerializer(
        many=True,
        read_only=True,
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
    store_name = serializers.CharField(required=False, allow_blank=True, write_only=True)
    business_description = serializers.CharField(required=False, allow_blank=True, write_only=True)
    contact_phone = serializers.CharField(required=False, allow_blank=True, write_only=True)
    terms_accepted = serializers.BooleanField(required=False, default=False, write_only=True)
    apply_as_seller = serializers.BooleanField(required=False, default=False, write_only=True)

    class Meta:
        model = User
        fields = [
            "username",
            "password",
            "email",
            "phone",
            "address",
            "store_name",
            "business_description",
            "contact_phone",
            "terms_accepted",
            "apply_as_seller",
        ]

    def validate(self, attrs):
        if attrs.get("apply_as_seller"):
            if not (attrs.get("store_name") or "").strip():
                raise serializers.ValidationError({"store_name": "Store name is required for seller signup."})
            if not (attrs.get("business_description") or "").strip():
                raise serializers.ValidationError(
                    {"business_description": "Business description is required for seller signup."}
                )
            if not attrs.get("terms_accepted"):
                raise serializers.ValidationError({"terms_accepted": "You must accept the seller terms."})
        return attrs

    def create(self, validated_data):
        email = validated_data.pop("email", "")
        phone = validated_data.pop("phone", "")
        address = validated_data.pop("address", "")
        store_name = (validated_data.pop("store_name", "") or "").strip()
        business_description = (validated_data.pop("business_description", "") or "").strip()
        contact_phone = (validated_data.pop("contact_phone", "") or "").strip()
        terms_accepted = bool(validated_data.pop("terms_accepted", False))
        apply_as_seller = bool(validated_data.pop("apply_as_seller", False))

        user = User.objects.create_user(
            username=validated_data["username"],
            password=validated_data["password"],
            email=email,
        )

        profile_defaults = {
            "phone": phone,
            "address": address,
        }

        if apply_as_seller:
            profile_defaults.update(
                {
                    "store_name": store_name,
                    "business_description": business_description,
                    "contact_phone": contact_phone or phone,
                    "terms_accepted": terms_accepted,
                    "seller_status": "pending",
                    "is_seller": False,
                }
            )

        profile, created = UserProfile.objects.get_or_create(
            user=user,
            defaults=profile_defaults,
        )

        if not created:
            update_fields = []

            if phone:
                profile.phone = phone
                update_fields.append("phone")

            if address:
                profile.address = address
                update_fields.append("address")

            if apply_as_seller:
                profile.store_name = store_name
                profile.business_description = business_description
                profile.contact_phone = contact_phone or phone
                profile.terms_accepted = terms_accepted
                profile.seller_status = "pending"
                profile.is_seller = False
                update_fields.extend(
                    [
                        "store_name",
                        "business_description",
                        "contact_phone",
                        "terms_accepted",
                        "seller_status",
                        "is_seller",
                    ]
                )

            if update_fields:
                profile.save(update_fields=update_fields)

        return user


class UserProfileSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(
        source="user.id",
        read_only=True,
    )

    username = serializers.CharField(
        source="user.username",
        read_only=True,
    )

    email = serializers.EmailField(
        source="user.email",
        required=False,
        allow_blank=True,
    )

    date_joined = serializers.DateTimeField(
        source="user.date_joined",
        read_only=True,
    )

    class Meta:
        model = UserProfile
        fields = [
            "user_id",
            "username",
            "email",
            "date_joined",
            "is_seller",
            "seller_status",
            "store_name",
            "business_description",
            "contact_phone",
            "terms_accepted",
            "full_name",
            "phone",
            "address",
            "bio",
            "avatar_url",
            "updated_at",
        ]
        read_only_fields = [
            "is_seller",
            "seller_status",
            "updated_at",
        ]

    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})

        email = user_data.get("email")
        if email is not None:
            instance.user.email = email
            instance.user.save(update_fields=["email"])

        should_apply_for_seller = bool(
            validated_data.get("store_name")
            or validated_data.get("business_description")
            or validated_data.get("contact_phone")
            or validated_data.get("terms_accepted") is True
        )

        if should_apply_for_seller:
            instance.seller_status = "pending"
            instance.is_seller = False

        updated = super().update(instance, validated_data)

        if should_apply_for_seller:
            updated.seller_status = "pending"
            updated.is_seller = False
            updated.save(update_fields=["seller_status", "is_seller"])

        return updated


class AdminStoreSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    product_count = serializers.IntegerField(read_only=True)
    featured_image = serializers.SerializerMethodField()

    def get_featured_image(self, obj):
        product = (
            Product.objects.filter(owner=obj.user)
            .exclude(image="")
            .exclude(image__isnull=True)
            .order_by("-created_at")
            .first()
        )
        if not product or not product.image:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(product.image.url)
        return product.image.url

    class Meta:
        model = UserProfile
        fields = [
            "user_id",
            "username",
            "email",
            "store_name",
            "business_description",
            "contact_phone",
            "seller_status",
            "is_seller",
            "updated_at",
            "product_count",
            "featured_image",
        ]


class AdminStoreDetailSerializer(AdminStoreSerializer):
    products = serializers.SerializerMethodField()

    def get_products(self, obj):
        products = (
            Product.objects.filter(owner=obj.user)
            .select_related("owner")
            .prefetch_related("images")
            .order_by("-created_at")
        )
        return ProductSerializer(products, many=True, context=self.context).data

    class Meta(AdminStoreSerializer.Meta):
        fields = AdminStoreSerializer.Meta.fields + ["products"]


class AdminLowStockProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ["id", "name", "stock", "price", "store_name", "category"]


class ProductCommentSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        source="user.username",
        read_only=True,
    )

    class Meta:
        model = ProductComment
        fields = ["id", "username", "body", "created_at"]


class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(
        source="product.name",
        read_only=True,
    )

    store_name = serializers.CharField(
        source="product.store_name",
        read_only=True,
    )

    seller_username = serializers.CharField(
        source="seller.username",
        read_only=True,
    )

    class Meta:
        model = OrderItem
        fields = [
            "id",
            "product",
            "product_name",
            "store_name",
            "quantity",
            "price",
            "seller_username",
        ]


class OrderSerializer(serializers.ModelSerializer):
    customer_username = serializers.CharField(
        source="buyer.username",
        read_only=True,
    )

    display_customer = serializers.SerializerMethodField()

    def get_display_customer(self, obj):
        if obj.buyer_id:
            return obj.buyer.username
        return obj.customer_name or "Guest"

    items = OrderItemSerializer(
        many=True,
        read_only=True,
    )

    class Meta:
        model = Order
        fields = [
            "id",
            "customer_username",
            "display_customer",
            "customer_name",
            "customer_phone",
            "customer_email",
            "shipping_address",
            "status",
            "total_price",
            "items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "customer_username",
            "display_customer",
            "created_at",
            "updated_at",
        ]


class CartItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = CartItem
        fields = ["id", "product", "product_id", "quantity"]
        read_only_fields = ["id"]


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)

    class Meta:
        model = Cart
        fields = ["id", "user", "items"]
        read_only_fields = ["id", "user"]

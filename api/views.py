from rest_framework import generics, parsers, status
from rest_framework.permissions import IsAuthenticated, AllowAny, SAFE_METHODS
from rest_framework.response import Response
from django.contrib.auth.models import User, Group
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
from django.shortcuts import get_object_or_404

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

from .stock import aggregate_cart_quantities, deduct_product_stock, restore_order_stock
from .serializers import (
    ProductSerializer,
    UserRegisterSerializer,
    UserProfileSerializer,
    AdminStoreSerializer,
    AdminLowStockProductSerializer,
    ProductCommentSerializer,
    OrderSerializer,
    ProductImageSerializer,
    CartSerializer,
)

from .permissions import IsSellerOrAdminOrReadOnly
from .authentication import OptionalJWTAuthentication
from .utils import delete_image_instance, get_user_role, is_admin, is_seller


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserRegisterSerializer


class CheckUsernameView(generics.GenericAPIView):
    def get(self, request):
        username = request.query_params.get("username", "").strip()
        if not username:
            return Response({"available": False, "error": "No username provided."})
        taken = User.objects.filter(username__iexact=username).exists()
        return Response({"available": not taken})


class UserRoleView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = getattr(request.user, "profile", None)
        return Response(
            {
                "role": get_user_role(request.user),
                "seller_status": getattr(profile, "seller_status", "none"),
                "is_seller": bool(getattr(profile, "is_seller", False)),
            }
        )


class ProductSearchView(generics.ListAPIView):
    serializer_class = ProductSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        query = (self.request.query_params.get("q") or "").strip()
        queryset = Product.objects.select_related("owner").prefetch_related("images")
        if not query:
            return queryset.none()

        terms = [term for term in query.split() if term]
        if not terms:
            return queryset.none()

        q_object = Q()
        for term in terms:
            q_object |= Q(name__icontains=term)
            q_object |= Q(description__icontains=term)
            q_object |= Q(category__icontains=term)
            q_object |= Q(store_name__icontains=term)

        return queryset.filter(q_object)[:20]


class SellerRequestListView(generics.ListAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if not is_admin(self.request.user):
            return UserProfile.objects.none()
        return UserProfile.objects.filter(seller_status="pending").select_related("user").order_by("-updated_at")


class ApproveSellerRequestView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not is_admin(request.user):
            return Response({"detail": "Only admins can approve seller requests."}, status=status.HTTP_403_FORBIDDEN)

        user_id = request.data.get("user_id")
        if not user_id:
            return Response({"detail": "user_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        profile = UserProfile.objects.select_related("user").filter(user_id=user_id).first()
        if not profile:
            return Response({"detail": "Seller request not found."}, status=status.HTTP_404_NOT_FOUND)

        profile.seller_status = "approved"
        profile.is_seller = True
        profile.save(update_fields=["seller_status", "is_seller", "updated_at"])

        seller_group, _ = Group.objects.get_or_create(name="Seller")
        profile.user.groups.add(seller_group)

        return Response({
            "detail": "Seller approved.",
            "username": profile.user.username,
            "seller_status": profile.seller_status,
            "is_seller": profile.is_seller,
        })


class RejectSellerRequestView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not is_admin(request.user):
            return Response({"detail": "Only admins can reject seller requests."}, status=status.HTTP_403_FORBIDDEN)

        user_id = request.data.get("user_id")
        if not user_id:
            return Response({"detail": "user_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        profile = UserProfile.objects.select_related("user").filter(user_id=user_id).first()
        if not profile:
            return Response({"detail": "Seller request not found."}, status=status.HTTP_404_NOT_FOUND)

        profile.seller_status = "rejected"
        profile.is_seller = False
        profile.save(update_fields=["seller_status", "is_seller", "updated_at"])

        return Response({
            "detail": "Seller request rejected.",
            "username": profile.user.username,
            "seller_status": profile.seller_status,
            "is_seller": profile.is_seller,
        })


class AdminOrdersView(generics.ListAPIView):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if not is_admin(self.request.user):
            return Order.objects.none()
        return Order.objects.select_related("buyer").prefetch_related("items").order_by("-created_at")


class AdminDashboardStatsView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not is_admin(request.user):
            return Response(
                {"detail": "Only admins can access dashboard stats."},
                status=status.HTTP_403_FORBIDDEN,
            )

        revenue_total = Order.objects.exclude(status="cancelled").aggregate(
            total=Sum("total_price")
        )["total"] or Decimal("0")

        today = timezone.now().date()
        order_volume = []
        max_day_total = Decimal("0")

        for offset in range(6, -1, -1):
            day = today - timedelta(days=offset)
            day_orders = Order.objects.filter(created_at__date=day)
            day_total = day_orders.exclude(status="cancelled").aggregate(
                total=Sum("total_price")
            )["total"] or Decimal("0")
            if day_total > max_day_total:
                max_day_total = day_total
            order_volume.append({
                "date": day.isoformat(),
                "label": day.strftime("%a"),
                "total": float(day_total),
                "orders": day_orders.count(),
            })

        low_stock_products = Product.objects.filter(stock__lte=5).order_by("stock", "name")[:8]

        return Response({
            "users_count": User.objects.count(),
            "active_sellers": UserProfile.objects.filter(
                is_seller=True,
                seller_status="approved",
            ).count(),
            "pending_applications": UserProfile.objects.filter(seller_status="pending").count(),
            "products_count": Product.objects.count(),
            "orders_count": Order.objects.count(),
            "revenue_total": str(revenue_total),
            "low_stock_count": Product.objects.filter(stock__gt=0, stock__lte=5).count(),
            "out_of_stock_count": Product.objects.filter(stock=0).count(),
            "order_volume": order_volume,
            "order_volume_max": float(max_day_total) if max_day_total > 0 else 1,
            "low_stock_products": AdminLowStockProductSerializer(
                low_stock_products,
                many=True,
            ).data,
        })


class AdminStoresListView(generics.ListAPIView):
    serializer_class = AdminStoreSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if not is_admin(self.request.user):
            return UserProfile.objects.none()

        queryset = UserProfile.objects.filter(
            is_seller=True,
            seller_status="approved",
        ).select_related("user").annotate(
            product_count=Count("user__products", distinct=True),
        ).order_by("store_name")

        search = (self.request.query_params.get("q") or "").strip()
        if search:
            queryset = queryset.filter(
                Q(store_name__icontains=search)
                | Q(user__username__icontains=search)
                | Q(contact_phone__icontains=search)
                | Q(business_description__icontains=search)
            )

        return queryset


class OrderStatusUpdateView(generics.GenericAPIView):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        order = get_object_or_404(Order, pk=pk)
        new_status = (request.data.get("status") or "").strip().lower()

        if new_status not in dict(Order.STATUS_CHOICES):
            return Response({"detail": "Invalid status."}, status=status.HTTP_400_BAD_REQUEST)

        is_order_owner = order.buyer_id == request.user.id
        is_seller_for_order = bool(order.items.filter(seller=request.user).exists())
        if not (is_admin(request.user) or is_seller_for_order or (is_order_owner and new_status in {"delivered", "completed"})):
            return Response({"detail": "You do not have permission to update this order."}, status=status.HTTP_403_FORBIDDEN)

        allowed_transitions = {
            "pending": {"confirmed", "cancelled"},
            "confirmed": {"shipped", "cancelled"},
            "shipped": {"delivered", "cancelled"},
            "delivered": {"completed", "cancelled"},
            "completed": set(),
            "cancelled": set(),
        }

        if new_status not in allowed_transitions.get(order.status, set()):
            return Response({"detail": f"Cannot move from {order.status} to {new_status}."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            locked_order = Order.objects.select_for_update().prefetch_related("items").get(pk=order.pk)
            previous_status = locked_order.status

            if new_status not in allowed_transitions.get(previous_status, set()):
                return Response(
                    {"detail": f"Cannot move from {previous_status} to {new_status}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if new_status == "cancelled" and previous_status != "cancelled":
                restore_order_stock(locked_order)

            locked_order.status = new_status
            locked_order.save(update_fields=["status", "updated_at"])
            order = locked_order

        return Response(self.get_serializer(order).data)


class OrderDeliveryConfirmationView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        order = get_object_or_404(Order, pk=pk)
        if order.buyer_id != request.user.id:
            return Response({"detail": "Only the customer who placed this order can confirm delivery."}, status=status.HTTP_403_FORBIDDEN)

        if order.status == "shipped":
            order.status = "delivered"
        elif order.status == "delivered":
            order.status = "completed"
        else:
            return Response({"detail": "This order cannot be confirmed yet."}, status=status.HTTP_400_BAD_REQUEST)

        order.save(update_fields=["status", "updated_at"])
        return Response(OrderSerializer(order).data)


class ProductListCreateView(generics.ListCreateAPIView):
    queryset = Product.objects.select_related("owner")
    serializer_class = ProductSerializer
    permission_classes = [IsSellerOrAdminOrReadOnly]

    parser_classes = (
        parsers.MultiPartParser,
        parsers.FormParser,
    )

    def perform_create(self, serializer):
        user = self.request.user
        profile = getattr(user, "profile", None)

        product = serializer.save(
            owner=user,
            store_name=getattr(profile, "store_name", ""),
        )

        uploaded_files = self.request.FILES.getlist("images")

        for image in uploaded_files:
            ProductImage.objects.create(
                product=product,
                image=image,
            )


class ProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Product.objects.select_related("owner")
    serializer_class = ProductSerializer
    permission_classes = [IsSellerOrAdminOrReadOnly]

    parser_classes = (
        parsers.MultiPartParser,
        parsers.FormParser,
    )

    def perform_update(self, serializer):
        product = serializer.save()

        uploaded_files = self.request.FILES.getlist("images")

        for image in uploaded_files:
            ProductImage.objects.create(
                product=product,
                image=image,
            )


class ProfileView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserProfileSerializer

    def get_object(self):
        profile, _ = UserProfile.objects.get_or_create(
            user=self.request.user
        )
        return profile


class ProductCommentListCreateView(generics.ListCreateAPIView):
    serializer_class = ProductCommentSerializer

    def get_permissions(self):
        if self.request.method in SAFE_METHODS:
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return ProductComment.objects.filter(
            product_id=self.kwargs["pk"]
        ).select_related("user", "product")

    def perform_create(self, serializer):
        product = Product.objects.get(pk=self.kwargs["pk"])
        serializer.save(
            user=self.request.user,
            product=product,
        )


class ProductImageDetailView(generics.DestroyAPIView):
    queryset = ProductImage.objects.all()
    serializer_class = ProductImageSerializer
    permission_classes = [IsAuthenticated]

    def delete(self, request, *args, **kwargs):
        obj = self.get_object()
        user = request.user
        if not (is_admin(user) or (is_seller(user) and getattr(obj.product, "owner_id", None) == user.id)):
            return Response(
                {"detail": "You do not have permission to delete this image."},
                status=status.HTTP_403_FORBIDDEN,
            )

        delete_image_instance(obj)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CartView(generics.GenericAPIView):
    """Server-side cart for authenticated shoppers."""
    permission_classes = [IsAuthenticated]
    serializer_class = CartSerializer

    def get_cart(self):
        cart, _ = Cart.objects.get_or_create(user=self.request.user)
        return Cart.objects.prefetch_related(
            "items__product__images",
            "items__product__owner",
        ).get(pk=cart.pk)

    def get(self, request):
        return Response(CartSerializer(self.get_cart()).data)

    def post(self, request):
        product_id = request.data.get("product_id")
        if not product_id:
            return Response({"detail": "product_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            quantity = max(1, int(request.data.get("quantity", 1)))
        except (TypeError, ValueError):
            return Response({"detail": "Invalid quantity."}, status=status.HTTP_400_BAD_REQUEST)

        product = get_object_or_404(Product, pk=product_id)
        cart, _ = Cart.objects.get_or_create(user=request.user)
        item, created = CartItem.objects.get_or_create(
            cart=cart,
            product=product,
            defaults={"quantity": quantity},
        )

        if not created:
            next_qty = item.quantity + quantity
            if product.stock:
                next_qty = min(next_qty, product.stock)
            item.quantity = next_qty
            item.save(update_fields=["quantity"])
        elif product.stock and item.quantity > product.stock:
            item.quantity = product.stock
            item.save(update_fields=["quantity"])

        return Response(CartSerializer(self.get_cart()).data)

    def patch(self, request):
        product_id = request.data.get("product_id")
        if not product_id:
            return Response({"detail": "product_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            quantity = int(request.data.get("quantity", 1))
        except (TypeError, ValueError):
            return Response({"detail": "Invalid quantity."}, status=status.HTTP_400_BAD_REQUEST)

        if quantity <= 0:
            return self._remove_item(product_id)

        product = get_object_or_404(Product, pk=product_id)
        cart, _ = Cart.objects.get_or_create(user=request.user)
        item, _ = CartItem.objects.get_or_create(
            cart=cart,
            product=product,
            defaults={"quantity": quantity},
        )
        next_qty = max(quantity, 1)
        if product.stock:
            next_qty = min(next_qty, product.stock)
        item.quantity = next_qty
        item.save(update_fields=["quantity"])
        return Response(CartSerializer(self.get_cart()).data)

    def delete(self, request):
        product_id = request.data.get("product_id") or request.query_params.get("product_id")
        if product_id:
            return self._remove_item(product_id)

        cart = Cart.objects.filter(user=request.user).first()
        if cart:
            cart.items.all().delete()
        return Response(CartSerializer(self.get_cart()).data)

    def _remove_item(self, product_id):
        cart = Cart.objects.filter(user=self.request.user).first()
        if cart:
            CartItem.objects.filter(cart=cart, product_id=product_id).delete()
        return Response(CartSerializer(self.get_cart()).data)


class CheckoutView(generics.GenericAPIView):
    """
    Handles cart checkout for guests and authenticated users.
    - Creates an Order with OrderItems
    - Decreases product stock
    - Validates stock availability
    """
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]
    serializer_class = OrderSerializer

    def post(self, request):
        cart_items = request.data.get('items', [])

        quantities = aggregate_cart_quantities(cart_items if isinstance(cart_items, list) else [])

        if not quantities:
            return Response(
                {'detail': 'Cart is empty'},
                status=status.HTTP_400_BAD_REQUEST
            )

        customer_name = (request.data.get('customer_name') or '').strip()
        customer_phone = (request.data.get('customer_phone') or '').strip()
        customer_email = (request.data.get('customer_email') or '').strip()
        shipping_address = (request.data.get('shipping_address') or '').strip()

        if not request.user.is_authenticated:
            if not customer_name:
                return Response(
                    {'detail': 'Customer name is required for guest checkout.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not shipping_address:
                return Response(
                    {'detail': 'Shipping address is required for guest checkout.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            with transaction.atomic():
                order_items_data = []
                total_price = 0

                product_ids = sorted(quantities.keys())
                products = {
                    product.id: product
                    for product in Product.objects.select_for_update().filter(id__in=product_ids)
                }

                for product_id in product_ids:
                    quantity = quantities[product_id]
                    product = products.get(product_id)

                    if not product:
                        return Response(
                            {'detail': f'Product {product_id} not found'},
                            status=status.HTTP_404_NOT_FOUND
                        )

                    if product.stock < quantity:
                        return Response(
                            {
                                'detail': (
                                    f'Insufficient stock for {product.name}. '
                                    f'Available: {product.stock}, requested: {quantity}'
                                )
                            },
                            status=status.HTTP_400_BAD_REQUEST
                        )

                    order_items_data.append({
                        'product': product,
                        'quantity': quantity,
                        'price': product.price,
                        'seller': product.owner,
                    })

                    total_price += float(product.price) * quantity

                buyer = request.user if request.user.is_authenticated else None

                order = Order.objects.create(
                    buyer=buyer,
                    customer_name=customer_name,
                    customer_phone=customer_phone,
                    customer_email=customer_email,
                    shipping_address=shipping_address,
                    status='pending',
                    total_price=total_price
                )

                for item_data in order_items_data:
                    product = item_data['product']
                    quantity = item_data['quantity']

                    OrderItem.objects.create(
                        order=order,
                        product=product,
                        quantity=quantity,
                        price=item_data['price'],
                        seller=product.owner
                    )

                    deduct_product_stock(product, quantity)

                if request.user.is_authenticated:
                    cart = Cart.objects.filter(user=request.user).first()
                    if cart:
                        cart.items.all().delete()

                serializer = self.get_serializer(order)
                return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response(
                {'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class OrderListView(generics.ListAPIView):
    """Get all orders placed by the authenticated user."""
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(buyer=self.request.user).prefetch_related('items').order_by('-created_at')


class SellerOrdersView(generics.ListAPIView):
    """Get all orders containing items sold by the authenticated seller"""
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Only sellers can use this endpoint
        if not is_seller(self.request.user):
            return Order.objects.none()

        # Get all orders that contain items sold by this seller
        return Order.objects.filter(
            items__seller=self.request.user
        ).distinct().select_related("buyer").prefetch_related("items").order_by("-created_at")


class SellerProductsView(generics.ListAPIView):
    """Get all products created by the authenticated seller"""
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Only sellers can access their own products
        if not is_seller(self.request.user):
            return Product.objects.none()

        return Product.objects.filter(owner=self.request.user).select_related("owner")
from rest_framework import generics, parsers, status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.contrib.auth.models import User, Group
from django.db import transaction
from django.db.models import Q
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

from .serializers import (
    ProductSerializer,
    UserRegisterSerializer,
    UserProfileSerializer,
    ProductCommentSerializer,
    OrderSerializer,
    OrderItemSerializer,
    ProductImageSerializer,
    CartSerializer,
)

from .permissions import IsSellerOrAdminOrReadOnly
from .utils import is_admin, is_seller


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
        if is_admin(request.user):
            return Response({"role": "admin"})

        if is_seller(request.user):
            return Response({"role": "seller"})

        return Response({"role": "buyer"})


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

        order.status = new_status
        order.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(order).data)


class OrderDeliveryConfirmationView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        order = get_object_or_404(Order, pk=pk)
        if order.buyer_id != request.user.id:
            return Response({"detail": "Only the buyer can confirm delivery."}, status=status.HTTP_403_FORBIDDEN)

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

    def get_queryset(self):
        return super().get_queryset()

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

    def get_queryset(self):
        return super().get_queryset()

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
    permission_classes = [IsAuthenticated]

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
        # permission: admin or seller owner of the product
        user = request.user
        if not (is_admin(user) or (is_seller(user) and getattr(obj.product, 'owner_id', None) == user.id)):
            from rest_framework import status
            return Response({'detail': 'You do not have permission to delete this image.'}, status=status.HTTP_403_FORBIDDEN)

        # delete file from storage then delete record
        try:
            if obj.image:
                obj.image.delete(save=False)
        except Exception:
            pass

        obj.delete()
        from rest_framework import status
        return Response(status=status.HTTP_204_NO_CONTENT)

class CartView(generics.GenericAPIView):
    """Cart endpoint handling GET, POST, PATCH, DELETE for authenticated users.
    - GET returns current cart items.
    - POST adds a product to the cart.
    - PATCH updates quantity of an existing cart item.
    - DELETE removes a cart item.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = CartSerializer

    def get_cart(self):
        cart, _ = Cart.objects.get_or_create(user=self.request.user)
        return cart

    def get(self, request):
        cart = self.get_cart()
        serializer = self.get_serializer(cart)
        return Response(serializer.data)


class CheckoutView(generics.GenericAPIView):
    """
    Handles cart checkout:
    - Creates an Order with OrderItems
    - Decreases product stock
    - Validates stock availability
    """
    permission_classes = [IsAuthenticated]
    serializer_class = OrderSerializer

    def post(self, request):
        cart_items = request.data.get('items', [])

        if not cart_items:
            return Response(
                {'detail': 'Cart is empty'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            with transaction.atomic():
                total_price = 0
                order_items_data = []

                # Validate all items have sufficient stock
                for item in cart_items:
                    product_id = item.get('product_id')
                    quantity = item.get('quantity', 1)

                    try:
                        product = Product.objects.get(id=product_id)
                    except Product.DoesNotExist:
                        return Response(
                            {'detail': f'Product {product_id} not found'},
                            status=status.HTTP_404_NOT_FOUND
                        )

                    if product.stock < quantity:
                        return Response(
                            {'detail': f'Insufficient stock for {product.name}. Available: {product.stock}'},
                            status=status.HTTP_400_BAD_REQUEST
                        )

                    order_items_data.append({
                        'product': product,
                        'quantity': quantity,
                        'price': product.price,
                        'seller': product.owner,
                    })

                    total_price += float(product.price) * quantity

                # Create order
                order = Order.objects.create(
                    buyer=request.user,
                    status='pending',
                    total_price=total_price
                )

                # Create order items and decrease stock
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

                    # Decrease product stock
                    product.stock -= quantity
                    product.save(update_fields=['stock'])

                serializer = self.get_serializer(order)
                return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response(
                {'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
class OrderListView(generics.ListAPIView):
    """Get all orders for the authenticated user (buyer)"""
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
        ).distinct().prefetch_related('items').order_by('-created_at')


class SellerProductsView(generics.ListAPIView):
    """Get all products created by the authenticated seller"""
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Only sellers can access their own products
        if not is_seller(self.request.user):
            return Product.objects.none()

        return Product.objects.filter(owner=self.request.user).select_related("owner")
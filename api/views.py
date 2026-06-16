from rest_framework import generics, parsers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth.models import User
from django.db import transaction

from .models import (
    Product,
    ProductImage,
    UserProfile,
    ProductComment,
    Order,
    OrderItem,
)

from .serializers import (
    ProductSerializer,
    UserRegisterSerializer,
    UserProfileSerializer,
    ProductCommentSerializer,
    OrderSerializer,
    OrderItemSerializer,
    ProductImageSerializer,
)

from .permissions import (
    IsSellerOrAdminOrReadOnly,
    is_admin,
    is_seller,
)


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
                    status='completed',
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
        return Order.objects.filter(buyer=self.request.user).prefetch_related('items')


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
        ).distinct().prefetch_related('items')


class SellerProductsView(generics.ListAPIView):
    """Get all products created by the authenticated seller"""
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Only sellers can access their own products
        if not is_seller(self.request.user):
            return Product.objects.none()

        return Product.objects.filter(owner=self.request.user).select_related("owner")
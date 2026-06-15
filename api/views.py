from rest_framework import generics, parsers
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth.models import User
from rest_framework.response import Response

from .models import (
    Product,
    ProductImage,
    UserProfile,
    ProductComment,
)

from .serializers import (
    ProductSerializer,
    UserRegisterSerializer,
    UserProfileSerializer,
    ProductCommentSerializer,
)
from .serializers import ProductImageSerializer

from .permissions import (
    IsSellerOrAdminOrReadOnly,
    is_admin,
    is_seller,
)


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserRegisterSerializer


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
    permission_classes = [IsAuthenticated, IsSellerOrAdminOrReadOnly]

    parser_classes = (
        parsers.MultiPartParser,
        parsers.FormParser,
    )

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        if is_seller(user) and not is_admin(user):
            return queryset.filter(owner=user)

        return queryset

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
    permission_classes = [IsAuthenticated, IsSellerOrAdminOrReadOnly]

    parser_classes = (
        parsers.MultiPartParser,
        parsers.FormParser,
    )

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        if is_seller(user) and not is_admin(user):
            return queryset.filter(owner=user)

        return queryset

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
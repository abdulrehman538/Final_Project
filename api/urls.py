from django.urls import path
from .views import (ProductListCreateView, ProductDetailView,
                     RegisterView, UserRoleView, ProfileView,
                     ProductCommentListCreateView, ProductImageDetailView)

urlpatterns = [
    path('products/', ProductListCreateView.as_view()),
    path('products/<int:pk>/', ProductDetailView.as_view()),
    path('products/<int:pk>/comments/', ProductCommentListCreateView.as_view()),
    path('product-images/<int:pk>/', ProductImageDetailView.as_view()),
    path('register/', RegisterView.as_view()),
    path('user-role/', UserRoleView.as_view()),
    path('profile/', ProfileView.as_view()),

]

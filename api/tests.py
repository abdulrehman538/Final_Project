from datetime import timedelta

from django.test import TestCase
from django.contrib.auth.models import User
from django.conf import settings
from rest_framework.test import APIClient
from rest_framework import status

from .models import UserProfile, Order, Product


class SellerApprovalWorkflowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(username='admin', password='admin123', is_staff=True)
        self.shopper = User.objects.create_user(username='shopper', password='shopper123')

    def test_seller_request_is_pending_until_admin_approval(self):
        self.client.force_authenticate(user=self.shopper)
        response = self.client.patch('/api/profile/', {
            'store_name': 'Pending Store',
            'business_description': 'Test business',
            'contact_phone': '123456789',
            'terms_accepted': True,
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        profile = UserProfile.objects.get(user=self.shopper)
        self.assertFalse(profile.is_seller)
        self.assertEqual(profile.seller_status, 'pending')
        self.assertIn('pending', response.data['seller_status'])

    def test_admin_can_approve_seller_request(self):
        self.client.force_authenticate(user=self.shopper)
        self.client.patch('/api/profile/', {
            'store_name': 'Pending Store',
            'business_description': 'Test business',
            'contact_phone': '123456789',
            'terms_accepted': True,
        }, format='json')

        self.client.force_authenticate(user=self.admin)
        response = self.client.post('/api/admin/seller-requests/approve/', {'user_id': self.shopper.id}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        profile = UserProfile.objects.get(user=self.shopper)
        self.assertTrue(profile.is_seller)
        self.assertEqual(profile.seller_status, 'approved')

    def test_pending_seller_requests_include_user_id_for_admin_actions(self):
        self.client.force_authenticate(user=self.shopper)
        self.client.patch('/api/profile/', {
            'store_name': 'Pending Store',
            'business_description': 'Test business',
            'contact_phone': '123456789',
            'terms_accepted': True,
        }, format='json')

        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/admin/seller-requests/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data)
        self.assertEqual(response.data[0]['user_id'], self.shopper.id)

    def test_regular_user_role_is_user_not_buyer(self):
        self.client.force_authenticate(user=self.shopper)
        response = self.client.get('/api/user-role/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['role'], 'user')
        self.assertEqual(response.data['seller_status'], 'none')

    def test_portal_signup_creates_pending_seller_request(self):
        response = self.client.post('/api/register/', {
            'username': 'newseller',
            'password': 'sellerpass123',
            'email': 'seller@example.com',
            'phone': '5551234567',
            'address': '{"address1":"1 Main St"}',
            'store_name': 'New Seller Store',
            'business_description': 'We sell quality goods.',
            'contact_phone': '5551234567',
            'terms_accepted': True,
            'apply_as_seller': True,
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        profile = UserProfile.objects.get(user__username='newseller')
        self.assertEqual(profile.seller_status, 'pending')
        self.assertFalse(profile.is_seller)
        self.assertEqual(profile.store_name, 'New Seller Store')

        self.client.force_authenticate(user=self.admin)
        pending = self.client.get('/api/admin/seller-requests/')
        self.assertEqual(pending.status_code, status.HTTP_200_OK)
        self.assertTrue(any(item['store_name'] == 'New Seller Store' for item in pending.data))

    def test_access_token_lifetime_is_24_hours(self):
        self.assertEqual(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'], timedelta(hours=24))

    def test_guest_checkout_creates_order_without_auth(self):
        product = Product.objects.create(
            name='Guest Checkout Item',
            description='Test',
            price='25.00',
            stock=5,
            category='General',
            store_name='Guest Store',
        )

        response = self.client.post('/api/checkout/', {
            'items': [{'product_id': product.id, 'quantity': 1}],
            'customer_name': 'Guest Shopper',
            'customer_phone': '5551234',
            'customer_email': 'guest@example.com',
            'shipping_address': '{"address1":"123 Main St","postal_code":"44000"}',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order = Order.objects.get(id=response.data['id'])
        self.assertIsNone(order.buyer_id)
        self.assertEqual(order.customer_name, 'Guest Shopper')
        product.refresh_from_db()
        self.assertEqual(product.stock, 4)

    def test_guest_checkout_succeeds_with_invalid_jwt(self):
        product = Product.objects.create(
            name='Stale Token Item',
            description='Test',
            price='15.00',
            stock=3,
            category='General',
            store_name='Guest Store',
        )

        self.client.credentials(HTTP_AUTHORIZATION='Bearer invalid-token')
        response = self.client.post('/api/checkout/', {
            'items': [{'product_id': product.id, 'quantity': 1}],
            'customer_name': 'Guest Shopper',
            'shipping_address': '123 Guest Street',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order = Order.objects.get(id=response.data['id'])
        self.assertIsNone(order.buyer_id)
        self.assertEqual(order.customer_name, 'Guest Shopper')

    def test_order_status_can_be_updated_through_api(self):
        order = Order.objects.create(buyer=self.shopper, status='pending', total_price='10.00')
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(f'/api/orders/{order.id}/status/', {'status': 'confirmed'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        order.refresh_from_db()
        self.assertEqual(order.status, 'confirmed')

    def test_checkout_decrements_stock_and_blocks_over_ordering(self):
        product = Product.objects.create(
            name='Limited Stock Item',
            description='Test',
            price='10.00',
            stock=10,
            category='General',
            store_name='Test Store',
        )

        first = self.client.post('/api/checkout/', {
            'items': [{'product_id': product.id, 'quantity': 5}],
            'customer_name': 'Buyer One',
            'shipping_address': '123 Main St',
        }, format='json')
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)

        product.refresh_from_db()
        self.assertEqual(product.stock, 5)

        second = self.client.post('/api/checkout/', {
            'items': [{'product_id': product.id, 'quantity': 7}],
            'customer_name': 'Buyer Two',
            'shipping_address': '456 Main St',
        }, format='json')
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Insufficient stock', second.data['detail'])

        product.refresh_from_db()
        self.assertEqual(product.stock, 5)

    def test_cancelled_order_restores_product_stock(self):
        seller = User.objects.create_user(username='seller1', password='sellerpass')
        UserProfile.objects.create(
            user=seller,
            is_seller=True,
            seller_status='approved',
            store_name='Seller Store',
        )

        product = Product.objects.create(
            owner=seller,
            name='Restore Stock Item',
            description='Test',
            price='12.00',
            stock=10,
            category='General',
            store_name='Seller Store',
        )

        checkout = self.client.post('/api/checkout/', {
            'items': [{'product_id': product.id, 'quantity': 4}],
            'customer_name': 'Buyer Three',
            'shipping_address': '789 Main St',
        }, format='json')
        self.assertEqual(checkout.status_code, status.HTTP_201_CREATED)
        order_id = checkout.data['id']

        product.refresh_from_db()
        self.assertEqual(product.stock, 6)

        self.client.force_authenticate(user=seller)
        cancelled = self.client.patch(
            f'/api/orders/{order_id}/status/',
            {'status': 'cancelled'},
            format='json',
        )
        self.assertEqual(cancelled.status_code, status.HTTP_200_OK)

        product.refresh_from_db()
        self.assertEqual(product.stock, 10)

    def test_duplicate_cart_lines_aggregate_before_stock_check(self):
        product = Product.objects.create(
            name='Aggregate Stock Item',
            description='Test',
            price='8.00',
            stock=10,
            category='General',
            store_name='Test Store',
        )

        response = self.client.post('/api/checkout/', {
            'items': [
                {'product_id': product.id, 'quantity': 5},
                {'product_id': product.id, 'quantity': 7},
            ],
            'customer_name': 'Buyer Four',
            'shipping_address': '101 Main St',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        product.refresh_from_db()
        self.assertEqual(product.stock, 10)

    def test_product_search_endpoint_returns_matching_results(self):
        self.client.force_authenticate(user=self.shopper)
        Product.objects.create(
            owner=self.shopper,
            name='Wireless Mouse',
            description='A compact mouse',
            price='19.99',
            stock=10,
            category='Electronics',
            store_name='Test Store',
        )

        response = self.client.get('/api/products/search/', {'q': 'mouse'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(any(item['name'] == 'Wireless Mouse' for item in response.data))

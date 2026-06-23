from datetime import timedelta

from django.test import TestCase
from django.contrib.auth.models import User, Group
from django.conf import settings
from rest_framework.test import APIClient
from rest_framework import status

from .models import UserProfile, Order, Product, Cart, CartItem


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
            'contact_phone': '03001234567',
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
            'contact_phone': '03001234567',
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
            'contact_phone': '03001234567',
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
            'phone': '03001234567',
            'address': '{"address1":"1 Main St"}',
            'store_name': 'New Seller Store',
            'business_description': 'We sell quality goods.',
            'contact_phone': '03001234567',
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
            'customer_phone': '03001234567',
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
            'customer_phone': '03001234567',
            'customer_email': 'guest@example.com',
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
            'customer_phone': '03001234567',
            'customer_email': 'buyer1@example.com',
            'shipping_address': '123 Main St',
        }, format='json')
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)

        product.refresh_from_db()
        self.assertEqual(product.stock, 5)

        second = self.client.post('/api/checkout/', {
            'items': [{'product_id': product.id, 'quantity': 7}],
            'customer_name': 'Buyer Two',
            'customer_phone': '03009876543',
            'customer_email': 'buyer2@example.com',
            'shipping_address': '456 Main St',
        }, format='json')
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Insufficient stock', second.data['detail'])

        product.refresh_from_db()
        self.assertEqual(product.stock, 5)

    def test_authenticated_checkout_clears_server_cart(self):
        product = Product.objects.create(
            name='Server Cart Item',
            description='Test',
            price='20.00',
            stock=8,
            category='General',
            store_name='Test Store',
        )

        self.client.force_authenticate(user=self.shopper)
        add_to_cart = self.client.post('/api/cart/', {
            'product_id': product.id,
            'quantity': 2,
        }, format='json')
        self.assertEqual(add_to_cart.status_code, status.HTTP_200_OK)
        self.assertEqual(len(add_to_cart.data['items']), 1)

        checkout = self.client.post('/api/checkout/', {
            'items': [{'product_id': product.id, 'quantity': 2}],
            'customer_name': 'Logged In Buyer',
            'customer_phone': '03001234567',
            'customer_email': 'shopper@example.com',
            'shipping_address': '123 Main St',
        }, format='json')
        self.assertEqual(checkout.status_code, status.HTTP_201_CREATED)

        product.refresh_from_db()
        self.assertEqual(product.stock, 6)

        cart = Cart.objects.get(user=self.shopper)
        self.assertEqual(cart.items.count(), 0)

        cart_response = self.client.get('/api/cart/')
        self.assertEqual(cart_response.status_code, status.HTTP_200_OK)
        self.assertEqual(cart_response.data['items'], [])

    def test_seller_orders_only_include_their_items(self):
        seller_a = User.objects.create_user(username='musa', password='sellerpass')
        seller_b = User.objects.create_user(username='deckard', password='sellerpass')

        UserProfile.objects.create(
            user=seller_a,
            is_seller=True,
            seller_status='approved',
            store_name='Musa Store',
        )
        UserProfile.objects.create(
            user=seller_b,
            is_seller=True,
            seller_status='approved',
            store_name='Deckard Store',
        )

        product_a = Product.objects.create(
            owner=seller_a,
            name='Musa Product',
            description='From Musa',
            price='20.00',
            stock=5,
            category='General',
            store_name='Musa Store',
        )
        product_b = Product.objects.create(
            owner=seller_b,
            name='Deckard Product',
            description='From Deckard',
            price='30.00',
            stock=5,
            category='General',
            store_name='Deckard Store',
        )

        checkout = self.client.post('/api/checkout/', {
            'items': [
                {'product_id': product_a.id, 'quantity': 1},
                {'product_id': product_b.id, 'quantity': 1},
            ],
            'customer_name': 'Multi Store Buyer',
            'customer_phone': '03001234567',
            'customer_email': 'multi@example.com',
            'shipping_address': '123 Mixed Store Street',
        }, format='json')
        self.assertEqual(checkout.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(checkout.data['items']), 2)

        self.client.force_authenticate(user=seller_a)
        musa_orders = self.client.get('/api/seller-orders/')
        self.assertEqual(musa_orders.status_code, status.HTTP_200_OK)
        self.assertEqual(len(musa_orders.data), 1)
        self.assertEqual(len(musa_orders.data[0]['items']), 1)
        self.assertEqual(musa_orders.data[0]['items'][0]['product_name'], 'Musa Product')
        self.assertEqual(str(musa_orders.data[0]['seller_subtotal']), '20.00')
        self.assertNotIn('total_price', musa_orders.data[0])

        self.client.force_authenticate(user=seller_b)
        deckard_orders = self.client.get('/api/seller-orders/')
        self.assertEqual(deckard_orders.status_code, status.HTTP_200_OK)
        self.assertEqual(len(deckard_orders.data), 1)
        self.assertEqual(len(deckard_orders.data[0]['items']), 1)
        self.assertEqual(deckard_orders.data[0]['items'][0]['product_name'], 'Deckard Product')
        self.assertEqual(str(deckard_orders.data[0]['seller_subtotal']), '30.00')

        self.client.force_authenticate(user=self.shopper)
        buyer_orders = self.client.get('/api/orders/')
        self.assertEqual(buyer_orders.status_code, status.HTTP_200_OK)

    def test_order_track_returns_status_only(self):
        product = Product.objects.create(
            name='Track Me Item',
            description='Test',
            price='18.00',
            stock=4,
            category='General',
            store_name='Track Store',
        )

        checkout = self.client.post('/api/checkout/', {
            'items': [{'product_id': product.id, 'quantity': 1}],
            'customer_name': 'Tracker Buyer',
            'customer_phone': '03001234567',
            'customer_email': 'track@example.com',
            'shipping_address': '123 Track Street',
        }, format='json')
        self.assertEqual(checkout.status_code, status.HTTP_201_CREATED)
        order_id = checkout.data['id']

        track = self.client.post('/api/orders/track/', {'order_id': order_id}, format='json')
        self.assertEqual(track.status_code, status.HTTP_200_OK)
        self.assertEqual(track.data['id'], order_id)
        self.assertEqual(track.data['status'], 'pending')
        self.assertEqual(track.data['status_label'], 'Pending')
        self.assertIn('created_at', track.data)
        self.assertIn('updated_at', track.data)
        self.assertNotIn('customer_name', track.data)
        self.assertNotIn('items', track.data)

        missing = self.client.post('/api/orders/track/', {'order_id': 999999}, format='json')
        self.assertEqual(missing.status_code, status.HTTP_404_NOT_FOUND)

        hash_track = self.client.get(f'/api/orders/track/?order=%23{order_id}')
        self.assertEqual(hash_track.status_code, status.HTTP_200_OK)
        self.assertEqual(hash_track.data['status'], 'pending')

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
            'customer_phone': '03001112233',
            'customer_email': 'buyer3@example.com',
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


class SellerDashboardStatsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.seller = User.objects.create_user(username='statseller', password='sellerpass')
        self.shopper = User.objects.create_user(username='statbuyer', password='buyerpass')
        UserProfile.objects.create(
            user=self.seller,
            is_seller=True,
            seller_status='approved',
            store_name='Stats Store',
        )
        Group.objects.get_or_create(name='Seller')[0].user_set.add(self.seller)

        self.product = Product.objects.create(
            owner=self.seller,
            name='Stats Product',
            description='Test',
            price='20.00',
            stock=8,
            category='General',
            store_name='Stats Store',
        )

    def test_seller_stats_requires_approved_seller(self):
        self.client.force_authenticate(user=self.shopper)
        response = self.client.get('/api/seller/stats/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_seller_stats_returns_store_metrics(self):
        checkout = self.client.post('/api/checkout/', {
            'items': [{'product_id': self.product.id, 'quantity': 2}],
            'customer_name': 'Buyer',
            'customer_phone': '03001234567',
            'customer_email': 'buyer@example.com',
            'shipping_address': '123 Main St',
        }, format='json')
        self.assertEqual(checkout.status_code, status.HTTP_201_CREATED)

        self.client.force_authenticate(user=self.seller)
        response = self.client.get('/api/seller/stats/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['store_name'], 'Stats Store')
        self.assertEqual(response.data['products_count'], 1)
        self.assertEqual(response.data['orders_count'], 1)
        self.assertEqual(response.data['pending_orders_count'], 1)
        self.assertEqual(response.data['revenue_total'], '40.00')
        self.assertEqual(len(response.data['order_volume']), 7)
        self.assertEqual(len(response.data['top_products']), 1)
        self.assertEqual(response.data['top_products'][0]['units_sold'], 2)


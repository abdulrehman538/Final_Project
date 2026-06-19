from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status

from .models import UserProfile, Order, Product


class SellerApprovalWorkflowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(username='admin', password='admin123', is_staff=True)
        self.buyer = User.objects.create_user(username='buyer', password='buyer123')

    def test_seller_request_is_pending_until_admin_approval(self):
        self.client.force_authenticate(user=self.buyer)
        response = self.client.patch('/api/profile/', {
            'store_name': 'Pending Store',
            'business_description': 'Test business',
            'contact_phone': '123456789',
            'terms_accepted': True,
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        profile = UserProfile.objects.get(user=self.buyer)
        self.assertFalse(profile.is_seller)
        self.assertEqual(profile.seller_status, 'pending')
        self.assertIn('pending', response.data['seller_status'])

    def test_admin_can_approve_seller_request(self):
        self.client.force_authenticate(user=self.buyer)
        self.client.patch('/api/profile/', {
            'store_name': 'Pending Store',
            'business_description': 'Test business',
            'contact_phone': '123456789',
            'terms_accepted': True,
        }, format='json')

        self.client.force_authenticate(user=self.admin)
        response = self.client.post('/api/admin/seller-requests/approve/', {'user_id': self.buyer.id}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        profile = UserProfile.objects.get(user=self.buyer)
        self.assertTrue(profile.is_seller)
        self.assertEqual(profile.seller_status, 'approved')

    def test_pending_seller_requests_include_user_id_for_admin_actions(self):
        self.client.force_authenticate(user=self.buyer)
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
        self.assertEqual(response.data[0]['user_id'], self.buyer.id)

    def test_order_status_can_be_updated_through_api(self):
        order = Order.objects.create(buyer=self.buyer, status='pending', total_price='10.00')
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(f'/api/orders/{order.id}/status/', {'status': 'confirmed'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        order.refresh_from_db()
        self.assertEqual(order.status, 'confirmed')

    def test_product_search_endpoint_returns_matching_results(self):
        self.client.force_authenticate(user=self.buyer)
        Product.objects.create(
            owner=self.buyer,
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

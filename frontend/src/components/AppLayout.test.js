import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppLayout from './AppLayout';

test('shows seller profile menu instead of shopper actions', () => {
  render(
    <MemoryRouter>
      <AppLayout
        role="seller"
        isAuthenticated
        onLogout={jest.fn()}
        cartCount={2}
        wishlistCount={3}
      >
        <div>Content</div>
      </AppLayout>
    </MemoryRouter>
  );

  expect(screen.getByRole('button', { name: /Account menu/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Dashboard/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /My Store/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /^Orders$/i })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Open menu/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Become a Seller/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Cart,/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Wishlist,/i })).not.toBeInTheDocument();
});

test('seller profile menu exposes profile and logout actions', () => {
  render(
    <MemoryRouter>
      <AppLayout
        role="seller"
        isAuthenticated
        onLogout={jest.fn()}
      >
        <div>Content</div>
      </AppLayout>
    </MemoryRouter>
  );

  fireEvent.click(screen.getByRole('button', { name: /Account menu/i }));

  expect(screen.getByRole('menuitem', { name: /My Profile/i })).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: /About Us/i })).toBeInTheDocument();
  expect(screen.queryByRole('menuitem', { name: /^Orders$/i })).not.toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: /Logout/i })).toBeInTheDocument();
});

test('shows admin portal nav with profile menu instead of sidebar', () => {
  render(
    <MemoryRouter>
      <AppLayout
        role="admin"
        isAuthenticated
        onLogout={jest.fn()}
      >
        <div>Content</div>
      </AppLayout>
    </MemoryRouter>
  );

  expect(screen.getByRole('link', { name: /Dashboard/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /^Products$/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Account menu/i })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Open menu/i })).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Search products/i)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Logout$/i })).not.toBeInTheDocument();
});

test('admin profile menu exposes profile and logout actions', () => {
  const onLogout = jest.fn();

  render(
    <MemoryRouter>
      <AppLayout
        role="admin"
        isAuthenticated
        onLogout={onLogout}
      >
        <div>Content</div>
      </AppLayout>
    </MemoryRouter>
  );

  fireEvent.click(screen.getByRole('button', { name: /Account menu/i }));

  expect(screen.getByRole('menuitem', { name: /My Profile/i })).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: /About Us/i })).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: /Logout/i })).toBeInTheDocument();
});

test('shows sleek shopper nav with seller link and icon actions', () => {
  render(
    <MemoryRouter>
      <AppLayout
        role="user"
        isAuthenticated={false}
        onLogout={jest.fn()}
        cartCount={1}
        wishlistCount={2}
      >
        <div>Content</div>
      </AppLayout>
    </MemoryRouter>
  );

  expect(screen.getByRole('button', { name: /Become a Seller/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Cart, 1 items/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Wishlist, 2 items/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Account menu/i })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Open menu/i })).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Search products/i)).not.toBeInTheDocument();
});

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppLayout from './AppLayout';

test('shows shopping shortcuts for sellers', () => {
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

  expect(screen.getByRole('button', { name: /Cart \(2\)/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Wishlist \(3\)/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Orders/i })).toBeInTheDocument();
});

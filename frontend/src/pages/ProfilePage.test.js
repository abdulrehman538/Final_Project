import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ProfilePage from './ProfilePage';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('accessToken', 'test-token');

  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: async () => ({
        full_name: '',
        phone: '',
        address: '',
        bio: '',
        avatar_url: '',
        email: 'buyer@example.com',
        username: 'buyer',
        store_name: '',
        is_seller: false,
      }),
    })
  );
});

test('opens a seller onboarding modal with detailed fields', async () => {
  render(
    <MemoryRouter>
      <ProfilePage onBecomeSeller={jest.fn()} />
    </MemoryRouter>
  );

  await userEvent.click(await screen.findByRole('button', { name: /Become Seller/i }));

  expect(screen.getByText(/Seller Onboarding/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Store Name/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Business Description/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Contact Phone/i)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /Terms and Conditions/i })).toBeInTheDocument();
});

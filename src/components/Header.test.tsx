import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../theme';
import Header from '../components/Header';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'nav.home': 'Home',
        'nav.apis': 'API Catalog',
        'nav.integrations': 'My Integrations',
        'nav.support': 'Support',
        'nav.news': 'News',
        'nav.admin': 'Admin',
      };
      return translations[key] ?? key;
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

// Mock the component library Header & UserProfile
vi.mock('@komatsu-nagm/component-library', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@komatsu-nagm/component-library');
  return {
    ...actual,
    Header: (props: any) => (
      <header data-testid="komatsu-header">
        <span data-testid="app-title">{props.appTitle}</span>
        {props.actions}
        {props.navigation?.map((nav: any, i: number) => (
          <button key={i} onClick={nav.onClick}>{nav.label}</button>
        ))}
        {props.userProfile && (
          <div data-testid="user-profile">
            <span data-testid="user-email">{props.userProfile.userEmail}</span>
            <span data-testid="user-initials">{props.userProfile.userInitials}</span>
            <button onClick={props.userProfile.onSignOut}>Sign Out</button>
          </div>
        )}
      </header>
    ),
  };
});

// Mock the auth hooks
vi.mock('../auth/useAuth', () => ({
  useAuth: vi.fn()
}));

vi.mock('../utils/loginUtils/useLogout', () => ({
  default: vi.fn()
}));

import { useAuth } from '../auth/useAuth';
import useLogout from '../utils/loginUtils/useLogout';

describe('Header Component', () => {
  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useLogout).mockReturnValue({ logout: mockLogout });
    vi.mocked(useAuth).mockReturnValue({
      account: {
        name: 'John Doe',
        username: 'john.doe@komatsu.com',
        homeAccountId: '123',
        environment: 'test',
        tenantId: '456',
        localAccountId: '789'
      },
      roles: ['User'],
      isAuthenticated: true,
      getAccessToken: vi.fn()
    });
  });

  const renderHeader = (props: { isPublic?: boolean } = {}) => {
    return render(
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <Header {...props} />
        </ThemeProvider>
      </BrowserRouter>
    );
  };

  it('renders without crashing', () => {
    renderHeader();
    expect(screen.getByTestId('komatsu-header')).toBeInTheDocument();
  });

  it('displays app title', () => {
    renderHeader();
    expect(screen.getByTestId('app-title')).toHaveTextContent('Komatsu API Marketplace');
  });

  it('displays user email when authenticated', () => {
    renderHeader();
    expect(screen.getByTestId('user-email')).toHaveTextContent('john.doe@komatsu.com');
  });

  it('displays user initials', () => {
    renderHeader();
    expect(screen.getByTestId('user-initials')).toHaveTextContent('JD');
  });

  it('calls logout when Sign Out is clicked', async () => {
    const user = userEvent.setup();
    renderHeader();

    const signOutButton = screen.getByRole('button', { name: /sign out/i });
    await user.click(signOutButton);

    expect(mockLogout).toHaveBeenCalledOnce();
  });

  it('renders navigation items when not public', () => {
    renderHeader();
    expect(screen.getByRole('button', { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /api catalog/i })).toBeInTheDocument();
  });

  it('renders no navigation items when public', () => {
    renderHeader({ isPublic: true });
    expect(screen.queryByRole('button', { name: /home/i })).not.toBeInTheDocument();
  });

  it('shows Admin nav item for Admin role', () => {
    vi.mocked(useAuth).mockReturnValue({
      account: {
        name: 'Admin User',
        username: 'admin@komatsu.com',
        homeAccountId: '123',
        environment: 'test',
        tenantId: '456',
        localAccountId: '789'
      },
      roles: ['Admin'],
      isAuthenticated: true,
      getAccessToken: vi.fn()
    });
    renderHeader();
    expect(screen.getByRole('button', { name: /admin/i })).toBeInTheDocument();
  });

  it('does not show Admin nav item for non-admin users', () => {
    renderHeader();
    expect(screen.queryByRole('button', { name: /^admin$/i })).not.toBeInTheDocument();
  });

  it('renders language switcher button in header', () => {
    renderHeader();
    expect(screen.getByLabelText('Change language')).toBeInTheDocument();
  });
});

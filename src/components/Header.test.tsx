import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../theme';
import Header from '../components/Header';

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

  const renderHeader = (props = {}) => {
    return render(
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <Header drawerWidth={260} onMenuClick={vi.fn()} showMenuButton={false} {...props} />
        </ThemeProvider>
      </BrowserRouter>
    );
  };

  it('renders without crashing', () => {
    renderHeader();
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('displays app name/branding', () => {
    renderHeader();
    const branding = screen.getByText(/Portal/i);
    expect(branding).toBeInTheDocument();
  });

  it('displays user name when authenticated', () => {
    renderHeader();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('displays user avatar when authenticated', () => {
    renderHeader();
    const avatar = screen.getByRole('button', { name: /open user menu/i });
    expect(avatar).toBeInTheDocument();
  });

  it('opens user menu when avatar is clicked', async () => {
    const user = userEvent.setup();
    renderHeader();
    
    const avatarButton = screen.getByRole('button', { name: /open user menu/i });
    await user.click(avatarButton);
    
    const signOutMenuItem = await screen.findByRole('menuitem', { name: /sign out/i });
    expect(signOutMenuItem).toBeInTheDocument();
  });

  it('calls logout when Sign out is clicked', async () => {
    const user = userEvent.setup();
    renderHeader();
    
    const avatarButton = screen.getByRole('button', { name: /open user menu/i });
    await user.click(avatarButton);
    
    const signOutMenuItem = await screen.findByRole('menuitem', { name: /sign out/i });
    await user.click(signOutMenuItem);
    
    expect(mockLogout).toHaveBeenCalledOnce();
  });

  it('displays menu button when showMenuButton is true', () => {
    const mockMenuClick = vi.fn();
    renderHeader({ showMenuButton: true, onMenuClick: mockMenuClick });
    
    const menuButton = screen.getByRole('button', { name: /open navigation/i });
    expect(menuButton).toBeInTheDocument();
  });

  it('calls onMenuClick when menu button is clicked', async () => {
    const user = userEvent.setup();
    const mockMenuClick = vi.fn();
    renderHeader({ showMenuButton: true, onMenuClick: mockMenuClick });
    
    const menuButton = screen.getByRole('button', { name: /open navigation/i });
    await user.click(menuButton);
    
    expect(mockMenuClick).toHaveBeenCalledOnce();
  });

  it('does not display menu button when showMenuButton is false', () => {
    renderHeader({ showMenuButton: false });
    
    const menuButton = screen.queryByRole('button', { name: /open navigation/i });
    expect(menuButton).not.toBeInTheDocument();
  });
});

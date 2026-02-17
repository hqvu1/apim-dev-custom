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

vi.mock('../utils/loginUtils/initiateLogin', () => ({
  initiateLogin: vi.fn()
}));

import { useAuth } from '../auth/useAuth';
import useLogout from '../utils/loginUtils/useLogout';
import { initiateLogin } from '../utils/loginUtils/initiateLogin';

describe('Header Component', () => {
  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useLogout).mockReturnValue({ logout: mockLogout });
  });

  const renderHeader = (props = {}) => {
    return render(
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <Header {...props} />
        </ThemeProvider>
      </BrowserRouter>
    );
  };

  describe('Public mode (not authenticated)', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({
        account: null,
        roles: [],
        isAuthenticated: false,
        getAccessToken: vi.fn()
      });
    });

    it('renders without crashing in public mode', () => {
      renderHeader({ isPublic: true });
      expect(screen.getByRole('banner')).toBeInTheDocument();
    });

    it('displays app name/branding', () => {
      renderHeader({ isPublic: true });
      const branding = screen.getByText(/Portal/i);
      expect(branding).toBeInTheDocument();
    });

    it('displays Login button when not authenticated', () => {
      renderHeader({ isPublic: true });
      const loginButton = screen.getByRole('button', { name: /login/i });
      expect(loginButton).toBeInTheDocument();
    });

    it('calls initiateLogin when Login button is clicked', async () => {
      const user = userEvent.setup();
      renderHeader({ isPublic: true });
      
      const loginButton = screen.getByRole('button', { name: /login/i });
      await user.click(loginButton);
      
      expect(initiateLogin).toHaveBeenCalledOnce();
    });

    it('does not display user avatar when not authenticated', () => {
      renderHeader({ isPublic: true });
      const avatar = screen.queryByRole('button', { name: /open user menu/i });
      expect(avatar).not.toBeInTheDocument();
    });
  });

  describe('Authenticated mode', () => {
    beforeEach(() => {
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

    it('renders without crashing when authenticated', () => {
      renderHeader({ drawerWidth: 260, onMenuClick: vi.fn(), showMenuButton: false });
      expect(screen.getByRole('banner')).toBeInTheDocument();
    });

    it('displays user name when authenticated', () => {
      renderHeader({ drawerWidth: 260, onMenuClick: vi.fn(), showMenuButton: false });
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('displays user avatar when authenticated', () => {
      renderHeader({ drawerWidth: 260, onMenuClick: vi.fn(), showMenuButton: false });
      const avatar = screen.getByRole('button', { name: /open user menu/i });
      expect(avatar).toBeInTheDocument();
    });

    it('does not display Login button when authenticated', () => {
      renderHeader({ drawerWidth: 260, onMenuClick: vi.fn(), showMenuButton: false });
      const loginButton = screen.queryByRole('button', { name: /login/i });
      expect(loginButton).not.toBeInTheDocument();
    });

    it('opens user menu when avatar is clicked', async () => {
      const user = userEvent.setup();
      renderHeader({ drawerWidth: 260, onMenuClick: vi.fn(), showMenuButton: false });
      
      const avatarButton = screen.getByRole('button', { name: /open user menu/i });
      await user.click(avatarButton);
      
      const signOutMenuItem = await screen.findByRole('menuitem', { name: /sign out/i });
      expect(signOutMenuItem).toBeInTheDocument();
    });

    it('calls logout when Sign out is clicked', async () => {
      const user = userEvent.setup();
      renderHeader({ drawerWidth: 260, onMenuClick: vi.fn(), showMenuButton: false });
      
      const avatarButton = screen.getByRole('button', { name: /open user menu/i });
      await user.click(avatarButton);
      
      const signOutMenuItem = await screen.findByRole('menuitem', { name: /sign out/i });
      await user.click(signOutMenuItem);
      
      expect(mockLogout).toHaveBeenCalledOnce();
    });
  });

  describe('Navigation menu button', () => {
    beforeEach(() => {
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

    it('displays menu button when showMenuButton is true', () => {
      const mockMenuClick = vi.fn();
      renderHeader({ drawerWidth: 260, onMenuClick: mockMenuClick, showMenuButton: true });
      
      const menuButton = screen.getByRole('button', { name: /open navigation/i });
      expect(menuButton).toBeInTheDocument();
    });

    it('calls onMenuClick when menu button is clicked', async () => {
      const user = userEvent.setup();
      const mockMenuClick = vi.fn();
      renderHeader({ drawerWidth: 260, onMenuClick: mockMenuClick, showMenuButton: true });
      
      const menuButton = screen.getByRole('button', { name: /open navigation/i });
      await user.click(menuButton);
      
      expect(mockMenuClick).toHaveBeenCalledOnce();
    });

    it('does not display menu button when showMenuButton is false', () => {
      renderHeader({ drawerWidth: 260, onMenuClick: vi.fn(), showMenuButton: false });
      
      const menuButton = screen.queryByRole('button', { name: /open navigation/i });
      expect(menuButton).not.toBeInTheDocument();
    });
  });
});

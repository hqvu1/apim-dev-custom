/**
 * Unit tests for HeroSection component
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../theme';
import HeroSection from './HeroSection';

describe('HeroSection', () => {
  const defaultProps = {
    onExploreClick: vi.fn(),
    onGetStartedClick: vi.fn()
  };

  const renderComponent = (props = defaultProps) => {
    return render(
      <ThemeProvider theme={theme}>
        <HeroSection {...props} />
      </ThemeProvider>
    );
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      renderComponent();
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    it('displays the main heading', () => {
      renderComponent();
      expect(screen.getByText('Build the Future with Komatsu APIs')).toBeInTheDocument();
    });

    it('displays the subtitle', () => {
      renderComponent();
      expect(
        screen.getByText(/Access secure, enterprise-grade APIs to power your digital transformation/i)
      ).toBeInTheDocument();
    });

    it('displays "KOMATSU API PORTAL" label', () => {
      renderComponent();
      expect(screen.getByText('KOMATSU API PORTAL')).toBeInTheDocument();
    });

    it('displays description text', () => {
      renderComponent();
      expect(
        screen.getByText(/Streamline integrations, enhance productivity, and unlock new possibilities/i)
      ).toBeInTheDocument();
    });
  });

  describe('Buttons', () => {
    it('renders "Explore APIs" button', () => {
      renderComponent();
      expect(screen.getByRole('button', { name: /Explore available APIs/i })).toBeInTheDocument();
    });

    it('renders "Get Started" button', () => {
      renderComponent();
      expect(screen.getByRole('button', { name: /Get started with API registration/i })).toBeInTheDocument();
    });

    it('calls onExploreClick when "Explore APIs" button is clicked', async () => {
      const user = userEvent.setup();
      const onExploreClick = vi.fn();
      
      render(
        <ThemeProvider theme={theme}>
          <HeroSection onExploreClick={onExploreClick} onGetStartedClick={vi.fn()} />
        </ThemeProvider>
      );

      const exploreButton = screen.getByRole('button', { name: /Explore available APIs/i });
      await user.click(exploreButton);

      expect(onExploreClick).toHaveBeenCalledTimes(1);
    });

    it('calls onGetStartedClick when "Get Started" button is clicked', async () => {
      const user = userEvent.setup();
      const onGetStartedClick = vi.fn();
      
      render(
        <ThemeProvider theme={theme}>
          <HeroSection onExploreClick={vi.fn()} onGetStartedClick={onGetStartedClick} />
        </ThemeProvider>
      );

      const getStartedButton = screen.getByRole('button', { name: /Get started with API registration/i });
      await user.click(getStartedButton);

      expect(onGetStartedClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('has proper semantic structure', () => {
      renderComponent();
      expect(screen.getByLabelText('Hero section')).toBeInTheDocument();
    });

    it('has accessible button labels', () => {
      renderComponent();
      const exploreButton = screen.getByRole('button', { name: /Explore available APIs/i });
      const getStartedButton = screen.getByRole('button', { name: /Get started with API registration/i });
      
      expect(exploreButton).toHaveAccessibleName();
      expect(getStartedButton).toHaveAccessibleName();
    });

    it('has correct heading hierarchy', () => {
      renderComponent();
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toHaveTextContent('Build the Future with Komatsu APIs');
    });
  });

  describe('Memoization', () => {
    it('has displayName set for debugging', () => {
      expect(HeroSection.displayName).toBe('HeroSection');
    });
  });
});

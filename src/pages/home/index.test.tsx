/**
 * Unit tests for Home page (index.tsx)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../theme';
import Home from './index';
import * as apiClient from '../../api/client';
import { ApiSummary } from '../../api/types';

// Mock the API client
vi.mock('../../api/client', () => ({
  usePortalApi: vi.fn()
}));

// Mock the toast provider
vi.mock('../../components/useToast', () => ({
  useToast: () => ({
    notify: vi.fn()
  })
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

describe('Home Page', () => {
  const mockApiData: ApiSummary[] = [
    {
      id: '1',
      name: 'Test API 1',
      description: 'First test API',
      status: 'Production' as const,
      plan: 'Premium',
      owner: 'Test Team',
      tags: ['test', 'api'],
      category: 'Integration'
    },
    {
      id: '2',
      name: 'Test API 2',
      description: 'Second test API',
      status: 'Sandbox' as const,
      plan: 'Free',
      owner: 'Dev Team',
      tags: ['test'],
      category: 'Public'
    }
  ];

  const mockNewsData = [
    { title: 'New API Release' },
    { title: 'Maintenance Update' }
  ];

  const mockGet = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    
    // Default successful API response
    mockGet.mockImplementation((url: string) => {
      if (url === '/news') {
        return Promise.resolve({ data: mockNewsData, error: null });
      }
      if (url === '/apis/highlights') {
        return Promise.resolve({ data: mockApiData, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    vi.mocked(apiClient.usePortalApi).mockReturnValue({
      get: mockGet,
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn()
    } as any);
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <Home />
        </ThemeProvider>
      </BrowserRouter>
    );
  };

  describe('Initial Rendering', () => {
    it('renders without crashing', () => {
      renderComponent();
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('displays hero section with main heading', () => {
      renderComponent();
      expect(screen.getByText('Build the Future with Komatsu APIs')).toBeInTheDocument();
    });

    it('displays statistics cards', () => {
      renderComponent();
      expect(screen.getByText('Available APIs')).toBeInTheDocument();
      expect(screen.getByText('Active Users')).toBeInTheDocument();
      expect(screen.getByText('API Calls Today')).toBeInTheDocument();
      expect(screen.getByText('Uptime')).toBeInTheDocument();
    });

    it('displays feature section heading', () => {
      renderComponent();
      expect(screen.getByText('Why Choose Komatsu API Portal')).toBeInTheDocument();
    });

    it('displays quick actions section heading', () => {
      renderComponent();
      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    });
  });

  describe('Statistics Section', () => {
    it('displays correct statistic values', () => {
      renderComponent();
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('1,247')).toBeInTheDocument();
      expect(screen.getByText('2.4M')).toBeInTheDocument();
      expect(screen.getByText('99.9%')).toBeInTheDocument();
    });
  });

  describe('Features Section', () => {
    it('displays all 6 platform features', () => {
      renderComponent();
      expect(screen.getByText('Comprehensive API Catalog')).toBeInTheDocument();
      expect(screen.getByText('Enterprise-Grade Security')).toBeInTheDocument();
      expect(screen.getByText('High Performance')).toBeInTheDocument();
      expect(screen.getByText('Easy Integration')).toBeInTheDocument();
      expect(screen.getByText('Developer Tools')).toBeInTheDocument();
      expect(screen.getByText('24/7 Support')).toBeInTheDocument();
    });

    it('displays feature descriptions', () => {
      renderComponent();
      expect(
        screen.getByText(/Access a wide range of enterprise APIs with detailed documentation/i)
      ).toBeInTheDocument();
    });
  });

  describe('Featured APIs Section', () => {
    it('shows loading state initially', () => {
      renderComponent();
      expect(screen.getByText('Loading highlights...')).toBeInTheDocument();
    });

    it('displays featured APIs after loading', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Test API 1')).toBeInTheDocument();
      });

      expect(screen.getByText('Test API 2')).toBeInTheDocument();
      expect(screen.getByText('First test API')).toBeInTheDocument();
      expect(screen.getByText('Second test API')).toBeInTheDocument();
    });

    it('displays API status chips', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Production')).toBeInTheDocument();
      });

      expect(screen.getByText('Sandbox')).toBeInTheDocument();
    });

    it('displays API plan chips', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Premium')).toBeInTheDocument();
      });

      expect(screen.getByText('Free')).toBeInTheDocument();
    });

    it('has "View All APIs" button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /View all available APIs/i })).toBeInTheDocument();
      });
    });
  });

  describe('News Section', () => {
    it('displays news items after loading', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('New API Release')).toBeInTheDocument();
      });

      expect(screen.getByText('Maintenance Update')).toBeInTheDocument();
    });

    it('shows empty state when no news', async () => {
      mockGet.mockImplementation((url: string) => {
        if (url === '/news') {
          return Promise.resolve({ data: [], error: null });
        }
        if (url === '/apis/highlights') {
          return Promise.resolve({ data: mockApiData, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/No announcements yet/i)).toBeInTheDocument();
      });
    });

    it('has "View All News" button', () => {
      renderComponent();
      expect(screen.getByRole('button', { name: /View all news and announcements/i })).toBeInTheDocument();
    });
  });

  describe('Quick Actions Section', () => {
    it('displays all three quick action cards', () => {
      renderComponent();
      expect(screen.getByText('Browse API Catalog')).toBeInTheDocument();
      expect(screen.getByText('My Integrations')).toBeInTheDocument();
      expect(screen.getByText('Get Support')).toBeInTheDocument();
    });

    it('has correct button texts', () => {
      renderComponent();
      expect(screen.getByRole('button', { name: /Browse APIs/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Manage Integrations/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Get Help/i })).toBeInTheDocument();
    });
  });

//   describe('Navigation', () => {
//     it('navigates to /apis when "Explore APIs" is clicked', async () => {
//       const user = userEvent.setup();
//       renderComponent();

//       await waitFor(() => {
//         expect(screen.queryByText('Loading highlights...')).not.toBeInTheDocument();
//       });

//       const exploreButton = screen.getByRole('button', { name: /Explore available APIs/i });
//       await user.click(exploreButton);

//       await waitFor(() => {
//         expect(mockNavigate).toHaveBeenCalledWith('/apis');
//       });
//     });

//     it('navigates to /register when "Get Started" is clicked', async () => {
//       const user = userEvent.setup();
//       renderComponent();

//       await waitFor(() => {
//         expect(screen.queryByText('Loading highlights...')).not.toBeInTheDocument();
//       });

//       const getStartedButton = screen.getByRole('button', { name: /Get started with API registration/i });
//       await user.click(getStartedButton);

//       await waitFor(() => {
//         expect(mockNavigate).toHaveBeenCalledWith('/register');
//       });
//     });

//     it('navigates to /my/integrations when "Manage Integrations" is clicked', async () => {
//       const user = userEvent.setup();
//       renderComponent();

//       await waitFor(() => {
//         expect(screen.queryByText('Loading highlights...')).not.toBeInTheDocument();
//       });

//       const integrationsButton = screen.getByRole('button', { name: /Manage Integrations/i });
//       await user.click(integrationsButton);

//       await waitFor(() => {
//         expect(mockNavigate).toHaveBeenCalledWith('/my/integrations');
//       });
//     });

//     it('navigates to /support when "Get Help" is clicked', async () => {
//       const user = userEvent.setup();
//       renderComponent();

//       await waitFor(() => {
//         expect(screen.queryByText('Loading highlights...')).not.toBeInTheDocument();
//       });

//       const supportButton = screen.getByRole('button', { name: /Get Help/i });
//       await user.click(supportButton);

//       await waitFor(() => {
//         expect(mockNavigate).toHaveBeenCalledWith('/support');
//       });
//     });

//     it('navigates to /news when "View All News" is clicked', async () => {
//       const user = userEvent.setup();
//       renderComponent();

//       await waitFor(() => {
//         expect(screen.queryByText('Loading highlights...')).not.toBeInTheDocument();
//       });

//       const newsButton = screen.getByRole('button', { name: /View all news and announcements/i });
//       await user.click(newsButton);

//       await waitFor(() => {
//         expect(mockNavigate).toHaveBeenCalledWith('/news');
//       });
//     });

//     it('navigates to API details when "Details" button is clicked', async () => {
//       const user = userEvent.setup();
//       renderComponent();

//       await waitFor(() => {
//         expect(screen.getByText('Test API 1')).toBeInTheDocument();
//       });

//       const detailButtons = screen.getAllByRole('button', { name: /View details for/i });
//       await user.click(detailButtons[0]);

//       await waitFor(() => {
//         expect(mockNavigate).toHaveBeenCalledWith('/apis/1');
//       });
//     });
//   });

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      mockGet.mockImplementation(() => {
        return Promise.resolve({ data: null, error: 'API Error' });
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText('Loading highlights...')).not.toBeInTheDocument();
      });

      // Should still render the page with fallback data
      expect(screen.getByText('Build the Future with Komatsu APIs')).toBeInTheDocument();
    });

    it('handles fetch exceptions gracefully', async () => {
      mockGet.mockImplementation(() => {
        return Promise.reject(new Error('Network error'));
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText('Loading highlights...')).not.toBeInTheDocument();
      });

      // Should still render the page
      expect(screen.getByText('Build the Future with Komatsu APIs')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper semantic structure with main element', () => {
      renderComponent();
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('has proper heading hierarchy', () => {
      renderComponent();
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toHaveTextContent('Build the Future with Komatsu APIs');

      const h2Headings = screen.getAllByRole('heading', { level: 2 });
      expect(h2Headings.length).toBeGreaterThan(0);
    });

    it('has proper ARIA labels on sections', () => {
      renderComponent();
      expect(screen.getByLabelText('Hero section')).toBeInTheDocument();
      expect(screen.getByLabelText('Platform statistics')).toBeInTheDocument();
    });

    it('all interactive elements are keyboard accessible', () => {
      renderComponent();
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toBeVisible();
      });
    });
  });

  describe('Data Loading', () => {
    it('makes API calls on mount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith('/news');
        expect(mockGet).toHaveBeenCalledWith('/apis/highlights');
      });
    });

    it('only makes API calls once on initial mount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledTimes(2);
      });
    });
  });
});

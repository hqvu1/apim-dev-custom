/**
 * Unit tests for FeatureCard component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { ApiOutlined } from '@mui/icons-material';
import { theme } from '../../theme';
import FeatureCard from './FeatureCard';

describe('FeatureCard', () => {
  const defaultProps = {
    icon: <ApiOutlined data-testid="test-icon" />,
    title: 'Test Feature',
    description: 'This is a test feature description that explains the benefit.',
    index: 0
  };

  const renderComponent = (props = defaultProps) => {
    return render(
      <ThemeProvider theme={theme}>
        <FeatureCard {...props} />
      </ThemeProvider>
    );
  };

  describe('Rendering', () => {
    it('renders without crashing', () => {
      renderComponent();
      expect(screen.getByText('Test Feature')).toBeInTheDocument();
    });

    it('displays the feature title', () => {
      renderComponent();
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Test Feature');
    });

    it('displays the feature description', () => {
      renderComponent();
      expect(screen.getByText(defaultProps.description)).toBeInTheDocument();
    });

    it('renders the icon', () => {
      renderComponent();
      expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    });

    it('renders different content when props change', () => {
      const customProps = {
        ...defaultProps,
        title: 'Custom Feature',
        description: 'Custom description'
      };

      renderComponent(customProps);
      
      expect(screen.getByText('Custom Feature')).toBeInTheDocument();
      expect(screen.getByText('Custom description')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labeling', () => {
      renderComponent();
      const article = screen.getByRole('article');
      expect(article).toHaveAttribute('aria-labelledby', 'feature-title-0');
    });

    it('uses correct heading level (h3)', () => {
      renderComponent();
      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toHaveTextContent('Test Feature');
    });

    it('has unique aria-labelledby based on index', () => {
      const { rerender } = render(
        <ThemeProvider theme={theme}>
          <FeatureCard {...defaultProps} index={5} />
        </ThemeProvider>
      );

      const article = screen.getByRole('article');
      expect(article).toHaveAttribute('aria-labelledby', 'feature-title-5');

      rerender(
        <ThemeProvider theme={theme}>
          <FeatureCard {...defaultProps} index={10} />
        </ThemeProvider>
      );

      expect(article).toHaveAttribute('aria-labelledby', 'feature-title-10');
    });

    it('marks icon container as aria-hidden', () => {
      renderComponent();
      const iconContainer = screen.getByTestId('test-icon').parentElement;
      expect(iconContainer).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Styling', () => {
    it('renders within a Card component', () => {
      const { container } = renderComponent();
      const card = container.querySelector('.MuiCard-root');
      expect(card).toBeInTheDocument();
    });

    it('has CardContent wrapper', () => {
      const { container } = renderComponent();
      const cardContent = container.querySelector('.MuiCardContent-root');
      expect(cardContent).toBeInTheDocument();
    });
  });

  describe('Memoization', () => {
    it('has displayName set for debugging', () => {
      expect(FeatureCard.displayName).toBe('FeatureCard');
    });
  });

  describe('Different Icons', () => {
    it('renders with SecurityOutlined icon', () => {
      const SecurityOutlined = () => <div data-testid="security-icon">Security</div>;
      renderComponent({
        ...defaultProps,
        icon: <SecurityOutlined />
      });

      expect(screen.getByTestId('security-icon')).toBeInTheDocument();
    });
  });
});

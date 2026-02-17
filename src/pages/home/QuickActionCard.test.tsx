/**
 * Unit tests for QuickActionCard component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { ApiOutlined } from '@mui/icons-material';
import { theme } from '../../theme';
import QuickActionCard from './QuickActionCard';

describe('QuickActionCard', () => {
  const defaultProps = {
    icon: <ApiOutlined data-testid="action-icon" />,
    title: 'Quick Action',
    description: 'This is a quick action card description.',
    buttonText: 'Click Me',
    onClick: vi.fn()
  };

  const renderComponent = (props = defaultProps) => {
    return render(
      <ThemeProvider theme={theme}>
        <QuickActionCard {...props} />
      </ThemeProvider>
    );
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      renderComponent();
      expect(screen.getByText('Quick Action')).toBeInTheDocument();
    });

    it('displays the title', () => {
      renderComponent();
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Quick Action');
    });

    it('displays the description', () => {
      renderComponent();
      expect(screen.getByText(defaultProps.description)).toBeInTheDocument();
    });

    it('displays the button with correct text', () => {
      renderComponent();
      expect(screen.getByRole('button', { name: 'Click Me' })).toBeInTheDocument();
    });

    it('renders the icon', () => {
      renderComponent();
      expect(screen.getByTestId('action-icon')).toBeInTheDocument();
    });

    it('renders different content when props change', () => {
      const customProps = {
        ...defaultProps,
        title: 'Custom Action',
        description: 'Custom description',
        buttonText: 'Custom Button'
      };

      renderComponent(customProps);
      
      expect(screen.getByText('Custom Action')).toBeInTheDocument();
      expect(screen.getByText('Custom description')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Custom Button' })).toBeInTheDocument();
    });
  });

  describe('Button Interaction', () => {
    it('calls onClick when button is clicked', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      
      render(
        <ThemeProvider theme={theme}>
          <QuickActionCard {...defaultProps} onClick={onClick} />
        </ThemeProvider>
      );

      const button = screen.getByRole('button', { name: 'Click Me' });
      await user.click(button);

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('calls onClick multiple times when clicked multiple times', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      
      render(
        <ThemeProvider theme={theme}>
          <QuickActionCard {...defaultProps} onClick={onClick} />
        </ThemeProvider>
      );

      const button = screen.getByRole('button', { name: 'Click Me' });
      await user.click(button);
      await user.click(button);
      await user.click(button);

      expect(onClick).toHaveBeenCalledTimes(3);
    });

    it('button has an arrow icon', () => {
      const { container } = renderComponent();
      const arrowIcon = container.querySelector('.MuiButton-endIcon');
      expect(arrowIcon).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper semantic structure', () => {
      renderComponent();
      expect(screen.getByRole('article')).toBeInTheDocument();
    });

    it('button has accessible name', () => {
      renderComponent();
      const button = screen.getByRole('button', { name: 'Click Me' });
      expect(button).toHaveAccessibleName();
    });

    it('uses correct heading level (h3)', () => {
      renderComponent();
      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toHaveTextContent('Quick Action');
    });

    it('marks icon as aria-hidden', () => {
      renderComponent();
      const iconContainer = screen.getByTestId('action-icon').parentElement;
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

    it('button is full width', () => {
      renderComponent();
      const button = screen.getByRole('button', { name: 'Click Me' });
      expect(button).toHaveClass('MuiButton-fullWidth');
    });
  });

  describe('Memoization', () => {
    it('has displayName set for debugging', () => {
      expect(QuickActionCard.displayName).toBe('QuickActionCard');
    });
  });

  describe('Different Props Combinations', () => {
    it('works with long description text', () => {
      const longDescription = 'This is a very long description that contains multiple sentences. It should still render correctly and wrap appropriately within the card layout.';
      
      renderComponent({
        ...defaultProps,
        description: longDescription
      });

      expect(screen.getByText(longDescription)).toBeInTheDocument();
    });

    it('works with different icon types', () => {
      const CustomIcon = () => <div data-testid="custom-icon">Custom</div>;
      
      renderComponent({
        ...defaultProps,
        icon: <CustomIcon />
      });

      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });
  });
});

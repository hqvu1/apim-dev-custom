import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../theme';
import Header from '../components/Header';

describe('Header Component', () => {
  const renderHeader = () => {
    return render(
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <Header />
        </ThemeProvider>
      </BrowserRouter>
    );
  };

  it('renders without crashing', () => {
    renderHeader();
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('displays Komatsu logo or branding', () => {
    renderHeader();
    // Check for logo image or text
    const logo = screen.queryByAltText(/logo/i) || screen.queryByText(/komatsu/i);
    expect(logo).toBeTruthy();
  });
});

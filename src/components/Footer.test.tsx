import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Footer from '../components/Footer';

describe('Footer Component', () => {
  it('renders portal title', () => {
    render(
      <BrowserRouter>
        <Footer />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Komatsu API Marketplace Portal')).toBeInTheDocument();
  });

  it('renders Komatsu branding', () => {
    render(
      <BrowserRouter>
        <Footer />
      </BrowserRouter>
    );
    
    expect(screen.getByText(/Komatsu/i)).toBeInTheDocument();
  });
});

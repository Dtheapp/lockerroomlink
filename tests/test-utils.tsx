import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../contexts/ThemeContext';

// Test wrapper with providers
export function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <BrowserRouter>
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </BrowserRouter>
  );
}

// Helper to render with providers
export function renderWithProviders(ui: React.ReactElement) {
  return render(ui, { wrapper: TestWrapper });
}

describe('Test Utils', () => {
  it('should export TestWrapper', () => {
    expect(TestWrapper).toBeDefined();
  });

  it('should export renderWithProviders', () => {
    expect(renderWithProviders).toBeDefined();
  });
});

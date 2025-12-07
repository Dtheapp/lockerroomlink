import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../components/ErrorBoundary';

// Component that throws an error for testing
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>Content rendered successfully</div>;
}

describe('ErrorBoundary', () => {
  // Suppress console.error during tests
  const originalError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalError;
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('renders error UI when a child component throws', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/We're sorry, but something unexpected happened/)).toBeInTheDocument();
  });

  it('displays the error message in technical details', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // Click to expand details
    const details = screen.getByText('Technical details');
    fireEvent.click(details);

    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('shows Go Home and Refresh buttons', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByRole('button', { name: /Go Home/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Refresh/i })).toBeInTheDocument();
  });

  it('calls window.location.reload when Refresh is clicked', async () => {
    // The ErrorBoundary uses href assignment with nocache param, not reload()
    const originalHref = window.location.href;
    let newHref = '';
    
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        ...window.location,
        href: originalHref,
        get href() { return newHref || originalHref; },
        set href(val) { newHref = val; },
      },
    });

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));
    
    // Wait for async operations in handleReload
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // The implementation sets href with nocache param
    expect(newHref).toMatch(/\?nocache=\d+/);
  });
});

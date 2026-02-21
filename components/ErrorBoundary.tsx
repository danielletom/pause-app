import React from 'react';
import ErrorScreen from './ErrorScreen';

interface ErrorBoundaryProps {
  error: Error;
  retry: () => Promise<void>;
}

/**
 * Custom error boundary that replaces the default Expo Router one.
 * Displays our branded ErrorScreen instead of the generic red error box.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  // Determine error type from the error message
  const type = getErrorType(error);

  return (
    <ErrorScreen
      type={type}
      onRetry={retry}
    />
  );
}

function getErrorType(error: Error): 'generic' | 'no_connection' | 'timeout' | 'server' {
  const msg = error.message?.toLowerCase() || '';

  if (msg.includes('network') || msg.includes('fetch') || msg.includes('offline')) {
    return 'no_connection';
  }
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted')) {
    return 'timeout';
  }
  if (msg.includes('500') || msg.includes('server') || msg.includes('internal')) {
    return 'server';
  }

  return 'generic';
}

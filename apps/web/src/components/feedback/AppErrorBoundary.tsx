import React from 'react';
import { ErrorFallback } from './ErrorFallback';

interface AppErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[app-error-boundary] uncaught render error', error, info);
  }

  resetErrorBoundary = () => {
    this.setState({
      hasError: false,
      error: null,
    });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onRetry={this.resetErrorBoundary} />;
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
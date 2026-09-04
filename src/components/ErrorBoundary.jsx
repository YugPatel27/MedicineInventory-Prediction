import { Component } from 'react';

/**
 * Without an error boundary, any uncaught render error (e.g. calling
 * `.toFixed()` on a missing price field) unmounts the entire React tree,
 * leaving a blank white page — which reads as "the invoice / page is not
 * visible" with zero explanation. This boundary catches that, shows a
 * recoverable message instead, and logs the real error to the console so
 * it's actually debuggable.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('MediStock UI error:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto my-10 max-w-lg space-y-4 rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
          <p className="text-lg font-semibold text-rose-700">Something went wrong displaying this page.</p>
          <p className="text-sm text-rose-600">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.assign('/dashboard')}
              className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;

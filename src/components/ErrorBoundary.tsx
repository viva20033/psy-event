import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-red-50 px-6">
          <div className="max-w-md rounded-2xl bg-white p-6 shadow-lg space-y-2">
            <h1 className="text-lg font-bold text-red-900">Ошибка приложения</h1>
            <p className="text-sm text-slate-700 break-words">{this.state.error.message}</p>
            <button
              type="button"
              className="mt-4 w-full rounded-xl bg-primary-700 py-3 text-white font-medium"
              onClick={() => window.location.reload()}
            >
              Обновить страницу
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

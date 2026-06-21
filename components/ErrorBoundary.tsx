
import React from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    const { hasError, error } = this.state;
    
    if (hasError) {
      let errorMessage = "An unexpected error occurred.";
      let isPermissionError = false;

      try {
        if (error?.message) {
          const parsed = JSON.parse(error.message);
          if (parsed.error && parsed.error.includes('insufficient permissions')) {
            errorMessage = `Security Access Denied: You do not have permission to ${parsed.operationType} this data.`;
            isPermissionError = true;
          }
        }
      } catch (e) {
        // Not a JSON error, use default
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#fdfbf7] p-6">
          <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl border border-stone-100 p-10 text-center space-y-6">
            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-[24px] flex items-center justify-center mx-auto shadow-lg shadow-red-100">
              <AlertTriangle size={40} />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-stone-900 tracking-tight">
                {isPermissionError ? "Access Restricted" : "System Error"}
              </h2>
              <p className="text-stone-500 text-sm font-medium leading-relaxed">
                {errorMessage}
              </p>
            </div>

            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-black text-white font-black rounded-2xl shadow-xl hover:bg-stone-800 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-[10px]"
            >
              <RefreshCcw size={16} />
              Reload Application
            </button>
            
            <p className="text-[9px] text-stone-400 font-black uppercase tracking-[0.2em]">
              Enterprise Security Engine
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

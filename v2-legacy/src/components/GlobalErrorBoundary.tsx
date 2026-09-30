"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[GlobalErrorBoundary] Caught error:", error);
    console.error("[GlobalErrorBoundary] Component stack:", errorInfo.componentStack);
    this.setState({ errorInfo });
  }

  componentDidMount() {
    if (typeof window === "undefined") return;

    this._onError = (event: ErrorEvent) => {
      if (event.error && event.error !== this.state.error) {
        console.error("[GlobalErrorBoundary] Window error:", event.error);
        this.setState({ hasError: true, error: event.error });
      }
    };

    this._onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
      console.error("[GlobalErrorBoundary] Unhandled rejection:", reason);
      this.setState({ hasError: true, error: reason });
    };

    window.addEventListener("error", this._onError);
    window.addEventListener("unhandledrejection", this._onRejection);
  }

  componentWillUnmount() {
    if (typeof window === "undefined") return;
    if (this._onError) window.removeEventListener("error", this._onError);
    if (this._onRejection) window.removeEventListener("unhandledrejection", this._onRejection);
  }

  private _onError: ((e: ErrorEvent) => void) | null = null;
  private _onRejection: ((e: PromiseRejectionEvent) => void) | null = null;

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex items-center justify-center min-h-screen p-4 bg-[var(--background)]">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center text-center max-w-sm"
          >
            <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>

            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">
              出了点问题
            </h2>
            <p className="text-sm text-[var(--muted-foreground)] mb-2">
              遇到了意料之外的问题，刷新试试？
            </p>
            {this.state.error && (
              <p className="text-xs text-[var(--muted-foreground)] bg-[var(--bg-secondary)] rounded-xl px-3 py-2 mb-6 max-w-full break-all opacity-70">
                {this.state.error.message || "未知错误"}
              </p>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  this.handleReset();
                  window.location.reload();
                }}
                className="inline-flex items-center gap-2 bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-600 transition-colors active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                刷新页面
              </button>
              <Link
                href="/"
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-800 text-[var(--foreground)] px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <Home className="w-4 h-4" />
                回首页
              </Link>
            </div>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}

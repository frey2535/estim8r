import { Component } from "react";
import { RESET_ERRORS_EVENT } from "@/lib/appRefresh";
import AppRefreshButton from "@/components/AppRefreshButton";

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { crashed: false, error: null };
    this.onReset = this.onReset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { crashed: true, error };
  }

  componentDidCatch(error, info) {
    console.error("Estim8r screen crashed", error, info);
  }

  componentDidMount() {
    window.addEventListener(RESET_ERRORS_EVENT, this.onReset);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.crashed) {
      this.setState({ crashed: false, error: null });
    }
  }

  componentWillUnmount() {
    window.removeEventListener(RESET_ERRORS_EVENT, this.onReset);
  }

  onReset() {
    if (this.state.crashed) this.setState({ crashed: false, error: null });
  }

  render() {
    if (!this.state.crashed) return this.props.children;

    const detail = import.meta.env.DEV
      ? (this.state.error?.message || String(this.state.error))
      : null;

    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center p-6 text-center" role="alert" data-testid="app-crash-boundary">
        <h1 className="text-lg font-bold text-foreground">This screen hit a problem</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Refresh Estim8r to load the latest build and clear this error. The open estimate and takeoff stay in this browser.
        </p>
        {detail ? (
          <p className="mt-3 w-full rounded-lg bg-muted p-2 text-left font-mono text-xs text-destructive break-all">
            {detail}
          </p>
        ) : null}
        <div className="mt-4">
          <AppRefreshButton />
        </div>
      </div>
    );
  }
}

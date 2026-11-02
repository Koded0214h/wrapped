import { Component, type ErrorInfo, type ReactNode } from 'react'
import { trackError } from '../lib/telemetry'

export class ErrorBoundary extends Component<{ children: ReactNode; scope?: string; fallback?: ReactNode }, { failed: boolean; code: string }> {
  state = { failed: false, code: 'U-500' }
  static getDerivedStateFromError(error: Error) { return { failed: true, code: error.message.match(/[A-Z]-\d{3}/)?.[0] ?? 'U-500' } }
  componentDidCatch(error: Error, info: ErrorInfo) { trackError(error, { scope: this.props.scope?.slice(0, 40) ?? 'app', stackHash: String(info.componentStack?.length ?? 0) }) }
  render() {
    if (!this.state.failed) return this.props.children
    return this.props.fallback ?? <main className="fatal-error"><h1>This part couldn’t load.</h1><p>Reload and try again. If it keeps happening, send support code <strong>{this.state.code}</strong>.</p><button onClick={() => location.reload()}>Reload app</button></main>
  }
}

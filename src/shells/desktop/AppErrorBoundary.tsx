import { Component, type ReactNode } from 'react'

interface Props {
  appName: string
  children: ReactNode
}

interface State {
  failed: boolean
}

// Scoped to one window: a crashing app shows its own message and never takes the desktop down.
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  private reopen = () => this.setState({ failed: false })

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-[13px]">
        <p>{this.props.appName} quit unexpectedly.</p>
        <button
          type="button"
          onClick={this.reopen}
          className="rounded-md bg-accent px-3 py-1 text-white"
        >
          Reopen
        </button>
      </div>
    )
  }
}

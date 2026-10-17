import React from 'react';

export default class ErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main role="alert" style={{ padding: 32 }}><h1>Something went wrong</h1><p>Your saved data remains on this device. Reload to try again.</p><button onClick={() => window.location.reload()}>Reload app</button></main>;
    return this.props.children;
  }
}

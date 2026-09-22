import { Component, Suspense, lazy } from 'react';
import type { ReactNode } from 'react';

const Orbit = lazy(() => import('./Orbit'));

/** The static CSS illustration. Also the Suspense fallback and the failure state. */
const FALLBACK = (
  <div className="orbit" aria-hidden="true">
    <div className="orbit__fallback" />
  </div>
);

interface BoundaryProps {
  readonly children: ReactNode;
}

interface BoundaryState {
  readonly failed: boolean;
}

/**
 * Keeps a decorative graphic from taking the page down with it. If the Three.js chunk
 * cannot be fetched, the CSS illustration remains and everything else still works.
 */
class OrbitBoundary extends Component<BoundaryProps, BoundaryState> {
  constructor(props: BoundaryProps) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  override render(): ReactNode {
    return this.state.failed ? FALLBACK : this.props.children;
  }
}

export default function LazyOrbit() {
  return (
    <OrbitBoundary>
      <Suspense fallback={FALLBACK}>
        <Orbit />
      </Suspense>
    </OrbitBoundary>
  );
}

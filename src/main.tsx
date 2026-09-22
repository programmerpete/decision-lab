import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Self-hosted so the site makes no third-party request and still renders correctly
// when the network is unavailable during a rehearsal.
import '@fontsource-variable/inter/wght.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';

import App from './App';
import './styles.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Decision Lab could not find its root element.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

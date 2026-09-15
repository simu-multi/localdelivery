import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PorscheDesignSystemProvider } from '@porsche-design-system/components-react';
import { AuthProvider } from './lib/auth';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PorscheDesignSystemProvider theme="light">
      <AuthProvider>
        <App />
      </AuthProvider>
    </PorscheDesignSystemProvider>
  </StrictMode>
);

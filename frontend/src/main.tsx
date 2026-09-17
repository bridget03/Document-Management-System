import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Router from './router';
import { ToastProvider } from './components/ui/Toast';
import './index.css';

const qc = new QueryClient();
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <Router />
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

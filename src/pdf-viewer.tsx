import React from 'react';
import ReactDOM from 'react-dom/client';
import PdfViewerWindow from './components/PdfViewerWindow';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PdfViewerWindow />
  </React.StrictMode>,
);

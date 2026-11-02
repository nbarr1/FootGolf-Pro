import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { hydrateNativeStorage } from './platform/storage';
import { configureSystemUi } from './platform/lifecycle';

// In the Android app, restore saved progress from native storage before the first render
hydrateNativeStorage().finally(() => {
  configureSystemUi();
  createRoot(document.getElementById('root')!).render(<App />);
});

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const themeKey = 'ghs-theme-mode';
const storedTheme = window.localStorage.getItem(themeKey);
const initialTheme =
  storedTheme === 'dark' || storedTheme === 'light'
    ? storedTheme
    : window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';

document.documentElement.classList.toggle('dark', initialTheme === 'dark');
document.documentElement.style.colorScheme = initialTheme;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

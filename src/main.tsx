import React from 'react';
import ReactDOM from 'react-dom/client';
import * as echarts from 'echarts';
import App from './App';
import './styles/index.css';
import { CHART_THEME } from './lib/chartTheme';

echarts.registerTheme('dark-analytics', CHART_THEME);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

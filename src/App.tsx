import { HashRouter, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ExecutiveDashboard from './pages/ExecutiveDashboard';
import Insights from './pages/Insights';
import SqlStudio from './pages/SqlStudio';

const App = () => (
  <HashRouter>
    <Layout>
      <Routes>
        <Route path="/" element={<ExecutiveDashboard />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/sql-studio" element={<SqlStudio />} />
      </Routes>
    </Layout>
  </HashRouter>
);

export default App;

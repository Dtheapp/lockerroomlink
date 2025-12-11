import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Components from './pages/Components';
import Services from './pages/Services';
import Routes_ from './pages/Routes';
import Features from './pages/Features';
import Errors from './pages/Errors';
import Learnings from './pages/Learnings';
import Revenue from './pages/Revenue';
import Competitors from './pages/Competitors';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="components" element={<Components />} />
        <Route path="services" element={<Services />} />
        <Route path="routes" element={<Routes_ />} />
        <Route path="features" element={<Features />} />
        <Route path="errors" element={<Errors />} />
        <Route path="learnings" element={<Learnings />} />
        <Route path="revenue" element={<Revenue />} />
        <Route path="competitors" element={<Competitors />} />
      </Route>
    </Routes>
  );
}

export default App;

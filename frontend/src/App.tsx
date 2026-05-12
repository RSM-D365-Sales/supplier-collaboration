import { Routes, Route } from 'react-router-dom';
import RFQPage from './pages/RFQPage';
import NotFound from './pages/NotFound';
import LandingPage from './pages/LandingPage';
import AdminPage from './pages/AdminPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/rfq/:token" element={<RFQPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

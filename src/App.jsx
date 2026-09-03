import { Routes, Route } from 'react-router-dom';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<div className="plai-section">AménagActif</div>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

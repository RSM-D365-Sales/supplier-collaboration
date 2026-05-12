import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-md p-12 max-w-md w-full text-center">
        <div className="text-6xl font-black text-gray-200 mb-4">404</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Page Not Found</h1>
        <p className="text-gray-500 text-sm mb-6">
          The page you are looking for does not exist. If you received a link from a buyer,
          please check that you copied it correctly.
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 bg-brand-700 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-brand-800 transition-colors text-sm"
        >
          <Home size={16} />
          Home
        </a>
      </div>
    </div>
  );
}

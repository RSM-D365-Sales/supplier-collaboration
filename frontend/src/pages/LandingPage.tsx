import { Link } from 'react-router-dom';
import { Link2, Shield, ArrowRight } from 'lucide-react';

// Demo links pre-seeded in the backend
const DEMO_VENDORS = [
  { name: 'Flo-Tech', token: 'demo-token-flotech-001', color: 'bg-blue-600' },
  { name: 'Tech Solutions Inc', token: 'demo-token-techsol-002', color: 'bg-indigo-600' },
  { name: 'Global Supplies Co', token: 'demo-token-globsup-003', color: 'bg-violet-600' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-700 to-brand-900 flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="flex items-center gap-1">
            <div className="w-3 h-7 bg-white rounded-sm" />
            <div className="w-3 h-7 bg-white/60 rounded-sm" />
            <div className="w-3 h-7 bg-white/30 rounded-sm" />
          </div>
          <span className="text-white font-bold text-2xl tracking-wide ml-1">PORTAL</span>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h1 className="text-2xl font-black text-gray-800 mb-2">
            Supplier Collaboration Portal
          </h1>
          <p className="text-gray-500 text-sm mb-8">
            Powered by D365 Finance &amp; Supply Chain. Vendors access their personalised RFQ via
            a unique secure link sent by email.
          </p>

          {/* How it works */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { icon: '📧', step: '1', title: 'Email sent', desc: 'D365 sends each vendor a unique link' },
              { icon: '🔗', step: '2', title: 'Vendor visits', desc: 'Personalised RFQ with name & items' },
              { icon: '✅', step: '3', title: 'Response syncs', desc: 'Prices written back to D365' },
            ].map(({ icon, step, title, desc }) => (
              <div key={step} className="text-center p-4 bg-gray-50 rounded-xl">
                <div className="text-2xl mb-1">{icon}</div>
                <div className="text-xs text-brand-600 font-bold mb-1">STEP {step}</div>
                <div className="text-sm font-semibold text-gray-800">{title}</div>
                <div className="text-xs text-gray-500 mt-1">{desc}</div>
              </div>
            ))}
          </div>

          {/* Demo links */}
          <div className="border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={16} className="text-brand-600" />
              <p className="text-sm font-semibold text-gray-700">
                Demo – 3 vendor links for RFQ 000334 (Stark Industries)
              </p>
            </div>
            <div className="space-y-2">
              {DEMO_VENDORS.map(({ name, token, color }) => (
                <Link
                  key={token}
                  to={`/rfq/${token}`}
                  className="flex items-center justify-between bg-gray-50 border border-gray-200 hover:border-brand-400 hover:bg-brand-50 rounded-lg px-4 py-3 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 ${color} rounded-full flex items-center justify-center text-white text-xs font-bold`}>
                      {name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{name}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <Link2 size={10} />
                        /rfq/{token}
                      </p>
                    </div>
                  </div>
                  <ArrowRight
                    size={16}
                    className="text-gray-400 group-hover:text-brand-600 transition-colors"
                  />
                </Link>
              ))}
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            In production, vendors receive only their own private link — they cannot see other vendors.
          </p>
        </div>
      </div>
    </div>
  );
}

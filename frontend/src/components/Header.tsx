import { Building2, UserCheck } from 'lucide-react';

interface HeaderProps {
  companyName: string;
  vendorName: string;
  vendorId: string;
}

export default function Header({ companyName, vendorName, vendorId }: HeaderProps) {
  return (
    <header className="bg-brand-700 text-white">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
        {/* Logo / Brand mark */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="w-2 h-5 bg-white rounded-sm" />
            <div className="w-2 h-5 bg-white/60 rounded-sm" />
            <div className="w-2 h-5 bg-white/30 rounded-sm" />
          </div>
          <span className="text-white font-bold text-lg tracking-wide ml-1">PORTAL</span>
        </div>

        {/* Buyer company name – centred */}
        <div className="flex items-center gap-2">
          <Building2 size={18} className="text-white/80" />
          <span className="text-white font-semibold text-lg">{companyName}</span>
        </div>

        {/* Vendor identity + secure badge */}
        <div className="flex flex-col items-end gap-0.5">
          <div className="flex items-center gap-1.5">
            <UserCheck size={15} className="text-white/80" />
            <span className="text-white font-semibold text-sm">{vendorName}</span>
          </div>
          <div className="flex items-center gap-1.5 text-white/60 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
            Secure link &middot; Vendor {vendorId}
          </div>
        </div>
      </div>
    </header>
  );
}

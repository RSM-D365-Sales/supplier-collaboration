import { Check, X, Minus } from 'lucide-react';
import { ResponseStatus } from '../types/rfq';

interface ResponseStatusSelectorProps {
  value: ResponseStatus;
  onChange: (status: ResponseStatus) => void;
  disabled?: boolean;
}

const options: Array<{ value: ResponseStatus; label: string; Icon: typeof Check }> = [
  { value: 'replied',  label: 'Replied',   Icon: Check },
  { value: 'declined', label: 'Declined',  Icon: X },
  { value: 'no-reply', label: 'No Reply',  Icon: Minus },
];

export default function ResponseStatusSelector({
  value,
  onChange,
  disabled = false,
}: ResponseStatusSelectorProps) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-sm text-gray-600 mr-3 font-medium">Response</span>
      <div className={`flex gap-2 ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
        {options.map(({ value: v, label, Icon }) => {
          const isActive = value === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              className={`status-btn ${isActive ? 'status-btn-active' : 'status-btn-inactive'}`}
              aria-pressed={isActive}
            >
              <Icon size={14} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

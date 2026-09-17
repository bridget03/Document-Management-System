import { ReactNode } from 'react';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

const tones: Record<Tone, string> = {
  neutral: 'bg-gray-100 text-gray-700 border-gray-200',
  success: 'bg-green-50 text-green-700 border-green-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-red-50 text-red-600 border-red-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  brand: 'bg-brand-50 text-brand-700 border-brand-100',
};

const dots: Record<Tone, string> = {
  neutral: 'bg-gray-400',
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-blue-500',
  brand: 'bg-brand-600',
};

interface Props {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

export default function Badge({ tone = 'neutral', dot = false, children, className = '' }: Props) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${tones[tone]} ${className}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dots[tone]}`} aria-hidden />}
      {children}
    </span>
  );
}

import { ReactNode } from 'react';
import { FileSearch } from 'lucide-react';
import Button from './Button';

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon, title, description, actionLabel, onAction }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
      <div className="text-gray-300">{icon || <FileSearch size={40} />}</div>
      <p className="font-semibold text-gray-900">{title}</p>
      {description && <p className="max-w-sm text-sm text-gray-500">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" className="mt-2" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

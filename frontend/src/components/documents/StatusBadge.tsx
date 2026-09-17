import Badge from '../ui/Badge';

export function syncTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'SYNCED') return 'success';
  if (status === 'REMOTE_MISSING' || status === 'CONFLICT') return 'warning';
  if (status === 'FAILED') return 'danger';
  return 'neutral';
}

export function syncLabel(status: string, source: string): string {
  if (status === 'SYNCED') return 'Synced';
  if (status === 'REMOTE_MISSING') return 'Missing';
  if (status === 'FAILED') return 'Failed';
  if (status === 'SYNCING' || status === 'PENDING') return 'Syncing';
  if (status === 'CONFLICT') return 'Conflict';
  return source === 'GOOGLE_DRIVE' ? 'Drive' : 'Local';
}

export default function StatusBadge({ status, source }: { status: string; source: string }) {
  return (
    <Badge tone={syncTone(status)} dot>
      {syncLabel(status, source)}
    </Badge>
  );
}

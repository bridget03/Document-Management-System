import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Tag as TagIcon } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { listDocuments } from '../services/documentApi';
import { Card, TableSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import { IconButton } from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import { TextInput, Field } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';

interface Tag {
  id: string;
  name: string;
}

export default function Tags() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const { data, isLoading, isError, refetch } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: () => api.get('/tags').then((r) => r.data),
  });
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [modal, setModal] = useState(false);
  const [name, setName] = useState('');
  const [del, setDel] = useState<Tag | null>(null);

  useEffect(() => {
    if (!data) return;
    let alive = true;
    Promise.all(
      data.map((t) =>
        listDocuments({ tag_id: t.id, page: 1, page_size: 1 })
          .then((r) => [t.id, r.total] as const)
          .catch(() => [t.id, 0] as const),
      ),
    ).then((entries) => {
      if (alive) setCounts(Object.fromEntries(entries));
    });
    return () => {
      alive = false;
    };
  }, [data]);

  const create = useMutation({
    mutationFn: () => api.post('/tags', { name: name.trim() }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] });
      setModal(false);
      setName('');
      toast('success', 'Tag created.');
    },
    onError: () => toast('error', 'Could not create tag.'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/tags/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] });
      qc.invalidateQueries({ queryKey: ['docs'] });
      setDel(null);
      toast('success', 'Tag deleted.');
    },
    onError: () => toast('error', 'Could not delete tag.'),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tags</h1>
          <p className="mt-0.5 text-sm text-gray-500">Flexible labels across all documents.</p>
        </div>
        <Button variant="primary" onClick={() => setModal(true)}>
          <Plus size={15} /> New tag
        </Button>
      </div>

      {isError ? (
        <Card className="px-6 py-10 text-center">
          <p className="font-semibold text-gray-900">Unable to load tags</p>
          <Button size="sm" className="mt-3" onClick={() => refetch()}>Try again</Button>
        </Card>
      ) : isLoading ? (
        <TableSkeleton rows={3} cols={2} />
      ) : (data || []).length === 0 ? (
        <EmptyState
          title="No tags yet"
          description="Create your first tag to label documents."
          actionLabel="New tag"
          onAction={() => setModal(true)}
        />
      ) : (
        <Card className="p-5">
          <div className="flex flex-wrap gap-2">
            {(data || []).map((t) => (
              <span key={t.id} className="group inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 py-1 pl-2.5 pr-1.5 text-sm">
                <TagIcon size={13} className="text-gray-400" />
                <span className="font-medium text-gray-700">{t.name}</span>
                <Badge tone="neutral">{counts[t.id] ?? '—'}</Badge>
                {isAdmin && (
                  <IconButton
                    label={`Delete ${t.name}`}
                    tone="danger"
                    iconSize="sm"
                    onClick={() => setDel(t)}
                    className="rounded-full opacity-0 focus:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </IconButton>
                )}
              </span>
            ))}
          </div>
        </Card>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="New tag"
        footer={
          <>
            <Button onClick={() => setModal(false)}>Cancel</Button>
            <Button variant="primary" loading={create.isPending} disabled={!name.trim()} onClick={() => create.mutate()}>
              Create
            </Button>
          </>
        }
      >
        <Field label="Name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="hop-dong" />
        </Field>
      </Modal>

      <Modal
        open={del !== null}
        onClose={() => setDel(null)}
        title="Delete tag"
        footer={
          <>
            <Button onClick={() => setDel(null)}>Cancel</Button>
            <Button variant="primary" loading={remove.isPending} onClick={() => del && remove.mutate(del.id)}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">Remove tag “{del?.name}” from all documents?</p>
      </Modal>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import api from '../services/api';
import { listDocuments } from '../services/documentApi';
import { Card, TableSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { IconButton } from '../components/ui/Button';
import { TextInput, TextArea, Field } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';

interface Category {
  id: string;
  name: string;
  description?: string | null;
}

export default function Categories() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, isError, refetch } = useQuery<Category[]>({
    queryKey: ['cats'],
    queryFn: () => api.get('/categories').then((r) => r.data),
  });
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [modal, setModal] = useState<null | { id?: string; name: string; description: string }>(null);
  const [delId, setDelId] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    let alive = true;
    Promise.all(
      data.map((c) =>
        listDocuments({ category_id: c.id, page: 1, page_size: 1 })
          .then((r) => [c.id, r.total] as const)
          .catch(() => [c.id, 0] as const),
      ),
    ).then((entries) => {
      if (alive) setCounts(Object.fromEntries(entries));
    });
    return () => {
      alive = false;
    };
  }, [data]);

  const save = useMutation({
    mutationFn: () => {
      if (!modal) throw new Error('no data');
      return modal.id
        ? api.put(`/categories/${modal.id}`, { name: modal.name, description: modal.description || null }).then((r) => r.data)
        : api.post('/categories', { name: modal.name, description: modal.description || null }).then((r) => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cats'] });
      setModal(null);
      toast('success', 'Category saved.');
    },
    onError: () => toast('error', 'Could not save category.'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cats'] });
      qc.invalidateQueries({ queryKey: ['docs'] });
      setDelId(null);
      toast('success', 'Category deleted.');
    },
    onError: () => toast('error', 'Could not delete category.'),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Categories</h1>
          <p className="mt-0.5 text-sm text-gray-500">Organize documents into structured categories.</p>
        </div>
        <Button variant="primary" onClick={() => setModal({ name: '', description: '' })}>
          <Plus size={15} /> New category
        </Button>
      </div>

      {isError ? (
        <Card className="px-6 py-10 text-center">
          <p className="font-semibold text-gray-900">Unable to load categories</p>
          <Button size="sm" className="mt-3" onClick={() => refetch()}>Try again</Button>
        </Card>
      ) : isLoading ? (
        <TableSkeleton rows={5} cols={3} />
      ) : (data || []).length === 0 ? (
        <EmptyState
          title="No categories yet"
          description="Create your first category to organize documents."
          actionLabel="New category"
          onAction={() => setModal({ name: '', description: '' })}
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Documents</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(data || []).map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-gray-900">{c.name}</span>
                    {c.description && <span className="block text-xs text-gray-500">{c.description}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{counts[c.id] ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="inline-flex gap-1">
                      <IconButton
                        label={`Rename ${c.name}`}
                        onClick={() => setModal({ id: c.id, name: c.name, description: c.description || '' })}
                      >
                        <Pencil size={15} />
                      </IconButton>
                      <IconButton
                        label={`Delete ${c.name}`}
                        tone="danger"
                        onClick={() => setDelId(c.id)}
                      >
                        <Trash2 size={15} />
                      </IconButton>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.id ? 'Rename category' : 'New category'}
        footer={
          <>
            <Button onClick={() => setModal(null)}>Cancel</Button>
            <Button variant="primary" loading={save.isPending} disabled={!modal?.name.trim()} onClick={() => save.mutate()}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Name">
            <TextInput value={modal?.name || ''} onChange={(e) => setModal((m) => (m ? { ...m, name: e.target.value } : m))} />
          </Field>
          <Field label="Description">
            <TextArea rows={2} value={modal?.description || ''} onChange={(e) => setModal((m) => (m ? { ...m, description: e.target.value } : m))} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={delId !== null}
        onClose={() => setDelId(null)}
        title="Delete category"
        footer={
          <>
            <Button onClick={() => setDelId(null)}>Cancel</Button>
            <Button variant="primary" loading={remove.isPending} onClick={() => delId && remove.mutate(delId)}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">Delete this category? Documents in it become uncategorized.</p>
      </Modal>
    </div>
  );
}

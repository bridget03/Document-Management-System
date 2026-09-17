import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { corrCreate, corrGet, corrUpdate } from '../services/correspondenceApi';
import { Card, Skeleton } from '../components/ui/Skeleton';
import CorrespondenceForm, { type CorrFormValue } from '../components/correspondence/CorrespondenceForm';
import type { CorrDoc, Direction } from '../types/correspondence';

interface Props {
  direction: Direction;
  title: string;
  base: string;
}

function toPayload(v: CorrFormValue) {
  const num = (s: string) => (s.trim() === '' ? undefined : Number(s.trim()));
  const dt = (s: string) => (s.trim() === '' ? undefined : s.trim());
  const links = v.links
    .map((l) => ({ name: l.name.trim() || l.url.trim(), url: l.url.trim() }))
    .filter((l) => l.url);
  return {
    document_number: v.document_number.trim(),
    recipient: v.recipient.trim() || undefined,
    sender: v.sender.trim() || undefined,
    quantity: num(v.quantity),
    signer: v.signer.trim() || undefined,
    security_level: v.security_level || undefined,
    urgency_level: v.urgency_level || undefined,
    signed_date: dt(v.signed_date),
    effective_date: dt(v.effective_date),
    expiry_date: dt(v.expiry_date),
    issuing_department: v.issuing_department.trim() || undefined,
    issue_date: dt(v.issue_date),
    document_type_id: v.document_type_id || undefined,
    processing_status: v.processing_status,
    notes: v.notes.trim() || undefined,
    attachment_ids: v.attachment_ids.map((a) => a.document_id),
    links,
  };
}

export default function CorrespondenceFormPage({ direction, title, base }: Props) {
  const { id } = useParams();
  const isEdit = !!id;
  const apiDir = direction === 'OUTGOING' ? 'outgoing' : 'incoming';
  const nav = useNavigate();
  const qc = useQueryClient();
  const [serverError, setServerError] = useState('');

  const { data, isLoading } = useQuery<CorrDoc>({
    queryKey: ['corr-doc', id],
    queryFn: () => corrGet(apiDir, id!),
    enabled: isEdit,
  });

  const save = useMutation({
    mutationFn: (payload: { value: CorrFormValue; and: 'close' | 'add' | 'open' }) =>
      isEdit
        ? corrUpdate(apiDir, id!, toPayload(payload.value))
        : corrCreate(apiDir, toPayload(payload.value)),
    onSuccess: (doc, { and }) => {
      qc.invalidateQueries({ queryKey: ['corr', direction] });
      qc.invalidateQueries({ queryKey: ['corr-doc', id] });
      if (and === 'close') nav(base);
      else if (and === 'open') nav(`${base}/${(doc as CorrDoc).id}`);
      else {
        // Reset to a fresh form for the next entry.
        setFormKey((k) => k + 1);
        setServerError('');
      }
    },
    onError: (e: unknown) => {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setServerError(typeof detail === 'string' ? detail : 'Lỗi không xác định.');
    },
  });

  // Bump to reset the inner form after "Lưu và thêm tiếp".
  const [formKey, setFormKey] = useState(0);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <Link to={isEdit ? `${base}/${id}` : base} className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900">
        <ArrowLeft size={14} /> {isEdit ? 'Về chi tiết' : 'Về danh sách'}
      </Link>
      <div>
        <h1 className="text-xl font-bold text-gray-900">{isEdit ? 'Chỉnh sửa văn bản' : title}</h1>
      </div>
      {isEdit && isLoading ? (
        <Card className="space-y-3 p-5">
          <Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /><Skeleton className="h-24 w-full" />
        </Card>
      ) : (
        <CorrespondenceForm
          key={formKey}
          direction={direction}
          initial={isEdit ? data || null : null}
          pending={save.isPending}
          serverError={serverError}
          createMode={!isEdit}
          onCancel={() => nav(isEdit ? `${base}/${id}` : base)}
          onSubmit={(value, and) => {
            setServerError('');
            save.mutate({ value, and });
          }}
        />
      )}
    </div>
  );
}

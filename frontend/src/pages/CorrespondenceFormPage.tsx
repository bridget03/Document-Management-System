import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { corrCreate, corrFolders, corrGet, corrUpdate } from '../services/correspondenceApi';
import { Card, Skeleton } from '../components/ui/Skeleton';
import CorrespondenceForm, { type CorrFormValue } from '../components/correspondence/CorrespondenceForm';
import IncomingForm from '../components/correspondence/IncomingForm';
import OutgoingForm from '../components/correspondence/OutgoingForm';
import type { CorrDoc, Direction } from '../types/correspondence';
import { DIRECTION_CONFIG } from '../types/correspondence';

interface Props {
  direction: Direction;
  title: string;
  base: string;
}

function toPayload(v: CorrFormValue, direction: Direction, folderId?: string | null) {
  const num = (s: string) => (s.trim() === '' ? undefined : Number(s.trim()));
  const dt = (s: string) => (s.trim() === '' ? undefined : s.trim());
  // Đi/Nội bộ: chuẩn hoá "A,, B ;  C" -> "A; B; C" (nhiều nơi).
  // Đến: nơi gửi chỉ 1 -> trim giữ nguyên.
  const multiParty = (s: string) => {
    const list = s
      .split(/[;,\n]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    return list.length > 0 ? list.join('; ') : undefined;
  };
  const singleParty = (s: string) => s.trim() || undefined;
  const links = v.links
    .map((l) => ({ name: l.name.trim() || l.url.trim(), url: l.url.trim() }))
    .filter((l) => l.url);
  return {
    document_number: v.document_number.trim(),
    recipient:
      direction === 'INCOMING' ? singleParty(v.recipient) : multiParty(v.recipient),
    sender:
      direction === 'INCOMING' ? singleParty(v.sender) : multiParty(v.sender),
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
    is_important: v.is_important,
    visibility: v.visibility || undefined,
    department: multiParty(v.department),
    folder_id: folderId || undefined,
    attachment_ids: v.attachment_ids.map((a) => a.document_id),
    links,
  };
}

export default function CorrespondenceFormPage({ direction, title, base }: Props) {
  const { id } = useParams();
  const isEdit = !!id;
  const apiDir = DIRECTION_CONFIG[direction].api;
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const folderId = !isEdit ? searchParams.get('folder') : null;
  const listUrl = folderId ? `${base}?folder=${encodeURIComponent(folderId)}` : base;
  const qc = useQueryClient();
  const [serverError, setServerError] = useState('');

  const { data, isLoading } = useQuery<CorrDoc>({
    queryKey: ['corr-doc', id],
    queryFn: () => corrGet(apiDir, id!),
    enabled: isEdit,
  });

  const { data: folders = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['corr-folders', direction],
    queryFn: () => corrFolders(direction),
    enabled: !isEdit && !!folderId,
  });
  const folderName = folders.find((f) => f.id === folderId)?.name ?? null;

  const save = useMutation({
    mutationFn: (payload: { value: CorrFormValue; and: 'close' | 'add' | 'open' }) =>
      isEdit
        ? corrUpdate(apiDir, id!, toPayload(payload.value, direction, null))
        : corrCreate(apiDir, toPayload(payload.value, direction, folderId)),
    onSuccess: (doc, { and }) => {
      qc.invalidateQueries({ queryKey: ['corr', direction] });
      qc.invalidateQueries({ queryKey: ['corr-folders', direction] });
      qc.invalidateQueries({ queryKey: ['corr-doc', id] });
      if (and === 'close') nav(listUrl);
      else if (and === 'open') nav(`${base}/${(doc as CorrDoc).id}`);
      else {
        // Reset to a fresh form for the next entry, vẫn giữ ?folder= trên URL
        // nên công văn tiếp theo tự vào cùng thư mục.
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
      <Link to={isEdit ? `${base}/${id}` : listUrl} className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900">
        <ArrowLeft size={14} /> {isEdit ? 'Về chi tiết' : 'Về danh sách'}
      </Link>
      <div>
        <h1 className="text-xl font-bold text-gray-900">{isEdit ? 'Chỉnh sửa văn bản' : title}</h1>
        {!isEdit && folderId && (
          <p className="mt-1 text-sm text-gray-500">
            Sẽ tự lưu vào thư mục:{' '}
            <Link to={listUrl} className="font-medium text-brand-700 hover:underline">
              {folderName ?? 'đang tải...'}
            </Link>
            <span className="text-gray-400"> · </span>
            <Link to={base} className="text-gray-500 hover:underline">
              Tạo ngoài thư mục
            </Link>
          </p>
        )}
      </div>
      {isEdit && isLoading ? (
        <Card className="space-y-3 p-5">
          <Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /><Skeleton className="h-24 w-full" />
        </Card>
      ) : direction === 'INCOMING' ? (
        <IncomingForm
          key={formKey}
          initial={isEdit ? data || null : null}
          pending={save.isPending}
          serverError={serverError}
          createMode={!isEdit}
          onCancel={() => nav(isEdit ? `${base}/${id}` : listUrl)}
          onSubmit={(value, and) => {
            setServerError('');
            save.mutate({ value, and });
          }}
        />
      ) : direction === 'OUTGOING' ? (
        <OutgoingForm
          key={formKey}
          initial={isEdit ? data || null : null}
          pending={save.isPending}
          serverError={serverError}
          createMode={!isEdit}
          onCancel={() => nav(isEdit ? `${base}/${id}` : listUrl)}
          onSubmit={(value, and) => {
            setServerError('');
            save.mutate({ value, and });
          }}
        />
      ) : (
        <CorrespondenceForm
          key={formKey}
          direction={direction}
          initial={isEdit ? data || null : null}
          pending={save.isPending}
          serverError={serverError}
          createMode={!isEdit}
          onCancel={() => nav(isEdit ? `${base}/${id}` : listUrl)}
          onSubmit={(value, and) => {
            setServerError('');
            save.mutate({ value, and });
          }}
        />
      )}
    </div>
  );
}

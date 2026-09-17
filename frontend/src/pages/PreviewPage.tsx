import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download } from 'lucide-react';
import { getDocument, downloadViaBlob } from '../services/documentApi';
import DocumentViewer from '../components/document-viewer/DocumentViewer';
import { Card, Skeleton } from '../components/ui/Skeleton';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { fileTypeLabel } from '../components/document-viewer/preview';
import type { Document } from '../types/document';

export default function PreviewPage() {
  const { id } = useParams();
  const { toast } = useToast();
  const { data, isLoading, isError } = useQuery<Document>({
    queryKey: ['doc', id],
    queryFn: () => getDocument(id!),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <Card className="mx-auto max-w-2xl px-6 py-10 text-center">
        <p className="font-semibold text-gray-900">Document not found</p>
        <Link to="/documents" className="mt-3 inline-block text-sm font-medium text-brand-700">← Back to documents</Link>
      </Card>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-3">
      <Card className="flex flex-wrap items-center gap-2 px-4 py-3">
        <Link to={`/documents/${data.id}`} className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900">
          <ArrowLeft size={14} /> Back
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-gray-900">{data.name}</h1>
        <Badge>{fileTypeLabel(data)}</Badge>
        <Button
          size="sm"
          onClick={() => downloadViaBlob(data.id, data.original_name || data.name)
            .then(() => toast('success', 'Download started.'))
            .catch(() => toast('error', 'Download failed.'))}
        >
          <Download size={14} /> Download
        </Button>
      </Card>
      <Card className="overflow-hidden">
        <DocumentViewer doc={data} />
      </Card>
    </div>
  );
}

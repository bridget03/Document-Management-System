import { FileWarning, Download, ExternalLink } from 'lucide-react';
import { downloadViaBlob } from '../../services/documentApi';
import Button from '../ui/Button';

interface Props {
  docId: string;
  fileName: string;
  driveUrl?: string | null;
}

export default function UnsupportedViewer({ docId, fileName, driveUrl }: Props) {
  const isNative = !!driveUrl;

  return (
    <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
      <FileWarning size={40} className="text-amber-500" />
      <p className="font-semibold">File này chưa hỗ trợ xem trực tiếp.</p>
      <p className="text-sm text-gray-500">
        {isNative
          ? 'Đây là Google Docs/Sheets/Slides — hãy mở trực tiếp trên Google Drive.'
          : 'Bạn có thể tải file về để xem đầy đủ.'}
      </p>
      <p className="text-xs text-gray-400">{fileName}</p>
      <div className="flex gap-2">
        {driveUrl && (
          <a href={driveUrl} target="_blank" rel="noreferrer" className="border px-4 py-2 rounded text-sm flex items-center gap-1">
            <ExternalLink size={14} /> Open in Google Drive
          </a>
        )}
        <Button
          variant="primary"
          onClick={() => void downloadViaBlob(docId, fileName)}
        >
          <Download size={14} /> Download
        </Button>
      </div>
    </div>
  );
}

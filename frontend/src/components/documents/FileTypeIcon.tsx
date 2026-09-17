import {
  FileText, FileType, Table2, Table, Image, FileArchive, File as FileIcon, Presentation,
} from 'lucide-react';

const styles: Record<string, { icon: React.ReactNode; cls: string }> = {
  pdf: { icon: <FileText size={17} />, cls: 'bg-red-50 text-red-600' },
  doc: { icon: <FileType size={17} />, cls: 'bg-blue-50 text-blue-600' },
  docx: { icon: <FileType size={17} />, cls: 'bg-blue-50 text-blue-600' },
  xls: { icon: <Table2 size={17} />, cls: 'bg-green-50 text-green-700' },
  xlsx: { icon: <Table2 size={17} />, cls: 'bg-green-50 text-green-700' },
  csv: { icon: <Table size={17} />, cls: 'bg-green-50 text-green-700' },
  pptx: { icon: <Presentation size={17} />, cls: 'bg-orange-50 text-orange-600' },
  jpg: { icon: <Image size={17} />, cls: 'bg-purple-50 text-purple-600' },
  jpeg: { icon: <Image size={17} />, cls: 'bg-purple-50 text-purple-600' },
  png: { icon: <Image size={17} />, cls: 'bg-purple-50 text-purple-600' },
  webp: { icon: <Image size={17} />, cls: 'bg-purple-50 text-purple-600' },
  txt: { icon: <FileText size={17} />, cls: 'bg-gray-100 text-gray-500' },
  zip: { icon: <FileArchive size={17} />, cls: 'bg-amber-50 text-amber-600' },
};

export default function FileTypeIcon({ ext, mime }: { ext?: string; mime?: string }) {
  const key = (ext || '').toLowerCase();
  if (mime && mime.startsWith('application/vnd.google-apps.')) {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600" title="Google Drive file">
        <FileIcon size={17} />
      </span>
    );
  }
  const s = styles[key] || { icon: <FileIcon size={17} />, cls: 'bg-gray-100 text-gray-500' };
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${s.cls}`}>
      {s.icon}
    </span>
  );
}

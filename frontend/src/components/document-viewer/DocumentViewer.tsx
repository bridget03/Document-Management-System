import type { Document } from '../../types/document';
import { getPreviewType } from './preview';
import PdfViewer from './PdfViewer';
import ImageViewer from './ImageViewer';
import TextViewer from './TextViewer';
import CsvViewer from './CsvViewer';
import SpreadsheetViewer from './SpreadsheetViewer';
import DocxViewer from './DocxViewer';
import UnsupportedViewer from './UnsupportedViewer';

interface Props {
  doc: Document;
}

/** Routes a document to the right read-only viewer based on stored metadata. */
export default function DocumentViewer({ doc }: Props) {
  switch (getPreviewType(doc)) {
    case 'pdf':
      return <PdfViewer docId={doc.id} />;
    case 'image':
      return <ImageViewer docId={doc.id} fileName={doc.name} />;
    case 'text':
      return <TextViewer docId={doc.id} />;
    case 'csv':
      return <CsvViewer docId={doc.id} />;
    case 'spreadsheet':
      return <SpreadsheetViewer docId={doc.id} />;
    case 'docx':
      return <DocxViewer docId={doc.id} />;
    default:
      return <UnsupportedViewer docId={doc.id} fileName={doc.name} driveUrl={doc.google_drive_url} />;
  }
}

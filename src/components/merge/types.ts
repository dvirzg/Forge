export interface PdfFile {
  id: string;
  path: string;
  name: string;
  pageCount: number;
  pages: PdfPage[];
  metadata?: PdfMetadata;
}

export interface PdfPage {
  id: string;
  pageNumber: number;
  pdfId: string;
  thumbnailUrl?: string;
}

export interface PdfMetadata {
  pages: number;
  file_size: number;
  pdf_version?: string;
  encrypted: boolean;
  file_created?: string;
  file_modified?: string;
  all_metadata: Record<string, string>;
}

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { save } from '@tauri-apps/api/dialog';
import { readBinaryFile } from '@tauri-apps/api/fs';
import { Download, Loader } from 'lucide-react';
import { pdfjs } from 'react-pdf';
import { DraggablePdfList } from './DraggablePdfList';
import { PdfFile, PdfPage, PdfMetadata } from './types';
import { ActionButton } from '../shared/ActionButton';
import { Toast } from '../shared/Toast';
import { Header } from '../shared/Header';
import { useToast } from '../../hooks/useToast';
import { useProcessing } from '../../hooks/useProcessing';

interface MergePdfViewProps {
  initialPdfs: Array<{ path: string; name: string }>;
  onReset: () => void;
}

export function MergePdfView({ initialPdfs, onReset }: MergePdfViewProps) {
  const [pdfFiles, setPdfFiles] = useState<PdfFile[]>([]);
  const [expandedPdfs, setExpandedPdfs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const { toast, showToast } = useToast();
  const { processing, withProcessing } = useProcessing();

  useEffect(() => {
    loadPdfFiles(initialPdfs);
  }, []);

  const loadPdfFiles = async (pdfs: Array<{ path: string; name: string }>) => {
    setLoading(true);
    const loadedPdfs: PdfFile[] = [];

    for (const pdf of pdfs) {
      try {
        const metadata = await invoke<PdfMetadata>('get_pdf_metadata', {
          inputPath: pdf.path,
        });

        const pdfId = `pdf-${Date.now()}-${Math.random()}`;
        const pdfFile: PdfFile = {
          id: pdfId,
          path: pdf.path,
          name: pdf.name,
          pageCount: metadata.pages,
          pages: Array.from({ length: metadata.pages }, (_, i) => ({
            id: `page-${pdfId}-${i}`,
            pageNumber: i + 1,
            pdfId: pdfId,
          })),
          metadata,
        };

        loadedPdfs.push(pdfFile);
      } catch (error) {
        console.error(`Failed to load PDF ${pdf.name}:`, error);
        showToast(`Failed to load ${pdf.name}`);
      }
    }

    setPdfFiles(loadedPdfs);
    setLoading(false);

    // Load first page thumbnails after PDFs are in state
    loadedPdfs.forEach(pdf => {
      loadFirstPageThumbnail(pdf);
    });
  };

  const loadFirstPageThumbnail = async (pdf: PdfFile) => {
    try {
      const thumbnailUrl = await generateThumbnail(pdf.path, 1);

      setPdfFiles((prev) =>
        prev.map((p) => {
          if (p.id === pdf.id && p.pages[0]) {
            return {
              ...p,
              pages: [
                { ...p.pages[0], thumbnailUrl },
                ...p.pages.slice(1),
              ],
            };
          }
          return p;
        })
      );
    } catch (error) {
      console.error(`Failed to load thumbnail for ${pdf.name}:`, error);
    }
  };

  const loadRemainingThumbnails = async (pdf: PdfFile) => {
    // Load thumbnails for pages 2 onwards when PDF is expanded
    for (let i = 1; i < pdf.pages.length; i++) {
      try {
        const thumbnailUrl = await generateThumbnail(pdf.path, i + 1);

        setPdfFiles((prev) =>
          prev.map((p) => {
            if (p.id === pdf.id) {
              return {
                ...p,
                pages: p.pages.map((page, idx) =>
                  idx === i ? { ...page, thumbnailUrl } : page
                ),
              };
            }
            return p;
          })
        );
      } catch (error) {
        console.error(`Failed to load thumbnail for page ${i + 1}:`, error);
      }
    }
  };

  const generateThumbnail = async (pdfPath: string, pageNum: number): Promise<string> => {
    const fileData = await readBinaryFile(pdfPath);
    const blob = new Blob([fileData as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    try {
      const pdf = await pdfjs.getDocument(url).promise;
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 0.2 });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Failed to get canvas context');

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: context,
        viewport: viewport,
        canvas: canvas,
      }).promise;

      return new Promise<string>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(URL.createObjectURL(blob));
          } else {
            reject(new Error('Failed to create blob from canvas'));
          }
        }, 'image/png');
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const handlePdfReorder = (newPdfs: PdfFile[]) => {
    setPdfFiles(newPdfs);
  };

  const handlePageReorder = (pdfId: string, newPages: PdfPage[]) => {
    setPdfFiles((prev) =>
      prev.map((pdf) =>
        pdf.id === pdfId ? { ...pdf, pages: newPages } : pdf
      )
    );
  };

  const handleToggleExpand = (id: string) => {
    setExpandedPdfs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // Load remaining thumbnails when expanding
        const pdf = pdfFiles.find((p) => p.id === id);
        if (pdf && pdf.pages.length > 1 && !pdf.pages[1]?.thumbnailUrl) {
          loadRemainingThumbnails(pdf);
        }
      }
      return next;
    });
  };

  const handleMerge = async () => {
    await withProcessing(
      async () => {
        showToast('Preparing merge...');

        const pageSelections = pdfFiles.map((pdf) => ({
          pdf_path: pdf.path,
          page_numbers: pdf.pages.map((page) => page.pageNumber),
        }));

        const outputPath = await save({
          defaultPath: 'merged.pdf',
          filters: [{ name: 'PDF', extensions: ['pdf'] }],
        });

        if (!outputPath) {
          return;
        }

        const result = await invoke<string>('merge_pdfs_with_pages', {
          pageSelections,
          outputPath,
        });

        showToast(result);

        setTimeout(() => {
          onReset();
        }, 2000);
      },
      (error) => showToast(`Merge failed: ${error}`)
    );
  };

  useEffect(() => {
    return () => {
      // Cleanup blob URLs on unmount
      pdfFiles.forEach((pdf) => {
        pdf.pages.forEach((page) => {
          if (page.thumbnailUrl) {
            URL.revokeObjectURL(page.thumbnailUrl);
          }
        });
      });
    };
  }, [pdfFiles]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-white/60 mx-auto mb-2" />
          <p className="text-white/60 text-sm">Loading PDFs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <Header
        title="Merge PDFs"
        fileName={`${pdfFiles.length} PDFs`}
        onBack={onReset}
        rightContent={
          <ActionButton
            onClick={handleMerge}
            disabled={processing || pdfFiles.length < 2}
            variant="primary"
            className="flex items-center gap-2 px-4 py-2"
          >
            <Download className="w-4 h-4" />
            Merge All
          </ActionButton>
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <p className="text-white/60 text-sm mb-4">
          Drag to reorder PDFs and pages
        </p>

        <DraggablePdfList
          pdfs={pdfFiles}
          onReorder={handlePdfReorder}
          expandedPdfs={expandedPdfs}
          onToggleExpand={handleToggleExpand}
          onPageReorder={handlePageReorder}
        />
      </div>

      {toast && <Toast message={toast.message} id={toast.id} />}
    </div>
  );
}

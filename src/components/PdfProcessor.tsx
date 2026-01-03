import { useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { save, open } from '@tauri-apps/api/dialog';
import { RotateCw, FileText, Download, ArrowLeft, Plus } from 'lucide-react';

interface PdfProcessorProps {
  file: {
    path: string;
    name: string;
  };
  onReset: () => void;
}

function PdfProcessor({ file, onReset }: PdfProcessorProps) {
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [extractedText, setExtractedText] = useState<string>('');
  const [additionalPdfs, setAdditionalPdfs] = useState<string[]>([]);

  const handleRotate = async (degrees: number) => {
    try {
      setProcessing(true);
      setStatus(`Rotating PDF ${degrees}°...`);

      const outputPath = await save({
        defaultPath: file.name.replace('.pdf', `_rotated${degrees}.pdf`),
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });

      if (!outputPath) {
        setStatus('Operation cancelled');
        return;
      }

      const result = await invoke<string>('rotate_pdf', {
        inputPath: file.path,
        outputPath,
        degrees,
        pageNumbers: null,
      });

      setStatus(result);
    } catch (error) {
      setStatus(`Error: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleExtractText = async () => {
    try {
      setProcessing(true);
      setStatus('Extracting text...');

      const text = await invoke<string>('extract_text', {
        inputPath: file.path,
      });

      setExtractedText(text);
      setStatus('Text extracted successfully');
    } catch (error) {
      setStatus(`Error: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleExtractImages = async () => {
    try {
      setProcessing(true);
      setStatus('Extracting images...');

      const outputDir = await open({
        directory: true,
        title: 'Select folder to save images',
      });

      if (!outputDir || Array.isArray(outputDir)) {
        setStatus('Operation cancelled');
        return;
      }

      const imagePaths = await invoke<string[]>('extract_images', {
        inputPath: file.path,
        outputDir,
      });

      setStatus(`Extracted ${imagePaths.length} images`);
    } catch (error) {
      setStatus(`Error: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleAddPdf = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });

      if (selected && !Array.isArray(selected)) {
        setAdditionalPdfs([...additionalPdfs, selected]);
      } else if (Array.isArray(selected)) {
        setAdditionalPdfs([...additionalPdfs, ...selected]);
      }
    } catch (error) {
      setStatus(`Error: ${error}`);
    }
  };

  const handleMergePdfs = async () => {
    try {
      setProcessing(true);
      setStatus('Merging PDFs...');

      const outputPath = await save({
        defaultPath: 'merged.pdf',
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });

      if (!outputPath) {
        setStatus('Operation cancelled');
        return;
      }

      const allPdfs = [file.path, ...additionalPdfs];

      const result = await invoke<string>('merge_pdfs', {
        inputPaths: allPdfs,
        outputPath,
      });

      setStatus(result);
      setAdditionalPdfs([]);
    } catch (error) {
      setStatus(`Error: ${error}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onReset}
          className="glass-card p-3 rounded-2xl transition-all duration-300 hover:scale-105"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-white">PDF Processing</h2>
          <p className="text-sm text-white/60">{file.name}</p>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-6 overflow-hidden">
        {/* Left column - Controls */}
        <div className="flex flex-col gap-4 overflow-y-auto">
          {/* Rotation */}
          <div className="glass-card rounded-3xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <RotateCw className="w-4 h-4" />
              Rotate Pages
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleRotate(90)}
                disabled={processing}
                className="glass-card px-4 py-3 rounded-2xl text-white text-sm transition-all duration-300 hover:scale-105 disabled:opacity-50"
              >
                90°
              </button>
              <button
                onClick={() => handleRotate(180)}
                disabled={processing}
                className="glass-card px-4 py-3 rounded-2xl text-white text-sm transition-all duration-300 hover:scale-105 disabled:opacity-50"
              >
                180°
              </button>
              <button
                onClick={() => handleRotate(270)}
                disabled={processing}
                className="glass-card px-4 py-3 rounded-2xl text-white text-sm transition-all duration-300 hover:scale-105 disabled:opacity-50"
              >
                270°
              </button>
            </div>
          </div>

          {/* Extract */}
          <div className="glass-card rounded-3xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Extract
            </h3>
            <div className="space-y-2">
              <button
                onClick={handleExtractText}
                disabled={processing}
                className="w-full glass-card px-4 py-3 rounded-2xl text-white text-sm transition-all duration-300 hover:scale-105 disabled:opacity-50"
              >
                Extract Text
              </button>
              <button
                onClick={handleExtractImages}
                disabled={processing}
                className="w-full glass-card px-4 py-3 rounded-2xl text-white text-sm transition-all duration-300 hover:scale-105 disabled:opacity-50"
              >
                Extract Images
              </button>
            </div>
          </div>

          {/* Merge */}
          <div className="glass-card rounded-3xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Download className="w-4 h-4" />
              Merge PDFs
            </h3>
            <div className="space-y-2 mb-3">
              <div className="text-sm text-white/60">
                Selected: {additionalPdfs.length + 1} PDF(s)
              </div>
              {additionalPdfs.map((pdf, idx) => (
                <div key={idx} className="text-xs text-white/80 truncate">
                  {pdf.split('/').pop()}
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <button
                onClick={handleAddPdf}
                disabled={processing}
                className="w-full glass-card px-4 py-3 rounded-2xl text-white text-sm transition-all duration-300 hover:scale-105 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add More PDFs
              </button>
              {additionalPdfs.length > 0 && (
                <button
                  onClick={handleMergePdfs}
                  disabled={processing}
                  className="w-full glass-card px-4 py-3 rounded-2xl text-white text-sm transition-all duration-300 hover:scale-105 disabled:opacity-50 bg-blue-500/20"
                >
                  Merge All
                </button>
              )}
            </div>
          </div>

          {/* Status */}
          {status && (
            <div className="glass-card rounded-3xl p-4">
              <p className="text-white/80 text-sm">{status}</p>
            </div>
          )}
        </div>

        {/* Right column - Preview/Output */}
        <div className="glass-card rounded-3xl p-6 overflow-hidden">
          {extractedText ? (
            <div className="h-full flex flex-col">
              <h3 className="text-white font-semibold mb-4">Extracted Text</h3>
              <div className="flex-1 overflow-y-auto">
                <pre className="text-white/80 text-sm whitespace-pre-wrap">
                  {extractedText}
                </pre>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <FileText className="w-16 h-16 text-white/20 mx-auto mb-4" />
                <p className="text-white/60">
                  PDF operations will appear here
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PdfProcessor;

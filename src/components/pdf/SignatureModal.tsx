import { useState, useRef } from 'react';
import { Check, X } from 'lucide-react';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedSignatures: string[];
  onSelectSignature: (signature: string) => void;
  onSaveSignature: (signature: string) => void;
  showToast: (message: string) => void;
}

export function SignatureModal({
  isOpen,
  onClose,
  savedSignatures,
  onSelectSignature,
  onSaveSignature,
  showToast,
}: SignatureModalProps) {
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawingSignature, setIsDrawingSignature] = useState(false);
  const [signatureColor, setSignatureColor] = useState('#000000');

  if (!isOpen) return null;

  const startDrawingSignature = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    setIsDrawingSignature(true);
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = signatureColor;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const drawSignature = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingSignature) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const stopDrawingSignature = () => {
    setIsDrawingSignature(false);
  };

  const clearSignatureCanvas = () => {
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const saveSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      onSaveSignature(dataUrl);
      clearSignatureCanvas();
      showToast('Signature saved!');
    }
  };

  const createSymbol = (symbol: 'check' | 'x') => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    clearSignatureCanvas();
    ctx.strokeStyle = signatureColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    if (symbol === 'check') {
      ctx.beginPath();
      ctx.moveTo(50, 100);
      ctx.lineTo(100, 150);
      ctx.lineTo(250, 50);
      ctx.stroke();
    } else if (symbol === 'x') {
      ctx.beginPath();
      ctx.moveTo(50, 50);
      ctx.lineTo(250, 150);
      ctx.moveTo(250, 50);
      ctx.lineTo(50, 150);
      ctx.stroke();
    }

    const dataUrl = canvas.toDataURL('image/png');
    onSaveSignature(dataUrl);
    clearSignatureCanvas();
    showToast(`${symbol === 'check' ? 'Checkmark' : 'X'} symbol saved!`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="glass-card rounded-2xl p-6 w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white text-lg font-semibold">Signature & Symbols</h3>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawing Canvas */}
        <div className="mb-4">
          <div className="bg-white rounded-lg overflow-hidden border-2 border-white/20">
            <canvas
              ref={signatureCanvasRef}
              width={600}
              height={200}
              onMouseDown={startDrawingSignature}
              onMouseMove={drawSignature}
              onMouseUp={stopDrawingSignature}
              onMouseLeave={stopDrawingSignature}
              className="w-full cursor-crosshair"
              style={{ touchAction: 'none' }}
            />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={clearSignatureCanvas}
              className="glass-card px-3 py-1.5 rounded-lg text-white text-sm hover:bg-white/10 transition-colors"
            >
              Clear
            </button>
            <button
              onClick={saveSignature}
              className="glass-card px-3 py-1.5 rounded-lg text-white text-sm bg-green-500/30 hover:bg-green-500/50 transition-colors"
            >
              Save Signature
            </button>
            <input
              type="color"
              value={signatureColor}
              onChange={(e) => setSignatureColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border-2 border-white/20"
              title="Choose signature color"
            />
          </div>
        </div>

        {/* Quick Symbols */}
        <div className="mb-4">
          <h4 className="text-white text-sm font-semibold mb-2">Quick Symbols</h4>
          <div className="flex gap-2">
            <button
              onClick={() => createSymbol('check')}
              className="glass-card px-4 py-2 rounded-lg text-white hover:bg-green-500/30 transition-colors flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Checkmark
            </button>
            <button
              onClick={() => createSymbol('x')}
              className="glass-card px-4 py-2 rounded-lg text-white hover:bg-red-500/30 transition-colors flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              X Mark
            </button>
          </div>
        </div>

        {/* Saved Signatures */}
        {savedSignatures.length > 0 && (
          <div>
            <h4 className="text-white text-sm font-semibold mb-2">Saved Signatures</h4>
            <div className="grid grid-cols-3 gap-2">
              {savedSignatures.map((sig, idx) => (
                <div
                  key={idx}
                  className="glass-card rounded-lg p-2 cursor-pointer hover:bg-white/10 transition-colors"
                  onClick={() => {
                    onSelectSignature(sig);
                    onClose();
                    showToast('Click on the PDF to place the signature. After placing, you can click and drag to reposition it.');
                  }}
                >
                  <img
                    src={sig}
                    alt={`Signature ${idx + 1}`}
                    className="w-full h-16 object-contain bg-white rounded"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

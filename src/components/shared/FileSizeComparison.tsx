import { ArrowRight } from 'lucide-react';
import { formatFileSize } from '../../utils/fileUtils';

interface FileSizeComparisonProps {
  originalSize: number;
  estimatedSize: number | null;
  isEstimating: boolean;
}

function calculateReduction(original: number, compressed: number): number {
  if (original === 0) return 0;
  return Math.round(((original - compressed) / original) * 100);
}

export function FileSizeComparison({
  originalSize,
  estimatedSize,
  isEstimating,
}: FileSizeComparisonProps) {
  const reduction = estimatedSize
    ? calculateReduction(originalSize, estimatedSize)
    : 0;

  return (
    <div className="glass-card p-4 rounded-2xl space-y-2">
      <div className="text-xs text-white/50 uppercase tracking-wide">
        File Size Comparison
      </div>

      {isEstimating ? (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      ) : estimatedSize !== null ? (
        <>
          <div className="flex items-center justify-between gap-3 text-sm">
            <div className="flex flex-col">
              <span className="text-white/50 text-xs">Original</span>
              <span className="text-white font-medium">
                {formatFileSize(originalSize)}
              </span>
            </div>

            <ArrowRight className="text-white/30" size={20} />

            <div className="flex flex-col">
              <span className="text-white/50 text-xs">Compressed</span>
              <span className="text-white font-medium">
                ~{formatFileSize(estimatedSize)}
              </span>
            </div>
          </div>

          {reduction > 0 ? (
            <div className="flex items-center justify-center pt-2">
              <div className="bg-green-500/20 text-green-400 px-3 py-1.5 rounded-xl text-xs font-medium">
                {reduction}% smaller
              </div>
            </div>
          ) : reduction < 0 ? (
            <div className="flex items-center justify-center pt-2">
              <div className="bg-amber-500/20 text-amber-400 px-3 py-1.5 rounded-xl text-xs font-medium">
                {Math.abs(reduction)}% larger
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center pt-2">
              <div className="bg-blue-500/20 text-blue-400 px-3 py-1.5 rounded-xl text-xs font-medium">
                Similar size
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center text-white/40 text-sm py-4">
          Adjust quality to see estimation
        </div>
      )}
    </div>
  );
}

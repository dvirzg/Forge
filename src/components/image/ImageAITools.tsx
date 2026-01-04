import { Sparkles } from 'lucide-react';
import { CollapsibleSection } from '../shared/CollapsibleSection';
import { ActionButton } from '../shared/ActionButton';

interface ImageAIToolsProps {
  expandedCard: string | null;
  onToggleCard: (cardId: string) => void;
  modelAvailable: boolean | null;
  downloadingModel: boolean;
  processing: boolean;
  onDownloadModel: () => void;
  onRemoveBackground: () => void;
}

export function ImageAITools({
  expandedCard,
  onToggleCard,
  modelAvailable,
  downloadingModel,
  processing,
  onDownloadModel,
  onRemoveBackground,
}: ImageAIToolsProps) {
  return (
    <CollapsibleSection
      id="ai-tools"
      title="AI Tools"
      icon={Sparkles}
      isExpanded={expandedCard === 'ai-tools'}
      onToggle={onToggleCard}
    >
      <div>
        {modelAvailable === false && (
          <div className="mb-3 p-3 bg-yellow-500/20 rounded-xl border border-yellow-500/30">
            <p className="text-yellow-200 text-xs mb-2">AI model not installed</p>
            <ActionButton
              onClick={onDownloadModel}
              disabled={downloadingModel}
              className="w-full px-4 py-2 rounded-xl text-xs bg-blue-500/30"
            >
              {downloadingModel ? 'Downloading...' : 'Download AI Model'}
            </ActionButton>
          </div>
        )}
        <ActionButton
          onClick={onRemoveBackground}
          disabled={processing || modelAvailable === false || downloadingModel}
          className="w-full"
        >
          Remove Background
        </ActionButton>
      </div>
    </CollapsibleSection>
  );
}

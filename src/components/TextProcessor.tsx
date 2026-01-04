import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { Type, Search, ExternalLink } from 'lucide-react';
import { Header } from './shared/Header';
import { CollapsibleSection } from './shared/CollapsibleSection';
import { ActionButton } from './shared/ActionButton';
import { MetadataDetailModal } from './shared/MetadataDetailModal';
import { Toast } from './shared/Toast';
import { useToast } from '../hooks/useToast';
import { useProcessing } from '../hooks/useProcessing';
import { loadTextFile } from '../utils/fileLoaders';
import { formatFileSize } from '../utils/fileUtils';

interface TextProcessorProps {
  file: {
    path: string;
    name: string;
  };
  onReset: () => void;
}

interface TextMetadata {
  file_size: number;
  line_count: number;
  character_count: number;
  word_count: number;
  encoding?: string;
  line_endings?: string;
  file_created?: string;
  file_modified?: string;
}

function TextProcessor({ file, onReset }: TextProcessorProps) {
  const [text, setText] = useState('');
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [metadata, setMetadata] = useState<TextMetadata | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [showMetadataDetail, setShowMetadataDetail] = useState(false);
  const { toast, showToast } = useToast();
  const { processing, withProcessing } = useProcessing();

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const meta = await invoke<TextMetadata>('get_text_metadata', {
          inputPath: file.path,
        });
        setMetadata(meta);
      } catch (error) {
        console.error('Failed to fetch metadata:', error);
      }
    };
    fetchMetadata();
  }, [file.path]);

  useEffect(() => {
    loadFile();
  }, [file.path]);

  const loadFile = async () => {
    try {
      const content = await loadTextFile(file.path);
      setText(content);
      showToast('File loaded successfully');
    } catch (error) {
      showToast(`Error loading file: ${error}`);
    }
  };

  const handleConvertCase = async (caseType: string) => {
    await withProcessing(
      async () => {
        const result = await invoke<string>('convert_case', {
          text,
          caseType,
        });
        setText(result);
        showToast(`Converted to ${caseType}`);
      },
      (error) => showToast(`Error: ${error}`)
    );
  };

  const handleReplaceAll = async () => {
    if (!findText) {
      showToast('Please enter text to find');
      return;
    }

    await withProcessing(
      async () => {
        const result = await invoke<string>('replace_all_text', {
          text,
          find: findText,
          replace: replaceText,
        });
        setText(result);
        showToast('Replace completed');
      },
      (error) => showToast(`Error: ${error}`)
    );
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  const toggleCard = (cardId: string) => {
    setExpandedCard(expandedCard === cardId ? null : cardId);
  };

  const getBasicMetadataEntries = (): Array<{ key: string; value: string }> => {
    if (!metadata) return [];
    
    const entries: Array<{ key: string; value: string }> = [];
    entries.push({ key: 'File Size', value: formatFileSize(metadata.file_size) });
    entries.push({ key: 'Lines', value: metadata.line_count.toString() });
    entries.push({ key: 'Characters', value: metadata.character_count.toString() });
    entries.push({ key: 'Words', value: metadata.word_count.toString() });
    if (metadata.encoding) entries.push({ key: 'Encoding', value: metadata.encoding });
    if (metadata.line_endings) entries.push({ key: 'Line Endings', value: metadata.line_endings });
    if (metadata.file_created) entries.push({ key: 'File Created', value: metadata.file_created });
    if (metadata.file_modified) entries.push({ key: 'File Modified', value: metadata.file_modified });
    
    return entries;
  };

  const getAllMetadataEntries = (): Array<{ key: string; value: string }> => {
    return getBasicMetadataEntries();
  };

  return (
    <div className="h-full flex flex-col">
      <Header
        title="Text Processing"
        fileName={file.name}
        onBack={onReset}
      />

      <div className="flex-1 grid grid-cols-3 gap-6 overflow-hidden">
        {/* Left column - Text Editor */}
        <div className="col-span-2 glass-card rounded-3xl p-6 flex flex-col">
          <h3 className="text-white font-semibold mb-4">Editor</h3>
          <textarea
            value={text}
            onChange={handleTextChange}
            className="flex-1 w-full glass-card px-4 py-3 rounded-2xl text-white bg-white/5 border border-white/10 focus:outline-none focus:border-blue-400/50 resize-none font-mono text-sm"
            placeholder="Your text will appear here..."
          />
          <div className="mt-3 text-white/60 text-xs">
            {text.length} characters | {text.split(/\s+/).filter(w => w).length} words
          </div>
        </div>

        {/* Right column - Controls */}
        <div className="flex flex-col gap-4 overflow-y-auto">
          {/* Case Conversion */}
          <CollapsibleSection
            id="case-conversion"
            title="Case Conversion"
            icon={Type}
            isExpanded={expandedCard === 'case-conversion'}
            onToggle={toggleCard}
          >
            <div className="grid grid-cols-2 gap-2">
              <ActionButton onClick={() => handleConvertCase('upper')} disabled={processing} className="px-3 py-2 rounded-xl text-xs">
                UPPER
              </ActionButton>
              <ActionButton onClick={() => handleConvertCase('lower')} disabled={processing} className="px-3 py-2 rounded-xl text-xs">
                lower
              </ActionButton>
              <ActionButton onClick={() => handleConvertCase('title')} disabled={processing} className="px-3 py-2 rounded-xl text-xs">
                Title Case
              </ActionButton>
              <ActionButton onClick={() => handleConvertCase('camel')} disabled={processing} className="px-3 py-2 rounded-xl text-xs">
                camelCase
              </ActionButton>
              <ActionButton onClick={() => handleConvertCase('pascal')} disabled={processing} className="px-3 py-2 rounded-xl text-xs">
                PascalCase
              </ActionButton>
              <ActionButton onClick={() => handleConvertCase('snake')} disabled={processing} className="px-3 py-2 rounded-xl text-xs">
                snake_case
              </ActionButton>
              <ActionButton onClick={() => handleConvertCase('kebab')} disabled={processing} className="px-3 py-2 rounded-xl text-xs">
                kebab-case
              </ActionButton>
              <ActionButton onClick={() => handleConvertCase('screaming_snake')} disabled={processing} className="px-3 py-2 rounded-xl text-xs">
                SCREAMING
              </ActionButton>
            </div>
          </CollapsibleSection>

          {/* Find & Replace */}
          <CollapsibleSection
            id="find-replace"
            title="Find & Replace"
            icon={Search}
            isExpanded={expandedCard === 'find-replace'}
            onToggle={toggleCard}
          >
            <div className="space-y-3">
              <div>
                <label className="text-white/60 text-sm mb-1 block">Find</label>
                <input
                  type="text"
                  value={findText}
                  onChange={(e) => setFindText(e.target.value)}
                  className="w-full glass-card px-4 py-2 rounded-xl text-white bg-white/5 border border-white/10 focus:outline-none focus:border-blue-400/50"
                  placeholder="Text to find..."
                />
              </div>
              <div>
                <label className="text-white/60 text-sm mb-1 block">Replace</label>
                <input
                  type="text"
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  className="w-full glass-card px-4 py-2 rounded-xl text-white bg-white/5 border border-white/10 focus:outline-none focus:border-blue-400/50"
                  placeholder="Replace with..."
                />
              </div>
              <ActionButton onClick={handleReplaceAll} disabled={processing} className="w-full">
                Replace All
              </ActionButton>
            </div>
          </CollapsibleSection>

          {/* Quick Actions */}
          <CollapsibleSection
            id="quick-actions"
            title="Quick Actions"
            icon={Type}
            isExpanded={expandedCard === 'quick-actions'}
            onToggle={toggleCard}
          >
            <div className="space-y-2">
              <ActionButton onClick={() => setText(text.trim())} className="w-full px-4 py-2 rounded-xl text-sm">
                Trim Whitespace
              </ActionButton>
              <ActionButton onClick={() => setText(text.split('\n').filter(line => line.trim()).join('\n'))} className="w-full px-4 py-2 rounded-xl text-sm">
                Remove Empty Lines
              </ActionButton>
              <ActionButton onClick={() => setText([...new Set(text.split('\n'))].join('\n'))} className="w-full px-4 py-2 rounded-xl text-sm">
                Remove Duplicates
              </ActionButton>
              <ActionButton onClick={() => setText(text.split('\n').sort().join('\n'))} className="w-full px-4 py-2 rounded-xl text-sm">
                Sort Lines
              </ActionButton>
            </div>
          </CollapsibleSection>

          {/* Metadata */}
          <CollapsibleSection
            id="metadata"
            title="Metadata"
            icon={Type}
            isExpanded={expandedCard === 'metadata'}
            onToggle={toggleCard}
          >
            <div className="space-y-3">
              {metadata && (
                <>
                  <div className="space-y-1 text-xs">
                    {getBasicMetadataEntries().map((entry, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span className="text-white/60">{entry.key}:</span>
                        <span className="text-white text-right max-w-[60%] truncate" title={entry.value}>
                          {entry.value}
                        </span>
                      </div>
                    ))}
                  </div>
                  {getAllMetadataEntries().length > 6 && (
                    <ActionButton
                      onClick={() => setShowMetadataDetail(true)}
                      className="w-full px-3 py-2 rounded-xl text-xs flex items-center justify-center gap-2 text-white/80 hover:text-white"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View All {getAllMetadataEntries().length} Properties
                    </ActionButton>
                  )}
                </>
              )}
            </div>
          </CollapsibleSection>
        </div>
      </div>

      {/* Metadata Detail Modal */}
      <MetadataDetailModal
        isOpen={showMetadataDetail}
        onClose={() => setShowMetadataDetail(false)}
        entries={getAllMetadataEntries()}
        title={`Metadata - ${file.name}`}
      />

      {/* Toast Notification */}
      {toast && <Toast message={toast.message} id={toast.id} />}
    </div>
  );
}

export default TextProcessor;

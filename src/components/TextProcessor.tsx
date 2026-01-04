import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { Header } from './shared/Header';
import { MetadataDetailModal } from './shared/MetadataDetailModal';
import { Toast } from './shared/Toast';
import { ProcessorLayout } from './shared/ProcessorLayout';
import { TextTools } from './text/TextTools';
import { useToast } from '../hooks/useToast';
import { useProcessing } from '../hooks/useProcessing';
import { useMetadata } from '../hooks/useMetadata';
import { loadTextFile } from '../utils/fileLoaders';
import { formatFileSize } from '../utils/fileUtils';
import { BaseProcessorProps } from '../types/processor';

interface TextProcessorProps extends BaseProcessorProps {}

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

  const { getBasicMetadataEntries, getAllMetadataEntries, hasExtendedMetadata } = useMetadata({
    metadata,
    getBasicEntries: (meta) => {
      const entries = [];
      entries.push({ key: 'File Size', value: formatFileSize(meta.file_size) });
      entries.push({ key: 'Lines', value: meta.line_count.toString() });
      entries.push({ key: 'Characters', value: meta.character_count.toString() });
      entries.push({ key: 'Words', value: meta.word_count.toString() });
      if (meta.encoding) entries.push({ key: 'Encoding', value: meta.encoding });
      if (meta.line_endings) entries.push({ key: 'Line Endings', value: meta.line_endings });
      if (meta.file_created) entries.push({ key: 'File Created', value: meta.file_created });
      if (meta.file_modified) entries.push({ key: 'File Modified', value: meta.file_modified });
      return entries;
    },
  });

  return (
    <div className="h-full flex flex-col">
      <Header
        title="Text Processing"
        fileName={file.name}
        onBack={onReset}
      />

      <ProcessorLayout
        layout="grid-3"
        preview={
          <div className="glass-card rounded-3xl p-6 flex flex-col">
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
        }
        sidebar={
          <TextTools
            expandedCard={expandedCard}
            onToggleCard={toggleCard}
            processing={processing}
            findText={findText}
            replaceText={replaceText}
            text={text}
            onFindTextChange={setFindText}
            onReplaceTextChange={setReplaceText}
            onConvertCase={handleConvertCase}
            onReplaceAll={handleReplaceAll}
            onTrimWhitespace={() => setText(text.trim())}
            onRemoveEmptyLines={() => setText(text.split('\n').filter(line => line.trim()).join('\n'))}
            onRemoveDuplicates={() => setText([...new Set(text.split('\n'))].join('\n'))}
            onSortLines={() => setText(text.split('\n').sort().join('\n'))}
            metadata={metadata}
            fileName={file.name}
            getBasicMetadataEntries={getBasicMetadataEntries}
            getAllMetadataEntries={getAllMetadataEntries}
            hasExtendedMetadata={hasExtendedMetadata}
          />
        }
      />

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

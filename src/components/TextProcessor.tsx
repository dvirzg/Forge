import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { readTextFile } from '@tauri-apps/api/fs';
import { Type, Search, ArrowLeft, Trash2, ChevronDown, ExternalLink, X } from 'lucide-react';

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
  const [status, setStatus] = useState('');
  const [metadata, setMetadata] = useState<TextMetadata | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [showMetadataDetail, setShowMetadataDetail] = useState(false);

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
      const content = await readTextFile(file.path);
      setText(content);
      setStatus('File loaded successfully');
    } catch (error) {
      setStatus(`Error loading file: ${error}`);
    }
  };

  const handleConvertCase = async (caseType: string) => {
    try {
      const result = await invoke<string>('convert_case', {
        text,
        caseType,
      });
      setText(result);
      setStatus(`Converted to ${caseType}`);
    } catch (error) {
      setStatus(`Error: ${error}`);
    }
  };

  const handleReplaceAll = async () => {
    try {
      if (!findText) {
        setStatus('Please enter text to find');
        return;
      }

      const result = await invoke<string>('replace_all_text', {
        text,
        find: findText,
        replace: replaceText,
      });
      setText(result);
      setStatus('Replace completed');
    } catch (error) {
      setStatus(`Error: ${error}`);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  const toggleCard = (cardId: string) => {
    setExpandedCard(expandedCard === cardId ? null : cardId);
  };

  const getMetadataEntries = (): Array<{ key: string; value: string }> => {
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


  const handleOpenMetadataDetail = () => {
    const entries = getMetadataEntries();
    if (entries.length <= 6) return;
    setShowMetadataDetail(true);
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
          <h2 className="text-2xl font-bold text-white">Text Processing</h2>
          <p className="text-sm text-white/60">{file.name}</p>
        </div>
      </div>

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
          <div className="glass-card rounded-3xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Type className="w-4 h-4" />
              Case Conversion
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleConvertCase('upper')}
                className="glass-card px-3 py-2 rounded-xl text-white text-xs transition-all duration-300 hover:scale-105"
              >
                UPPER
              </button>
              <button
                onClick={() => handleConvertCase('lower')}
                className="glass-card px-3 py-2 rounded-xl text-white text-xs transition-all duration-300 hover:scale-105"
              >
                lower
              </button>
              <button
                onClick={() => handleConvertCase('title')}
                className="glass-card px-3 py-2 rounded-xl text-white text-xs transition-all duration-300 hover:scale-105"
              >
                Title Case
              </button>
              <button
                onClick={() => handleConvertCase('camel')}
                className="glass-card px-3 py-2 rounded-xl text-white text-xs transition-all duration-300 hover:scale-105"
              >
                camelCase
              </button>
              <button
                onClick={() => handleConvertCase('pascal')}
                className="glass-card px-3 py-2 rounded-xl text-white text-xs transition-all duration-300 hover:scale-105"
              >
                PascalCase
              </button>
              <button
                onClick={() => handleConvertCase('snake')}
                className="glass-card px-3 py-2 rounded-xl text-white text-xs transition-all duration-300 hover:scale-105"
              >
                snake_case
              </button>
              <button
                onClick={() => handleConvertCase('kebab')}
                className="glass-card px-3 py-2 rounded-xl text-white text-xs transition-all duration-300 hover:scale-105"
              >
                kebab-case
              </button>
              <button
                onClick={() => handleConvertCase('screaming_snake')}
                className="glass-card px-3 py-2 rounded-xl text-white text-xs transition-all duration-300 hover:scale-105"
              >
                SCREAMING
              </button>
            </div>
          </div>

          {/* Find & Replace */}
          <div className="glass-card rounded-3xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Search className="w-4 h-4" />
              Find & Replace
            </h3>
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
              <button
                onClick={handleReplaceAll}
                className="w-full glass-card px-4 py-3 rounded-2xl text-white text-sm transition-all duration-300 hover:scale-105"
              >
                Replace All
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="glass-card rounded-3xl p-6">
            <h3 className="text-white font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button
                onClick={() => setText(text.trim())}
                className="w-full glass-card px-4 py-2 rounded-xl text-white text-sm transition-all duration-300 hover:scale-105"
              >
                Trim Whitespace
              </button>
              <button
                onClick={() => setText(text.split('\n').filter(line => line.trim()).join('\n'))}
                className="w-full glass-card px-4 py-2 rounded-xl text-white text-sm transition-all duration-300 hover:scale-105"
              >
                Remove Empty Lines
              </button>
              <button
                onClick={() => setText([...new Set(text.split('\n'))].join('\n'))}
                className="w-full glass-card px-4 py-2 rounded-xl text-white text-sm transition-all duration-300 hover:scale-105"
              >
                Remove Duplicates
              </button>
              <button
                onClick={() => setText(text.split('\n').sort().join('\n'))}
                className="w-full glass-card px-4 py-2 rounded-xl text-white text-sm transition-all duration-300 hover:scale-105"
              >
                Sort Lines
              </button>
            </div>
          </div>

          {/* Metadata */}
          <div className="glass-card rounded-3xl p-6">
            <button
              onClick={() => toggleCard('metadata')}
              className="w-full text-left text-white font-semibold flex items-center justify-between gap-2 py-2 hover:text-white/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                Metadata
              </div>
              <ChevronDown
                className={`w-4 h-4 text-white/60 transition-transform duration-200 ${
                  expandedCard === 'metadata' ? 'rotate-180' : ''
                }`}
              />
            </button>

            {expandedCard === 'metadata' && (
              <div className="mt-4 space-y-4">
                {metadata && (() => {
                  const entries = getMetadataEntries();
                  const displayEntries = entries.slice(0, 6);
                  const hasMore = entries.length > 6;
                  
                  return (
                    <div className="space-y-2 text-sm">
                      {displayEntries.map((entry, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span className="text-white/60">{entry.key}:</span>
                          <span className="text-white text-right max-w-[60%] truncate" title={entry.value}>
                            {entry.value}
                          </span>
                        </div>
                      ))}
                      {hasMore && (
                        <div className="pt-2 border-t border-white/10">
                          <button
                            onClick={handleOpenMetadataDetail}
                            className="w-full glass-card px-3 py-2 rounded-xl text-white/80 text-xs transition-all duration-300 hover:text-white hover:scale-105 flex items-center justify-center gap-2"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View All {entries.length} Properties
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Status */}
          {status && (
            <div className="glass-card rounded-3xl p-4">
              <p className="text-white/80 text-xs">{status}</p>
            </div>
          )}
        </div>
      </div>

      {/* Metadata Detail Modal */}
      {showMetadataDetail && metadata && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowMetadataDetail(false)}
        >
          <div 
            className="glass-card rounded-3xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Metadata Details</h3>
              <button
                onClick={() => setShowMetadataDetail(false)}
                className="glass-card p-2 rounded-xl text-white hover:scale-105 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {getMetadataEntries().map((entry, idx) => (
                <div key={idx} className="flex justify-between items-start py-2 border-b border-white/10 text-sm">
                  <span className="text-white/60 font-medium min-w-[40%]">{entry.key}:</span>
                  <span className="text-white text-right flex-1 break-words">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TextProcessor;

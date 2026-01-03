import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { readTextFile } from '@tauri-apps/api/fs';
import { Type, Search, ArrowLeft } from 'lucide-react';

interface TextProcessorProps {
  file: {
    path: string;
    name: string;
  };
  onReset: () => void;
}

function TextProcessor({ file, onReset }: TextProcessorProps) {
  const [text, setText] = useState('');
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [status, setStatus] = useState('');

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

          {/* Status */}
          {status && (
            <div className="glass-card rounded-3xl p-4">
              <p className="text-white/80 text-xs">{status}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TextProcessor;

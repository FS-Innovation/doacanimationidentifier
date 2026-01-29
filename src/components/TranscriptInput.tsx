'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { AnalysisMode } from '@/types';

interface TranscriptInputProps {
  onAnalyze: (transcript: string, mode: AnalysisMode, customFocus?: string) => void;
  isLoading: boolean;
  hasSession: boolean;
  transcript?: string;
  onTranscriptChange?: (transcript: string) => void;
  highlightLines?: { start: number; end: number } | null;
}

// Token estimation (~4 chars per token)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function estimateCost(tokens: number): string {
  // grok-4-1-fast-reasoning: $0.20/1M input, assume ~8000 output tokens at $0.50/1M
  const inputCost = (tokens / 1_000_000) * 0.20;
  const outputCost = (8000 / 1_000_000) * 0.50;
  const total = inputCost + outputCost;
  if (total < 0.01) return '<$0.01';
  return `~$${total.toFixed(2)}`;
}

export function TranscriptInput({
  onAnalyze,
  isLoading,
  hasSession,
  transcript: externalTranscript,
  onTranscriptChange,
  highlightLines,
}: TranscriptInputProps) {
  const [internalTranscript, setInternalTranscript] = useState('');
  const [mode, setMode] = useState<AnalysisMode>('mixed');
  const [customFocus, setCustomFocus] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  const transcript = externalTranscript ?? internalTranscript;
  const setTranscript = onTranscriptChange ?? setInternalTranscript;

  const lines = transcript.split('\n');
  const lineCount = lines.length;
  const tokens = estimateTokens(transcript);
  const cost = estimateCost(tokens);

  // Sync scroll between textarea and line numbers
  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  // Scroll to highlighted lines when they change
  useEffect(() => {
    if (highlightLines && textareaRef.current) {
      const lineHeight = 20; // approximate line height in pixels
      const scrollPosition = (highlightLines.start - 1) * lineHeight - 40;
      textareaRef.current.scrollTop = Math.max(0, scrollPosition);
      if (lineNumbersRef.current) {
        lineNumbersRef.current.scrollTop = Math.max(0, scrollPosition);
      }
    }
  }, [highlightLines]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setTranscript(text);
      };
      reader.readAsText(file);
    }
  };

  const handleSubmit = () => {
    if (transcript.trim() && !isLoading) {
      onAnalyze(transcript.trim(), mode, customFocus || undefined);
    }
  };

  const modeLabels: Record<AnalysisMode, { label: string; description: string }> = {
    mixed: { label: 'Balanced', description: 'Equal weight to trends, story, and education' },
    trend: { label: 'Trend-Heavy', description: 'Prioritize viral and trending moments' },
    story: { label: 'Story-Heavy', description: 'Focus on emotional arcs and narrative' },
    edu: { label: 'Edu-Heavy', description: 'Highlight teachable moments' },
  };

  if (hasSession) {
    return null; // Don't show input when session exists
  }

  return (
    <div className="p-4 border-b border-gray-200 space-y-4">
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Transcript
          </label>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Upload file
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.srt,.vtt"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {/* Textarea with line numbers */}
        <div className="relative flex border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-gray-400 focus-within:border-transparent">
          {/* Line numbers column */}
          <div
            ref={lineNumbersRef}
            className="bg-gray-50 text-gray-400 text-xs font-mono select-none overflow-hidden border-r border-gray-200 py-2"
            style={{ width: '40px', height: '160px' }}
          >
            {Array.from({ length: Math.max(lineCount, 8) }, (_, i) => (
              <div
                key={i}
                className={`px-2 text-right leading-5 ${
                  highlightLines &&
                  i + 1 >= highlightLines.start &&
                  i + 1 <= highlightLines.end
                    ? 'bg-gray-200 text-gray-600 font-medium'
                    : ''
                }`}
              >
                {i + 1}
              </div>
            ))}
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            onScroll={handleScroll}
            placeholder="Paste your transcript here..."
            className="flex-1 h-40 px-3 py-2 bg-white text-gray-900 placeholder-gray-400 focus:outline-none resize-none text-sm font-mono leading-5"
          />
        </div>

        {/* Stats row */}
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>
            {transcript.length.toLocaleString()} chars · {lineCount.toLocaleString()} lines · ~{tokens.toLocaleString()} tokens
          </span>
          <span className="text-gray-500">
            Est. cost: {cost}
          </span>
        </div>
      </div>

      {/* Mode selection */}
      <div>
        <button
          onClick={() => setShowOptions(!showOptions)}
          className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
        >
          <span>{showOptions ? '−' : '+'}</span>
          <span>Options</span>
          <span className="text-gray-400">({modeLabels[mode].label})</span>
        </button>

        {showOptions && (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(modeLabels) as AnalysisMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`p-2 text-left rounded-lg border transition-colors ${
                    mode === m
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-sm font-medium">{modeLabels[m].label}</div>
                  <div className={`text-xs ${mode === m ? 'text-gray-300' : 'text-gray-500'}`}>
                    {modeLabels[m].description}
                  </div>
                </button>
              ))}
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Custom focus (optional)
              </label>
              <input
                type="text"
                value={customFocus}
                onChange={(e) => setCustomFocus(e.target.value)}
                placeholder="e.g., Prioritize controversy moments"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent text-sm"
              />
            </div>
          </div>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!transcript.trim() || isLoading}
        className="w-full py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
      >
        {isLoading ? 'Analyzing...' : 'Analyze Transcript'}
      </button>
    </div>
  );
}

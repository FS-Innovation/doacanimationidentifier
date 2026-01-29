'use client';

import { useState, useRef } from 'react';
import { AnalysisMode } from '@/types';

interface TranscriptInputProps {
  onAnalyze: (transcript: string, mode: AnalysisMode, customFocus?: string) => void;
  isLoading: boolean;
  hasSession: boolean;
}

export function TranscriptInput({ onAnalyze, isLoading, hasSession }: TranscriptInputProps) {
  const [transcript, setTranscript] = useState('');
  const [mode, setMode] = useState<AnalysisMode>('mixed');
  const [customFocus, setCustomFocus] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    return (
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Transcript loaded ({transcript.length.toLocaleString()} characters)
          </div>
          <button
            onClick={() => {
              setTranscript('');
            }}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Load new transcript
          </button>
        </div>
      </div>
    );
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
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Paste your transcript here..."
          className="w-full h-40 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent resize-none text-sm"
        />
        <div className="text-xs text-gray-400 mt-1">
          {transcript.length.toLocaleString()} characters
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

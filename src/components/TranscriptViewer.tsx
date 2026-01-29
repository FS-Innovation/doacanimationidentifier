'use client';

import { useRef, useEffect } from 'react';

interface TranscriptViewerProps {
  transcript: string;
  highlightLines?: { start: number; end: number } | null;
}

export function TranscriptViewer({ transcript, highlightLines }: TranscriptViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lines = transcript.split('\n');

  // Scroll to highlighted lines when they change
  useEffect(() => {
    if (highlightLines && containerRef.current) {
      const highlightedLine = containerRef.current.querySelector(`[data-line="${highlightLines.start}"]`);
      if (highlightedLine) {
        highlightedLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightLines]);

  return (
    <div className="h-full flex flex-col border-b border-gray-200">
      <div className="p-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
        <span className="text-sm font-medium text-gray-700">Transcript</span>
        <span className="text-xs text-gray-400">
          {lines.length.toLocaleString()} lines
        </span>
      </div>
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto font-mono text-xs"
        style={{ maxHeight: '200px' }}
      >
        {lines.map((line, i) => {
          const lineNum = i + 1;
          const isHighlighted =
            highlightLines &&
            lineNum >= highlightLines.start &&
            lineNum <= highlightLines.end;

          return (
            <div
              key={i}
              data-line={lineNum}
              className={`flex ${isHighlighted ? 'bg-gray-100' : ''}`}
            >
              <span
                className={`select-none px-2 py-0.5 text-right border-r border-gray-200 ${
                  isHighlighted ? 'bg-gray-200 text-gray-700 font-medium' : 'bg-gray-50 text-gray-400'
                }`}
                style={{ minWidth: '40px' }}
              >
                {lineNum}
              </span>
              <span className={`px-3 py-0.5 flex-1 ${isHighlighted ? 'text-gray-900' : 'text-gray-600'}`}>
                {line || '\u00A0'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { AnimationSuggestion } from '@/types';

interface SuggestionCardProps {
  suggestion: AnimationSuggestion;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onViewInTranscript?: (start: number, end: number) => void;
}

export function SuggestionCard({ suggestion, isSelected, onToggleSelect, onViewInTranscript }: SuggestionCardProps) {
  const [copied, setCopied] = useState(false);

  const typeLabels: Record<string, string> = {
    character_reaction: 'Character',
    visual_metaphor: 'Metaphor',
    data_visualization: 'Data Viz',
    emotional_arc: 'Emotional',
    educational_diagram: 'Educational',
    other: 'Other',
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = `${suggestion.title}\n\n"${suggestion.excerpt}"\n\n${suggestion.rationale}\n\nLines: ${suggestion.sectionStart}-${suggestion.sectionEnd}\nScore: ${suggestion.score}/10\nType: ${typeLabels[suggestion.animationType] || suggestion.animationType}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleViewInTranscript = (e: React.MouseEvent) => {
    e.stopPropagation();
    onViewInTranscript?.(suggestion.sectionStart, suggestion.sectionEnd);
  };

  return (
    <div
      className={`relative p-4 border rounded-lg transition-all cursor-pointer ${
        isSelected
          ? 'border-gray-900 bg-gray-50'
          : 'border-gray-200 hover:border-gray-300'
      }`}
      onClick={() => onToggleSelect(suggestion.id)}
    >
      <div className="flex items-start justify-between gap-2 mb-2 pr-8">
        <h4 className="font-medium text-gray-900 text-sm">{suggestion.title}</h4>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
            {typeLabels[suggestion.animationType] || suggestion.animationType}
          </span>
          <span className="text-xs font-medium text-gray-500">{suggestion.score}/10</span>
        </div>
      </div>

      <p className="text-xs text-gray-600 mb-2 italic line-clamp-2">
        &quot;{suggestion.excerpt}&quot;
      </p>

      <p className="text-xs text-gray-700 mb-2 line-clamp-3">
        {suggestion.rationale}
      </p>

      <div className="flex flex-wrap gap-1">
        {suggestion.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded"
          >
            {tag}
          </span>
        ))}
        {suggestion.tags.length > 3 && (
          <span className="text-xs text-gray-400">+{suggestion.tags.length - 3}</span>
        )}
      </div>

      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
        <button
          onClick={handleViewInTranscript}
          className="text-xs text-gray-400 hover:text-gray-600 underline"
        >
          Lines {suggestion.sectionStart}–{suggestion.sectionEnd}
        </button>
        <button
          onClick={handleCopy}
          className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
          title="Copy to clipboard"
        >
          {copied ? (
            <>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>

      {/* Selection indicator */}
      <div className="absolute top-2 right-2">
        <div
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            isSelected
              ? 'border-gray-900 bg-gray-900'
              : 'border-gray-300'
          }`}
        >
          {isSelected && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

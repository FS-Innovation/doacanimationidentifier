'use client';

import { useState } from 'react';
import { AnimationSuggestion } from '@/types';
import { SuggestionCard } from './SuggestionCard';

interface SidebarProps {
  suggestions: AnimationSuggestion[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onExport: () => void;
  isExporting: boolean;
  onViewInTranscript?: (start: number, end: number) => void;
}

export function Sidebar({
  suggestions,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onExport,
  isExporting,
  onViewInTranscript,
}: SidebarProps) {
  const [sortBy, setSortBy] = useState<'score' | 'position'>('score');

  const sortedSuggestions = [...suggestions].sort((a, b) => {
    if (sortBy === 'score') {
      return b.score - a.score;
    }
    return a.sectionStart - b.sectionStart;
  });

  if (suggestions.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Suggestions</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-gray-400 text-sm text-center">
            Suggestions will appear here after analysis
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">
            Suggestions ({suggestions.length})
          </h2>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'score' | 'position')}
            className="text-sm px-2 py-1 border border-gray-200 rounded bg-white text-gray-600"
          >
            <option value="score">By Score</option>
            <option value="position">By Position</option>
          </select>
        </div>

        {/* Selection controls */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            {selectedIds.length} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={onSelectAll}
              className="text-gray-500 hover:text-gray-700 underline"
            >
              All
            </button>
            <button
              onClick={onDeselectAll}
              className="text-gray-500 hover:text-gray-700 underline"
            >
              None
            </button>
          </div>
        </div>
      </div>

      {/* Suggestions list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {sortedSuggestions.map((suggestion) => (
          <SuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            isSelected={selectedIds.includes(suggestion.id)}
            onToggleSelect={onToggleSelect}
            onViewInTranscript={onViewInTranscript}
          />
        ))}
      </div>

      {/* Export button */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={onExport}
          disabled={selectedIds.length === 0 || isExporting}
          className="w-full py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        >
          {isExporting
            ? 'Exporting...'
            : `Export ${selectedIds.length > 0 ? `(${selectedIds.length})` : ''}`}
        </button>
      </div>
    </div>
  );
}

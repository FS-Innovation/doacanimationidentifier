'use client';

import { useState, useCallback } from 'react';
import { Chat } from '@/components/Chat';
import { TranscriptInput } from '@/components/TranscriptInput';
import { Sidebar } from '@/components/Sidebar';
import { AnalysisMode, AnimationSuggestion, ChatMessage } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<AnimationSuggestion[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isConversing, setIsConversing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = useCallback(async (transcript: string, mode: AnalysisMode, customFocus?: string) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, mode, customFocus }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Analysis failed');
      }

      const data = await response.json();
      setSessionId(data.sessionId);
      setSuggestions(data.suggestions);
      setMessages([
        {
          id: uuidv4(),
          role: 'assistant',
          content: `Analysis complete! Found ${data.suggestions.length} animation-worthy moments.\n\n${data.summary}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const handleSendMessage = useCallback(async (message: string) => {
    if (!sessionId) return;

    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsConversing(true);
    setError(null);

    try {
      const response = await fetch('/api/converse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Conversation failed');
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (data.updatedSuggestions) {
        setSuggestions(data.updatedSuggestions);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsConversing(false);
    }
  }, [sessionId]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(suggestions.map((s) => s.id));
  }, [suggestions]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const handleExport = useCallback(async () => {
    if (!sessionId || selectedIds.length === 0) return;

    setIsExporting(true);
    setError(null);

    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, selectedIds }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Export failed');
      }

      const data = await response.json();

      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `animation-suggestions-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  }, [sessionId, selectedIds]);

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">TAS</h1>
            <p className="text-sm text-gray-500">Transcript Animation Spotter</p>
          </div>
          {sessionId && (
            <button
              onClick={() => {
                setSessionId(null);
                setMessages([]);
                setSuggestions([]);
                setSelectedIds([]);
              }}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              New Session
            </button>
          )}
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="bg-gray-100 border-b border-gray-200 px-6 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Left side: Chat */}
        <div className="flex-1 flex flex-col border-r border-gray-200 min-w-0">
          {!sessionId && (
            <TranscriptInput
              onAnalyze={handleAnalyze}
              isLoading={isAnalyzing}
              hasSession={!!sessionId}
            />
          )}
          <div className="flex-1 min-h-0">
            <Chat
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={isAnalyzing || isConversing}
              disabled={!sessionId}
            />
          </div>
        </div>

        {/* Right side: Sidebar */}
        <div className="w-80 flex-shrink-0 border-l border-gray-200">
          <Sidebar
            suggestions={suggestions}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            onExport={handleExport}
            isExporting={isExporting}
          />
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Chat } from '@/components/Chat';
import { TranscriptInput } from '@/components/TranscriptInput';
import { TranscriptViewer } from '@/components/TranscriptViewer';
import { Sidebar } from '@/components/Sidebar';
import { AnalysisMode, AnimationSuggestion, ChatMessage } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface SessionSummary {
  id: string;
  mode: string;
  suggestionsCount: number;
  transcriptPreview: string;
  createdAt: string;
  updatedAt: string;
}

interface SubAgentProgress {
  completed: number;
  total: number;
  currentPages: number[];
  hasInterestingContent: boolean;
  briefSummary: string;
}

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<AnimationSuggestion[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isConversing, setIsConversing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [highlightLines, setHighlightLines] = useState<{ start: number; end: number } | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [showSessionDropdown, setShowSessionDropdown] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<string>('');
  const [subAgentProgress, setSubAgentProgress] = useState<SubAgentProgress | null>(null);
  const [executiveBrief, setExecutiveBrief] = useState<string>('');
  const [overallSummary, setOverallSummary] = useState<string>('');
  const [mode, setMode] = useState<AnalysisMode>('mixed');
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Fetch sessions on mount
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/sessions');
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  };

  const loadSession = async (id: string) => {
    try {
      const response = await fetch(`/api/sessions/${id}`);
      if (response.ok) {
        const session = await response.json();
        setSessionId(session.id);
        setTranscript(session.transcript);
        setMessages(session.messages);
        setSuggestions(session.suggestions);
        setSelectedIds([]);
        setShowSessionDropdown(false);
      }
    } catch (err) {
      setError('Failed to load session');
    }
  };

  // Handle PDF upload
  const handlePdfUpload = useCallback(async (file: File) => {
    setIsAnalyzing(true);
    setError(null);
    setStreamingContent('');
    setAnalysisStatus('Starting PDF analysis...');
    setSubAgentProgress(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', mode);

      const response = await fetch('/api/analyze-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'PDF analysis failed');
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'status') {
                setAnalysisStatus(data.message);
              } else if (data.type === 'session') {
                setSessionId(data.sessionId);
              } else if (data.type === 'subagent') {
                setSubAgentProgress({
                  completed: data.completed,
                  total: data.total,
                  currentPages: data.pageNumbers,
                  hasInterestingContent: data.hasInterestingContent,
                  briefSummary: data.briefSummary,
                });
              } else if (data.type === 'done') {
                setSuggestions(data.suggestions);
                setExecutiveBrief(data.executiveBrief || '');
                setOverallSummary(data.summary || '');
                setTranscript(`[PDF Document - ${data.pageCount} pages]\n\n${data.summary}`);
                setMessages([
                  {
                    id: uuidv4(),
                    role: 'assistant',
                    content: `**Analysis Complete!**\n\n${data.executiveBrief}\n\n${data.summary}\n\nFound ${data.suggestions.length} animation-worthy sections across ${data.pageCount} pages.`,
                    timestamp: new Date().toISOString(),
                  },
                ]);
                setAnalysisStatus('');
                setSubAgentProgress(null);
                fetchSessions();
              } else if (data.type === 'error') {
                throw new Error(data.error);
              }
            } catch (parseErr) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setAnalysisStatus('');
      setSubAgentProgress(null);
    } finally {
      setIsAnalyzing(false);
    }
  }, [mode]);

  const handleAnalyze = useCallback(async (transcriptText: string, analysisMode: AnalysisMode, customFocus?: string) => {
    setIsAnalyzing(true);
    setError(null);
    setStreamingContent('');
    setTranscript(transcriptText);
    setMode(analysisMode);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: transcriptText, mode: analysisMode, customFocus }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Analysis failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'session') {
                setSessionId(data.sessionId);
              } else if (data.type === 'chunk') {
                setStreamingContent(prev => prev + data.content);
              } else if (data.type === 'done') {
                setSuggestions(data.suggestions);
                setMessages([
                  {
                    id: uuidv4(),
                    role: 'assistant',
                    content: `Analysis complete! Found ${data.suggestions.length} animation-worthy moments.\n\n${data.summary}`,
                    timestamp: new Date().toISOString(),
                  },
                ]);
                setStreamingContent('');
                fetchSessions();
              } else if (data.type === 'error') {
                throw new Error(data.error);
              }
            } catch (parseErr) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStreamingContent('');
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

  const handleExport = useCallback(async (format: 'json' | 'pdf' = 'json') => {
    if (!sessionId || selectedIds.length === 0) return;

    setIsExporting(true);
    setError(null);

    try {
      if (format === 'pdf') {
        const response = await fetch('/api/export-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            selectedIds,
            executiveBrief,
            overallSummary,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'PDF export failed');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tas-report-${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
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
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `animation-suggestions-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  }, [sessionId, selectedIds, executiveBrief, overallSummary]);

  const handleViewInTranscript = useCallback((start: number, end: number) => {
    setHighlightLines({ start, end });
    setTimeout(() => setHighlightLines(null), 5000);
  }, []);

  const handleNewSession = useCallback(() => {
    setSessionId(null);
    setTranscript('');
    setMessages([]);
    setSuggestions([]);
    setSelectedIds([]);
    setHighlightLines(null);
    setStreamingContent('');
    setAnalysisStatus('');
    setSubAgentProgress(null);
    setExecutiveBrief('');
    setOverallSummary('');
  }, []);

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">TAS</h1>
            <p className="text-sm text-gray-500">Transcript Animation Spotter</p>
          </div>
          <div className="flex items-center gap-4">
            {/* PDF Upload Button */}
            {!sessionId && (
              <>
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePdfUpload(file);
                  }}
                  className="hidden"
                />
                <button
                  onClick={() => pdfInputRef.current?.click()}
                  disabled={isAnalyzing}
                  className="text-sm px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-300 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Upload PDF
                </button>
              </>
            )}

            {/* Session history dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSessionDropdown(!showSessionDropdown)}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                History
                {sessions.length > 0 && (
                  <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">{sessions.length}</span>
                )}
              </button>

              {showSessionDropdown && (
                <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                  {sessions.length === 0 ? (
                    <div className="p-4 text-sm text-gray-400 text-center">
                      No previous sessions
                    </div>
                  ) : (
                    sessions.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => loadSession(s.id)}
                        className={`w-full p-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                          s.id === sessionId ? 'bg-gray-50' : ''
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="text-xs text-gray-400 uppercase">{s.mode}</span>
                          <span className="text-xs text-gray-400">
                            {new Date(s.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 truncate mt-1">
                          {s.transcriptPreview}
                        </p>
                        <span className="text-xs text-gray-400">
                          {s.suggestionsCount} suggestions
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {sessionId && (
              <button
                onClick={handleNewSession}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                New Session
              </button>
            )}
          </div>
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
        {/* Left side: Transcript + Chat */}
        <div className="flex-1 flex flex-col border-r border-gray-200 min-w-0">
          {!sessionId ? (
            <TranscriptInput
              onAnalyze={handleAnalyze}
              isLoading={isAnalyzing}
              hasSession={!!sessionId}
              transcript={transcript}
              onTranscriptChange={setTranscript}
            />
          ) : (
            <TranscriptViewer
              transcript={transcript}
              highlightLines={highlightLines}
            />
          )}

          {/* Analysis progress indicator */}
          {isAnalyzing && (analysisStatus || subAgentProgress) && (
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
                <span>{analysisStatus}</span>
              </div>

              {subAgentProgress && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Sub-agent {subAgentProgress.completed}/{subAgentProgress.total}</span>
                    <span>Pages {subAgentProgress.currentPages.join('-')}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gray-600 h-2 rounded-full transition-all"
                      style={{ width: `${(subAgentProgress.completed / subAgentProgress.total) * 100}%` }}
                    />
                  </div>
                  {subAgentProgress.briefSummary && (
                    <p className="text-xs text-gray-500 italic">
                      {subAgentProgress.hasInterestingContent ? '✓' : '○'} {subAgentProgress.briefSummary}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Streaming indicator for text analysis */}
          {isAnalyzing && streamingContent && (
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
                <span>Analyzing...</span>
              </div>
              <pre className="mt-2 text-xs text-gray-500 font-mono whitespace-pre-wrap max-h-20 overflow-hidden">
                {streamingContent.slice(-500)}
              </pre>
            </div>
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
            onExport={() => handleExport('json')}
            onExportPdf={() => handleExport('pdf')}
            isExporting={isExporting}
            onViewInTranscript={handleViewInTranscript}
          />
        </div>
      </div>
    </div>
  );
}

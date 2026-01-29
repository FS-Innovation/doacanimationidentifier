export type AnalysisMode = 'mixed' | 'trend' | 'story' | 'edu';

export interface AnimationSuggestion {
  id: string;
  sectionStart: number;
  sectionEnd: number;
  title: string;
  excerpt: string;
  rationale: string;
  animationType: 'character_reaction' | 'visual_metaphor' | 'data_visualization' | 'emotional_arc' | 'educational_diagram' | 'other';
  score: number; // 1-10 rating
  tags: string[];
}

export interface AnalysisRequest {
  transcript: string;
  mode: AnalysisMode;
  keywords?: string[];
  customFocus?: string;
}

export interface AnalysisResponse {
  sessionId: string;
  suggestions: AnimationSuggestion[];
  summary: string;
  transcriptLength: number;
  analyzedAt: string;
}

export interface ConverseRequest {
  sessionId: string;
  message: string;
}

export interface ConverseResponse {
  reply: string;
  updatedSuggestions?: AnimationSuggestion[];
}

export interface ExportRequest {
  sessionId: string;
  selectedIds: string[];
}

export interface ExportResponse {
  exportedAt: string;
  suggestions: AnimationSuggestion[];
  transcript: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestions?: AnimationSuggestion[];
}

export interface Session {
  id: string;
  transcript: string;
  mode: AnalysisMode;
  messages: ChatMessage[];
  suggestions: AnimationSuggestion[];
  createdAt: string;
  updatedAt: string;
}

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { analyzeTranscript } from '@/lib/xai-client';
import { createSession, updateSession } from '@/lib/db';
import { AnalysisRequest, AnalysisResponse, ChatMessage } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: AnalysisRequest = await request.json();
    const { transcript, mode, keywords, customFocus } = body;

    if (!transcript || !transcript.trim()) {
      return NextResponse.json(
        { error: 'Transcript is required' },
        { status: 400 }
      );
    }

    if (!mode || !['mixed', 'trend', 'story', 'edu'].includes(mode)) {
      return NextResponse.json(
        { error: 'Valid mode is required (mixed, trend, story, edu)' },
        { status: 400 }
      );
    }

    // Create session
    const sessionId = uuidv4();
    createSession(sessionId, transcript, mode);

    // Analyze with xAI
    const { suggestions, summary } = await analyzeTranscript(
      transcript,
      mode,
      keywords,
      customFocus
    );

    // Add assistant message with analysis
    const assistantMessage: ChatMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: summary,
      timestamp: new Date().toISOString(),
      suggestions,
    };

    // Update session with suggestions and initial message
    updateSession(sessionId, {
      suggestions,
      messages: [assistantMessage],
    });

    const response: AnalysisResponse = {
      sessionId,
      suggestions,
      summary,
      transcriptLength: transcript.length,
      analyzedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}

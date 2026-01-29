import { NextResponse } from 'next/server';
import { getAllSessions } from '@/lib/db';

export async function GET() {
  try {
    const sessions = getAllSessions();

    // Return summary info only (not full transcripts)
    const summaries = sessions.map(s => ({
      id: s.id,
      mode: s.mode,
      suggestionsCount: s.suggestions.length,
      transcriptPreview: s.transcript.slice(0, 100) + (s.transcript.length > 100 ? '...' : ''),
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

    return NextResponse.json(summaries);
  } catch (error) {
    console.error('Get sessions error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get sessions' },
      { status: 500 }
    );
  }
}

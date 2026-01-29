import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/db';
import { ExportRequest, ExportResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: ExportRequest = await request.json();
    const { sessionId, selectedIds } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Get session
    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Filter suggestions by selected IDs, or return all if none specified
    const suggestions = selectedIds && selectedIds.length > 0
      ? session.suggestions.filter(s => selectedIds.includes(s.id))
      : session.suggestions;

    const response: ExportResponse = {
      exportedAt: new Date().toISOString(),
      suggestions,
      transcript: session.transcript,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Export failed' },
      { status: 500 }
    );
  }
}

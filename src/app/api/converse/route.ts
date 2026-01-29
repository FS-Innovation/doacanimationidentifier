import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { converse } from '@/lib/xai-client';
import { getSession, addMessage, updateSession } from '@/lib/db';
import { ConverseRequest, ConverseResponse, ChatMessage } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: ConverseRequest = await request.json();
    const { sessionId, message } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
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

    // Add user message
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    addMessage(sessionId, userMessage);

    // Get conversation history for context
    const conversationHistory = session.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    // Call xAI for response
    const { reply, updatedSuggestions } = await converse(
      conversationHistory,
      session.transcript,
      session.suggestions,
      message
    );

    // Add assistant response
    const assistantMessage: ChatMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: reply,
      timestamp: new Date().toISOString(),
      suggestions: updatedSuggestions,
    };
    addMessage(sessionId, assistantMessage);

    // Update suggestions if provided
    if (updatedSuggestions) {
      updateSession(sessionId, { suggestions: updatedSuggestions });
    }

    const response: ConverseResponse = {
      reply,
      updatedSuggestions,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Converse error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Conversation failed' },
      { status: 500 }
    );
  }
}

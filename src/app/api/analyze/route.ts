import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getAnalyzeRequestBody, parseAnalysisResponse } from '@/lib/xai-client';
import { createSession, updateSession } from '@/lib/db';
import { AnalysisRequest, ChatMessage } from '@/types';

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  try {
    const body: AnalysisRequest = await request.json();
    const { transcript, mode, keywords, customFocus } = body;

    if (!transcript || !transcript.trim()) {
      return new Response(
        JSON.stringify({ error: 'Transcript is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!mode || !['mixed', 'trend', 'story', 'edu'].includes(mode)) {
      return new Response(
        JSON.stringify({ error: 'Valid mode is required (mixed, trend, story, edu)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'XAI_API_KEY environment variable is not set' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create session
    const sessionId = uuidv4();
    createSession(sessionId, transcript, mode);

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send session ID immediately
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'session', sessionId })}\n\n`)
          );

          // Call xAI API with streaming
          const requestBody = getAnalyzeRequestBody(transcript, mode, keywords, customFocus);
          const response = await fetch(XAI_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            const error = await response.text();
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'error', error: `xAI API error: ${response.status} - ${error}` })}\n\n`)
            );
            controller.close();
            return;
          }

          const reader = response.body?.getReader();
          if (!reader) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'No response body' })}\n\n`)
            );
            controller.close();
            return;
          }

          const decoder = new TextDecoder();
          let fullContent = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    fullContent += content;
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`)
                    );
                  }
                } catch {
                  // Ignore parse errors for incomplete chunks
                }
              }
            }
          }

          reader.releaseLock();

          // Parse the complete response
          try {
            const { suggestions, summary } = parseAnalysisResponse(fullContent);

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

            // Send final result
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'done',
                suggestions,
                summary,
                transcriptLength: transcript.length,
                analyzedAt: new Date().toISOString(),
              })}\n\n`)
            );
          } catch (parseError) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'error',
                error: parseError instanceof Error ? parseError.message : 'Failed to parse response'
              })}\n\n`)
            );
          }

          controller.close();
        } catch (error) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              error: error instanceof Error ? error.message : 'Analysis failed'
            })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Analysis failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

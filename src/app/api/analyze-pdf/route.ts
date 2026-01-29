import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// pdf-parse v1 uses CommonJS, use dynamic import
async function parsePdf(buffer: Buffer): Promise<{ text: string; numpages: number }> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse');
  const result = await pdfParse(buffer);
  return { text: result.text, numpages: result.numpages };
}
import {
  splitIntoChunks,
  runSubAgentsWithRateLimit,
  runDirectorAgent,
  convertToSuggestions,
  SubAgentReport,
  DirectorAnalysis,
} from '@/lib/multi-agent';
import { createSession, updateSession } from '@/lib/db';
import { AnalysisMode, ChatMessage } from '@/types';

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const mode = (formData.get('mode') as AnalysisMode) || 'mixed';
    const customFocus = formData.get('customFocus') as string | null;

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'PDF file is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return new Response(
        JSON.stringify({ error: 'File must be a PDF' }),
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

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Parse PDF
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'status', message: 'Parsing PDF...' })}\n\n`)
          );

          const buffer = Buffer.from(await file.arrayBuffer());
          const pdfData = await parsePdf(buffer);

          // Split into pages (pdf-parse gives us text, we'll split by page markers or chunks)
          // Since pdf-parse doesn't preserve page boundaries well, we'll chunk by character count
          const fullText = pdfData.text;
          const estimatedPages = Math.ceil(fullText.length / 3000); // ~3000 chars per page estimate
          const charsPerPage = Math.ceil(fullText.length / Math.max(estimatedPages, 1));

          const pages: string[] = [];
          for (let i = 0; i < fullText.length; i += charsPerPage) {
            pages.push(fullText.slice(i, i + charsPerPage));
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'status',
              message: `PDF parsed: ${pages.length} pages, ${fullText.length} characters`
            })}\n\n`)
          );

          // Create session
          const sessionId = uuidv4();
          createSession(sessionId, fullText, mode);

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'session', sessionId })}\n\n`)
          );

          // Split into chunks
          const chunks = splitIntoChunks(pages, 2);

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'status',
              message: `Starting analysis: ${chunks.length} sub-agents will analyze the document`
            })}\n\n`)
          );

          // Run sub-agents
          const subAgentReports: SubAgentReport[] = await runSubAgentsWithRateLimit(
            chunks,
            apiKey,
            3, // concurrency
            500, // delay between requests
            (completed, total, report) => {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  type: 'subagent',
                  completed,
                  total,
                  pageNumbers: report.pageNumbers,
                  hasInterestingContent: report.hasInterestingContent,
                  briefSummary: report.briefSummary,
                })}\n\n`)
              );
            }
          );

          const interestingCount = subAgentReports.filter(r => r.hasInterestingContent).length;

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'status',
              message: `Sub-agents complete: ${interestingCount}/${subAgentReports.length} chunks have interesting content. Director is synthesizing...`
            })}\n\n`)
          );

          // Run Director agent
          let directorAnalysis: DirectorAnalysis;
          try {
            directorAnalysis = await runDirectorAgent(
              subAgentReports,
              fullText,
              mode,
              apiKey
            );
          } catch (directorError) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'error',
                error: `Director agent failed: ${directorError instanceof Error ? directorError.message : 'Unknown error'}`
              })}\n\n`)
            );
            controller.close();
            return;
          }

          // Convert to suggestions
          const suggestions = convertToSuggestions(directorAnalysis);

          // Create assistant message
          const assistantMessage: ChatMessage = {
            id: uuidv4(),
            role: 'assistant',
            content: `**Analysis Complete!**\n\n${directorAnalysis.executiveBrief}\n\n${directorAnalysis.overallSummary}\n\nFound ${suggestions.length} animation-worthy sections across ${pages.length} pages.`,
            timestamp: new Date().toISOString(),
            suggestions,
          };

          // Update session
          updateSession(sessionId, {
            suggestions,
            messages: [assistantMessage],
          });

          // Send final result
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'done',
              suggestions,
              summary: directorAnalysis.overallSummary,
              executiveBrief: directorAnalysis.executiveBrief,
              subAgentReports: subAgentReports.map(r => ({
                pageNumbers: r.pageNumbers,
                hasInterestingContent: r.hasInterestingContent,
                briefSummary: r.briefSummary,
              })),
              pageCount: pages.length,
              analyzedAt: new Date().toISOString(),
            })}\n\n`)
          );

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
    console.error('PDF analysis error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'PDF analysis failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

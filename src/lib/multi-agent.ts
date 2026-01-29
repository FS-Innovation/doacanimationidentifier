import { AnalysisMode, AnimationSuggestion } from '@/types';

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';

export interface PageChunk {
  pageNumbers: number[];
  content: string;
}

export interface SubAgentReport {
  chunkIndex: number;
  pageNumbers: number[];
  hasInterestingContent: boolean;
  briefSummary: string;
  potentialMoments: Array<{
    type: 'storytelling' | 'educational' | 'market' | 'emotional';
    description: string;
    excerpt: string;
    confidence: number; // 1-10
  }>;
}

export interface DirectorAnalysis {
  selectedSections: Array<{
    pageNumbers: number[];
    title: string;
    excerpt: string;
    rationale: string;
    animationType: string;
    score: number;
    firstPrinciplesReasoning: string;
  }>;
  overallSummary: string;
  executiveBrief: string;
}

// Split PDF text into page chunks (2 pages each)
export function splitIntoChunks(pages: string[], chunkSize: number = 2): PageChunk[] {
  const chunks: PageChunk[] = [];

  for (let i = 0; i < pages.length; i += chunkSize) {
    const pageNumbers = [];
    const contents = [];

    for (let j = i; j < Math.min(i + chunkSize, pages.length); j++) {
      pageNumbers.push(j + 1);
      contents.push(`--- PAGE ${j + 1} ---\n${pages[j]}`);
    }

    chunks.push({
      pageNumbers,
      content: contents.join('\n\n'),
    });
  }

  return chunks;
}

// Sub-agent prompt for quick analysis
function getSubAgentPrompt(): string {
  return `You are a Sub-Agent Analyst. Your job is to quickly scan document pages and identify ANY potentially interesting moments for animation.

Apply FIRST PRINCIPLES THINKING:
1. What is the core message or insight being communicated?
2. Would visualizing this help someone understand it better?
3. Is there emotional resonance, educational value, or market relevance?

For each page chunk, respond with JSON only:
{
  "hasInterestingContent": true/false,
  "briefSummary": "1-2 sentence summary of what these pages contain",
  "potentialMoments": [
    {
      "type": "storytelling" | "educational" | "market" | "emotional",
      "description": "What makes this moment interesting",
      "excerpt": "Brief quote or description from the text",
      "confidence": 1-10
    }
  ]
}

Be INCLUSIVE - if there's ANY potential, report it. The Director will filter later.
Respond with valid JSON only.`;
}

// Director agent prompt for final synthesis
function getDirectorPrompt(mode: AnalysisMode): string {
  const modeGuidance = {
    mixed: 'Balance all factors equally.',
    trend: 'Prioritize market relevance and viral potential.',
    story: 'Prioritize emotional arcs and narrative moments.',
    edu: 'Prioritize educational clarity and teachable moments.',
  };

  return `You are the Director Agent. You receive reports from Sub-Agents who scanned a document page-by-page.

Your job is to apply FIRST PRINCIPLES REASONING to decide which sections truly deserve animation:

FIRST PRINCIPLES FRAMEWORK:
1. CLARITY: Will animation make this clearer than text alone?
2. IMPACT: Will this moment emotionally resonate or stick in memory?
3. COMPLEXITY: Is there hidden complexity that animation can reveal?
4. UNIQUENESS: Is this insight rare or counterintuitive enough to warrant highlighting?

MODE: ${mode.toUpperCase()}
${modeGuidance[mode]}

For each selected section, provide:
- Deep reasoning about WHY this section matters (using first principles)
- Specific animation approach suggestions
- Connection to broader themes

Respond with JSON only:
{
  "executiveBrief": "2-3 sentence high-level summary for busy stakeholders",
  "overallSummary": "Comprehensive paragraph about the document's animation potential",
  "selectedSections": [
    {
      "pageNumbers": [1, 2],
      "title": "Section title",
      "excerpt": "Key quote or description",
      "rationale": "Why this matters for animation",
      "animationType": "character_reaction|visual_metaphor|data_visualization|emotional_arc|educational_diagram|other",
      "score": 1-10,
      "firstPrinciplesReasoning": "Deep analysis using the framework above"
    }
  ]
}

Select 5-15 sections maximum. Quality over quantity.`;
}

// Run a sub-agent on a chunk
export async function runSubAgent(
  chunk: PageChunk,
  chunkIndex: number,
  apiKey: string
): Promise<SubAgentReport> {
  const response = await fetch(XAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-3-mini-fast', // Use faster/cheaper model for sub-agents
      messages: [
        { role: 'system', content: getSubAgentPrompt() },
        { role: 'user', content: `Analyze these pages:\n\n${chunk.content}` },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Sub-agent error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  try {
    const parsed = JSON.parse(content);
    return {
      chunkIndex,
      pageNumbers: chunk.pageNumbers,
      hasInterestingContent: parsed.hasInterestingContent || false,
      briefSummary: parsed.briefSummary || '',
      potentialMoments: parsed.potentialMoments || [],
    };
  } catch {
    // If parsing fails, assume some content
    return {
      chunkIndex,
      pageNumbers: chunk.pageNumbers,
      hasInterestingContent: true,
      briefSummary: 'Analysis completed but response parsing failed',
      potentialMoments: [],
    };
  }
}

// Run the Director agent on all sub-agent reports
export async function runDirectorAgent(
  reports: SubAgentReport[],
  fullDocument: string,
  mode: AnalysisMode,
  apiKey: string
): Promise<DirectorAnalysis> {
  // Filter to only interesting chunks
  const interestingReports = reports.filter(r => r.hasInterestingContent);

  // Compile sub-agent findings
  const subAgentSummary = interestingReports.map(r =>
    `Pages ${r.pageNumbers.join('-')}: ${r.briefSummary}\n` +
    r.potentialMoments.map(m => `  - [${m.type}] ${m.description} (confidence: ${m.confidence}/10)`).join('\n')
  ).join('\n\n');

  const userMessage = `SUB-AGENT REPORTS:\n${subAgentSummary}\n\n---\n\nFULL DOCUMENT (for reference):\n${fullDocument.slice(0, 50000)}${fullDocument.length > 50000 ? '\n...[truncated]' : ''}`;

  const response = await fetch(XAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-4-1-fast-reasoning', // Use best model for Director
      messages: [
        { role: 'system', content: getDirectorPrompt(mode) },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 8000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Director agent error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  try {
    const parsed = JSON.parse(content);
    return {
      selectedSections: parsed.selectedSections || [],
      overallSummary: parsed.overallSummary || '',
      executiveBrief: parsed.executiveBrief || '',
    };
  } catch {
    // Try to extract JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        selectedSections: parsed.selectedSections || [],
        overallSummary: parsed.overallSummary || '',
        executiveBrief: parsed.executiveBrief || '',
      };
    }
    throw new Error('Failed to parse Director response');
  }
}

// Rate-limited parallel execution
export async function runSubAgentsWithRateLimit(
  chunks: PageChunk[],
  apiKey: string,
  concurrency: number = 3,
  delayMs: number = 500,
  onProgress?: (completed: number, total: number, report: SubAgentReport) => void
): Promise<SubAgentReport[]> {
  const results: SubAgentReport[] = [];
  const queue = [...chunks.map((chunk, i) => ({ chunk, index: i }))];

  async function processOne(): Promise<void> {
    const item = queue.shift();
    if (!item) return;

    try {
      const report = await runSubAgent(item.chunk, item.index, apiKey);
      results.push(report);
      onProgress?.(results.length, chunks.length, report);
    } catch (error) {
      // On error, still add a placeholder result
      const errorReport: SubAgentReport = {
        chunkIndex: item.index,
        pageNumbers: item.chunk.pageNumbers,
        hasInterestingContent: false,
        briefSummary: `Error analyzing pages: ${error instanceof Error ? error.message : 'Unknown error'}`,
        potentialMoments: [],
      };
      results.push(errorReport);
      onProgress?.(results.length, chunks.length, errorReport);
    }

    // Rate limit delay
    if (queue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // Run with concurrency limit
  const workers = Array(Math.min(concurrency, chunks.length))
    .fill(null)
    .map(async () => {
      while (queue.length > 0) {
        await processOne();
      }
    });

  await Promise.all(workers);

  // Sort by chunk index
  return results.sort((a, b) => a.chunkIndex - b.chunkIndex);
}

// Convert Director analysis to AnimationSuggestions for compatibility
export function convertToSuggestions(analysis: DirectorAnalysis): AnimationSuggestion[] {
  return analysis.selectedSections.map((section, i) => ({
    id: `section-${i + 1}`,
    sectionStart: section.pageNumbers[0] || 1,
    sectionEnd: section.pageNumbers[section.pageNumbers.length - 1] || 1,
    title: section.title,
    excerpt: section.excerpt,
    rationale: `${section.rationale}\n\n**First Principles Analysis:**\n${section.firstPrinciplesReasoning}`,
    animationType: section.animationType as AnimationSuggestion['animationType'],
    score: section.score,
    tags: [section.animationType, `pages-${section.pageNumbers.join('-')}`],
  }));
}

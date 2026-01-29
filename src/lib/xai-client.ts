import { AnalysisMode, AnimationSuggestion } from '@/types';

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';

function getSystemPrompt(mode: AnalysisMode, customFocus?: string): string {
  const modeInstructions = {
    mixed: 'Balance trend awareness, storytelling potential, and educational value equally.',
    trend: 'Prioritize moments that align with current trending topics, viral potential, and social media engagement.',
    story: 'Prioritize emotional arcs, character moments, narrative tension, and storytelling opportunities.',
    edu: 'Prioritize educational clarity, visual explanations, and teachable moments.',
  };

  return `You are an expert Animation Spotter assistant. Your job is to analyze transcripts and identify the best moments for animation.

For each suggestion, consider:
- Visual potential: Can this be animated in an engaging way?
- Emotional impact: Does it evoke emotion or create tension?
- Educational value: Does it explain a complex concept that benefits from visualization?
- Engagement: Would this capture and hold viewer attention?

MODE: ${mode.toUpperCase()}
${modeInstructions[mode]}

${customFocus ? `CUSTOM FOCUS: ${customFocus}` : ''}

OUTPUT FORMAT: You must respond with valid JSON only. No markdown, no explanations outside the JSON.
{
  "suggestions": [
    {
      "id": "unique-id-1",
      "sectionStart": <line number where section starts>,
      "sectionEnd": <line number where section ends>,
      "title": "Short descriptive title",
      "excerpt": "The exact text from the transcript (keep it concise, 1-3 sentences)",
      "rationale": "Detailed explanation of why this section should be animated and how",
      "animationType": "character_reaction" | "visual_metaphor" | "data_visualization" | "emotional_arc" | "educational_diagram" | "other",
      "score": <1-10 rating>,
      "tags": ["relevant", "tags"]
    }
  ],
  "summary": "Brief overall analysis of the transcript's animation potential"
}

Identify 5-15 animation-worthy moments, ranked by score. Be specific about WHY each moment works for animation.`;
}

function getConverseSystemPrompt(): string {
  return `You are an expert Animation Spotter assistant continuing a conversation about transcript analysis.

You have already analyzed a transcript and provided suggestions. The user may:
- Ask for clarification about suggestions
- Request more focus on certain aspects
- Ask you to ignore certain sections
- Request additional suggestions

Respond conversationally but stay focused on animation potential. If you need to update suggestions, include them in your response as JSON within <suggestions> tags.

If updating suggestions, format them as:
<suggestions>
[array of AnimationSuggestion objects]
</suggestions>

Otherwise, just respond naturally to help the user.`;
}

function parseAnalysisResponse(content: string): { suggestions: AnimationSuggestion[]; summary: string } {
  try {
    const parsed = JSON.parse(content);
    return {
      suggestions: parsed.suggestions || [],
      summary: parsed.summary || 'Analysis complete.',
    };
  } catch {
    // Try to extract JSON from the response if it's wrapped in markdown
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);
      return {
        suggestions: parsed.suggestions || [],
        summary: parsed.summary || 'Analysis complete.',
      };
    }
    throw new Error('Failed to parse xAI response as JSON');
  }
}

export async function analyzeTranscript(
  transcript: string,
  mode: AnalysisMode,
  keywords?: string[],
  customFocus?: string
): Promise<{ suggestions: AnimationSuggestion[]; summary: string }> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error('XAI_API_KEY environment variable is not set');
  }

  const userMessage = keywords?.length
    ? `Analyze this transcript with focus on keywords: ${keywords.join(', ')}\n\nTRANSCRIPT:\n${transcript}`
    : `Analyze this transcript:\n\nTRANSCRIPT:\n${transcript}`;

  const response = await fetch(XAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-4-1-fast-reasoning',
      messages: [
        { role: 'system', content: getSystemPrompt(mode, customFocus) },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 8000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`xAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('No content in xAI response');
  }

  return parseAnalysisResponse(content);
}

export function getAnalyzeRequestBody(
  transcript: string,
  mode: AnalysisMode,
  keywords?: string[],
  customFocus?: string
) {
  const userMessage = keywords?.length
    ? `Analyze this transcript with focus on keywords: ${keywords.join(', ')}\n\nTRANSCRIPT:\n${transcript}`
    : `Analyze this transcript:\n\nTRANSCRIPT:\n${transcript}`;

  return {
    model: 'grok-4-1-fast-reasoning',
    messages: [
      { role: 'system', content: getSystemPrompt(mode, customFocus) },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
    max_tokens: 8000,
    stream: true,
  };
}

export { parseAnalysisResponse };

export async function converse(
  sessionMessages: { role: 'user' | 'assistant'; content: string }[],
  transcript: string,
  currentSuggestions: AnimationSuggestion[],
  userMessage: string
): Promise<{ reply: string; updatedSuggestions?: AnimationSuggestion[] }> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error('XAI_API_KEY environment variable is not set');
  }

  const contextMessage = `Current transcript (for reference):\n${transcript.slice(0, 5000)}${transcript.length > 5000 ? '...[truncated]' : ''}\n\nCurrent suggestions:\n${JSON.stringify(currentSuggestions, null, 2)}`;

  const messages = [
    { role: 'system' as const, content: getConverseSystemPrompt() },
    { role: 'user' as const, content: contextMessage },
    ...sessionMessages.map(m => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: userMessage },
  ];

  const response = await fetch(XAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-4-1-fast-reasoning',
      messages,
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`xAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('No content in xAI response');
  }

  // Check for updated suggestions
  const suggestionsMatch = content.match(/<suggestions>([\s\S]*?)<\/suggestions>/);
  let updatedSuggestions: AnimationSuggestion[] | undefined;
  let reply = content;

  if (suggestionsMatch) {
    try {
      updatedSuggestions = JSON.parse(suggestionsMatch[1]);
      reply = content.replace(/<suggestions>[\s\S]*?<\/suggestions>/, '').trim();
    } catch {
      // Ignore parse errors, keep original content
    }
  }

  return { reply, updatedSuggestions };
}

// Token estimation for cost calculation
// Rough estimate: ~4 characters per token for English text
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateCost(inputTokens: number, outputTokens: number = 8000): { input: number; output: number; total: number } {
  // grok-4-1-fast-reasoning pricing: $0.20 / 1M input, $0.50 / 1M output
  const inputCost = (inputTokens / 1_000_000) * 0.20;
  const outputCost = (outputTokens / 1_000_000) * 0.50;
  return {
    input: inputCost,
    output: outputCost,
    total: inputCost + outputCost,
  };
}

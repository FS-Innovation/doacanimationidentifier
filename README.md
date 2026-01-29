# TAS - Transcript Animation Spotter

A local tool for identifying animation-worthy moments in transcripts using xAI's Grok model.

## Features

- **Full Transcript Analysis**: Paste or upload transcripts up to 2M tokens
- **Multiple Analysis Modes**: Balanced, Trend-Heavy, Story-Heavy, or Educational focus
- **Conversational Refinement**: Ask follow-up questions to refine suggestions
- **Selection & Export**: Select specific suggestions and export as JSON
- **Session Persistence**: Sessions are saved locally with SQLite

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up your API key**:
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` and add your xAI API key:
   ```
   XAI_API_KEY=your_actual_api_key
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Open** [http://localhost:3000](http://localhost:3000)

## Usage

1. Paste your transcript into the text area (or upload a .txt/.srt/.vtt file)
2. Select an analysis mode:
   - **Balanced**: Equal weight to trends, story, and education
   - **Trend-Heavy**: Prioritize viral and trending moments
   - **Story-Heavy**: Focus on emotional arcs and narrative
   - **Edu-Heavy**: Highlight teachable moments
3. Click "Analyze Transcript"
4. Review suggestions in the sidebar
5. Chat to refine: "More focus on emotional moments" or "Explain suggestion 3"
6. Select suggestions and export as JSON

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analyze` | POST | Analyze a transcript |
| `/api/converse` | POST | Send follow-up messages |
| `/api/export` | POST | Export selected suggestions |
| `/api/sessions/:id` | GET | Retrieve a session |
| `/api/sessions/:id` | DELETE | Delete a session |

## Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: SQLite (better-sqlite3)
- **AI**: xAI Grok (grok-4-1-fast-reasoning)

## Cost Estimate

With grok-4-1-fast-reasoning pricing ($0.20/1M input, $0.50/1M output):
- Typical 30-60 min transcript: ~$0.01-0.05 per analysis

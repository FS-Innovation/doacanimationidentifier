import Database from 'better-sqlite3';
import path from 'path';
import { Session, ChatMessage, AnimationSuggestion, AnalysisMode } from '@/types';

const dbPath = path.join(process.cwd(), 'data', 'sessions.db');

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    // Ensure data directory exists
    const fs = require('fs');
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    db = new Database(dbPath);

    // Initialize tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        transcript TEXT NOT NULL,
        mode TEXT NOT NULL,
        messages TEXT NOT NULL DEFAULT '[]',
        suggestions TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }
  return db;
}

export function createSession(
  id: string,
  transcript: string,
  mode: AnalysisMode
): Session {
  const now = new Date().toISOString();
  const session: Session = {
    id,
    transcript,
    mode,
    messages: [],
    suggestions: [],
    createdAt: now,
    updatedAt: now,
  };

  const database = getDb();
  database.prepare(`
    INSERT INTO sessions (id, transcript, mode, messages, suggestions, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    session.id,
    session.transcript,
    session.mode,
    JSON.stringify(session.messages),
    JSON.stringify(session.suggestions),
    session.createdAt,
    session.updatedAt
  );

  return session;
}

export function getSession(id: string): Session | null {
  const database = getDb();
  const row = database.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as {
    id: string;
    transcript: string;
    mode: string;
    messages: string;
    suggestions: string;
    created_at: string;
    updated_at: string;
  } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    transcript: row.transcript,
    mode: row.mode as AnalysisMode,
    messages: JSON.parse(row.messages) as ChatMessage[],
    suggestions: JSON.parse(row.suggestions) as AnimationSuggestion[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function updateSession(
  id: string,
  updates: {
    messages?: ChatMessage[];
    suggestions?: AnimationSuggestion[];
  }
): Session | null {
  const session = getSession(id);
  if (!session) return null;

  const now = new Date().toISOString();
  const database = getDb();

  if (updates.messages !== undefined) {
    database.prepare('UPDATE sessions SET messages = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(updates.messages), now, id);
  }

  if (updates.suggestions !== undefined) {
    database.prepare('UPDATE sessions SET suggestions = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(updates.suggestions), now, id);
  }

  return getSession(id);
}

export function addMessage(
  sessionId: string,
  message: ChatMessage
): Session | null {
  const session = getSession(sessionId);
  if (!session) return null;

  const messages = [...session.messages, message];
  return updateSession(sessionId, { messages });
}

export function getAllSessions(): Session[] {
  const database = getDb();
  const rows = database.prepare('SELECT * FROM sessions ORDER BY updated_at DESC').all() as Array<{
    id: string;
    transcript: string;
    mode: string;
    messages: string;
    suggestions: string;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map(row => ({
    id: row.id,
    transcript: row.transcript,
    mode: row.mode as AnalysisMode,
    messages: JSON.parse(row.messages) as ChatMessage[],
    suggestions: JSON.parse(row.suggestions) as AnimationSuggestion[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function deleteSession(id: string): boolean {
  const database = getDb();
  const result = database.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  return result.changes > 0;
}

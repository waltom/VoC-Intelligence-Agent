-- VoC Intelligence Agent - initial schema
-- D1 / SQLite

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS analyses (
  id              TEXT PRIMARY KEY,
  business_name   TEXT NOT NULL,
  business_url    TEXT,
  competitors     TEXT,                       -- JSON array of strings
  status          TEXT NOT NULL DEFAULT 'pending',
  source_mode     TEXT NOT NULL DEFAULT 'auto', -- 'auto' | 'manual_paste'
  created_at      INTEGER NOT NULL,           -- unix epoch ms
  completed_at    INTEGER,
  summary_json    TEXT,
  error           TEXT,
  tokens_used     INTEGER NOT NULL DEFAULT 0,
  cost_estimate_usd REAL  NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses(created_at);
CREATE INDEX IF NOT EXISTS idx_analyses_status     ON analyses(status);

CREATE TABLE IF NOT EXISTS reviews (
  id            TEXT PRIMARY KEY,
  analysis_id   TEXT NOT NULL,
  source        TEXT NOT NULL,                -- 'trustpilot' | 'opineo' | 'appstore' | 'manual' | ...
  source_url    TEXT,
  author        TEXT,
  rating        REAL,
  content       TEXT NOT NULL,
  posted_at     INTEGER,                      -- unix epoch ms
  language      TEXT,
  sentiment     TEXT,                         -- 'positive' | 'neutral' | 'negative'
  category      TEXT,                         -- price | service | quality | delivery | ux | communication | other
  embedding_ref TEXT,                         -- Vectorize id
  raw_json      TEXT,
  FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reviews_analysis_id ON reviews(analysis_id);
CREATE INDEX IF NOT EXISTS idx_reviews_source      ON reviews(source);
CREATE INDEX IF NOT EXISTS idx_reviews_sentiment   ON reviews(sentiment);
CREATE INDEX IF NOT EXISTS idx_reviews_category    ON reviews(category);

CREATE TABLE IF NOT EXISTS cache (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  expires_at  INTEGER NOT NULL                -- unix epoch seconds
);

CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache(expires_at);

CREATE TABLE IF NOT EXISTS events (
  id            TEXT PRIMARY KEY,
  analysis_id   TEXT NOT NULL,
  step          TEXT NOT NULL,                -- init | discover | scrape | classify | embed | synthesize | report | error
  status        TEXT NOT NULL,                -- started | progress | completed | failed
  message       TEXT,
  payload_json  TEXT,
  created_at    INTEGER NOT NULL,
  FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_events_analysis_id ON events(analysis_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at  ON events(created_at);

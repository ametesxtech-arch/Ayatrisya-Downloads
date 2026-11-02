-- Ayatrisya Cloud Storage System: D1 Database Initial Schema
-- Parent: Ametesx / Ayatrisya AI
-- Migration: 0001_initial_storage_schema.sql

-- 1. User Quotas and Storage Accounting
CREATE TABLE IF NOT EXISTS user_quotas (
    owner_id TEXT PRIMARY KEY,
    max_bytes INTEGER NOT NULL DEFAULT 524288000,   -- 500 MB default free tier
    used_bytes INTEGER NOT NULL DEFAULT 0,
    max_records INTEGER NOT NULL DEFAULT 10000,
    record_count INTEGER NOT NULL DEFAULT 0,
    tier TEXT NOT NULL DEFAULT 'free',
    updated_at TEXT NOT NULL
);

-- 2. Knowledge Bases (KB)
CREATE TABLE IF NOT EXISTS knowledge_bases (
    id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '[]', -- JSON array of strings
    document_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (owner_id, id)
);

CREATE INDEX IF NOT EXISTS idx_kb_owner_updated ON knowledge_bases (owner_id, updated_at DESC);

-- 3. Seed Memories (Persistent AI Context / Preferences)
CREATE TABLE IF NOT EXISTS seed_memories (
    id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    kb_id TEXT, -- Optional foreign link to knowledge_bases(id)
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'fact', -- fact, preference, context, instruction, code_snippet
    content TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 1.0,
    pinned INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (owner_id, id)
);

CREATE INDEX IF NOT EXISTS idx_seeds_owner_kb ON seed_memories (owner_id, kb_id);
CREATE INDEX IF NOT EXISTS idx_seeds_owner_pinned ON seed_memories (owner_id, pinned DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_seeds_owner_category ON seed_memories (owner_id, category);

-- 4. Cloud Files Metadata (Object References in R2)
CREATE TABLE IF NOT EXISTS cloud_files (
    id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    r2_key TEXT NOT NULL,
    sha256 TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (owner_id, id)
);

CREATE INDEX IF NOT EXISTS idx_files_owner_created ON cloud_files (owner_id, created_at DESC);

-- 5. Storage Operation Audit / Pending Uploads (Anti-Orphan Tracker)
CREATE TABLE IF NOT EXISTS pending_uploads (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    r2_key TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'initiated', -- initiated, uploading, completed, aborted
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pending_owner ON pending_uploads (owner_id);
CREATE INDEX IF NOT EXISTS idx_pending_expires ON pending_uploads (expires_at);
CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_uploads (status);

-- 6. System Storage Global Accounting & Capacity Guard
-- Free tier R2 max storage is 10 GB (10,737,418,240 bytes)
-- Reserved capacity threshold: 90% (e.g. 9,663,676,416 bytes)
CREATE TABLE IF NOT EXISTS system_storage_state (
    id TEXT PRIMARY KEY DEFAULT 'global',
    total_stored_bytes INTEGER NOT NULL DEFAULT 0,
    max_global_bytes INTEGER NOT NULL DEFAULT 10737418240, -- 10 GB Free Tier Total
    reserved_threshold_ratio REAL NOT NULL DEFAULT 0.90,   -- 90% soft capacity ceiling
    total_files_count INTEGER NOT NULL DEFAULT 0,
    total_users_count INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
);

-- 7. Cloud Conversations and Messages
CREATE TABLE IF NOT EXISTS cloud_conversations (
    id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    title TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'Normal', -- Normal, Savage, Joke
    pinned INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (owner_id, id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_owner_updated ON cloud_conversations (owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS cloud_messages (
    id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL, -- user, assistant
    content TEXT NOT NULL,
    attachment_ids TEXT NOT NULL DEFAULT '[]', -- JSON array of file UUIDs
    model_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (owner_id, id)
);

CREATE INDEX IF NOT EXISTS idx_messages_owner_conv ON cloud_messages (owner_id, conversation_id, created_at ASC);



-- Migration pour ajouter les tables nécessaires aux fonctionnalités IA

-- Table pour stocker les embeddings vectoriels
CREATE TABLE IF NOT EXISTS note_embeddings (
    note_id INTEGER PRIMARY KEY,
    embedding TEXT NOT NULL,
    model TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (note_id) REFERENCES entries(id) ON DELETE CASCADE
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_embeddings_updated ON note_embeddings(updated_at);

-- Table pour le rate limiting
CREATE TABLE IF NOT EXISTS ai_rate_limits (
    identifier TEXT NOT NULL,
    date TEXT NOT NULL,
    count INTEGER DEFAULT 1,
    last_request DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (identifier, date)
);

-- Index pour le rate limiting
CREATE INDEX IF NOT EXISTS idx_rate_limits_date ON ai_rate_limits(date);

-- Table pour stocker les informations extraites (optionnel)
CREATE TABLE IF NOT EXISTS note_extracted_info (
    note_id INTEGER PRIMARY KEY,
    dates TEXT,
    tasks TEXT,
    people TEXT,
    topics TEXT,
    keywords TEXT,
    extracted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (note_id) REFERENCES entries(id) ON DELETE CASCADE
);

-- Ajouter les paramètres IA dans la table settings
INSERT OR IGNORE INTO settings (key, value) VALUES 
    ('ai_enabled', '0'),
    ('ai_feature_semantic_search', '0'),
    ('ai_feature_generation', '0'),
    ('ai_feature_tagging', '0'),
    ('ai_feature_related_notes', '0'),
    ('ai_feature_extraction', '0');


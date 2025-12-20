<?php

// SQLite connection
try {
    // Ensure the database directory exists
    $dbPath = SQLITE_DATABASE;
    $dbDir = dirname($dbPath);
    
    // Create directory if it doesn't exist
    if (!is_dir($dbDir)) {
        if (!mkdir($dbDir, 0775, true)) {
            error_log("Failed to create database directory: $dbDir");
            throw new PDOException("Cannot create database directory: $dbDir");
        }
        // Try to set ownership if running as root (Docker context)
        if (function_exists('posix_getuid') && posix_getuid() === 0) {
            @chown($dbDir, 'www-data');
            @chgrp($dbDir, 'www-data');
        }
    }
    
    // Ensure directory is writable
    if (!is_writable($dbDir)) {
        error_log("Database directory is not writable: $dbDir");
        // Try to fix permissions with more permissive settings (777 for Railway volumes)
        @chmod($dbDir, 0777);
        if (function_exists('posix_getuid') && posix_getuid() === 0) {
            @chown($dbDir, 'www-data');
            @chgrp($dbDir, 'www-data');
        }
        // Also try to fix parent directory
        $parentDir = dirname($dbDir);
        if (is_dir($parentDir) && !is_writable($parentDir)) {
            @chmod($parentDir, 0777);
        }
        // Check again
        if (!is_writable($dbDir)) {
            // Last attempt: check if we can at least create files
            $testFile = $dbDir . '/.test_write_' . time();
            if (@touch($testFile)) {
                @unlink($testFile);
                error_log("Can create files in $dbDir, proceeding despite is_writable() check");
            } else {
                throw new PDOException("Database directory is not writable: $dbDir (permissions: " . substr(sprintf('%o', fileperms($dbDir)), -4) . ")");
            }
        }
    }
    
    // Create database file if it doesn't exist
    if (!file_exists($dbPath)) {
        if (!touch($dbPath)) {
            error_log("Failed to create database file: $dbPath");
            throw new PDOException("Cannot create database file: $dbPath");
        }
        // Use more permissive permissions for Railway volumes
        @chmod($dbPath, 0666);
        if (function_exists('posix_getuid') && posix_getuid() === 0) {
            @chown($dbPath, 'www-data');
            @chgrp($dbPath, 'www-data');
        }
    } else {
        // Ensure existing file is writable
        if (!is_writable($dbPath)) {
            @chmod($dbPath, 0666);
            if (function_exists('posix_getuid') && posix_getuid() === 0) {
                @chown($dbPath, 'www-data');
                @chgrp($dbPath, 'www-data');
            }
        }
    }
    
    $con = new PDO('sqlite:' . $dbPath);
    $con->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $con->exec('PRAGMA foreign_keys = ON');
        
    // Register custom SQLite function to clean HTML content for search
    $con->sqliteCreateFunction('search_clean_entry', function($html) {
        if (empty($html)) {
            return '';
        }
        
        // Remove Excalidraw containers with their data-excalidraw attributes and base64 images
        $html = preg_replace(
            '/<div[^>]*class="excalidraw-container"[^>]*>.*?<\/div>/s',
            '[Excalidraw diagram]',
            $html
        );
        
        // Remove any remaining base64 image data
        $html = preg_replace('/data:image\/[^;]+;base64,[A-Za-z0-9+\/=]+/', '[image]', $html);
        
        // Strip remaining HTML tags but keep the text content
        $text = strip_tags($html);
        
        // Clean up extra whitespace
        $text = preg_replace('/\s+/', ' ', $text);
        $text = trim($text);
        
        return $text;
    }, 1);
    
    // Create entries table
    $con->exec('CREATE TABLE IF NOT EXISTS entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trash INTEGER DEFAULT 0,
        heading TEXT,
        subheading TEXT,
        location TEXT,
        entry TEXT,
        created DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated DATETIME,
        tags TEXT,
        folder TEXT DEFAULT "Default",
        folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
        workspace TEXT DEFAULT "Poznote",
        favorite INTEGER DEFAULT 0,
        attachments TEXT,
        type TEXT DEFAULT "note"
    )');

    // Create folders table for empty folders (scoped by workspace)
    $con->exec('CREATE TABLE IF NOT EXISTS folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        workspace TEXT DEFAULT "Poznote",
        parent_id INTEGER DEFAULT NULL,
        created DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
    )');

    // Ensure unique folder names per workspace and parent
    // For subfolders (parent_id IS NOT NULL): same name allowed in different parents
    $con->exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_name_workspace_parent_notnull 
                ON folders(name, workspace, parent_id) 
                WHERE parent_id IS NOT NULL');
    
    // For root folders (parent_id IS NULL): same name NOT allowed
    $con->exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_name_workspace_root 
                ON folders(name, workspace) 
                WHERE parent_id IS NULL');

    // Create workspaces table
    $con->exec('CREATE TABLE IF NOT EXISTS workspaces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        created DATETIME DEFAULT CURRENT_TIMESTAMP
    )');

    // Insert default workspace
    $con->exec("INSERT OR IGNORE INTO workspaces (name) VALUES ('Poznote')");

    // Create settings table for configuration
    $con->exec('CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )');

    // Table for public shared notes (token based)
    $con->exec('CREATE TABLE IF NOT EXISTS shared_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        note_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        created DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires DATETIME,
        FOREIGN KEY(note_id) REFERENCES entries(id) ON DELETE CASCADE
    )');

    // Set default settings
    $con->exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('note_font_size', '15')");
    $con->exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('emoji_icons_enabled', '1')");
    // Controls to show/hide metadata under note title in notes list (enabled by default)
    $con->exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('show_note_created', '1')");
    // Renamed setting: show_note_subheading (was show_note_location)
    $con->exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('show_note_subheading', '1')");
    // Folder counts hidden by default
    $con->exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('hide_folder_counts', '0')");

    // Ensure required data directories exist
    // $dbDir points to data/database, so we need to go up one level to get data/
    $dataDir = dirname($dbDir);
    $requiredDirs = ['attachments', 'database', 'entries'];
    foreach ($requiredDirs as $dir) {
        $fullPath = $dataDir . '/' . $dir;
        if (!is_dir($fullPath)) {
            if (!mkdir($fullPath, 0755, true)) {
                error_log("Failed to create directory: $fullPath");
                continue;
            }
            // Set proper ownership if running as root (Docker context)
            if (function_exists('posix_getuid') && posix_getuid() === 0) {
                chown($fullPath, 'www-data');
                chgrp($fullPath, 'www-data');
            }
        }
    }

    // Create welcome note and Getting Started folder if no notes exist (first installation)
    try {
        // Check if ANY notes exist (including in trash) - only create welcome note on true first installation
        $totalNoteCount = $con->query("SELECT COUNT(*) FROM entries")->fetchColumn();
        
        if ($totalNoteCount == 0) {
            // Create "Getting Started" folder first
            $con->exec("INSERT OR IGNORE INTO folders (name, workspace, created) VALUES ('Getting Started', 'Poznote', datetime('now'))");
            
            // Get the folder ID
            $folderStmt = $con->query("SELECT id FROM folders WHERE name = 'Getting Started' AND workspace = 'Poznote'");
            $folderData = $folderStmt->fetch(PDO::FETCH_ASSOC);
            $folderId = $folderData ? (int)$folderData['id'] : null;
            
            // Create welcome note content (kept in a separate template file)
            $welcomeTemplateFile = __DIR__ . '/welcome_note.html';
            $welcomeContent = @file_get_contents($welcomeTemplateFile);

            // Fallback in case the template file is missing
            if ($welcomeContent === false || trim($welcomeContent) === '') {
                $welcomeContent = '<p>Welcome to Poznote.</p>';
            }

            // Insert the welcome note
            $now_utc = gmdate('Y-m-d H:i:s', time());
            $stmt = $con->prepare("INSERT INTO entries (heading, entry, folder, folder_id, workspace, type, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute(['👋 Welcome to Poznote', '', 'Getting Started', $folderId, 'Poznote', 'note', $now_utc, $now_utc]);
            
            $welcomeNoteId = $con->lastInsertId();
            
            // Create the HTML file for the welcome note
            $dataDir = dirname($dbDir);
            $entriesDir = $dataDir . '/entries';
            if (!is_dir($entriesDir)) {
                mkdir($entriesDir, 0755, true);
            }
            
            $welcomeFile = $entriesDir . '/' . $welcomeNoteId . '.html';
            file_put_contents($welcomeFile, $welcomeContent);
            chmod($welcomeFile, 0644);
            
            // Set proper ownership if running as root
            if (function_exists('posix_getuid') && posix_getuid() === 0) {
                chown($welcomeFile, 'www-data');
                chgrp($welcomeFile, 'www-data');
            }
        }
    } catch(Exception $e) {
        // Log error but don't fail database connection
        error_log("Failed to create welcome note: " . $e->getMessage());
    }
    
    // Create AI-related tables if they don't exist
    try {
        // Table pour stocker les embeddings vectoriels
        $con->exec("
            CREATE TABLE IF NOT EXISTS note_embeddings (
                note_id INTEGER PRIMARY KEY,
                embedding TEXT NOT NULL,
                model TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (note_id) REFERENCES entries(id) ON DELETE CASCADE
            )
        ");
        
        $con->exec("
            CREATE INDEX IF NOT EXISTS idx_embeddings_updated ON note_embeddings(updated_at)
        ");
        
        // Table pour le rate limiting
        $con->exec("
            CREATE TABLE IF NOT EXISTS ai_rate_limits (
                identifier TEXT NOT NULL,
                date TEXT NOT NULL,
                count INTEGER DEFAULT 1,
                last_request DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (identifier, date)
            )
        ");
        
        $con->exec("
            CREATE INDEX IF NOT EXISTS idx_rate_limits_date ON ai_rate_limits(date)
        ");
        
        // Table pour stocker les informations extraites (optionnel)
        $con->exec("
            CREATE TABLE IF NOT EXISTS note_extracted_info (
                note_id INTEGER PRIMARY KEY,
                dates TEXT,
                tasks TEXT,
                people TEXT,
                topics TEXT,
                keywords TEXT,
                extracted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (note_id) REFERENCES entries(id) ON DELETE CASCADE
            )
        ");
        
        // Ajouter les paramètres IA dans la table settings
        $con->exec("INSERT OR IGNORE INTO settings (key, value) VALUES 
            ('ai_enabled', '0'),
            ('ai_feature_semantic_search', '0'),
            ('ai_feature_generation', '0'),
            ('ai_feature_tagging', '0'),
            ('ai_feature_related_notes', '0'),
            ('ai_feature_extraction', '0'),
            ('ai_rate_limit', '200')");
    } catch(Exception $e) {
        // Log error but don't fail database connection
        error_log("Failed to create AI tables: " . $e->getMessage());
    }

} catch(PDOException $e) {
    die("Connection failed: " . $e->getMessage());
}

?>

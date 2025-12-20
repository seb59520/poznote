<?php
date_default_timezone_set('UTC');

/**
 * Get the user's configured timezone from the database
 * Returns 'UTC' if no timezone is configured
 * @return string The timezone identifier (e.g., 'Europe/Paris')
 */
function getUserTimezone() {
    global $con;
    try {
        if (isset($con)) {
            $stmt = $con->prepare('SELECT value FROM settings WHERE key = ?');
            $stmt->execute(['timezone']);
            $timezone = $stmt->fetchColumn();
            if ($timezone && $timezone !== '') {
                return $timezone;
            }
        }
    } catch (Exception $e) {
        // Ignore errors
    }
    return defined('DEFAULT_TIMEZONE') ? DEFAULT_TIMEZONE : 'UTC';
}

/**
 * Convert a UTC datetime string to the user's configured timezone
 * @param string $utcDatetime The UTC datetime string (e.g., '2025-11-07 10:52:00')
 * @param string $format The output format (default: 'Y-m-d H:i:s')
 * @return string The datetime in the user's timezone
 */
function convertUtcToUserTimezone($utcDatetime, $format = 'Y-m-d H:i:s') {
    if (empty($utcDatetime)) return '';
    try {
        $userTz = getUserTimezone();
        $date = new DateTime($utcDatetime, new DateTimeZone('UTC'));
        $date->setTimezone(new DateTimeZone($userTz));
        return $date->format($format);
    } catch (Exception $e) {
        return $utcDatetime; // Return original on error
    }
}

function formatDate($t) {
	return date('j M Y',$t);
}

function formatDateTime($t) {
	return formatDate($t)." à ".date('H:i',$t);
}

/**
 * Get the entries directory path
 */
function getEntriesPath() {
    return __DIR__ . '/data/entries';
}

/**
 * Get the attachments directory path
 */
function getAttachmentsPath() {
    return __DIR__ . '/data/attachments';
}

/**
 * Get the appropriate file extension based on note type
 * @param string $type The note type (note, markdown, tasklist)
 * @return string The file extension (.md or .html)
 */
function getFileExtensionForType($type) {
    return ($type === 'markdown') ? '.md' : '.html';
}

/**
 * Get the full filename for a note entry
 * @param int $id The note ID
 * @param string $type The note type
 * @return string The complete filename with path and extension
 */
function getEntryFilename($id, $type) {
    $extension = getFileExtensionForType($type);
    return getEntriesPath() . '/' . $id . $extension;
}

/**
 * Get the current workspace filter from GET/POST parameters
 * Priority order:
 * 1. GET/POST parameter (highest priority)
 * 2. Database setting 'default_workspace' (if set to a specific workspace name)
 *    Special value '__last_opened__' means use localStorage
 * 3. localStorage 'poznote_selected_workspace' (handled by index.php redirect)
 * 4. Fallback to 'Poznote' (default)
 * 
 * @return string The workspace name
 */
function getWorkspaceFilter() {
    // First check URL parameters
    if (isset($_GET['workspace'])) {
        return $_GET['workspace'];
    }
    if (isset($_POST['workspace'])) {
        return $_POST['workspace'];
    }
    
    // If no parameter, check for default workspace setting in database
    global $con;
    if (isset($con)) {
        try {
            $stmt = $con->prepare('SELECT value FROM settings WHERE key = ?');
            $stmt->execute(['default_workspace']);
            $defaultWorkspace = $stmt->fetchColumn();
            if ($defaultWorkspace !== false && $defaultWorkspace !== '') {
                return $defaultWorkspace;
            }
        } catch (Exception $e) {
            // If settings table doesn't exist or query fails, continue to default
        }
    }
    
    // Final fallback
    // Note: localStorage is checked by index.php before this function is called
    return 'Poznote';
}

/**
 * Generate a unique note title to prevent duplicates
 * Default to "New note" when empty.
 * If a title already exists, add a numeric suffix like " (1)", " (2)", ...
 */
function generateUniqueTitle($originalTitle, $excludeId = null, $workspace = null, $folder_id = null) {
    global $con;
    
    // Clean the original title
    $title = trim($originalTitle);
    if (empty($title)) {
        $title = 'New note';
    }
    
    // Check if title already exists (excluding the current note if updating)
    // Uniqueness is scoped to folder + workspace
    $query = "SELECT COUNT(*) FROM entries WHERE heading = ? AND trash = 0";
    $params = [$title];

    // Check uniqueness within the same folder
    if ($folder_id !== null) {
        $query .= " AND folder_id = ?";
        $params[] = $folder_id;
    } else {
        $query .= " AND folder_id IS NULL";
    }

    // If workspace specified, restrict uniqueness to that workspace
    if ($workspace !== null) {
        $query .= " AND (workspace = ? OR (workspace IS NULL AND ? = 'Poznote'))";
        $params[] = $workspace;
        $params[] = $workspace;
    }
    
    if ($excludeId !== null) {
        $query .= " AND id != ?";
        $params[] = $excludeId;
    }
    
    $stmt = $con->prepare($query);
    $stmt->execute($params);
    $count = $stmt->fetchColumn();
    
    // If no duplicate, return the title as is
    if ($count == 0) {
        return $title;
    }
    
    // If duplicate exists, add a number suffix
    $counter = 1;
    $baseTitle = $title;
    
    do {
        $title = $baseTitle . ' (' . $counter . ')';
        
    $stmt = $con->prepare($query);
    $params[0] = $title; // Update the title in params
    $stmt->execute($params);
        $count = $stmt->fetchColumn();
        
        $counter++;
    } while ($count > 0);
    
    return $title;
}

/**
 * Create a new note with both database entry and HTML file
 * This is the standard way to create notes used throughout the application
 */
function createNote($con, $heading, $content, $folder = 'Default', $workspace = 'Poznote', $favorite = 0, $tags = '', $type = 'note') {
    try {
        // Get folder_id from folder name
        $folder_id = null;
        if ($folder !== null) {
            $fStmt = $con->prepare("SELECT id FROM folders WHERE name = ? AND (workspace = ? OR (workspace IS NULL AND ? = 'Poznote'))");
            $fStmt->execute([$folder, $workspace, $workspace]);
            $folderData = $fStmt->fetch(PDO::FETCH_ASSOC);
            if ($folderData) {
                $folder_id = (int)$folderData['id'];
            }
        }
        
        // Insert note into database
        $stmt = $con->prepare("INSERT INTO entries (heading, entry, tags, folder, folder_id, workspace, type, favorite, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))");
        
        if (!$stmt->execute([$heading, $content, $tags, $folder, $folder_id, $workspace, $type, $favorite])) {
            return ['success' => false, 'error' => 'Failed to insert note into database'];
        }
        
        $noteId = $con->lastInsertId();
        
        // Create the file for the note content with appropriate extension
        $filename = getEntryFilename($noteId, $type);
        
        // Ensure the entries directory exists
        $entriesDir = dirname($filename);
        if (!is_dir($entriesDir)) {
            mkdir($entriesDir, 0755, true);
        }
        
        // Write content to file
        if (!empty($content)) {
            $write_result = file_put_contents($filename, $content);
            if ($write_result === false) {
                // Log error but don't fail since DB entry was successful
                error_log("Failed to write file for note ID $noteId: $filename");
                return ['success' => false, 'error' => 'Failed to create HTML file', 'id' => $noteId];
            }
            
            // Set proper permissions
            chmod($filename, 0644);
            
            // Set proper ownership if running as root (Docker context)
            if (function_exists('posix_getuid') && posix_getuid() === 0) {
                chown($filename, 'www-data');
                chgrp($filename, 'www-data');
            }
        }
        
        return ['success' => true, 'id' => $noteId];
        
    } catch (Exception $e) {
        error_log("Error creating note: " . $e->getMessage());
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

/**
 * Restore a complete backup from ZIP file
 * Handles database, notes, and attachments restoration
 */
function restoreCompleteBackup($uploadedFile, $isLocalFile = false) {
    // Check file type
    if (!preg_match('/\.zip$/i', $uploadedFile['name'])) {
        return ['success' => false, 'error' => 'File type not allowed. Use a .zip file'];
    }
    
    $tempFile = '/tmp/poznote_complete_restore_' . uniqid() . '.zip';
    $tempExtractDir = null;
    
    try {
        // Move/copy uploaded file
        if ($isLocalFile) {
            // For locally created files (like from chunked upload)
            if (!copy($uploadedFile['tmp_name'], $tempFile)) {
                return ['success' => false, 'error' => 'Error copying local file'];
            }
        } else {
            // For HTTP uploaded files
            if (!move_uploaded_file($uploadedFile['tmp_name'], $tempFile)) {
                return ['success' => false, 'error' => 'Error uploading file'];
            }
        }
        
        // Extract ZIP to temporary directory
        $tempExtractDir = '/tmp/poznote_restore_' . uniqid();
        if (!mkdir($tempExtractDir, 0755, true)) {
            unlink($tempFile);
            return ['success' => false, 'error' => 'Cannot create temporary directory'];
        }
        
        // Ensure required data directories exist
        $dataDir = dirname(__DIR__) . '/data';
        $requiredDirs = ['attachments', 'database', 'entries'];
        foreach ($requiredDirs as $dir) {
            $fullPath = $dataDir . '/' . $dir;
            if (!is_dir($fullPath)) {
                mkdir($fullPath, 0755, true);
                // Set proper ownership if running as root (Docker context)
                if (function_exists('posix_getuid') && posix_getuid() === 0) {
                    $current_uid = posix_getuid();
                    $current_gid = posix_getgid();
                    chown($fullPath, $current_uid);
                    chgrp($fullPath, $current_gid);
                }
            }
        }
        
        $zip = new ZipArchive;
        $res = $zip->open($tempFile);
        
        if ($res !== TRUE) {
            unlink($tempFile);
            rmdir($tempExtractDir);
            return ['success' => false, 'error' => 'Cannot open ZIP file'];
        }
        
        // Check ZIP contents before extracting
        $zipContents = [];
        $hasDatabase = false;
        $hasEntries = false;
        $hasAttachments = false;
        
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $filename = $zip->getNameIndex($i);
            $zipContents[] = $filename;
            
            if (strpos($filename, 'database/poznote_backup.sql') !== false) {
                $hasDatabase = true;
            }
            if (strpos($filename, 'entries/') === 0 && !str_ends_with($filename, '/')) {
                $hasEntries = true;
            }
            if (strpos($filename, 'attachments/') === 0 && !str_ends_with($filename, '/')) {
                $hasAttachments = true;
            }
        }
        
        // Warn if backup seems empty or invalid
        if (!$hasDatabase && !$hasEntries && !$hasAttachments) {
            $zip->close();
            unlink($tempFile);
            deleteDirectory($tempExtractDir);
            return [
                'success' => false, 
                'error' => 'Backup file appears to be empty or invalid. No database, entries, or attachments found.',
                'message' => 'ZIP contents: ' . (empty($zipContents) ? 'empty' : implode(', ', array_slice($zipContents, 0, 10)) . (count($zipContents) > 10 ? '...' : ''))
            ];
        }
        
        $zip->extractTo($tempExtractDir);
        $zip->close();
        unlink($tempFile);
        $tempFile = null; // Mark as cleaned

        // CLEAR ENTRIES DIRECTORY BEFORE RESTORATION (only if we have entries to restore)
        if ($hasEntries) {
            $entriesPath = getEntriesPath();
            if (is_dir($entriesPath)) {
                // Delete all files in entries directory
                $files = new RecursiveIteratorIterator(
                    new RecursiveDirectoryIterator($entriesPath, RecursiveDirectoryIterator::SKIP_DOTS),
                    RecursiveIteratorIterator::CHILD_FIRST
                );
                
                $entriesCleared = 0;
                foreach ($files as $fileinfo) {
                    $todo = ($fileinfo->isDir() ? 'rmdir' : 'unlink');
                    $todo($fileinfo->getRealPath());
                    $entriesCleared++;
                }
                error_log("CLEARED $entriesCleared files from entries directory");
            } else {
                // Create entries directory if it doesn't exist
                mkdir($entriesPath, 0755, true);
                if (function_exists('posix_getuid') && posix_getuid() === 0) {
                    $current_uid = posix_getuid();
                    $current_gid = posix_getgid();
                    chown($entriesPath, $current_uid);
                    chgrp($entriesPath, $current_gid);
                }
            }
        }
        
        // CLEAR ATTACHMENTS DIRECTORY BEFORE RESTORATION (only if we have attachments to restore)
        if ($hasAttachments) {
            $attachmentsPath = getAttachmentsPath();
            if (is_dir($attachmentsPath)) {
                // Delete all files in attachments directory
                $files = new RecursiveIteratorIterator(
                    new RecursiveDirectoryIterator($attachmentsPath, RecursiveDirectoryIterator::SKIP_DOTS),
                    RecursiveIteratorIterator::CHILD_FIRST
                );
                
                $attachmentsCleared = 0;
                foreach ($files as $fileinfo) {
                    $todo = ($fileinfo->isDir() ? 'rmdir' : 'unlink');
                    $todo($fileinfo->getRealPath());
                    $attachmentsCleared++;
                }
                error_log("CLEARED $attachmentsCleared files from attachments directory");
            } else {
                // Create attachments directory if it doesn't exist
                mkdir($attachmentsPath, 0755, true);
                if (function_exists('posix_getuid') && posix_getuid() === 0) {
                    $current_uid = posix_getuid();
                    $current_gid = posix_getgid();
                    chown($attachmentsPath, $current_uid);
                    chgrp($attachmentsPath, $current_gid);
                }
            }
        }
        
        $results = [];
        $hasErrors = false;
        
        // Restore database if SQL file exists
        $sqlFile = $tempExtractDir . '/database/poznote_backup.sql';
        if (file_exists($sqlFile)) {
            $dbResult = restoreDatabaseFromFile($sqlFile);
            $results[] = 'Database: ' . ($dbResult['success'] ? 'Restored successfully' : 'Failed - ' . $dbResult['error']);
            if (!$dbResult['success']) $hasErrors = true;
            // Note: Schema migration is now handled inside restoreDatabaseFromFile()
        } else {
            if ($hasDatabase) {
                $results[] = 'Database: SQL file expected but not found after extraction';
                $hasErrors = true;
            } else {
                $results[] = 'Database: No SQL file found in backup (skipped)';
            }
        }
        
        // Restore entries if entries directory exists in backup
        $entriesDir = $tempExtractDir . '/entries';
        if (is_dir($entriesDir)) {
            $entriesResult = restoreEntriesFromDir($entriesDir);
            if ($entriesResult['success']) {
                $msg = 'Restored ' . $entriesResult['count'] . ' file(s)';
                if (isset($entriesResult['created']) && $entriesResult['created'] > 0) {
                    $msg .= ', created ' . $entriesResult['created'] . ' database entry(ies)';
                }
                if (isset($entriesResult['errors']) && !empty($entriesResult['errors'])) {
                    $msg .= ', ' . count($entriesResult['errors']) . ' error(s)';
                }
                $results[] = 'Notes: ' . $msg;
            } else {
                $results[] = 'Notes: Failed - ' . ($entriesResult['error'] ?? 'Unknown error');
                $hasErrors = true;
            }
            if (isset($entriesResult['errors']) && !empty($entriesResult['errors'])) {
                $hasErrors = true;
            }
        } else {
            if ($hasEntries) {
                $results[] = 'Notes: Entries directory expected but not found after extraction';
                $hasErrors = true;
            } else {
                $results[] = 'Notes: No entries directory found in backup (skipped - existing entries preserved)';
            }
        }
        
        // Restore attachments if attachments directory exists in backup
        $attachmentsDir = $tempExtractDir . '/attachments';
        if (is_dir($attachmentsDir)) {
            $attachmentsResult = restoreAttachmentsFromDir($attachmentsDir);
            $results[] = 'Attachments: ' . ($attachmentsResult['success'] ? 'Restored ' . $attachmentsResult['count'] . ' files' : 'Failed - ' . $attachmentsResult['error']);
            if (!$attachmentsResult['success']) $hasErrors = true;
        } else {
            if ($hasAttachments) {
                $results[] = 'Attachments: Attachments directory expected but not found after extraction';
                $hasErrors = true;
            } else {
                $results[] = 'Attachments: No attachments directory found in backup (skipped - existing attachments preserved)';
            }
        }
        
        // Clean up temporary directory
        deleteDirectory($tempExtractDir);
        $tempExtractDir = null; // Mark as cleaned
        
        // Ensure proper permissions after restoration
        ensureDataPermissions();
        
        return [
            'success' => !$hasErrors,
            'message' => implode('; ', $results),
            'error' => $hasErrors ? 'Some components failed to restore' : ''
        ];
        
    } catch (Exception $e) {
        // Clean up on error
        if ($tempFile && file_exists($tempFile)) {
            unlink($tempFile);
        }
        if ($tempExtractDir && is_dir($tempExtractDir)) {
            deleteDirectory($tempExtractDir);
        }
        return ['success' => false, 'error' => 'Exception during restore: ' . $e->getMessage()];
    }
}

/**
 * Restore database from SQL file
 */
function restoreDatabaseFromFile($sqlFile) {
    $content = file_get_contents($sqlFile);
    if (!$content) {
        return ['success' => false, 'error' => 'Cannot read SQL file'];
    }
    
    $dbPath = SQLITE_DATABASE;
    
    // Remove current database
    if (file_exists($dbPath)) {
        unlink($dbPath);
    }
    
    // Restore database
    $command = "sqlite3 {$dbPath} < {$sqlFile} 2>&1";
    
    exec($command, $output, $returnCode);
    
    if ($returnCode === 0) {
        // Ensure proper permissions on restored database
        if (function_exists('posix_getuid') && posix_getuid() === 0) {
            $current_uid = posix_getuid();
            $current_gid = posix_getgid();
            chown($dbPath, $current_uid);
            chgrp($dbPath, $current_gid);
        }
        chmod($dbPath, 0664);
        
        return ['success' => true];
    } else {
        $errorMessage = implode("\n", $output);
        return ['success' => false, 'error' => $errorMessage];
    }
}

// Note: schema migrations are handled at runtime by db_connect.php

/**
 * Restore entries from directory
 */
function restoreEntriesFromDir($sourceDir) {
    global $con;
    $entriesPath = getEntriesPath();
    
    if (!$entriesPath || !is_dir($entriesPath)) {
        return ['success' => false, 'error' => 'Cannot find entries directory'];
    }
    
    // Ensure entries directory is writable
    if (!is_writable($entriesPath)) {
        @chmod($entriesPath, 0775);
    }
    
    $files = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($sourceDir), 
        RecursiveIteratorIterator::LEAVES_ONLY
    );
    
    $importedCount = 0;
    $createdCount = 0;
    $errors = [];
    
    foreach ($files as $name => $file) {
        if (!$file->isDir()) {
            $filePath = $file->getRealPath();
            $relativePath = substr($filePath, strlen($sourceDir) + 1);
            $extension = pathinfo($relativePath, PATHINFO_EXTENSION);
            
            // Include both HTML and Markdown files
            if ($extension === 'html' || $extension === 'md') {
                $filename = basename($relativePath);
                $targetFile = $entriesPath . '/' . $filename;
                
                // Extract note ID from filename (e.g., "123.html" -> 123)
                $noteId = (int)pathinfo($filename, PATHINFO_FILENAME);
                
                // Read file content
                $content = file_get_contents($filePath);
                if ($content === false) {
                    $errors[] = "Cannot read file: $filename";
                    continue;
                }
                
                // Copy file
                if (!copy($filePath, $targetFile)) {
                    $errors[] = "Cannot copy file: $filename";
                    continue;
                }
                
                @chmod($targetFile, 0644);
                
                // Determine note type
                $noteType = ($extension === 'md') ? 'markdown' : 'note';
                
                // Extract title from content
                $title = 'Imported Note';
                if ($noteType === 'markdown') {
                    // Try to extract title from first line if it's a heading
                    $lines = explode("\n", $content, 2);
                    if (!empty($lines[0]) && preg_match('/^#+\s+(.+)$/', trim($lines[0]), $matches)) {
                        $title = trim($matches[1]);
                    } elseif (!empty($lines[0])) {
                        $title = trim($lines[0]);
                    }
                } else {
                    // For HTML, try to extract from <h1> or <title>
                    if (preg_match('/<h1[^>]*>(.*?)<\/h1>/is', $content, $matches)) {
                        $title = strip_tags($matches[1]);
                    } elseif (preg_match('/<title[^>]*>(.*?)<\/title>/is', $content, $matches)) {
                        $title = strip_tags($matches[1]);
                    }
                }
                
                // Check if entry exists in database
                try {
                    $checkStmt = $con->prepare("SELECT id FROM entries WHERE id = ?");
                    $checkStmt->execute([$noteId]);
                    $existing = $checkStmt->fetch();
                    
                    if (!$existing) {
                        // Create entry in database if it doesn't exist
                        $insertStmt = $con->prepare("
                            INSERT INTO entries (id, heading, entry, folder, folder_id, workspace, type, created, updated, trash, favorite) 
                            VALUES (?, ?, ?, 'Default', NULL, 'Poznote', ?, datetime('now'), datetime('now'), 0, 0)
                        ");
                        $insertStmt->execute([$noteId, $title, $content, $noteType]);
                        $createdCount++;
                    } else {
                        // Update entry content if it exists but content might be different
                        $updateStmt = $con->prepare("UPDATE entries SET entry = ?, type = ?, updated = datetime('now') WHERE id = ?");
                        $updateStmt->execute([$content, $noteType, $noteId]);
                    }
                    
                    $importedCount++;
                } catch (Exception $e) {
                    $errors[] = "Database error for $filename: " . $e->getMessage();
                    error_log("Restore entry error: " . $e->getMessage());
                }
            }
        }
    }
    
    $message = "Restored $importedCount file(s)";
    if ($createdCount > 0) {
        $message .= ", created $createdCount database entry(ies)";
    }
    if (!empty($errors)) {
        $message .= ", " . count($errors) . " error(s)";
        error_log("Restore entries errors: " . implode(", ", array_slice($errors, 0, 5)));
    }
    
    return [
        'success' => $importedCount > 0,
        'count' => $importedCount,
        'created' => $createdCount,
        'errors' => $errors,
        'message' => $message
    ];
}

/**
 * Restore attachments from directory
 */
function restoreAttachmentsFromDir($sourceDir) {
    $attachmentsPath = getAttachmentsPath();
    
    if (!$attachmentsPath || !is_dir($attachmentsPath)) {
        return ['success' => false, 'error' => 'Cannot find attachments directory'];
    }
    
    $files = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($sourceDir), 
        RecursiveIteratorIterator::LEAVES_ONLY
    );
    
    $importedCount = 0;
    
    foreach ($files as $name => $file) {
        if (!$file->isDir()) {
            $filePath = $file->getRealPath();
            $relativePath = substr($filePath, strlen($sourceDir) + 1);
            
            // Skip metadata file
            if (basename($relativePath) === 'poznote_attachments_metadata.json') {
                continue;
            }
            
            $targetFile = $attachmentsPath . '/' . basename($relativePath);
            if (copy($filePath, $targetFile)) {
                chmod($targetFile, 0644);
                $importedCount++;
            }
        }
    }
    
    return ['success' => true, 'count' => $importedCount];
}

/**
 * Delete directory recursively
 */
function deleteDirectory($dir) {
    if (!is_dir($dir)) {
        return;
    }
    
    $files = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    
    foreach ($files as $fileinfo) {
        $todo = ($fileinfo->isDir() ? 'rmdir' : 'unlink');
        $todo($fileinfo->getRealPath());
    }
    
    rmdir($dir);
}

// Helper function to ensure proper permissions on data directory
function ensureDataPermissions() {
    $dataDir = dirname(__DIR__) . '/data';
    if (is_dir($dataDir)) {
        // Recursively set ownership to match the data directory owner
        $dataOwner = fileowner($dataDir);
        $dataGroup = filegroup($dataDir);
        
        // Use shell command for recursive chown since PHP chown is not recursive
        exec("chown -R {$dataOwner}:{$dataGroup} {$dataDir} 2>/dev/null");
        
        // Ensure database file has write permissions
        $dbPath = $dataDir . '/database/poznote.db';
        if (file_exists($dbPath)) {
            chmod($dbPath, 0664);
        }
    }
}

/**
 * Get the complete folder path including parent folders
 * @param int $folder_id The folder ID
 * @param PDO $con Database connection
 * @return string The complete folder path (e.g., "Parent/Child")
 */
function getFolderPath($folder_id, $con) {
    if ($folder_id === null || $folder_id === 0) {
        return 'Default';
    }
    
    $path = [];
    $currentId = $folder_id;
    $maxDepth = 50; // Prevent infinite loops
    $depth = 0;
    
    while ($currentId !== null && $depth < $maxDepth) {
        $stmt = $con->prepare("SELECT name, parent_id FROM folders WHERE id = ?");
        $stmt->execute([$currentId]);
        $folder = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$folder) {
            break;
        }
        
        // Add folder name to the beginning of the path
        array_unshift($path, $folder['name']);
        
        // Move to parent
        $currentId = $folder['parent_id'];
        $depth++;
    }
    
    return !empty($path) ? implode('/', $path) : 'Default';
}
?>

?>

<?php
require_once 'auth.php';
require_once 'config.php';
require_once 'functions.php';
require_once 'db_connect.php';

// Check if user is logged in
if (!isset($_SESSION['authenticated']) || $_SESSION['authenticated'] !== true) {
    header('Location: login.php');
    exit;
}

$message = '';
$error = '';
$export_message = '';
$export_error = '';
$import_message = '';
$import_error = '';

// Process actions
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    
    switch ($action) {
        case 'export_database':
            $result = exportDatabase();
            if ($result['success']) {
                $export_message = "Base de données exportée avec succès !";
                // Trigger download
                header('Content-Type: application/octet-stream');
                header('Content-Disposition: attachment; filename="' . $result['filename'] . '"');
                header('Content-Length: ' . strlen($result['content']));
                echo $result['content'];
                exit;
            } else {
                $export_error = "Erreur d'export : " . $result['error'];
            }
            break;
            
        case 'import_database':
            if (isset($_FILES['database_file']) && $_FILES['database_file']['error'] === UPLOAD_ERR_OK) {
                $result = importDatabase($_FILES['database_file']);
                if ($result['success']) {
                    $import_message = "Base de données importée avec succès ! " . $result['message'];
                } else {
                    $import_error = "Erreur d'import : " . $result['error'];
                }
            } else {
                $import_error = "Aucun fichier sélectionné ou erreur d'upload.";
            }
            break;
            
        case 'merge_database':
            if (isset($_FILES['database_file']) && $_FILES['database_file']['error'] === UPLOAD_ERR_OK) {
                $mergeMode = $_POST['merge_mode'] ?? 'append';
                $result = mergeDatabase($_FILES['database_file'], $mergeMode);
                if ($result['success']) {
                    $import_message = "Base de données fusionnée avec succès ! " . $result['message'];
                } else {
                    $import_error = "Erreur de fusion : " . $result['error'];
                }
            } else {
                $import_error = "Aucun fichier sélectionné ou erreur d'upload.";
            }
            break;
    }
}

/**
 * Export database to SQL file
 */
function exportDatabase() {
    global $con;
    
    try {
        $sql = "-- Poznote Database Export\n";
        $sql .= "-- Generated on " . date('Y-m-d H:i:s') . "\n";
        $sql .= "-- This file contains only the database structure and data\n";
        $sql .= "-- Note: This does NOT include note files (HTML/Markdown) or attachments\n\n";
        
        // Get all table names
        $tables = $con->query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
        $tableNames = [];
        while ($row = $tables->fetch(PDO::FETCH_ASSOC)) {
            $tableNames[] = $row['name'];
        }
        
        if (empty($tableNames)) {
            return ['success' => false, 'error' => 'Aucune table trouvée dans la base de données'];
        }
        
        foreach ($tableNames as $table) {
            // Get CREATE TABLE statement
            $createStmt = $con->query("SELECT sql FROM sqlite_master WHERE type='table' AND name='{$table}'")->fetch(PDO::FETCH_ASSOC);
            if ($createStmt && $createStmt['sql']) {
                $sql .= "-- Table: {$table}\n";
                $sql .= $createStmt['sql'] . ";\n\n";
            }
            
            // Get all data
            $data = $con->query("SELECT * FROM \"{$table}\"");
            $rowCount = 0;
            while ($row = $data->fetch(PDO::FETCH_ASSOC)) {
                $columns = array_keys($row);
                $values = array_map(function($value) use ($con) {
                    if ($value === null) {
                        return 'NULL';
                    }
                    return $con->quote($value);
                }, array_values($row));
                
                $sql .= "INSERT INTO \"{$table}\" (" . implode(', ', array_map(function($col) {
                    return "\"{$col}\"";
                }, $columns)) . ") VALUES (" . implode(', ', $values) . ");\n";
                $rowCount++;
            }
            if ($rowCount > 0) {
                $sql .= "-- {$rowCount} row(s) inserted\n\n";
            }
        }
        
        $filename = 'poznote_database_export_' . date('Y-m-d_H-i-s') . '.sql';
        
        return [
            'success' => true,
            'filename' => $filename,
            'content' => $sql
        ];
    } catch (Exception $e) {
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

/**
 * Import database from SQL file (replaces current database)
 */
function importDatabase($uploadedFile) {
    global $con;
    
    try {
        // Read SQL file
        $sqlContent = file_get_contents($uploadedFile['tmp_name']);
        if ($sqlContent === false) {
            return ['success' => false, 'error' => 'Impossible de lire le fichier SQL'];
        }
        
        // Backup current database first
        $backupResult = exportDatabase();
        if ($backupResult['success']) {
            $backupDir = __DIR__ . '/data/backups';
            if (!is_dir($backupDir)) {
                mkdir($backupDir, 0775, true);
            }
            $backupFile = $backupDir . '/auto_backup_before_import_' . date('Y-m-d_H-i-s') . '.sql';
            file_put_contents($backupFile, $backupResult['content']);
        }
        
        // Begin transaction
        $con->beginTransaction();
        
        try {
            // Drop all existing tables (except sqlite system tables)
            $tables = $con->query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
            while ($row = $tables->fetch(PDO::FETCH_ASSOC)) {
                $con->exec("DROP TABLE IF EXISTS \"{$row['name']}\"");
            }
            
            // Execute SQL statements
            $statements = explode(';', $sqlContent);
            $importedCount = 0;
            
            foreach ($statements as $statement) {
                $statement = trim($statement);
                if (empty($statement) || strpos($statement, '--') === 0) {
                    continue;
                }
                
                try {
                    $con->exec($statement);
                    if (stripos($statement, 'INSERT') === 0 || stripos($statement, 'CREATE') === 0) {
                        $importedCount++;
                    }
                } catch (PDOException $e) {
                    // Log but continue for some errors
                    if (strpos($e->getMessage(), 'already exists') === false) {
                        error_log("SQL Error: " . $e->getMessage() . " - Statement: " . substr($statement, 0, 100));
                    }
                }
            }
            
            $con->commit();
            
            return [
                'success' => true,
                'message' => "{$importedCount} instruction(s) exécutée(s). Base de données remplacée."
            ];
        } catch (Exception $e) {
            $con->rollBack();
            throw $e;
        }
    } catch (Exception $e) {
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

/**
 * Merge database from SQL file (adds data without replacing)
 */
function mergeDatabase($uploadedFile, $mode = 'append') {
    global $con;
    
    try {
        // Read SQL file
        $sqlContent = file_get_contents($uploadedFile['tmp_name']);
        if ($sqlContent === false) {
            return ['success' => false, 'error' => 'Impossible de lire le fichier SQL'];
        }
        
        // Backup current database first
        $backupResult = exportDatabase();
        if ($backupResult['success']) {
            $backupDir = __DIR__ . '/data/backups';
            if (!is_dir($backupDir)) {
                mkdir($backupDir, 0775, true);
            }
            $backupFile = $backupDir . '/auto_backup_before_merge_' . date('Y-m-d_H-i-s') . '.sql';
            file_put_contents($backupFile, $backupResult['content']);
        }
        
        // Begin transaction
        $con->beginTransaction();
        
        try {
            // Parse SQL to extract table structures and data
            $statements = explode(';', $sqlContent);
            $importedCount = 0;
            $skippedCount = 0;
            
            foreach ($statements as $statement) {
                $statement = trim($statement);
                if (empty($statement) || strpos($statement, '--') === 0) {
                    continue;
                }
                
                // Skip CREATE TABLE if table already exists (in append mode)
                if ($mode === 'append' && stripos($statement, 'CREATE TABLE') === 0) {
                    // Check if table exists
                    if (preg_match('/CREATE TABLE\s+"?(\w+)"?/i', $statement, $matches)) {
                        $tableName = $matches[1];
                        $tableExists = $con->query("SELECT name FROM sqlite_master WHERE type='table' AND name='{$tableName}'")->fetch();
                        if ($tableExists) {
                            $skippedCount++;
                            continue;
                        }
                    }
                }
                
                // Handle INSERT statements
                if (stripos($statement, 'INSERT') === 0) {
                    if ($mode === 'append') {
                        // Use INSERT OR IGNORE to avoid duplicates
                        $statement = str_ireplace('INSERT INTO', 'INSERT OR IGNORE INTO', $statement);
                    } elseif ($mode === 'replace') {
                        // Use INSERT OR REPLACE
                        $statement = str_ireplace('INSERT INTO', 'INSERT OR REPLACE INTO', $statement);
                    }
                }
                
                try {
                    $con->exec($statement);
                    if (stripos($statement, 'INSERT') === 0 || stripos($statement, 'CREATE') === 0) {
                        $importedCount++;
                    }
                } catch (PDOException $e) {
                    // Log but continue for some errors
                    if (strpos($e->getMessage(), 'UNIQUE constraint') === false) {
                        error_log("SQL Error: " . $e->getMessage() . " - Statement: " . substr($statement, 0, 100));
                    } else {
                        $skippedCount++;
                    }
                }
            }
            
            $con->commit();
            
            $message = "{$importedCount} instruction(s) exécutée(s)";
            if ($skippedCount > 0) {
                $message .= ", {$skippedCount} ignorée(s) (doublons ou tables existantes)";
            }
            
            return [
                'success' => true,
                'message' => $message
            ];
        } catch (Exception $e) {
            $con->rollBack();
            throw $e;
        }
    } catch (Exception $e) {
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Transfert de Données - Poznote</title>
    <link rel="stylesheet" href="css/all.css">
    <link rel="stylesheet" href="css/restore_import.css">
    <style>
        .data-transfer-container {
            max-width: 900px;
            margin: 20px auto;
            padding: 20px;
        }
        .warning-box {
            background-color: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 5px;
            padding: 15px;
            margin: 20px 0;
        }
        .info-box {
            background-color: #d1ecf1;
            border: 1px solid #bee5eb;
            border-radius: 5px;
            padding: 15px;
            margin: 20px 0;
        }
        .section {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .section h2 {
            margin-top: 0;
            color: #333;
        }
        .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            margin: 5px;
        }
        .btn-primary {
            background-color: #007bff;
            color: white;
        }
        .btn-primary:hover {
            background-color: #0056b3;
        }
        .btn-danger {
            background-color: #dc3545;
            color: white;
        }
        .btn-danger:hover {
            background-color: #c82333;
        }
        .btn-success {
            background-color: #28a745;
            color: white;
        }
        .btn-success:hover {
            background-color: #218838;
        }
    </style>
</head>
<body>
    <div class="data-transfer-container">
        <h1><i class="fa-exchange-alt"></i> Transfert de Données</h1>
        
        <div class="info-box">
            <strong><i class="fa-info-circle"></i> Information :</strong>
            <p>Cette page permet d'exporter et d'importer uniquement les <strong>données de la base de données</strong> (notes, dossiers, paramètres, etc.).</p>
            <p><strong>Note importante :</strong> Les fichiers de notes (HTML/Markdown) et les pièces jointes ne sont <strong>pas</strong> inclus dans cette exportation. Utilisez "Backup / Export" pour une sauvegarde complète.</p>
        </div>
        
        <?php if ($export_message): ?>
            <div class="alert alert-success">
                <i class="fa-check-circle"></i> <?php echo htmlspecialchars($export_message); ?>
            </div>
        <?php endif; ?>
        
        <?php if ($export_error): ?>
            <div class="alert alert-danger">
                <i class="fa-exclamation-circle"></i> <?php echo htmlspecialchars($export_error); ?>
            </div>
        <?php endif; ?>
        
        <?php if ($import_message): ?>
            <div class="alert alert-success">
                <i class="fa-check-circle"></i> <?php echo htmlspecialchars($import_message); ?>
            </div>
        <?php endif; ?>
        
        <?php if ($import_error): ?>
            <div class="alert alert-danger">
                <i class="fa-exclamation-circle"></i> <?php echo htmlspecialchars($import_error); ?>
            </div>
        <?php endif; ?>
        
        <!-- Export Section -->
        <div class="section">
            <h2><i class="fa-upload"></i> Exporter la Base de Données</h2>
            <p>Exporte uniquement les données de la base de données (structure et contenu) au format SQL.</p>
            
            <form method="POST" action="">
                <input type="hidden" name="action" value="export_database">
                <button type="submit" class="btn btn-primary">
                    <i class="fa-download"></i> Télécharger l'Export SQL
                </button>
            </form>
        </div>
        
        <!-- Import Section -->
        <div class="section">
            <h2><i class="fa-download"></i> Importer une Base de Données</h2>
            <p><strong>Attention :</strong> Cette opération remplace complètement votre base de données actuelle.</p>
            
            <div class="warning-box">
                <strong><i class="fa-exclamation-triangle"></i> Avertissement :</strong>
                <ul>
                    <li>Une sauvegarde automatique sera créée avant l'import</li>
                    <li>Toutes les données actuelles seront remplacées</li>
                    <li>Les fichiers de notes et pièces jointes ne seront pas affectés</li>
                </ul>
            </div>
            
            <form method="POST" action="" enctype="multipart/form-data">
                <input type="hidden" name="action" value="import_database">
                <div style="margin: 15px 0;">
                    <label for="database_file">Fichier SQL à importer :</label>
                    <input type="file" id="database_file" name="database_file" accept=".sql" required style="margin-top: 10px; display: block;">
                </div>
                <button type="submit" class="btn btn-danger" onclick="return confirm('Êtes-vous sûr de vouloir remplacer votre base de données actuelle ?');">
                    <i class="fa-upload"></i> Importer et Remplacer
                </button>
            </form>
        </div>
        
        <!-- Merge Section -->
        <div class="section">
            <h2><i class="fa-code-branch"></i> Fusionner une Base de Données</h2>
            <p>Ajoute les données d'une autre base de données sans remplacer les données existantes.</p>
            
            <div class="info-box">
                <strong>Modes de fusion :</strong>
                <ul>
                    <li><strong>Ajouter (Append) :</strong> Ajoute les nouvelles données, ignore les doublons</li>
                    <li><strong>Remplacer (Replace) :</strong> Remplace les enregistrements existants avec les mêmes clés</li>
                </ul>
            </div>
            
            <form method="POST" action="" enctype="multipart/form-data">
                <input type="hidden" name="action" value="merge_database">
                <div style="margin: 15px 0;">
                    <label for="merge_database_file">Fichier SQL à fusionner :</label>
                    <input type="file" id="merge_database_file" name="database_file" accept=".sql" required style="margin-top: 10px; display: block;">
                </div>
                <div style="margin: 15px 0;">
                    <label for="merge_mode">Mode de fusion :</label>
                    <select id="merge_mode" name="merge_mode" style="margin-top: 10px; padding: 5px; display: block;">
                        <option value="append">Ajouter (ignorer les doublons)</option>
                        <option value="replace">Remplacer (écraser les doublons)</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-success" onclick="return confirm('Êtes-vous sûr de vouloir fusionner cette base de données ?');">
                    <i class="fa-code-branch"></i> Fusionner
                </button>
            </form>
        </div>
        
        <div style="margin-top: 30px; text-align: center;">
            <a href="settings.php" class="btn btn-primary">
                <i class="fa-arrow-left"></i> Retour aux Paramètres
            </a>
        </div>
    </div>
</body>
</html>


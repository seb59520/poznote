<?php
/**
 * API pour créer une note à partir d'un prompt IA
 */

require __DIR__ . '/../auth.php';
requireApiAuth();

header('Content-Type: application/json');
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../functions.php';
require_once __DIR__ . '/../ai/ai_generator.php';
require_once __DIR__ . '/../ai/ai_config.php';
require_once __DIR__ . '/../db_connect.php';

// Vérifier que l'IA est activée
if (!AIConfig::isEnabled() || !AIConfig::isFeatureEnabled('generation')) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'AI note generation is disabled']);
    exit;
}

// Vérifier le rate limiting
if (!AIConfig::checkRateLimit()) {
    http_response_code(429);
    echo json_encode(['success' => false, 'message' => 'Rate limit exceeded']);
    exit;
}

// Seulement POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

$prompt = trim($input['prompt'] ?? '');
$type = $input['type'] ?? 'structured';
$workspace = $input['workspace'] ?? 'Poznote';
$folderId = isset($input['folder_id']) ? intval($input['folder_id']) : null;
$folderName = $input['folder_name'] ?? null;

if (empty($prompt)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Prompt is required']);
    exit;
}

// Valider le type
$allowedTypes = ['structured', 'meeting', 'project', 'checklist', 'summary', 'brainstorm'];
if (!in_array($type, $allowedTypes)) {
    $type = 'structured';
}

try {
    $generator = new AIGenerator();
    
    // Générer le contenu de la note
    $content = $generator->createNoteFromPrompt($prompt, $type);
    
    // Générer un titre à partir du prompt
    $titlePrompt = "Génère un titre court et descriptif (maximum 60 caractères) pour une note sur: " . $prompt;
    $title = $generator->client->generateFromPrompt($titlePrompt, null, [
        'system_prompt' => 'Tu es un assistant qui génère des titres concis et descriptifs. Réponds uniquement avec le titre, sans explication.',
        'max_tokens' => 30,
        'temperature' => 0.5
    ]);
    $title = trim($title);
    $title = mb_substr($title, 0, 60);
    
    // Si le titre est vide ou invalide, utiliser le prompt tronqué
    if (empty($title) || strlen($title) < 3) {
        $title = mb_substr($prompt, 0, 60);
    }
    
    // Générer des tags suggérés
    $tags = [];
    try {
        $tags = $generator->suggestTags($title, $content);
    } catch (Exception $e) {
        // Ignorer les erreurs de tagging
    }
    
    // Obtenir le folder_id si folder_name est fourni
    if ($folderName && !$folderId) {
        $stmt = $con->prepare("SELECT id FROM folders WHERE name = ? AND (workspace = ? OR (workspace IS NULL AND ? = 'Poznote'))");
        $stmt->execute([$folderName, $workspace, $workspace]);
        $folderData = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($folderData) {
            $folderId = (int)$folderData['id'];
        }
    }
    
    // Créer la note dans la base de données
    $now_utc = gmdate('Y-m-d H:i:s', time());
    $tagsString = implode(',', $tags);
    $folderNameForDB = $folderName ?? null;
    
    $stmt = $con->prepare("
        INSERT INTO entries (heading, entry, tags, folder, folder_id, workspace, type, created, updated) 
        VALUES (?, ?, ?, ?, ?, ?, 'note', ?, ?)
    ");
    
    if (!$stmt->execute([$title, $content, $tagsString, $folderNameForDB, $folderId, $workspace, $now_utc, $now_utc])) {
        throw new Exception('Failed to create note in database');
    }
    
    $noteId = $con->lastInsertId();
    
    // Créer le fichier de contenu
    $filename = getEntryFilename($noteId, 'note');
    $entriesDir = dirname($filename);
    if (!is_dir($entriesDir)) {
        mkdir($entriesDir, 0755, true);
    }
    
    file_put_contents($filename, $content);
    
    // Générer l'embedding si la recherche sémantique est activée
    if (AIConfig::isFeatureEnabled('semantic_search')) {
        try {
            require_once __DIR__ . '/../ai/ai_embeddings.php';
            $embeddings = new AIEmbeddings($con);
            $embeddings->processNote($noteId, $title, $content);
        } catch (Exception $e) {
            // Ignorer les erreurs d'embedding
            error_log('Error generating embedding for new note: ' . $e->getMessage());
        }
    }
    
    // Enregistrer la requête pour le rate limiting
    AIConfig::recordRequest();
    
    echo json_encode([
        'success' => true,
        'note_id' => $noteId,
        'title' => $title,
        'content' => $content,
        'tags' => $tags,
        'workspace' => $workspace,
        'folder_id' => $folderId
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}


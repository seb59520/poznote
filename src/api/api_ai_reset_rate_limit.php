<?php
/**
 * API pour réinitialiser le compteur de rate limiting
 */

require __DIR__ . '/../auth.php';
requireApiAuth();

header('Content-Type: application/json');
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db_connect.php';

// Seulement POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

try {
    // Obtenir l'IP de la requête
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $today = date('Y-m-d');
    
    // Supprimer TOUTES les entrées pour aujourd'hui (pour toutes les IPs)
    $stmt = $con->prepare('DELETE FROM ai_rate_limits WHERE date = ?');
    $stmt->execute([$today]);
    
    $deletedCount = $stmt->rowCount();
    
    // Vérifier que la suppression a bien fonctionné
    $stmt = $con->prepare('SELECT COUNT(*) FROM ai_rate_limits WHERE date = ?');
    $stmt->execute([$today]);
    $remainingCount = $stmt->fetchColumn();
    
    echo json_encode([
        'success' => true,
        'message' => 'Compteur réinitialisé avec succès',
        'date' => $today,
        'deleted' => $deletedCount,
        'remaining' => $remainingCount
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}


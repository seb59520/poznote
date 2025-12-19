<?php
/**
 * API pour obtenir le statut du rate limiting
 */

require __DIR__ . '/../auth.php';
requireApiAuth();

header('Content-Type: application/json');
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../ai/ai_config.php';
require_once __DIR__ . '/../db_connect.php';

try {
    // Obtenir la limite configurée
    $limit = AIConfig::getRateLimit();
    
    // Obtenir l'IP de la requête
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $today = date('Y-m-d');
    
    // Obtenir le nombre de requêtes aujourd'hui pour cette IP
    $stmt = $con->prepare('SELECT SUM(count) FROM ai_rate_limits WHERE identifier = ? AND date = ?');
    $stmt->execute([$ip, $today]);
    $used = $stmt->fetchColumn();
    
    if ($used === false || $used === null) {
        $used = 0;
    }
    
    // Obtenir le total pour toutes les IPs aujourd'hui (optionnel)
    $stmt = $con->prepare('SELECT SUM(count) FROM ai_rate_limits WHERE date = ?');
    $stmt->execute([$today]);
    $totalUsed = $stmt->fetchColumn();
    
    if ($totalUsed === false || $totalUsed === null) {
        $totalUsed = 0;
    }
    
    echo json_encode([
        'success' => true,
        'limit' => $limit,
        'used' => intval($used),
        'total_used' => intval($totalUsed),
        'remaining' => max(0, $limit - intval($used)),
        'percentage' => $limit > 0 ? round((intval($used) / $limit) * 100) : 0,
        'date' => $today
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}


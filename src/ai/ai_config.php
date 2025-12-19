<?php
/**
 * Configuration pour les fonctionnalités IA avec OpenRouter
 */

class AIConfig {
    // Provider: OpenRouter (unified API pour plusieurs modèles)
    const PROVIDER = 'openrouter';
    
    // OpenRouter Configuration
    const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';
    const OPENROUTER_API_KEY = null; // Sera lu depuis $_ENV
    
    // Modèles recommandés pour différentes tâches
    const MODEL_EMBEDDINGS = 'text-embedding-3-small'; // Via OpenAI via OpenRouter
    const MODEL_GENERATION = 'openai/gpt-3.5-turbo'; // Modèle économique pour génération
    const MODEL_ADVANCED = 'openai/gpt-4-turbo-preview'; // Pour tâches complexes
    const MODEL_EXTRACTION = 'anthropic/claude-3-haiku'; // Rapide pour extraction
    
    // Configuration par défaut
    const MAX_TOKENS = 1000;
    const TEMPERATURE = 0.7;
    const CACHE_TTL = 3600; // 1 heure
    const RATE_LIMIT_PER_USER_DEFAULT = 200; // Requêtes par jour (par défaut)
    
    // Timeouts
    const TIMEOUT_SECONDS = 30;
    
    /**
     * Obtenir la clé API OpenRouter depuis les variables d'environnement
     */
    public static function getApiKey() {
        return $_ENV['OPENROUTER_API_KEY'] ?? getenv('OPENROUTER_API_KEY') ?? null;
    }
    
    /**
     * Vérifier si l'IA est activée globalement
     */
    public static function isEnabled() {
        global $con;
        try {
            if (!isset($con)) {
                return false;
            }
            $stmt = $con->prepare('SELECT value FROM settings WHERE key = ?');
            $stmt->execute(['ai_enabled']);
            $enabled = $stmt->fetchColumn();
            return $enabled === '1' || $enabled === 'true';
        } catch (Exception $e) {
            return false;
        }
    }
    
    /**
     * Vérifier si une fonctionnalité IA spécifique est activée
     */
    public static function isFeatureEnabled($feature) {
        global $con;
        try {
            if (!isset($con)) {
                return false;
            }
            $stmt = $con->prepare('SELECT value FROM settings WHERE key = ?');
            $stmt->execute(['ai_feature_' . $feature]);
            $enabled = $stmt->fetchColumn();
            // Si la feature n'existe pas en settings, vérifier le flag global
            if ($enabled === false) {
                return self::isEnabled();
            }
            return $enabled === '1' || $enabled === 'true';
        } catch (Exception $e) {
            return false;
        }
    }
    
    /**
     * Obtenir le modèle approprié pour une tâche
     */
    public static function getModelForTask($task) {
        $modelMap = [
            'embeddings' => self::MODEL_EMBEDDINGS,
            'generation' => self::MODEL_GENERATION,
            'advanced' => self::MODEL_ADVANCED,
            'extraction' => self::MODEL_EXTRACTION,
            'tagging' => self::MODEL_GENERATION,
            'summary' => self::MODEL_GENERATION,
            'rewrite' => self::MODEL_GENERATION,
            'expand' => self::MODEL_GENERATION
        ];
        
        return $modelMap[$task] ?? self::MODEL_GENERATION;
    }
    
    /**
     * Obtenir la limite de rate limiting configurée
     */
    public static function getRateLimit() {
        global $con;
        try {
            if (!isset($con)) {
                return self::RATE_LIMIT_PER_USER_DEFAULT;
            }
            
            $stmt = $con->prepare('SELECT value FROM settings WHERE key = ?');
            $stmt->execute(['ai_rate_limit']);
            $limit = $stmt->fetchColumn();
            
            if ($limit !== false && is_numeric($limit) && $limit > 0) {
                return intval($limit);
            }
            
            return self::RATE_LIMIT_PER_USER_DEFAULT;
        } catch (Exception $e) {
            return self::RATE_LIMIT_PER_USER_DEFAULT;
        }
    }
    
    /**
     * Vérifier les limites de taux
     */
    public static function checkRateLimit($userId = null) {
        global $con;
        try {
            if (!isset($con)) {
                return true;
            }
            
            // Obtenir la limite configurée
            $rateLimit = self::getRateLimit();
            
            // Vérifier que la table existe
            $tableExists = $con->query("
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='ai_rate_limits'
            ")->fetchColumn();
            
            if (!$tableExists) {
                return true; // Si la table n'existe pas, autoriser
            }
            
            // Pour l'instant, on utilise un système simple basé sur l'IP
            // Dans une vraie app, on utiliserait l'ID utilisateur
            $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
            $today = date('Y-m-d');
            
            $stmt = $con->prepare('
                SELECT count FROM ai_rate_limits 
                WHERE identifier = ? AND date = ?
            ');
            $stmt->execute([$ip, $today]);
            $count = $stmt->fetchColumn();
            
            // Autoriser si pas de compteur ou si strictement inférieur à la limite
            // (on vérifie AVANT d'incrémenter, donc on autorise jusqu'à limite-1)
            if ($count === false) {
                return true;
            }
            
            return (intval($count) < intval($rateLimit));
        } catch (Exception $e) {
            return true; // En cas d'erreur, autoriser
        }
    }
    
    /**
     * Enregistrer une requête pour le rate limiting
     */
    public static function recordRequest($userId = null) {
        global $con;
        try {
            if (!isset($con)) {
                return;
            }
            
            // Vérifier que la table existe
            $tableExists = $con->query("
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='ai_rate_limits'
            ")->fetchColumn();
            
            if (!$tableExists) {
                return; // Si la table n'existe pas, ignorer
            }
            
            $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
            $today = date('Y-m-d');
            
            $stmt = $con->prepare('
                INSERT INTO ai_rate_limits (identifier, date, count, last_request)
                VALUES (?, ?, 1, datetime("now"))
                ON CONFLICT(identifier, date) DO UPDATE SET
                    count = count + 1,
                    last_request = datetime("now")
            ');
            $stmt->execute([$ip, $today]);
        } catch (Exception $e) {
            // Ignorer les erreurs de rate limiting
        }
    }
}


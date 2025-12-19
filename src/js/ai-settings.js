/**
 * Gestion des paramètres IA dans Settings
 */

(function() {
    'use strict';
    
    const AISettings = {
        features: [
            { key: 'ai_enabled', label: 'Activer l\'IA', description: 'Active toutes les fonctionnalités IA' },
            { key: 'ai_feature_semantic_search', label: 'Recherche sémantique', description: 'Trouver des notes similaires même sans mots-clés exacts' },
            { key: 'ai_feature_generation', label: 'Génération de contenu', description: 'Résumer, développer et réécrire du texte' },
            { key: 'ai_feature_tagging', label: 'Tagging automatique', description: 'Suggérer des tags pertinents' },
            { key: 'ai_feature_related_notes', label: 'Notes liées', description: 'Trouver automatiquement des notes similaires' },
            { key: 'ai_feature_extraction', label: 'Extraction d\'informations', description: 'Extraire dates, tâches, personnes, sujets' }
        ],
        
        rateLimit: null, // Sera chargé dynamiquement
        
        /**
         * Charger l'état actuel des fonctionnalités
         */
        async loadSettings() {
            const settings = {};
            
            for (const feature of this.features) {
                try {
                    const response = await fetch('api_settings.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        credentials: 'same-origin',
                        body: `action=get&key=${encodeURIComponent(feature.key)}`
                    });
                    
                    const data = await response.json();
                    settings[feature.key] = data.success && (data.value === '1' || data.value === 'true');
                } catch (error) {
                    console.error('Error loading setting:', feature.key, error);
                    settings[feature.key] = false;
                }
            }
            
            // Charger la limite de rate limiting
            try {
                const response = await fetch('api_settings.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    credentials: 'same-origin',
                    body: 'action=get&key=ai_rate_limit'
                });
                
                const data = await response.json();
                if (data.success && data.value) {
                    this.rateLimit = parseInt(data.value) || 200;
                } else {
                    this.rateLimit = 200; // Valeur par défaut
                }
            } catch (error) {
                console.error('Error loading rate limit:', error);
                this.rateLimit = 200;
            }
            
            return settings;
        },
        
        /**
         * Sauvegarder un paramètre
         */
        async saveSetting(key, value) {
            try {
                // Pour ai_rate_limit, utiliser la valeur directement (pas de conversion 1/0)
                const settingValue = (key === 'ai_rate_limit') ? value : (value ? '1' : '0');
                
                const response = await fetch('api_settings.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    credentials: 'same-origin',
                    body: `action=set&key=${encodeURIComponent(key)}&value=${encodeURIComponent(settingValue)}`
                });
                
                const data = await response.json();
                return data.success;
            } catch (error) {
                console.error('Error saving setting:', key, error);
                return false;
            }
        },
        
        /**
         * Mettre à jour le badge de statut
         */
        updateStatusBadge(enabled) {
            const badge = document.getElementById('ai-status-badge');
            if (badge) {
                badge.textContent = enabled ? 'activé' : 'désactivé';
                badge.className = 'setting-status ' + (enabled ? 'enabled' : 'disabled');
            }
        },
        
        /**
         * Afficher la modal de configuration IA
         */
        async showSettingsModal() {
            const settings = await this.loadSettings();
            
            // Créer la modal
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.id = 'ai-settings-modal';
            modal.style.cssText = 'display: block; z-index: 10000;';
            
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h2>Configuration des fonctionnalités IA</h2>
                        <span class="close" onclick="AISettings.closeModal()">&times;</span>
                    </div>
                    <div class="modal-body" style="padding: 20px;">
                        <p style="margin-bottom: 20px; color: #666;">
                            Configurez les fonctionnalités IA de Poznote. Assurez-vous d'avoir configuré votre clé API OpenRouter dans le fichier .env
                        </p>
                        
                        <div id="ai-features-list" style="display: flex; flex-direction: column; gap: 15px;">
                            ${this.features.map(feature => `
                                <div class="ai-feature-item" style="
                                    padding: 15px;
                                    border: 1px solid #ddd;
                                    border-radius: 8px;
                                    background: ${settings[feature.key] ? '#f0f9ff' : '#f9fafb'};
                                ">
                                    <div style="display: flex; justify-content: space-between; align-items: start;">
                                        <div style="flex: 1;">
                                            <h4 style="margin: 0 0 5px 0; font-size: 16px;">
                                                ${feature.label}
                                            </h4>
                                            <p style="margin: 0; font-size: 13px; color: #666;">
                                                ${feature.description}
                                            </p>
                                        </div>
                                        <label class="toggle-switch" style="margin-left: 15px;">
                                            <input 
                                                type="checkbox" 
                                                data-feature="${feature.key}"
                                                ${settings[feature.key] ? 'checked' : ''}
                                                ${feature.key === 'ai_enabled' ? '' : (settings['ai_enabled'] ? '' : 'disabled')}
                                                onchange="AISettings.toggleFeature('${feature.key}', this.checked)"
                                            >
                                            <span class="toggle-slider"></span>
                                        </label>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        
                        <div style="margin-top: 20px; padding: 15px; background: #e7f3ff; border-radius: 8px; border-left: 4px solid #2196F3;">
                            <h4 style="margin: 0 0 10px 0; font-size: 14px;">Limite de requêtes par jour</h4>
                            <p style="margin: 0 0 10px 0; font-size: 13px; color: #666;">
                                Nombre maximum de requêtes IA autorisées par jour (par IP)
                            </p>
                            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                <input 
                                    type="number" 
                                    id="ai-rate-limit-input" 
                                    min="10" 
                                    max="10000" 
                                    value="${this.rateLimit || 200}"
                                    style="width: 100px; padding: 6px; border: 1px solid #ddd; border-radius: 4px;"
                                >
                                <span style="font-size: 13px; color: #666;">requêtes/jour</span>
                                <button 
                                    onclick="AISettings.saveRateLimit()" 
                                    class="btn btn-primary"
                                    style="padding: 6px 12px; font-size: 13px;"
                                >
                                    Enregistrer
                                </button>
                                <button 
                                    onclick="AISettings.resetRateLimitCounter()" 
                                    class="btn btn-secondary"
                                    style="padding: 6px 12px; font-size: 13px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;"
                                    title="Réinitialiser le compteur pour aujourd'hui"
                                >
                                    Réinitialiser le compteur
                                </button>
                            </div>
                            <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">
                                Valeur recommandée : 200-500 pour usage personnel, 1000+ pour usage intensif
                            </p>
                            <div id="rate-limit-status" style="margin-top: 10px; font-size: 12px; color: #666;"></div>
                        </div>
                        
                        <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
                            <strong>💡 Note:</strong> Pour utiliser les fonctionnalités IA, vous devez :
                            <ul style="margin: 10px 0 0 20px;">
                                <li>Obtenir une clé API sur <a href="https://openrouter.ai" target="_blank">OpenRouter.ai</a></li>
                                <li>L'ajouter dans le fichier <code>.env</code> : <code>OPENROUTER_API_KEY=votre_cle</code></li>
                                <li>Redémarrer le conteneur Docker</li>
                            </ul>
                        </div>
                    </div>
                    <div class="modal-footer" style="padding: 15px 20px; border-top: 1px solid #ddd; text-align: right;">
                        <button onclick="AISettings.closeModal()" class="btn btn-primary">Fermer</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Charger le statut du rate limit
            this.loadRateLimitStatus();
            
            // Ajouter les styles pour le toggle switch
            if (!document.getElementById('ai-toggle-styles')) {
                const style = document.createElement('style');
                style.id = 'ai-toggle-styles';
                style.textContent = `
                    .toggle-switch {
                        position: relative;
                        display: inline-block;
                        width: 50px;
                        height: 24px;
                    }
                    .toggle-switch input {
                        opacity: 0;
                        width: 0;
                        height: 0;
                    }
                    .toggle-slider {
                        position: absolute;
                        cursor: pointer;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background-color: #ccc;
                        transition: .4s;
                        border-radius: 24px;
                    }
                    .toggle-slider:before {
                        position: absolute;
                        content: "";
                        height: 18px;
                        width: 18px;
                        left: 3px;
                        bottom: 3px;
                        background-color: white;
                        transition: .4s;
                        border-radius: 50%;
                    }
                    .toggle-switch input:checked + .toggle-slider {
                        background-color: #10b981;
                    }
                    .toggle-switch input:checked + .toggle-slider:before {
                        transform: translateX(26px);
                    }
                    .toggle-switch input:disabled + .toggle-slider {
                        opacity: 0.5;
                        cursor: not-allowed;
                    }
                `;
                document.head.appendChild(style);
            }
            
            // Fermer en cliquant en dehors
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    AISettings.closeModal();
                }
            });
        },
        
        /**
         * Fermer la modal
         */
        closeModal() {
            const modal = document.getElementById('ai-settings-modal');
            if (modal) {
                modal.remove();
            }
        },
        
        /**
         * Activer/désactiver une fonctionnalité
         */
        async toggleFeature(key, enabled) {
            // Si on désactive ai_enabled, désactiver toutes les autres
            if (key === 'ai_enabled' && !enabled) {
                if (!confirm('Désactiver toutes les fonctionnalités IA ?')) {
                    document.querySelector(`input[data-feature="${key}"]`).checked = true;
                    return;
                }
                
                // Désactiver toutes les fonctionnalités
                for (const feature of this.features) {
                    if (feature.key !== 'ai_enabled') {
                        await this.saveSetting(feature.key, false);
                        const checkbox = document.querySelector(`input[data-feature="${feature.key}"]`);
                        if (checkbox) {
                            checkbox.checked = false;
                            checkbox.disabled = true;
                        }
                    }
                }
            }
            
            // Si on active ai_enabled, activer les checkboxes
            if (key === 'ai_enabled' && enabled) {
                for (const feature of this.features) {
                    if (feature.key !== 'ai_enabled') {
                        const checkbox = document.querySelector(`input[data-feature="${feature.key}"]`);
                        if (checkbox) {
                            checkbox.disabled = false;
                        }
                    }
                }
            }
            
            // Sauvegarder le paramètre
            const success = await this.saveSetting(key, enabled);
            
            if (success) {
                // Mettre à jour le badge principal
                if (key === 'ai_enabled') {
                    this.updateStatusBadge(enabled);
                }
                
                // Afficher une notification
                if (typeof showNotificationPopup === 'function') {
                    showNotificationPopup(
                        `${enabled ? 'Activé' : 'Désactivé'} : ${this.features.find(f => f.key === key)?.label || key}`,
                        'success'
                    );
                } else {
                    alert(`${enabled ? 'Activé' : 'Désactivé'} : ${this.features.find(f => f.key === key)?.label || key}`);
                }
            } else {
                // Restaurer l'état précédent en cas d'erreur
                const checkbox = document.querySelector(`input[data-feature="${key}"]`);
                if (checkbox) {
                    checkbox.checked = !enabled;
                }
                alert('Erreur lors de la sauvegarde');
            }
        },
        
        /**
         * Sauvegarder la limite de rate limiting
         */
        async saveRateLimit() {
            const input = document.getElementById('ai-rate-limit-input');
            if (!input) {
                return;
            }
            
            const limit = parseInt(input.value);
            
            if (isNaN(limit) || limit < 10 || limit > 10000) {
                if (typeof showNotificationPopup === 'function') {
                    showNotificationPopup('La limite doit être entre 10 et 10000', 'error');
                } else {
                    alert('La limite doit être entre 10 et 10000');
                }
                return;
            }
            
            try {
                const success = await this.saveSetting('ai_rate_limit', limit.toString());
                
                if (success) {
                    this.rateLimit = limit;
                    if (typeof showNotificationPopup === 'function') {
                        showNotificationPopup('Limite de requêtes enregistrée : ' + limit + '/jour', 'success');
                    } else {
                        alert('Limite de requêtes enregistrée : ' + limit + '/jour');
                    }
                    // Recharger le statut
                    this.loadRateLimitStatus();
                } else {
                    throw new Error('Erreur lors de la sauvegarde');
                }
            } catch (error) {
                if (typeof showNotificationPopup === 'function') {
                    showNotificationPopup('Erreur: ' + error.message, 'error');
                } else {
                    alert('Erreur: ' + error.message);
                }
            }
        },
        
        /**
         * Réinitialiser le compteur de rate limiting
         */
        async resetRateLimitCounter() {
            if (!confirm('Voulez-vous vraiment réinitialiser le compteur de requêtes pour aujourd\'hui ?')) {
                return;
            }
            
            try {
                const response = await fetch('api/api_ai_reset_rate_limit.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    credentials: 'same-origin'
                });
                
                const data = await response.json();
                
                if (data.success) {
                    if (typeof showNotificationPopup === 'function') {
                        showNotificationPopup('Compteur réinitialisé avec succès', 'success');
                    } else {
                        alert('Compteur réinitialisé avec succès');
                    }
                    // Recharger le statut
                    this.loadRateLimitStatus();
                } else {
                    throw new Error(data.message || 'Erreur lors de la réinitialisation');
                }
            } catch (error) {
                if (typeof showNotificationPopup === 'function') {
                    showNotificationPopup('Erreur: ' + error.message, 'error');
                } else {
                    alert('Erreur: ' + error.message);
                }
            }
        },
        
        /**
         * Charger le statut du rate limit
         */
        async loadRateLimitStatus() {
            const statusDiv = document.getElementById('rate-limit-status');
            if (!statusDiv) {
                return;
            }
            
            try {
                const response = await fetch('api/api_ai_rate_limit_status.php', {
                    method: 'GET',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    credentials: 'same-origin'
                });
                
                const data = await response.json();
                
                if (data.success) {
                    const used = data.used || 0;
                    const limit = data.limit || this.rateLimit || 200;
                    const percentage = Math.round((used / limit) * 100);
                    
                    let color = '#28a745'; // Vert
                    if (percentage >= 90) {
                        color = '#dc3545'; // Rouge
                    } else if (percentage >= 70) {
                        color = '#ffc107'; // Jaune
                    }
                    
                    statusDiv.innerHTML = `
                        <strong>Utilisation aujourd'hui :</strong> 
                        <span style="color: ${color}; font-weight: bold;">${used} / ${limit}</span> 
                        (${percentage}%)
                    `;
                } else {
                    statusDiv.innerHTML = '<span style="color: #999;">Statut non disponible</span>';
                }
            } catch (error) {
                statusDiv.innerHTML = '<span style="color: #999;">Erreur de chargement</span>';
            }
        }
    };
    
    // Fonction globale pour afficher les settings
    window.showAISettings = function() {
        AISettings.showSettingsModal();
    };
    
    // Charger le statut au chargement de la page
    document.addEventListener('DOMContentLoaded', async function() {
        try {
            const settings = await AISettings.loadSettings();
            AISettings.updateStatusBadge(settings['ai_enabled']);
        } catch (error) {
            console.error('Error loading AI settings:', error);
        }
    });
    
    // Exposer globalement
    window.AISettings = AISettings;
})();


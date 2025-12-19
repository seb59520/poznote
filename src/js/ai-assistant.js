/**
 * Assistant IA pour Poznote - Intégration OpenRouter
 * Fonctionnalités: Génération, Recherche sémantique, Tags, Notes liées, Extraction
 */

(function() {
    'use strict';
    
    const AIAssistant = {
        /**
         * Générer du contenu avec IA
         */
        async generate(action, content, options = {}) {
            try {
                const response = await fetch('api/api_ai_generate.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        action: action,
                        content: content,
                        style: options.style || 'professional',
                        max_length: options.maxLength || 3
                    })
                });
                
                const data = await response.json();
                
                if (!data.success) {
                    throw new Error(data.message || 'AI generation failed');
                }
                
                return data.result;
            } catch (error) {
                console.error('AI generation error:', error);
                throw error;
            }
        },
        
        /**
         * Recherche sémantique
         */
        async semanticSearch(query, workspace, options = {}) {
            try {
                const response = await fetch('api/api_ai_search.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        query: query,
                        workspace: workspace,
                        limit: options.limit || 10,
                        min_similarity: options.minSimilarity || 0.3
                    })
                });
                
                const data = await response.json();
                
                if (!data.success) {
                    throw new Error(data.message || 'Semantic search failed');
                }
                
                return data.results;
            } catch (error) {
                console.error('Semantic search error:', error);
                throw error;
            }
        },
        
        /**
         * Suggérer des tags
         */
        async suggestTags(noteId, title, content) {
            try {
                const response = await fetch('api/api_ai_suggest_tags.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        note_id: noteId,
                        title: title,
                        content: content
                    })
                });
                
                const data = await response.json();
                
                if (!data.success) {
                    throw new Error(data.message || 'Tag suggestion failed');
                }
                
                return data.tags;
            } catch (error) {
                console.error('Tag suggestion error:', error);
                throw error;
            }
        },
        
        /**
         * Trouver des notes liées
         */
        async findRelatedNotes(noteId, options = {}) {
            try {
                const response = await fetch('api/api_ai_related_notes.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        note_id: noteId,
                        limit: options.limit || 5,
                        min_similarity: options.minSimilarity || 0.4
                    })
                });
                
                if (!response.ok) {
                    if (response.status === 429) {
                        throw new Error('Rate limit exceeded');
                    }
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                
                if (!data.success) {
                    if (data.message && (data.message.includes('Rate limit') || data.message.includes('rate limit'))) {
                        throw new Error('Rate limit exceeded');
                    }
                    throw new Error(data.message || 'Related notes search failed');
                }
                
                return data.related_notes;
            } catch (error) {
                // Ne logger que si ce n'est pas un rate limit
                if (!error.message || !error.message.includes('Rate limit')) {
                    console.error('Related notes error:', error);
                }
                throw error;
            }
        },
        
        /**
         * Créer une note à partir d'un prompt
         */
        async createNoteFromPrompt(prompt, options = {}) {
            try {
                const response = await fetch('api/api_ai_create_note.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        prompt: prompt,
                        type: options.type || 'structured',
                        workspace: options.workspace || window.selectedWorkspace || 'Poznote',
                        folder_id: options.folderId || null,
                        folder_name: options.folderName || null
                    })
                });
                
                const data = await response.json();
                
                if (!data.success) {
                    throw new Error(data.message || 'Note creation failed');
                }
                
                return data;
            } catch (error) {
                console.error('AI note creation error:', error);
                throw error;
            }
        },
        
        /**
         * Extraire des informations structurées
         */
        async extractInformation(noteId, content) {
            try {
                const response = await fetch('api/api_ai_extract.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        note_id: noteId,
                        content: content
                    })
                });
                
                const data = await response.json();
                
                if (!data.success) {
                    throw new Error(data.message || 'Information extraction failed');
                }
                
                return data.extracted;
            } catch (error) {
                console.error('Information extraction error:', error);
                throw error;
            }
        },
        
        /**
         * Extraire les TODO / actions
         */
        async extractTodos(content, noteId = null) {
            try {
                const response = await fetch('api/api_ai_extract.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        content: content,
                        note_id: noteId,
                        mode: 'todos'
                    })
                });
                
                const data = await response.json();
                
                if (!data.success) {
                    throw new Error(data.message || 'TODO extraction failed');
                }
                
                return data.todos || [];
            } catch (error) {
                console.error('TODO extraction error:', error);
                throw error;
            }
        },
        
        /**
         * Insérer du texte généré dans l'éditeur
         */
        insertText(text, noteElement) {
            if (!noteElement) {
                noteElement = document.querySelector('.noteentry[contenteditable="true"]');
            }
            
            if (!noteElement) {
                throw new Error('No editable note found');
            }
            
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                
                // Créer un élément temporaire pour convertir le texte en HTML
                const tempDiv = document.createElement('div');
                tempDiv.textContent = text;
                const htmlText = tempDiv.innerHTML.replace(/\n/g, '<br>');
                
                const tempContainer = document.createElement('div');
                tempContainer.innerHTML = htmlText;
                
                // Sauvegarder les nœuds avant de les déplacer
                const nodesToInsert = [];
                while (tempContainer.firstChild) {
                    nodesToInsert.push(tempContainer.firstChild);
                }
                
                const fragment = document.createDocumentFragment();
                nodesToInsert.forEach(node => fragment.appendChild(node));
                
                range.insertNode(fragment);
                
                // Positionner le curseur à la fin
                // Utiliser le dernier nœud réellement inséré dans le DOM
                if (nodesToInsert.length > 0) {
                    const lastInsertedNode = nodesToInsert[nodesToInsert.length - 1];
                    if (lastInsertedNode && lastInsertedNode.parentNode) {
                        try {
                            const newRange = document.createRange();
                            newRange.setStartAfter(lastInsertedNode);
                            newRange.collapse(true);
                            selection.removeAllRanges();
                            selection.addRange(newRange);
                        } catch (e) {
                            // Fallback : placer à la fin de l'élément
                            range.selectNodeContents(noteElement);
                            range.collapse(false);
                            selection.removeAllRanges();
                            selection.addRange(range);
                        }
                    } else {
                        // Fallback : placer à la fin de l'élément
                        range.selectNodeContents(noteElement);
                        range.collapse(false);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    }
                } else {
                    // Aucun nœud inséré, placer à la fin
                    range.selectNodeContents(noteElement);
                    range.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            } else {
                // Pas de sélection, ajouter à la fin
                const textNode = document.createTextNode('\n\n' + text);
                noteElement.appendChild(textNode);
            }
            
            // Déclencher l'auto-save
            if (typeof updateident === 'function') {
                updateident(noteElement);
            }
            
            // Focus sur l'éditeur
            noteElement.focus();
        },
        
        /**
         * Remplacer le texte sélectionné
         */
        replaceSelectedText(text) {
            const noteElement = document.querySelector('.noteentry[contenteditable="true"]');
            if (!noteElement) {
                return;
            }
            
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                
                const tempDiv = document.createElement('div');
                tempDiv.textContent = text;
                const htmlText = tempDiv.innerHTML.replace(/\n/g, '<br>');
                
                const tempContainer = document.createElement('div');
                tempContainer.innerHTML = htmlText;
                
                // Sauvegarder les nœuds avant de les déplacer
                const nodesToInsert = [];
                while (tempContainer.firstChild) {
                    nodesToInsert.push(tempContainer.firstChild);
                }
                
                const fragment = document.createDocumentFragment();
                nodesToInsert.forEach(node => fragment.appendChild(node));
                
                range.insertNode(fragment);
                
                // Positionner le curseur à la fin
                // Utiliser le dernier nœud réellement inséré dans le DOM
                if (nodesToInsert.length > 0) {
                    const lastInsertedNode = nodesToInsert[nodesToInsert.length - 1];
                    if (lastInsertedNode && lastInsertedNode.parentNode) {
                        try {
                            const newRange = document.createRange();
                            newRange.setStartAfter(lastInsertedNode);
                            newRange.collapse(true);
                            selection.removeAllRanges();
                            selection.addRange(newRange);
                        } catch (e) {
                            // Fallback : placer à la fin de l'élément
                            range.selectNodeContents(noteElement);
                            range.collapse(false);
                            selection.removeAllRanges();
                            selection.addRange(range);
                        }
                    } else {
                        // Fallback : placer à la fin de l'élément
                        range.selectNodeContents(noteElement);
                        range.collapse(false);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    }
                } else {
                    // Aucun nœud inséré, placer à la fin
                    range.selectNodeContents(noteElement);
                    range.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
                
                if (typeof updateident === 'function') {
                    updateident(noteElement);
                }
            }
        },
        
        /**
         * Afficher une notification
         */
        showNotification(message, type = 'info') {
            if (typeof showNotificationPopup === 'function') {
                showNotificationPopup(message, type);
            } else {
                alert(message);
            }
        },
        
        /**
         * Afficher un indicateur de chargement
         */
        showLoading(element, message = 'Traitement en cours...') {
            if (!element) return null;
            
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'ai-loading';
            loadingDiv.innerHTML = `
                <div class="ai-loading-spinner"></div>
                <span class="ai-loading-text">${message}</span>
            `;
            loadingDiv.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(255, 255, 255, 0.95);
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 10000;
                display: flex;
                align-items: center;
                gap: 12px;
            `;
            
            const spinner = loadingDiv.querySelector('.ai-loading-spinner');
            spinner.style.cssText = `
                width: 20px;
                height: 20px;
                border: 3px solid #f3f3f3;
                border-top: 3px solid #3498db;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            `;
            
            if (!document.querySelector('style[data-ai-spinner]')) {
                const style = document.createElement('style');
                style.setAttribute('data-ai-spinner', 'true');
                style.textContent = `
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `;
                document.head.appendChild(style);
            }
            
            element.style.position = 'relative';
            element.appendChild(loadingDiv);
            
            return {
                remove: () => {
                    if (loadingDiv.parentNode) {
                        loadingDiv.parentNode.removeChild(loadingDiv);
                    }
                }
            };
        }
    };
    
    // Exposer globalement
    window.AIAssistant = AIAssistant;
    
    // Intégration avec le système de slash commands existant
    if (typeof window.SlashCommandMenu !== 'undefined') {
        // Résumer
        window.SlashCommandMenu.addCommand('ai-summarize', {
            label: 'Résumer avec IA',
            icon: '📝',
            action: async (editor) => {
                const content = editor.textContent || editor.innerText || '';
                if (!content.trim()) {
                    AIAssistant.showNotification('Sélectionnez du texte à résumer', 'warning');
                    return;
                }
                
                const loading = AIAssistant.showLoading(editor, 'Génération du résumé...');
                try {
                    const summary = await AIAssistant.generate('summarize', content);
                    loading.remove();
                    AIAssistant.replaceSelectedText(summary);
                    AIAssistant.showNotification('Résumé généré avec succès', 'success');
                } catch (error) {
                    loading.remove();
                    AIAssistant.showNotification('Erreur: ' + error.message, 'error');
                }
            }
        });
        
        // Développer
        window.SlashCommandMenu.addCommand('ai-expand', {
            label: 'Développer avec IA',
            icon: '📈',
            action: async (editor) => {
                const content = editor.textContent || editor.innerText || '';
                if (!content.trim()) {
                    AIAssistant.showNotification('Sélectionnez du texte à développer', 'warning');
                    return;
                }
                
                const loading = AIAssistant.showLoading(editor, 'Développement du texte...');
                try {
                    const expanded = await AIAssistant.generate('expand', content);
                    loading.remove();
                    AIAssistant.replaceSelectedText(expanded);
                    AIAssistant.showNotification('Texte développé avec succès', 'success');
                } catch (error) {
                    loading.remove();
                    AIAssistant.showNotification('Erreur: ' + error.message, 'error');
                }
            }
        });
        
        // Réécrire
        window.SlashCommandMenu.addCommand('ai-rewrite', {
            label: 'Réécrire avec IA',
            icon: '✍️',
            action: async (editor) => {
                const content = editor.textContent || editor.innerText || '';
                if (!content.trim()) {
                    AIAssistant.showNotification('Sélectionnez du texte à réécrire', 'warning');
                    return;
                }
                
                // Demander le style
                const style = prompt('Style de réécriture:\n1. professional\n2. casual\n3. concise\n4. detailed\n5. formal\n6. simple', 'professional');
                if (!style) return;
                
                const loading = AIAssistant.showLoading(editor, 'Réécriture en cours...');
                try {
                    const rewritten = await AIAssistant.generate('rewrite', content, { style: style });
                    loading.remove();
                    AIAssistant.replaceSelectedText(rewritten);
                    AIAssistant.showNotification('Texte réécrit avec succès', 'success');
                } catch (error) {
                    loading.remove();
                    AIAssistant.showNotification('Erreur: ' + error.message, 'error');
                }
            }
        });
        
        // Améliorer style et grammaire
        window.SlashCommandMenu.addCommand('ai-improve', {
            label: 'Améliorer le style',
            icon: '✨',
            action: async (editor) => {
                const content = editor.textContent || editor.innerText || '';
                if (!content.trim()) {
                    AIAssistant.showNotification('Sélectionnez du texte à améliorer', 'warning');
                    return;
                }
                
                const toneChoice = prompt('Style d\'amélioration:\n1. neutre (par défaut)\n2. concis\n3. formel\n4. amical\n5. technique', '1');
                const toneMap = {
                    '1': 'neutral',
                    '2': 'concise',
                    '3': 'formal',
                    '4': 'friendly',
                    '5': 'technical'
                };
                const tone = toneMap[toneChoice] || 'neutral';
                
                const loading = AIAssistant.showLoading(editor, 'Amélioration du texte...');
                try {
                    const improved = await AIAssistant.generate('improve', content, { style: tone });
                    loading.remove();
                    AIAssistant.replaceSelectedText(improved);
                    AIAssistant.showNotification('Texte amélioré avec succès', 'success');
                } catch (error) {
                    loading.remove();
                    AIAssistant.showNotification('Erreur: ' + error.message, 'error');
                }
            }
        });
        
        // Extraire TODO / actions
        window.SlashCommandMenu.addCommand('ai-todos', {
            label: 'Extraire TODO',
            icon: '✅',
            action: async (editor) => {
                const content = editor.textContent || editor.innerText || '';
                if (!content.trim()) {
                    AIAssistant.showNotification('Sélectionnez du texte ou assurez-vous que la note contient du contenu', 'warning');
                    return;
                }
                
                const loading = AIAssistant.showLoading(editor, 'Extraction des TODO...');
                try {
                    const todos = await AIAssistant.extractTodos(content);
                    loading.remove();
                    
                    if (!todos || todos.length === 0) {
                        AIAssistant.showNotification('Aucune tâche détectée', 'info');
                        return;
                    }
                    
                    const checklist = todos.map(t => `- [ ] ${t.title}`).join('\\n');
                    AIAssistant.insertText('\\n## Actions à faire\\n' + checklist + '\\n');
                    AIAssistant.showNotification('TODO ajoutés à la note', 'success');
                } catch (error) {
                    loading.remove();
                    AIAssistant.showNotification('Erreur: ' + error.message, 'error');
                }
            }
        });
        
        // Créer une note à partir d'un prompt
        window.SlashCommandMenu.addCommand('ai-create', {
            label: 'Créer une note avec IA',
            icon: '✨',
            action: async (editor) => {
                // Demander le prompt
                const prompt = prompt('Quel type de note voulez-vous créer ?\n\nExemples:\n- Plan de projet migration cloud\n- Compte-rendu de réunion\n- Liste de tâches\n- Brainstorming idées\n\nVotre prompt:');
                if (!prompt || !prompt.trim()) {
                    return;
                }
                
                // Demander le type (optionnel)
                const typeChoice = prompt('Type de note:\n1. structured (par défaut)\n2. meeting\n3. project\n4. checklist\n5. summary\n6. brainstorm\n\nChoisissez (1-6) ou laissez vide:', '1');
                const typeMap = {
                    '1': 'structured',
                    '2': 'meeting',
                    '3': 'project',
                    '4': 'checklist',
                    '5': 'summary',
                    '6': 'brainstorm'
                };
                const type = typeMap[typeChoice] || 'structured';
                
                // Afficher un loading dans l'éditeur
                const loading = AIAssistant.showLoading(editor.closest('.notecard') || document.body, 'Création de la note...');
                
                try {
                    const result = await AIAssistant.createNoteFromPrompt(prompt.trim(), {
                        type: type,
                        workspace: window.selectedWorkspace || 'Poznote',
                        folderId: window.selectedFolderId || null,
                        folderName: window.selectedFolder || null
                    });
                    
                    loading.remove();
                    
                    // Rediriger vers la nouvelle note
                    const workspace = encodeURIComponent(result.workspace || window.selectedWorkspace || 'Poznote');
                    window.location.href = `index.php?workspace=${workspace}&note=${result.note_id}&scroll=1`;
                    
                    AIAssistant.showNotification('Note créée avec succès !', 'success');
                } catch (error) {
                    loading.remove();
                    AIAssistant.showNotification('Erreur: ' + error.message, 'error');
                }
            }
        });
    }
    
    // Initialisation au chargement de la page
    document.addEventListener('DOMContentLoaded', function() {
        console.log('AIAssistant loaded and ready');
    });
})();


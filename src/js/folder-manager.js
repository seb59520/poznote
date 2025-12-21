/**
 * Folder Manager - Module pour gérer l'ordre et les dépendances des dossiers
 * Permet de réorganiser les dossiers via un modal avec boutons monter/descendre
 */

(function() {
    'use strict';

    let folderList = [];
    let currentWorkspace = null;

    /**
     * Get selected workspace
     */
    function getSelectedWorkspace() {
        try {
            if (typeof window.selectedWorkspace !== 'undefined' && window.selectedWorkspace) {
                return window.selectedWorkspace;
            }
            const urlParams = new URLSearchParams(window.location.search);
            const ws = urlParams.get('workspace');
            if (ws) return ws;
            if (typeof localStorage !== 'undefined') {
                const stored = localStorage.getItem('poznote_selected_workspace');
                if (stored) return stored;
            }
            return 'Poznote';
        } catch (e) {
            return 'Poznote';
        }
    }

    /**
     * Open folder management modal
     */
    window.openFolderManager = function() {
        currentWorkspace = getSelectedWorkspace();
        loadFolders();
        showFolderManagerModal();
    };

    /**
     * Load folders from API
     */
    function loadFolders() {
        const formData = new FormData();
        formData.append('action', 'list');
        if (currentWorkspace) {
            formData.append('workspace', currentWorkspace);
        }

        fetch('api_folders.php', {
            method: 'POST',
            body: formData,
            credentials: 'same-origin'
        })
        .then(response => response.text())
        .then(data => {
            try {
                data = data.trim();
                const result = JSON.parse(data);
                if (result.success) {
                    folderList = result.folders || [];
                    renderFolderList();
                } else {
                    showError('Erreur lors du chargement des dossiers: ' + (result.error || 'Erreur inconnue'));
                }
            } catch (e) {
                console.error('Error parsing folders:', e, data);
                showError('Erreur lors du chargement des dossiers');
            }
        })
        .catch(error => {
            console.error('Error loading folders:', error);
            showError('Erreur réseau lors du chargement des dossiers');
        });
    }

    /**
     * Build hierarchical structure from flat list
     */
    function buildHierarchy(folders) {
        const folderMap = {};
        const rootFolders = [];

        // Create map
        folders.forEach(folder => {
            folderMap[folder.id] = {
                ...folder,
                children: [],
                level: 0
            };
        });

        // Build hierarchy
        folders.forEach(folder => {
            const folderObj = folderMap[folder.id];
            if (folder.parent_id === null || !folderMap[folder.parent_id]) {
                rootFolders.push(folderObj);
            } else {
                folderMap[folder.parent_id].children.push(folderObj);
                folderObj.level = folderMap[folder.parent_id].level + 1;
            }
        });

        // Flatten for display (maintaining hierarchy order)
        const flattened = [];
        function flatten(folders, parentId = null) {
            folders.forEach(folder => {
                flattened.push({
                    ...folder,
                    parent_id: parentId
                });
                if (folder.children && folder.children.length > 0) {
                    flatten(folder.children, folder.id);
                }
            });
        }
        flatten(rootFolders);

        return flattened;
    }

    /**
     * Render folder list in modal
     */
    function renderFolderList() {
        const container = document.getElementById('folderManagerList');
        if (!container) return;

        const hierarchy = buildHierarchy(folderList);
        
        if (hierarchy.length === 0) {
            container.innerHTML = '<div class="folder-manager-empty">Aucun dossier à gérer</div>';
            return;
        }

        let html = '<div class="folder-manager-list">';
        hierarchy.forEach((folder, index) => {
            const indent = folder.level * 30;
            const hasChildren = folderList.some(f => f.parent_id === folder.id);
            const canMoveUp = index > 0;
            const canMoveDown = index < hierarchy.length - 1;
            const parentOptions = getParentOptions(folder.id);

            html += `
                <div class="folder-manager-item" data-folder-id="${folder.id}" style="padding-left: ${indent}px;">
                    <div class="folder-manager-item-content">
                        <div class="folder-manager-item-info">
                            <i class="fa fa-folder folder-icon"></i>
                            <span class="folder-name">${escapeHtml(folder.name)}</span>
                            ${hasChildren ? '<span class="folder-has-children">(contient des sous-dossiers)</span>' : ''}
                        </div>
                        <div class="folder-manager-item-controls">
                            <select class="folder-parent-select" data-folder-id="${folder.id}" title="Définir le dossier parent">
                                <option value="">Racine</option>
                                ${parentOptions}
                            </select>
                            <button class="folder-btn-move-up" onclick="moveFolderUp(${folder.id})" ${!canMoveUp ? 'disabled' : ''} title="Monter">
                                <i class="fa fa-arrow-up"></i>
                            </button>
                            <button class="folder-btn-move-down" onclick="moveFolderDown(${folder.id})" ${!canMoveDown ? 'disabled' : ''} title="Descendre">
                                <i class="fa fa-arrow-down"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;

        // Set current parent values
        hierarchy.forEach(folder => {
            const select = container.querySelector(`.folder-parent-select[data-folder-id="${folder.id}"]`);
            if (select) {
                select.value = folder.parent_id || '';
            }
        });

        // Add change listeners
        container.querySelectorAll('.folder-parent-select').forEach(select => {
            select.addEventListener('change', function() {
                const folderId = parseInt(this.getAttribute('data-folder-id'));
                const newParentId = this.value ? parseInt(this.value) : null;
                changeFolderParent(folderId, newParentId);
            });
        });
    }

    /**
     * Get parent options for select (excluding self and descendants)
     */
    function getParentOptions(excludeFolderId) {
        const excludeIds = getDescendantIds(excludeFolderId);
        excludeIds.push(excludeFolderId);

        let options = '';
        folderList.forEach(folder => {
            if (!excludeIds.includes(folder.id)) {
                const indent = '&nbsp;'.repeat((folder.level || 0) * 2);
                options += `<option value="${folder.id}">${indent}${escapeHtml(folder.name)}</option>`;
            }
        });
        return options;
    }

    /**
     * Get all descendant IDs (recursive)
     */
    function getDescendantIds(folderId) {
        const descendants = [];
        folderList.forEach(folder => {
            if (folder.parent_id === folderId) {
                descendants.push(folder.id);
                descendants.push(...getDescendantIds(folder.id));
            }
        });
        return descendants;
    }

    /**
     * Move folder up in list
     */
    window.moveFolderUp = function(folderId) {
        const hierarchy = buildHierarchy(folderList);
        const index = hierarchy.findIndex(f => f.id === folderId);
        
        if (index <= 0) return;

        // Swap with previous item (only if same parent)
        const current = hierarchy[index];
        const previous = hierarchy[index - 1];
        
        if (current.parent_id === previous.parent_id) {
            [hierarchy[index], hierarchy[index - 1]] = [hierarchy[index - 1], hierarchy[index]];
            folderList = hierarchy;
            renderFolderList();
        }
    };

    /**
     * Move folder down in list
     */
    window.moveFolderDown = function(folderId) {
        const hierarchy = buildHierarchy(folderList);
        const index = hierarchy.findIndex(f => f.id === folderId);
        
        if (index >= hierarchy.length - 1) return;

        // Swap with next item (only if same parent)
        const current = hierarchy[index];
        const next = hierarchy[index + 1];
        
        if (current.parent_id === next.parent_id) {
            [hierarchy[index], hierarchy[index + 1]] = [hierarchy[index + 1], hierarchy[index]];
            folderList = hierarchy;
            renderFolderList();
        }
    };

    /**
     * Change folder parent
     */
    function changeFolderParent(folderId, newParentId) {
        const folder = folderList.find(f => f.id === folderId);
        if (!folder) return;

        // Prevent circular dependency
        if (newParentId) {
            const descendants = getDescendantIds(folderId);
            if (descendants.includes(newParentId)) {
                showError('Impossible de définir un sous-dossier comme parent (dépendance circulaire)');
                renderFolderList(); // Reset select
                return;
            }
        }

        folder.parent_id = newParentId;
        renderFolderList();
    }

    /**
     * Save folder order and dependencies
     */
    window.saveFolderOrder = function() {
        const formData = new FormData();
        formData.append('action', 'update_order');
        if (currentWorkspace) {
            formData.append('workspace', currentWorkspace);
        }

        // Build order data
        const hierarchy = buildHierarchy(folderList);
        const orderData = hierarchy.map((folder, index) => ({
            id: folder.id,
            parent_id: folder.parent_id,
            display_order: index
        }));

        formData.append('folders', JSON.stringify(orderData));

        fetch('api_folders.php', {
            method: 'POST',
            body: formData,
            credentials: 'same-origin'
        })
        .then(response => response.text())
        .then(data => {
            try {
                data = data.trim();
                const result = JSON.parse(data);
                if (result.success) {
                    showSuccess('Ordre des dossiers sauvegardé avec succès');
                    closeFolderManagerModal();
                    // Reload page to see changes
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                } else {
                    showError('Erreur lors de la sauvegarde: ' + (result.error || 'Erreur inconnue'));
                }
            } catch (e) {
                console.error('Error saving folder order:', e, data);
                showError('Erreur lors de la sauvegarde');
            }
        })
        .catch(error => {
            console.error('Error saving folder order:', error);
            showError('Erreur réseau lors de la sauvegarde');
        });
    };

    /**
     * Show folder manager modal
     */
    function showFolderManagerModal() {
        const modal = document.getElementById('folderManagerModal');
        if (!modal) {
            createModal();
        }
        document.getElementById('folderManagerModal').style.display = 'flex';
    }

    /**
     * Close folder manager modal
     */
    window.closeFolderManagerModal = function() {
        const modal = document.getElementById('folderManagerModal');
        if (modal) {
            modal.style.display = 'none';
        }
    };

    /**
     * Create modal HTML
     */
    function createModal() {
        const modal = document.createElement('div');
        modal.id = 'folderManagerModal';
        modal.className = 'folder-manager-modal';
        modal.innerHTML = `
            <div class="folder-manager-modal-content">
                <div class="folder-manager-modal-header">
                    <h2>Gestion des dossiers</h2>
                    <button class="folder-manager-close" onclick="closeFolderManagerModal()">
                        <i class="fa fa-times"></i>
                    </button>
                </div>
                <div class="folder-manager-modal-body">
                    <div class="folder-manager-info">
                        <p>Utilisez les boutons <i class="fa fa-arrow-up"></i> et <i class="fa fa-arrow-down"></i> pour réorganiser l'ordre des dossiers.</p>
                        <p>Utilisez le menu déroulant pour définir le dossier parent (dépendance).</p>
                    </div>
                    <div id="folderManagerList"></div>
                </div>
                <div class="folder-manager-modal-footer">
                    <button class="btn btn-secondary" onclick="closeFolderManagerModal()">Annuler</button>
                    <button class="btn btn-primary" onclick="saveFolderOrder()">Enregistrer</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    /**
     * Utility functions
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showError(message) {
        if (typeof showNotificationPopup === 'function') {
            showNotificationPopup(message, 'error');
        } else {
            alert(message);
        }
    }

    function showSuccess(message) {
        if (typeof showNotificationPopup === 'function') {
            showNotificationPopup(message, 'success');
        } else {
            alert(message);
        }
    }

    // Initialize modal on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createModal);
    } else {
        createModal();
    }
})();


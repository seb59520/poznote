/**
 * Collapsible Sections (Notes dépliables) for Poznote
 * Allows users to create expandable/collapsible sections in notes
 */

(function() {
    'use strict';

    /**
     * Generate a unique ID for a collapsible section
     */
    function generateSectionId() {
        return 'collapsible-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Insert a collapsible section at the cursor position
     */
    function insertCollapsibleSection(title) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const sectionId = generateSectionId();
        const defaultTitle = title || 'Section dépliable';

        // Create the collapsible section HTML structure
        const sectionHTML = `
            <div class="collapsible-section" data-section-id="${sectionId}">
                <div class="collapsible-header" onclick="toggleCollapsibleSection('${sectionId}')">
                    <span class="collapsible-icon" id="icon-${sectionId}">▶</span>
                    <span class="collapsible-title" contenteditable="true" data-placeholder="Titre de la section">${defaultTitle}</span>
                </div>
                <div class="collapsible-content" id="content-${sectionId}" style="display: none;">
                    <div class="collapsible-body" contenteditable="true" data-placeholder="Contenu de la section...">
                        <br>
                    </div>
                </div>
            </div>
        `;

        // Create a temporary container to parse the HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = sectionHTML.trim();
        const sectionElement = tempDiv.firstElementChild;

        // Insert the section at cursor position
        range.deleteContents();
        range.insertNode(sectionElement);

        // Add a line break after the section
        const br = document.createElement('br');
        range.setStartAfter(sectionElement);
        range.insertNode(br);

        // Place cursor in the title
        const titleElement = sectionElement.querySelector('.collapsible-title');
        if (titleElement) {
            const newRange = document.createRange();
            newRange.selectNodeContents(titleElement);
            newRange.collapse(false);
            selection.removeAllRanges();
            selection.addRange(newRange);
        }

        // Trigger input event for autosave
        const noteEntry = sectionElement.closest('.noteentry');
        if (noteEntry) {
            noteEntry.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // Initialize event handlers for the new section
        initializeCollapsibleSection(sectionId);
    }

    /**
     * Toggle a collapsible section (open/close)
     */
    window.toggleCollapsibleSection = function(sectionId) {
        const content = document.getElementById('content-' + sectionId);
        const icon = document.getElementById('icon-' + sectionId);
        
        if (!content || !icon) return;

        const isOpen = content.style.display !== 'none';
        
        if (isOpen) {
            content.style.display = 'none';
            icon.textContent = '▶';
            icon.style.transform = 'rotate(0deg)';
        } else {
            content.style.display = 'block';
            icon.textContent = '▼';
            icon.style.transform = 'rotate(0deg)';
        }

        // Trigger input event for autosave (in case we want to save the state)
        const section = document.querySelector(`[data-section-id="${sectionId}"]`);
        if (section) {
            const noteEntry = section.closest('.noteentry');
            if (noteEntry) {
                noteEntry.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    };

    /**
     * Initialize event handlers for a collapsible section
     */
    function initializeCollapsibleSection(sectionId) {
        const section = document.querySelector(`[data-section-id="${sectionId}"]`);
        if (!section) return;

        // Prevent header editing from toggling the section
        const titleElement = section.querySelector('.collapsible-title');
        if (titleElement) {
            titleElement.addEventListener('click', function(e) {
                e.stopPropagation();
            });
        }

        // Prevent body editing from toggling the section
        const bodyElement = section.querySelector('.collapsible-body');
        if (bodyElement) {
            bodyElement.addEventListener('click', function(e) {
                e.stopPropagation();
            });
        }

        // Handle placeholder for title
        if (titleElement) {
            titleElement.addEventListener('focus', function() {
                if (this.textContent.trim() === 'Titre de la section') {
                    this.textContent = '';
                }
            });
            titleElement.addEventListener('blur', function() {
                if (this.textContent.trim() === '') {
                    this.textContent = 'Titre de la section';
                }
            });
        }

        // Handle placeholder for body
        if (bodyElement) {
            bodyElement.addEventListener('focus', function() {
                if (this.textContent.trim() === 'Contenu de la section...') {
                    this.textContent = '';
                }
            });
            bodyElement.addEventListener('blur', function() {
                if (this.textContent.trim() === '') {
                    this.textContent = 'Contenu de la section...';
                }
            });
        }
    }

    /**
     * Initialize all collapsible sections in a note
     */
    function initializeAllCollapsibleSections(noteId) {
        const noteEntry = document.getElementById('entry' + noteId);
        if (!noteEntry) return;

        const sections = noteEntry.querySelectorAll('.collapsible-section');
        sections.forEach(function(section) {
            const sectionId = section.getAttribute('data-section-id');
            if (sectionId) {
                initializeCollapsibleSection(sectionId);
            }
        });
    }

    /**
     * Export functions for global use
     */
    window.insertCollapsibleSection = insertCollapsibleSection;
    window.initializeCollapsibleSections = initializeAllCollapsibleSections;

    // Auto-initialize sections when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            // Initialize sections for all notes
            const noteEntries = document.querySelectorAll('.noteentry');
            noteEntries.forEach(function(entry) {
                const noteId = entry.getAttribute('data-note-id');
                if (noteId) {
                    initializeAllCollapsibleSections(noteId);
                }
            });
        });
    } else {
        // DOM already loaded
        const noteEntries = document.querySelectorAll('.noteentry');
        noteEntries.forEach(function(entry) {
            const noteId = entry.getAttribute('data-note-id');
            if (noteId) {
                initializeAllCollapsibleSections(noteId);
            }
        });
    }

    // Re-initialize when notes are loaded via AJAX
    if (typeof window.addEventListener !== 'undefined') {
        window.addEventListener('noteLoaded', function(e) {
            if (e.detail && e.detail.noteId) {
                setTimeout(function() {
                    initializeAllCollapsibleSections(e.detail.noteId);
                }, 100);
            }
        });
    }
})();


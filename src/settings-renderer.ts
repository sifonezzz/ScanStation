
import type { IScanstationAPI, Editor } from './types';




let hasPat = false;

window.addEventListener('DOMContentLoaded', async () => {
    // --- General Elements ---
    const doneBtn = document.getElementById('done-btn');
    doneBtn.addEventListener('click', () => window.api.closeSettingsWindow());

    const addOfflineRepoBtn = document.getElementById('add-offline-repo-btn');
    const addOfflineRepoModal = document.getElementById('add-offline-repo-modal');
    const offlineRepoNameInput = document.getElementById('offline-repo-name-input') as HTMLInputElement;
    const offlineModalCancelBtn = document.getElementById('offline-modal-cancel-btn');
    const offlineModalCreateBtn = document.getElementById('offline-modal-create-btn');

    addOfflineRepoBtn?.addEventListener('click', () => {
        // Clear previous input and show the modal
        if (offlineRepoNameInput) offlineRepoNameInput.value = '';
        if (addOfflineRepoModal) addOfflineRepoModal.style.display = 'flex';
    });

    offlineModalCancelBtn?.addEventListener('click', () => {
        if (addOfflineRepoModal) addOfflineRepoModal.style.display = 'none';
    });

    offlineModalCreateBtn?.addEventListener('click', async () => {
        if (!offlineRepoNameInput) return;

        const repoName = offlineRepoNameInput.value.trim();
        if (repoName) {
            const result = await window.api.addOfflineRepository(repoName);
            if (result.success) {
                alert(`Offline repository '${repoName}' created successfully!`);
                if (addOfflineRepoModal) addOfflineRepoModal.style.display = 'none';
                await populateRemoveRepoDropdown(); // Refresh the list
            }
            // Errors from the main process will be shown as dialogs
        }
    });
    
    // --- Editor Path Logic ---
    const inputs: { [key in Editor]: HTMLInputElement } = {
        photoshop: document.getElementById('photoshopPath') as HTMLInputElement,
        illustrator: document.getElementById('illustratorPath') as HTMLInputElement,
        gimp: document.getElementById('gimpPath') as HTMLInputElement,
    };
    const createShortcutBtn = document.getElementById('create-shortcut-btn');
        createShortcutBtn.addEventListener('click', async () => {
            const result = await window.api.createDesktopShortcut();
            if (result.success) {
                alert('Desktop shortcut created successfully!');
            } else {
                alert(`Failed to create shortcut: ${result.error}`);
            }
        });

    const currentPaths = await window.api.getEditorPaths();
    for (const editor in currentPaths) {
        // Cast the key to a type that can index the 'inputs' object
        const key = editor as keyof typeof inputs;
        if (inputs[key] && currentPaths[key]) {
            inputs[key].value = currentPaths[key];
        }
    }
    document.querySelectorAll('.browse-btn').forEach(button => {
        button.addEventListener('click', async () => {
            const editor = (button as HTMLElement).dataset.editor as Editor;
            const selectedPath = await window.api.selectEditorPath();
            if (selectedPath) {
                inputs[editor].value = selectedPath;
                window.api.setEditorPath({ editor: editor, path: selectedPath });
            }
        });
    });

    // --- Token Management Logic ---
    const setTokenBtn = document.getElementById('set-token-btn');
    const setTokenModal = document.getElementById('set-token-modal');
    const tokenInput = document.getElementById('token-input') as HTMLInputElement;
    const tokenCancelBtn = document.getElementById('token-cancel-btn');
    const tokenSaveBtn = document.getElementById('token-save-btn');

    const updateSetTokenButton = async () => {
        hasPat = await window.api.getPatStatus();
        if (hasPat) {
            setTokenBtn.textContent = 'Remove Token';
            (setTokenBtn as HTMLButtonElement).style.backgroundColor = '#f04747'; // Red
        } else {
            setTokenBtn.textContent = 'Set Token';
            (setTokenBtn as HTMLButtonElement).style.backgroundColor = ''; // Default
        }
    };
    setTokenBtn.addEventListener('click', async () => {
        if (hasPat) {
            await window.api.removePat();
            alert('Access token removed successfully.');
            updateSetTokenButton();
        } else {
            tokenInput.value = '';
            setTokenModal.style.display = 'flex';
        }
    });
    tokenCancelBtn.addEventListener('click', () => setTokenModal.style.display = 'none');
    tokenSaveBtn.addEventListener('click', async () => {
        const token = tokenInput.value.trim();
        if (token) {
            await window.api.setPat(token);
            alert("Access token saved successfully!");
            setTokenModal.style.display = 'none';
            updateSetTokenButton();
        }
    });
    
    // --- Add Repository Logic ---
    const addRepoBtn = document.getElementById('add-repo-btn');
    const addRepoModal = document.getElementById('add-repo-modal');
    const repoUrlInput = document.getElementById('repo-url-input') as HTMLInputElement;
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalPullBtn = document.getElementById('modal-pull-btn') as HTMLButtonElement;

    addRepoBtn.addEventListener('click', () => {
        repoUrlInput.value = '';
        addRepoModal.style.display = 'flex';
    });
    modalCancelBtn.addEventListener('click', () => addRepoModal.style.display = 'none');
    modalPullBtn.addEventListener('click', async () => {
    const url = repoUrlInput.value.trim();
    if (!url) return;

    // Define the spinner SVG and get the button's original text
    const spinnerSVG = `<svg class="spinner" viewBox="0 0 50 50"><circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle></svg>`;
    const originalText = modalPullBtn.textContent;

    // Set the button to its loading state
    modalPullBtn.innerHTML = spinnerSVG;
    modalPullBtn.disabled = true;

    try {
        const result = await window.api.addRepository(url);
        if (result.success) {
            if (addRepoModal) addRepoModal.style.display = 'none';
            alert('Repository added successfully!');
            await populateRemoveRepoDropdown();
        }
        // If result.success is false, the main process shows an error dialog
    } finally {
        // IMPORTANT: Always restore the button to its normal state
        modalPullBtn.innerHTML = originalText;
        modalPullBtn.disabled = false;
    }
});

    const removeRepoDropdown = document.getElementById('repo-to-remove-dropdown') as HTMLSelectElement;
    const removeRepoBtn = document.getElementById('remove-repo-btn');

    const populateRemoveRepoDropdown = async () => {
        const { repositories } = await window.api.getRepositories();
        removeRepoDropdown.innerHTML = ''; // Clear existing options

        if (repositories.length === 0) {
            const option = document.createElement('option');
            option.textContent = 'No repositories to remove';
            removeRepoDropdown.appendChild(option);
            (removeRepoBtn as HTMLButtonElement).disabled = true;
        } else {
            repositories.forEach(repo => {
                const option = document.createElement('option');
                option.value = repo;
                option.textContent = repo;
                removeRepoDropdown.appendChild(option);
            });
            (removeRepoBtn as HTMLButtonElement).disabled = false;
        }
    };

    removeRepoBtn.addEventListener('click', async () => {
        const repoToRemove = removeRepoDropdown.value;
        if (repoToRemove) {
            const result = await window.api.removeRepository(repoToRemove);
            if (result.success) {
                alert(`Successfully removed '${repoToRemove}'.`);
                await populateRemoveRepoDropdown(); // Refresh the list
            }
        }
    });

    // Initial population of the dropdown
    await populateRemoveRepoDropdown();

    // Initial state
    updateSetTokenButton();
});

export {};
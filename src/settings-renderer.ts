declare global {
  interface Window {
    api: {
      getEditorPaths: () => Promise<{ [key: string]: string }>;
      selectEditorPath: () => Promise<string | null>;
      setEditorPath: (data: { editor: string, path: string }) => void;
      closeSettingsWindow: () => void;
      // APIs moved from main renderer
      getPatStatus: () => Promise<boolean>;
      removePat: () => Promise<void>;
      setPat: (token: string) => Promise<void>;
      addRepository: (url: string) => Promise<{ success: boolean }>;
    };
  }
}

let hasPat = false;

window.addEventListener('DOMContentLoaded', async () => {
    // --- General Elements ---
    const doneBtn = document.getElementById('done-btn');
    doneBtn.addEventListener('click', () => window.api.closeSettingsWindow());

    // --- Editor Path Logic ---
    const inputs = {
        photoshop: document.getElementById('photoshopPath') as HTMLInputElement,
        illustrator: document.getElementById('illustratorPath') as HTMLInputElement,
        gimp: document.getElementById('gimpPath') as HTMLInputElement,
    };
    const currentPaths = await window.api.getEditorPaths();
    for (const editor in currentPaths) {
        if (inputs[editor] && currentPaths[editor]) {
            inputs[editor].value = currentPaths[editor];
        }
    }
    document.querySelectorAll('.browse-btn').forEach(button => {
        button.addEventListener('click', async () => {
            const editor = (button as HTMLElement).dataset.editor;
            const selectedPath = await window.api.selectEditorPath();
            if (selectedPath) {
                inputs[editor].value = selectedPath;
                window.api.setEditorPath({ editor, path: selectedPath });
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
    const modalPullBtn = document.getElementById('modal-pull-btn');

    addRepoBtn.addEventListener('click', () => {
        repoUrlInput.value = '';
        addRepoModal.style.display = 'flex';
    });
    modalCancelBtn.addEventListener('click', () => addRepoModal.style.display = 'none');
    modalPullBtn.addEventListener('click', async () => {
        const url = repoUrlInput.value.trim();
        if (!url) return;
        const result = await window.api.addRepository(url);
        if (result.success) {
            addRepoModal.style.display = 'none';
            alert('Repository added successfully! The list will refresh when you close settings.');
        }
        // Error is handled by main process
    });

    // Initial state
    updateSetTokenButton();
});

export {};
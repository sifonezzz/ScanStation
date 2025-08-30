import type { Editor } from './types';
import type { IScanstationAPI } from './types';

declare global {
  interface Window {
    api: IScanstationAPI;
  }
}

let selectedCoverPath: string | null = null;
let currentRepoName: string | null = null;

window.addEventListener('DOMContentLoaded', () => {
  const nameInput = document.getElementById('project-name') as HTMLInputElement;
  const imageSelect = document.getElementById('cover-image-select');
  const cancelBtn = document.getElementById('cancel-btn');
  const createBtn = document.getElementById('create-btn') as HTMLButtonElement;

  const checkFormState = () => {
    if (nameInput.value.trim() && selectedCoverPath) {
      createBtn.classList.add('enabled');
      createBtn.disabled = false;
    } else {
      createBtn.classList.remove('enabled');
      createBtn.disabled = true;
    }
  };

  // 1. Receive the repository name from the main process
  window.api.onProjectDataForCreateProject((data) => {
    currentRepoName = data.repoName;
  });

  // 2. Handle cover image selection
  imageSelect.addEventListener('click', () => {
    window.api.selectCoverImage();
  });

  window.api.onCoverImageSelected((path) => {
    selectedCoverPath = path;
    const formattedPath = path.replace(/\\/g, '/');
    const imageUrl = `scanstation-asset:///${formattedPath}`;
    imageSelect.style.backgroundImage = `url('${imageUrl}')`;
    imageSelect.textContent = ''; // Clear the "Click to select..." text
    checkFormState();
  });
  
  // 3. Monitor name input
  nameInput.addEventListener('input', checkFormState);

  // 4. Handle cancel and create actions
  cancelBtn.addEventListener('click', () => {
    window.api.cancelProjectCreation();
  });

  createBtn.addEventListener('click', () => {
    const projectName = nameInput.value.trim();
    if (projectName && selectedCoverPath && currentRepoName) {
      window.api.submitProjectCreation({
        repoName: currentRepoName,
        name: projectName,
        path: selectedCoverPath,
      });
    }
  });

  // 5. Initial check
  checkFormState();
});

export {};
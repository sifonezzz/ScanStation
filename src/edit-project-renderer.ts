// REPLACE THE ENTIRE CONTENT of this file WITH THIS:
// (Notice the instructional comment and the "declare global" block are both gone)

import type { IScanstationAPI, Editor } from './types';

declare const api: IScanstationAPI;
let currentRepoName: string | null = null;
let originalProjectName: string | null = null;
let newCoverPath: string | null = null;

window.addEventListener('DOMContentLoaded', () => {
  const nameInput = document.getElementById('project-name') as HTMLInputElement;
  const imageSelect = document.getElementById('cover-image-select');
  const cancelBtn = document.getElementById('cancel-btn');
  const saveBtn = document.getElementById('save-btn');

  // 1. Receive existing project data from main process
  window.api.onProjectDataForEdit((data) => {
    currentRepoName = data.repoName;
    originalProjectName = data.name;

    nameInput.value = data.name;

    const formattedPath = data.coverPath.replace(/\\/g, '/');
    const imageUrl = `scanstation-asset:///${formattedPath}`;
    imageSelect.style.backgroundImage = `url('${imageUrl}')`;
    imageSelect.textContent = ''; // Clear placeholder text
  });

  // 2. Handle new cover image selection
  imageSelect.addEventListener('click', () => {
    window.api.selectCoverImage();
  });

  window.api.onCoverImageSelected((path) => {
    newCoverPath = path; // Store the path to the new image
    const formattedPath = path.replace(/\\/g, '/');
    const imageUrl = `scanstation-asset:///${formattedPath}`;
    imageSelect.style.backgroundImage = `url('${imageUrl}')`;
  });

  // 3. Handle button clicks
  cancelBtn.addEventListener('click', () => {
    window.api.cancelProjectUpdate();
  });

  saveBtn.addEventListener('click', async () => {
    const newName = nameInput.value.trim();
    if (!newName) {
      alert('Project name cannot be empty.');
      return;
    }

    if (currentRepoName && originalProjectName) {
      await window.api.submitProjectUpdate({
        repoName: currentRepoName,
        originalName: originalProjectName,
        newName: newName,
        newCoverPath: newCoverPath, // Can be null if not changed
      });
    }
  });
});

export {};
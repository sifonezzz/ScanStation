declare global {
  interface Window {
    api: {
      // API for receiving the initial project data from the main process
      onProjectDataForEdit: (callback: (data: { name: string; coverPath: string }) => void) => void;
      // Re-using the same image selection logic as the create window
      selectCoverImage: () => void;
      onCoverImageSelected: (callback: (path: string) => void) => void;
      // API for submitting the final changes
      submitProjectUpdate: (data: { originalName: string; newName: string; newCoverPath: string | null }) => void;
      // API to close the window
      cancelProjectUpdate: () => void;
    };
  }
}

let newCoverPath: string | null = null;

window.addEventListener('DOMContentLoaded', () => {
  const nameInput = document.getElementById('project-name') as HTMLInputElement;
  const originalNameInput = document.getElementById('original-project-name') as HTMLInputElement;
  const imageSelect = document.getElementById('cover-image-select');
  const cancelBtn = document.getElementById('cancel-btn');
  const saveBtn = document.getElementById('save-btn');

  // 1. Listen for the initial project data from the main process and populate the form
  window.api.onProjectDataForEdit((data) => {
    nameInput.value = data.name;
    originalNameInput.value = data.name; // Store the original name

    const formattedPath = data.coverPath.replace(/\\/g, '/');
    const imageUrl = `scanstation-asset://local/${formattedPath}`;
    imageSelect.style.backgroundImage = `url('${imageUrl}')`;
    imageSelect.textContent = '';
  });

  // 2. Handle new cover image selection
  imageSelect.addEventListener('click', () => {
    window.api.selectCoverImage();
  });

  window.api.onCoverImageSelected((path) => {
    newCoverPath = path; // Store the path of the *new* image
    const formattedPath = path.replace(/\\/g, '/');
    const imageUrl = `scanstation-asset://local/${formattedPath}`;
    imageSelect.style.backgroundImage = `url('${imageUrl}')`;
  });

  // 3. Handle cancel and save actions
  cancelBtn.addEventListener('click', () => {
    window.api.cancelProjectUpdate();
  });

  saveBtn.addEventListener('click', () => {
    const originalName = originalNameInput.value;
    const newName = nameInput.value.trim();
    if (newName) {
      window.api.submitProjectUpdate({ originalName, newName, newCoverPath });
    } else {
      alert('Project name cannot be empty.');
    }
  });
});

export {};
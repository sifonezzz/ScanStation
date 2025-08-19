declare global {
  interface Window {
    api: {
      selectCoverImage: () => void;
      onCoverImageSelected: (callback: (path: string) => void) => void;
      submitProjectCreation: (name: string, path: string) => void;
      cancelProjectCreation: () => void;
    };
  }
}

let coverImagePath: string | null = null;
let projectName: string | null = null;

function validateForm() {
  const createBtn = document.getElementById('create-btn');
  if (coverImagePath && projectName) {
    createBtn.classList.add('enabled');
  } else {
    createBtn.classList.remove('enabled');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const nameInput = document.getElementById('project-name') as HTMLInputElement;
  const imageSelect = document.getElementById('cover-image-select');
  const cancelBtn = document.getElementById('cancel-btn');
  const createBtn = document.getElementById('create-btn');

  nameInput.addEventListener('input', () => {
    projectName = nameInput.value.trim() ? nameInput.value.trim() : null;
    validateForm();
  });

  imageSelect.addEventListener('click', () => {
    window.api.selectCoverImage();
  });

  cancelBtn.addEventListener('click', () => {
    window.api.cancelProjectCreation();
  });

  createBtn.addEventListener('click', () => {
    if (createBtn.classList.contains('enabled')) {
      window.api.submitProjectCreation(projectName, coverImagePath);
    }
  });

  // *** THIS IS THE FIX FOR THE PREVIEW ***
  window.api.onCoverImageSelected((path) => {
    coverImagePath = path;
    // Format the path for CSS and set it as the background image
    const imageUrl = `file://${path.replace(/\\/g, '/')}`;
    imageSelect.style.backgroundImage = `url('${imageUrl}')`;
    imageSelect.textContent = ''; // Clear the "Click to select" text
    validateForm();
  });
});

export {};
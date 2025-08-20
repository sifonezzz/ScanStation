declare global {
  interface Window {
    api: {
      createProject: (repoName: string) => void;
      onProjectsLoaded: (callback: (projects: Project[]) => void) => void;
      openProject: (repoName: string, projectName: string) => void;
      deleteProject: (repoName: string, projectName: string) => Promise<void>;
      openEditProjectWindow: (repoName: string, projectName: string) => void;
      loadProjects: (repoName: string) => void;
      getRepositories: () => Promise<{ repositories: string[], selected: string | null }>;
      setSelectedRepository: (repoName: string) => void;
      addRepository: (repoUrl: string) => Promise<{ success: boolean, repoName?: string }>;
      gitSyncRepository: (repoName: string) => Promise<{ success: boolean, message?: string }>;
      // Updated Token APIs
      getPatStatus: () => Promise<boolean>;
      setPat: (token: string) => Promise<void>;
      removePat: () => Promise<void>;
    };
  }
  interface Project {
    name: string;
    coverPath: string;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const createProjectBtn = document.getElementById('create-project-btn');
  const editBtn = document.getElementById('edit-btn');
  const projectGrid = document.getElementById('project-grid');
  const repoDropdown = document.getElementById('repo-dropdown') as HTMLSelectElement;
  const addRepoBtn = document.getElementById('add-repo-btn');
  const pushRepoBtn = document.getElementById('push-repo-btn');
  const setTokenBtn = document.getElementById('set-token-btn');

  const addRepoModal = document.getElementById('add-repo-modal');
  const modalCancelBtn = document.getElementById('modal-cancel-btn');
  const modalPullBtn = document.getElementById('modal-pull-btn');
  const repoUrlInput = document.getElementById('repo-url-input') as HTMLInputElement;

  const setTokenModal = document.getElementById('set-token-modal');
  const tokenInput = document.getElementById('token-input') as HTMLInputElement;
  const tokenCancelBtn = document.getElementById('token-cancel-btn');
  const tokenSaveBtn = document.getElementById('token-save-btn');

  let isEditMode = false;
  let currentRepositories: string[] = [];
  let selectedRepository: string | null = null;
  let hasPat = false; // State variable to track if PAT is set

  async function initialize() {
    hasPat = await window.api.getPatStatus();
    updateSetTokenButton();

    const { repositories, selected } = await window.api.getRepositories();
    currentRepositories = repositories;
    selectedRepository = selected;
    updateRepoDropdown();

    if (selectedRepository) {
      window.api.loadProjects(selectedRepository);
    } else {
		projectGrid.innerHTML = `<p style="color: #99aab5; text-align: center;">Please add a repository to get started!</p>`;
	}
  }

  function updateSetTokenButton() {
    if (hasPat) {
        setTokenBtn.textContent = 'Remove Token';
        setTokenBtn.style.backgroundColor = '#f04747'; // Red color
    } else {
        setTokenBtn.textContent = 'Set Token';
        setTokenBtn.style.backgroundColor = ''; // Default color
    }
  }

  function updateRepoDropdown() {
    repoDropdown.innerHTML = '';
    if (currentRepositories.length === 0) {
        const option = document.createElement('option');
        option.textContent = 'No repositories added';
        repoDropdown.appendChild(option);
        return;
    }
    for (const repo of currentRepositories) {
        const option = document.createElement('option');
        option.value = repo;
        option.textContent = repo;
        repoDropdown.appendChild(option);
    }
    repoDropdown.value = selectedRepository;
  }

  createProjectBtn.addEventListener('click', () => {
    if (!selectedRepository) {
        alert('Please add and select a repository first.');
        return;
    }
    window.api.createProject(selectedRepository);
  });

  editBtn.addEventListener('click', () => {
    isEditMode = !isEditMode;
    if (isEditMode) {
      editBtn.textContent = 'Done';
      editBtn.style.backgroundColor = '#7289da';
      projectGrid.classList.add('edit-mode');
    } else {
      editBtn.textContent = 'Edit';
      editBtn.style.backgroundColor = '';
      projectGrid.classList.remove('edit-mode');
    }
  });
  
  pushRepoBtn.addEventListener('click', async () => {
    if (!selectedRepository) {
        alert('Please select a repository to sync.');
        return;
    }
    const originalText = pushRepoBtn.textContent;
    pushRepoBtn.textContent = 'Syncing...';
    pushRepoBtn.setAttribute('disabled', 'true');
    try {
        const result = await window.api.gitSyncRepository(selectedRepository);
        alert(result.message);
    } catch (error) {
        alert(`Failed to sync repository: ${error.message}`);
    } finally {
        pushRepoBtn.textContent = originalText;
        pushRepoBtn.removeAttribute('disabled');
    }
  });

  setTokenBtn.addEventListener('click', async () => {
    if (hasPat) {
        // If token exists, remove it
        await window.api.removePat();
        hasPat = false;
        alert('Access token removed successfully.');
        updateSetTokenButton();
    } else {
        // If no token, open the modal to set one
        tokenInput.value = '';
        setTokenModal.style.display = 'flex';
    }
  });

  tokenCancelBtn.addEventListener('click', () => {
    setTokenModal.style.display = 'none';
  });

  tokenSaveBtn.addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    if (token) {
        await window.api.setPat(token);
        hasPat = true;
        alert("Access token saved successfully!");
        updateSetTokenButton();
        setTokenModal.style.display = 'none';
    }
  });

  repoDropdown.addEventListener('change', () => {
    const newRepo = repoDropdown.value;
    selectedRepository = newRepo;
    window.api.setSelectedRepository(newRepo);
  });

  addRepoBtn.addEventListener('click', () => {
    repoUrlInput.value = '';
    addRepoModal.style.display = 'flex';
  });

  modalCancelBtn.addEventListener('click', () => {
    addRepoModal.style.display = 'none';
  });

  modalPullBtn.addEventListener('click', async () => {
    const url = repoUrlInput.value.trim();
    if (!url) return;
    
    modalPullBtn.textContent = 'Pulling...';
    modalPullBtn.setAttribute('disabled', 'true');

    const result = await window.api.addRepository(url);
    if (result.success) {
      if (!currentRepositories.includes(result.repoName)) {
        currentRepositories.push(result.repoName);
      }
      selectedRepository = result.repoName;
      updateRepoDropdown();
      window.api.setSelectedRepository(result.repoName);
      addRepoModal.style.display = 'none';
    }

    modalPullBtn.textContent = 'Pull Files';
    modalPullBtn.removeAttribute('disabled');
    repoUrlInput.value = '';
  });

  window.api.onProjectsLoaded((projects) => {
    projectGrid.innerHTML = '';

    if (!selectedRepository) {
        projectGrid.innerHTML = `<p style="color: #99aab5; text-align: center;">Please add and select a repository to get started!</p>`;
        return;
    }
    
    if (projects.length === 0) {
      projectGrid.innerHTML = `<p style="color: #99aab5; text-align: center;">No projects found in this repository. Click '+ New Project' to get started!</p>`;
      return;
    }

    for (const project of projects) {
      const card = document.createElement('div');
      card.className = 'project-card';
      
      const formattedPath = project.coverPath.replace(/\\/g, '/');
      const imageUrl = `scanstation-asset://local/${formattedPath}`;
      card.style.backgroundImage = `url('${imageUrl}')`;

      const title = document.createElement('div');
      title.className = 'project-title';
      title.textContent = project.name;
      
      const overlay = document.createElement('div');
      overlay.className = 'project-card-overlay';

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'project-action-btn delete-btn';
      deleteBtn.textContent = '-';
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await window.api.deleteProject(selectedRepository, project.name);
      });

      const editProjectBtn = document.createElement('button');
      editProjectBtn.className = 'project-action-btn edit-project-btn';
      editProjectBtn.textContent = 'Edit';
      editProjectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.api.openEditProjectWindow(selectedRepository, project.name);
      });

      overlay.appendChild(deleteBtn);
      overlay.appendChild(editProjectBtn);
      card.appendChild(title);
      card.appendChild(overlay);

      card.addEventListener('click', () => {
        if (!isEditMode) {
          window.api.openProject(selectedRepository, project.name);
        }
      });
      projectGrid.appendChild(card);
    }
  });

  initialize();
});

export {};
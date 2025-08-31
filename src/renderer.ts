import type { IScanstationAPI, Editor } from './types';

let currentRepoName: string | null = null;
let currentProjectName: string | null = null;
// --- State for Project Screen ---
let isEditMode = false;
let projectGrid: HTMLElement;
let currentRepositories: string[] = [];
let selectedRepository: string | null = null;
let hasPat = false;

window.addEventListener('DOMContentLoaded', () => {
  // --- Screen Containers ---
  const projectScreen = document.getElementById('project-screen');
  const chapterScreen = document.getElementById('chapter-screen');

  // --- Elements for Project Screen ---
  const createProjectBtn = document.getElementById('create-project-btn');
  const editBtn = document.getElementById('edit-btn');
  projectGrid = document.getElementById('project-grid');
  const repoDropdown = document.getElementById('repo-dropdown') as HTMLSelectElement;
  const pushRepoBtn = document.getElementById('push-repo-btn');
  const pullRepoBtn = document.getElementById('pull-repo-btn');
  const settingsBtn = document.getElementById('settings-btn');

  // --- Elements for Chapter Screen ---
  const projectNameHeader = document.getElementById('project-name-header');
  const chapterGrid = document.getElementById('chapter-grid');
  const createChapterBtn = document.getElementById('create-chapter-btn');
  const backBtn = document.getElementById('back-to-projects-btn');

  // --- Listen for updates from other windows ---
  window.api.onRepositoriesUpdated(() => {
    console.log('Repositories updated, re-initializing main view...');
    initializeProjectView();
  });

  // --- CHAPTER SCREEN LOGIC ---
  window.api.onShowChapterSelection((data) => {
    showChapterSelection(data.repoName, data.projectName);
  });

  window.api.onChaptersLoaded((chapters) => {
    chapterGrid.innerHTML = '';
    if (chapters.length === 0) {
        chapterGrid.innerHTML = `<p style="color: #99aab5; text-align: center;">No chapters found. Click '+ New Chapter' to get started!</p>`;
        return;
    }
    for (const chapter of chapters) {
        const card = document.createElement('div');
        card.className = 'chapter-card';
        card.textContent = chapter.name.replace(/_/g, ' ');
        card.addEventListener('click', () => {
          window.api.openProject(currentRepoName, currentProjectName, chapter.name);
        });
        chapterGrid.appendChild(card);
    }
  });

  createChapterBtn.addEventListener('click', () => {
      if (currentRepoName && currentProjectName) {
          window.api.openCreateChapterWindow(currentRepoName, currentProjectName);
      }
  });

  settingsBtn.addEventListener('click', () => {
    window.api.openSettingsWindow();
  });

  backBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (projectScreen && chapterScreen) {
        chapterScreen.style.display = 'none';
        projectScreen.style.display = 'block';
    }
  });

  // --- PROJECT SCREEN LOGIC ---
  editBtn.addEventListener('click', () => {
    isEditMode = !isEditMode;
    projectGrid.classList.toggle('edit-mode', isEditMode);
    editBtn.textContent = isEditMode ? 'Done' : 'Edit';
  });

  createProjectBtn.addEventListener('click', () => {
    if (!selectedRepository) {
        alert('Please add and select a repository first.');
        return;
    }
    window.api.createProject(selectedRepository);
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

  pullRepoBtn.addEventListener('click', async () => {
    if (!selectedRepository) {
        alert('Please select a repository to pull from.');
        return;
    }
    const originalText = pullRepoBtn.textContent;
    pullRepoBtn.textContent = 'Pulling...';
    pullRepoBtn.setAttribute('disabled', 'true');
    try {
        const result = await window.api.gitPull(selectedRepository);
        alert(result.message);
        window.api.loadProjects(selectedRepository);
    } catch (error) {
         alert(`Failed to pull repository: ${error.message}`);
    } finally {
        pullRepoBtn.textContent = originalText;
        pullRepoBtn.removeAttribute('disabled');
    }
  });

  repoDropdown.addEventListener('change', () => {
    const newRepo = repoDropdown.value;
    selectedRepository = newRepo;
    window.api.setSelectedRepository(newRepo);
  });

  window.api.onProjectsLoaded((projects) => {
    projectGrid.innerHTML = '';

    if (!selectedRepository) {
        projectGrid.innerHTML = `<p style="color: #99aab5; text-align: center;">Please add and select a repository to get started!</p>`;
        return;
    }
    
    if (projects.length === 0) {
      projectGrid.innerHTML = `<p style="color: #99aab5; text-align: center;">No projects found. Click '+ New Project' to get started!</p>`;
      return;
    }

    for (const project of projects) {
      const card = document.createElement('div');
      card.className = 'project-card';
      
      const formattedPath = project.coverPath.replace(/\\/g, '/');
      const imageUrl = `scanstation-asset:///${formattedPath}`;
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
          showChapterSelection(selectedRepository, project.name);
        }
      });
      projectGrid.appendChild(card);
    }
  });

  // --- Initial Load ---
  initializeProjectView();
  checkAndSetGitIdentity();
});

async function checkAndSetGitIdentity() {
    const identity = await window.api.getGitIdentity();
    if (identity.name && identity.email) {
        return; // Identity is already set, do nothing.
    }

    const modal = document.getElementById('git-identity-modal');
    const nameInput = document.getElementById('git-name-input') as HTMLInputElement;
    const emailInput = document.getElementById('git-email-input') as HTMLInputElement;
    const saveBtn = document.getElementById('git-identity-save-btn');
    
    nameInput.value = identity.name || '';
    emailInput.value = identity.email || '';
    modal.style.display = 'flex';

    saveBtn.addEventListener('click', async () => {
        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        if (name && email) {
            const result = await window.api.setGitIdentity({ name, email });
            if (result.success) {
                modal.style.display = 'none';
                initializeProjectView(); // Reload projects after setting identity
            } else {
                alert(`Failed to set Git identity: ${result.error}`);
            }
        } else {
            alert('Please enter both your username and email.');
        }
    });
}

async function initializeProjectView() {
    const { repositories, selected } = await window.api.getRepositories();
    currentRepositories = repositories;
    selectedRepository = selected;
    updateRepoDropdown();
    if (selectedRepository) {
        window.api.loadProjects(selectedRepository);
    } else {
        projectGrid.innerHTML = `<p style="color: #99aab5; text-align: center;">Please add a repository and select it to get started!</p>`;
    }
}

function updateRepoDropdown() {
    const repoDropdown = document.getElementById('repo-dropdown') as HTMLSelectElement;
    if (!repoDropdown) return; // Add a guard clause in case element is not found
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

function showChapterSelection(repoName: string, projectName: string) {
  // Store the current project context
  currentRepoName = repoName;
  currentProjectName = projectName;

  // Get the screen containers that already exist in index.html
  const projectScreen = document.getElementById('project-screen');
  const chapterScreen = document.getElementById('chapter-screen');
  
  // Get elements from the existing chapter screen to populate them
  const projectNameHeader = document.getElementById('project-name-header');
  const chapterGrid = document.getElementById('chapter-grid');

  // Ensure all elements were found before proceeding
  if (!projectScreen || !chapterScreen || !projectNameHeader || !chapterGrid) {
    console.error('Could not find required elements to show chapter screen.');
    return;
  }

  // 1. Hide the project screen and show the chapter screen
  projectScreen.style.display = 'none';
  chapterScreen.style.display = 'block';

  // 2. Set the header title
  projectNameHeader.textContent = projectName;
  
  // 3. Clear the grid and show a loading message
  chapterGrid.innerHTML = `<p style="color: #99aab5; text-align: center;">Loading chapters...</p>`;
  
  // 4. Request the chapters for the selected project
  window.api.getChapters(repoName, projectName);
}
export {};
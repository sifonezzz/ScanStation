import type { Editor } from './types';
import type { IScanstationAPI } from './types';

declare global {
  interface Window {
    api: IScanstationAPI;
  }
}

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
  editBtn.addEventListener('click', () => {
    isEditMode = !isEditMode; // Toggle the edit mode state
    projectGrid.classList.toggle('edit-mode', isEditMode);
    editBtn.textContent = isEditMode ? 'Done' : 'Edit';
  });
  
  const pushRepoBtn = document.getElementById('push-repo-btn');
  const pullRepoBtn = document.getElementById('pull-repo-btn');
  const settingsBtn = document.getElementById('settings-btn');

  // --- Elements for Chapter Screen ---
  const projectNameHeader = document.getElementById('project-name-header');
  const chapterGrid = document.getElementById('chapter-grid');
  const createChapterBtn = document.getElementById('create-chapter-btn');
  const backBtn = document.getElementById('back-to-projects-btn');
  const statusBtn = document.getElementById('git-status-btn');
  const gitPushBtn = document.getElementById('git-push-btn');
  const changedFilesDiv = document.getElementById('git-changed-files');
  const commitMessageInput = document.getElementById('git-commit-message') as HTMLInputElement;
  const commitBtn = document.getElementById('git-commit-btn');

  // --- Screen Navigation Logic ---


  // --- CHAPTER SCREEN LOGIC ---
  const showGitStatus = (text: string) => {
    changedFilesDiv.textContent = text;
  };

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
      // This function requires the repo and project name to know where to go back to
      window.api.goBackToProjects(currentRepoName, currentProjectName);
  });

  statusBtn.addEventListener('click', async () => {
    if (!currentRepoName) return;
    showGitStatus('Checking for changes...');
    try {
        const status = await window.api.gitStatus(currentRepoName);
        const changed = status.files.length;
        if (changed === 0) {
            showGitStatus('No changes detected.');
        } else {
            const fileList = status.files.map((f: { working_dir: string, path: string }) => `${f.working_dir} ${f.path}`).join('\n');
            showGitStatus(`${changed} file(s) changed:\n${fileList}`);
        }
    } catch (error) {
        showGitStatus(`Error checking status: ${error.message}`);
    }
  });

  commitBtn.addEventListener('click', async () => {
    if (!currentRepoName) return;
    const message = commitMessageInput.value.trim();
    if (!message) {
        alert('Please enter a commit message.');
        return;
    }
    showGitStatus('Committing...');
    try {
        await window.api.gitCommit(currentRepoName, message);
        commitMessageInput.value = '';
        showGitStatus('Commit successful! Ready to push.');
        await statusBtn.click(); // Refresh status
    } catch (error) {
        showGitStatus(`Error committing: ${error.message}`);
    }
  });

  gitPushBtn.addEventListener('click', async () => {
    if (!currentRepoName) return;
    showGitStatus('Pushing changes to GitHub...');
    try {
        await window.api.gitPush(currentRepoName);
        showGitStatus('Push successful! Your repository is up to date.');
    } catch (error) {
        showGitStatus(`Error pushing: ${error.message}\nMake sure you are a collaborator and have set a valid Personal Access Token.`);
    }
  });


  // --- PROJECT SCREEN LOGIC ---
  async function initialize() {
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

      // MODIFIED CLICK EVENT
      card.addEventListener('click', () => {
        if (!isEditMode) {
          // Instead of opening the project directly, show the chapter list
          showChapterSelection(selectedRepository, project.name);
        }
      });
      projectGrid.appendChild(card);
    }
});

  initialize();
});

function showChapterSelection(repoName: string, projectName: string) {
  // 1. Get a reference to the main project screen and hide it.
  const projectScreen = document.getElementById('project-screen');
  if (projectScreen) {
    projectScreen.style.display = 'none';
  }

  // 2. Create a new, dedicated container for chapter selection.
  const chapterSelectionContainer = document.createElement('div');
  chapterSelectionContainer.id = 'chapter-selection-screen';

  // 3. Create the new, correct header for this screen.
  const header = document.createElement('div');
  header.className = 'header';

  // --- Header Left Side (Back button and Title) ---
  const headerLeft = document.createElement('div');
  headerLeft.className = 'header-left';
  
  const backBtn = document.createElement('a');
  backBtn.href = '#';
  backBtn.className = 'back-btn';
  backBtn.innerHTML = '&larr;';
  backBtn.style.fontSize = '24px';
  backBtn.addEventListener('click', (e) => {
    e.preventDefault();
    chapterSelectionContainer.remove();
    if (projectScreen) {
      projectScreen.style.display = 'block';
    }
  });

  const title = document.createElement('h1');
  title.textContent = projectName;
  headerLeft.appendChild(backBtn);
  headerLeft.appendChild(title);

  // --- Header Right Side (+ New Chapter Button) ---
  const headerRight = document.createElement('div');
  headerRight.className = 'header-buttons'; // Re-use existing class for styling

  const createChapterBtn = document.createElement('button');
  createChapterBtn.id = 'create-chapter-btn';
  createChapterBtn.textContent = '+ New Chapter';
  createChapterBtn.addEventListener('click', () => {
    // This calls the API to open the "Create New Chapter" modal window
    window.api.openCreateChapterWindow(repoName, projectName);
  });
  headerRight.appendChild(createChapterBtn);
  
  // Add both sides to the header
  header.appendChild(headerLeft);
  header.appendChild(headerRight);

  // 4. Create the grid for the chapters.
  const chapterGrid = document.createElement('div');
  chapterGrid.className = 'chapter-grid';
  chapterGrid.innerHTML = `<p style="color: #99aab5; text-align: center;">Loading chapters...</p>`;

  // 5. Assemble the new screen and add it to the page.
  chapterSelectionContainer.appendChild(header);
  chapterSelectionContainer.appendChild(chapterGrid);
  document.body.appendChild(chapterSelectionContainer);

  // 6. Listen for chapters and render them.
  window.api.onChaptersLoaded((chapters) => {
    chapterGrid.innerHTML = '';
    if (chapters.length === 0) {
      chapterGrid.innerHTML = `<p style="color: #99aab5; text-align: center;">No chapters found for this project.</p>`;
    } else {
      for (const chapter of chapters) {
        const card = document.createElement('div');
        card.className = 'chapter-card';
        card.textContent = chapter.name.replace(/_/g, ' ');
      
          card.addEventListener('click', () => {
          window.api.openProject(repoName, projectName, chapter.name);
        });
        chapterGrid.appendChild(card);
      }
    }
  });

  window.api.getChapters(repoName, projectName);
}
export {};
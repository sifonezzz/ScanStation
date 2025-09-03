import type { IScanstationAPI, Editor } from './types';
import { gsap } from 'gsap';

let currentRepoName: string | null = null;
let currentProjectName: string | null = null;
// --- State for Project Screen ---
let isEditMode = false;
let projectGrid: HTMLElement;
let currentRepositories: string[] = [];
let selectedRepository: string | null = null;
let hasPat = false;

const spinnerSVG = `<svg class="spinner" viewBox="0 0 50 50"><circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle></svg>`;

function createCircleExpandAnimation(projectCard: HTMLElement, callback: () => void) {
  // Get position and dimensions of the clicked project card
  const rect = projectCard.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  
  // Create overlay with circle
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.zIndex = '1000';
  overlay.style.pointerEvents = 'none';
  overlay.style.overflow = 'hidden';
  
  const circle = document.createElement('div');
  circle.style.position = 'absolute';
  circle.style.top = `${centerY}px`;
  circle.style.left = `${centerX}px`;
  circle.style.width = '0px';
  circle.style.height = '0px';
  circle.style.borderRadius = '50%';
  circle.style.backgroundColor = '#2c2f33';
  circle.style.transform = 'translate(-50%, -50%)';
  
  overlay.appendChild(circle);
  document.body.appendChild(overlay);
  
  // Calculate final circle size (cover entire screen)
  const finalSize = Math.max(window.innerWidth, window.innerHeight) * 1.5;
  
  // Animate the circle expanding
  gsap.to(circle, {
    width: finalSize,
    height: finalSize,
    duration: 0.6,
    ease: 'power2.inOut',
    onComplete: () => {
      // Execute the callback (show chapter selection)
      const projectScreen = document.getElementById('project-screen');
      if (projectScreen) projectScreen.style.display = 'none';
      callback();
      
      // Fade out the overlay
      gsap.to(overlay, {
        opacity: 0,
        duration: 0.3,
        delay: 0.1,
        onComplete: () => {
          document.body.removeChild(overlay);
        }
      });
    }
  });
}

function setButtonLoadingState(button: HTMLButtonElement, isLoading: boolean, originalText: string) {
    if (isLoading) {
        button.innerHTML = spinnerSVG;
        button.disabled = true;
    } else {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

async function updateStatusBar() {
    const versionStatus = document.getElementById('app-version-status');
    const gitStatusIndicator = document.getElementById('git-status-indicator');
    const lastSyncStatus = document.getElementById('last-sync-status');

    if (versionStatus) {
        versionStatus.textContent = `v${await window.api.getAppVersion()}`;
    }

    if (selectedRepository && gitStatusIndicator) {
        try {
            const status = await window.api.gitStatus(selectedRepository);
            if (status.isClean) {
                gitStatusIndicator.textContent = '✅ Up to date';
            } else {
                gitStatusIndicator.textContent = `⚠️ ${status.files.length} changes to commit`;
            }
        } catch (e) {
            gitStatusIndicator.textContent = '❌ Error';
        }
    }
    
    // Note: Tracking last sync time requires more complex state management.
    // This is a placeholder for now.
    if (lastSyncStatus) {
        lastSyncStatus.textContent = '';
    }
}

window.addEventListener('DOMContentLoaded', () => {
  // --- Screen Containers ---
  const projectScreen = document.getElementById('project-screen');
  const chapterScreen = document.getElementById('chapter-screen');

  // --- Elements for Project Screen ---
  const createProjectBtn = document.getElementById('create-project-btn');
  const editBtn = document.getElementById('edit-btn');
  projectGrid = document.getElementById('project-grid');
  const repoDropdown = document.getElementById('repo-dropdown') as HTMLSelectElement;
  const pushRepoBtn = document.getElementById('push-repo-btn') as HTMLButtonElement;
  const pullRepoBtn = document.getElementById('pull-repo-btn') as HTMLButtonElement;
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
            if (!isEditMode) {
                createRectangleExpandAnimation(card, () => {
                    window.api.openProject(currentRepoName, currentProjectName, chapter.name);
                });
            }
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
  
  const projectScreen = document.getElementById('project-screen');
  const chapterScreen = document.getElementById('chapter-screen');
  
  if (projectScreen && chapterScreen) {
    // Fade out chapter screen
    gsap.to(chapterScreen, {
      opacity: 0,
      duration: 0.3,
      onComplete: () => {
        chapterScreen.style.display = 'none';
        // Show and fade in project screen
        projectScreen.style.display = 'block';
        gsap.to(projectScreen, {
          opacity: 1,
          duration: 0.3
        });
      }
    });
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
    if (!selectedRepository) { /* ... */ return; }
    const originalText = 'Push Repository';
    setButtonLoadingState(pushRepoBtn as HTMLButtonElement, true, originalText);
    
    try {
        const result = await window.api.gitSyncRepository(selectedRepository);
        
        if (result.conflict) {
            // Ask the user what to do
            const userChoice = confirm(`Conflict detected in: ${result.files.join(', ')}\n\nWould you like to force push and replace the file(s) on the repository with your local version?\n\nWARNING: This cannot be undone. It is recommended to discuss this with the person who modified the file to decide which version to keep.`);

            if (userChoice) {
                // If they confirm, call the new force push handler
                const forcePushResult = await window.api.resolveConflictForcePush(selectedRepository);
                alert(forcePushResult.message);
            } else {
                alert('Sync cancelled. Please resolve the conflict manually or contact your collaborator.');
            }
        } else {
            alert(result.message);
        }

    } catch (error) {
        alert(`Failed to sync repository: ${error.message}`);
    } finally {
        setButtonLoadingState(pushRepoBtn as HTMLButtonElement, false, originalText);
        updateStatusBar();
    }
  });

  pullRepoBtn.addEventListener('click', async () => {
    if (!selectedRepository) {
        alert('Please select a repository to pull from.');
        return;
    }
    const originalText = 'Pull Repository';
    setButtonLoadingState(pullRepoBtn as HTMLButtonElement, true, originalText);

    try {
        const result = await window.api.gitPull(selectedRepository);
        
        // ▼▼▼ THIS IS THE CORRECTED LOGIC ▼▼▼
        if (result.conflict) {
            // A conflict occurred, show a detailed message.
            alert(`A merge conflict occurred in the following files: ${result.files.join(', ')}\n\nPlease resolve these conflicts outside of the app using a Git client or by discussing with your collaborators.`);
        } else {
            // No conflict, show the success message.
            alert(result.message + "\n\nSuccessfully checked for and restored missing chapter folders.");
            window.api.loadProjects(selectedRepository);
        }
        // ▲▲▲ END OF CORRECTION ▲▲▲

    } catch (error) {
         alert(`Failed to pull repository: ${error.message}`);
    } finally {
        setButtonLoadingState(pullRepoBtn as HTMLButtonElement, false, originalText);
        updateStatusBar();
    }
  });

  repoDropdown.addEventListener('change', () => {
    const newRepo = repoDropdown.value;
    selectedRepository = newRepo;
    window.api.setSelectedRepository(newRepo);

    // Disable push/pull buttons if the repository is local
    const isLocal = newRepo.startsWith('[local] ');
    if (pushRepoBtn) pushRepoBtn.disabled = isLocal;
    if (pullRepoBtn) pullRepoBtn.disabled = isLocal;
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
            createCircleExpandAnimation(card, () => {
              showChapterSelection(selectedRepository, project.name);
            });
        }
      });
      
      projectGrid.appendChild(card);
    }
  });

  // --- Initial Load ---
  initializeProjectView();
  checkAndSetGitIdentity();
}); // <-- This closes the DOMContentLoaded event listener

function createRectangleExpandAnimation(chapterCard: HTMLElement, callback: () => void) {
  // Get position and dimensions of the clicked chapter card
  const rect = chapterCard.getBoundingClientRect();
  
  // Create overlay with rectangle
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.zIndex = '1000';
  overlay.style.pointerEvents = 'none';
  overlay.style.overflow = 'hidden';
  
  const rectangle = document.createElement('div');
  rectangle.style.position = 'absolute';
  rectangle.style.top = `${rect.top}px`;
  rectangle.style.left = `${rect.left}px`;
  rectangle.style.width = `${rect.width}px`;
  rectangle.style.height = `${rect.height}px`;
  rectangle.style.backgroundColor = '#3b3e44';
  rectangle.style.borderRadius = '8px'; // Match the chapter card's border radius
  
  overlay.appendChild(rectangle);
  document.body.appendChild(overlay);
  
  // Animate the rectangle expanding to cover the entire screen
  gsap.to(rectangle, {
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    borderRadius: 0, // Remove border radius as it expands
    duration: 0.6,
    ease: 'power2.inOut',
    onComplete: () => {
      // Execute the callback (open chapter workspace)
      callback();
      
      // Fade out the overlay
      gsap.to(overlay, {
        opacity: 0,
        duration: 0.3,
        delay: 0.1,
        onComplete: () => {
          document.body.removeChild(overlay);
        }
      });
    }
  });
}

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
    updateStatusBar();
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

  // Get the screen containers
  const projectScreen = document.getElementById('project-screen');
  const chapterScreen = document.getElementById('chapter-screen');
  
  // Get elements from the existing chapter screen to populate them
  const projectNameHeader = document.getElementById('project-name-header');
  const chapterGrid = document.getElementById('chapter-grid');

  if (!projectScreen || !chapterScreen || !projectNameHeader || !chapterGrid) {
    console.error('Could not find required elements to show chapter screen.');
    return;
  }

  // 1. Set the header title
  projectNameHeader.textContent = projectName;
  
  // 2. Clear the grid and show a loading message
  chapterGrid.innerHTML = `<p style="color: #99aab5; text-align: center;">Loading chapters...</p>`;
  
  // 3. Request the chapters for the selected project
  window.api.getChapters(repoName, projectName);
  
  // 4. Show the chapter screen (it will be hidden initially for the animation)
  chapterScreen.style.display = 'block';
  chapterScreen.style.opacity = '0';
  
  // 5. Hide the project screen with a fade
  gsap.to(projectScreen, {
    opacity: 0,
    duration: 0.3,
    onComplete: () => {
      projectScreen.style.display = 'none';
      // Fade in the chapter screen
      gsap.to(chapterScreen, {
        opacity: 1,
        duration: 0.3
      });
    }
  });
}
declare global {
  interface Window {
    api: {
      onProjectDataForChapterScreen: (callback: (data: { repoName: string, projectName: string }) => void) => void;
      getChapters: (repoName: string, projectName: string) => void;
      onChaptersLoaded: (callback: (chapters: { name: string }[]) => void) => void;
      openCreateChapterWindow: (repoName: string, projectName: string) => void;
      goBackToProjects: () => void;
      // New Git APIs
      gitStatus: (repoName: string, projectName: string) => Promise<any>;
      gitCommit: (repoName: string, projectName: string, message: string) => Promise<any>;
      gitPush: (repoName: string, projectName: string) => Promise<any>;
    };
  }
}

let currentRepoName: string | null = null;
let currentProjectName: string | null = null;

window.addEventListener('DOMContentLoaded', () => {
    const projectNameHeader = document.getElementById('project-name-header');
    const chapterGrid = document.getElementById('chapter-grid');
    const createChapterBtn = document.getElementById('create-chapter-btn');
    const backBtn = document.getElementById('back-to-projects-btn');

    // Git UI Elements
    const statusBtn = document.getElementById('git-status-btn');
    const pushBtn = document.getElementById('git-push-btn');
    const changedFilesDiv = document.getElementById('git-changed-files');
    const commitMessageInput = document.getElementById('git-commit-message') as HTMLInputElement;
    const commitBtn = document.getElementById('git-commit-btn');
    
    const showStatus = (text) => {
        changedFilesDiv.textContent = text;
    };

    // 1. Receive project name from main process and fetch its chapters
    window.api.onProjectDataForChapterScreen((data) => {
        currentRepoName = data.repoName;
        currentProjectName = data.projectName;
        projectNameHeader.textContent = data.projectName;
        window.api.getChapters(data.repoName, data.projectName);
    });

    // 2. Listen for the loaded chapters and display them
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
    
    // 3. Handle button clicks
    createChapterBtn.addEventListener('click', () => {
        if (currentRepoName && currentProjectName) {
            window.api.openCreateChapterWindow(currentRepoName, currentProjectName);
        }
    });

    backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.api.goBackToProjects();
    });

    // 4. Git UI Event Listeners
    statusBtn.addEventListener('click', async () => {
        if (!currentRepoName || !currentProjectName) return;
        showStatus('Checking for changes...');
        try {
            const status = await window.api.gitStatus(currentRepoName, currentProjectName);
            const changed = status.files.length;
            if (changed === 0) {
                showStatus('No changes detected.');
            } else {
                const fileList = status.files.map(f => `${f.working_dir} ${f.path}`).join('\n');
                showStatus(`${changed} file(s) changed:\n${fileList}`);
            }
        } catch (error) {
            showStatus(`Error checking status: ${error.message}`);
        }
    });

    commitBtn.addEventListener('click', async () => {
        if (!currentRepoName || !currentProjectName) return;
        const message = commitMessageInput.value.trim();
        if (!message) {
            alert('Please enter a commit message.');
            return;
        }
        showStatus('Committing...');
        try {
            await window.api.gitCommit(currentRepoName, currentProjectName, message);
            commitMessageInput.value = '';
            showStatus('Commit successful! Ready to push.');
            await statusBtn.click(); // Refresh status
        } catch (error) {
            showStatus(`Error committing: ${error.message}`);
        }
    });

    pushBtn.addEventListener('click', async () => {
        if (!currentRepoName || !currentProjectName) return;
        showStatus('Pushing changes to GitHub...');
        try {
            await window.api.gitPush(currentRepoName, currentProjectName);
            showStatus('Push successful! Your repository is up to date.');
        } catch (error) {
            showStatus(`Error pushing: ${error.message}\nMake sure you are a collaborator and have set a valid Personal Access Token.`);
        }
    });
});

export {};
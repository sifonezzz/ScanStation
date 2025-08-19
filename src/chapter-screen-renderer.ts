declare global {
  interface Window {
    api: {
      onProjectDataForChapterScreen: (callback: (projectName: string) => void) => void;
      getChapters: (projectName: string) => void;
      onChaptersLoaded: (callback: (chapters: { name: string }[]) => void) => void;
      openCreateChapterWindow: (projectName: string) => void;
      goBackToProjects: () => void;
    };
  }
}

let currentProjectName: string | null = null;

window.addEventListener('DOMContentLoaded', () => {
    const projectNameHeader = document.getElementById('project-name-header');
    const chapterGrid = document.getElementById('chapter-grid');
    const createChapterBtn = document.getElementById('create-chapter-btn');
    const backBtn = document.getElementById('back-to-projects-btn');

    // 1. Receive project name from main process and fetch its chapters
    window.api.onProjectDataForChapterScreen((projectName) => {
        currentProjectName = projectName;
        projectNameHeader.textContent = projectName;
        window.api.getChapters(projectName);
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
            card.textContent = chapter.name.replace(/_/g, ' '); // Replace underscores with spaces for display
            chapterGrid.appendChild(card);
        }
    });
    
    // 3. Handle button clicks
    createChapterBtn.addEventListener('click', () => {
        if (currentProjectName) {
            window.api.openCreateChapterWindow(currentProjectName);
        }
    });

    backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.api.goBackToProjects();
    });
});

export {};
// Note: This replaces the entire contents of src/chapter-screen-renderer.ts

// --- Type Definitions ---
interface PageStatus {
  CL: boolean;
  TL: boolean;
  TS: boolean;
  PR: boolean | 'annotated';
  QC: boolean | 'annotated';
}
interface Page {
  fileName: string;
  status: PageStatus;
}

// --- Module State ---
let currentRepoName: string | null = null;
let currentProjectName: string | null = null;
let currentChapterPath: string | null = null;
let pages: Page[] = [];

// --- DOM Elements ---
let projectNameHeader: HTMLElement;
let backBtn: HTMLElement;
let openFolderBtn: HTMLElement;
let translateBtn: HTMLElement;
let galleryViewContainer: HTMLElement;
let workspacePlaceholder: HTMLElement;
let pageListDiv: HTMLElement;
let createChapterBtn: HTMLElement;

// --- Main Setup ---
window.addEventListener('DOMContentLoaded', () => {
  // Assign DOM elements
  projectNameHeader = document.getElementById('project-name-header');
  backBtn = document.getElementById('back-to-projects-btn');
  openFolderBtn = document.getElementById('open-folder-btn');
  translateBtn = document.getElementById('translate-btn');
  galleryViewContainer = document.getElementById('gallery-view-container');
  workspacePlaceholder = document.getElementById('workspace-placeholder');
  pageListDiv = document.getElementById('page-list');
  createChapterBtn = document.getElementById('create-chapter-btn');

  // --- Initial Event Listeners ---
  window.api.onProjectDataForChapterScreen(async (data) => {
    currentRepoName = data.repoName;
    currentProjectName = data.projectName;
    // Note: A chapter name isn't passed, so we derive it from the header for now.
    // A better implementation would pass the chapter folder name directly.
    projectNameHeader.textContent = `${data.projectName} / ${data.chapterName}`;
    currentChapterPath = data.chapterPath;
    
    await loadAndRenderPageStatus();
  });

  backBtn.addEventListener('click', (e) => {
    e.preventDefault();
    window.api.goBackToProjects();
  });

  openFolderBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentChapterPath) {
      window.api.openChapterFolder(currentChapterPath);
    }
  });

  translateBtn.addEventListener('click', () => {
    // We will implement the view switching logic here in a future step
    alert("Translation view coming soon!");
  });
  
  createChapterBtn.addEventListener('click', () => {
        if (currentRepoName && currentProjectName) {
            window.api.openCreateChapterWindow(currentRepoName, currentProjectName);
        }
  });
});

// --- Core Functions ---
async function loadAndRenderPageStatus() {
  if (!currentChapterPath) return;

  const result = await window.api.getChapterPageStatus(currentChapterPath);
  if (result.success) {
    pages = result.pages;
    renderSidebar();
  }
}

function renderSidebar() {
  pageListDiv.innerHTML = '';
  if (pages.length === 0) {
    pageListDiv.innerHTML = '<p style="color: #99aab5; font-size: 14px;">No pages found in the "Raws" folder.</p>';
    return;
  }

  pages.forEach((page, index) => {
    const pageNum = index + 1;
    const item = document.createElement('div');
    item.className = 'page-status-item';
    item.innerHTML = `
      <span class="page-name">${pageNum}: ${page.fileName}</span>
      <div class="status-tags">
        ${createStatusTag('CL', page.status.CL)}
        ${createStatusTag('TL', page.status.TL)}
        ${createStatusTag('TS', page.status.TS)}
        ${createStatusTag('PR', page.status.PR)}
        ${createStatusTag('QC', page.status.QC)}
      </div>
    `;
    item.addEventListener('click', () => {
      // We will implement the proofread view here in a future step
      alert(`Proofread view for page ${pageNum} coming soon!`);
    });
    pageListDiv.appendChild(item);
  });
}

function createStatusTag(name: string, status: boolean | 'annotated'): string {
  let className = 'status-tag';
  if (status === true) {
    className += ' checked';
  } else if (status === 'annotated') {
    className += ' circled';
  }
  return `<span class="${className}">${name}</span>`;
}
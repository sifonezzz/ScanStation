import translateViewHtml from './translate-view.html';
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
type DrawingData = { lines: { color: string; points: { x: number; y: number }[] }[] };

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

// --- Main Setup ---
window.addEventListener('DOMContentLoaded', () => {
  projectNameHeader = document.getElementById('project-name-header');
  backBtn = document.getElementById('back-to-projects-btn');
  openFolderBtn = document.getElementById('open-folder-btn');
  translateBtn = document.getElementById('translate-btn');
  galleryViewContainer = document.getElementById('gallery-view-container');
  workspacePlaceholder = document.getElementById('workspace-placeholder');
  pageListDiv = document.getElementById('page-list');

  window.api.onProjectDataForChapterScreen(async (data) => {
    currentRepoName = data.repoName;
    currentProjectName = data.projectName;
    projectNameHeader.textContent = `${data.projectName} / ${data.chapterName}`;
    currentChapterPath = data.chapterPath;
    await loadAndRenderPageStatus();
  });

  backBtn.addEventListener('click', (e) => {
    e.preventDefault();
    window.api.goBackToProjects(currentRepoName, currentProjectName);
  });

  openFolderBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentChapterPath) window.api.openChapterFolder(currentChapterPath);
  });

  translateBtn.addEventListener('click', showTranslateView);
});

// --- Core Sidebar/Status Functions ---
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
    pageListDiv.innerHTML = '<p style="color: #99aab5; font-size: 14px;">No pages in "Raws" folder.</p>';
    return;
  }
  pages.forEach((page, index) => {
    const pageNum = index + 1;
    const item = document.createElement('div');
    item.className = 'page-status-item';
    item.id = `page-item-${page.fileName}`;
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
    item.addEventListener('click', () => alert(`Proofread view for page ${pageNum} coming soon!`));
    pageListDiv.appendChild(item);
  });
}

function createStatusTag(name: string, status: boolean | 'annotated'): string {
  let className = 'status-tag';
  if (status === true) className += ' checked';
  else if (status === 'annotated') className += ' circled';
  return `<span class="${className}">${name}</span>`;
}

// --- View Loaders & Teardown ---
function showPlaceholder() {
  galleryViewContainer.style.display = 'none';
  galleryViewContainer.innerHTML = '';
  workspacePlaceholder.style.display = 'block';
}

function showTranslateView() {
  if (pages.length === 0) {
    alert('There are no pages in the "Raws" folder to translate.');
    return;
  }
  
  // No longer needs to be async or use fetch
  galleryViewContainer.innerHTML = translateViewHtml;
  workspacePlaceholder.style.display = 'none';
  galleryViewContainer.style.display = 'flex';
  initTranslateView();
}

// --- Translation View Logic ---
function initTranslateView() {
  let currentPageIndex = 0;
  const pageIndicator = document.getElementById('translate-page-indicator') as HTMLSpanElement;
  const rawImage = document.getElementById('translate-raw-image') as HTMLImageElement;
  const translationText = document.getElementById('translation-text') as HTMLTextAreaElement;
  const nextBtn = document.getElementById('translate-next-btn') as HTMLButtonElement;
  const prevBtn = document.getElementById('translate-prev-btn') as HTMLButtonElement;
  const closeBtn = document.querySelector('.gallery-close-btn') as HTMLAnchorElement;

  // Canvas state
  const canvas = document.getElementById('drawing-canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  let isDrawing = false;
  let drawingData: DrawingData = { lines: [] };
  let currentLine: { x: number, y: number }[] = [];

  const saveData = async () => {
    const pageFile = pages[currentPageIndex].fileName;
    const result = await window.api.saveTranslationData({
      chapterPath: currentChapterPath,
      pageFile,
      text: translationText.value,
      drawingData: drawingData,
    });
    if (result.success) {
      pages[currentPageIndex].status = { ...pages[currentPageIndex].status, ...result.newStatus };
      renderSidebar(); // Refresh sidebar to show updated status
    }
  };

  const loadPage = async (index: number) => {
    if (index < 0 || index >= pages.length) return;
    await saveData(); // Save previous page's data before loading new one
    currentPageIndex = index;
    const page = pages[currentPageIndex];

    // Update UI elements
    pageIndicator.textContent = `Page ${currentPageIndex + 1} of ${pages.length}`;
    const imagePath = `${currentChapterPath}/Raws/${page.fileName}`.replace(/\\/g, '/');
    rawImage.src = `scanstation-asset:///${imagePath}`;

    // Load text and drawing data
    const textContent = await window.api.getFileContent(`${currentChapterPath}/data/${page.fileName}.txt`);
    translationText.value = textContent;

    drawingData = await window.api.getJsonContent(`${currentChapterPath}/data/${page.fileName}_drawing.json`) || { lines: [] };
    redrawCanvas();
  };

  const redrawCanvas = () => {
    // Match canvas size to the image it's overlaying
    canvas.width = rawImage.clientWidth;
    canvas.height = rawImage.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    drawingData.lines.forEach(line => {
      if (line.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(line.points[0].x * canvas.width, line.points[0].y * canvas.height);
      for (let i = 1; i < line.points.length; i++) {
        ctx.lineTo(line.points[i].x * canvas.width, line.points[i].y * canvas.height);
      }
      ctx.stroke();
    });
  };

  // Event Listeners
  closeBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    await saveData();
    showPlaceholder();
  });
  nextBtn.addEventListener('click', () => loadPage(currentPageIndex + 1));
  prevBtn.addEventListener('click', () => loadPage(currentPageIndex - 1));
  rawImage.onload = redrawCanvas;
  window.onresize = redrawCanvas;
  translationText.addEventListener('blur', saveData);

  // Canvas Drawing Events
  const getMousePos = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left),
      y: (e.clientY - rect.top)
    };
  };

  canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    currentLine = [];
    const pos = getMousePos(e);
    // Store points as a ratio of canvas dimensions for responsive resizing
    currentLine.push({ x: pos.x / canvas.width, y: pos.y / canvas.height });
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    const pos = getMousePos(e);
    const scaledPos = { x: pos.x / canvas.width, y: pos.y / canvas.height };
    currentLine.push(scaledPos);
    
    // Draw live
    ctx.beginPath();
    const lastPoint = currentLine[currentLine.length - 2];
    ctx.moveTo(lastPoint.x * canvas.width, lastPoint.y * canvas.height);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  });

  canvas.addEventListener('mouseup', () => {
    if (!isDrawing) return;
    isDrawing = false;
    if (currentLine.length > 1) {
      drawingData.lines.push({ color: 'red', points: currentLine });
    }
    saveData();
  });
  
  canvas.addEventListener('mouseleave', () => {
    if(isDrawing) {
        isDrawing = false;
        if (currentLine.length > 1) {
            drawingData.lines.push({ color: 'red', points: currentLine });
        }
        saveData();
    }
  });

  // Initial Load
  loadPage(0);
}
import translateViewHtml from './translate-view.html';
import proofreadViewHtml from './proofread-view.html';

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
let projectNameHeader: HTMLElement, backBtn: HTMLElement, openFolderBtn: HTMLElement, homeBtn: HTMLElement, translateBtn: HTMLElement, proofreadBtn: HTMLElement, galleryViewContainer: HTMLElement, workspacePlaceholder: HTMLElement, pageListDiv: HTMLElement;
// --- Main Setup ---
window.addEventListener('DOMContentLoaded', () => {
  projectNameHeader = document.getElementById('project-name-header');
  proofreadBtn = document.getElementById('proofread-btn');
  backBtn = document.getElementById('back-to-projects-btn');
  openFolderBtn = document.getElementById('open-folder-btn');
  homeBtn = document.getElementById('home-btn');
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

  proofreadBtn.addEventListener('click', () => {
  // Find the first page with annotations, or default to the first page
  const firstAnnotatedPage = pages.findIndex(p => p.status.PR === 'annotated');
  showProofreadView(firstAnnotatedPage >= 0 ? firstAnnotatedPage : 0);
    });
  backBtn.addEventListener('click', (e) => { e.preventDefault(); window.api.goBackToProjects(currentRepoName, currentProjectName); });
  openFolderBtn.addEventListener('click', (e) => { e.preventDefault(); if (currentChapterPath) window.api.openChapterFolder(currentChapterPath); });
  homeBtn.addEventListener('click', (e) => { e.preventDefault(); showPlaceholder("Welcome to the chapter home screen."); });
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
  if (pages.length === 0) { pageListDiv.innerHTML = '<p style="color: #99aab5; font-size: 14px;">No pages in "Raws" folder.</p>'; return; }
  pages.forEach((page, index) => {
    const item = document.createElement('div');
    item.className = 'page-status-item';
    item.id = `page-item-${page.fileName}`;
    item.innerHTML = `<span class="page-name">${index + 1}: ${page.fileName}</span><div class="status-tags">${createStatusTag('CL', page.status.CL)}${createStatusTag('TL', page.status.TL)}${createStatusTag('TS', page.status.TS)}${createStatusTag('PR', page.status.PR)}${createStatusTag('QC', page.status.QC)}</div>`;
    
    // Only make the item clickable if it has annotations
    if (page.status.PR === 'annotated') {
      item.classList.add('clickable');
      item.addEventListener('click', () => showProofreadView(index));
    }
    
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
function showPlaceholder(message?: string) {
  galleryViewContainer.style.display = 'none';
  galleryViewContainer.innerHTML = '';
  workspacePlaceholder.textContent = message || 'Select an action like "Translate" or click a page to begin.';
  workspacePlaceholder.style.display = 'block';
}

function showTranslateView() {
  if (pages.length === 0) { alert('There are no pages in the "Raws" folder to translate.'); return; }
  galleryViewContainer.innerHTML = translateViewHtml;
  workspacePlaceholder.style.display = 'none';
  galleryViewContainer.style.display = 'flex';
  initTranslateView();
}

function showProofreadView(startingIndex: number) {
  if (pages.length === 0) { alert('There are no pages to proofread.'); return; }
  galleryViewContainer.innerHTML = proofreadViewHtml;
  workspacePlaceholder.style.display = 'none';
  galleryViewContainer.style.display = 'flex';
  initProofreadView(startingIndex);
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
  const canvas = document.getElementById('drawing-canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  let isDrawing = false;
  let drawingData: DrawingData = { lines: [] };
  let currentLine: { x: number, y: number }[] = [];

  const saveData = async () => {
    const pageFile = pages[currentPageIndex]?.fileName;
    if (!pageFile) return;
    const result = await window.api.saveTranslationData({ chapterPath: currentChapterPath, pageFile, text: translationText.value, drawingData: drawingData });
    if (result.success) {
      pages[currentPageIndex].status = { ...pages[currentPageIndex].status, ...result.newStatus };
      renderSidebar();
    }
  };

  const loadPage = async (index: number) => {
    if (index < 0 || index >= pages.length) return;
    if (pages[currentPageIndex]) { await saveData(); }
    currentPageIndex = index;
    const page = pages[currentPageIndex];
    pageIndicator.textContent = `Page ${currentPageIndex + 1} of ${pages.length}`;
    const imagePath = `${currentChapterPath}/Raws/${page.fileName}`.replace(/\\/g, '/');
    rawImage.src = `scanstation-asset:///${imagePath}`;
    const textContent = await window.api.getFileContent(`${currentChapterPath}/data/TL Data/${page.fileName}.txt`);
    translationText.value = textContent;
    drawingData = await window.api.getJsonContent(`${currentChapterPath}/data/TL Data/${page.fileName}_drawing.json`) || { lines: [] };
    redrawCanvas();
  };

  const redrawCanvas = () => {
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

  const getMousePos = (e: MouseEvent) => ({ x: (e.clientX - canvas.getBoundingClientRect().left), y: (e.clientY - canvas.getBoundingClientRect().top) });

  closeBtn.addEventListener('click', async (e) => { e.preventDefault(); await saveData(); showPlaceholder(); });
  nextBtn.addEventListener('click', () => loadPage(currentPageIndex + 1));
  prevBtn.addEventListener('click', () => loadPage(currentPageIndex - 1));
  rawImage.onload = redrawCanvas;
  window.addEventListener('resize', redrawCanvas);
  translationText.addEventListener('blur', saveData);

  canvas.addEventListener('mousedown', (e) => { isDrawing = true; currentLine = []; const pos = getMousePos(e); currentLine.push({ x: pos.x / canvas.width, y: pos.y / canvas.height }); });
  canvas.addEventListener('mousemove', (e) => { if (!isDrawing) return; const pos = getMousePos(e); currentLine.push({ x: pos.x / canvas.width, y: pos.y / canvas.height }); ctx.beginPath(); const lastPoint = currentLine[currentLine.length - 2]; ctx.moveTo(lastPoint.x * canvas.width, lastPoint.y * canvas.height); ctx.lineTo(pos.x, pos.y); ctx.stroke(); });
  const endDrawing = () => { if (!isDrawing) return; isDrawing = false; if (currentLine.length > 1) { drawingData.lines.push({ color: 'red', points: currentLine }); } saveData(); };
  canvas.addEventListener('mouseup', endDrawing);
  canvas.addEventListener('mouseleave', endDrawing);

  loadPage(0);
}

// --- Proofread View Logic ---
function initProofreadView(startingIndex: number) {
  let currentPageIndex = startingIndex;
  const pageIndicator = document.getElementById('proofread-page-indicator') as HTMLSpanElement;
  const rawImage = document.getElementById('proofread-raw-image') as HTMLImageElement;
  const tsImage = document.getElementById('proofread-ts-image') as HTMLImageElement;
  const annotationsText = document.getElementById('proofread-text') as HTMLTextAreaElement;
  const nextBtn = document.getElementById('proofread-next-btn') as HTMLButtonElement;
  const prevBtn = document.getElementById('proofread-prev-btn') as HTMLButtonElement;
  const correctBtn = document.getElementById('proofread-correct-btn') as HTMLButtonElement;
  const closeBtn = document.querySelector('.gallery-close-btn') as HTMLAnchorElement;

  // This helper function now handles saving the annotations for a specific page index
  const saveAnnotations = async (indexToSave: number) => {
    if (!pages[indexToSave]) return; // Don't save if index is invalid
    
    const pageFile = pages[indexToSave].fileName;
    const result = await window.api.saveProofreadData({
      chapterPath: currentChapterPath,
      pageFile,
      annotations: annotationsText.value
    });

    if (result.success) {
      pages[indexToSave].status = { ...pages[indexToSave].status, ...result.newStatus };
      renderSidebar();
    } else if (result.error) {
      alert(`Could not save annotations: ${result.error}`);
    }
  };

  const loadPage = async (index: number) => {
    if (index < 0 || index >= pages.length) return;

    // Save the data for the page we are leaving BEFORE loading the new one
    if (currentPageIndex !== index && pages[currentPageIndex]) {
        await saveAnnotations(currentPageIndex);
    }
    
    currentPageIndex = index;
    const page = pages[currentPageIndex];

    pageIndicator.textContent = `Page ${currentPageIndex + 1} of ${pages.length}`;
    
    const rawPath = `${currentChapterPath}/Raws/${page.fileName}`.replace(/\\/g, '/');
    rawImage.src = `scanstation-asset:///${rawPath}`;

    const tsPath = `${currentChapterPath}/Typesetted/${page.fileName}`.replace(/\\/g, '/');
    tsImage.src = `scanstation-asset:///${tsPath}`;
    tsImage.onerror = () => { tsImage.src = ''; }; // Handles missing typeset files
    
    const annotations = await window.api.getFileContent(`${currentChapterPath}/data/PR Data/${page.fileName}_proof.txt`);
    annotationsText.value = annotations;
  };

  // --- Event Listeners ---
  closeBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    await saveAnnotations(currentPageIndex); // Save one last time
    showPlaceholder();
  });

  nextBtn.addEventListener('click', () => loadPage(currentPageIndex + 1));
  prevBtn.addEventListener('click', () => loadPage(currentPageIndex - 1));
  
  correctBtn.addEventListener('click', async () => {
    await saveAnnotations(currentPageIndex); // Save any final annotations first
    
    const pageFile = pages[currentPageIndex].fileName;
    const result = await window.api.markPageCorrect({ chapterPath: currentChapterPath, pageFile });
    
    if (result.success) {
      pages[currentPageIndex].status = { ...pages[currentPageIndex].status, ...result.newStatus };
      renderSidebar();
      annotationsText.value = '';
      if (currentPageIndex < pages.length - 1) {
        loadPage(currentPageIndex + 1);
      }
    } else {
      alert(`Could not mark page as correct: ${result.error}`);
    }
  });

  // Initial page load
  loadPage(startingIndex);
}
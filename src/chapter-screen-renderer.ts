
import type { IScanstationAPI, Editor } from './types';



import translateViewHtml from './translate-view.html';
import proofreadViewHtml from './proofread-view.html';
import typesetViewHtml from './typeset-view.html';

// --- Type Definitions ---
interface PageStatus { CL: boolean; TL: boolean; TS: boolean; PR: boolean | 'annotated'; QC: boolean | 'annotated'; }
interface Page { fileName: string; status: PageStatus; }
type DrawingData = { lines: { color: string; points: { x: number; y: number }[] }[] };

// --- Module State ---
let currentRepoName: string | null = null, currentProjectName: string | null = null, currentChapterPath: string | null = null;
let pages: Page[] = [];
let activeView: {
  name: string;
  saveData: () => Promise<void>;
  onKeydown?: (e: KeyboardEvent) => void;
} = { name: 'none', saveData: async () => {} };
let projectNameHeader: HTMLElement, backBtn: HTMLElement, openFolderBtn: HTMLElement, healFoldersBtn: HTMLElement, homeBtn: HTMLElement, translateBtn: HTMLElement, proofreadBtn: HTMLElement, typesetBtn: HTMLElement, galleryViewContainer: HTMLElement, workspacePlaceholder: HTMLElement, pageListDiv: HTMLElement;
// --- Main Setup ---
window.addEventListener('DOMContentLoaded', () => {
  projectNameHeader = document.getElementById('project-name-header');
  backBtn = document.getElementById('back-to-projects-btn');
  openFolderBtn = document.getElementById('open-folder-btn');
  healFoldersBtn = document.getElementById('heal-folders-btn');
  homeBtn = document.getElementById('home-btn');
  translateBtn = document.getElementById('translate-btn');
  proofreadBtn = document.getElementById('proofread-btn');
  typesetBtn = document.getElementById('typeset-btn');
  galleryViewContainer = document.getElementById('gallery-view-container');
  workspacePlaceholder = document.getElementById('workspace-placeholder');
  pageListDiv = document.getElementById('page-list');

  window.api.onProjectDataForChapterScreen(async (data) => {
    currentRepoName = data.repoName;
    currentProjectName = data.projectName;
    projectNameHeader.textContent = `${data.projectName} / ${data.chapterName}`;
    currentChapterPath = data.chapterPath;
    await loadAndRenderPageStatus();
    showHomeView(); // Show dashboard on load
  });

  healFoldersBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (currentChapterPath) {
          const result = await window.api.healChapterFolders(currentChapterPath);
          if (result.success) {
              alert('Base folders have been checked and recreated if missing. Refreshing page list.');
              await loadAndRenderPageStatus(); // Reload the sidebar
          }
      }
    });

  backBtn.addEventListener('click', (e) => { e.preventDefault(); window.api.goBackToProjects(currentRepoName, currentProjectName); });
  openFolderBtn.addEventListener('click', (e) => { e.preventDefault(); if (currentChapterPath) window.api.openChapterFolder(currentChapterPath); });
  
  homeBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    await activeView.saveData();
    showHomeView();
  });
  translateBtn.addEventListener('click', async () => {
    await activeView.saveData();
    showTranslateView(0);
  });
  proofreadBtn.addEventListener('click', async () => {
    await activeView.saveData();
    const firstAnnotatedPage = pages.findIndex(p => p.status.PR === 'annotated');
    showProofreadView(firstAnnotatedPage >= 0 ? firstAnnotatedPage : 0);
  });
  typesetBtn.addEventListener('click', async () => {
    await activeView.saveData();
    showTypesetView(0);
  });
  window.addEventListener('keydown', (e) => {
    if (activeView.onKeydown) {
      activeView.onKeydown(e);
    }
  });
});

// --- Core Sidebar/Status & View Loading ---
async function loadAndRenderPageStatus() {
  if (!currentChapterPath) return;
  const result = await window.api.getChapterPageStatus(currentChapterPath);
  if (result.success) { pages = result.pages; renderSidebar(); }
}

function renderSidebar() {
  pageListDiv.innerHTML = '';
  if (pages.length === 0) { pageListDiv.innerHTML = '<p style="color: #99aab5; font-size: 14px;">No pages in "Raws" folder.</p>'; return; }
  pages.forEach((page, index) => {
    const item = document.createElement('div');
    item.className = 'page-status-item';
    item.id = `page-item-${page.fileName}`;
    item.innerHTML = `<span class="page-name">${index + 1}: ${page.fileName}</span><div class="status-tags">${createStatusTag('CL', page.status.CL)}${createStatusTag('TL', page.status.TL)}${createStatusTag('TS', page.status.TS)}${createStatusTag('PR', page.status.PR)}${createStatusTag('QC', page.status.QC)}</div>`;
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

function showHomeView() {
    galleryViewContainer.style.display = 'none';
    galleryViewContainer.innerHTML = '';
    workspacePlaceholder.style.display = 'flex';
    activeView = { name: 'home', saveData: async () => {} };
    if (pages.length === 0) {
        workspacePlaceholder.innerHTML = 'No pages found in "Raws" folder to generate a dashboard.';
        return;
    }
    const total = pages.length;
    const clCount = pages.filter(p => p.status.CL).length;
    const tlCount = pages.filter(p => p.status.TL).length;
    const tsCount = pages.filter(p => p.status.TS).length;
    const prCount = pages.filter(p => p.status.PR === true).length;
    workspacePlaceholder.innerHTML = `<div class="dashboard-container"><h2>Chapter Progress</h2>${createProgressBar("Cleaning (CL)", clCount, total)}${createProgressBar("Translation (TL)", tlCount, total)}${createProgressBar("Typesetting (TS)", tsCount, total)}${createProgressBar("Proofreading (PR)", prCount, total)}</div>`;
}

function createProgressBar(label: string, count: number, total: number) {
    const percent = total > 0 ? (count / total) * 100 : 0;
    return `<div class="progress-item"><div class="progress-label"><span>${label}</span><span>${count} / ${total}</span></div><div class="progress-bar-background"><div class="progress-bar-foreground" style="width: ${percent}%;">${Math.round(percent)}%</div></div></div>`;
}

function showTranslateView(startingIndex: number) {
  if (pages.length === 0) { alert('There are no pages in the "Raws" folder to translate.'); return; }
  galleryViewContainer.innerHTML = translateViewHtml;
  workspacePlaceholder.style.display = 'none';
  galleryViewContainer.style.display = 'flex';
  initTranslateView(startingIndex);
}

function showProofreadView(startingIndex: number) {
  if (pages.length === 0) { alert('There are no pages to proofread.'); return; }
  galleryViewContainer.innerHTML = proofreadViewHtml;
  workspacePlaceholder.style.display = 'none';
  galleryViewContainer.style.display = 'flex';
  initProofreadView(startingIndex);
}

function showTypesetView(startingIndex: number) {
  if (pages.length === 0) { alert('There are no pages to typeset.'); return; }
  galleryViewContainer.innerHTML = typesetViewHtml;
  workspacePlaceholder.style.display = 'none';
  galleryViewContainer.style.display = 'flex';
  initTypesetView(startingIndex);
}

// --- View Initializers ---
function initTranslateView(startingIndex: number) {
  let currentPageIndex = startingIndex;
  const pageIndicator = document.getElementById('translate-page-indicator') as HTMLSpanElement;
  const saveBtn = document.getElementById('translate-save-btn') as HTMLButtonElement;
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


  saveBtn.addEventListener('click', async () => {
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saving...';
    await saveData();
    setTimeout(() => { saveBtn.textContent = originalText; }, 1000);
  });

  const saveData = async () => {
    const pageFile = pages[currentPageIndex]?.fileName;
    if (!pageFile) return;
    const result = await window.api.saveTranslationData({ chapterPath: currentChapterPath, pageFile, text: translationText.value, drawingData: drawingData });
    if (result.success) {
      pages[currentPageIndex].status = { ...pages[currentPageIndex].status, ...result.newStatus };
      renderSidebar();
    }
  };

  activeView = {
    name: 'translate',
    saveData,
    onKeydown: (e: KeyboardEvent) => {
      // Undo drawing
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        if (drawingData.lines.length > 0) {
          drawingData.lines.pop(); // Remove the last line
          redrawCanvas();        // Redraw the canvas
          saveData();            // Save the change
        }
      }
      // Page navigation
      if (e.key === 'ArrowRight') {
        nextBtn.click();
      } else if (e.key === 'ArrowLeft') {
        prevBtn.click();
      }
    },
  };

  const loadPage = async (index: number) => {
    if (index < 0 || index >= pages.length) return;
    if (pages[currentPageIndex] && currentPageIndex !== index) { await saveData(); }
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
    if (!rawImage.clientWidth || !rawImage.clientHeight) return;
    const imgRect = rawImage.getBoundingClientRect();
    const parentRect = rawImage.parentElement.getBoundingClientRect();
    canvas.style.top = `${imgRect.top - parentRect.top}px`;
    canvas.style.left = `${imgRect.left - parentRect.left}px`;
    canvas.style.width = `${imgRect.width}px`;
    canvas.style.height = `${imgRect.height}px`;
    canvas.width = imgRect.width;
    canvas.height = imgRect.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    drawingData.lines.forEach(line => {
      if (line.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(line.points[0].x * canvas.width, line.points[0].y * canvas.height);
      for (let i = 1; i < line.points.length; i++) { ctx.lineTo(line.points[i].x * canvas.width, line.points[i].y * canvas.height); }
      ctx.stroke();
    });
  };

  const getMousePos = (e: MouseEvent) => ({ x: (e.clientX - canvas.getBoundingClientRect().left), y: (e.clientY - canvas.getBoundingClientRect().top) });

  closeBtn.addEventListener('click', async (e) => { e.preventDefault(); await saveData(); showHomeView(); });
  nextBtn.addEventListener('click', () => loadPage(currentPageIndex + 1));
  prevBtn.addEventListener('click', () => loadPage(currentPageIndex - 1));
  rawImage.onload = redrawCanvas;
  window.addEventListener('resize', redrawCanvas);

  canvas.addEventListener('mousedown', (e) => { isDrawing = true; currentLine = []; const pos = getMousePos(e); currentLine.push({ x: pos.x / canvas.width, y: pos.y / canvas.height }); });
  canvas.addEventListener('mousemove', (e) => { if (!isDrawing) return; const pos = getMousePos(e); currentLine.push({ x: pos.x / canvas.width, y: pos.y / canvas.height }); ctx.beginPath(); const lastPoint = currentLine[currentLine.length - 2]; if(!lastPoint) return; ctx.moveTo(lastPoint.x * canvas.width, lastPoint.y * canvas.height); ctx.lineTo(pos.x, pos.y); ctx.stroke(); });
  const endDrawing = () => { if (!isDrawing) return; isDrawing = false; if (currentLine.length > 1) { drawingData.lines.push({ color: 'red', points: currentLine }); } saveData(); };
  canvas.addEventListener('mouseup', endDrawing);
  canvas.addEventListener('mouseleave', endDrawing);

  loadPage(startingIndex);
}

function initProofreadView(startingIndex: number) {
  let currentPageIndex = startingIndex;
  const pageIndicator = document.getElementById('proofread-page-indicator') as HTMLSpanElement;
  const saveBtn = document.getElementById('proofread-save-btn') as HTMLButtonElement;
  const rawImage = document.getElementById('proofread-raw-image') as HTMLImageElement;
  const tsImage = document.getElementById('proofread-ts-image') as HTMLImageElement;
  const annotationsText = document.getElementById('proofread-text') as HTMLTextAreaElement;
  const nextBtn = document.getElementById('proofread-next-btn') as HTMLButtonElement;
  const prevBtn = document.getElementById('proofread-prev-btn') as HTMLButtonElement;
  const correctBtn = document.getElementById('proofread-correct-btn') as HTMLButtonElement;
  const closeBtn = document.querySelector('.gallery-close-btn') as HTMLAnchorElement;

  saveBtn.addEventListener('click', async () => {
      const originalText = saveBtn.textContent;
      saveBtn.textContent = 'Saving...';
      await saveAnnotations();
      setTimeout(() => { saveBtn.textContent = originalText; }, 1000);
    });

  const saveAnnotations = async () => {
    if (!pages[currentPageIndex]) return;
    const pageFile = pages[currentPageIndex].fileName;
    const result = await window.api.saveProofreadData({ chapterPath: currentChapterPath, pageFile, annotations: annotationsText.value });
    if (result.success) {
      pages[currentPageIndex].status = { ...pages[currentPageIndex].status, ...result.newStatus };
      renderSidebar();
    } else if (result.error) {
      alert(`Could not save annotations: ${result.error}`);
    }
  };

  activeView = {
    name: 'proofread',
    saveData: saveAnnotations,
    onKeydown: (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        nextBtn.click();
      } else if (e.key === 'ArrowLeft') {
        prevBtn.click();
      }
    },
  };

  const loadPage = async (index: number) => {
    if (index < 0 || index >= pages.length) return;
    if (currentPageIndex !== index && pages[currentPageIndex]) { await saveAnnotations(); }
    currentPageIndex = index;
    const page = pages[currentPageIndex];
    pageIndicator.textContent = `Page ${currentPageIndex + 1} of ${pages.length}`;
    const rawPath = `${currentChapterPath}/Raws/${page.fileName}`.replace(/\\/g, '/');
    rawImage.src = `scanstation-asset:///${rawPath}`;
    const tsPath = `${currentChapterPath}/Typesetted/${page.fileName}`.replace(/\\/g, '/');
    tsImage.src = `scanstation-asset:///${tsPath}`;
    tsImage.onerror = () => { tsImage.src = ''; };
    const annotations = await window.api.getFileContent(`${currentChapterPath}/data/PR Data/${page.fileName}_proof.txt`);
    annotationsText.value = annotations;
  };

  closeBtn.addEventListener('click', async (e) => { e.preventDefault(); await saveAnnotations(); showHomeView(); });
  nextBtn.addEventListener('click', () => loadPage(currentPageIndex + 1));
  prevBtn.addEventListener('click', () => loadPage(currentPageIndex - 1));
  
  correctBtn.addEventListener('click', async () => {
    await saveAnnotations();
    const pageFile = pages[currentPageIndex].fileName;
    const result = await window.api.markPageCorrect({ chapterPath: currentChapterPath, pageFile });
    if (result.success) {
      pages[currentPageIndex].status = { ...pages[currentPageIndex].status, ...result.newStatus };
      renderSidebar();
      annotationsText.value = '';
      if (currentPageIndex < pages.length - 1) { loadPage(currentPageIndex + 1); } else { showHomeView(); }
    } else {
      alert(`Could not mark page as correct: ${result.error}`);
    }
  });

  loadPage(startingIndex);
}

function initTypesetView(startingIndex: number) {
  let currentPageIndex = startingIndex;
  let currentImageType: 'cleaned' | 'raw' = 'cleaned'; // Default to cleaned
  activeView = {
    name: 'typeset',
    saveData: async () => {},
    onKeydown: (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        nextBtn.click();
      } else if (e.key === 'ArrowLeft') {
        prevBtn.click();
      }
    },
  };

  const pageIndicator = document.getElementById('typeset-page-indicator') as HTMLSpanElement;
  const mainImage = document.getElementById('typeset-image') as HTMLImageElement;
  const translationTextDiv = document.getElementById('typeset-translation-text') as HTMLDivElement;
  const nextBtn = document.getElementById('typeset-next-btn') as HTMLButtonElement;
  const prevBtn = document.getElementById('typeset-prev-btn') as HTMLButtonElement;
  const closeBtn = document.querySelector('.gallery-close-btn') as HTMLAnchorElement;
  const showCleanedBtn = document.getElementById('show-cleaned-btn') as HTMLButtonElement;
  const showRawBtn = document.getElementById('show-raw-btn') as HTMLButtonElement;

  const updateImageView = () => {
    const page = pages[currentPageIndex];
    if (!page) return;

    if (currentImageType === 'cleaned') {
      const cleanedPath = `${currentChapterPath}/Raws Cleaned/${page.fileName}`.replace(/\\/g, '/');
      mainImage.src = `scanstation-asset:///${cleanedPath}`;
      showCleanedBtn.classList.add('active');
      showRawBtn.classList.remove('active');
    } else { // raw
      const rawPath = `${currentChapterPath}/Raws/${page.fileName}`.replace(/\\/g, '/');
      mainImage.src = `scanstation-asset:///${rawPath}`;
      showRawBtn.classList.add('active');
      showCleanedBtn.classList.remove('active');
    }
    mainImage.onerror = () => { mainImage.src = ''; };
  };

  const loadPage = async (index: number) => {
    if (index < 0 || index >= pages.length) return;
    currentPageIndex = index;
    const page = pages[currentPageIndex];
    pageIndicator.textContent = `Page ${currentPageIndex + 1} of ${pages.length}`;
    
    updateImageView(); // This will set the image source

    const translatedText = await window.api.getFileContent(`${currentChapterPath}/data/TL Data/${page.fileName}.txt`);
    translationTextDiv.textContent = translatedText || 'No translation text found for this page.';
  };

  showCleanedBtn.addEventListener('click', () => {
    currentImageType = 'cleaned';
    updateImageView();
  });

  showRawBtn.addEventListener('click', () => {
    currentImageType = 'raw';
    updateImageView();
  });

  closeBtn.addEventListener('click', (e) => { e.preventDefault(); showHomeView(); });
  nextBtn.addEventListener('click', () => loadPage(currentPageIndex + 1));
  prevBtn.addEventListener('click', () => loadPage(currentPageIndex - 1));

  document.querySelectorAll('.external-editor-buttons button').forEach(button => {
    button.addEventListener('click', () => {
      const editor = (button as HTMLElement).dataset.editor as Editor;
      const folder = currentImageType === 'cleaned' ? 'Raws Cleaned' : 'Raws';
      const filePath = `${currentChapterPath}/${folder}/${pages[currentPageIndex].fileName}`;
      window.api.openFileInEditor({ editor, filePath });
    });
  });

  loadPage(startingIndex);
}
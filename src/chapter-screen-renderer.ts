import type { IScanstationAPI, Editor } from './types';
import translateViewHtml from './translate-view.html';
import proofreadViewHtml from './proofread-view.html';
import typesetViewHtml from './typeset-view.html';
import { gsap } from 'gsap';

function getBaseName(fileName: string): string {
    const parts = fileName.split('.');
    if (parts.length > 1) {
        parts.pop(); // Remove the last part (the extension)
    }
    return parts.join('.');
}

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

// Declare variables here
let projectNameHeader: HTMLElement, backBtn: HTMLElement, openFolderBtn: HTMLElement, homeBtn: HTMLElement, translateBtn: HTMLElement, proofreadBtn: HTMLElement, typesetBtn: HTMLElement, galleryViewContainer: HTMLElement, workspacePlaceholder: HTMLElement, pageListDiv: HTMLElement;
let viewTitleHeader: HTMLElement;

window.addEventListener('DOMContentLoaded', () => {
    // Assign elements here, after the DOM has loaded
    projectNameHeader = document.getElementById('project-name-header');
    backBtn = document.getElementById('back-to-projects-btn');
    openFolderBtn = document.getElementById('open-folder-btn');
    homeBtn = document.getElementById('home-btn');
    translateBtn = document.getElementById('translate-btn');
    proofreadBtn = document.getElementById('proofread-btn');
    typesetBtn = document.getElementById('typeset-btn');
    galleryViewContainer = document.getElementById('gallery-view-container');
    workspacePlaceholder = document.getElementById('workspace-placeholder');
    pageListDiv = document.getElementById('page-list');
    viewTitleHeader = document.getElementById('view-title-header');

    const sidebar = document.getElementById('pages-sidebar');
    if (sidebar) {
        sidebar.addEventListener('mouseenter', () => {
            sidebar.classList.add('expanded');
        });
        sidebar.addEventListener('mouseleave', () => {
            sidebar.classList.remove('expanded');
        });
    }

    window.api.onProjectDataForChapterScreen(async (data) => {
        currentRepoName = data.repoName;
        currentProjectName = data.projectName;
        currentChapterPath = data.chapterPath;
        await loadAndRenderPageStatus();
        showHomeView();
        window.api.startWatchingChapter(currentChapterPath);

        // --- NEW ANIMATION LOGIC ---
        // --- NEW: Simple Fade-In Entry Animation ---
        // The page starts invisible (set by default CSS or just set here)
        const pageBody = document.body;
        gsap.fromTo(pageBody, 
            { opacity: 0 },
            { opacity: 1, duration: 0.3, ease: 'power1.inOut' } // Simple 0.3s fade-in
        );
        // --- END OF NEW ANIMATION LOGIC ---
        // --- END OF NEW ANIMATION LOGIC ---
    });

    window.api.onFileAdded(() => {
        console.log('File change detected, refreshing sidebar.');
        loadAndRenderPageStatus();
    });
    
    openFolderBtn.addEventListener('click', (e) => { 
        e.preventDefault(); 
        if (currentChapterPath) window.api.openChapterFolder(currentChapterPath); 
    });

    backBtn.addEventListener('click', (e) => { 
    e.preventDefault(); 
    window.api.stopWatchingChapter();
    // Use the API method to go back to chapter selection
    if (currentRepoName && currentProjectName) {
        window.api.goBackToProjects(currentRepoName, currentProjectName);
    }
  });
  
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
    

    const originalText = proofreadBtn.innerHTML;
    proofreadBtn.innerHTML = 'Loading...';
    proofreadBtn.setAttribute('disabled', 'true');


    document.body.style.cursor = 'wait';
    const spreadPages = pages.filter(p => /^\d+[-_]\d+\..+$/.test(p.fileName));
    
    // Wait for all spreads to be pre-loaded and cached
    await Promise.all(spreadPages.map(spread => 
        window.api.getStitchedRawSpread({
            chapterPath: currentChapterPath,
            pageFile: spread.fileName
        })
    ));

    const firstAnnotatedPage = pages.findIndex(p => p.status.PR === 'annotated');
    showProofreadView(firstAnnotatedPage >= 0 ? firstAnnotatedPage : 0);
    
    document.body.style.cursor = 'default';
    
 
    proofreadBtn.innerHTML = originalText;
    proofreadBtn.removeAttribute('disabled');

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

    // --- RENAME UTILITY LOGIC ---
    const utilitiesBtn = document.getElementById('utilities-btn');
    const renameModal = document.getElementById('rename-utility-modal');
    const renameCancelBtn = document.getElementById('rename-cancel-btn');
    const renameConfirmBtn = document.getElementById('rename-confirm-btn');
    const folderSelect = document.getElementById('rename-folder-select') as HTMLSelectElement;

    if (utilitiesBtn && renameModal) {
        utilitiesBtn.addEventListener('click', (e) => {
            e.preventDefault();
            renameModal.style.display = 'flex';
        });

        renameCancelBtn.addEventListener('click', () => {
            renameModal.style.display = 'none';
        });

        renameConfirmBtn.addEventListener('click', async () => {
            const folderName = folderSelect.value;
            const confirmRename = confirm(`Are you sure you want to rename all image files in the "${folderName}" folder? This cannot be undone.`);
            
            if (confirmRename && currentChapterPath) {
                const result = await window.api.renameFilesInFolder({ chapterPath: currentChapterPath, folderName });
                alert(result.message);
                if (result.success) {
                    renameModal.style.display = 'none';
                }
            }
        });
    }
});

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
    viewTitleHeader.textContent = '';
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
  viewTitleHeader.textContent = '— Translation Mode';
  galleryViewContainer.innerHTML = translateViewHtml;
  workspacePlaceholder.style.display = 'none';
  galleryViewContainer.style.display = 'flex';
  initTranslateView(startingIndex);
}

function showProofreadView(startingIndex: number) {
  if (pages.length === 0) { alert('There are no pages to proofread.'); return; }
  viewTitleHeader.textContent = '— Proofread Mode';
  galleryViewContainer.innerHTML = proofreadViewHtml;
  workspacePlaceholder.style.display = 'none';
  galleryViewContainer.style.display = 'flex';
  initProofreadView(startingIndex);
}

function showTypesetView(startingIndex: number) {
  if (pages.length === 0) { alert('There are no pages to typeset.'); return; }
  viewTitleHeader.textContent = '— Typesetting Mode';
  galleryViewContainer.innerHTML = typesetViewHtml;
  workspacePlaceholder.style.display = 'none';
  galleryViewContainer.style.display = 'flex';
  initTypesetView(startingIndex);
}

// --- View Initializers ---
function initTranslateView(startingIndex: number) {
  const clearDrawingBtn = document.getElementById('clear-drawing-btn') as HTMLButtonElement;
  const gotoPageInput = document.getElementById('goto-page-input') as HTMLInputElement;
  let currentPageIndex = startingIndex;
  const pageIndicator = document.getElementById('translate-page-indicator') as HTMLSpanElement;
  const saveBtn = document.getElementById('translate-save-btn') as HTMLButtonElement;
  const rawImage = document.getElementById('translate-raw-image') as HTMLImageElement;
  const translationText = document.getElementById('translation-text') as HTMLTextAreaElement;
  const nextBtn = document.getElementById('translate-next-btn') as HTMLButtonElement;
  const prevBtn = document.getElementById('translate-prev-btn') as HTMLButtonElement;
  const canvas = document.getElementById('drawing-canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  let isDrawing = false;
  let drawingData: DrawingData = { lines: [] };
  let currentLine: { x: number, y: number }[] = [];

  // NEW: Add a variable for our debounce timer
  let autoSaveTimeout: NodeJS.Timeout;

  saveBtn.addEventListener('click', async () => {
    // IMPROVED: The save button now disables while saving for better feedback
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;
    await saveData();
    saveBtn.textContent = 'Save';
    saveBtn.disabled = false;
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

  // NEW: Add an event listener to the text area for auto-saving
  translationText.addEventListener('input', () => {
      // Clear any existing timer
      if (autoSaveTimeout) {
          clearTimeout(autoSaveTimeout);
      }
      // Set a new timer to save after 1.5 seconds of inactivity
      autoSaveTimeout = setTimeout(() => {
          saveData();
      }, 1500);
  });
  
  activeView = {
    name: 'translate',
    saveData,
    onKeydown: (e: KeyboardEvent) => {
      // Undo drawing
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        if (drawingData.lines.length > 0) {
          drawingData.lines.pop(); // Remove the last line
          redrawCanvas(); // Redraw the canvas
          saveData(); // Save the change
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
  // Listener for the new Go To Page input
  

  clearDrawingBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all drawings for this page?')) {
        drawingData.lines = []; // Clear the data
        redrawCanvas(); // Redraw the (now empty) canvas
        saveData(); // Save the cleared data
    }
});

// Listener for the new Go To Page input

  // This new function JUST updates the content instantly, with no animation
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
  rawImage.onload = redrawCanvas;
// This is the animated function, ONLY for Next/Prev button clicks
const loadPage = async (index: number, isInitialLoad: boolean = false) => {
    if (index < 0 || index >= pages.length) return; // Boundary check
    if (!isInitialLoad && index === currentPageIndex) return; // Prevent re-animating same page

    const galleryContent = document.querySelector('.gallery-content');

    // --- THIS IS THE FUNCTION DEFINITION YOU ARE MISSING ---
    const updateContent = async () => {
        // Only save if it's not the initial load AND the page is actually changing
        if (!isInitialLoad && pages[currentPageIndex] && currentPageIndex !== index) { 
            await saveData();
        }
        currentPageIndex = index;
        const page = pages[currentPageIndex];
        pageIndicator.textContent = `Page ${currentPageIndex + 1} of ${pages.length}`;
        const imagePath = `${currentChapterPath}/Raws/${page.fileName}`.replace(/\\/g, '/');
        rawImage.src = `scanstation-asset:///${imagePath}`; //
        const textContent = await window.api.getFileContent(`${currentChapterPath}/data/TL Data/${page.fileName}.txt`);
        translationText.value = textContent;
        drawingData = await window.api.getJsonContent(`${currentChapterPath}/data/TL Data/${page.fileName}_drawing.json`) || { lines: [] };
        redrawCanvas();
    };
    // --- END OF MISSING FUNCTION DEFINITION ---

    if (isInitialLoad) {
        await updateContent(); // This calls the function defined above
        // Just fade in the content for the first load
        gsap.fromTo([galleryContent, pageIndicator], { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power1.out' });
        return;
    }

    // --- Animation Logic (for Next/Prev) ---
    const direction = index > currentPageIndex ? 'next' : 'prev';
    const slideOutX = direction === 'next' ? '-25%' : '25%';
    const slideInX = direction === 'next' ? '25%' : '-25%';

    gsap.to([galleryContent, pageIndicator], {
        duration: 0.2,
        x: slideOutX,
        opacity: 0,
        ease: 'power1.in',
        onComplete: async () => {
            await updateContent(); // This also calls the function defined above
            gsap.fromTo([galleryContent, pageIndicator], // Animate in
                { x: slideInX, opacity: 0 },
                { duration: 0.2, x: '0%', opacity: 1, ease: 'power1.out' }
            );
        }
    });
};


  const getMousePos = (e: MouseEvent) => ({ x: (e.clientX - canvas.getBoundingClientRect().left), y: (e.clientY - canvas.getBoundingClientRect().top) });
  nextBtn.addEventListener('click', () => loadPage(currentPageIndex + 1));
  prevBtn.addEventListener('click', () => loadPage(currentPageIndex - 1));

  window.addEventListener('resize', redrawCanvas);
  canvas.addEventListener('mousedown', (e) => { isDrawing = true; currentLine = []; const pos = getMousePos(e); currentLine.push({ x: pos.x / canvas.width, y: pos.y / canvas.height }); });
  canvas.addEventListener('mousemove', (e) => { if (!isDrawing) return; const pos = getMousePos(e); currentLine.push({ x: pos.x / canvas.width, y: pos.y / canvas.height }); ctx.beginPath(); const lastPoint = currentLine[currentLine.length - 2]; if(!lastPoint) return; ctx.moveTo(lastPoint.x * canvas.width, lastPoint.y * canvas.height); ctx.lineTo(pos.x, pos.y); ctx.stroke(); });
  const endDrawing = () => { if (!isDrawing) return; isDrawing = false;
  if (currentLine.length > 1) { drawingData.lines.push({ color: 'red', points: currentLine }); } saveData(); };
  canvas.addEventListener('mouseup', endDrawing);
  canvas.addEventListener('mouseleave', endDrawing);
  gotoPageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
          const pageNum = parseInt(gotoPageInput.value, 10);
          if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= pages.length) {
              loadPage(pageNum - 1); // 0-indexed
              gotoPageInput.value = '';
              gotoPageInput.blur();
          } else {
              gotoPageInput.value = '';
          }
      }
  });

  loadPage(startingIndex, true);
}

function initProofreadView(startingIndex: number) {
  const gotoPageInput = document.getElementById('goto-page-input') as HTMLInputElement;
  let currentPageIndex = startingIndex;
  const pageIndicator = document.getElementById('proofread-page-indicator') as HTMLSpanElement;
  const saveBtn = document.getElementById('proofread-save-btn') as HTMLButtonElement;
  const rawImage = document.getElementById('proofread-raw-image') as HTMLImageElement;
  const tsImage = document.getElementById('proofread-ts-image') as HTMLImageElement;
  const annotationsText = document.getElementById('proofread-text') as HTMLTextAreaElement;
  const nextBtn = document.getElementById('proofread-next-btn') as HTMLButtonElement;
  const prevBtn = document.getElementById('proofread-prev-btn') as HTMLButtonElement;
  const correctBtn = document.getElementById('proofread-correct-btn') as HTMLButtonElement;

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


  
  // This new function JUST updates the content instantly

// This is the animated function ONLY for Next/Prev
const loadPage = async (index: number, isInitialLoad: boolean = false) => {
    if (index < 0 || index >= pages.length) return;
    if (!isInitialLoad && index === currentPageIndex) return;

    const galleryContent = document.querySelector('.gallery-content');

    const updateContent = async () => {
        if (!isInitialLoad && pages[currentPageIndex] && currentPageIndex !== index) {
            await saveAnnotations();
        }
        currentPageIndex = index;
        const page = pages[currentPageIndex];
        pageIndicator.textContent = `Page ${currentPageIndex + 1} of ${pages.length}`;
        // (All the original image loading logic [cite: 204-218])
        rawImage.src = ''; tsImage.src = '';
        const isSpread = /^\d+[-_]\d+\..+$/.test(page.fileName);
        let rawImagePath: string;
        if (isSpread) {
            const result = await window.api.getStitchedRawSpread({ chapterPath: currentChapterPath, pageFile: page.fileName });
            if (result.success) { rawImagePath = result.filePath; } else { console.error('Failed to load spread:', result.error); }
        } else {
            const imagePaths = await window.api.getProofreadImages({ chapterPath: currentChapterPath, pageFile: page.fileName });
            if (imagePaths.success) { rawImagePath = imagePaths.rawPath; }
        }
        const imagePaths = await window.api.getProofreadImages({ chapterPath: currentChapterPath, pageFile: page.fileName });
        const timestamp = `?t=${Date.now()}`;
        if (imagePaths.success) {
            if (rawImagePath) { rawImage.src = `scanstation-asset:///${rawImagePath.replace(/\\/g, '/')}?${timestamp}`; } 
            else { rawImage.src = ''; }
            if (imagePaths.tsPath) { tsImage.src = `scanstation-asset:///${imagePaths.tsPath.replace(/\\/g, '/')}?${timestamp}`; } 
            else { tsImage.src = ''; }
        } else {
            console.error('Failed to load proofread images:', imagePaths.error);
            rawImage.src = ''; tsImage.src = '';
        }
        tsImage.onerror = () => { tsImage.src = ''; };
        const annotations = await window.api.getFileContent(`${currentChapterPath}/data/PR Data/${getBaseName(page.fileName)}_proof.txt`);
        annotationsText.value = annotations;
    };

    if (isInitialLoad) {
        await updateContent(); // Run instantly
        gsap.fromTo([galleryContent, pageIndicator], { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power1.out' });
        return;
    }

    const direction = index > currentPageIndex ? 'next' : 'prev';
    const slideOutX = direction === 'next' ? '-25%' : '25%';
    const slideInX = direction === 'next' ? '25%' : '-25%';

    gsap.to([galleryContent, pageIndicator], {
        duration: 0.2,
        x: slideOutX,
        opacity: 0,
        ease: 'power1.in',
        onComplete: async () => {
            await updateContent();
            gsap.fromTo([galleryContent, pageIndicator],
                { x: slideInX, opacity: 0 },
                { duration: 0.2, x: '0%', opacity: 1, ease: 'power1.out' }
            );
        }
    });
};
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
  gotoPageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
          const pageNum = parseInt(gotoPageInput.value, 10);
          if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= pages.length) {
              loadPage(pageNum - 1); // 0-indexed
              gotoPageInput.value = '';
              gotoPageInput.blur();
          } else {
              gotoPageInput.value = '';
          }
      }
});

  loadPage(startingIndex, true);
}

function initTypesetView(startingIndex: number) {
  const gotoPageInput = document.getElementById('goto-page-input') as HTMLInputElement;
  let currentPageIndex = startingIndex;
  let currentImageType: 'cleaned' | 'raw' = 'cleaned';

  const pageIndicator = document.getElementById('typeset-page-indicator') as HTMLSpanElement;
  const mainImage = document.getElementById('typeset-image') as HTMLImageElement;
  const translationTextDiv = document.getElementById('typeset-translation-text') as HTMLDivElement;
  const nextBtn = document.getElementById('typeset-next-btn') as HTMLButtonElement;
  const prevBtn = document.getElementById('typeset-prev-btn') as HTMLButtonElement;
  const showCleanedBtn = document.getElementById('show-cleaned-btn') as HTMLButtonElement;
  const showRawBtn = document.getElementById('show-raw-btn') as HTMLButtonElement;
  const drawingCanvas = document.getElementById('typeset-drawing-canvas') as HTMLCanvasElement;
  const ctx = drawingCanvas.getContext('2d');

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
  // Listener for the new Go To Page input
  
  const redrawTypesetCanvas = (drawingData: DrawingData) => {
    if (!mainImage.clientWidth || !mainImage.clientHeight || !drawingData || !drawingData.lines) {
      ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
      return;
    }
    const imgRect = mainImage.getBoundingClientRect();
    const parentRect = mainImage.parentElement.getBoundingClientRect();

    drawingCanvas.style.top = `${imgRect.top - parentRect.top}px`;
    drawingCanvas.style.left = `${imgRect.left - parentRect.left}px`;
    drawingCanvas.width = imgRect.width;
    drawingCanvas.height = imgRect.height;
    
    ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    drawingData.lines.forEach(line => {
      if (line.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(line.points[0].x * drawingCanvas.width, line.points[0].y * drawingCanvas.height);
      for (let i = 1; i < line.points.length; i++) {
        ctx.lineTo(line.points[i].x * drawingCanvas.width, line.points[i].y * drawingCanvas.height);
      }
      ctx.stroke();
    });
  };
  
  const updateImageView = async () => {
    const page = pages[currentPageIndex];
    if (!page) return;
    const imagePath = currentImageType === 'cleaned' 
      ? `${currentChapterPath}/Raws Cleaned/${page.fileName}` 
      : `${currentChapterPath}/Raws/${page.fileName}`;
    
    mainImage.src = `scanstation-asset:///${imagePath.replace(/\\/g, '/')}`;
    showCleanedBtn.classList.toggle('active', currentImageType === 'cleaned');
    showRawBtn.classList.toggle('active', currentImageType !== 'cleaned');
    
    mainImage.onerror = () => { mainImage.src = ''; };

    // THIS IS THE CORRECTED LINE: It now uses page.fileName directly
    const drawingData = await window.api.getJsonContent(`${currentChapterPath}/data/TL Data/${page.fileName}_drawing.json`);
    
    if (mainImage.complete) {
        redrawTypesetCanvas(drawingData);
    } else {
        mainImage.onload = () => redrawTypesetCanvas(drawingData);
    }
    window.addEventListener('resize', () => redrawTypesetCanvas(drawingData));
  };

  // This new function JUST updates the content instantly

// This is the animated function ONLY for Next/Prev
const loadPage = async (index: number, isInitialLoad: boolean = false) => {
    if (index < 0 || index >= pages.length) return;
    if (!isInitialLoad && index === currentPageIndex) return;

    const galleryContent = document.querySelector('.gallery-content');

    const updateContent = async () => {
        // Typeset view doesn't have an auto-save function to call
        currentPageIndex = index;
        const page = pages[currentPageIndex];
        pageIndicator.textContent = `Page ${currentPageIndex + 1} of ${pages.length}`;
        await updateImageView();
        const translatedText = await window.api.getFileContent(`${currentChapterPath}/data/TL Data/${page.fileName}.txt`);
        translationTextDiv.textContent = translatedText || 'No translation text found for this page.';
    };

    if (isInitialLoad) {
        await updateContent(); // Run instantly
        gsap.fromTo([galleryContent, pageIndicator], { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power1.out' });
        return;
    }

    const direction = index > currentPageIndex ? 'next' : 'prev';
    const slideOutX = direction === 'next' ? '-25%' : '25%';
    const slideInX = direction === 'next' ? '25%' : '-25%';

    gsap.to([galleryContent, pageIndicator], {
        duration: 0.2,
        x: slideOutX,
        opacity: 0,
        ease: 'power1.in',
        onComplete: async () => {
            await updateContent();
            gsap.fromTo([galleryContent, pageIndicator],
                { x: slideInX, opacity: 0 },
                { duration: 0.2, x: '0%', opacity: 1, ease: 'power1.out' }
            );
        }
    });
};

  showCleanedBtn.addEventListener('click', () => {
    currentImageType = 'cleaned';
    updateImageView();
  });

  showRawBtn.addEventListener('click', () => {
    currentImageType = 'raw';
    updateImageView();
  });

  nextBtn.addEventListener('click', () => loadPage(currentPageIndex + 1));
  prevBtn.addEventListener('click', () => loadPage(currentPageIndex - 1));

  document.querySelectorAll('.external-editor-buttons button').forEach(button => {
    button.addEventListener('click', () => {
      const editor = (button as HTMLElement).dataset.editor as Editor;
      const page = pages[currentPageIndex];
      if (!page) return;
      
      const folder = currentImageType === 'cleaned' ? 'Raws Cleaned' : 'Raws';
      const filePath = `${currentChapterPath}/${folder}/${page.fileName}`;
      window.api.openFileInEditor({ editor, filePath });
    });
  });
  gotoPageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const pageNum = parseInt(gotoPageInput.value, 10);
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= pages.length) {
            loadPage(pageNum - 1); // loadPage is 0-indexed
            gotoPageInput.value = ''; // Clear input
            gotoPageInput.blur(); // Remove focus
        } else {
            gotoPageInput.value = ''; // Clear invalid input
        }
    }
});

  loadPage(startingIndex, true);
}
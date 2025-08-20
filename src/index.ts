import { app, BrowserWindow, ipcMain, dialog, protocol, session } from 'electron';
import path from 'path';
import fs from 'fs-extra';
import simpleGit, { SimpleGit } from 'simple-git';
import sharp from 'sharp';
import { getSetting, setSetting } from './settings';

// Declare the entry points for Webpack.
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const CREATE_PROJECT_WINDOW_WEBPACK_ENTRY: string;
declare const CREATE_PROJECT_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const EDIT_PROJECT_WINDOW_WEBPACK_ENTRY: string;
declare const EDIT_PROJECT_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const CHAPTER_SCREEN_WINDOW_WEBPACK_ENTRY: string;
declare const CHAPTER_SCREEN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const CREATE_CHAPTER_WINDOW_WEBPACK_ENTRY: string;
declare const CREATE_CHAPTER_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

let createProjectWindow: BrowserWindow | null = null;
let editProjectWindow: BrowserWindow | null = null;
let chapterScreenWindow: BrowserWindow | null = null;
let createChapterWindow: BrowserWindow | null = null;
let lastWindowBounds: Electron.Rectangle = { width: 1024, height: 768, x: undefined, y: undefined };


function getRepoNameFromUrl(url: string): string | null {
    const match = url.match(/([^\/]+)\.git$/);
    return match ? match[1] : null;
}

async function loadProjects(mainWindow: BrowserWindow, repositoryName: string) {
  if (!mainWindow || mainWindow.isDestroyed() || !repositoryName) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('projects-loaded', []);
    }
    return;
  }
  
  const repoPath = path.join(getStoragePath(), repositoryName);

  try {
    await fs.ensureDir(repoPath);
    const projectFolders = await fs.readdir(repoPath, { withFileTypes: true });
    const projects = [];
    for (const folder of projectFolders) {
      if (folder.isDirectory()) {
        const coverPath = path.join(repoPath, folder.name, 'cover.jpg');
        if (await fs.pathExists(coverPath)) {
          projects.push({ name: folder.name, coverPath });
        }
      }
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('projects-loaded', projects);
    }
  } catch (error) {
    console.error('Could not read projects directory:', error);
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('projects-loaded', []);
    }
  }
}

async function refreshChapters(targetWindow: BrowserWindow, repoName: string, projectName: string) {
    if (!targetWindow || targetWindow.isDestroyed()) return;

    const projectPath = path.join(getStoragePath(), repoName, projectName);
    try {
      const chapterFolders = await fs.readdir(projectPath, { withFileTypes: true });
      const chapters = chapterFolders
        .filter(dirent => dirent.isDirectory() && dirent.name.toLowerCase().startsWith('chapter '))
        .map(dirent => ({ name: dirent.name }))
        .sort((a, b) => {
          const numA = parseInt(a.name.replace(/[^0-9]/g, ''), 10);
          const numB = parseInt(b.name.replace(/[^0-9]/g, ''), 10);
          return numA - numB;
        });
      targetWindow.webContents.send('chapters-loaded', chapters);
    } catch (error) {
      console.error(`Could not read chapters for ${projectName}:`, error);
      targetWindow.webContents.send('chapters-loaded', []);
    }
}

async function initializeNewProject(projectPath: string, coverImagePath: string): Promise<void> {
  try {
    await fs.ensureDir(projectPath);
    await sharp(coverImagePath)
      .resize(512, 728, { fit: 'cover' })
      .jpeg({ quality: 90 })
      .toFile(path.join(projectPath, 'cover.jpg'));
  } catch (error) {
    dialog.showErrorBox('Project Creation Failed', `An error occurred: ${error.message}`);
  }
}

function openCreateProjectWindow(repoName: string) {
  const mainWindow = BrowserWindow.getAllWindows()[0];
  createProjectWindow = new BrowserWindow({
    width: 400, height: 550, title: 'Create New Project', modal: true,
    parent: mainWindow, resizable: false, frame: false, show: false,
    backgroundColor: '#2c2f33',
    webPreferences: { preload: CREATE_PROJECT_WINDOW_PRELOAD_WEBPACK_ENTRY },
  });
  createProjectWindow.once('ready-to-show', () => createProjectWindow.show());
  createProjectWindow.loadURL(CREATE_PROJECT_WINDOW_WEBPACK_ENTRY);
  createProjectWindow.webContents.once('dom-ready', () => {
    createProjectWindow.webContents.send('project-data-for-create-project', { repoName });
  });
}

function openEditProjectWindow(repoName: string, projectName: string) {
  const mainWindow = BrowserWindow.getAllWindows()[0];
  editProjectWindow = new BrowserWindow({
    width: 400, height: 550, title: 'Edit Project', modal: true,
    parent: mainWindow, resizable: false, frame: false, show: false,
    backgroundColor: '#2c2f33',
    webPreferences: { preload: EDIT_PROJECT_WINDOW_PRELOAD_WEBPACK_ENTRY, },
  });
  editProjectWindow.once('ready-to-show', () => editProjectWindow.show());
  editProjectWindow.webContents.once('dom-ready', () => {
    const coverPath = path.join(getStoragePath(), repoName, projectName, 'cover.jpg');
    editProjectWindow.webContents.send('project-data-for-edit', { name: projectName, coverPath, repoName });
  });
  editProjectWindow.loadURL(EDIT_PROJECT_WINDOW_WEBPACK_ENTRY);
}

// --- Reusable Helper for Authenticated Push ---
async function performAuthenticatedPush(git: SimpleGit) {
    const pat = getSetting<string>('githubPat');
    if (!pat) {
        throw new Error('Personal Access Token not set.');
    }

    const remotes = await git.getRemotes(true);
    const origin = remotes.find(r => r.name === 'origin');
    if (!origin) {
        throw new Error('No "origin" remote found for this repository.');
    }
    
    const originalUrl = origin.refs.push;
    const authenticatedUrl = originalUrl.replace('https://', `https://${pat}@`);
    
    try {
        await git.remote(['set-url', 'origin', authenticatedUrl]);
        await git.push('origin', 'main');
    } finally {
        await git.remote(['set-url', 'origin', originalUrl]);
    }
}


// --- IPC Handlers ---

ipcMain.on('open-create-project-window', (_, repoName) => openCreateProjectWindow(repoName));
ipcMain.on('select-cover-image', async (event) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
  });
  if (!canceled && filePaths.length > 0) {
    event.sender.send('cover-image-selected', filePaths[0]);
  }
});

ipcMain.on('cancel-project-creation', () => {
  if (createProjectWindow) createProjectWindow.close();
});

ipcMain.on('submit-project-creation', async (_, { repoName, name, path: coverPath }) => {
  const projectPath = path.join(getStoragePath(), repoName, name);
  const projectExists = await fs.pathExists(projectPath);
  if (projectExists) {
    dialog.showErrorBox('Project Exists', `A project named "${name}" already exists.`);
    return;
  }
  await initializeNewProject(projectPath, coverPath);
  if (createProjectWindow) createProjectWindow.close();
  const mainWindow = BrowserWindow.getAllWindows()[0];
  if (mainWindow) loadProjects(mainWindow, repoName);
});

ipcMain.on('open-project', (_, { repoName, projectName }) => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      lastWindowBounds = mainWindow.getBounds();
      mainWindow.close();
      chapterScreenWindow = new BrowserWindow({
        ...lastWindowBounds, show: false, backgroundColor: '#23272a',
        webPreferences: { preload: CHAPTER_SCREEN_WINDOW_PRELOAD_WEBPACK_ENTRY, },
      });
      chapterScreenWindow.once('ready-to-show', () => chapterScreenWindow.show());
      chapterScreenWindow.webContents.once('dom-ready', () => {
        chapterScreenWindow.webContents.send('project-data-for-chapter-screen', { repoName, projectName });
      });
      chapterScreenWindow.loadURL(CHAPTER_SCREEN_WINDOW_WEBPACK_ENTRY);
    }
});

ipcMain.handle('delete-project', async (_, { repoName, projectName }) => {
  const { response } = await dialog.showMessageBox({
    type: 'warning', title: 'Delete Project',
    message: `Are you sure you want to permanently delete '${projectName}'?`,
    detail: 'This action cannot be undone.',
    buttons: ['Delete', 'Cancel'], defaultId: 1, cancelId: 1,
  });
  if (response === 1) return { success: false };
  try {
    const projectPath = path.join(getStoragePath(), repoName, projectName);
    await fs.rm(projectPath, { recursive: true, force: true });
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) loadProjects(mainWindow, repoName);
    return { success: true };
  } catch (error) {
    dialog.showErrorBox('Delete Failed', `Could not delete project folder. Error: ${error.message}`);
    return { success: false };
  }
});

ipcMain.on('open-edit-project-window', (_, { repoName, projectName }) => openEditProjectWindow(repoName, projectName));

ipcMain.on('cancel-project-update', () => {
  if (editProjectWindow) editProjectWindow.close();
});

ipcMain.handle('submit-project-update', async (_, data) => {
  const { repoName, originalName, newName, newCoverPath } = data;
  const repoPath = path.join(getStoragePath(), repoName);
  const originalPath = path.join(repoPath, originalName);
  const newPath = path.join(repoPath, newName);
  try {
    if (newName !== originalName) {
      if (await fs.pathExists(newPath)) {
        dialog.showErrorBox('Rename Failed', `A project named '${newName}' already exists.`);
        return { success: false };
      }
      await fs.rename(originalPath, newPath);
    }
    if (newCoverPath) {
      await sharp(newCoverPath)
        .resize(512, 728, { fit: 'cover' })
        .jpeg({ quality: 90 })
        .toFile(path.join(newPath, 'cover.jpg'));
    }
    if (editProjectWindow) editProjectWindow.close();
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) loadProjects(mainWindow, repoName);
    return { success: true };
  } catch (error) {
    dialog.showErrorBox('Update Failed', `An error occurred. Error: ${error.message}`);
    return { success: false };
  }
});

ipcMain.on('go-back-to-projects', () => {
    if (chapterScreenWindow) {
      lastWindowBounds = chapterScreenWindow.getBounds();
      chapterScreenWindow.close();
      createWindow();
    }
});

ipcMain.on('get-chapters', async (event, { repoName, projectName }) => {
    refreshChapters(BrowserWindow.fromWebContents(event.sender), repoName, projectName);
});

ipcMain.on('open-create-chapter-window', (_, { repoName, projectName }) => {
    if (!chapterScreenWindow) return;
    createChapterWindow = new BrowserWindow({
      width: 450, height: 480, title: 'Create New Chapter', modal: true,
      parent: chapterScreenWindow, resizable: false, frame: false, show: false,
      backgroundColor: '#2c2f33',
      webPreferences: { preload: CREATE_CHAPTER_WINDOW_PRELOAD_WEBPACK_ENTRY, },
    });
    createChapterWindow.once('ready-to-show', () => createChapterWindow.show());
    createChapterWindow.webContents.once('dom-ready', () => {
      createChapterWindow.webContents.send('project-data-for-create-chapter', { repoName, projectName });
    });
    createChapterWindow.loadURL(CREATE_CHAPTER_WINDOW_WEBPACK_ENTRY);
});

ipcMain.on('cancel-chapter-creation', () => {
    if (createChapterWindow) createChapterWindow.close();
});

ipcMain.handle('submit-chapter-creation', async (_, data) => {
    const { repoName, projectName, chapterNumber, chapterName, includeFinal } = data;
    const chapterFolderName = `chapter ${chapterNumber} - ${chapterName.replace(/[^a-z0-9_ -]/gi, '')}`;
    const chapterPath = path.join(getStoragePath(), repoName, projectName, chapterFolderName);
    if (await fs.pathExists(chapterPath)) {
      dialog.showErrorBox('Chapter Exists', `A chapter folder named '${chapterFolderName}' already exists.`);
      return { success: false };
    }
    try {
        const foldersToCreate = ['Raws', 'Raws Cleaned', 'Edit Files', 'Typesetted'];
        if (includeFinal) foldersToCreate.push('Final');
        await Promise.all(foldersToCreate.map(folder => fs.ensureDir(path.join(chapterPath, folder))));
        await refreshChapters(chapterScreenWindow, repoName, projectName);
        if (createChapterWindow) createChapterWindow.close();
        return { success: true };
    } catch (error) {
        dialog.showErrorBox('Creation Failed', `Could not create chapter. Error: ${error.message}`);
        return { success: false };
    }
});

ipcMain.on('load-projects', (event, repoName: string) => {
  const mainWindow = BrowserWindow.fromWebContents(event.sender);
  if (mainWindow) loadProjects(mainWindow, repoName);
});

// --- Repo, Token & Git Handlers ---

ipcMain.handle('set-pat', (_, token: string) => {
    setSetting('githubPat', token);
});

ipcMain.handle('get-repositories', () => ({
    repositories: getSetting<string[]>('repositories') || [],
    selected: getSetting<string>('selectedRepository') || null,
}));

ipcMain.on('set-selected-repository', (event, repoName: string) => {
    setSetting('selectedRepository', repoName);
    loadProjects(BrowserWindow.fromWebContents(event.sender), repoName);
});

ipcMain.handle('add-repository', async (_, repoUrl: string) => {
    const repoName = getRepoNameFromUrl(repoUrl);
    if (!repoName) {
        dialog.showErrorBox('Invalid URL', 'Could not determine repository name from the URL.');
        return { success: false };
    }
    const targetPath = path.join(getStoragePath(), repoName);
    const pat = getSetting<string>('githubPat');
    const authenticatedUrl = pat ? repoUrl.replace('https://', `https://${pat}@`) : repoUrl;

    if (await fs.pathExists(targetPath)) {
        dialog.showMessageBox({ title: 'Repository Exists', message: `The folder for '${repoName}' already exists.` });
    } else {
        try {
            await simpleGit().clone(authenticatedUrl, targetPath);
        } catch (error) {
            dialog.showErrorBox('Clone Failed', `Could not clone repository. This is often due to an invalid URL or an incorrect/missing Personal Access Token.\n\nError: ${error.message}`);
            return { success: false };
        }
    }
    const currentRepos = getSetting<string[]>('repositories') || [];
    if (!currentRepos.includes(repoName)) {
        setSetting('repositories', [...currentRepos, repoName]);
    }
    return { success: true, repoName };
});

ipcMain.handle('git-status', async (_, { repoName }) => {
    const repoPath = path.join(getStoragePath(), repoName);
    return await simpleGit(repoPath).status();
});

ipcMain.handle('git-commit', async (_, { repoName, message }) => {
    const repoPath = path.join(getStoragePath(), repoName);
    const git = simpleGit(repoPath);
    await git.add('.');
    return await git.commit(message);
});

ipcMain.handle('get-pat-status', () => {
    return !!getSetting('githubPat');
});

ipcMain.handle('remove-pat', () => {
    setSetting('githubPat', undefined); // Using undefined deletes the key from settings
});

ipcMain.handle('git-push', async (_, { repoName }) => {
    const repoPath = path.join(getStoragePath(), repoName);
    await performAuthenticatedPush(simpleGit(repoPath));
    return { success: true };
});

ipcMain.handle('git-sync-repository', async (_, repoName: string) => {
    const repoPath = path.join(getStoragePath(), repoName);
    const git = simpleGit(repoPath);

    const status = await git.status();
    if (status.isClean()) {
        return { success: true, message: 'Repository is already up-to-date.' };
    }

    await git.add('.');
    await git.commit(`Sync: Scanstation auto-commit on ${new Date().toISOString()}`);
    await performAuthenticatedPush(git);

    return { success: true, message: 'Repository synced successfully.' };
});


function getStoragePath(): string {
  const customPath = getSetting<string>('projectStoragePath');
  const basePath = customPath || path.join(app.getPath('userData'), 'Scanstation');
  return path.join(basePath, 'projects');
}

async function handleFirstBoot(): Promise<void> {
  if (getSetting('initialSetupComplete')) return;
  const { response } = await dialog.showMessageBox({
    type: 'info', title: 'Data Folder Configuration',
    message: 'Select a base folder for your Scanstation data.',
    detail: `A 'projects' subfolder will be created in the directory you choose.`,
    buttons: ['Select Custom Folder...', 'Use Default'], defaultId: 1,
  });
  if (response === 0) {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory'], title: 'Select a Folder to Store Projects',
    });
    if (!canceled && filePaths.length > 0) {
      setSetting('projectStoragePath', filePaths[0]);
    }
  }
  setSetting('initialSetupComplete', true);
}

async function updateAllRepositories() {
    console.log('Checking for repository updates...');
    const repos = getSetting<string[]>('repositories') || [];
    const pat = getSetting<string>('githubPat');

    for (const repoName of repos) {
        const repoPath = path.join(getStoragePath(), repoName);
        try {
            if (await fs.pathExists(path.join(repoPath, '.git'))) {
                console.log(`Pulling latest changes for ${repoName}...`);
                const git = simpleGit(repoPath);
                if (pat) {
                    const remotes = await git.getRemotes(true);
                    const origin = remotes.find(r => r.name === 'origin');
                    if (origin) {
                        const authenticatedUrl = origin.refs.fetch.replace('https://', `https://${pat}@`);
                        await git.remote(['set-url', 'origin', authenticatedUrl]);
                        await git.pull();
                        await git.remote(['set-url', 'origin', origin.refs.fetch]);
                    }
                } else {
                    await git.pull();
                }
            }
        } catch (error) {
            console.error(`Failed to pull repository ${repoName}:`, error.message);
        }
    }
    console.log('Repository update check finished.');
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    ...lastWindowBounds, show: false, backgroundColor: '#23272a',
    webPreferences: { preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY, },
  });
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    const selectedRepo = getSetting<string>('selectedRepository');
    loadProjects(mainWindow, selectedRepo);
  });
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
};

app.whenReady().then(async () => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [ `default-src 'self'; script-src 'self' ${!app.isPackaged ? "'unsafe-eval'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' scanstation-asset: data:`, ], },
    });
  });

  protocol.registerFileProtocol('scanstation-asset', (request, callback) => {
    try {
      const url = new URL(request.url);
      let decodedPath = decodeURI(url.pathname);
       if (process.platform === 'win32' && decodedPath.startsWith('/')) {
        decodedPath = decodedPath.substring(1);
      }
      callback({ path: path.normalize(decodedPath) });
    } catch (error) {
      console.error('Failed to resolve file path:', error, request.url);
      callback({ error: -6 });
    }
  });

  await handleFirstBoot();
  await updateAllRepositories();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
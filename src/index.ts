import { AppStore } from './settings';

import { app, BrowserWindow, ipcMain, dialog, protocol, session, shell } from 'electron';
import path from 'path';
import fs from 'fs-extra';
import simpleGit, { SimpleGit } from 'simple-git';
import Jimp from 'jimp';
import { getSetting, setSetting, deleteSetting } from './settings';
import { execFile } from 'child_process';

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
declare const SPLASH_WINDOW_WEBPACK_ENTRY: string;
declare const SPLASH_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const SETTINGS_WINDOW_WEBPACK_ENTRY: string;
declare const SETTINGS_WINDOW_PRELOAD_WEBPACK_ENTRY: string;


let createProjectWindow: BrowserWindow | null = null;
let editProjectWindow: BrowserWindow | null = null;
let chapterScreenWindow: BrowserWindow | null = null;
let createChapterWindow: BrowserWindow | null = null;
let lastWindowBounds: Electron.Rectangle = { width: 1024, height: 768, x: undefined, y: undefined };
let splashWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;


function getRepoNameFromUrl(url: string): string | null {
    const match = url.match(/([^\/]+)\.git$/);
    return match ? match[1] : null;
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 150,
    backgroundColor: '#2c2f33',
    frame: false,
    resizable: false,
    center: true,
    webPreferences: {
      preload: SPLASH_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });
  splashWindow.loadURL(SPLASH_WINDOW_WEBPACK_ENTRY);
  splashWindow.on('closed', () => (splashWindow = null));
}


function updateSplashStatus(message: string) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('status-update', message);
  }
}

function openSettingsWindow() {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    settingsWindow = new BrowserWindow({
        width: 600,
        height: 400,
        title: 'Settings',
        modal: true,
        parent: mainWindow,
        resizable: false,
        frame: false,
        show: false,
        backgroundColor: '#2c2f33',
        webPreferences: {
            preload: SETTINGS_WINDOW_PRELOAD_WEBPACK_ENTRY, // Ensure this matches the name in forge.config.ts
        },
    });
    settingsWindow.loadURL(SETTINGS_WINDOW_WEBPACK_ENTRY); // Ensure this matches the name in forge.config.ts
    settingsWindow.once('ready-to-show', () => settingsWindow.show());
    settingsWindow.on('closed', () => (settingsWindow = null));
}

ipcMain.on('open-settings-window', openSettingsWindow);
ipcMain.on('close-settings-window', () => {
    if (settingsWindow) settingsWindow.close();
});
ipcMain.handle('get-editor-paths', () => {
    return {
        photoshop: getSetting('photoshopPath'),
        illustrator: getSetting('illustratorPath'),
        gimp: getSetting('gimpPath'),
    };
});
ipcMain.handle('select-editor-path', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        title: 'Select Editor Executable',
    });
    return !canceled && filePaths.length > 0 ? filePaths[0] : null;
});
ipcMain.handle('set-editor-path', (_, { editor, path }: { editor: string, path: string }) => {
    const key = `${editor}Path` as keyof AppStore;
    setSetting(key, path);
});

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

async function backupProjects() {
    const sourcePath = getStoragePath();
    // Creates the backup path as a sibling to the 'projects' folder
    const backupPath = path.join(sourcePath, '..', 'backup');

    try {
        // Only run the backup if the projects folder actually exists
        if (await fs.pathExists(sourcePath)) {
            console.log(`Backing up projects from ${sourcePath} to ${backupPath}...`);
            // This copies the directory, overwriting any existing backup
            await fs.copy(sourcePath, backupPath, { overwrite: true });
            console.log('Backup completed successfully.');
        } else {
            console.log('Projects folder not found, skipping backup.');
        }
    } catch (error) {
        console.error('Failed to backup project folder:', error);
        dialog.showErrorBox('Backup Failed', `Could not create a backup of the projects folder. Error: ${error.message}`);
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
    const image = await Jimp.read(coverImagePath);
    await image
      .cover(512, 728) // Resizes and crops to fit the dimensions
      .quality(90) // Sets JPEG quality
      .writeAsync(path.join(projectPath, 'cover.jpg')); // Saves the file
  } catch (error) {
    dialog.showErrorBox('Project Creation Failed', `An error occurred: ${error.message}`);
  }
}}

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
    // CORRECTED LINE
    const cleanUrl = originalUrl.replace(/^(https:\/\/)(?:.*@)?(.*)$/, '$1$2');
    const authenticatedUrl = cleanUrl.replace('https://', `https://${pat}@`);

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

ipcMain.handle('open-file-in-editor', async (_, { editor, filePath }: { editor: string, filePath: string }) => {
    const key = `${editor}Path` as keyof AppStore;
    const editorPath = getSetting<string>(key);

    if (!editorPath) {
        dialog.showMessageBox({
            type: 'warning',
            title: 'Editor Path Not Set',
            message: `You haven't linked your programs. Please do so on the settings screen.`
        });
        return { success: false, error: 'Editor path not set.' };
    }

    try {
        if (!await fs.pathExists(editorPath)) throw new Error(`Executable not found at: ${editorPath}`);
        if (!await fs.pathExists(filePath)) throw new Error(`Image file not found at: ${filePath}`);

        execFile(editorPath, [filePath], (error) => {
            if (error) throw error;
        });
        return { success: true };
    } catch (error) {
        console.error(`Failed to open ${filePath} in ${editor}:`, error);
        dialog.showErrorBox('Error Opening File', `Could not open file in ${editor}.\n\nError: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('git-pull', async (_, repoName: string) => {
    const repoPath = path.join(getStoragePath(), repoName);
    const git = simpleGit(repoPath);
    const pat = getSetting<string>('githubPat');
    if (!await fs.pathExists(path.join(repoPath, '.git'))) {
        throw new Error(
            `The folder for '${repoName}' is not a valid Git repository.\n\n` +
            `Please remove the existing folder from your projects directory and add the repository again.`
        );
    }

    try {
        const pullAction = async (gitInstance: SimpleGit) => {
            try {
                const pullSummary = await gitInstance.pull();
                if (pullSummary.files.length === 0 && pullSummary.summary.changes === 0) {
                    return { success: true, message: 'Repository is already up-to-date.' };
                }
                return { success: true, message: `Successfully pulled changes!\nFiles changed: ${pullSummary.summary.changes}` };
            } catch (pullError) {
                if (pullError.message.includes('refusing to merge unrelated histories')) {
                    // Retry the pull with the flag that allows merging unrelated histories
                    await gitInstance.pull(null, null, ['--allow-unrelated-histories']);
                    return { success: true, message: 'Successfully merged unrelated histories from the remote repository.' };
                }
                // Re-throw any other type of pull error
                throw pullError;
            }
        };

        if (pat) {
            const remotes = await git.getRemotes(true);
            const origin = remotes.find(r => r.name === 'origin');
            if (origin) {
                const originalUrl = origin.refs.fetch;
                const cleanUrl = originalUrl.replace(/^(https:\/\/)(?:.*@)?(.*)$/, '$1$2');
                const authenticatedUrl = cleanUrl.replace('https://', `https://${pat}@`);
                try {
                    await git.remote(['set-url', 'origin', authenticatedUrl]);
                    return await pullAction(git);
                } finally {
                    await git.remote(['set-url', 'origin', originalUrl]);
                }
            }
        }
        return await pullAction(git);
    } catch (error) {
        if (error.message.includes('Already up to date')) {
             return { success: true, message: 'Repository is already up-to-date.' };
        }
        if (error.message.includes('no such ref was fetched')) {
            throw new Error(
                "Could not find the 'main' branch on the remote repository.\n\n" +
                "This usually means the repository is empty. Please make an initial commit to the repository first."
            );
        }
        console.error(`Failed to pull repository ${repoName}:`, error);
        throw error;
    }
});

ipcMain.on('submit-project-creation', async (_, { repoName, name, path: coverPath }) => {
  const projectPath = path.join(getStoragePath(), repoName, name);
  const projectExists = await fs.pathExists(projectPath);
  if (projectExists) {
    dialog.showErrorBox('Project Exists', `A project named "${name}" already exists.`);
    return;
  }
  await initializeNewProject(projectPath, coverPath);

  // Get a direct reference to the main window from the modal's parent property
  const mainWindow = createProjectWindow?.getParentWindow();

  if (createProjectWindow) {
    createProjectWindow.close();
  }

  // Use the direct reference to reload the projects
  if (mainWindow) {
    loadProjects(mainWindow, repoName);
  }
});

ipcMain.on('open-project', (_, { repoName, projectName, chapterName }) => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
        const chapterPath = path.join(getStoragePath(), repoName, projectName, chapterName);
        
        // 1. Load the correct chapter screen HTML file
        mainWindow.loadURL(CHAPTER_SCREEN_WINDOW_WEBPACK_ENTRY);

        // 2. After the page is loaded, send the data it needs
        mainWindow.webContents.once('dom-ready', () => {
            mainWindow.webContents.send('project-data-for-chapter-screen', { repoName, projectName, chapterName, chapterPath });
        });
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
      const image = await Jimp.read(newCoverPath);
      await image
        .cover(512, 728)
        .quality(90)
        .writeAsync(path.join(newPath, 'cover.jpg'));
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

ipcMain.on('go-back-to-projects', (_, { repoName, projectName }) => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
        mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
        // After the main window loads, tell it to show the chapter selection screen
        mainWindow.webContents.once('dom-ready', () => {
            mainWindow.webContents.send('show-chapter-selection-for-project', { repoName, projectName });
        });
    }
});

ipcMain.on('get-chapters', async (event, { repoName, projectName }) => {
    refreshChapters(BrowserWindow.fromWebContents(event.sender), repoName, projectName);
});

ipcMain.on('open-create-chapter-window', (_, { repoName, projectName }) => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (!mainWindow) return; // Exit if the main window isn't found

    createChapterWindow = new BrowserWindow({
      width: 450,
      height: 380, // Adjusted height after removing the optional folder checkbox
      title: 'Create New Chapter',
      modal: true,
      parent: mainWindow, // Use the main window as the parent
      resizable: false,
      frame: false,
      show: false,
      backgroundColor: '#2c2f33',
      webPreferences: {
        preload: CREATE_CHAPTER_WINDOW_PRELOAD_WEBPACK_ENTRY,
      },
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
    const { repoName, projectName, chapterNumber, chapterName } = data;
    const chapterFolderName = `chapter ${chapterNumber} - ${chapterName.replace(/[^a-z0-9_ -]/gi, '')}`;
    const chapterPath = path.join(getStoragePath(), repoName, projectName, chapterFolderName);
    if (await fs.pathExists(chapterPath)) {
      dialog.showErrorBox('Chapter Exists', `A chapter folder named '${chapterFolderName}' already exists.`);
      return { success: false };
    }
    try {
        // "Final" folder is now created by default
        const foldersToCreate = ['Raws', 'Raws Cleaned', 'Edit Files', 'Typesetted', 'Final', 'data'];
        
        await Promise.all(foldersToCreate.map(folder => fs.ensureDir(path.join(chapterPath, folder))));
        const parentWindow = createChapterWindow?.getParentWindow();
        if (parentWindow) {
            await refreshChapters(parentWindow, repoName, projectName);
        }
        if (createChapterWindow) createChapterWindow.close();
        return { success: true };
    } catch (error) {
        dialog.showErrorBox('Creation Failed', `Could not create chapter.
Error: ${error.message}`);
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
          // Folder exists, now check if it's a valid git repo
          if (await fs.pathExists(path.join(targetPath, '.git'))) {
              dialog.showMessageBox({ title: 'Repository Exists', message: `The repository '${repoName}' has already been added.` });
          } else {
              // Folder exists but is NOT a git repo
              dialog.showErrorBox('Invalid Folder', `A folder named '${repoName}' already exists but is not a valid Git repository.\n\nPlease manually remove this folder and try again.`);
              return { success: false };
          }
      } else {
          // Folder does not exist, so clone it
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
    const status = await simpleGit(repoPath).status();
    // Instead of returning the whole complex object,
    // we return a new, simple object with only the data we need.
    return {
        files: status.files,
    };
});

ipcMain.handle('heal-chapter-folders', async (_, chapterPath: string) => {
    try {
        const requiredFolders = [
            'Raws', 'Raws Cleaned', 'Edit Files', 'Typesetted', 'Final', 'data',
            path.join('data', 'TL Data'),
            path.join('data', 'PR Data')
        ];
        
        await Promise.all(
            requiredFolders.map(folder => fs.ensureDir(path.join(chapterPath, folder)))
        );
        
        return { success: true };
    } catch (error) {
        console.error('Failed to heal chapter folders:', error);
        dialog.showErrorBox('Healing Failed', `Could not recreate folder structure. Error: ${error.message}`);
        return { success: false, error: error.message };
    }
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
    deleteSetting('githubPat');
});

ipcMain.handle('git-push', async (_, { repoName }) => {
    const repoPath = path.join(getStoragePath(), repoName);
    await performAuthenticatedPush(simpleGit(repoPath));
    return { success: true };
});

ipcMain.handle('git-sync-repository', async (_, repoName: string) => {
    const repoPath = path.join(getStoragePath(), repoName);
    const git = simpleGit(repoPath);

    try {
        // First, commit any untracked or modified files
        const preCommitStatus = await git.status();
        if (!preCommitStatus.isClean()) {
            await git.add('.');
            await git.commit(`Sync: Scanstation auto-commit on ${new Date().toISOString()}`);
        }

        // Now, perform an authenticated fetch to get the latest remote state
        const pat = getSetting<string>('githubPat');
        if (pat) {
            const remotes = await git.getRemotes(true);
            const origin = remotes.find(r => r.name === 'origin');
            if (origin) {
                const originalUrl = origin.refs.fetch;
                const cleanUrl = originalUrl.replace(/^(https:\/\/)(?:.*@)?(.*)$/, '$1$2');
                const authenticatedUrl = cleanUrl.replace('https://', `https://${pat}@`);
                try {
                    await git.remote(['set-url', 'origin', authenticatedUrl]);
                    await git.fetch();
                } finally {
                    await git.remote(['set-url', 'origin', originalUrl]);
                }
            }
        } else {
            // Fallback for public repositories
            await git.fetch();
        }
        
        const postCommitStatus = await git.status();

        // Check if the local branch is ahead of the remote
        if (postCommitStatus.ahead > 0) {
            await performAuthenticatedPush(git); // This function already handles its own auth
            return { success: true, message: 'Repository synced successfully!' };
        } else {
            return { success: true, message: 'Repository is already up-to-date.' };
        }
    } catch (error) {
        console.error(`Failed to sync repository ${repoName}:`, error);
        throw error; // Rethrow for the renderer to display the error
    }
});

// --- Chapter Workspace IPC Handlers ---

// Helper function to read/write a JSON status file in the chapter's 'data' folder
async function getChapterStatus(chapterPath: string) {
    const statusFilePath = path.join(chapterPath, 'data', 'page_status.json');
    if (!await fs.pathExists(statusFilePath)) return {};
    const content = await fs.readFile(statusFilePath, 'utf-8');
    return content ? JSON.parse(content) : {};
}

async function saveChapterStatus(chapterPath: string, status: any) {
    const statusFilePath = path.join(chapterPath, 'data', 'page_status.json');
    await fs.ensureFile(statusFilePath);
    await fs.writeFile(statusFilePath, JSON.stringify(status, null, 2));
}

// Opens the chapter's folder in the system's file explorer
ipcMain.on('open-chapter-folder', (_, chapterPath: string) => {
    shell.openPath(chapterPath);
});

// Gathers the status of all pages in a chapter
ipcMain.handle('get-chapter-page-status', async (_, chapterPath: string) => {
    try {
        const rawFiles = await fs.readdir(path.join(chapterPath, 'Raws'));
        const cleanedFiles = new Set(await fs.readdir(path.join(chapterPath, 'Raws Cleaned')));
        const initialTypesetFiles = await fs.readdir(path.join(chapterPath, 'Typesetted'));
        const statusData = await getChapterStatus(chapterPath);

        const typesetFiles = new Set<string>();
        for (const file of initialTypesetFiles) {
            const spreadMatch = file.match(/^(\d+)-(\d+)\..+$/);
            if (spreadMatch) {
                const start = parseInt(spreadMatch[1], 10);
                const end = parseInt(spreadMatch[2], 10);
                for (let i = start; i <= end; i++) {
                    const pageNumberStr = i.toString();
                    // Find the corresponding raw file to add to the set
                    const correspondingRaw = rawFiles.find(raw => 
                        raw.replace(/[^0-9]/g, '').includes(pageNumberStr)
                    );
                    if (correspondingRaw) {
                        typesetFiles.add(correspondingRaw);
                    }
                }
            } else {
                typesetFiles.add(file);
            }
        }

        const pages = rawFiles
            .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
            .map(pageFile => {
                const pageStatus = statusData[pageFile] || {};
                return {
                    fileName: pageFile,
                    status: {
                        CL: cleanedFiles.has(pageFile),
                        TS: typesetFiles.has(pageFile),
                        TL: pageStatus.TL || false,
                        PR: pageStatus.PR || false,
                        QC: pageStatus.QC || false,
                    }
                };
        });
        return { success: true, pages };
    } catch (error) {
        dialog.showErrorBox('Error Loading Pages', `Could not read page folders. Error: ${error.message}`);
        return { success: false, pages: [] };
    }
});

// Generic handlers to read text or JSON file content
ipcMain.handle('get-file-content', async (_, filePath: string) => {
    return (await fs.pathExists(filePath)) ? fs.readFile(filePath, 'utf-8') : '';
});

ipcMain.handle('get-json-content', async (_, filePath: string) => {
    if (!await fs.pathExists(filePath)) return null;
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
});

// Saves translation text and drawing data

// --- REPLACE WITH THIS UPDATED VERSION ---
ipcMain.handle('save-translation-data', async (_, { chapterPath, pageFile, text, drawingData }) => {
    try {
        const tlDataPath = path.join(chapterPath, 'data', 'TL Data');
        await fs.ensureDir(tlDataPath);

        const status = await getChapterStatus(chapterPath);
        // Always save the text and drawing files
        await fs.writeFile(path.join(tlDataPath, `${pageFile}.txt`), text);
        await fs.writeFile(path.join(tlDataPath, `${pageFile}_drawing.json`), JSON.stringify(drawingData));
        
        if (!status[pageFile]) status[pageFile] = {};

        // Only mark as translated if there is actual text content.
        if (text && text.trim().length > 0) {
            status[pageFile].TL = true;
        } else {
            status[pageFile].TL = false;
        }

        await saveChapterStatus(chapterPath, status);
        return { success: true, newStatus: status[pageFile] };
    } catch (error) {
        console.error('Error saving translation data:', error);
        return { success: false, error: error.message };
    }
});

// Saves proofread annotations
ipcMain.handle('save-proofread-data', async (_, { chapterPath, pageFile, annotations }) => {
    try {
        const prDataPath = path.join(chapterPath, 'data', 'PR Data');
        await fs.ensureDir(prDataPath);

        const status = await getChapterStatus(chapterPath);
        // Always save the annotation file to capture when a user clears their notes
        await fs.writeFile(path.join(prDataPath, `${pageFile}_proof.txt`), annotations);

        if (!status[pageFile]) status[pageFile] = {};

        // Only circle the status if there are actual annotations.
        if (annotations && annotations.trim().length > 0) {
            status[pageFile].PR = 'annotated';
            status[pageFile].QC = 'annotated';
        } else {
            // If annotations are cleared, revert the status from 'annotated' to false (not started).
            // This won't affect pages that are already marked as correct (true).
            if (status[pageFile].PR === 'annotated') {
                status[pageFile].PR = false;
            }
            if (status[pageFile].QC === 'annotated') {
                status[pageFile].QC = false;
            }
        }

        await saveChapterStatus(chapterPath, status);
        return { success: true, newStatus: status[pageFile] };
    } catch (error) {
        console.error('Error saving proofread data:', error);
        return { success: false, error: error.message };
    }
});

// Marks a page as correct, copies it to the Final folder, and updates its status
ipcMain.handle('mark-page-correct', async (_, { chapterPath, pageFile }) => {
    try {
        const typesetPath = path.join(chapterPath, 'Typesetted', pageFile);
        if (!await fs.pathExists(typesetPath)) {
          return { success: false, error: 'Typeset file not found.' };
        }
        
        await fs.copy(typesetPath, path.join(chapterPath, 'Final', pageFile), { overwrite: true });
        
        const status = await getChapterStatus(chapterPath);
        if (!status[pageFile]) status[pageFile] = {};
        status[pageFile].PR = true;
        status[pageFile].QC = true;
        await saveChapterStatus(chapterPath, status);

        // Update path to look in PR Data folder
        const annotationsPath = path.join(chapterPath, 'data', 'PR Data', `${pageFile}_proof.txt`);
        if(await fs.pathExists(annotationsPath)) await fs.remove(annotationsPath);

        return { success: true, newStatus: status[pageFile] };
    } catch (error) {
        console.error('Error marking page as correct:', error);
        return { success: false, error: error.message };
    }
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
    const outdatedRepos: string[] = [];

    for (const repoName of repos) {
        const repoPath = path.join(getStoragePath(), repoName);
        try {
            if (await fs.pathExists(path.join(repoPath, '.git'))) {
                console.log(`Checking for outdated status in ${repoName}...`);
                const git = simpleGit(repoPath);

                // Perform an authenticated fetch to get remote status
                if (pat) {
                    const remotes = await git.getRemotes(true);
                    const origin = remotes.find(r => r.name === 'origin');
                    if (origin) {
                        const originalUrl = origin.refs.fetch;
                        const cleanUrl = originalUrl.replace(/^(https:\/\/)(?:.*@)?(.*)$/, '$1$2');
                        try {
                            const authenticatedUrl = cleanUrl.replace('https://', `https://${pat}@`);
                            await git.remote(['set-url', 'origin', authenticatedUrl]);
                            await git.fetch();
                        } finally {
                            await git.remote(['set-url', 'origin', originalUrl]);
                        }
                    } else {
                         await git.fetch(); // Fallback for no origin
                    }
                } else {
                    await git.fetch();
                }

                // Check status and record if outdated
                const status = await git.status();
                if (status.behind > 0) {
                    outdatedRepos.push(repoName);
                }
            }
        } catch (error) {
            console.error(`Failed to check repository status for ${repoName}:`, error.message);
            // Silently fail for one repo to not interrupt the startup for others.
        }
    }

    // After checking all repos, show a single prompt if any are outdated.
    if (outdatedRepos.length > 0) {
        const isSingle = outdatedRepos.length === 1;
        const repoList = outdatedRepos.join(', ');
        dialog.showMessageBox({
            type: 'warning',
            title: `Repository${isSingle ? '' : 's'} Outdated`,
            message: `Your repositor${isSingle ? 'y' : 'ies'} (${repoList}) ${isSingle ? 'is' : 'are'} outdated.`,
            detail: 'Remember to pull before making any local changes to avoid potential conflicts.'
        });
    }

    console.log('Repository update check finished.');
}

const createWindow = (): BrowserWindow => {
  const mainWindow = new BrowserWindow({
    ...lastWindowBounds,
    show: false, // The main window will start hidden
    backgroundColor: '#23272a',
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  
  mainWindow.once('ready-to-show', () => {
    const selectedRepo = getSetting<string>('selectedRepository');
    if (selectedRepo) {
      loadProjects(mainWindow, selectedRepo);
    }
  });

  return mainWindow;
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

  createSplashWindow();

  await handleFirstBoot();

  updateSplashStatus('Backing up current user folder...');
  await backupProjects();

  // updateSplashStatus('Pulling changes from repositories...');
  // await updateAllRepositories();

  updateSplashStatus('Done!');
  const mainWindow = createWindow();
  
  setTimeout(() => {
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
    }
    mainWindow.show();
  }, 1200); // A short delay to show "Done!"

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const mw = createWindow();
      mw.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // --- Main Window ---
  onProjectsLoaded: (callback) => ipcRenderer.on('projects-loaded', (_event, projects) => callback(projects)),
  openProject: (repoName, projectName, chapterName) => ipcRenderer.send('open-project', { repoName, projectName, chapterName }),
  deleteProject: (repoName, projectName) => ipcRenderer.invoke('delete-project', { repoName, projectName }),
  openEditProjectWindow: (repoName, projectName) => ipcRenderer.send('open-edit-project-window', { repoName, projectName }),

  // --- Chapter Workspace ---
  openChapterFolder: (chapterPath) => ipcRenderer.send('open-chapter-folder', chapterPath),
  getChapterPageStatus: (chapterPath) => ipcRenderer.invoke('get-chapter-page-status', chapterPath),
  getFileContent: (filePath) => ipcRenderer.invoke('get-file-content', filePath),
  getJsonContent: (filePath) => ipcRenderer.invoke('get-json-content', filePath),
  saveTranslationData: (data) => ipcRenderer.invoke('save-translation-data', data),
  saveProofreadData: (data) => ipcRenderer.invoke('save-proofread-data', data),
  markPageCorrect: (data) => ipcRenderer.invoke('mark-page-correct', data),
  openFileInEditor: (data) => ipcRenderer.invoke('open-file-in-editor', data),

  // --- Settings Window ---
  openSettingsWindow: () => ipcRenderer.send('open-settings-window'),
  closeSettingsWindow: () => ipcRenderer.send('close-settings-window'),
  getEditorPaths: () => ipcRenderer.invoke('get-editor-paths'),
  selectEditorPath: () => ipcRenderer.invoke('select-editor-path'),
  setEditorPath: (data) => ipcRenderer.invoke('set-editor-path', data),

  // Add this with your other API definitions
  onStatusUpdate: (callback) => ipcRenderer.on('status-update', (_event, message) => callback(message)),

  // ... inside the api object

  // --- Create Project Window ---
  createProject: (repoName) => ipcRenderer.send('open-create-project-window', repoName),
  onProjectDataForCreateProject: (callback) => ipcRenderer.on('project-data-for-create-project', (_event, data) => callback(data)),
  submitProjectCreation: (data) => ipcRenderer.send('submit-project-creation', data),
  cancelProjectCreation: () => ipcRenderer.send('cancel-project-creation'),

  // --- Edit Project Window ---
  onProjectDataForEdit: (callback) => ipcRenderer.on('project-data-for-edit', (_event, data) => callback(data)),
  submitProjectUpdate: (data) => ipcRenderer.invoke('submit-project-update', data),
  cancelProjectUpdate: () => ipcRenderer.send('cancel-project-update'),
  
  // --- Chapter Screen ---
  onProjectDataForChapterScreen: (callback) => ipcRenderer.on('project-data-for-chapter-screen', (_event, data) => callback(data)),
  getChapters: (repoName, projectName) => ipcRenderer.send('get-chapters', { repoName, projectName }),
  onChaptersLoaded: (callback) => {
  const listener = (_event: unknown, chapters: { name: string }[]) => callback(chapters);
  ipcRenderer.on('chapters-loaded', listener);
  // Return a function that can be called to remove this specific listener
  return () => ipcRenderer.removeListener('chapters-loaded', listener);
},
  onShowChapterSelection: (callback) => ipcRenderer.on('show-chapter-selection-for-project', (_event, data) => callback(data)),
  openCreateChapterWindow: (repoName, projectName) => ipcRenderer.send('open-create-chapter-window', { repoName, projectName }),
  goBackToProjects: (repoName, projectName) => ipcRenderer.send('go-back-to-projects', { repoName, projectName }),

  // --- Create Chapter Window ---
  onProjectDataForCreateChapter: (callback) => ipcRenderer.on('project-data-for-create-chapter', (_event, data) => callback(data)),
  submitChapterCreation: (data) => ipcRenderer.invoke('submit-chapter-creation', data),
  cancelChapterCreation: () => ipcRenderer.send('cancel-chapter-creation'),

  // --- Repo Management & Git ---
  loadProjects: (repoName) => ipcRenderer.send('load-projects', repoName),
  getRepositories: () => ipcRenderer.invoke('get-repositories'),
  setSelectedRepository: (repoName) => ipcRenderer.send('set-selected-repository', repoName),
  addRepository: (repoUrl) => ipcRenderer.invoke('add-repository', repoUrl),
  getPatStatus: () => ipcRenderer.invoke('get-pat-status'),
  setPat: (token) => ipcRenderer.invoke('set-pat', token),
  removePat: () => ipcRenderer.invoke('remove-pat'),
  gitStatus: (repoName) => ipcRenderer.invoke('git-status', { repoName }),
  gitCommit: (repoName, message) => ipcRenderer.invoke('git-commit', { repoName, message }),
  gitPush: (repoName) => ipcRenderer.invoke('git-push', { repoName }),
  gitPull: (repoName) => ipcRenderer.invoke('git-pull', repoName),
  gitSyncRepository: (repoName) => ipcRenderer.invoke('git-sync-repository', repoName),

  // --- Universal APIs (Used by multiple windows) ---
  selectCoverImage: () => ipcRenderer.send('select-cover-image'),
  onCoverImageSelected: (callback) => ipcRenderer.on('cover-image-selected', (_event, path) => callback(path)),

  openChapterFolder: (chapterPath) => ipcRenderer.send('open-chapter-folder', chapterPath),
  healChapterFolders: (chapterPath) => ipcRenderer.invoke('heal-chapter-folders', chapterPath), // Add this line
  getChapterPageStatus: (chapterPath) => ipcRenderer.invoke('get-chapter-page-status', chapterPath),
});
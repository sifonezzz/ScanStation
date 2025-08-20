import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // --- Main Window ---
  onProjectsLoaded: (callback) => ipcRenderer.on('projects-loaded', (_event, projects) => callback(projects)),
  openProject: (repoName, projectName) => ipcRenderer.send('open-project', { repoName, projectName }),
  deleteProject: (repoName, projectName) => ipcRenderer.invoke('delete-project', { repoName, projectName }),
  openEditProjectWindow: (repoName, projectName) => ipcRenderer.send('open-edit-project-window', { repoName, projectName }),

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
  onChaptersLoaded: (callback) => ipcRenderer.on('chapters-loaded', (_event, chapters) => callback(chapters)),
  openCreateChapterWindow: (repoName, projectName) => ipcRenderer.send('open-create-chapter-window', { repoName, projectName }),
  goBackToProjects: () => ipcRenderer.send('go-back-to-projects'),

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
  gitSyncRepository: (repoName) => ipcRenderer.invoke('git-sync-repository', repoName),

  // --- Universal APIs (Used by multiple windows) ---
  selectCoverImage: () => ipcRenderer.send('select-cover-image'),
  onCoverImageSelected: (callback) => ipcRenderer.on('cover-image-selected', (_event, path) => callback(path)),
});
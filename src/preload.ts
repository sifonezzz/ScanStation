import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // --- For Main Window ---
  createProject: () => ipcRenderer.send('open-create-project-window'),
  onProjectsLoaded: (callback) => ipcRenderer.on('projects-loaded', (_event, projects) => callback(projects)),
  openProject: (projectName) => ipcRenderer.send('open-project', projectName),
  deleteProject: (projectName) => ipcRenderer.invoke('delete-project', projectName),
  deleteProject: (projectName) => ipcRenderer.invoke('delete-project', projectName),

  // --- For Create Project Window ---
  selectCoverImage: () => ipcRenderer.send('select-cover-image'),
  onCoverImageSelected: (callback) => ipcRenderer.on('cover-image-selected', (_event, path) => callback(path)),
  submitProjectCreation: (name, path) => ipcRenderer.send('submit-project-creation', { name, path }),
  cancelProjectCreation: () => ipcRenderer.send('cancel-project-creation'),

  // --- For Edit Project Window ---
  openEditProjectWindow: (projectName) => ipcRenderer.send('open-edit-project-window', projectName),
  onProjectDataForEdit: (callback) => ipcRenderer.on('project-data-for-edit', (_event, data) => callback(data)),
  submitProjectUpdate: (data) => ipcRenderer.invoke('submit-project-update', data),
  cancelProjectUpdate: () => ipcRenderer.send('cancel-project-update'),

  // --- For Chapter Screen ---
  onProjectDataForChapterScreen: (callback) => ipcRenderer.on('project-data-for-chapter-screen', (_event, name) => callback(name)),
  getChapters: (projectName) => ipcRenderer.send('get-chapters', projectName),
  onChaptersLoaded: (callback) => ipcRenderer.on('chapters-loaded', (_event, chapters) => callback(chapters)),
  openCreateChapterWindow: (projectName) => ipcRenderer.send('open-create-chapter-window', projectName),
  goBackToProjects: () => ipcRenderer.send('go-back-to-projects'),

  // --- For Create Chapter Window ---
  onProjectDataForCreateChapter: (callback) => ipcRenderer.on('project-data-for-create-chapter', (_event, name) => callback(name)),
  submitChapterCreation: (data) => ipcRenderer.invoke('submit-chapter-creation', data),
  cancelChapterCreation: () => ipcRenderer.send('cancel-chapter-creation'),

  // --- For Edit Project Window ---
  openEditProjectWindow: (projectName) => ipcRenderer.send('open-edit-project-window', projectName),
  onProjectDataForEdit: (callback) => ipcRenderer.on('project-data-for-edit', (_event, data) => callback(data)),
  submitProjectUpdate: (data) => ipcRenderer.invoke('submit-project-update', data),
  cancelProjectUpdate: () => ipcRenderer.send('cancel-project-update'),

  // --- For Chapter Screen ---
  onProjectDataForChapterScreen: (callback) => ipcRenderer.on('project-data-for-chapter-screen', (_event, name) => callback(name)),
  getChapters: (projectName) => ipcRenderer.send('get-chapters', projectName),
  onChaptersLoaded: (callback) => ipcRenderer.on('chapters-loaded', (_event, chapters) => callback(chapters)),
  openCreateChapterWindow: (projectName) => ipcRenderer.send('open-create-chapter-window', projectName),
  goBackToProjects: () => ipcRenderer.send('go-back-to-projects'),

  // --- For Create Chapter Window ---
  onProjectDataForCreateChapter: (callback) => ipcRenderer.on('project-data-for-create-chapter', (_event, name) => callback(name)),
  submitChapterCreation: (data) => ipcRenderer.invoke('submit-chapter-creation', data),
  cancelChapterCreation: () => ipcRenderer.send('cancel-chapter-creation'),
});
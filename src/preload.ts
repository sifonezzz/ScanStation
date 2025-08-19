import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // --- For Main Window ---
  createProject: () => ipcRenderer.send('open-create-project-window'),
  onProjectsLoaded: (callback) => ipcRenderer.on('projects-loaded', (_event, projects) => callback(projects)),
  openProject: (projectName) => ipcRenderer.send('open-project', projectName),

  // --- For Create Project Window ---
  selectCoverImage: () => ipcRenderer.send('select-cover-image'),
  onCoverImageSelected: (callback) => ipcRenderer.on('cover-image-selected', (_event, path) => callback(path)),
  submitProjectCreation: (name, path) => ipcRenderer.send('submit-project-creation', { name, path }),
  cancelProjectCreation: () => ipcRenderer.send('cancel-project-creation'),
});
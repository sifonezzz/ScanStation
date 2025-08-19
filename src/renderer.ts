declare global {
  interface Window {
    api: {
      createProject: () => void;
      onProjectsLoaded: (callback: (projects: Project[]) => void) => void;
      openProject: (projectName: string) => void;
      deleteProject: (projectName: string) => Promise<void>;
      openEditProjectWindow: (projectName: string) => void;
    };
  }
  interface Project {
    name: string;
    coverPath: string;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const createProjectBtn = document.getElementById('create-project-btn');
  const editBtn = document.getElementById('edit-btn');
  const projectGrid = document.getElementById('project-grid');
  let isEditMode = false;

  createProjectBtn.addEventListener('click', () => {
    window.api.createProject();
  });

  editBtn.addEventListener('click', () => {
    isEditMode = !isEditMode;
    if (isEditMode) {
      editBtn.textContent = 'Done';
      editBtn.style.backgroundColor = '#7289da';
      projectGrid.classList.add('edit-mode');
    } else {
      editBtn.textContent = 'Edit';
      editBtn.style.backgroundColor = '';
      projectGrid.classList.remove('edit-mode');
    }
  });

  window.api.onProjectsLoaded((projects) => {
    console.log('Received projects:', projects);
    projectGrid.innerHTML = '';

    if (projects.length === 0) {
      projectGrid.innerHTML = `<p style="color: #99aab5; text-align: center;">No projects found. Click '+ New Project' to get started!</p>`;
      return;
    }

    for (const project of projects) {
      const card = document.createElement('div');
      card.className = 'project-card';
      
      const formattedPath = project.coverPath.replace(/\\/g, '/');
      const imageUrl = `scanstation-asset://local/${formattedPath}`;
      card.style.backgroundImage = `url('${imageUrl}')`;

      const title = document.createElement('div');
      title.className = 'project-title';
      title.textContent = project.name;
      
      const overlay = document.createElement('div');
      overlay.className = 'project-card-overlay';

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'project-action-btn delete-btn';
      deleteBtn.textContent = '-';
      // CORRECTED: This now calls the backend delete function
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await window.api.deleteProject(project.name);
      });

      const editProjectBtn = document.createElement('button');
      editProjectBtn.className = 'project-action-btn edit-project-btn';
      editProjectBtn.textContent = 'Edit';
      // CORRECTED: This now calls the backend to open the edit window
      editProjectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.api.openEditProjectWindow(project.name);
      });

      overlay.appendChild(deleteBtn);
      overlay.appendChild(editProjectBtn);
      card.appendChild(title);
      card.appendChild(overlay);

      card.addEventListener('click', () => {
        // Clicks should only open the project if not in edit mode
        if (!isEditMode) {
          window.api.openProject(project.name);
        }
      });

      projectGrid.appendChild(card);
    }
  });
});

export {};
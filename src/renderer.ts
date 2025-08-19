declare global {
  interface Window {
    api: {
      createProject: () => void;
      onProjectsLoaded: (callback: (projects: Project[]) => void) => void;
      openProject: (projectName: string) => void;
    };
  }
  // Define the shape of a project object
  interface Project {
    name: string;
    coverPath: string;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const createProjectBtn = document.getElementById('create-project-btn');
  const projectGrid = document.getElementById('project-grid');

  createProjectBtn.addEventListener('click', () => {
    window.api.createProject();
  });

  // Listen for the main process to send the list of projects
  window.api.onProjectsLoaded((projects) => {
    console.log('Received projects:', projects);
    projectGrid.innerHTML = ''; // Clear existing projects

    if (projects.length === 0) {
      // Optional: Display a message if there are no projects
      projectGrid.innerHTML = `<p style="color: #99aab5; text-align: center;">No projects found. Click '+ New Project' to get started!</p>`;
      return;
    }

    for (const project of projects) {
      const card = document.createElement('div');
      card.className = 'project-card';

      // Format the path for use in a CSS url()
      const imageUrl = `file://${project.coverPath.replace(/\\/g, '/')}`;
      card.style.backgroundImage = `url('${imageUrl}')`;

      const title = document.createElement('div');
      title.className = 'project-title';
      title.textContent = project.name;

      card.appendChild(title);

      card.addEventListener('click', () => {
        window.api.openProject(project.name);
      });

      projectGrid.appendChild(card);
    }
  });
});

export {};
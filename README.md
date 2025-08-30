# Scanstation

A collaboration tool for solo and group scanlation projects.
*This application was built with the extensive support of Gemini.*

## Features
- **Project-Based Workflow**: Organize your work into projects, each with its own chapters and cover image.
- **Git-Powered Backend**: Use private or public GitHub repositories to store and sync your project files, enabling easy collaboration.
- **Multi-Step Page Tracking**: A visual sidebar tracks the status of each page through the entire workflow: Cleaning (CL), Translation (TL), Typesetting (TS), and Proofreading (PR/QC).
- **Chapter Progress Dashboard**: Get an at-a-glance overview of a chapter's completion status with clear progress bars.
- **Dedicated Workflow Views**:
    - **Translation View**: A side-by-side view of the raw page and a text editor, with a drawing canvas for annotating speech bubbles.
    - **Proofread View**: Compare the raw and typeset images directly, with a dedicated text box for corrections and annotations.
    - **Typesetting Helper**: Provides the typesetter with the cleaned page and the final translated text, along with buttons to quickly open the image in an external editor.
- **Configuration Page**: A dedicated settings screen to manage your repositories, set your GitHub Personal Access Token (PAT), and configure paths to external editors.

---
## Usage

The first time you open the app a green box will appear, wait a few seconds for the app to finish installing, do not use the app during this period.

### Step 1: Initial Setup
The first time you launch Scanstation, you will be prompted to select a folder on your computer where all your project data will be stored. After that, the first thing you should do is configure your settings.
1.  Click the **Settings** button on the main screen.
2.  Under **Token Management**, click **Set Token**. You will need to provide a [GitHub Personal Access Token (PAT)](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) with `repo` permissions. This is required for the app to access private repositories and push your changes.
3.  Under **External Editor Paths**, click "Browse..." to link the executable files for programs like Photoshop, GIMP, etc. This enables the "Open in..." buttons in the Typeset view.

### Step 2: Add a Repository
All your projects live inside a Git repository.
1.  Go to the **Settings** page.
2.  Click **+ Add Repository**.
3.  Paste the **HTTPS clone URL** of a GitHub repository you have access to (e.g., `https://github.com/your-username/your-repo.git`). It is recommended to use a fresh, empty repository.
4.  The app will clone the repository into your projects folder. You can then select it from the dropdown on the main screen.

### Step 3: Add Collaborators
To work with a team, you must add them as collaborators on GitHub itself. The app will then handle syncing their changes.
1.  Navigate to your repository's page on **GitHub.com**.
2.  Go to the repository's **Settings** tab.
3.  In the sidebar, click on **Collaborators and teams**.
4.  Click the **Add people** button and invite your team members using their GitHub username or email. They will need **Write** access to be able to push their work.

### Step 4: Create a Project and Chapters
1.  On the main screen, make sure your desired repository is selected in the dropdown, then click **+ New Project**. Give it a name and a cover image.
2.  Click on your new project. This will take you to the chapter list screen.
3.  Click **+ New Chapter**. The app will create the standard folder structure (`Raws`, `Raws Cleaned`, etc.) inside your project folder.
4.  To begin working, place your raw image files into the `Raws` folder.

### Step 5: The Scanlation Workflow
Once you click on a chapter, you enter the workspace.
- The **sidebar** on the right shows the status of every page. The `CL` and `TS` statuses update automatically when you place the corresponding files in the `Raws Cleaned` and `Typesetted` folders.
- Use the **Translate**, **Proofread**, and **Typeset** buttons at the top to enter the different workflow modes.
- Your work in the Translate and Proofread views is **saved automatically** when you navigate between pages or switch views.
- Once a page is finished, use the **"Page is Correct"** button in the Proofread view to copy the typeset file to the `Final` folder, ready for release.

---
## Disclaimer
This app is in its first stage, and it is heavily recommended that you keep track of all your files before working with it. The app automatically creates a backup of all repositories in a `backup` folder located next to your main projects folder (e.g., `.../Scanstation/backup`).

## Kofi
If you wish to donate I would be extremely grateful :D
https://ko-fi.com/sifonezz

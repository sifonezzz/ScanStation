# ScanStation
![SS](assets/pictures/SS.png)
A collaboration tool for solo and group scanlation projects.

*This application was built with the extensive support of Gemini.*

## Features


- **Project-Based Workflow**: Organize your work into projects, each with its own chapters and cover image.

![ScanStation Main View](assets/pictures/Main%20View.png)


- **Git-Powered Backend**: ScanStation uses GitHub repositories to store and sync your project files allowing for easy collaboration between group members.
- **Multi-Step Page Tracking**: A sidebar tracks the status of each page through the entire scanlation workflow: Cleaning (CL), Translation (TL), Typesetting (TS), and Proofreading (PR/QC).
- **Chapter Progress Dashboard**: Get an overview of a chapter's completion status with clear progress bars for each step of the process.
- **Dedicated Workflow Views**:
    - **Translation View**: A side-by-side view of the raw page and a text editor, with the function to draw on the raw to ennumerate speech bubbles.
    - **Proofread View**: Compare the raw and typeset images directly on a side-by-side view, with a dedicated text box for corrections and annotations. Pages with annotations get circled on the status bar.
    - **Typesetting Helper**: Provides the typesetter with the cleaned page and the final translated text, along with buttons to quickly open the image in an external editor.

---

## Requirements

Since ScanStation works directly with github backend, it needs git installed to work, and you also need to set your git identity. If you already have git installed on your computer, then you can skip this.

You will first need to install Chocolatey package manager:

1.  Open **PowerShell as administrator**.
2.  Copy and run the following command:

    ```powershell
    Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('[https://community.chocolatey.org/install.ps1](https://community.chocolatey.org/install.ps1)'))
    ```

### 2. Install Git

1.  After Chocolatey is installed, close and reopen **PowerShell as administrator**.
2.  Run the following command to install Git:

    ```powershell
    choco install git -y
    ```

### 3. Setting Your Git Identity

1.  Open your Powershell or the Command Prompt.

2.  Run the following two commands, **replacing the placeholder text** with your own GitHub username and the email address associated with your GitHub account.

    ```bash
    git config --global user.name "YourGitHubUsername"
    git config --global user.email "your_email@example.com"
    ```

    *The `--global` flag will save this information for every Git repository on your computer.*

### How to Verify

To check that your information was saved correctly, run the following command:

```git config --list```

After this is done, ScanStation will work properly.

---

## Setup



On your first launch ScanStation will ask you to choose a folder or leave the default one, choose and then
wait for the green window to dissappear to complete installation.

### Connecting to GitHub



Every collaborator must connect the app to their GitHub account using a Personal Access Token (PAT). While you can use your main GitHub account, I recommend creating a separate account dedicated to scanlations.

### Creating the Personal Access Token



1.  On the GitHub website, click your **profile picture** in the top-right corner, then select **Settings**.
2.  In the left sidebar, scroll down and click **Developer settings**.
3.  Click **Personal access tokens**, then select **Tokens (classic)**.
4.  Click **Generate new token**, and choose **Generate new token (classic)**.
5.  In the **title** field, give your token a descriptive name (e.g., "Scanstation Group").
6.  For **Expiration**, select your preferred timeframe.
7.  Check the box **repo**. This is the only permission required, as this will enable all collaborators to modify the projects repository.
8.  Scroll to the bottom and click **Generate token**.

### Adding the Token to Scanstation



1.  **Copy the newly generated token**. Be sure to save it somewhere safe, as you won't be able to see it again. In the case you lose the token, you will have to regenerate it.
2.  Open **Scanstation** and go to the **Settings** screen.
3.  Click **Set Token**, paste your token into the input field, and press **Save**.
4.  Scroll down and click **Done** to close the settings window.

---

## Setting Up the Repository
These steps explain how to create a shared GitHub repository and connect it to ScanStation.



### For the Repository Owner

1.  **Create the Repository**
    Go to GitHub and create a new repository with any name you choose. It's recommended to make it **private**.

2.  **Make an Initial Commit**
    The repository you just created cannot be used until it has at least one commit. From your new repository's main page, click **create a new file (displayed as creating a new file)**. A `README.md` file is a good choice for this. Add any text you like and commit the new file.

3.  **Invite Collaborators**
    Navigate to your repository's **Settings** tab. In the sidebar, click **Collaborators**. Click **Add people** and invite your team members using their GitHub usernames.  You can also add collaborators directly from the quick setup page.


### For Collaborators



* **Accept the Invitation**: You will receive an invitation via email and in your GitHub notifications. Click the link in the invitation to accept. You can see the invitation on your notifications tab from Github.


### For Everyone (Owner & Collaborators)



1.  **Copy the Repository URL**
    Navigate to the main page of the repository on GitHub. Click the green **<> Code** button and copy the **HTTPS** URL. It will look like this: `https://github.com/YourUsername/YourRepo.git`.

2.  **Add the Repository to Scanstation**
    Open Scanstation and go to **Settings**. Click **+ Add Repository**, paste the HTTPS link you copied, and click **Pull Files**.

You can now create projects in the repository. Remember that GitHub doesn't track empty folders, so you must add a file (like an image) to a new chapter folder before you can commit and push it. This problem is just for chapters, when you create projects, these projects will have the cover image, so github will be able to track them correctly.

* **Desktop Shortcut**: If you wish to create a desktop shortcut, a utility for this is available at the bottom of the **Settings** screen.

---

## Usage


---
## Disclaimer
This app is in its first stage, and it is heavily recommended that you keep track of all your files before working with it. The app automatically creates a backup of all repositories in a `backup` folder located next to your main projects folder (e.g., `.../Scanstation/backup`).

## Kofi
If you wish to donate I would be extremely grateful :D
https://ko-fi.com/sifonezz
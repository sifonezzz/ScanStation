
import type { IScanstationAPI, Editor } from './types';

declare const api: IScanstationAPI;

let currentRepoName: string | null = null;
let currentProjectName: string | null = null;

window.addEventListener('DOMContentLoaded', () => {
    const numberInput = document.getElementById('chapter-number') as HTMLInputElement;
    const nameInput = document.getElementById('chapter-name') as HTMLInputElement;
    const finalFolderCheckbox = document.getElementById('include-final-folder') as HTMLInputElement;
    const cancelBtn = document.getElementById('cancel-btn');
    const createBtn = document.getElementById('create-btn');

    // 1. Receive both repoName and projectName from the main process
    window.api.onProjectDataForCreateChapter((data) => {
        currentRepoName = data.repoName;
        currentProjectName = data.projectName;
    });

    // 2. Handle button clicks
    cancelBtn.addEventListener('click', () => {
        window.api.cancelChapterCreation();
    });

    createBtn.addEventListener('click', async () => {
        const chapterNumber = numberInput.value;
        const chapterName = nameInput.value.trim();

        if (!currentRepoName || !currentProjectName) {
            alert('Error: No project context found.');
            return;
        }
        if (!chapterNumber || !chapterName) {
            alert('Chapter number and name are required.');
            return;
        }

        const result = await window.api.submitChapterCreation({
            repoName: currentRepoName, // Include repoName in the submission
            projectName: currentProjectName,
            chapterNumber,
            chapterName,
        });
        // The main process will close the window on success
        if (!result.success) {
            // Error was already shown by the main process
        }
    });
});

export {};
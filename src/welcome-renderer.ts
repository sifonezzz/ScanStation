import type { IScanstationAPI } from './types';

window.addEventListener('DOMContentLoaded', () => {
    const downloadBtn = document.getElementById('download-git-btn');
    downloadBtn.addEventListener('click', () => {
        window.api.openExternalLink('https://git-scm.com/downloads');
    });
});
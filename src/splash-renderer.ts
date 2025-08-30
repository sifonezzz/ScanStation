
import type { IScanstationAPI, Editor } from './types';


window.addEventListener('DOMContentLoaded', () => {
  const statusMessage = document.getElementById('status-message');
  window.api.onStatusUpdate((message) => {
    statusMessage.textContent = message;
  });
});

export {};
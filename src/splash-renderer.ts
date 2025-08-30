import type { Editor } from './types';
import type { IScanstationAPI } from './types';

declare global {
  interface Window {
    api: IScanstationAPI;
  }
}
window.addEventListener('DOMContentLoaded', () => {
  const statusMessage = document.getElementById('status-message');
  window.api.onStatusUpdate((message) => {
    statusMessage.textContent = message;
  });
});

export {};
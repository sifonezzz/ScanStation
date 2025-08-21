declare global {
  interface Window {
    api: {
      onStatusUpdate: (callback: (message: string) => void) => void;
    };
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const statusMessage = document.getElementById('status-message');
  window.api.onStatusUpdate((message) => {
    statusMessage.textContent = message;
  });
});

export {};
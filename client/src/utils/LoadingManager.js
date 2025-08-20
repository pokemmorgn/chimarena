export const LoadingManager = {
  totalAssets: 0,
  loadedAssets: 0,
  
  updateProgress(loaded, total) {
    this.loadedAssets = loaded;
    this.totalAssets = total;
    
    const percentage = total > 0 ? Math.round((loaded / total) * 100) : 0;
    
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    
    if (progressBar) progressBar.style.width = percentage + '%';
    if (progressText) progressText.textContent = percentage + '%';
    
    if (percentage >= 100) {
      setTimeout(() => this.hideLoadingScreen(), 500);
    }
  },
  
  hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.classList.add('hidden');
      setTimeout(() => loadingScreen.style.display = 'none', 500);
    }
  }
};

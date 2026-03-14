const bgVideo1 = document.getElementById('bg-video');
const bgVideo2 = document.getElementById('bg-video-2');

if (bgVideo1 && bgVideo2) {
  const VIDEO_URL = 'anime-girl-4.mp4';
  let activeVideo = bgVideo1;
  let inactiveVideo = bgVideo2;
  let isTransitioning = false;
  let isInitialized = false;
  
  function initVideo() {
    if (!document.body.classList.contains('theme-18plus')) {
      activeVideo.pause();
      inactiveVideo.pause();
      activeVideo.style.opacity = '0';
      activeVideo.style.display = 'none';
      inactiveVideo.style.opacity = '0';
      inactiveVideo.style.display = 'none';
      isInitialized = false;
      return;
    }
    
    if (isInitialized) return;
    isInitialized = true;
    
    activeVideo.src = VIDEO_URL;
    inactiveVideo.src = VIDEO_URL;
    activeVideo.style.opacity = '0.8';
    activeVideo.style.display = 'block';
    inactiveVideo.style.opacity = '0';
    inactiveVideo.style.display = 'block';
    
    activeVideo.play().catch(e => console.log('Video:', e));
    activeVideo.addEventListener('timeupdate', handleTimeUpdate);
  }
  
  function handleTimeUpdate() {
    if (!document.body.classList.contains('theme-18plus')) return;
    if (isTransitioning) return;
    if (!this.duration) return;
    
    const timeLeft = this.duration - this.currentTime;
    if (timeLeft <= 1 && timeLeft > 0.3) {
      crossfade();
    }
  }
  
  function crossfade() {
    if (isTransitioning) return;
    isTransitioning = true;
    
    inactiveVideo.currentTime = 0;
    inactiveVideo.style.opacity = '0';
    inactiveVideo.play();
    
    setTimeout(() => {
      activeVideo.style.transition = 'opacity 1s ease';
      inactiveVideo.style.transition = 'opacity 1s ease';
      activeVideo.style.opacity = '0';
      inactiveVideo.style.opacity = '0.8';
      
      setTimeout(() => {
        activeVideo.pause();
        activeVideo.removeEventListener('timeupdate', handleTimeUpdate);
        
        const temp = activeVideo;
        activeVideo = inactiveVideo;
        inactiveVideo = temp;
        
        activeVideo.addEventListener('timeupdate', handleTimeUpdate);
        isTransitioning = false;
      }, 1000);
    }, 50);
  }
  
  document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        setTimeout(initVideo, 100);
      });
    }
  });
  
  setTimeout(initVideo, 500);
}
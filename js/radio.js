document.addEventListener('DOMContentLoaded', () => {
  const radioStream = document.getElementById('radio-stream');
  const playPauseBtn = document.getElementById('radio-play-pause-btn');
  const playIcon = playPauseBtn.querySelector('.play-icon');
  const pauseIcon = playPauseBtn.querySelector('.pause-icon');
  const volumeSlider = document.getElementById('radio-volume-slider');

  // Set initial volume
  if (radioStream && volumeSlider) {
    radioStream.volume = volumeSlider.value;
  }

  // Play/Pause functionality
  playPauseBtn?.addEventListener('click', () => {
    if (radioStream.paused) {
      radioStream.play();
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'inline';
    } else {
      radioStream.pause();
      playIcon.style.display = 'inline';
      pauseIcon.style.display = 'none';
    }
  });

  // Volume control
  volumeSlider?.addEventListener('input', (e) => {
    radioStream.volume = e.target.value;
  });

  // Keep icons in sync if the state changes for other reasons
  radioStream?.addEventListener('play', () => {
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'inline';
  });

  radioStream?.addEventListener('pause', () => {
    playIcon.style.display = 'inline';
    pauseIcon.style.display = 'none';
  });
});

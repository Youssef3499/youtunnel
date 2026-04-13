function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('yt-theme', theme);
  document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
  const map = { 'dark-green': 't1', 'dark': 't2', 'gray': 't3' };
  const btn = document.getElementById(map[theme]);
  if (btn) btn.classList.add('active');
}

// Apply saved theme on load
(function() {
  const saved = localStorage.getItem('yt-theme') || 'dark-green';
  setTheme(saved);
})();

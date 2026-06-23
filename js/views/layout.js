export class LayoutView {
  static render(content) {
    document.getElementById('mainContent').innerHTML = content;
  }

  static initNavigation() {
    const links = document.querySelectorAll('.nav-link[data-view]');
    links.forEach(link => {
      link.addEventListener('click', () => {
        const view = link.dataset.view;
        links.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        const sidebar = document.getElementById('sidebar');
        sidebar.classList.remove('open');

        window.dispatchEvent(new CustomEvent('navigate', { detail: { view } }));
      });
    });

    const hamburger = document.getElementById('hamburgerBtn');
    hamburger.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });

    const themeToggle = document.getElementById('themeToggle');
    themeToggle.addEventListener('click', () => {
      const html = document.documentElement;
      const current = html.getAttribute('data-theme');
      const next = current === 'light' ? 'dark' : 'light';
      html.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
    });

    const saved = localStorage.getItem('theme');
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
    }

    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) {
        const modalId = e.target.closest('[data-close]').dataset.close;
        const modal = document.getElementById(modalId);
        if (modal) modal.remove();
      }
    });
  }
}

/* BCC Technologies - Shared nav toggle */
(() => {
  function setupNav(){
    const toggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('header nav');
    const list = document.getElementById('primary-nav');

    if (!toggle || !nav) return;
    if (nav.dataset.navBound === 'true') return;
    nav.dataset.navBound = 'true';

    const close = () => {
      nav.classList.remove('active');
      toggle.setAttribute('aria-expanded', 'false');
    };

    const open = () => {
      nav.classList.add('active');
      toggle.setAttribute('aria-expanded', 'true');
    };

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = nav.classList.contains('active');
      isOpen ? close() : open();
    });

    document.addEventListener('click', (e) => {
      if (!nav.classList.contains('active')) return;
      const clickedInside = nav.contains(e.target) || toggle.contains(e.target);
      if (!clickedInside) close();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });

    if (list) {
      list.addEventListener('click', (e) => {
        const a = e.target.closest('a');
        if (a) close();
      });
    }
  }

  function markCurrentPage(){
    const nav = document.querySelector('header nav');
    if (!nav) return;

    const current = (location.pathname.split('/').pop() || '').toLowerCase();
    if (!current || current === 'index.html') return;

    const aliases = {
      'product_maps.html': 'products.html',
      'product_maps_nano.html': 'products.html',
      'map.html': 'products.html',
      'blog_content.html': 'blog.html',
      'blog_original.html': 'blog.html',
      'post_detail.html': 'blog.html',
      'profile_saul.html': 'aboutus.html',
      'profile_jesus.html': 'aboutus.html',
      'profile_enrique.html': 'aboutus.html',
      'profile_enmanuel.html': 'aboutus.html',
      'cotizacion.html': 'services.html',
      'index2.html': 'index.html',
      'index_original.html': 'index.html'
    };

    const targetPage = aliases[current] || current;
    if (targetPage === 'index.html') return;

    const links = Array.from(nav.querySelectorAll('a'));
    links.forEach((a) => {
      const hrefPath = new URL(a.getAttribute('href') || '', location.href).pathname;
      const target = (hrefPath.split('/').pop() || '').toLowerCase();
      if (target && target === targetPage) {
        a.classList.add('is-current');
        a.setAttribute('aria-current', 'page');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupNav();
    markCurrentPage();
  });
})();

/*
  Home behavior
  - Mobile nav toggle
  - Shopify featured items
*/

(function () {
  function qs(sel, root = document) { return root.querySelector(sel); }

  function setupNav() {
    const menuToggle = qs('.menu-toggle');
    const nav = qs('nav');
    if (!menuToggle || !nav) return;

    const toggle = () => nav.classList.toggle('active');

    menuToggle.addEventListener('click', toggle);
    menuToggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });

    // Close on outside click (mobile)
    document.addEventListener('click', (e) => {
      if (!nav.classList.contains('active')) return;
      const clickedInside = nav.contains(e.target) || menuToggle.contains(e.target);
      if (!clickedInside) nav.classList.remove('active');
    });

    // Close on ESC
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') nav.classList.remove('active');
    });
  }

  function stripHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return (div.textContent || div.innerText || '').trim();
  }

  function truncate(text, n) {
    if (!text) return '';
    const t = text.replace(/\s+/g, ' ').trim();
    return t.length > n ? t.slice(0, n - 1) + '…' : t;
  }

  async function loadFeaturedProducts() {
    const grid = qs('#featured-grid');
    if (!grid) return;
    if (typeof ShopifyBuy === 'undefined') return; // SDK not loaded

    const client = ShopifyBuy.buildClient({
      domain: '2e2e5e-7c.myshopify.com',
      storefrontAccessToken: 'a791b0c74fab70851230df08048bc7dc'
    });

    try {
      const products = await client.product.fetchAll();
      const featured = (products || []).slice(0, 3);
      if (!featured.length) return;

      grid.innerHTML = featured.map((p) => {
        const img = p.images?.[0]?.src;
        const title = p.title || 'Producto';
        const desc = truncate(p.description || stripHtml(p.descriptionHtml || ''), 120);

        return `
          <article class="card">
            ${img ? `<img class="card-media" src="${img}" alt="${title}" loading="lazy">` : ``}
            <div class="card-body">
              <h4 class="card-title">${title}</h4>
              <p class="card-text">${desc}</p>
              <a class="card-link" href="./products">Ver →</a>
            </div>
          </article>
        `;
      }).join('');

    } catch (err) {
      console.error('Shopify (featured) error:', err);
      // keep fallback content
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupNav();
    loadFeaturedProducts();
  });
})();

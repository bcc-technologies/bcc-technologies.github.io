/* BCC Technologies — Home interactions */

(() => {
  // 1) Mobile Navigation
  function setupNav(){
    const toggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('header nav');
    const list = document.getElementById('primary-nav');

    if(!toggle || !nav || !list) return;

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

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      const isOpen = nav.classList.contains('active');
      if(!isOpen) return;

      const clickedInside = nav.contains(e.target) || toggle.contains(e.target);
      if(!clickedInside) close();
    });

    // Close on ESC
    document.addEventListener('keydown', (e) => {
      if(e.key === 'Escape') close();
    });

    // Close when clicking a link
    list.addEventListener('click', (e) => {
      const a = e.target.closest('a');
      if(a) close();
    });
  }

  // 2) Reveal Animation (Focus effect)
  function setupReveal(){
    const els = document.querySelectorAll('.reveal');
    if(!els.length) return;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries){
        if(entry.isIntersecting){
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -50px 0px' });

    els.forEach(el => observer.observe(el));
  }

  // 3) Shopify Integration (optional)
  // If ShopifyBuy SDK fails or token is invalid, the fallback HTML stays.
  async function loadFeaturedProducts(){
    const grid = document.getElementById('featured-grid');
    if(!grid || typeof window.ShopifyBuy === 'undefined') return;

    try {
      const client = window.ShopifyBuy.buildClient({
        domain: '2e2e5e-7c.myshopify.com',
        storefrontAccessToken: 'b56c00970b6f4210ceedcb67a43b0a83'
      });

      const products = await client.product.fetchAll();
      const top = (products || []).slice(0, 3);
      if(!top.length) return;

      grid.innerHTML = '';

      top.forEach(p => {
        const title = p?.title || 'Producto';
        const desc = (p?.description || '').trim().replace(/\s+/g,' ').slice(0, 90);
        const price = p?.variants?.[0]?.price?.amount ? String(p.variants[0].price.amount) : '';

        const card = document.createElement('article');
        card.className = 'glass-panel product-card reveal';
        card.innerHTML = `
          <div class="p-header">HARDWARE / SOFTWARE</div>
          <h4>${escapeHtml(title)}</h4>
          <p>${escapeHtml(desc)}${desc.length >= 90 ? '…' : ''}</p>
          <div class="p-footer" style="margin-top:auto; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-family:monospace; color:var(--accent);">${price ? '$' + price.split('.')[0] : ''}</span>
            <a href="./products">Especificaciones &rarr;</a>
          </div>
        `;
        grid.appendChild(card);
      });

      // Observe new reveal cards
      const newEls = grid.querySelectorAll('.reveal');
      newEls.forEach(el => el.classList.add('is-in'));
    } catch (e) {
      // Keep fallback HTML
      console.warn('Shopify featured products: fallback used.', e);
    }
  }

  // Tiny HTML escaper to prevent accidental markup injection
  function escapeHtml(str){
    return String(str)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupNav();
    setupReveal();
    loadFeaturedProducts();
  });
})();

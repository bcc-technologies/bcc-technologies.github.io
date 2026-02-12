/* BCC — Index interactions (minimal + robust)
   - Mobile nav toggle (layout.css)
   - Featured products (Shopify Buy SDK)
   - Micro reveal animation
*/

(() => {
  function stripHtml(html){
    const tmp = document.createElement('div');
    tmp.innerHTML = html || '';
    return (tmp.textContent || tmp.innerText || '').replace(/\s+/g,' ').trim();
  }

  let revealObserver = null;
  function setupReveal(){
    const els = Array.from(document.querySelectorAll('.reveal'));
    if(!els.length) return;

    // Respect reduced motion
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(reduce){
      els.forEach(el => el.classList.add('is-in'));
      return;
    }

    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if(entry.isIntersecting){
          entry.target.classList.add('is-in');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { root: null, rootMargin: '0px 0px -10% 0px', threshold: 0.12 });

    els.forEach(el => revealObserver.observe(el));
  }

  function observeNewReveals(root){
    if(!revealObserver) return;
    const els = Array.from((root || document).querySelectorAll('.reveal:not(.is-in)'));
    els.forEach(el => revealObserver.observe(el));
  }

  async function loadFeaturedProducts(){
    const grid = document.getElementById('featured-grid');
    if(!grid) return;

    // If SDK isn't available, keep fallback.
    if(typeof window.ShopifyBuy === 'undefined' || !window.ShopifyBuy.buildClient) return;

    try{
      const client = window.ShopifyBuy.buildClient({
        domain: '2e2e5e-7c.myshopify.com',
        storefrontAccessToken: 'b56c00970b6f4210ceedcb67a43b0a83'
      });

      const products = await client.product.fetchAll();
      const top = (products || []).slice(0, 3);
      if(!top.length) return;

      const cards = top.map(p => {
        const img = p.images && p.images[0] ? p.images[0].src : '';
        const price = (p.variants && p.variants[0] && p.variants[0].price) ? p.variants[0].price : '';
        const desc = stripHtml(p.descriptionHtml || p.description || '').slice(0, 120);

        return `
          <article class="card reveal">
            <div class="card-bar" aria-hidden="true"></div>
            <div class="card-media">${img ? `<img src="${img}" alt="${(p.title || '').replace(/"/g,'&quot;')}" loading="lazy">` : ''}</div>
            <div class="card-body">
              <h4 class="card-title">${p.title || 'Producto'}</h4>
              <p class="card-text">${desc || 'Producto disponible en nuestro catálogo.'}</p>
              <a class="card-link" href="./products">Ver ${price ? `· ${price}` : '→'}</a>
            </div>
          </article>
        `;
      }).join('');

      grid.innerHTML = cards;
      observeNewReveals(grid);

    }catch(err){
      // Keep fallback if anything fails.
      console.warn('Featured products load failed:', err);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupReveal();
    loadFeaturedProducts();
  });
})();

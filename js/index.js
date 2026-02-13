/* BCC Technologies — Home interactions (NO Shopify) */

(() => {
  const isEn = (document.documentElement.lang || '').toLowerCase().startsWith('en');
  const BLOG_PAGE = isEn ? '/en/blog.html' : '/blog.html';
  const CONTENT_INDEX_URL = '/content/content-index.json';
  const i18n = isEn ? {
    loading: 'Loading entries...',
    noEntries: 'No entries yet.',
    viewJournal: 'View Journal',
    months: ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'],
    journalTag: 'Journal'
  } : {
    loading: 'Cargando entradas...',
    noEntries: 'Aun no hay entradas.',
    viewJournal: 'Ver Journal',
    months: ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'],
    journalTag: 'Journal'
  };

  // 1) Reveal Animation
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

  // 2) Journal preview (reads real posts from ./content/content-index.json)
  async function loadJournalPreview(){
    const host = document.getElementById('journal-index');
    if(!host) return;

    host.innerHTML = `
      <article class="journal-row">
        <div class="journal-date">...</div>
        <div class="journal-content">
          <span class="journal-tag">${i18n.journalTag}</span>
          <h3 class="journal-title"><a href="${BLOG_PAGE}">${i18n.loading}</a></h3>
        </div>
        <div class="journal-action">&nearr;</div>
      </article>
    `;

    try {
      const res = await fetch(CONTENT_INDEX_URL, { cache: 'no-store' });
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const posts = Array.isArray(data?.posts) ? data.posts : [];
      if(!posts.length){
        host.innerHTML = `
          <article class="journal-row">
            <div class="journal-date">—</div>
            <div class="journal-content">
              <span class="journal-tag">${i18n.journalTag}</span>
              <h3 class="journal-title"><a href="${BLOG_PAGE}">${i18n.noEntries}</a></h3>
            </div>
            <div class="journal-action">&nearr;</div>
          </article>
        `;
        return;
      }

      // Sort by date desc
      const sorted = [...posts].sort((a,b) => {
        const da = Date.parse(a?.date || a?.publishedAt || '') || 0;
        const db = Date.parse(b?.date || b?.publishedAt || '') || 0;
        return db - da;
      });

      const top = sorted.slice(0, 3);

      host.innerHTML = top.map(p => {
        const id = getPostId(p);
        const title = p?.title || 'Entrada';
        const tag = getPostTag(p);
        const dateStr = formatCompactDate(p?.date || p?.publishedAt);

        // Deep link a una entrada específica:
        const href = id ? `${BLOG_PAGE}#post=${encodeURIComponent(id)}` : BLOG_PAGE;

        return `
          <article class="journal-row">
            <div class="journal-date">${escapeHtml(dateStr || '—')}</div>
            <div class="journal-content">
              <span class="journal-tag">${escapeHtml(tag)}</span>
              <h3 class="journal-title"><a href="${href}">${escapeHtml(title)}</a></h3>
            </div>
            <div class="journal-action">&nearr;</div>
          </article>
        `;
      }).join('');

    } catch (e) {
      console.warn('Journal preview: fallback used.', e);
      host.innerHTML = `
        <article class="journal-row">
          <div class="journal-date">—</div>
          <div class="journal-content">
            <span class="journal-tag">${i18n.journalTag}</span>
            <h3 class="journal-title"><a href="${BLOG_PAGE}">${i18n.viewJournal}</a></h3>
          </div>
          <div class="journal-action">&nearr;</div>
        </article>
      `;
    }
  }

  function getPostId(p){
    // tolerante: id / slug / handle
    return (p?.id || p?.slug || p?.handle || '').toString().trim();
  }

  function getPostTag(p){
    // tolerante: section o primer tag
    if (typeof p?.section === 'string' && p.section.trim()) return p.section.trim();
    if (Array.isArray(p?.tags) && p.tags.length) return String(p.tags[0]);
    return i18n.journalTag;
  }

  function formatCompactDate(iso){
    const d = new Date(iso);
    if(Number.isNaN(d.getTime())) return '';
    const mm = i18n.months[d.getMonth()] || '';
    const dd = String(d.getDate()).padStart(2,'0');
    return `${mm} ${dd}`;
  }

  function escapeHtml(str){
    return String(str)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupReveal();
    loadJournalPreview();
  });
})();

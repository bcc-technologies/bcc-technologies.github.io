/* BCC Technologies — Global Layout Script
   - Adds html.is-at-top when user is at top of page
   - Keeps it lightweight and passive
*/

(() => {
  const root = document.documentElement;
  // "Near top" threshold so the style snaps in a little before exact 0.
  // Tweak this if you want the compact bar to kick in earlier/later.
  const THRESHOLD_PX = 20;
  let ticking = false;

  function update() {
    const atTop = (window.scrollY || window.pageYOffset || 0) <= THRESHOLD_PX;
    root.classList.toggle('is-at-top', atTop);
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      update();
      ticking = false;
    });
  }

  // Init
  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
})();

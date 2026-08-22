(function () {
  'use strict';

  const dialog = document.querySelector('[data-map-nano-showcase]');
  if (!dialog) return;

  const openers = Array.from(document.querySelectorAll('[data-map-nano-showcase-open]'));
  const closeButton = dialog.querySelector('[data-map-nano-showcase-close]');
  const stage = dialog.querySelector('[data-map-nano-showcase-stage]');
  const iframe = dialog.querySelector('iframe[data-src]');
  let returnFocus = null;

  function loadShowcase() {
    if (!iframe || iframe.hasAttribute('src')) return;
    iframe.setAttribute('src', iframe.dataset.src);
  }

  function openShowcase(trigger) {
    const fallbackUrl = iframe && iframe.dataset.src;
    if (typeof dialog.showModal !== 'function') {
      if (fallbackUrl) window.location.assign(fallbackUrl);
      return;
    }

    returnFocus = trigger || document.activeElement;
    loadShowcase();
    dialog.showModal();
    document.documentElement.classList.add('map-nano-showcase-open');
  }

  openers.forEach(function (opener) {
    opener.addEventListener('click', function () {
      openShowcase(opener);
    });
  });

  if (closeButton) {
    closeButton.addEventListener('click', function () {
      dialog.close();
    });
  }

  if (iframe && stage) {
    iframe.addEventListener('load', function () {
      stage.classList.add('is-loaded');
    });
  }

  dialog.addEventListener('click', function (event) {
    if (event.target === dialog) dialog.close();
  });

  dialog.addEventListener('close', function () {
    document.documentElement.classList.remove('map-nano-showcase-open');
    if (returnFocus && typeof returnFocus.focus === 'function') returnFocus.focus();
  });

  if (new URLSearchParams(window.location.search).get('showcase') === '1') {
    window.requestAnimationFrame(function () {
      openShowcase(null);
    });
  }
})();

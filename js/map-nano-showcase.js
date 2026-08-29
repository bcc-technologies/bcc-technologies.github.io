(function () {
  'use strict';

  const dialog = document.querySelector('[data-map-nano-showcase]');
  if (!dialog) return;

  const openers = Array.from(document.querySelectorAll('[data-map-nano-showcase-open]'));
  const closeButton = dialog.querySelector('[data-map-nano-showcase-close]');
  const stage = dialog.querySelector('[data-map-nano-showcase-stage]');
  const iframe = dialog.querySelector('iframe[data-src]');
  const video = dialog.querySelector('[data-map-nano-showcase-video]');
  const videoPanel = dialog.querySelector('[data-map-nano-showcase-video-panel]');
  const livePanel = dialog.querySelector('[data-map-nano-showcase-live-panel]');
  const liveToggle = dialog.querySelector('[data-map-nano-showcase-live]');
  let returnFocus = null;

  function loadShowcase() {
    if (!iframe || iframe.hasAttribute('src')) return;
    iframe.setAttribute('src', iframe.dataset.src);
  }

  function showVideo(shouldPlay) {
    if (!video || !videoPanel) return;
    if (livePanel) livePanel.hidden = true;
    videoPanel.hidden = false;
    if (stage) stage.classList.remove('is-live');
    if (liveToggle) liveToggle.textContent = liveToggle.dataset.liveLabel || 'Abrir demo en vivo';
    if (shouldPlay) video.play().catch(function () {});
  }

  function showLiveDemo() {
    if (!iframe || !livePanel) return;
    if (video) video.pause();
    if (videoPanel) videoPanel.hidden = true;
    livePanel.hidden = false;
    if (stage) stage.classList.add('is-live');
    if (liveToggle) liveToggle.textContent = liveToggle.dataset.videoLabel || 'Volver al vídeo';
    loadShowcase();
  }

  function openShowcase(trigger) {
    const videoSource = video && video.querySelector('source');
    const fallbackUrl = videoSource ? videoSource.src : iframe && iframe.dataset.src;
    if (typeof dialog.showModal !== 'function') {
      if (fallbackUrl) window.location.assign(fallbackUrl);
      return;
    }

    returnFocus = trigger || document.activeElement;
    dialog.showModal();
    document.documentElement.classList.add('map-nano-showcase-open');
    if (video) showVideo(true);
    else loadShowcase();
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

  if (liveToggle) {
    liveToggle.addEventListener('click', function () {
      if (stage && stage.classList.contains('is-live')) showVideo(true);
      else showLiveDemo();
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
    if (video) video.pause();
    if (returnFocus && typeof returnFocus.focus === 'function') returnFocus.focus();
  });

  if (new URLSearchParams(window.location.search).get('showcase') === '1') {
    window.requestAnimationFrame(function () {
      openShowcase(null);
    });
  }
})();

/* BCC Technologies - Shared nav toggle + console */
(() => {
  const PAGE_ALIASES = {
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

  const CONSOLE_COPY = {
    es: {
      openConsole: 'Abrir BCC Console',
      closeConsole: 'Cerrar BCC Console',
      helpTitle: 'Ver ayuda',
      consoleSubtitle: 'Navegacion rapida y contexto del sitio',
      inputPlaceholder: 'Escribe un comando...',
      hint: 'help, ls, cd products, info smartboard, open .',
      ready: 'BCC Console listo.',
      readySub: 'Usa help para ver comandos o info . para inspeccionar esta seccion.',
      currentContext: 'Contexto actual',
      contextChanged: 'Contexto',
      results: 'Resultados',
      includes: 'Subtemas',
      opening: 'Abriendo',
      noChildren: 'No hay subtemas en este nivel.',
      notFound: 'No encontre esa ruta o tema.',
      missingTarget: 'Falta un objetivo.',
      unknownCommand: 'Comando no reconocido.',
      examples: 'Ejemplos: cd products | ls | info map-nano | open science | open .',
      commands: [
        'help        ver comandos disponibles',
        'ls [ruta]   listar secciones o temas',
        'cd <ruta>   cambiar contexto virtual',
        'pwd         mostrar contexto actual',
        'info <tema> imprimir un resumen util',
        'open <tema> abrir una pagina del sitio',
        'find <txt>  buscar rutas y temas',
        'clear       limpiar consola',
        'exit        cerrar BCC Console'
      ]
    },
    en: {
      openConsole: 'Open BCC Console',
      closeConsole: 'Close BCC Console',
      helpTitle: 'Show help',
      consoleSubtitle: 'Fast routing and site context',
      inputPlaceholder: 'Type a command...',
      hint: 'help, ls, cd products, info smartboard, open .',
      ready: 'BCC Console ready.',
      readySub: 'Use help to inspect commands or info . to inspect this section.',
      currentContext: 'Current context',
      contextChanged: 'Context',
      results: 'Results',
      includes: 'Subtopics',
      opening: 'Opening',
      noChildren: 'There are no subtopics at this level.',
      notFound: 'I could not find that route or topic.',
      missingTarget: 'Missing target.',
      unknownCommand: 'Unknown command.',
      examples: 'Examples: cd products | ls | info map-nano | open science | open .',
      commands: [
        'help        show available commands',
        'ls [path]   list sections or topics',
        'cd <path>   change virtual context',
        'pwd         print current context',
        'info <topic> print a useful summary',
        'open <topic> open a site page',
        'find <txt>  search routes and topics',
        'clear       clear console output',
        'exit        close BCC Console'
      ]
    }
  };

  const TOPICS = [
    {
      id: 'root',
      path: '/',
      open: { es: '/index.html', en: '/en/index.html' },
      label: { es: 'Raiz', en: 'Root' },
      summary: {
        es: 'Punto de partida para navegar el sitio de BCC.',
        en: 'Starting point for navigating the BCC site.'
      },
      aliases: ['raiz', 'root', '~', 'site'],
      children: ['home', 'about', 'products', 'science', 'services', 'blog', 'contact', 'login', 'signup']
    },
    {
      id: 'home',
      path: '/home',
      routes: ['/', '/index.html', '/en/index.html'],
      open: { es: '/index.html', en: '/en/index.html' },
      label: { es: 'Inicio', en: 'Home' },
      summary: {
        es: 'Entrada principal del sitio y acceso a las rutas clave.',
        en: 'Main landing page with access to the key site routes.'
      },
      aliases: ['inicio', 'home', 'start', 'landing']
    },
    {
      id: 'about',
      path: '/about',
      routes: ['/aboutUs.html', '/en/aboutUs.html'],
      open: { es: '/aboutUs.html', en: '/en/aboutUs.html' },
      label: { es: 'Nosotros', en: 'About' },
      summary: {
        es: 'Equipo, contexto y enfoque de BCC.',
        en: 'Team, context, and BCC positioning.'
      },
      aliases: ['nosotros', 'about', 'team', 'equipo']
    },
    {
      id: 'products',
      path: '/products',
      routes: ['/products.html', '/en/products.html', '/product_maps.html', '/en/product_maps.html', '/product_maps_nano.html', '/en/product_maps_nano.html', '/MAP.html', '/en/MAP.html'],
      open: { es: '/products.html', en: '/en/products.html' },
      label: { es: 'Tecnologia', en: 'Technology' },
      summary: {
        es: 'Portafolio de software, instrumentacion y bundles orientados a resultado.',
        en: 'Portfolio of software, instrumentation, and bundles organized around outcomes.'
      },
      aliases: ['tecnologia', 'technology', 'tech', 'catalogo', 'portfolio'],
      children: ['map-nano', 'map-bio', 'eis', 'dls', 'bundles']
    },
    {
      id: 'science',
      path: '/science',
      routes: ['/science.html', '/en/science.html'],
      open: { es: '/science.html', en: '/en/science.html' },
      label: { es: 'Ciencia', en: 'Science' },
      summary: {
        es: 'Recursos cientificos de BCC: APOD, ArXiv y smartboard.',
        en: 'BCC science resources: APOD, ArXiv, and the smartboard.'
      },
      aliases: ['ciencia', 'science', 'research'],
      children: ['smartboard', 'apod', 'arxiv']
    },
    {
      id: 'services',
      path: '/services',
      routes: ['/services.html', '/en/services.html', '/cotizacion.html', '/en/cotizacion.html'],
      open: { es: '/services.html', en: '/en/services.html' },
      label: { es: 'Servicios', en: 'Services' },
      summary: {
        es: 'Servicios aplicados, pilotos y acompanamiento tecnico.',
        en: 'Applied services, pilots, and technical guidance.'
      },
      aliases: ['servicios', 'services', 'quotes', 'cotizacion']
    },
    {
      id: 'blog',
      path: '/blog',
      routes: ['/blog.html', '/en/blog.html'],
      open: { es: '/blog.html', en: '/en/blog.html' },
      label: { es: 'Blog', en: 'Blog' },
      summary: {
        es: 'Articulos, anuncios y contexto tecnico de BCC.',
        en: 'Articles, announcements, and BCC technical context.'
      },
      aliases: ['blog', 'journal', 'posts']
    },
    {
      id: 'contact',
      path: '/contact',
      routes: ['/contactUs.html', '/en/contactUs.html'],
      open: { es: '/contactUs.html', en: '/en/contactUs.html' },
      label: { es: 'Contacto', en: 'Contact' },
      summary: {
        es: 'Canal rapido para demos, pilotos y conversaciones comerciales.',
        en: 'Fast path for demos, pilots, and commercial conversations.'
      },
      aliases: ['contacto', 'contact', 'demo', 'sales']
    },
    {
      id: 'login',
      path: '/login',
      routes: ['/login.html', '/en/login.html'],
      open: { es: '/login.html', en: '/en/login.html' },
      label: { es: 'Ingresar', en: 'Login' },
      summary: {
        es: 'Entrada para cuentas y herramientas con acceso privado.',
        en: 'Entry point for accounts and private-access tools.'
      },
      aliases: ['ingresar', 'login', 'signin', 'account']
    },
    {
      id: 'signup',
      path: '/signup',
      routes: ['/signup.html', '/en/signup.html'],
      open: { es: '/signup.html', en: '/en/signup.html' },
      label: { es: 'Registro', en: 'Signup' },
      summary: {
        es: 'Alta para accesos tempranos y cuentas nuevas.',
        en: 'Sign-up for early access and new accounts.'
      },
      aliases: ['registro', 'signup', 'register', 'join']
    },
    {
      id: 'map-nano',
      path: '/products/map-nano',
      routes: ['/product_maps_nano.html', '/en/product_maps_nano.html'],
      open: { es: '/product_maps_nano.html', en: '/en/product_maps_nano.html' },
      label: { es: 'MAP-Nano', en: 'MAP-Nano' },
      summary: {
        es: 'Rugosidad, porosidad y morfologia con salida web o desktop.',
        en: 'Roughness, porosity, and morphology with web or desktop output.'
      },
      aliases: ['nano', 'mapnano', 'nano-map']
    },
    {
      id: 'map-bio',
      path: '/products/map-bio',
      routes: ['/product_maps.html', '/en/product_maps.html'],
      open: { es: '/product_maps.html#map-bio', en: '/en/product_maps.html#map-bio' },
      label: { es: 'MAP-Bio', en: 'MAP-Bio' },
      summary: {
        es: 'Conteo celular y analisis morfologico con trazabilidad visual.',
        en: 'Cell counting and morphology analysis with visual traceability.'
      },
      aliases: ['bio', 'mapbio', 'bio-map']
    },
    {
      id: 'eis',
      path: '/products/eis',
      open: { es: '/products.html?q=eis#catalogo', en: '/en/products.html?q=eis#catalogo' },
      label: { es: 'EIS', en: 'EIS' },
      summary: {
        es: 'Instrumentacion y flujos de impedancia para liquidos, metales y recubrimientos.',
        en: 'Instrumentation and impedance workflows for liquids, metals, and coatings.'
      },
      aliases: ['aqua-specter', 'impedance', 'electrochemistry']
    },
    {
      id: 'dls',
      path: '/products/dls',
      open: { es: '/products.html?q=dls#catalogo', en: '/en/products.html?q=dls#catalogo' },
      label: { es: 'DLS', en: 'DLS' },
      summary: {
        es: 'Caracterizacion de particulas suspendidas y PSD esencial.',
        en: 'Characterization of suspended particles and essential PSD output.'
      },
      aliases: ['dls-pro', 'dls-mini', 'particle', 'particles']
    },
    {
      id: 'bundles',
      path: '/products/bundles',
      open: { es: '/products.html?family=bundles#catalogo', en: '/en/products.html?family=bundles#catalogo' },
      label: { es: 'Bundles', en: 'Bundles' },
      summary: {
        es: 'Paquetes que conectan medicion, software y reporte en un flujo unico.',
        en: 'Packages that connect measurement, software, and reporting in a single workflow.'
      },
      aliases: ['bundle', 'bundles', 'workflow', 'package', 'packages']
    },
    {
      id: 'smartboard',
      path: '/science/smartboard',
      open: { es: '/science.html#widget-board', en: '/en/science.html#widget-board' },
      label: { es: 'Smartboard', en: 'Smartboard' },
      summary: {
        es: 'Pizarra interactiva para explorar widgets cientificos y relacionar datos rapido.',
        en: 'Interactive board for exploring scientific widgets and relating data quickly.'
      },
      aliases: ['widgetboard', 'board', 'widgets']
    },
    {
      id: 'apod',
      path: '/science/apod',
      open: { es: '/science.html#science-hero-apod', en: '/en/science.html#science-hero-apod' },
      label: { es: 'NASA APOD', en: 'NASA APOD' },
      summary: {
        es: 'Imagen astronomica del dia con contexto visual y editorial.',
        en: 'Astronomy Picture of the Day with visual and editorial context.'
      },
      aliases: ['nasa', 'astronomy', 'picture']
    },
    {
      id: 'arxiv',
      path: '/science/arxiv',
      open: { es: '/science.html#arxiv', en: '/en/science.html#arxiv' },
      label: { es: 'ArXiv Explorer', en: 'ArXiv Explorer' },
      summary: {
        es: 'Explorador de publicaciones cientificas con filtros curados por BCC.',
        en: 'Scientific publication explorer with BCC-curated filters.'
      },
      aliases: ['papers', 'publications', 'explorer']
    }
  ];

  const TOPIC_INDEX = createTopicIndex(TOPICS);

  function normalizeToken(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\\/g, '/')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9/._~-]+/g, '');
  }

  function staticPathname(value) {
    if (!value) return '';
    try {
      return new URL(value, 'https://bcc.local').pathname.toLowerCase();
    } catch {
      return '';
    }
  }

  function createTopicIndex(topics) {
    const byId = new Map();
    const byPath = new Map();
    const byAlias = new Map();
    const byRoute = new Map();

    topics.forEach((topic) => {
      byId.set(topic.id, topic);
      byPath.set(topic.path, topic);

      const lastSegment = topic.path.split('/').filter(Boolean).slice(-1)[0] || topic.id;
      const aliases = new Set([topic.id, topic.path, topic.path.replace(/^\//, ''), lastSegment, ...(topic.aliases || [])]);
      aliases.forEach((alias) => {
        const key = normalizeToken(alias);
        if (key) byAlias.set(key, topic.path);
      });

      (topic.routes || []).forEach((route) => {
        const pathname = staticPathname(route);
        if (pathname && !byRoute.has(pathname)) byRoute.set(pathname, topic.path);
      });
    });

    return { byId, byPath, byAlias, byRoute };
  }

  function getLocale() {
    return location.pathname.startsWith('/en/') ? 'en' : 'es';
  }

  function topicLabel(topic, locale) {
    if (!topic) return '';
    return (topic.label && (topic.label[locale] || topic.label.es || topic.label.en)) || topic.id;
  }

  function topicSummary(topic, locale) {
    if (!topic) return '';
    return (topic.summary && (topic.summary[locale] || topic.summary.es || topic.summary.en)) || '';
  }

  function topicChildren(topic) {
    return (topic && Array.isArray(topic.children) ? topic.children : [])
      .map((id) => TOPIC_INDEX.byId.get(id))
      .filter(Boolean);
  }

  function topicOpenUrl(topic, locale) {
    if (!topic || !topic.open) return locale === 'en' ? '/en/index.html' : '/index.html';
    return topic.open[locale] || topic.open.es || topic.open.en || '/index.html';
  }

  function parentPath(pathname) {
    const clean = pathname || '/';
    if (clean === '/' || !clean.startsWith('/')) return '/';
    const parts = clean.split('/').filter(Boolean);
    parts.pop();
    return parts.length ? `/${parts.join('/')}` : '/';
  }

  function topicMatchesAlias(topic, token) {
    const key = normalizeToken(token);
    if (!key || !topic) return false;
    const lastSegment = topic.path.split('/').filter(Boolean).slice(-1)[0] || topic.id;
    const aliases = [topic.id, topic.path, topic.path.replace(/^\//, ''), lastSegment, ...(topic.aliases || [])];
    return aliases.some((alias) => normalizeToken(alias) === key);
  }

  function topicFromAlias(token) {
    const key = normalizeToken(token);
    const path = TOPIC_INDEX.byAlias.get(key);
    return path ? TOPIC_INDEX.byPath.get(path) || null : null;
  }

  function resolveTopic(input, cwdPath) {
    const currentPath = TOPIC_INDEX.byPath.has(cwdPath) ? cwdPath : '/';
    const raw = String(input || '').trim();

    if (!raw || raw === '~') return TOPIC_INDEX.byPath.get('/');
    if (raw === '.') return TOPIC_INDEX.byPath.get(currentPath);
    if (raw === '..') return TOPIC_INDEX.byPath.get(parentPath(currentPath));
    if (raw.startsWith('./')) return resolveTopic(raw.slice(2), currentPath);
    if (raw.startsWith('../')) return resolveTopic(raw.slice(3), parentPath(currentPath));

    if (raw.startsWith('/')) {
      const absolute = TOPIC_INDEX.byPath.get(raw);
      if (absolute) return absolute;
      const fromAlias = topicFromAlias(raw);
      if (fromAlias) return fromAlias;
    }

    const currentTopic = TOPIC_INDEX.byPath.get(currentPath) || TOPIC_INDEX.byPath.get('/');
    const child = topicChildren(currentTopic).find((entry) => topicMatchesAlias(entry, raw));
    if (child) return child;

    const siblingParent = TOPIC_INDEX.byPath.get(parentPath(currentPath));
    if (siblingParent) {
      const sibling = topicChildren(siblingParent).find((entry) => topicMatchesAlias(entry, raw));
      if (sibling) return sibling;
    }

    if (raw.includes('/')) {
      const absoluteGuess = `/${normalizeToken(raw).replace(/^\//, '')}`;
      if (TOPIC_INDEX.byPath.has(absoluteGuess)) return TOPIC_INDEX.byPath.get(absoluteGuess);
    }

    return topicFromAlias(raw);
  }

  function findTopicFromLocation() {
    const pathname = location.pathname.toLowerCase();
    const match = TOPIC_INDEX.byRoute.get(pathname);
    return match ? TOPIC_INDEX.byPath.get(match) || TOPIC_INDEX.byPath.get('/') : TOPIC_INDEX.byPath.get('/');
  }

  function commandAlias(command) {
    const normalized = normalizeToken(command);
    const aliases = {
      '?': 'help',
      ayuda: 'help',
      man: 'help',
      dir: 'ls',
      lista: 'ls',
      listar: 'ls',
      ir: 'cd',
      pwd: 'pwd',
      where: 'pwd',
      info: 'info',
      informacion: 'info',
      detalle: 'info',
      detalles: 'info',
      cat: 'info',
      open: 'open',
      abrir: 'open',
      search: 'find',
      buscar: 'find',
      find: 'find',
      clear: 'clear',
      limpiar: 'clear',
      cls: 'clear',
      exit: 'exit',
      cerrar: 'exit',
      quit: 'exit'
    };
    return aliases[normalized] || normalized;
  }

  function setupNav() {
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

    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = nav.classList.contains('active');
      isOpen ? close() : open();
    });

    document.addEventListener('click', (event) => {
      if (!nav.classList.contains('active')) return;
      const clickedInside = nav.contains(event.target) || toggle.contains(event.target);
      if (!clickedInside) close();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });

    if (list) {
      list.addEventListener('click', (event) => {
        const link = event.target.closest('a');
        if (link) close();
      });
    }
  }

  function markCurrentPage() {
    const nav = document.querySelector('header nav');
    if (!nav) return;

    const current = (location.pathname.split('/').pop() || '').toLowerCase();
    if (!current || current === 'index.html') return;

    const targetPage = PAGE_ALIASES[current] || current;
    if (targetPage === 'index.html') return;

    Array.from(nav.querySelectorAll('a')).forEach((link) => {
      const hrefPath = new URL(link.getAttribute('href') || '', location.href).pathname;
      const target = (hrefPath.split('/').pop() || '').toLowerCase();
      if (target && target === targetPage) {
        link.classList.add('is-current');
        link.setAttribute('aria-current', 'page');
      }
    });
  }

  function initConsole() {
    const navActions = document.querySelector('.nav-actions');
    if (!navActions || navActions.dataset.consoleBound === 'true') return;

    const loginLink = Array.from(navActions.querySelectorAll('a')).find((link) => {
      const href = link.getAttribute('href') || '';
      return /(?:^|\/)login\.html(?:$|[?#])/i.test(href);
    });

    if (!loginLink) return;
    navActions.dataset.consoleBound = 'true';

    const locale = getLocale();
    const copy = CONSOLE_COPY[locale] || CONSOLE_COPY.es;
    const shell = document.createElement('div');
    shell.className = 'bcc-console-shell';
    shell.id = 'bccConsoleShell';
    shell.hidden = true;
    shell.innerHTML = `
      <section class="bcc-console" role="dialog" aria-modal="false" aria-label="BCC Console">
        <div class="bcc-console-head">
          <div class="bcc-console-brand">
            <span class="bcc-console-brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true">
                <path d="M4 7.5h16"></path>
                <path d="M8 12l-2.6 2.4L8 16.8"></path>
                <path d="M11 17h6"></path>
              </svg>
            </span>
            <div class="bcc-console-brand-copy">
              <strong>BCC Console</strong>
              <span id="bccConsoleContextLabel">${copy.consoleSubtitle}</span>
            </div>
          </div>
          <div class="bcc-console-head-actions">
            <button class="bcc-console-ghost" type="button" data-console-action="help" aria-label="${copy.helpTitle}" title="${copy.helpTitle}">?</button>
            <button class="bcc-console-ghost" type="button" data-console-action="close" aria-label="${copy.closeConsole}" title="${copy.closeConsole}">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" focusable="false" aria-hidden="true">
                <path d="M5 5l10 10"></path>
                <path d="M15 5L5 15"></path>
              </svg>
            </button>
          </div>
        </div>
        <div class="bcc-console-body">
          <div class="bcc-console-output" id="bccConsoleOutput" role="log" aria-live="polite" aria-relevant="additions"></div>
          <div class="bcc-console-quickbar" id="bccConsoleQuickbar"></div>
          <form class="bcc-console-input-row" id="bccConsoleForm">
            <span class="bcc-console-prompt" id="bccConsolePrompt">bcc:/$</span>
            <input id="bccConsoleInput" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="${copy.inputPlaceholder}" placeholder="${copy.inputPlaceholder}" />
          </form>
          <div class="bcc-console-autocomplete" id="bccConsoleAutocomplete" hidden></div>
          <p class="bcc-console-hint">${copy.hint}</p>
        </div>
      </section>`;

    const launch = document.createElement('button');
    launch.type = 'button';
    launch.className = 'pref-btn icon-btn bcc-console-launch';
    launch.id = 'bccConsoleLaunch';
    launch.setAttribute('aria-label', copy.openConsole);
    launch.setAttribute('title', copy.openConsole);
    launch.setAttribute('aria-expanded', 'false');
    launch.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true">
        <path d="M4 7.5h16"></path>
        <path d="M8 12l-2.8 2.5L8 17"></path>
        <path d="M11.5 17H18"></path>
      </svg>`;

    loginLink.insertAdjacentElement('afterend', launch);
    document.body.appendChild(shell);

    const output = shell.querySelector('#bccConsoleOutput');
    const quickbar = shell.querySelector('#bccConsoleQuickbar');
    const form = shell.querySelector('#bccConsoleForm');
    const input = shell.querySelector('#bccConsoleInput');
    const autocomplete = shell.querySelector('#bccConsoleAutocomplete');
    const prompt = shell.querySelector('#bccConsolePrompt');
    const contextLabel = shell.querySelector('#bccConsoleContextLabel');
    const helpButton = shell.querySelector('[data-console-action="help"]');
    const closeButton = shell.querySelector('[data-console-action="close"]');
    const state = {
      open: false,
      hydrated: false,
      closeTimer: 0,
      cwd: (findTopicFromLocation() || TOPIC_INDEX.byPath.get('/')).path,
      history: [],
      historyIndex: -1
    };
    const runtimeTopicIndex = createRuntimeTopicIndex();
    const autocompleteState = {
      items: [],
      index: -1,
      blurTimer: 0
    };

    function localeText(esText, enText) {
      return locale === 'en' ? enText : esText;
    }

    function createRuntimeTopicIndex() {
      const byPath = new Map();
      const byAlias = new Map();
      const childrenByPath = new Map();
      const currentTopic = findTopicFromLocation() || TOPIC_INDEX.byPath.get('/');
      const currentPageUrl = location.pathname + location.search;

      function addRuntimeTopic(topic, parentPath) {
        if (!topic || !topic.path || byPath.has(topic.path)) return;
        byPath.set(topic.path, topic);

        const lastSegment = topic.path.split('/').filter(Boolean).slice(-1)[0] || topic.id;
        const aliases = new Set([
          topic.id,
          topic.path,
          topic.path.replace(/^\//, ''),
          lastSegment,
          topicLabel(topic, locale),
          ...(topic.aliases || [])
        ]);

        aliases.forEach((alias) => {
          const key = normalizeToken(alias);
          if (key) byAlias.set(key, topic.path);
        });

        if (parentPath) {
          const bucket = childrenByPath.get(parentPath) || [];
          bucket.push(topic);
          childrenByPath.set(parentPath, bucket);
        }
      }

      const runtimeProducts = window.BCC_PRODUCTS_CONTENT && window.BCC_PRODUCTS_CONTENT[locale];
      if (runtimeProducts && Array.isArray(runtimeProducts.products)) {
        runtimeProducts.products.forEach((product) => {
          const staticTopic = TOPIC_INDEX.byId.get(String(product.id || '')) || null;
          const fallbackPath = `/products/${normalizeToken(product.id || product.title || 'product')}`;
          const primaryAction = Array.isArray(product.actions)
            ? product.actions.find((action) => action && typeof action.href === 'string' && action.href)
            : null;
          const openHref = primaryAction ? primaryAction.href : (staticTopic ? topicOpenUrl(staticTopic, locale) : currentPageUrl);
          const topic = {
            kind: 'product',
            id: String(product.id || normalizeToken(product.title || 'product')),
            path: staticTopic ? staticTopic.path : fallbackPath,
            open: { es: openHref, en: openHref },
            label: { es: product.title || product.id || 'Producto', en: product.title || product.id || 'Product' },
            summary: { es: product.description || '', en: product.description || '' },
            aliases: [product.title, product.alt, ...(product.methods || []), ...(product.tags || [])].filter(Boolean),
            family: product.family || '',
            methods: Array.isArray(product.methods) ? product.methods : [],
            uses: Array.isArray(product.uses) ? product.uses : [],
            tags: Array.isArray(product.tags) ? product.tags : [],
            bestFor: product.bestFor || '',
            outputs: product.outputs || '',
            deployment: product.deployment || '',
            readiness: product.readiness || '',
            actions: Array.isArray(product.actions) ? product.actions : []
          };
          addRuntimeTopic(topic, '/products');
        });
      }

      const main = document.querySelector('main');
      if (main && currentTopic) {
        Array.from(main.querySelectorAll('section[id]')).forEach((section) => {
          const rawId = String(section.id || '').trim();
          if (!rawId) return;

          const heading = Array.from(section.querySelectorAll('h1, h2, h3, .hero-title, .card-title, .apod-hero-title, .research-archive-title'))
            .map((element) => element.textContent.trim())
            .find(Boolean);
          const summary = Array.from(section.querySelectorAll('.lead, .hero-subtitle, .card-subtitle, .research-archive-copy, p'))
            .map((element) => element.textContent.replace(/\s+/g, ' ').trim())
            .find(Boolean);
          const pathKey = `${currentTopic.path}/${normalizeToken(rawId)}`;
          const sectionTopic = {
            kind: 'section',
            id: rawId,
            path: pathKey,
            open: { es: `${location.pathname}#${rawId}`, en: `${location.pathname}#${rawId}` },
            label: { es: heading || rawId, en: heading || rawId },
            summary: { es: summary || '', en: summary || '' },
            aliases: [rawId, heading].filter(Boolean)
          };
          addRuntimeTopic(sectionTopic, currentTopic.path);
        });
      }

      return { byPath, byAlias, childrenByPath };
    }

    function runtimeTopicFromPath(pathname) {
      return pathname ? runtimeTopicIndex.byPath.get(pathname) || null : null;
    }

    function runtimeTopicFromAlias(token) {
      const key = normalizeToken(token);
      const path = runtimeTopicIndex.byAlias.get(key);
      return path ? runtimeTopicFromPath(path) : null;
    }

    function resolveConsoleTopic(input, cwdPath) {
      const raw = String(input || '').trim();
      if (!raw) return TOPIC_INDEX.byPath.get('/');

      if (raw.startsWith('/')) {
        const absolute = runtimeTopicFromPath(raw) || runtimeTopicFromPath(`/${normalizeToken(raw).replace(/^\//, '')}`);
        if (absolute) return absolute;
      }

      if (!['.', '..', '~'].includes(raw) && !raw.startsWith('./') && !raw.startsWith('../')) {
        const runtimeTopic = runtimeTopicFromAlias(raw);
        if (runtimeTopic) return runtimeTopic;
      }

      const staticTopic = resolveTopic(input, cwdPath);
      if (staticTopic) return runtimeTopicFromPath(staticTopic.path) || staticTopic;
      return null;
    }

    function getChildTopics(topic) {
      const runtimeChildren = runtimeTopicIndex.childrenByPath.get(topic.path) || [];
      const staticChildren = topicChildren(topic).map((child) => runtimeTopicFromPath(child.path) || child);
      if (runtimeChildren.length && topic.path === '/products') {
        return runtimeChildren.filter((child) => child.kind === 'product');
      }

      const merged = [...staticChildren];
      runtimeChildren.forEach((child) => {
        if (!merged.some((entry) => entry.path === child.path)) merged.push(child);
      });
      return merged;
    }

    function formatTopicListLine(topic) {
      if (topic.kind === 'product') {
        const meta = [topic.family, ...(topic.methods || []).slice(0, 1)].filter(Boolean).join(' | ');
        return `${topic.id}    ${topicLabel(topic, locale)}${meta ? `    ${meta}` : ''}`;
      }
      return `${topic.id}    ${topicLabel(topic, locale)}`;
    }

    function contextualInfoLines(topic) {
      const lines = [];
      const products = (runtimeTopicIndex.childrenByPath.get('/products') || []).filter((entry) => entry.kind === 'product');

      if (topic.path === '/products' && products.length) {
        const familyCounts = products.reduce((memo, product) => {
          const key = product.family || 'other';
          memo.set(key, (memo.get(key) || 0) + 1);
          return memo;
        }, new Map());
        const spread = Array.from(familyCounts.entries()).map(([family, count]) => `${family}:${count}`).join(' | ');
        lines.push(`${localeText('Productos', 'Products')}: ${products.length}`);
        if (spread) lines.push(`${localeText('Distribucion', 'Distribution')}: ${spread}`);
      }

      if (topic.path === '/services') {
        const sections = runtimeTopicIndex.childrenByPath.get('/services') || [];
        if (sections.length) {
          lines.push(`${localeText('Secciones', 'Sections')}: ${sections.map((section) => section.id).join('  ')}`);
        }
      }

      if (topic.path === '/science') {
        const sections = runtimeTopicIndex.childrenByPath.get('/science') || [];
        if (sections.length) {
          lines.push(`${localeText('Secciones', 'Sections')}: ${sections.map((section) => section.id).join('  ')}`);
        }
      }

      if (topic.id === 'smartboard' && /science\.html/i.test(location.pathname)) {
        const views = Array.from(document.querySelectorAll('#widget-mobile-nav .widget-mobile-tab'))
          .map((element) => element.textContent.trim())
          .filter(Boolean);
        const actions = Array.from(document.querySelectorAll('#widget-actions-bar .widget-action, #widget-actions-bar [data-widget-action]'))
          .map((element) => element.textContent.replace(/\s+/g, ' ').trim())
          .filter(Boolean);
        if (views.length) lines.push(`${localeText('Vistas', 'Views')}: ${views.join(' | ')}`);
        if (actions.length) lines.push(`${localeText('Acciones', 'Actions')}: ${Array.from(new Set(actions)).join(' | ')}`);
      }

      if (topic.id === 'apod' && /science\.html/i.test(location.pathname)) {
        const apodTitle = document.getElementById('hero-apod-title')?.textContent?.trim();
        const apodDesc = document.getElementById('hero-apod-desc')?.textContent?.trim();
        const apodDate = document.getElementById('hero-apod-date')?.textContent?.trim();
        if (apodTitle) lines.push(`Title: ${apodTitle}`);
        if (apodDate && apodDate !== '--') lines.push(`Date: ${apodDate}`);
        if (apodDesc) lines.push(apodDesc);
      }

      if (topic.id === 'arxiv' && /science\.html/i.test(location.pathname)) {
        const subtitle = document.querySelector('#arxiv-board .card-subtitle')?.textContent?.trim();
        const updated = document.getElementById('arxiv-updated')?.textContent?.trim();
        if (subtitle) lines.push(subtitle);
        if (updated && !updated.endsWith('--')) lines.push(updated);
      }

      return lines;
    }

    function topicDetailLines(topic) {
      const activeTopic = runtimeTopicFromPath(topic.path) || topic;
      const lines = [];

      if (activeTopic.family) lines.push(`${localeText('Familia', 'Family')}: ${activeTopic.family}`);
      if (activeTopic.methods && activeTopic.methods.length) lines.push(`${localeText('Metodo', 'Method')}: ${activeTopic.methods.join(', ')}`);
      if (activeTopic.uses && activeTopic.uses.length) lines.push(`${localeText('Uso', 'Use')}: ${activeTopic.uses.join(', ')}`);
      if (activeTopic.tags && activeTopic.tags.length) lines.push(`${localeText('Etiquetas', 'Tags')}: ${activeTopic.tags.join(', ')}`);
      if (activeTopic.bestFor) lines.push(`${localeText('Ideal para', 'Best for')}: ${activeTopic.bestFor}`);
      if (activeTopic.outputs) lines.push(`${localeText('Entrega', 'Delivers')}: ${activeTopic.outputs}`);
      if (activeTopic.deployment) lines.push(`${localeText('Despliegue', 'Deployment')}: ${activeTopic.deployment}`);
      if (activeTopic.readiness) lines.push(`${localeText('Estado', 'Readiness')}: ${activeTopic.readiness}`);
      if (activeTopic.actions && activeTopic.actions.length) {
        const actionLabels = activeTopic.actions
          .map((action) => action && (action.label || action.href))
          .filter(Boolean)
          .join(' | ');
        if (actionLabels) lines.push(`${localeText('Acciones', 'Actions')}: ${actionLabels}`);
      }

      return [...lines, ...contextualInfoLines(activeTopic)];
    }

    function commandMeta(command) {
      switch (command) {
        case 'help': return localeText('ver comandos disponibles', 'show available commands');
        case 'ls': return localeText('listar secciones o temas', 'list sections or topics');
        case 'cd': return localeText('cambiar contexto virtual', 'change virtual context');
        case 'pwd': return localeText('mostrar contexto actual', 'print current context');
        case 'info': return localeText('imprimir un resumen util', 'print a useful summary');
        case 'open': return localeText('abrir una pagina del sitio', 'open a site page');
        case 'find': return localeText('buscar rutas y temas', 'search routes and topics');
        case 'clear': return localeText('limpiar consola', 'clear console output');
        case 'exit': return localeText('cerrar BCC Console', 'close BCC Console');
        default: return '';
      }
    }

    function allConsoleTopics() {
      const ordered = [];
      const seen = new Set();
      const pushTopic = (topic) => {
        const activeTopic = topic && (runtimeTopicFromPath(topic.path) || topic);
        if (!activeTopic || !activeTopic.path || seen.has(activeTopic.path)) return;
        seen.add(activeTopic.path);
        ordered.push(activeTopic);
      };

      TOPICS.forEach((topic) => {
        if (topic.id !== 'root') pushTopic(topic);
      });
      Array.from(runtimeTopicIndex.byPath.values()).forEach(pushTopic);
      return ordered;
    }

    function topicMatchScore(topic, fragment) {
      const needle = normalizeToken(fragment);
      if (!topic) return 0;
      if (!needle) return 1;

      const values = [
        topic.id,
        topic.path,
        topicLabel(topic, locale),
        topicSummary(topic, locale),
        ...(topic.aliases || []),
        ...(topic.methods || []),
        ...(topic.tags || []),
        topic.family,
        topic.bestFor,
        topic.outputs,
        topic.deployment,
        topic.readiness
      ];

      let best = 0;
      values.forEach((value) => {
        const normalized = normalizeToken(value);
        if (!normalized) return;
        if (normalized === needle) best = Math.max(best, 6);
        else if (normalized.startsWith(needle)) best = Math.max(best, 5);
        else if (normalized.includes(needle)) best = Math.max(best, 3);
      });
      return best;
    }

    function rankTopicForAutocomplete(topic, fragment) {
      let score = topicMatchScore(topic, fragment);
      const currentPath = state.cwd;
      if (topic.path === currentPath) score += 8;
      if (parentPath(topic.path) === currentPath) score += 6;
      if (topic.path.startsWith(`${currentPath}/`)) score += 5;
      if (topic.path === parentPath(currentPath)) score += 4;
      if (parentPath(topic.path) === parentPath(currentPath)) score += 2;
      if (topic.kind === 'product') score += 1;
      return score;
    }

    function defaultQuickCommands() {
      const commands = [];
      const pushCommand = (value) => {
        if (value && !commands.includes(value)) commands.push(value);
      };

      if (state.cwd === '/products') {
        pushCommand('ls products');
        pushCommand('info aqua-specter');
        pushCommand('info map-nano');
        pushCommand('find dls');
        pushCommand('open .');
        pushCommand('help');
        return commands;
      }

      if (state.cwd.startsWith('/products/')) {
        pushCommand('info .');
        pushCommand('open .');
        pushCommand('cd ..');
        pushCommand('ls ..');
        pushCommand('help');
        return commands;
      }

      if (state.cwd === '/science') {
        pushCommand('info smartboard');
        pushCommand('info arxiv');
        pushCommand('info apod');
        pushCommand('ls science');
        pushCommand('open .');
        pushCommand('help');
        return commands;
      }

      if (state.cwd.startsWith('/science/')) {
        pushCommand('info .');
        pushCommand('open .');
        pushCommand('cd ..');
        pushCommand('ls ..');
        pushCommand('help');
        return commands;
      }

      if (state.cwd === '/services') {
        pushCommand('info services');
        pushCommand('ls services');
        pushCommand('open contact');
        pushCommand('help');
        return commands;
      }

      pushCommand('help');
      pushCommand('ls');
      pushCommand('cd products');
      pushCommand('cd science');
      pushCommand('find map');
      pushCommand('open .');
      return commands;
    }

    function renderQuickbar() {
      quickbar.replaceChildren();
      const recent = Array.from(new Set(state.history.slice().reverse()));
      const commands = [];
      [...recent, ...defaultQuickCommands()].forEach((commandValue) => {
        if (commandValue && !commands.includes(commandValue)) commands.push(commandValue);
      });

      commands.slice(0, 6).forEach((commandValue) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'bcc-console-quick';
        button.dataset.consoleQuick = commandValue;
        button.textContent = commandValue;
        button.setAttribute('title', commandValue);
        button.addEventListener('click', () => {
          input.value = '';
          clearAutocomplete();
          runCommand(commandValue);
          window.setTimeout(() => input.focus(), 0);
        });
        quickbar.appendChild(button);
      });

      quickbar.hidden = commands.length === 0;
    }

    function clearAutocomplete() {
      autocompleteState.items = [];
      autocompleteState.index = -1;
      autocomplete.hidden = true;
      autocomplete.replaceChildren();
    }

    function renderAutocomplete() {
      autocomplete.replaceChildren();
      if (!autocompleteState.items.length) {
        autocomplete.hidden = true;
        autocompleteState.index = -1;
        return;
      }

      if (autocompleteState.index < 0 || autocompleteState.index >= autocompleteState.items.length) {
        autocompleteState.index = 0;
      }

      autocomplete.hidden = false;
      autocompleteState.items.forEach((item, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `bcc-console-suggestion${index === autocompleteState.index ? ' is-active' : ''}`;
        button.dataset.autocompleteValue = item.value;

        const label = document.createElement('span');
        label.className = 'bcc-console-suggestion-label';
        label.textContent = item.label;

        const meta = document.createElement('span');
        meta.className = 'bcc-console-suggestion-meta';
        meta.textContent = item.meta;

        button.append(label, meta);
        button.addEventListener('mousedown', (event) => event.preventDefault());
        button.addEventListener('click', () => {
          acceptAutocompleteItem(item);
        });
        autocomplete.appendChild(button);
      });
    }

    function buildAutocompleteItems(raw) {
      const value = String(raw || '');
      const trimmed = value.trim();
      if (!trimmed) return [];

      const hasTrailingSpace = /\s$/.test(value);
      const parts = trimmed.split(/\s+/).filter(Boolean);
      const firstRaw = parts[0] || '';
      const command = commandAlias(firstRaw);
      const fragment = parts.slice(1).join(' ');
      const topicCommands = new Set(['ls', 'cd', 'info', 'open', 'find']);
      const items = [];
      const seen = new Set();
      const pushItem = (item) => {
        if (!item || !item.value || seen.has(item.value)) return;
        seen.add(item.value);
        items.push(item);
      };

      if (parts.length <= 1 && !hasTrailingSpace) {
        const prefix = normalizeToken(firstRaw);
        ['help', 'ls', 'cd', 'pwd', 'info', 'open', 'find', 'clear', 'exit'].forEach((name) => {
          if (!prefix || name.startsWith(prefix)) {
            pushItem({
              value: topicCommands.has(name) ? `${name} ` : name,
              label: name,
              meta: commandMeta(name)
            });
          }
        });

        const topicMatches = allConsoleTopics()
          .map((topic) => ({ topic, score: topicMatchScore(topic, firstRaw) }))
          .filter(({ score }) => score > 0)
          .sort((left, right) => right.score - left.score || left.topic.id.localeCompare(right.topic.id))
          .slice(0, 3);

        topicMatches.forEach(({ topic }) => {
          pushItem({
            value: `info ${topic.id}`,
            label: `info ${topic.id}`,
            meta: `${topicLabel(topic, locale)}  ${topic.path}`
          });
        });

        return items.slice(0, 5);
      }

      if (['cd', 'ls', 'info', 'open'].includes(command)) {
        if (!fragment && command === 'cd') {
          pushItem({ value: 'cd ..', label: 'cd ..', meta: localeText('subir un nivel', 'go up one level') });
          pushItem({ value: 'cd /', label: 'cd /', meta: localeText('volver a la raiz', 'go back to root') });
        }

        const topicMatches = allConsoleTopics()
          .map((topic) => ({ topic, score: rankTopicForAutocomplete(topic, hasTrailingSpace ? '' : fragment) }))
          .filter(({ score }) => score > 0)
          .sort((left, right) => right.score - left.score || left.topic.id.localeCompare(right.topic.id))
          .slice(0, 5);

        topicMatches.forEach(({ topic }) => {
          pushItem({
            value: `${command} ${topic.id}`,
            label: `${command} ${topic.id}`,
            meta: `${topicLabel(topic, locale)}  ${topic.path}`
          });
        });

        return items.slice(0, 6);
      }

      if (command === 'find') {
        const searchSeed = hasTrailingSpace ? '' : fragment;
        const topicMatches = allConsoleTopics()
          .map((topic) => ({ topic, score: rankTopicForAutocomplete(topic, searchSeed || state.cwd) }))
          .filter(({ score }) => score > 0)
          .sort((left, right) => right.score - left.score || left.topic.id.localeCompare(right.topic.id))
          .slice(0, 5);

        topicMatches.forEach(({ topic }) => {
          pushItem({
            value: `find ${topic.id}`,
            label: `find ${topic.id}`,
            meta: topicLabel(topic, locale)
          });
        });
      }

      return items.slice(0, 5);
    }

    function updateAutocomplete() {
      autocompleteState.items = buildAutocompleteItems(input.value);
      autocompleteState.index = autocompleteState.items.length ? 0 : -1;
      renderAutocomplete();
    }

    function acceptAutocompleteItem(item) {
      if (!item) return;
      input.value = item.value;
      input.focus();
      const cursor = input.value.length;
      if (typeof input.setSelectionRange === 'function') input.setSelectionRange(cursor, cursor);
      if (/\s$/.test(item.value)) updateAutocomplete();
      else clearAutocomplete();
    }
    function syncPrompt() {
      prompt.textContent = `bcc:${state.cwd}$`;
      const topic = (runtimeTopicFromPath(state.cwd) || TOPIC_INDEX.byPath.get(state.cwd)) || TOPIC_INDEX.byPath.get('/');
      contextLabel.textContent = `${copy.currentContext}: ${topicLabel(topic, locale)}`;
    }

    function scrollOutput() {
      output.scrollTop = output.scrollHeight;
    }

    function appendTextLine(tone, text) {
      String(text || '')
        .split(/\r?\n/)
        .filter((line) => line !== '')
        .forEach((line) => {
          const entry = document.createElement('div');
          entry.className = `bcc-console-line bcc-console-line--${tone}`;
          const body = document.createElement('span');
          body.className = 'bcc-console-line-text';
          body.textContent = line;
          entry.appendChild(body);
          output.appendChild(entry);
        });
      scrollOutput();
    }

    function appendUserLine(raw) {
      const entry = document.createElement('div');
      entry.className = 'bcc-console-line bcc-console-line--user';

      const prefix = document.createElement('span');
      prefix.className = 'bcc-console-line-prefix';
      prefix.textContent = `bcc:${state.cwd}$`;

      const body = document.createElement('span');
      body.className = 'bcc-console-line-text';
      body.textContent = raw;

      entry.append(prefix, body);
      output.appendChild(entry);
      scrollOutput();
    }

    function printHelp() {
      appendTextLine('system', copy.ready);
      appendTextLine('muted', copy.readySub);
      copy.commands.forEach((line) => appendTextLine('muted', line));
      appendTextLine('muted', copy.examples);
    }

    function printTopicInfo(topic, options = {}) {
      const includeChildren = options.includeChildren !== false;
      const activeTopic = runtimeTopicFromPath(topic.path) || topic;
      appendTextLine('system', `${topicLabel(activeTopic, locale)}  ${activeTopic.path}`);
      const summary = topicSummary(activeTopic, locale);
      if (summary) appendTextLine('muted', summary);
      topicDetailLines(activeTopic).forEach((line) => appendTextLine('muted', line));

      if (includeChildren) {
        const children = getChildTopics(activeTopic);
        if (children.length) {
          appendTextLine('muted', `${copy.includes}: ${children.map((child) => child.id).join('  ')}`);
        }
      }

      appendTextLine('muted', `${copy.opening}: ${topicOpenUrl(activeTopic, locale)}`);
    }

    function listTopic(topic) {
      const children = getChildTopics(topic);
      if (!children.length) {
        appendTextLine('muted', copy.noChildren);
        return;
      }

      children.forEach((child) => {
        appendTextLine('muted', formatTopicListLine(child));
      });
    }

    function searchTopics(query) {
      const needle = normalizeToken(query);
      if (!needle) return [];

      const matches = [];
      const seen = new Set();
      const pushMatch = (topic) => {
        if (!topic || seen.has(topic.path)) return;
        seen.add(topic.path);
        matches.push(topic);
      };

      TOPICS.filter((topic) => topic.id !== 'root').forEach((topic) => {
        const activeTopic = runtimeTopicFromPath(topic.path) || topic;
        const haystack = [
          activeTopic.id,
          activeTopic.path,
          topicLabel(activeTopic, locale),
          topicSummary(activeTopic, locale),
          ...(activeTopic.aliases || []),
          ...(activeTopic.methods || []),
          ...(activeTopic.tags || [])
        ]
          .map((value) => normalizeToken(value))
          .join(' ');

        if (haystack.includes(needle)) pushMatch(activeTopic);
      });

      Array.from(runtimeTopicIndex.byPath.values()).forEach((topic) => {
        const haystack = [
          topic.id,
          topic.path,
          topicLabel(topic, locale),
          topicSummary(topic, locale),
          ...(topic.aliases || []),
          ...(topic.methods || []),
          ...(topic.tags || []),
          topic.bestFor,
          topic.outputs,
          topic.deployment,
          topic.readiness
        ]
          .map((value) => normalizeToken(value))
          .join(' ');

        if (haystack.includes(needle)) pushMatch(topic);
      });

      return matches;
    }

    function openConsole() {
      clearTimeout(state.closeTimer);
      clearTimeout(autocompleteState.blurTimer);
      shell.hidden = false;
      shell.classList.add('is-open');
      state.open = true;
      launch.setAttribute('aria-expanded', 'true');
      launch.setAttribute('title', copy.closeConsole);
      launch.setAttribute('aria-label', copy.closeConsole);

      if (!state.hydrated) {
        output.replaceChildren();
        printHelp();
        printTopicInfo((runtimeTopicFromPath(state.cwd) || TOPIC_INDEX.byPath.get(state.cwd)) || TOPIC_INDEX.byPath.get('/'), { includeChildren: true });
        state.hydrated = true;
      }

      syncPrompt();
      renderQuickbar();
      updateAutocomplete();
      setTimeout(() => input.focus(), 60);
    }

    function closeConsole() {
      clearTimeout(autocompleteState.blurTimer);
      clearAutocomplete();
      shell.classList.remove('is-open');
      state.open = false;
      launch.setAttribute('aria-expanded', 'false');
      launch.setAttribute('title', copy.openConsole);
      launch.setAttribute('aria-label', copy.openConsole);
      state.closeTimer = window.setTimeout(() => {
        shell.hidden = true;
      }, 180);
    }

    function toggleConsole() {
      if (state.open) {
        closeConsole();
      } else {
        openConsole();
      }
    }

    function runCommand(raw) {
      const value = String(raw || '').trim();
      if (!value) return;

      appendUserLine(value);
      state.history.push(value);
      state.history = state.history.slice(-40);
      state.historyIndex = state.history.length;
      renderQuickbar();

      const parts = value.split(/\s+/).filter(Boolean);
      const command = commandAlias(parts[0]);
      const target = parts.slice(1).join(' ').trim();

      if (command === 'help') {
        printHelp();
        return;
      }

      if (command === 'clear') {
        output.replaceChildren();
        renderQuickbar();
        return;
      }

      if (command === 'exit') {
        closeConsole();
        return;
      }

      if (command === 'pwd') {
        appendTextLine('system', state.cwd);
        return;
      }

      if (command === 'ls') {
        const topic = target ? resolveConsoleTopic(target, state.cwd) : (runtimeTopicFromPath(state.cwd) || TOPIC_INDEX.byPath.get(state.cwd));
        if (!topic) {
          appendTextLine('error', copy.notFound);
          return;
        }
        listTopic(topic);
        return;
      }

      if (command === 'cd') {
        const topic = target ? resolveConsoleTopic(target, state.cwd) : TOPIC_INDEX.byPath.get('/');
        if (!topic) {
          appendTextLine('error', copy.notFound);
          return;
        }
        state.cwd = topic.path;
        syncPrompt();
        renderQuickbar();
        appendTextLine('system', `${copy.contextChanged}: ${state.cwd}`);
        const summary = topicSummary(topic, locale);
        if (summary) appendTextLine('muted', summary);
        return;
      }

      if (command === 'info') {
        const topic = target ? resolveConsoleTopic(target, state.cwd) : (runtimeTopicFromPath(state.cwd) || TOPIC_INDEX.byPath.get(state.cwd));
        if (!topic) {
          appendTextLine('error', copy.notFound);
          return;
        }
        printTopicInfo(topic, { includeChildren: true });
        return;
      }

      if (command === 'open') {
        const topic = target ? resolveConsoleTopic(target, state.cwd) : (runtimeTopicFromPath(state.cwd) || TOPIC_INDEX.byPath.get(state.cwd));
        if (!topic) {
          appendTextLine('error', copy.notFound);
          return;
        }
        const nextUrl = topicOpenUrl(topic, locale);
        appendTextLine('muted', `${copy.opening}: ${nextUrl}`);
        window.setTimeout(() => {
          window.location.assign(nextUrl);
        }, 80);
        return;
      }

      if (command === 'find') {
        if (!target) {
          appendTextLine('error', copy.missingTarget);
          return;
        }
        const results = searchTopics(target);
        if (!results.length) {
          appendTextLine('error', copy.notFound);
          return;
        }
        appendTextLine('system', `${copy.results}:`);
        results.slice(0, 8).forEach((topic) => {
          appendTextLine('muted', `${topic.id}    ${topic.path}`);
        });
        return;
      }

      appendTextLine('error', copy.unknownCommand);
      appendTextLine('muted', copy.examples);
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = input.value;
      input.value = '';
      clearAutocomplete();
      runCommand(value);
      window.setTimeout(() => input.focus(), 0);
    });

    input.addEventListener('input', () => {
      state.historyIndex = state.history.length;
      updateAutocomplete();
    });

    input.addEventListener('focus', () => {
      clearTimeout(autocompleteState.blurTimer);
      renderQuickbar();
      updateAutocomplete();
    });

    input.addEventListener('blur', () => {
      clearTimeout(autocompleteState.blurTimer);
      autocompleteState.blurTimer = window.setTimeout(() => {
        clearAutocomplete();
      }, 120);
    });

    input.addEventListener('keydown', (event) => {
      const hasSuggestions = autocompleteState.items.length > 0 && !autocomplete.hidden;

      if (event.key === 'Tab' && hasSuggestions) {
        event.preventDefault();
        acceptAutocompleteItem(autocompleteState.items[Math.max(autocompleteState.index, 0)]);
        return;
      }

      if (event.key === 'ArrowUp') {
        if (hasSuggestions) {
          event.preventDefault();
          autocompleteState.index = autocompleteState.index <= 0 ? autocompleteState.items.length - 1 : autocompleteState.index - 1;
          renderAutocomplete();
          return;
        }
        if (!state.history.length) return;
        event.preventDefault();
        state.historyIndex = Math.max(0, state.historyIndex - 1);
        input.value = state.history[state.historyIndex] || '';
        clearAutocomplete();
      }

      if (event.key === 'ArrowDown') {
        if (hasSuggestions) {
          event.preventDefault();
          autocompleteState.index = autocompleteState.index >= autocompleteState.items.length - 1 ? 0 : autocompleteState.index + 1;
          renderAutocomplete();
          return;
        }
        if (!state.history.length) return;
        event.preventDefault();
        state.historyIndex = Math.min(state.history.length, state.historyIndex + 1);
        input.value = state.historyIndex >= state.history.length ? '' : state.history[state.historyIndex] || '';
        clearAutocomplete();
      }

      if (event.key === 'Escape' && hasSuggestions) {
        event.preventDefault();
        event.stopPropagation();
        clearAutocomplete();
      }
    });

    launch.addEventListener('click', toggleConsole);
    helpButton.addEventListener('click', printHelp);
    closeButton.addEventListener('click', closeConsole);

    document.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openConsole();
      }

      if (event.key === 'Escape' && state.open) {
        closeConsole();
      }
    });

    syncPrompt();
  }

  async function initAccountNav() {
    const navActions = document.querySelector('.nav-actions');
    if (!navActions || navActions.dataset.accountBound === 'true') return;

    const loginLink = Array.from(navActions.querySelectorAll('a')).find((link) => {
      const href = link.getAttribute('href') || '';
      return /(?:^|\/)login\.html(?:$|[?#])/i.test(href);
    });
    if (!loginLink) return;

    try {
      const user = await currentSupabaseUserForNav();
      if (!user) return;

      navActions.dataset.accountBound = 'true';
      const display = user.displayName || user.name || 'Cuenta';
      const role = ({ client: 'Cliente', staff: 'Personal', admin: 'Administrador' })[user.role] || 'Usuario';
      const locale = getLocale();
      const dashboardUrl = dashboardUrlForRole(user.role);

      const menu = document.createElement('div');
      menu.className = 'account-menu';
      menu.innerHTML = `
        <button class="account-trigger" type="button" aria-expanded="false">
          <span class="account-avatar">${escapeHtml(display.trim().charAt(0).toUpperCase() || '?')}</span>
          <span class="account-copy">
            <strong>${escapeHtml(display)}</strong>
            <small>${escapeHtml(role)}</small>
          </span>
        </button>
        <div class="account-dropdown" hidden>
          <a href="${dashboardUrl}">${locale === 'en' ? 'Dashboard' : 'Dashboard'}</a>
          <button type="button" data-public-logout>${locale === 'en' ? 'Log out' : 'Cerrar sesion'}</button>
        </div>
      `;

      loginLink.replaceWith(menu);
      bindAccountMenu(menu);
    } catch (_e) {
      // Static hosting or no account server available: keep the normal login link.
    }
  }

  async function currentSupabaseUserForNav() {
    const config = window.BCC_SUPABASE || {
      url: 'https://bglkyqiqzrcwegpjrucc.supabase.co',
      anonKey: 'sb_publishable_X_3U_TNtC9BuVwc-vMCsug_GVFmI5cQ'
    };

    if (!window.supabase?.createClient) {
      await new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-supabase-js]');
        if (existing) {
          existing.addEventListener('load', resolve, { once: true });
          existing.addEventListener('error', reject, { once: true });
          return;
        }
        const script = document.createElement('script');
        script.dataset.supabaseJs = 'true';
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    const client = window.BCCNavSupabaseClient || window.supabase.createClient(config.url, config.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    window.BCCNavSupabaseClient = client;

    const { data: userData } = await client.auth.getUser();
    if (!userData?.user) return null;

    const { data: profile } = await client
      .from('profiles')
      .select('id, full_name, display_name, role')
      .eq('id', userData.user.id)
      .maybeSingle();

    const fullName = profile?.full_name || userData.user.user_metadata?.full_name || userData.user.email || 'Cuenta';
    const displayName = profile?.display_name || fullName.split(/\s+/)[0] || 'Cuenta';
    const role = profile?.role || 'client';

    return {
      id: userData.user.id,
      name: fullName,
      displayName,
      role
    };
  }

  function dashboardUrlForRole(role) {
    if (role === 'admin') return '/admin-dashboard.html';
    if (role === 'staff') return '/staff-dashboard.html';
    return '/dashboard.html';
  }

  function bindAccountMenu(menu) {
    const trigger = menu.querySelector('.account-trigger');
    const dropdown = menu.querySelector('.account-dropdown');
    if (!trigger || !dropdown) return;

    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      const open = dropdown.hidden;
      dropdown.hidden = !open;
      trigger.setAttribute('aria-expanded', String(open));
    });

    document.addEventListener('click', (event) => {
      if (dropdown.hidden || menu.contains(event.target)) return;
      dropdown.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    });

    menu.querySelector('[data-public-logout]')?.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: '{}'
        });
      } catch (_e) {}
      window.location.assign('/login.html');
    });
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupNav();
    markCurrentPage();
    initConsole();
    initAccountNav();
  });
})();

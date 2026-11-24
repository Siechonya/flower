(() => {
  const PREFS_KEY = 'novel_prefs_v1';
  const PROGRESS_KEY = 'novel_progress_v1';
  const THEMES = ['ivory', 'cocoa', 'night'];
  const THEME_LABELS = { ivory: '晨曦', cocoa: '暖茶', night: '星夜' };

  const state = {
    toc: null,
    currentChapter: null,
    cache: new Map(),
    prefs: {
      theme: 'ivory',
      fontSize: 18,
      fontFamily: 'serif',
      indent: false,
    },
    progress: {
      lastChapter: null,
      scrollRatios: {},
    },
  };

  // DOM References
  const elProgress = document.getElementById('reading-progress');
  const elTopbar = document.getElementById('topbar');
  const elTopbarTitle = document.getElementById('topbar-chapter-title');
  const elHomeView = document.getElementById('home-view');
  const elReaderView = document.getElementById('reader-view');
  const elHomeToc = document.getElementById('home-toc-container');
  const elHeroCta = document.getElementById('hero-primary-cta');
  const elBookEpigraph = document.getElementById('book-epigraph');
  const elHomeThemeBtn = document.getElementById('home-theme-btn');
  const elHomeThemeText = document.getElementById('home-theme-text');

  const elKicker = document.getElementById('chapter-kicker');
  const elHeading = document.getElementById('chapter-heading');
  const elBody = document.getElementById('chapter-body');
  const elFooterNextCard = document.getElementById('footer-next-card');
  const elFooterPrev = document.getElementById('footer-prev');
  const elFooterNext = document.getElementById('footer-next');
  const elFooterToc = document.getElementById('footer-toc');

  const elBtnToc = document.getElementById('btn-toc');
  const elBtnAppearance = document.getElementById('btn-appearance');
  const elBtnThemeToggle = document.getElementById('btn-theme-toggle');
  const elPopover = document.getElementById('appearance-popover');
  const elFontSizeVal = document.getElementById('font-size-val');
  const elBtnIndent = document.getElementById('btn-indent');

  const elDrawer = document.getElementById('toc-drawer');
  const elDrawerBackdrop = document.getElementById('drawer-backdrop');
  const elDrawerList = document.getElementById('drawer-toc-list');
  const elBtnCloseDrawer = document.getElementById('btn-close-drawer');
  const elNavHome = document.getElementById('nav-home');

  function loadStorage() {
    try {
      const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
      if (p.theme && THEMES.includes(p.theme)) state.prefs.theme = p.theme;
      if (typeof p.fontSize === 'number') state.prefs.fontSize = Math.min(24, Math.max(15, p.fontSize));
      if (p.fontFamily === 'sans' || p.fontFamily === 'serif') state.prefs.fontFamily = p.fontFamily;
      if (typeof p.indent === 'boolean') state.prefs.indent = p.indent;
    } catch (_) {}

    try {
      const pr = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
      if (typeof pr.lastChapter === 'number') state.progress.lastChapter = pr.lastChapter;
      if (pr.scrollRatios && typeof pr.scrollRatios === 'object') state.progress.scrollRatios = pr.scrollRatios;
    } catch (_) {}
  }

  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(state.prefs));
    } catch (_) {}
  }

  function saveProgress() {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(state.progress));
    } catch (_) {}
  }

  function applyPrefs() {
    document.documentElement.setAttribute('data-theme', state.prefs.theme);
    document.documentElement.style.setProperty('--reader-size', `${state.prefs.fontSize}px`);
    document.documentElement.style.setProperty(
      '--reader-font',
      state.prefs.fontFamily === 'sans' ? 'var(--font-sans)' : 'var(--font-serif)'
    );
    elBody.classList.toggle('use-indent', state.prefs.indent);
    elFontSizeVal.textContent = String(state.prefs.fontSize);

    document.querySelectorAll('[data-theme-choice]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.themeChoice === state.prefs.theme);
    });
    document.querySelectorAll('[data-font-choice]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.fontChoice === state.prefs.fontFamily);
    });

    elBtnIndent.setAttribute('aria-pressed', String(state.prefs.indent));
    elBtnIndent.textContent = state.prefs.indent ? '开启' : '关闭';

    if (elHomeThemeText) {
      const nextTheme = state.prefs.theme === 'night' ? 'ivory' : 'night';
      elHomeThemeText.textContent = `${THEME_LABELS[nextTheme]}模式`;
    }
  }

  async function fetchToc() {
    if (state.toc) return state.toc;
    const res = await fetch('/data/toc.json');
    if (!res.ok) throw new Error('无法加载目录数据');
    state.toc = await res.json();
    return state.toc;
  }

  async function fetchChapter(num) {
    if (state.cache.has(num)) return state.cache.get(num);
    const res = await fetch(`/data/chapters/${num}.json`);
    if (!res.ok) throw new Error(`第 ${num} 章加载失败`);
    const data = await res.json();
    state.cache.set(num, data);
    return data;
  }

  function prefetchNext(num) {
    if (state.toc && num < state.toc.totalChapters && !state.cache.has(num + 1)) {
      fetchChapter(num + 1).catch(() => {});
    }
  }

  function renderHomeToc() {
    const { stages, chapters, epigraph } = state.toc;
    if (epigraph) elBookEpigraph.textContent = epigraph;

    const last = state.progress.lastChapter;
    if (last && last >= 1 && last <= chapters.length) {
      elHeroCta.href = `?c=${last}`;
      elHeroCta.textContent = `继续阅读 · 第 ${last} 章`;
    } else {
      elHeroCta.href = '?c=1';
      elHeroCta.textContent = '开始阅读';
    }

    const fragment = document.createDocumentFragment();
    stages.forEach((stage) => {
      const group = document.createElement('div');
      group.className = 'stage-group';

      const heading = document.createElement('h2');
      heading.className = 'stage-group-title';
      heading.textContent = stage.name;
      group.appendChild(heading);

      const list = document.createElement('div');
      list.className = 'stage-chapters';

      chapters
        .filter((ch) => ch.stageId === stage.id)
        .forEach((ch) => {
          const link = document.createElement('a');
          link.className = 'toc-row';
          link.href = `?c=${ch.num}`;
          link.dataset.chapterLink = String(ch.num);

          const numSpan = document.createElement('span');
          numSpan.className = 'toc-row-num';
          numSpan.textContent = ch.label;

          const titleSpan = document.createElement('span');
          titleSpan.className = 'toc-row-title';
          titleSpan.textContent = ch.title;

          link.appendChild(numSpan);
          link.appendChild(titleSpan);

          if (last === ch.num) {
            const mark = document.createElement('span');
            mark.className = 'toc-row-mark';
            mark.textContent = '上次读到';
            link.appendChild(mark);
          }

          list.appendChild(link);
        });

      group.appendChild(list);
      fragment.appendChild(group);
    });

    elHomeToc.innerHTML = '';
    elHomeToc.appendChild(fragment);
  }

  function renderDrawerToc(activeNum) {
    const { stages, chapters } = state.toc;
    const fragment = document.createDocumentFragment();

    stages.forEach((stage) => {
      const label = document.createElement('div');
      label.className = 'drawer-stage-label';
      label.textContent = stage.name;
      fragment.appendChild(label);

      chapters
        .filter((ch) => ch.stageId === stage.id)
        .forEach((ch) => {
          const a = document.createElement('a');
          a.className = 'drawer-item';
          if (ch.num === activeNum) a.classList.add('is-active');
          a.href = `?c=${ch.num}`;
          a.dataset.chapterLink = String(ch.num);

          const numSpan = document.createElement('span');
          numSpan.className = 'drawer-item-num';
          numSpan.textContent = ch.label;

          const titleSpan = document.createElement('span');
          titleSpan.className = 'drawer-item-title';
          titleSpan.textContent = ch.title;

          a.appendChild(numSpan);
          a.appendChild(titleSpan);
          fragment.appendChild(a);
        });
    });

    elDrawerList.innerHTML = '';
    elDrawerList.appendChild(fragment);
  }

  function showHome(push = false) {
    closeDrawer();
    closePopover();
    state.currentChapter = null;

    if (push) {
      history.pushState({ view: 'home' }, '', '/');
    }

    document.title = '降临 · 第一卷';
    elTopbar.hidden = true;
    elReaderView.hidden = true;
    elProgress.style.width = '0%';
    renderHomeToc();
    elHomeView.hidden = false;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  async function openChapter(num, { push = false, restoreScroll = false } = {}) {
    closeDrawer();
    closePopover();

    const toc = await fetchToc();
    const safeNum = Math.min(Math.max(1, Number(num) || 1), toc.totalChapters);

    if (push) {
      history.pushState({ view: 'reader', c: safeNum }, '', `?c=${safeNum}`);
    }

    const ch = await fetchChapter(safeNum);
    state.currentChapter = safeNum;
    state.progress.lastChapter = safeNum;
    saveProgress();

    document.title = `${ch.label} ${ch.title} - 降临`;
    elTopbarTitle.textContent = `${ch.label} · ${ch.title}`;
    elKicker.textContent = `第一卷 · ${ch.label}`;
    elHeading.textContent = ch.title;
    elBody.innerHTML = ch.html;

    // Footer Navigation
    if (ch.prev) {
      elFooterPrev.href = `?c=${ch.prev.num}`;
      elFooterPrev.dataset.chapterLink = String(ch.prev.num);
      elFooterPrev.classList.remove('is-disabled');
    } else {
      elFooterPrev.href = '#';
      delete elFooterPrev.dataset.chapterLink;
      elFooterPrev.classList.add('is-disabled');
    }

    if (ch.next) {
      elFooterNext.href = `?c=${ch.next.num}`;
      elFooterNext.dataset.chapterLink = String(ch.next.num);
      elFooterNext.classList.remove('is-disabled');

      elFooterNextCard.innerHTML = `
        <a href="?c=${ch.next.num}" data-chapter-link="${ch.next.num}" class="next-card">
          <span class="next-card-label">下一章 · 第 ${ch.next.num} 章</span>
          <span class="next-card-title">${ch.next.title}</span>
        </a>
      `;
    } else {
      elFooterNext.href = '#';
      delete elFooterNext.dataset.chapterLink;
      elFooterNext.classList.add('is-disabled');

      elFooterNextCard.innerHTML = `
        <div class="end-note">第一卷 · 凡三十章 终</div>
      `;
    }

    elHomeView.hidden = true;
    elReaderView.hidden = false;
    elTopbar.hidden = false;
    elTopbar.classList.remove('is-hidden');
    renderDrawerToc(safeNum);

    if (restoreScroll && state.progress.scrollRatios[safeNum]) {
      requestAnimationFrame(() => {
        const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        window.scrollTo({ top: maxScroll * state.progress.scrollRatios[safeNum], behavior: 'auto' });
        updateScrollProgress();
      });
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' });
      updateScrollProgress();
    }

    prefetchNext(safeNum);
  }

  function openDrawer() {
    closePopover();
    elDrawerBackdrop.hidden = false;
    elDrawer.hidden = false;
    const active = elDrawerList.querySelector('.is-active');
    if (active) {
      active.scrollIntoView({ block: 'center', behavior: 'auto' });
    }
  }

  function closeDrawer() {
    elDrawer.hidden = true;
    elDrawerBackdrop.hidden = true;
  }

  function togglePopover() {
    const willOpen = elPopover.hidden;
    elPopover.hidden = !willOpen;
    elBtnAppearance.setAttribute('aria-expanded', String(willOpen));
  }

  function closePopover() {
    elPopover.hidden = true;
    elBtnAppearance.setAttribute('aria-expanded', 'false');
  }

  let lastScrollY = 0;
  let scrollSaveTimer = null;

  function updateScrollProgress() {
    if (elReaderView.hidden || !state.currentChapter) return;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = docHeight > 0 ? Math.min(1, Math.max(0, window.scrollY / docHeight)) : 0;
    elProgress.style.width = `${(ratio * 100).toFixed(2)}%`;

    clearTimeout(scrollSaveTimer);
    scrollSaveTimer = setTimeout(() => {
      if (state.currentChapter) {
        state.progress.scrollRatios[state.currentChapter] = Number(ratio.toFixed(4));
        saveProgress();
      }
    }, 250);
  }

  window.addEventListener(
    'scroll',
    () => {
      const y = window.scrollY;
      updateScrollProgress();

      if (!elReaderView.hidden) {
        if (y < 64) {
          elTopbar.classList.remove('is-hidden');
        } else if (y > lastScrollY + 12) {
          elTopbar.classList.add('is-hidden');
          closePopover();
        } else if (y < lastScrollY - 12) {
          elTopbar.classList.remove('is-hidden');
        }
      }
      lastScrollY = y;
    },
    { passive: true }
  );

  // Delegate chapter & home link clicks
  document.addEventListener('click', (e) => {
    const chLink = e.target.closest('[data-chapter-link]');
    if (chLink) {
      e.preventDefault();
      const targetNum = Number(chLink.dataset.chapterLink);
      openChapter(targetNum, { push: true });
      return;
    }

    if (
      elPopover &&
      !elPopover.hidden &&
      !e.target.closest('#appearance-popover') &&
      !e.target.closest('#btn-appearance')
    ) {
      closePopover();
    }
  });

  [elNavHome, elFooterToc].forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      showHome(true);
    });
  });

  elBtnToc.addEventListener('click', openDrawer);
  elBtnCloseDrawer.addEventListener('click', closeDrawer);
  elDrawerBackdrop.addEventListener('click', closeDrawer);
  elBtnAppearance.addEventListener('click', togglePopover);

  function toggleDayNight() {
    state.prefs.theme = state.prefs.theme === 'night' ? 'ivory' : 'night';
    applyPrefs();
    savePrefs();
  }

  elBtnThemeToggle.addEventListener('click', toggleDayNight);
  elHomeThemeBtn.addEventListener('click', toggleDayNight);

  document.querySelectorAll('[data-theme-choice]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.prefs.theme = btn.dataset.themeChoice;
      applyPrefs();
      savePrefs();
    });
  });

  document.querySelectorAll('[data-font-choice]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.prefs.fontFamily = btn.dataset.fontChoice;
      applyPrefs();
      savePrefs();
    });
  });

  document.getElementById('font-dec').addEventListener('click', () => {
    state.prefs.fontSize = Math.max(15, state.prefs.fontSize - 1);
    applyPrefs();
    savePrefs();
  });

  document.getElementById('font-inc').addEventListener('click', () => {
    state.prefs.fontSize = Math.min(24, state.prefs.fontSize + 1);
    applyPrefs();
    savePrefs();
  });

  elBtnIndent.addEventListener('click', () => {
    state.prefs.indent = !state.prefs.indent;
    applyPrefs();
    savePrefs();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDrawer();
      closePopover();
      return;
    }
    if (elReaderView.hidden || !elDrawer.hidden) return;
    if (e.key === 'ArrowLeft' && state.currentChapter > 1) {
      openChapter(state.currentChapter - 1, { push: true });
    } else if (e.key === 'ArrowRight' && state.toc && state.currentChapter < state.toc.totalChapters) {
      openChapter(state.currentChapter + 1, { push: true });
    }
  });

  window.addEventListener('popstate', () => {
    routeFromUrl();
  });

  async function routeFromUrl() {
    await fetchToc();
    const params = new URLSearchParams(window.location.search);
    const chParam = params.get('c');
    if (chParam) {
      const num = parseInt(chParam, 10);
      if (!Number.isNaN(num) && num >= 1 && num <= state.toc.totalChapters) {
        await openChapter(num, { push: false, restoreScroll: true });
        return;
      }
    }
    showHome(false);
  }

  async function init() {
    loadStorage();
    applyPrefs();
    await routeFromUrl();
  }

  init().catch((err) => {
    console.error(err);
  });
})();

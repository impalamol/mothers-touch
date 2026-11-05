/* ==========================================================================
   Mother's Touch Academic School — homepage interactions
   Vanilla JS, no dependencies.
   ========================================================================== */
(() => {
  'use strict';

  const doc = document.documentElement;
  const body = document.body;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const desktopMq = window.matchMedia('(min-width: 1024px)');

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  doc.classList.add('js');
  requestAnimationFrame(() => body.classList.add('isLoaded'));

  /* ---------------------------------------------------------------------- *
   * Header: measure top bar, glass on scroll, hide on scroll-down
   * ---------------------------------------------------------------------- */
  const header = $('#siteHeader');
  const topBar = $('.topBar');
  let topBarH = 0;

  const measureTopBar = () => {
    topBarH = topBar ? topBar.offsetHeight : 0;
    doc.style.setProperty('--topBarH', `${topBarH}px`);
  };

  const updateHeader = (y) => {
    const scrolled = y > topBarH + 10;
    header.classList.toggle('isScrolled', scrolled);
    if (!scrolled) header.style.setProperty('inset-block-start', `${Math.max(topBarH - y, 0)}px`);
    else header.style.removeProperty('inset-block-start');
  };

  /* ---------------------------------------------------------------------- *
   * Mobile menu
   * ---------------------------------------------------------------------- */
  const menuBtn = $('.menuToggle');
  const menu = $('#mobileMenu');

  const setMenu = (open) => {
    menu.classList.toggle('isOpen', open);
    menu.setAttribute('aria-hidden', String(!open));
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    body.classList.toggle('menuOpen', open);
  };

  menuBtn?.addEventListener('click', () => setMenu(!menu.classList.contains('isOpen')));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('isOpen')) {
      setMenu(false);
      menuBtn.focus();
    }
  });
  desktopMq.addEventListener('change', (e) => e.matches && setMenu(false));

  /* ---------------------------------------------------------------------- *
   * Split headings into words for the masked word reveal
   * ---------------------------------------------------------------------- */
  const splitWords = (root) => {
    let index = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const parts = child.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(' '));
              return;
            }
            const word = document.createElement('span');
            word.className = 'word';
            const inner = document.createElement('span');
            inner.className = 'wordInner';
            inner.style.setProperty('--w', index++);
            inner.textContent = part;
            word.appendChild(inner);
            frag.appendChild(word);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
          walk(child);
        }
      });
    };
    root.setAttribute('aria-label', root.textContent.trim().replace(/\s+/g, ' '));
    walk(root);
    $$('.word', root).forEach((w) => w.setAttribute('aria-hidden', 'true'));
  };
  if (!reduceMotion) $$('[data-split]').forEach(splitWords);

  /* ---------------------------------------------------------------------- *
   * Scroll reveal + counters (IntersectionObserver)
   * ---------------------------------------------------------------------- */
  $$('[data-delay]').forEach((el) => el.style.setProperty('--delay', `${el.dataset.delay}ms`));

  const animateCount = (el) => {
    const target = parseInt(el.dataset.count, 10) || 0;
    if (reduceMotion) { el.textContent = target; return; }
    const duration = 1600;
    const start = performance.now();
    const tick = (now) => {
      const t = clamp((now - start) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - t, 4);
      el.textContent = Math.round(target * eased);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  // A fully clipped element has no visible area, so clip reveals watch their parent instead.
  const revealTargets = new Map();
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = revealTargets.get(entry.target) || entry.target;
      el.classList.add('isVisible');
      $$('[data-count]', el).forEach(animateCount);
      revealIO.unobserve(entry.target);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

  $$('[data-reveal], [data-split]').forEach((el) => {
    const target = el.dataset.reveal === 'clip' ? el.parentElement : el;
    revealTargets.set(target, el);
    revealIO.observe(target);
  });

  /* ---------------------------------------------------------------------- *
   * Active nav link by section
   * ---------------------------------------------------------------------- */
  const navLinks = $$('.navLink');
  const sectionIO = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const id = entry.target.id;
      navLinks.forEach((l) => l.classList.toggle('isActive', l.getAttribute('href') === `#${id}`));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  navLinks
    .map((l) => $(l.getAttribute('href')))
    .filter(Boolean)
    .forEach((s) => sectionIO.observe(s));

  /* ---------------------------------------------------------------------- *
   * Scroll-driven effects (single rAF loop)
   * ---------------------------------------------------------------------- */
  const parallaxEls = $$('[data-parallax]').map((el) => ({ el, speed: parseFloat(el.dataset.parallax) || 0 }));
  const parallaxImgs = $$('[data-parallax-img]').map((el) => ({ el, speed: parseFloat(el.dataset.parallaxImg) || 0 }));
  const stackCards = $$('.stackCard');
  const progressBar = $('.scrollProgress');
  const toTop = $('.toTop');
  const dock = $('.mobileDock');
  const quick = $('.quickActions');
  const hero = $('.hero');

  const why = $('.whyScroll');
  const whyTrack = $('.whyTrack', why);
  const whyBar = $('.whyProgress', why);
  let whyDistance = 0;

  const setupWhy = () => {
    if (!why) return;
    const pin = desktopMq.matches && !reduceMotion;
    why.classList.toggle('isPinned', pin);
    whyTrack.style.transform = '';
    if (pin) {
      whyDistance = Math.max(whyTrack.scrollWidth - window.innerWidth, 0);
      why.style.height = `${window.innerHeight + whyDistance}px`;
    } else {
      whyDistance = 0;
      why.style.height = '';
    }
  };

  const updateWhy = (vh) => {
    if (!why) return;
    let p;
    if (why.classList.contains('isPinned')) {
      const rect = why.getBoundingClientRect();
      const total = why.offsetHeight - vh;
      p = total > 0 ? clamp(-rect.top / total, 0, 1) : 0;
      whyTrack.style.transform = `translate3d(${-p * whyDistance}px,0,0)`;
    } else {
      const max = whyTrack.scrollWidth - whyTrack.clientWidth;
      p = max > 0 ? whyTrack.scrollLeft / max : 0;
    }
    whyBar.style.setProperty('--whyP', p.toFixed(4));
  };
  whyTrack?.addEventListener('scroll', () => updateWhy(window.innerHeight), { passive: true });

  const update = () => {
    const y = window.scrollY;
    const vh = window.innerHeight;
    const maxScroll = doc.scrollHeight - vh;
    const progress = maxScroll > 0 ? y / maxScroll : 0;

    updateHeader(y);
    progressBar?.style.setProperty('--progress', progress.toFixed(4));
    toTop?.style.setProperty('--progress', progress.toFixed(4));
    toTop?.classList.toggle('isShown', y > vh * 0.8);
    if (dock && hero) {
      const dockOn = y > hero.offsetHeight * 0.5;
      dock.classList.toggle('isShown', dockOn);
      // On mobile the dock already offers Call + WhatsApp, so tuck the floating buttons away
      quick?.classList.toggle('isTucked', dockOn);
    }

    if (!reduceMotion) {
      const factor = window.innerWidth < 768 ? 0.5 : 1;
      // Element parallax — measured against the parent so our own transform doesn't feed back
      parallaxEls.forEach(({ el, speed }) => {
        const rect = el.parentElement.getBoundingClientRect();
        if (rect.bottom < -200 || rect.top > vh + 200) return;
        const offset = (rect.top + rect.height / 2 - vh / 2) * -speed * factor;
        el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
      });

      // Image-in-frame parallax (image is pre-scaled in CSS)
      parallaxImgs.forEach(({ el, speed }) => {
        const rect = el.parentElement.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > vh) return;
        const p = clamp((rect.top + rect.height / 2 - vh / 2) / (vh / 2 + rect.height / 2), -1, 1);
        el.style.transform = `translate3d(0, ${(p * speed * -60).toFixed(2)}%, 0)`;
      });

      // Stacking cards: shrink a card as the next one slides over it
      stackCards.forEach((card, i) => {
        const next = stackCards[i + 1];
        if (!next) return;
        const a = card.getBoundingClientRect();
        const b = next.getBoundingClientRect();
        const covered = 1 - clamp((b.top - a.top) / a.height, 0, 1);
        card.style.setProperty('--scale', (1 - covered * 0.06 * (stackCards.length - i - 1)).toFixed(4));
      });
    }

    updateWhy(vh);
  };

  let ticking = false;
  const requestUpdate = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      update();
      ticking = false;
    });
  };

  const onResize = () => {
    measureTopBar();
    setupWhy();
    requestUpdate();
  };

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', onResize);
  window.addEventListener('load', onResize);
  desktopMq.addEventListener('change', onResize);
  onResize();

  /* ---------------------------------------------------------------------- *
   * Misc
   * ---------------------------------------------------------------------- */
  toTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
})();

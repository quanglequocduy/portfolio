/* Portfolio interactions — reveal on scroll, count-up stats, active nav, mobile menu.
   Degrades gracefully: with JS off, content is fully visible and links work. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- mobile nav toggle ---- */
  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    links.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---- reveal on scroll ---- */
  var revealEls = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* ---- count-up stats ---- */
  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var suffix = el.getAttribute('data-suffix') || '';
    if (reduceMotion || isNaN(target)) { el.textContent = target + suffix; return; }
    var start = null, dur = 1100;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var nums = document.querySelectorAll('.stat .num');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var numObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { countUp(entry.target); numObs.unobserve(entry.target); }
      });
    }, { threshold: 0.6 });
    nums.forEach(function (n) { numObs.observe(n); });
  }

  /* ---- click tracking (GoatCounter events) ----
     Fires an event for any [data-track] element, or for a project card
     (slug derived from its title). No-ops safely if GoatCounter is blocked. */
  function track(path, title) {
    if (window.goatcounter && typeof window.goatcounter.count === 'function') {
      window.goatcounter.count({ path: 'evt-' + path, title: title || path, event: true });
    }
  }
  document.addEventListener('click', function (e) {
    var tagged = e.target.closest('[data-track]');
    if (tagged) { track(tagged.getAttribute('data-track'), tagged.textContent.trim().slice(0, 60)); return; }
    var card = e.target.closest('.project');
    if (card) {
      var h = card.querySelector('h3');
      var title = h ? h.textContent.trim() : 'project';
      var slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      track('proj-' + slug, title);
    }
  });

  /* ---- active nav highlight ---- */
  var sections = ['work', 'skills', 'experience', 'recognition']
    .map(function (id) { return document.getElementById(id); })
    .filter(Boolean);
  var navMap = {};
  document.querySelectorAll('.nav-links a[href^="#"]').forEach(function (a) {
    navMap[a.getAttribute('href').slice(1)] = a;
  });
  if ('IntersectionObserver' in window && sections.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var a = navMap[entry.target.id];
        if (!a) return;
        if (entry.isIntersecting) {
          Object.keys(navMap).forEach(function (k) { navMap[k].classList.remove('active'); });
          a.classList.add('active');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (s) { spy.observe(s); });
  }
})();

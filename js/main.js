/* =========================================================
   STACKLY – main.js  (vanilla JS, no dependencies)
   ========================================================= */
(function () {
  "use strict";

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* enable reveal animations only when JS is available */
  document.documentElement.classList.add("js");

  /* ---------- 1. Mobile navigation ---------- */
  var navToggle = $(".nav-toggle");
  var mobileNav = $(".mobile-nav");
  if (navToggle && mobileNav) {
    navToggle.addEventListener("click", function () {
      var open = mobileNav.classList.toggle("open");
      navToggle.classList.toggle("open", open);
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("click", function (e) {
      if (!mobileNav.contains(e.target) && !navToggle.contains(e.target)) {
        mobileNav.classList.remove("open");
        navToggle.classList.remove("open");
      }
    });
  }

  /* ---------- 2. Sticky header ---------- */
  var header = $(".site-header");
  var topbar = $(".topbar");
  var stickyOn = header && header.hasAttribute("data-sticky");
  if (stickyOn) {
    var topbarH = topbar ? topbar.offsetHeight : 0;
    var placeholder = document.createElement("div");
    placeholder.style.display = "none";
    header.parentNode.insertBefore(placeholder, header.nextSibling);
    var onScroll = function () {
      var y = window.pageYOffset || document.documentElement.scrollTop;
      if (y > topbarH + 40) {
        if (!header.classList.contains("sticky")) {
          placeholder.style.height = header.offsetHeight + "px";
          placeholder.style.display = "block";
          header.classList.add("sticky");
        }
      } else if (header.classList.contains("sticky")) {
        header.classList.remove("sticky");
        placeholder.style.display = "none";
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- 3. FAQ accordion ---------- */
  $$(".faq-item").forEach(function (item) {
    var q = $(".faq-q", item);
    var a = $(".faq-a", item);
    if (!q || !a) return;
    q.addEventListener("click", function () {
      var isOpen = item.classList.contains("active");
      $$(".faq-item").forEach(function (other) {
        other.classList.remove("active");
        var oa = $(".faq-a", other);
        if (oa) oa.style.maxHeight = null;
      });
      if (!isOpen) {
        item.classList.add("active");
        a.style.maxHeight = a.scrollHeight + "px";
      }
    });
  });
  var firstFaq = $(".faq-item.active .faq-a");
  if (firstFaq) firstFaq.style.maxHeight = firstFaq.scrollHeight + "px";
  window.addEventListener("resize", function () {
    var open = $(".faq-item.active .faq-a");
    if (open) open.style.maxHeight = open.scrollHeight + "px";
  });

  /* ---------- 4. About page tabs ---------- */
  var tabs = $$(".tab");
  if (tabs.length) {
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        tabs.forEach(function (t) { t.classList.remove("active"); });
        tab.classList.add("active");
        $$(".tab-panel").forEach(function (p) { p.classList.remove("active"); });
        var panel = $("#" + tab.getAttribute("data-tab"));
        if (panel) panel.classList.add("active");
      });
    });
  }

  /* ---------- 5. Counters ---------- */
  function animateCount(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    var decimals = (el.getAttribute("data-count").split(".")[1] || "").length;
    var suffix = el.getAttribute("data-suffix") || "";
    var finish = function () { el.textContent = target.toFixed(decimals) + suffix; };
    if (document.hidden) { finish(); return; } /* background tab: show final value */
    var start = null;
    var dur = 1600;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * eased).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---------- 6. Scroll reveal + triggered animations ---------- */
  var revealables = $$(".reveal");
  var counters = $$("[data-count]");
  var bars = $$(".bar i");
  var activate = function (el) {
    if (el.dataset.activated) return;
    el.dataset.activated = "1";
    if (el.classList.contains("reveal")) el.classList.add("in");
    if (el.hasAttribute("data-count")) animateCount(el);
    if (el.classList.contains("bar-fill")) el.style.width = el.getAttribute("data-val") + "%";
    if (el.classList.contains("gauge")) {
      var circle = $(".val", el);
      if (circle) {
        var pct = parseFloat(el.getAttribute("data-pct") || "64");
        circle.style.strokeDashoffset = String(352 - (352 * pct) / 100);
      }
    }
  };

  var pending = revealables.concat(counters, bars, $$(".gauge"));
  var sweep = function () {
    var vh = window.innerHeight || document.documentElement.clientHeight;
    pending = pending.filter(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < vh + 120) { activate(el); return false; }
      return true;
    });
    if (!pending.length) clearInterval(sweepTimer);
  };

  /* IntersectionObserver (fast path) + timer sweep fallback so that content is
     always revealed even in background tabs, print and screenshot tools. */
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { activate(entry.target); io.unobserve(entry.target); }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -60px 0px" });
    revealables.forEach(function (el) { io.observe(el); });
    counters.forEach(function (el) { io.observe(el); });
    bars.forEach(function (el) { io.observe(el); });
    $$(".gauge").forEach(function (el) { io.observe(el); });
  }
  /* cascading delay: cards in the same row / block rise one after another */
  revealables.forEach(function (el) {
    var p = el.parentElement;
    var idx = p ? Array.prototype.indexOf.call(p.children, el) : 0;
    el.style.transitionDelay = Math.min(idx, 6) * 85 + "ms";
  });
  var sweepTimer = setInterval(sweep, 700);
  setTimeout(sweep, 400);
  window.addEventListener("scroll", sweep, { passive: true });
  window.addEventListener("resize", sweep);
  window.addEventListener("load", sweep);

  /* ---------- 7. Testimonials slider ---------- */
  var slider = $("[data-slider]");
  if (slider) {
    var track = $(".testi-track", slider);
    var pages = $$(".testi-page", track);
    var dotsWrap = $(".dots", slider);
    var index = 0;
    pages.forEach(function (_, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", "Testimonial group " + (i + 1));
      if (i === 0) b.classList.add("active");
      b.addEventListener("click", function () { go(i); });
      dotsWrap.appendChild(b);
    });
    var dots = $$("button", dotsWrap);
    function go(i) {
      index = i;
      track.style.transform = "translateX(-" + i * 100 + "%)";
      dots.forEach(function (d, di) { d.classList.toggle("active", di === i); });
    }
    var auto = setInterval(function () { go((index + 1) % pages.length); }, 6000);
    slider.addEventListener("mouseenter", function () { clearInterval(auto); });
  }

  /* ---------- 8. Newsletter + contact forms ---------- */
  $$("form[data-validate]").forEach(function (form) {
    var findMsg = function () {
      return $(".form-msg", form) || $(".form-note", form) ||
        (form.parentElement && form.parentElement.querySelector(".form-msg, .form-note"));
    };
    var firstMsg = findMsg();
    var original = firstMsg ? firstMsg.textContent : "";

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ok = true;
      var badEmail = false;
      $$('[required], input[type="email"]', form).forEach(function (input) {
        var field = input.closest(".field");
        var valid = input.value.trim() !== "" &&
          (input.type !== "email" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim()));
        if (field) field.classList.toggle("invalid", !valid);
        if (!valid) { ok = false; if (input.type === "email") badEmail = true; }
      });

      var msg = findMsg();
      if (ok) {
        if (msg) {
          msg.classList.remove("error");
          if (original) msg.textContent = original;
          msg.style.display = "block";
        }
        form.reset();
      } else if (msg && msg.classList.contains("form-msg")) {
        msg.textContent = badEmail
          ? "Please enter a valid email address."
          : "Please fill in all the required fields.";
        msg.classList.add("error");
        msg.style.display = "block";
      }
      if (msg) {
        setTimeout(function () {
          msg.style.display = "none";
          msg.classList.remove("error");
          if (original) msg.textContent = original;
        }, 6000);
      }
    });
    $$("input,textarea", form).forEach(function (i) {
      i.addEventListener("input", function () {
        var f = i.closest(".field");
        if (f) f.classList.remove("invalid");
      });
    });
  });

  /* ---------- 9. Copyright year ---------- */
  $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- 10. Current page menu highlight ---------- */
  var here = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  $$(".main-menu > li > a, .mobile-nav a").forEach(function (a) {
    var href = (a.getAttribute("href") || "").split("/").pop().toLowerCase();
    if (href === here) {
      var li = a.closest("li");
      if (li) li.classList.add("active");
    }
  });

  /* ---------- 11. Preloader (loading screen on every page + navigation) ---------- */
  var pre = document.getElementById("preloader");
  if (pre) {
    var t0 = Date.now(), hidden = false;
    var hidePre = function () {
      if (hidden) return;
      hidden = true;
      pre.classList.add("done");
      setTimeout(function () { pre.classList.add("gone"); }, 950);
    };
    var schedule = function () {
      setTimeout(hidePre, Math.max(0, 1200 - (Date.now() - t0)) + 250);
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule);
    setTimeout(hidePre, 4000); /* absolute failsafe */

    /* slide the loader back in before moving to another page */
    document.addEventListener("click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (!a || a.target === "_blank" || a.hasAttribute("download") || a.hasAttribute("data-no-loader")) return;
      var href = a.getAttribute("href") || "";
      if (!href || href.charAt(0) === "#" || /^(mailto:|tel:|javascript:|data:)/i.test(href)) return;
      if (/^(https?:)?\/\//i.test(href)) return; /* external links keep their own behaviour */
      e.preventDefault();
      pre.style.animation = "none";
      pre.classList.remove("gone", "done");
      pre.classList.add("fast");
      setTimeout(function () { location.href = href; }, 430);
    });
  }

  /* ---------- 12. Scroll progress bar ---------- */
  var progress = document.createElement("div");
  progress.className = "scroll-progress";
  progress.setAttribute("aria-hidden", "true");
  document.body.appendChild(progress);
  var updateProgress = function () {
    var d = document.documentElement;
    var max = (d.scrollHeight - d.clientHeight) || 1;
    var pct = ((d.scrollTop || window.pageYOffset || 0) / max) * 100;
    progress.style.width = Math.max(0, Math.min(100, pct)) + "%";
  };
  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", updateProgress);
  updateProgress();

  /* ---------- 13. Signed-in state: Login becomes the user name ---------- */
  try {
    /* verified session (signed record) — a hand-edited localStorage
       session is discarded instead of trusted */
    var sess = window.StacklySec
      ? window.StacklySec.readSession()
      : JSON.parse(localStorage.getItem("stackly_session") || "null");
    if (sess && sess.name) {
      var target = sess.role === "admin" ? "dashboard-admin.html" : "dashboard-user.html";
      var label = String(sess.name).trim().split(/\s+/)[0];
      $$('.main-menu a[href="login.html"], .mobile-nav a[href="login.html"]').forEach(function (a) {
        a.setAttribute("href", target);
        a.textContent = label;
        a.classList.add("nav-user");
      });
    }
  } catch (e) {}
})();

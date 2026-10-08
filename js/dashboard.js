/* =========================================================
   Stackly – shared dashboard logic (admin + user dashboards)
   Vanilla JS. Auth guard + panel navigation + panel actions.
   ========================================================= */
(function () {
  'use strict';

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* ---------------- toast ---------------- */
  function toast(msg) {
    var wrap = document.getElementById('ui-toasts');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'ui-toasts';
      wrap.className = 'ui-toast-wrap';
      document.body.appendChild(wrap);
    }
    var t = document.createElement('div');
    t.className = 'ui-toast';
    t.setAttribute('role', 'status');
    t.textContent = msg;
    wrap.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('is-in'); });
    setTimeout(function () {
      t.classList.remove('is-in');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 320);
    }, 2600);
  }

  /* ---------------- session ---------------- */
  function getSession() {
    try {
      var s = JSON.parse(localStorage.getItem('stackly_session'));
      if (!s || typeof s !== 'object' || !s.email) return null;
      return s;
    } catch (e) { return null; }
  }
  function clearSession() {
    try { localStorage.removeItem('stackly_session'); } catch (e) {}
  }
  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  /* ---------------- identity ---------------- */
  function fillIdentity(session) {
    var roleLabel = session.role === 'admin' ? 'Admin' : 'User';
    $$('.js-name').forEach(function (el) { el.textContent = session.name || 'Guest'; });
    $$('.js-email').forEach(function (el) { el.textContent = session.email || ''; });
    $$('.js-role').forEach(function (el) { el.textContent = roleLabel; });
    $$('.js-avatar').forEach(function (el) {
      el.textContent = initials(session.name || session.email);
      el.setAttribute('aria-hidden', 'true');
    });
  }

  /* ---------------- navigation ---------------- */
  function initNav() {
    var dash = $('#dash');
    var burger = $('.dash-burger');
    var scrim = $('.dash-scrim');

    function setDrawer(open) {
      if (!dash || !burger) return;
      dash.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.classList.toggle('dash-lock', open);
    }

    if (burger) {
      burger.addEventListener('click', function () {
        setDrawer(!dash.classList.contains('open'));
      });
    }
    if (scrim) scrim.addEventListener('click', function () { setDrawer(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && dash && dash.classList.contains('open')) setDrawer(false);
    });

    /* menu → panel */
    $$('.dash-item[data-panel]').forEach(function (item) {
      item.addEventListener('click', function () {
        var key = item.getAttribute('data-panel');
        $$('.dash-item[data-panel]').forEach(function (i) {
          var on = i === item;
          i.classList.toggle('is-active', on);
          if (on) i.setAttribute('aria-current', 'page');
          else i.removeAttribute('aria-current');
        });
        var target = null;
        $$('.panel').forEach(function (p) {
          var on = p.getAttribute('data-panel') === key;
          p.classList.toggle('active', on);
          if (on) target = p;
        });
        if (target) {
          var title = $('#dash-title');
          if (title) title.textContent = target.getAttribute('data-title') || 'Dashboard';
          document.title = (target.getAttribute('data-title') || 'Dashboard') + ' · Stackly';
        }
        setDrawer(false);
        var main = $('.dash-content');
        if (main) main.scrollTop = 0;
        window.scrollTo(0, 0);
      });
    });

    /* logout */
    $$('#logout-btn, [data-logout]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        clearSession();
        location.replace('login.html');
      });
    });
  }

  /* ---------------- generic search (filters rows in active panel) ---------------- */
  function initSearch() {
    $$('[data-row-filter]').forEach(function (input) {
      input.addEventListener('input', function () {
        var q = input.value.trim().toLowerCase();
        var scope = input.getAttribute('data-row-filter') === 'page'
          ? document
          : (input.closest('.panel') || document);
        $$('tbody tr', scope).forEach(function (row) {
          row.hidden = q ? row.textContent.toLowerCase().indexOf(q) === -1 : false;
        });
      });
    });
  }

  /* ---------------- panel actions ---------------- */
  function addUserRow(form) {
    var nameInput = form.querySelector('[name="nu-name"]');
    var emailInput = form.querySelector('[name="nu-email"]');
    var roleInput = form.querySelector('input[name="nu-role"]:checked');
    var name = nameInput.value.trim();
    var email = emailInput.value.trim();
    if (name.length < 2) { nameInput.focus(); toast('Enter a name (2+ characters)'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { emailInput.focus(); toast('Enter a valid email'); return; }

    var table = $('#users-table');
    if (!table) return;
    var tbody = table.querySelector('tbody');
    var tr = document.createElement('tr');
    tr.setAttribute('data-user', '');
    tr.innerHTML =
      '<td><span class="av av-accent">' + initials(name) + '</span></td>' +
      '<td><b class="cell-strong"></b></td>' +
      '<td class="cell-mute"></td>' +
      '<td><span class="tag ' + (roleInput && roleInput.value === 'admin' ? 'tag-indigo' : 'tag-grey') + '">' +
        (roleInput && roleInput.value === 'admin' ? 'Admin' : 'User') + '</span></td>' +
      '<td><span class="tag tag-green js-status">Active</span></td>' +
      '<td><span class="cell-actions">' +
        '<button type="button" class="ui-act" data-act="block">Block</button>' +
        '<button type="button" class="ui-act ui-act-danger" data-act="delete">Delete</button>' +
      '</span></td>';
    tr.querySelector('.cell-strong').textContent = name;
    tr.querySelector('.cell-mute').textContent = email;
    tbody.insertBefore(tr, tbody.firstChild);
    form.reset();
    toast('User added: ' + name);
  }

  function addTicket(form) {
    var subject = form.querySelector('[name="tk-subject"]');
    var message = form.querySelector('[name="tk-message"]');
    var list = $('#ticket-list');
    var sVal = subject.value.trim();
    var mVal = message.value.trim();
    if (sVal.length < 3) { subject.focus(); toast('Add a ticket subject'); return; }
    if (mVal.length < 5) { message.focus(); toast('Describe the issue a little more'); return; }

    var num = 'TKT-' + (1040 + $$('#ticket-list .tk-id').length + 1);
    var today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    var row = document.createElement('div');
    row.className = 'tk-row';
    row.innerHTML =
      '<span class="tk-id"></span>' +
      '<div class="tk-body"><b class="tk-sub"></b><p class="tk-prev"></p></div>' +
      '<span class="tag tag-amber">Open</span>' +
      '<span class="tk-date"></span>';
    row.querySelector('.tk-id').textContent = num;
    row.querySelector('.tk-sub').textContent = sVal;
    row.querySelector('.tk-prev').textContent = mVal;
    row.querySelector('.tk-date').textContent = today;
    list.insertBefore(row, list.firstChild);

    form.reset();
    toast('Ticket ' + num + ' created');
  }

  function initActions() {
    /* delegated clicks */
    document.addEventListener('click', function (e) {
      var el = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!el) return;
      /* submit buttons inside a handled form are covered by the submit handler */
      if (el.type === 'submit' && el.form && el.form.hasAttribute('data-act')) return;
      var act = el.getAttribute('data-act');

      if (act === 'block') {
        var row = el.closest('tr');
        var status = row && row.querySelector('.js-status');
        if (!status) return;
        var blocked = status.classList.contains('tag-red');
        status.textContent = blocked ? 'Active' : 'Blocked';
        status.classList.toggle('tag-red', !blocked);
        status.classList.toggle('tag-green', blocked);
        el.textContent = blocked ? 'Block' : 'Unblock';
        toast('User ' + (blocked ? 'unblocked' : 'blocked'));
      }

      else if (act === 'delete') {
        var tr = el.closest('tr');
        if (!tr) return;
        var who = tr.querySelector('.cell-strong');
        tr.parentNode.removeChild(tr);
        toast('Deleted ' + (who ? who.textContent : 'user'));
      }

      else if (act === 'add-user-toggle') {
        var box = $('#add-user-form');
        if (!box) return;
        var shown = box.hidden;
        box.hidden = !shown;
        el.setAttribute('aria-expanded', shown ? 'true' : 'false');
        if (shown) {
          var first = box.querySelector('input');
          if (first) first.focus();
        }
      }

      else if (act === 'edit') {
        toast('Editing “' + (el.getAttribute('data-name') || 'item') + '” — demo mode');
      }

      else if (act === 'toggle-status') {
        var next = el.getAttribute('aria-checked') !== 'true';
        el.setAttribute('aria-checked', next ? 'true' : 'false');
        el.classList.toggle('is-off', !next);
        var onText = el.getAttribute('data-on') || 'Live';
        var offText = el.getAttribute('data-off') || (onText === 'On' ? 'Off' : 'Draft');
        var lbl = el.querySelector('.sw-label');
        if (lbl) lbl.textContent = next ? onText : offText;
        toast((el.getAttribute('data-name') || 'Item') + ' → ' + (next ? onText : offText));
      }

      else if (act === 'reply') {
        toast('Reply window opened for ' + (el.getAttribute('data-name') || 'enquiry'));
        var enq = el.closest('.enq-row');
        if (enq) enq.classList.add('is-read');
      }

      else if (act === 'mark-read') {
        var r = el.closest('.enq-row');
        if (!r) return;
        r.classList.add('is-read');
        el.textContent = 'Read';
        el.disabled = true;
        toast('Marked as read');
      }

      else if (act === 'download') {
        toast(el.getAttribute('data-msg') || 'Download started');
      }

      else if (act === 'renew') {
        toast((el.getAttribute('data-name') || 'Service') + ' renewal requested');
      }

      else if (act === 'save') {
        toast(el.getAttribute('data-msg') || 'Saved');
      }
    });

    /* delegated submits */
    document.addEventListener('submit', function (e) {
      var form = e.target;
      if (!form.hasAttribute || !form.hasAttribute('data-act')) return;
      e.preventDefault();
      var kind = form.getAttribute('data-act');
      if (kind === 'add-user') addUserRow(form);
      else if (kind === 'new-ticket') addTicket(form);
      else toast(form.getAttribute('data-msg') || 'Saved');
    });
  }

  /* ---------------- boot ---------------- */
  document.addEventListener('DOMContentLoaded', function () {
    var session = getSession();

    if (!session) {
      location.replace('login.html');
      return;
    }

    var page = document.body.getAttribute('data-page'); /* "admin" | "user" */
    if (page === 'admin' && session.role !== 'admin') {
      location.replace(session.role === 'admin' ? 'dashboard-admin.html' : 'dashboard-user.html');
      return;
    }
    if (page === 'user' && session.role === 'admin') {
      location.replace('dashboard-admin.html');
      return;
    }

    fillIdentity(session);
    initNav();
    initSearch();
    initActions();
  });
})();

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
    /* ITS-003: only a signed, cross-checked session is trusted.
       Editing role/email in dev-tools breaks the signature, so the
       record is discarded instead of authorising the dashboard. */
    if (window.StacklySec) return window.StacklySec.readSession();
    try {
      var s = JSON.parse(localStorage.getItem('stackly_session'));
      if (!s || typeof s !== 'object' || !s.email) return null;
      return s;
    } catch (e) { return null; }
  }
  function clearSession() {
    if (window.StacklySec) { window.StacklySec.clearSession(); return; }
    try { localStorage.removeItem('stackly_session'); } catch (e) {}
  }
  function secRead(key, fallback) {
    if (window.StacklySec) return window.StacklySec.readJSON(key, fallback);
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function secWrite(key, value) {
    if (window.StacklySec) return window.StacklySec.writeJSON(key, value);
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
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

  /* =========================================================
     ITS-004 — actions that really do what the label says
     ========================================================= */
  function pageKey() {
    return (document.body.getAttribute('data-page') || 'dash') + ':';
  }

  function cleanText(el) {
    var clone = el.cloneNode(true);
    Array.prototype.forEach.call(clone.querySelectorAll('button,svg,input,script'), function (n) {
      if (n.parentNode) n.parentNode.removeChild(n);
    });
    /* separate abutting nodes with a space: "Renews on" + <b>13 Nov</b> */
    (function separate(node) {
      var kids = Array.prototype.slice.call(node.childNodes);
      for (var i = 0; i < kids.length; i++) {
        var cur = kids[i];
        if (cur.nodeType === 1) separate(cur);
        if (i === 0) continue;
        var prev = kids[i - 1];
        if (cur.nodeType !== 1 && cur.nodeType !== 3) continue;
        var noGap = prev.nodeType === 1 ||
          (prev.nodeType === 3 && prev.nodeValue !== '' && !/\s$/.test(prev.nodeValue));
        if (noGap) node.insertBefore(document.createTextNode(' '), cur);
      }
    })(clone);
    return clone.textContent.replace(/\s+/g, ' ').trim();
  }

  function saveFile(filename, text, mime) {
    try {
      var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        if (a.parentNode) a.parentNode.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1500);
      return true;
    } catch (e) {
      return false;
    }
  }

  function slug(text) {
    return String(text || '')
      .replace(/\(.*?\)/g, ' ')
      .replace(/exported as csv|downloaded/gi, ' ')
      .replace(/&/g, ' and ')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'stackly-download';
  }

  function titleFrom(text) {
    return String(text || 'Download')
      .replace(/\(.*?\)/g, ' ')
      .replace(/exported as csv|downloaded/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Download';
  }

  function ascii(text) {
    return String(text)
      .replace(/[\u20b9\u20a8]/g, 'Rs ')
      .replace(/\u20ac/g, 'EUR ')
      .replace(/\u00a3/g, 'GBP ')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/\u2026/g, '...')
      .replace(/\u00b7/g, '-')
      .replace(/\u00d7/g, 'x')
      .replace(/[^\u0020-\u007e]/g, '?');
  }

  function pdfEscape(s) {
    return String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  function wrapText(text, max) {
    var words = String(text).split(' ');
    var lines = [];
    var line = '';
    for (var i = 0; i < words.length; i++) {
      var candidate = line ? line + ' ' + words[i] : words[i];
      if (candidate.length <= max) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = words[i];
      }
      while (line.length > max) {
        lines.push(line.slice(0, max));
        line = line.slice(max);
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  /* minimal but valid single-page PDF (Helvetica, 10pt) */
  function buildPDF(title, lines) {
    var content = 'BT /F1 16 Tf 56 788 Td (' + pdfEscape(ascii(title)) + ') Tj ET\n';
    content += '0.6 w 56 776 m 539 776 l S\n';
    content += 'BT /F1 10 Tf 56 754 Td 14 TL\n';
    var body = [];
    for (var i = 0; i < lines.length && body.length < 44; i++) {
      var wrapped = wrapText(ascii(lines[i]), 92);
      for (var j = 0; j < wrapped.length && body.length < 44; j++) body.push(wrapped[j]);
    }
    for (i = 0; i < body.length; i++) content += '(' + pdfEscape(body[i]) + ') Tj T*\n';
    content += 'ET\n';
    content += 'BT /F1 8.5 Tf 56 40 Td (' + pdfEscape('Generated by Stackly IT Services dashboard') + ') Tj ET\n';

    var objects = [
      null,
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
      '<< /Length ' + content.length + ' >>\nstream\n' + content + 'endstream',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
    ];

    var pdf = '%PDF-1.4\n';
    var offsets = [];
    for (var n = 1; n < objects.length; n++) {
      offsets[n] = pdf.length;
      pdf += n + ' 0 obj\n' + objects[n] + '\nendobj\n';
    }
    var xref = pdf.length;
    pdf += 'xref\n0 ' + objects.length + '\n0000000000 65535 f \n';
    for (n = 1; n < objects.length; n++) {
      pdf += ('0000000000' + offsets[n]).slice(-10) + ' 00000 n \n';
    }
    pdf += 'trailer\n<< /Size ' + objects.length + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';
    return pdf;
  }

  function csvCell(value) {
    var v = String(value === null || typeof value === 'undefined' ? '' : value);
    return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }

  function tableToCSV(table) {
    var out = [];
    Array.prototype.forEach.call(table.querySelectorAll('tr'), function (tr) {
      var cells = tr.querySelectorAll('th,td');
      if (!cells.length) return;
      var vals = [];
      Array.prototype.forEach.call(cells, function (c) { vals.push(csvCell(cleanText(c))); });
      out.push(vals.join(','));
    });
    return out.join('\r\n');
  }

  function tableToLines(table, limit) {
    var lines = [];
    Array.prototype.forEach.call(table.querySelectorAll('tr'), function (tr, i) {
      if (limit && i >= limit) return;
      var cells = tr.querySelectorAll('th,td');
      var vals = [];
      Array.prototype.forEach.call(cells, function (c) { vals.push(cleanText(c)); });
      if (vals.length) lines.push(vals.join(' | '));
    });
    return lines;
  }

  function contextLines(el) {
    var card = el.closest('.svc-card');
    if (card) {
      var cardLines = [];
      var svc = card.querySelector('.svc-name b');
      if (svc) cardLines.push('Service: ' + cleanText(svc));
      var sub = card.querySelector('.svc-name small');
      if (sub) cardLines.push(cleanText(sub));
      Array.prototype.forEach.call(card.querySelectorAll('.svc-meta span'), function (s) {
        cardLines.push(cleanText(s));
      });
      var tag = card.querySelector('.tag');
      if (tag) cardLines.push('Status: ' + cleanText(tag));
      return cardLines.length ? cardLines : ['Prepared for your Stackly account.'];
    }

    var panel = el.closest('.panel') || document.querySelector('.panel.active') || document.querySelector('.panel');
    var lines = [];
    if (panel) {
      var head = panel.querySelector('.panel-head h2, h2, h3');
      if (head) lines.push('Section: ' + cleanText(head));
      Array.prototype.forEach.call(panel.querySelectorAll('.stat-card'), function (sc) {
        var v = sc.querySelector('.stat-val');
        var l = sc.querySelector('.stat-lbl');
        if (v && l) lines.push(cleanText(l) + ': ' + cleanText(v));
      });
      Array.prototype.forEach.call(panel.querySelectorAll('.prog-top'), function (p) {
        lines.push(cleanText(p));
      });
      var table = panel.querySelector('table');
      if (table) lines = lines.concat(tableToLines(table, 25));
    }
    if (!lines.length) lines.push('Report generated from the Stackly dashboard.');
    return lines;
  }

  function doDownload(el) {
    var msg = el.getAttribute('data-msg') || '';
    var table = el.closest('table');
    if (!table) {
      /* export buttons usually sit in the card-head above the table */
      var scope = el.closest('.card') || el.closest('.panel') || el.parentElement;
      table = scope && scope.querySelector ? scope.querySelector('table') : null;
    }
    var wantCSV = /csv|export/i.test(msg + ' ' + el.textContent);
    var filename = slug(msg || el.textContent);
    var ok;

    if (table && wantCSV) {
      ok = saveFile(filename + '.csv', '\ufeff' + tableToCSV(table), 'text/csv;charset=utf-8');
      toast(ok ? 'Downloaded ' + filename + '.csv' : 'Download failed — please retry');
      return;
    }

    var lines;
    var row = el.closest('tr');
    if (table && row) {
      var heads = table.querySelectorAll('thead th');
      lines = [];
      Array.prototype.forEach.call(row.cells, function (cell, i) {
        var label = heads[i] ? cleanText(heads[i]) : 'Column ' + (i + 1);
        lines.push(label + ': ' + cleanText(cell));
      });
    } else {
      lines = contextLines(el);
    }

    ok = saveFile(filename + '.pdf', buildPDF(titleFrom(msg || filename), lines), 'application/pdf');
    toast(ok ? 'Downloaded ' + filename + '.pdf' : 'Download failed — please retry');
  }

  function formatDate(date) {
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return ('0' + date.getDate()).slice(-2) + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
  }

  function cardIndex(card) {
    var all = $$('.svc-card');
    var i = all.indexOf(card);
    return i < 0 ? 0 : i;
  }

  function setRenewDate(card, text) {
    var spans = card.querySelectorAll('.svc-meta span');
    for (var i = 0; i < spans.length; i++) {
      if (/renews|paused|expires|valid/i.test(spans[i].textContent)) {
        var b = spans[i].querySelector('b');
        if (b) b.textContent = text;
        var nodes = spans[i].childNodes;
        for (var n = 0; n < nodes.length; n++) {
          if (nodes[n].nodeType === 3 && nodes[n].nodeValue.replace(/\s+/g, ' ').trim()) {
            nodes[n].nodeValue = 'Renews on';
            break;
          }
        }
        return;
      }
    }
    if (spans[0]) {
      var bb = spans[0].querySelector('b');
      if (bb) bb.textContent = text;
    }
  }

  function doRenew(el) {
    var card = el.closest('.svc-card');
    var name = el.getAttribute('data-name') || 'Service';
    var now = new Date();
    var next = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    var text = formatDate(next);

    if (card) {
      setRenewDate(card, text);
      var tag = card.querySelector('.tag');
      if (tag) {
        tag.className = 'tag tag-green';
        tag.textContent = 'Active';
      }
      var store = secRead('stackly_renewals', {}) || {};
      store[pageKey() + cardIndex(card)] = text;
      secWrite('stackly_renewals', store);
    }

    el.textContent = 'Renewed';
    el.disabled = true;
    toast(name + ' renewed — next billing ' + text);
  }

  function restoreServices() {
    var renewals = secRead('stackly_renewals', {}) || {};
    var names = secRead('stackly_svc_names', {}) || {};

    $$('.svc-card').forEach(function (card, idx) {
      var storedName = names[pageKey() + idx];
      if (storedName) {
        var nameEl = card.querySelector('.svc-name b');
        if (nameEl) nameEl.textContent = storedName;
        var editBtn = card.querySelector('[data-act="edit"]');
        if (editBtn) editBtn.setAttribute('data-name', storedName);
        var sw = card.querySelector('[data-act="toggle-status"]');
        if (sw) sw.setAttribute('data-name', storedName);
      }

      var storedDate = renewals[pageKey() + idx];
      if (storedDate) {
        setRenewDate(card, storedDate);
        var tag = card.querySelector('.tag');
        if (tag) {
          tag.className = 'tag tag-green';
          tag.textContent = 'Active';
        }
        var renewBtn = card.querySelector('[data-act="renew"]');
        if (renewBtn) {
          renewBtn.textContent = 'Renewed';
          renewBtn.disabled = true;
        }
      }
    });
  }

  function toggleEdit(el) {
    var card = el.closest('.svc-card');
    var nameEl = card ? card.querySelector('.svc-name b') : null;
    if (!card || !nameEl) {
      toast('Nothing to edit here');
      return;
    }

    if (el.getAttribute('data-editing') === '1') {
      var value = nameEl.textContent.replace(/\s+/g, ' ').trim();
      if (value.length < 2) {
        nameEl.focus();
        toast('Name must be at least 2 characters');
        return;
      }
      nameEl.contentEditable = 'false';
      nameEl.classList.remove('is-editing');
      el.removeAttribute('data-editing');
      el.textContent = 'Edit';
      el.setAttribute('data-name', value);
      var sw = card.querySelector('[data-act="toggle-status"]');
      if (sw) sw.setAttribute('data-name', value);

      var store = secRead('stackly_svc_names', {}) || {};
      store[pageKey() + cardIndex(card)] = value;
      secWrite('stackly_svc_names', store);
      toast('Saved — ' + value);
    } else {
      nameEl.contentEditable = 'true';
      nameEl.classList.add('is-editing');
      el.setAttribute('data-editing', '1');
      el.textContent = 'Save';
      var placeCaret = function () {
        nameEl.focus();
        try {
          var range = document.createRange();
          range.selectNodeContents(nameEl);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        } catch (e) {}
      };
      placeCaret();
      setTimeout(placeCaret, 0); /* button keeps focus until the click default settles */
      toast('Editing “' + (el.getAttribute('data-name') || 'service') + '” — press Save to apply');
    }
  }

  function saveForm(form, kind) {
    var data = {};
    $$('input[name], textarea[name], select[name]', form).forEach(function (field) {
      if (field.type === 'checkbox' || field.type === 'radio') {
        if (field.checked) data[field.name] = field.value;
      } else {
        data[field.name] = field.value;
      }
    });

    var store = secRead('stackly_form_data', {}) || {};
    store[pageKey() + kind] = data;
    secWrite('stackly_form_data', store);

    /* a profile name change is written back to the session + identity */
    if (kind === 'profile' && data.name && window.StacklySec) {
      var session = window.StacklySec.readSession();
      if (session && session.name !== data.name) {
        window.StacklySec.writeSession({ name: data.name, email: session.email, role: session.role });
        var updated = window.StacklySec.readSession();
        if (updated) fillIdentity(updated);

        var users = window.StacklySec.readUsers();
        for (var i = 0; i < users.length; i++) {
          if (String(users[i].email).toLowerCase() === String(session.email).toLowerCase()) {
            users[i].name = data.name;
          }
        }
        window.StacklySec.writeUsers(users);
      }
    }

    toast(form.getAttribute('data-msg') || 'Saved');
  }

  function restoreForms() {
    var store = secRead('stackly_form_data', {}) || {};
    $$('form[data-act]').forEach(function (form) {
      var kind = form.getAttribute('data-act');
      if (kind === 'add-user' || kind === 'new-ticket') return;
      var data = store[pageKey() + kind];
      if (!data) return;
      $$('input[name], textarea[name], select[name]', form).forEach(function (field) {
        if (field.type === 'radio' || typeof data[field.name] === 'undefined') return;
        field.value = data[field.name];
      });
    });
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
        toggleEdit(el);
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
        doDownload(el);
      }

      else if (act === 'renew') {
        doRenew(el);
      }

      else if (act === 'save') {
        var ownerForm = el.form || (el.closest ? el.closest('form') : null);
        if (ownerForm) saveForm(ownerForm, ownerForm.getAttribute('data-act') || 'save');
        else toast(el.getAttribute('data-msg') || 'Saved');
      }
    });

    /* Enter saves an inline (contentEditable) edit */
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var target = e.target;
      if (!target || !target.classList || !target.classList.contains('is-editing')) return;
      e.preventDefault();
      var card = target.closest('.svc-card');
      var btn = card && card.querySelector('[data-act="edit"][data-editing="1"]');
      if (btn) btn.click();
    });

    /* delegated submits */
    document.addEventListener('submit', function (e) {
      var form = e.target;
      if (!form.hasAttribute || !form.hasAttribute('data-act')) return;
      e.preventDefault();
      var kind = form.getAttribute('data-act');
      if (kind === 'add-user') addUserRow(form);
      else if (kind === 'new-ticket') addTicket(form);
      else saveForm(form, kind);
    });
  }

  /* ---------------- boot ---------------- */
  document.addEventListener('DOMContentLoaded', function () {
    if (!window.StacklySec) {
      document.body.innerHTML = '<p style="font:16px/1.6 system-ui,sans-serif;padding:48px;text-align:center;color:#343E5F">' +
        'Security module failed to load. Please refresh the page.</p>';
      return;
    }

    var session = getSession();

    if (!session) {
      location.replace('login.html');
      return;
    }

    var page = document.body.getAttribute('data-page'); /* "admin" | "user" */
    if (page === 'admin' && session.role !== 'admin') {
      location.replace('dashboard-user.html');
      return;
    }
    if (page === 'user' && session.role === 'admin') {
      location.replace('dashboard-admin.html');
      return;
    }

    fillIdentity(session);
    restoreForms();
    restoreServices();
    initNav();
    initSearch();
    initActions();
  });
})();

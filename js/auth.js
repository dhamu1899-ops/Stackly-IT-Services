/* =========================================================
   Stackly – shared auth logic for login.html + signup.html
   Vanilla JS. Exposes window.Stackly
   ========================================================= */
(function () {
  'use strict';

  var SESSION_KEY = 'stackly_session';
  var USERS_KEY = 'stackly_users';
  var REMEMBER_KEY = 'stackly_remember_email';

  /* Seeded demo accounts (never stored, always available).
     Passwords are salted SHA-256 hashes — no readable credential
     exists anywhere in the source or in localStorage. */
  var DEMO_ACCOUNTS = [
    { name: 'Arjun Stackly', email: 'admin@stackly.in', salt: 'e3e8570933297b56', pwHash: '67f6c9ef66d4080e539404c3afac037421dd468be9c82dfc49180db591f1ae7a', role: 'admin' },
    { name: 'Priya User', email: 'user@stackly.in', salt: '097ec9fcfa206c51', pwHash: '6b164c7d6ea76a6ec141c2d8d0e94054b24180e59beae99c4c5feb0951dd7ef1', role: 'user' }
  ];

  /* Constant-time-ish password check against a salted hash */
  function passwordMatches(account, pass) {
    if (!account || !window.StacklySec) return false;
    if (typeof account.pwHash !== 'string' || !account.salt) return false;
    var got = window.StacklySec.hashPassword(pass, account.salt);
    if (got.length !== account.pwHash.length) return false;
    var diff = 0;
    for (var i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ account.pwHash.charCodeAt(i);
    return diff === 0;
  }

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var val = JSON.parse(raw);
      return val === null || val === undefined ? fallback : val;
    } catch (e) {
      return fallback;
    }
  }

  var Stackly = {
    /* ---- session (signed + role-verified, see js/security.js) ---- */
    getSession: function () {
      if (!window.StacklySec) return null;
      return window.StacklySec.readSession();
    },
    setSession: function (session) {
      if (!window.StacklySec) return session;
      return window.StacklySec.writeSession(session);
    },
    clearSession: function () {
      if (window.StacklySec) window.StacklySec.clearSession();
      else { try { localStorage.removeItem(SESSION_KEY); } catch (e) {} }
    },

    /* ---- users (salted hashes + integrity signature) ---- */
    getUsers: function () {
      if (window.StacklySec) return window.StacklySec.readUsers();
      var users = readJSON(USERS_KEY, []);
      return Array.isArray(users) ? users : [];
    },
    saveUsers: function (users) {
      if (window.StacklySec) return window.StacklySec.writeUsers(users);
      try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch (e) {}
    },

    /* ---- helpers ---- */
    isValidEmail: function (value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
    },
    dashFor: function (role) {
      return role === 'admin' ? 'dashboard-admin.html' : 'dashboard-user.html';
    },
    initials: function (name) {
      var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
      if (!parts.length) return '?';
      if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    },

    /* ---- inline errors (no alerts) ---- */
    showError: function (input, msg) {
      if (!input) return;
      var field = input.closest ? input.closest('.auth-field') : null;
      if (!field) return;
      field.classList.add('invalid');
      var err = field.querySelector('.field-err');
      if (err) err.textContent = msg;
      input.setAttribute('aria-invalid', 'true');
    },
    clearError: function (input) {
      if (!input) return;
      var field = input.closest ? input.closest('.auth-field') : null;
      if (field) field.classList.remove('invalid');
      input.removeAttribute('aria-invalid');
    },
    clearErrors: function (form) {
      if (!form) return;
      Array.prototype.forEach.call(form.querySelectorAll('.auth-field.invalid'), function (f) {
        f.classList.remove('invalid');
      });
      Array.prototype.forEach.call(form.querySelectorAll('[aria-invalid]'), function (i) {
        i.removeAttribute('aria-invalid');
      });
    },

    /* ---- lightweight toast (used if a page wants it) ---- */
    toast: function (msg) {
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
  };

  window.Stackly = Stackly;

  /* ---------------------------------------------------------
     Internal helpers
     --------------------------------------------------------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function findAccount(email) {
    var target = String(email || '').trim().toLowerCase();
    for (var i = 0; i < DEMO_ACCOUNTS.length; i++) {
      if (DEMO_ACCOUNTS[i].email.toLowerCase() === target) return DEMO_ACCOUNTS[i];
    }
    var users = Stackly.getUsers();
    for (var j = 0; j < users.length; j++) {
      if (String(users[j].email || '').toLowerCase() === target) return users[j];
    }
    return null;
  }

  function rememberEmail(email) {
    try {
      if (email) localStorage.setItem(REMEMBER_KEY, email);
      else localStorage.removeItem(REMEMBER_KEY);
    } catch (e) {}
  }

  function rememberedEmail() {
    try { return localStorage.getItem(REMEMBER_KEY) || ''; } catch (e) { return ''; }
  }

  function fail(input, msg) {
    Stackly.showError(input, msg);
    if (input) input.focus();
    return false;
  }

  /* ---------------------------------------------------------
     Segmented role control (login) — [data-role] buttons
     --------------------------------------------------------- */
  function initSegmented() {
    var seg = $('.auth-seg');
    if (!seg) return;
    var hidden = $('#auth-role');
    var buttons = $$('[data-role]', seg);

    function select(role) {
      buttons.forEach(function (b) {
        var on = b.getAttribute('data-role') === role;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      if (hidden) hidden.value = role;
    }

    buttons.forEach(function (b) {
      b.addEventListener('click', function () { select(b.getAttribute('data-role')); });
    });

    seg.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      var current = buttons.findIndex(function (b) { return b.classList.contains('is-active'); });
      var next = e.key === 'ArrowRight' ? current + 1 : current - 1;
      if (next < 0) next = buttons.length - 1;
      if (next >= buttons.length) next = 0;
      select(buttons[next].getAttribute('data-role'));
      buttons[next].focus();
    });

    select(hidden && hidden.value ? hidden.value : 'user');
    Stackly.setRole = select;
  }

  /* ---------------------------------------------------------
     Password show / hide toggles
     --------------------------------------------------------- */
  function initPasswordToggles() {
    $$('[data-toggle-pw]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var input = document.getElementById(btn.getAttribute('data-toggle-pw'));
        if (!input) return;
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.textContent = show ? 'Hide' : 'Show';
        btn.setAttribute('aria-pressed', show ? 'true' : 'false');
        btn.setAttribute('aria-label', (show ? 'Hide' : 'Show') + ' password');
      });
    });
  }

  /* ---------------------------------------------------------
     LOGIN
     --------------------------------------------------------- */
  function initLogin() {
    var form = $('#login-form');
    if (!form) return;

    var email = $('#login-email');
    var password = $('#login-password');
    var remember = $('#login-remember');

    /* prefill remembered email */
    var saved = rememberedEmail();
    if (saved && email && !email.value) {
      email.value = saved;
      if (remember) remember.checked = true;
    }

    [email, password].forEach(function (input) {
      if (!input) return;
      input.addEventListener('input', function () { Stackly.clearError(input); });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      Stackly.clearErrors(form);

      var mail = email.value.trim();
      var pass = password.value;
      var role = ($('#auth-role') && $('#auth-role').value) || 'user';

      if (!Stackly.isValidEmail(mail)) return fail(email, 'Enter a valid email address.');
      if (!pass) return fail(password, 'Password is required.');

      if (!window.StacklySec) {
        return fail(password, 'Security module unavailable — reload the page and try again.');
      }

      var account = findAccount(mail);
      if (!account || !passwordMatches(account, pass)) {
        return fail(email, 'Incorrect email or password. Try the demo credentials below.');
      }
      if (account.role !== role) {
        var label = account.role === 'admin' ? 'Admin' : 'User';
        if (Stackly.setRole) Stackly.setRole(account.role);
        return fail(email, 'This account is signed up as ' + label + '. We switched the tab for you.');
      }

      rememberEmail(remember && remember.checked ? mail : '');
      Stackly.setSession({ name: account.name, email: account.email, role: account.role });
      location.replace(Stackly.dashFor(account.role));
    });
  }

  /* ---------------------------------------------------------
     SIGNUP
     --------------------------------------------------------- */
  function initSignup() {
    var form = $('#signup-form');
    if (!form) return;

    var name = $('#su-name');
    var email = $('#su-email');
    var password = $('#su-password');
    var confirm = $('#su-confirm');

    [name, email, password, confirm].forEach(function (input) {
      if (!input) return;
      input.addEventListener('input', function () { Stackly.clearError(input); });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      Stackly.clearErrors(form);

      var fullName = name.value.trim();
      var mail = email.value.trim();
      var pass = password.value;
      var pass2 = confirm.value;
      /* ITS-001: public sign-up can only ever create a standard user.
         Administrative accounts are provisioned separately — the role is
         never read from the form. */
      var role = 'user';

      if (fullName.length < 2) return fail(name, 'Please enter your full name (2 characters or more).');
      if (!Stackly.isValidEmail(mail)) return fail(email, 'Enter a valid email address.');
      if (pass.length < 6) return fail(password, 'Password must be at least 6 characters.');
      if (pass !== pass2) return fail(confirm, 'Passwords do not match.');
      if (findAccount(mail)) {
        return fail(email, 'An account with this email already exists');
      }
      if (!window.StacklySec) {
        return fail(password, 'Security module unavailable — reload the page and try again.');
      }

      /* ITS-002: store a salted hash, never the readable password */
      var users = Stackly.getUsers();
      var salt = window.StacklySec.randomSalt();
      users.push(window.StacklySec.makeUser({
        name: fullName,
        email: mail,
        salt: salt,
        pwHash: window.StacklySec.hashPassword(pass, salt),
        role: role,
        created: new Date().toISOString()
      }));
      Stackly.saveUsers(users);

      rememberEmail('');
      Stackly.setSession({ name: fullName, email: mail, role: role });
      location.replace(Stackly.dashFor(role));
    });
  }

  /* ---------------------------------------------------------
     Auth pages are off-limits while a session exists
     --------------------------------------------------------- */
  function guardAuthPages() {
    var page = document.body && document.body.getAttribute('data-page');
    if (page !== 'login' && page !== 'signup') return;
    var session = Stackly.getSession();
    if (session) location.replace(Stackly.dashFor(session.role));
  }

  document.addEventListener('DOMContentLoaded', function () {
    guardAuthPages();
    initSegmented();
    initPasswordToggles();
    initLogin();
    initSignup();
  });
})();

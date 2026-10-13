/* =========================================================
   Stackly – security helpers (js/security.js)
   Pure-JS SHA-256, salted password hashes and signed records.

   A static site has no backend, so these checks give the demo
   real tamper-evidence:
     - passwords are never written to localStorage in readable form
     - stackly_session and stackly_users carry an integrity signature,
       so editing the stored role invalidates the record
   Loaded (before auth.js / dashboard.js / main.js) on every page.
   ========================================================= */
(function (root) {
  'use strict';

  var SESSION_KEY = 'stackly_session';
  var USERS_KEY = 'stackly_users';
  var SECRET = 'stk-7f3a9c1e-5b84-4d26-a0fe-19c7b35d84a12';

  /* Seeded demo identities (passwords live in auth.js as salted hashes) */
  var DEMO_ROLES = {
    'admin@stackly.in': 'admin',
    'user@stackly.in': 'user'
  };

  /* ---------------- SHA-256 (UTF-8 safe) ---------------- */
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  var H0 = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  function utf8Bytes(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) {
        out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
        var c2 = str.charCodeAt(++i);
        var cp = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
        out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      } else {
        out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      }
    }
    return out;
  }

  function rr(x, n) { return (x >>> n) | (x << (32 - n)); }

  function sha256(str) {
    var bytes = utf8Bytes(String(str));
    var bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    bytes.push(0, 0, 0, 0,
      (bitLen >>> 24) & 255, (bitLen >>> 16) & 255, (bitLen >>> 8) & 255, bitLen & 255);

    var H = H0.slice();
    var w = new Array(64);

    for (var off = 0; off < bytes.length; off += 64) {
      for (var t = 0; t < 16; t++) {
        var j = off + t * 4;
        w[t] = ((bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3]) | 0;
      }
      for (t = 16; t < 64; t++) {
        var w15 = w[t - 15], w2 = w[t - 2];
        var s0 = rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3);
        var s1 = rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }

      var a = H[0], b = H[1], c = H[2], d = H[3],
        e = H[4], f = H[5], g = H[6], h = H[7];

      for (t = 0; t < 64; t++) {
        var S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var temp1 = (h + S1 + ch + K[t] + w[t]) | 0;
        var S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (S0 + maj) | 0;
        h = g; g = f; f = e;
        e = (d + temp1) | 0;
        d = c; c = b; b = a;
        a = (temp1 + temp2) | 0;
      }

      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0;
      H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0;
      H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }

    var hex = '';
    for (var i = 0; i < 8; i++) {
      var part = (H[i] >>> 0).toString(16);
      hex += '00000000'.slice(part.length) + part;
    }
    return hex;
  }

  /* ---------------- helpers ---------------- */
  function randomSalt() {
    var hex = '';
    try {
      var arr = new Uint8Array(8);
      (root.crypto || root.msCrypto).getRandomValues(arr);
      for (var i = 0; i < arr.length; i++) {
        hex += ('0' + arr[i].toString(16)).slice(-2);
      }
    } catch (e) {
      for (var j = 0; j < 16; j++) hex += Math.floor(Math.random() * 16).toString(16);
    }
    return hex;
  }

  function hashPassword(password, salt) {
    return sha256('stk-pw|' + salt + '|' + String(password));
  }

  function readJSON(key, fallback) {
    try {
      var raw = root.localStorage.getItem(key);
      if (!raw) return fallback;
      var val = JSON.parse(raw);
      return val === null || typeof val === 'undefined' ? fallback : val;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      root.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ---------------- signed records ---------------- */
  function sessionSig(s) {
    return sha256(SECRET + '|session|' + [s.name, s.email, s.role].join('\u0001'));
  }

  function userSig(u) {
    return sha256(SECRET + '|user|' + [u.name, u.email, u.salt, u.pwHash, u.role, u.created].join('\u0001'));
  }

  function makeUser(fields) {
    var rec = {
      name: fields.name,
      email: fields.email,
      salt: fields.salt,
      pwHash: fields.pwHash,
      role: fields.role,
      created: fields.created
    };
    rec.sig = userSig(rec);
    return rec;
  }

  /* Legacy records (created before signing existed) are upgraded in place;
     records whose signature no longer matches have been edited → dropped. */
  function normalizeUser(u) {
    if (!u || typeof u !== 'object' || !u.email) return null;

    if (!u.sig) {
      if (typeof u.password === 'string') {
        /* plaintext legacy record → convert to salted hash */
        var salt = randomSalt();
        return makeUser({
          name: u.name,
          email: u.email,
          salt: salt,
          pwHash: hashPassword(u.password, salt),
          role: u.role,
          created: u.created || new Date().toISOString()
        });
      }
      return makeUser({
        name: u.name,
        email: u.email,
        salt: u.salt,
        pwHash: u.pwHash,
        role: u.role,
        created: u.created || new Date().toISOString()
      });
    }

    if (u.sig !== userSig(u)) return null; /* tampered */
    return u;
  }

  function readUsers() {
    var list = readJSON(USERS_KEY, []);
    if (!Array.isArray(list)) return [];
    var out = [];
    var changed = false;
    for (var i = 0; i < list.length; i++) {
      var clean = normalizeUser(list[i]);
      if (clean) {
        if (clean !== list[i]) changed = true;
        out.push(clean);
      } else {
        changed = true; /* drop tampered entry */
      }
    }
    if (changed) writeJSON(USERS_KEY, out);
    return out;
  }

  /* Re-signs every record on write: callers are our own code, while
     anything edited directly in localStorage fails verification on read. */
  function writeUsers(users) {
    var signed = [];
    for (var i = 0; i < (users || []).length; i++) {
      var u = users[i];
      if (!u || typeof u !== 'object' || !u.email) continue;
      if (u.salt && u.pwHash) {
        signed.push(makeUser({
          name: u.name,
          email: u.email,
          salt: u.salt,
          pwHash: u.pwHash,
          role: u.role,
          created: u.created || new Date().toISOString()
        }));
      } else {
        var legacy = normalizeUser(u);
        if (legacy) signed.push(legacy);
      }
    }
    return writeJSON(USERS_KEY, signed);
  }

  function sessionIsTrusted(s) {
    if (!s || typeof s !== 'object' || !s.email || !s.role) return false;
    if (!s.sig || s.sig !== sessionSig(s)) return false;

    var mail = String(s.email).toLowerCase();
    if (DEMO_ROLES[mail]) return s.role === DEMO_ROLES[mail];

    var users = readUsers();
    for (var i = 0; i < users.length; i++) {
      if (String(users[i].email).toLowerCase() === mail) return users[i].role === s.role;
    }
    return false;
  }

  var StacklySec = {
    version: 1,
    sha256: sha256,
    randomSalt: randomSalt,
    hashPassword: hashPassword,

    /* ---- session ---- */
    writeSession: function (session) {
      if (!session || !session.email) return null;
      var rec = {
        name: session.name,
        email: session.email,
        role: session.role,
        sig: sessionSig(session)
      };
      writeJSON(SESSION_KEY, rec);
      return rec;
    },
    readSession: function () {
      var s = readJSON(SESSION_KEY, null);
      if (!s) return null;
      if (!sessionIsTrusted(s)) {
        try { root.localStorage.removeItem(SESSION_KEY); } catch (e) {}
        return null;
      }
      return { name: s.name, email: s.email, role: s.role };
    },
    clearSession: function () {
      try { root.localStorage.removeItem(SESSION_KEY); } catch (e) {}
    },

    /* ---- users ---- */
    readUsers: readUsers,
    writeUsers: writeUsers,
    makeUser: makeUser,
    verifyUser: function (u) { return normalizeUser(u) !== null; },

    /* ---- misc ---- */
    readJSON: readJSON,
    writeJSON: writeJSON
  };

  root.StacklySec = StacklySec;

  if (typeof module !== 'undefined' && module.exports) module.exports = StacklySec;
})(typeof window !== 'undefined' ? window : globalThis);

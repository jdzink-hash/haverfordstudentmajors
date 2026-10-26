// Account + profile storage.
//
// This version keeps accounts in the browser's localStorage, so a profile only
// exists on the device where it was created and is not truly secure. Every
// method is async and returns plain profile objects, so this file can later be
// replaced with a real backend (Firebase, Supabase, etc.) without changing
// profile.js or app.js.
//
// Profile shape:
//   { email, name, majors: [], classYear, signedUp: [opportunityId],
//     attended: [{ id?, title, date }] }
//
// Whenever the signed-in profile changes, a "profilechange" event is fired on
// window with the profile (or null) as event.detail.

const Auth = (function () {
  "use strict";

  const USERS_KEY = "hc-opps-users";
  const SESSION_KEY = "hc-opps-session";

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      throw new Error("Your browser is blocking saved data, so profiles can't be stored. Check your privacy settings.");
    }
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  async function hash(password, salt) {
    const text = `${salt}:${password}`;
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    // Fallback for browsers without Web Crypto (e.g. some file:// contexts).
    let h = 5381;
    for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
    return `djb2-${h >>> 0}`;
  }

  function randomSalt() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function emptyProfile(email) {
    return { email, name: "", majors: [], classYear: "", signedUp: [], attended: [] };
  }

  function announce(profile) {
    window.dispatchEvent(new CustomEvent("profilechange", { detail: profile }));
  }

  function current() {
    const email = read(SESSION_KEY, null);
    const user = email && read(USERS_KEY, {})[email];
    return user ? { ...emptyProfile(email), ...user.profile } : null;
  }

  return {
    current,

    async signUp(email, password) {
      email = normalizeEmail(email);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
      if (!password || password.length < 8) throw new Error("Password must be at least 8 characters.");
      const users = read(USERS_KEY, {});
      if (users[email]) throw new Error("An account with this email already exists. Sign in instead.");
      const salt = randomSalt();
      users[email] = { salt, passwordHash: await hash(password, salt), profile: emptyProfile(email) };
      write(USERS_KEY, users);
      write(SESSION_KEY, email);
      announce(current());
      return current();
    },

    async signIn(email, password) {
      email = normalizeEmail(email);
      const user = read(USERS_KEY, {})[email];
      if (!user || (await hash(password, user.salt)) !== user.passwordHash) {
        throw new Error("Email or password is incorrect.");
      }
      write(SESSION_KEY, email);
      announce(current());
      return current();
    },

    async signOut() {
      write(SESSION_KEY, null);
      announce(null);
    },

    // Merge changes into the signed-in profile and save.
    async update(changes) {
      const email = read(SESSION_KEY, null);
      const users = read(USERS_KEY, {});
      if (!email || !users[email]) throw new Error("You're not signed in.");
      users[email].profile = { ...emptyProfile(email), ...users[email].profile, ...changes, email };
      write(USERS_KEY, users);
      announce(current());
      return current();
    },

    async deleteAccount() {
      const email = read(SESSION_KEY, null);
      const users = read(USERS_KEY, {});
      delete users[email];
      write(USERS_KEY, users);
      write(SESSION_KEY, null);
      announce(null);
    },
  };
})();

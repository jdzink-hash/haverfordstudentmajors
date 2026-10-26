// "My Profile" drawer: sign in / create account, edit majors and class year,
// and manage signed-up and attended events.

const ProfileUI = (function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const els = {
    button: $("profile-btn"),
    buttonLabel: $("profile-btn-label"),
    avatar: $("profile-avatar"),
    overlay: $("profile-overlay"),
    drawer: $("profile-drawer"),
    close: $("profile-close"),
    authView: $("auth-view"),
    authNotice: $("auth-notice"),
    authForm: $("auth-form"),
    authEmail: $("auth-email"),
    authPassword: $("auth-password"),
    authError: $("auth-error"),
    authSubmit: $("auth-submit"),
    tabSignIn: $("tab-signin"),
    tabSignUp: $("tab-signup"),
    profileView: $("profile-view"),
    email: $("profile-email"),
    signOut: $("sign-out"),
    form: $("profile-form"),
    name: $("profile-name"),
    major1: $("profile-major-1"),
    major2: $("profile-major-2"),
    year: $("profile-year"),
    saved: $("profile-saved"),
    signedUpList: $("signed-up-list"),
    signedUpCount: $("signed-up-count"),
    attendedList: $("attended-list"),
    attendedCount: $("attended-count"),
    pastForm: $("past-event-form"),
    pastTitle: $("past-title"),
    pastDate: $("past-date"),
    deleteBtn: $("delete-account"),
  };

  let mode = "signin";
  let lastFocus = null;

  // ---------- Helpers ----------

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function formatDate(str) {
    if (!str) return "";
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function findOpportunity(id) {
    return OPPORTUNITIES.find((o) => o.id === id);
  }

  function initials(profile) {
    const source = profile.name.trim() || profile.email;
    const parts = source.split(/[\s@.]+/).filter(Boolean);
    return ((parts[0] || "?")[0] + (profile.name.trim() && parts[1] ? parts[1][0] : "")).toUpperCase();
  }

  function fillSelect(select, values, placeholder) {
    select.innerHTML = "";
    select.appendChild(new Option(placeholder, ""));
    values.forEach((v) => select.appendChild(new Option(v, v)));
  }

  fillSelect(els.major1, MAJORS, "Select your major");
  fillSelect(els.major2, MAJORS, "None");
  fillSelect(els.year, CLASS_YEARS, "Select your class year");

  // ---------- Drawer open/close ----------

  function open(notice) {
    lastFocus = document.activeElement;
    els.authNotice.textContent = notice || "";
    els.authNotice.hidden = !notice;
    els.overlay.hidden = false;
    els.drawer.hidden = false;
    els.button.setAttribute("aria-expanded", "true");
    void els.drawer.offsetWidth; // apply the closed position first so the slide-in animates
    els.drawer.classList.add("open");
    els.overlay.classList.add("open");
    (Auth.current() ? els.close : els.authEmail).focus();
  }

  function close() {
    els.drawer.classList.remove("open");
    els.overlay.classList.remove("open");
    els.button.setAttribute("aria-expanded", "false");
    setTimeout(() => {
      els.drawer.hidden = true;
      els.overlay.hidden = true;
    }, 200);
    if (lastFocus) lastFocus.focus();
  }

  els.button.addEventListener("click", () => open());
  els.close.addEventListener("click", close);
  els.overlay.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.drawer.hidden) close();
  });

  // ---------- Sign in / create account ----------

  function setMode(next) {
    mode = next;
    const signIn = mode === "signin";
    els.tabSignIn.classList.toggle("active", signIn);
    els.tabSignUp.classList.toggle("active", !signIn);
    els.tabSignIn.setAttribute("aria-selected", signIn);
    els.tabSignUp.setAttribute("aria-selected", !signIn);
    els.authSubmit.textContent = signIn ? "Sign in" : "Create account";
    els.authPassword.autocomplete = signIn ? "current-password" : "new-password";
    els.authError.hidden = true;
  }

  els.tabSignIn.addEventListener("click", () => setMode("signin"));
  els.tabSignUp.addEventListener("click", () => setMode("signup"));

  els.authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    els.authError.hidden = true;
    els.authSubmit.disabled = true;
    try {
      const fn = mode === "signin" ? Auth.signIn : Auth.signUp;
      await fn(els.authEmail.value, els.authPassword.value);
      els.authForm.reset();
      els.authNotice.hidden = true;
      els.close.focus();
    } catch (err) {
      els.authError.textContent = err.message;
      els.authError.hidden = false;
    } finally {
      els.authSubmit.disabled = false;
    }
  });

  els.signOut.addEventListener("click", () => Auth.signOut());

  // ---------- Profile details ----------

  els.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const majors = [els.major1.value, els.major2.value].filter(Boolean);
    await Auth.update({
      name: els.name.value.trim(),
      majors: Array.from(new Set(majors)),
      classYear: els.year.value,
    });
    els.saved.hidden = false;
    setTimeout(() => { els.saved.hidden = true; }, 2500);
  });

  // ---------- Event tracking ----------

  function eventDate(o) {
    return o.eventDate || o.deadline;
  }

  async function toggleSignedUp(o) {
    const profile = Auth.current();
    if (!profile) return open("Sign in or create an account to keep track of events you've signed up for.");
    const signedUp = profile.signedUp.includes(o.id)
      ? profile.signedUp.filter((id) => id !== o.id)
      : profile.signedUp.concat(o.id);
    await Auth.update({
      signedUp,
      attended: profile.attended.filter((a) => a.id !== o.id),
    });
  }

  async function toggleAttended(o) {
    const profile = Auth.current();
    if (!profile) return open("Sign in or create an account to keep track of events you've attended.");
    const wasAttended = profile.attended.some((a) => a.id === o.id);
    await Auth.update({
      attended: wasAttended
        ? profile.attended.filter((a) => a.id !== o.id)
        : profile.attended.concat({ id: o.id, title: o.title, date: eventDate(o) }),
      signedUp: profile.signedUp.filter((id) => id !== o.id),
    });
  }

  els.pastForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = els.pastTitle.value.trim();
    if (!title) return;
    const profile = Auth.current();
    await Auth.update({
      attended: profile.attended.concat({ title, date: els.pastDate.value }),
    });
    els.pastForm.reset();
    els.pastTitle.focus();
  });

  function iconButton(label, text, onClick) {
    const btn = el("button", "mini-btn", text);
    btn.type = "button";
    btn.setAttribute("aria-label", label);
    btn.addEventListener("click", onClick);
    return btn;
  }

  function renderSignedUp(profile) {
    els.signedUpList.innerHTML = "";
    els.signedUpCount.textContent = profile.signedUp.length;
    if (!profile.signedUp.length) {
      els.signedUpList.appendChild(el("li", "track-empty", "Nothing yet. Use “Mark as signed up” on any listing."));
      return;
    }
    profile.signedUp
      .map((id) => findOpportunity(id) || { id, title: "Listing no longer available" })
      .sort((a, b) => (eventDate(a) || "").localeCompare(eventDate(b) || ""))
      .forEach((o) => {
        const li = el("li", "track-item");
        const info = el("div", "track-info");
        info.appendChild(el("span", "track-title", o.title));
        if (o.deadline) {
          info.appendChild(el("span", "track-date",
            o.eventDate ? `${formatDate(o.eventDate)} · deadline ${formatDate(o.deadline)}` : `Deadline ${formatDate(o.deadline)}`));
        }
        li.appendChild(info);
        const actions = el("div", "track-actions");
        if (o.deadline) actions.appendChild(iconButton(`Mark ${o.title} as attended`, "Attended", () => toggleAttended(o)));
        actions.appendChild(iconButton(`Remove ${o.title}`, "Remove", () => toggleSignedUp(o)));
        li.appendChild(actions);
        els.signedUpList.appendChild(li);
      });
  }

  function renderAttended(profile) {
    els.attendedList.innerHTML = "";
    els.attendedCount.textContent = profile.attended.length;
    if (!profile.attended.length) {
      els.attendedList.appendChild(el("li", "track-empty", "No past events yet. Add one below or use “Mark attended” on a listing."));
      return;
    }
    profile.attended
      .map((a, index) => ({ ...a, index }))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .forEach((a) => {
        const li = el("li", "track-item");
        const info = el("div", "track-info");
        info.appendChild(el("span", "track-title", a.title));
        if (a.date) info.appendChild(el("span", "track-date", formatDate(a.date)));
        li.appendChild(info);
        const actions = el("div", "track-actions");
        actions.appendChild(iconButton(`Remove ${a.title}`, "Remove", () => {
          const attended = Auth.current().attended.filter((_, i) => i !== a.index);
          Auth.update({ attended });
        }));
        li.appendChild(actions);
        els.attendedList.appendChild(li);
      });
  }

  // ---------- Delete account (click twice to confirm) ----------

  let deleteTimer;
  els.deleteBtn.addEventListener("click", () => {
    if (els.deleteBtn.dataset.confirm) {
      clearTimeout(deleteTimer);
      Auth.deleteAccount();
      return;
    }
    els.deleteBtn.dataset.confirm = "1";
    els.deleteBtn.textContent = "Click again to permanently delete";
    deleteTimer = setTimeout(resetDelete, 4000);
  });

  function resetDelete() {
    delete els.deleteBtn.dataset.confirm;
    els.deleteBtn.textContent = "Delete account";
  }

  // ---------- Render ----------

  function render(profile) {
    els.authView.hidden = !!profile;
    els.profileView.hidden = !profile;
    resetDelete();

    if (!profile) {
      els.buttonLabel.textContent = "My Profile";
      els.avatar.textContent = "";
      els.avatar.classList.add("empty");
      return;
    }

    els.buttonLabel.textContent = profile.name.trim().split(/\s+/)[0] || "My Profile";
    els.avatar.textContent = initials(profile);
    els.avatar.classList.remove("empty");

    els.email.textContent = profile.email;
    // Don't overwrite fields while the user is typing in them.
    if (!els.form.contains(document.activeElement)) {
      els.name.value = profile.name;
      els.major1.value = profile.majors[0] || "";
      els.major2.value = profile.majors[1] || "";
      els.year.value = profile.classYear;
    }
    renderSignedUp(profile);
    renderAttended(profile);
  }

  window.addEventListener("profilechange", (e) => render(e.detail));
  setMode("signin");
  render(Auth.current());

  return { open, toggleSignedUp, toggleAttended };
})();

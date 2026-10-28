(function () {
  "use strict";

  const ALL_MAJORS = "All majors";
  const SOON_DAYS = 14;

  const state = {
    query: "",
    majors: new Set(),
    types: new Set(),
    years: new Set(),
    hideClosed: true,
    closingSoon: false,
    forYou: false,
    sort: "deadline",
  };

  let profile = Auth.current();

  const $ = (id) => document.getElementById(id);
  const els = {
    search: $("search"),
    majorSearch: $("major-search"),
    majorList: $("major-list"),
    typeList: $("type-list"),
    yearList: $("year-list"),
    hideClosed: $("hide-closed"),
    closingSoon: $("closing-soon"),
    forYou: $("for-you"),
    forYouFieldset: $("for-you-fieldset"),
    forYouHint: $("for-you-hint"),
    sort: $("sort"),
    clear: $("clear-filters"),
    count: $("result-count"),
    chips: $("active-chips"),
    results: $("results"),
  };

  // ---------- Dates ----------

  function parseDate(str) {
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function today() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  // "rolling" (apply/join anytime) and "tbd" (not announced yet) have no fixed date.
  function isOpenEnded(str) {
    return str === "rolling" || str === "tbd";
  }

  function daysUntil(str) {
    if (isOpenEnded(str)) return Infinity;
    return Math.round((parseDate(str) - today()) / 86400000);
  }

  function formatDate(str) {
    return parseDate(str).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric", year: "numeric",
    });
  }

  // ---------- Data validation ----------

  // Every listing must have a valid deadline and at least one eligibility requirement.
  const opportunities = OPPORTUNITIES.filter((o) => {
    const problems = [];
    if (!o.deadline || !(isOpenEnded(o.deadline) || /^\d{4}-\d{2}-\d{2}$/.test(o.deadline))) {
      problems.push('deadline (YYYY-MM-DD, "rolling" or "tbd")');
    }
    if (!Array.isArray(o.eligibility) || o.eligibility.length === 0) problems.push("eligibility");
    if (!Array.isArray(o.majors) || o.majors.length === 0) problems.push("majors");
    if (problems.length) {
      console.warn(`Hiding "${o.title || o.id}": missing ${problems.join(", ")}`);
      return false;
    }
    return true;
  });

  // ---------- Filter UI ----------

  function slug(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }

  function countFor(predicate) {
    return opportunities.filter(predicate).length;
  }

  function buildCheckList(container, values, set, prefix, countFn) {
    container.innerHTML = "";
    values.forEach((value) => {
      const id = `${prefix}-${slug(value)}`;
      const label = document.createElement("label");
      label.className = "check";
      label.dataset.value = value.toLowerCase();
      label.innerHTML = `<input type="checkbox" id="${id}"><span class="check-text"></span><span class="count"></span>`;
      label.querySelector(".check-text").textContent = value;
      label.querySelector(".count").textContent = countFn(value);
      const input = label.querySelector("input");
      input.value = value;
      input.checked = set.has(value);
      input.addEventListener("change", () => {
        input.checked ? set.add(value) : set.delete(value);
        update();
      });
      container.appendChild(label);
    });
  }

  buildCheckList(els.majorList, MAJORS, state.majors, "major",
    (m) => countFor((o) => o.majors.includes(m) || o.majors.includes(ALL_MAJORS)));
  buildCheckList(els.typeList, TYPES, state.types, "type",
    (t) => countFor((o) => o.type === t));
  buildCheckList(els.yearList, CLASS_YEARS, state.years, "year",
    (y) => countFor((o) => !o.classYears || o.classYears.includes(y)));

  els.majorSearch.addEventListener("input", () => {
    const q = els.majorSearch.value.trim().toLowerCase();
    els.majorList.querySelectorAll(".check").forEach((label) => {
      label.hidden = q && !label.dataset.value.includes(q);
    });
  });

  // ---------- Filtering ----------

  function matchesMajors(o, majors) {
    return o.majors.includes(ALL_MAJORS) || o.majors.some((m) => majors.includes(m));
  }

  function isForProfile(o) {
    if (!profile) return false;
    if (profile.majors.length && !matchesMajors(o, profile.majors)) return false;
    if (profile.classYear && o.classYears && !o.classYears.includes(profile.classYear)) return false;
    return true;
  }

  function matches(o) {
    if (state.forYou && profile && !isForProfile(o)) return false;
    if (state.majors.size && !o.majors.includes(ALL_MAJORS) &&
        !o.majors.some((m) => state.majors.has(m))) return false;
    if (state.types.size && !state.types.has(o.type)) return false;
    if (state.years.size && o.classYears &&
        !o.classYears.some((y) => state.years.has(y))) return false;

    const days = daysUntil(o.deadline);
    if (state.hideClosed && days < 0) return false;
    if (state.closingSoon && (days < 0 || days > SOON_DAYS)) return false;

    if (state.query) {
      const haystack = [
        o.title, o.organization, o.description, o.location, o.type,
        ...o.majors, ...o.eligibility,
      ].join(" ").toLowerCase();
      if (!state.query.split(/\s+/).every((word) => haystack.includes(word))) return false;
    }
    return true;
  }

  function sortList(list) {
    const sorted = list.slice();
    if (state.sort === "title") {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    } else if (state.sort === "newest") {
      sorted.sort((a, b) => (b.added || "").localeCompare(a.added || ""));
    } else {
      // Open deadlines soonest first, closed ones last.
      sorted.sort((a, b) => {
        const da = daysUntil(a.deadline), db = daysUntil(b.deadline);
        if ((da < 0) !== (db < 0)) return da < 0 ? 1 : -1;
        return a.deadline.localeCompare(b.deadline);
      });
    }
    return sorted;
  }

  // ---------- Rendering ----------

  function deadlineBadge(deadline, days) {
    if (deadline === "tbd") return { cls: "tba", text: "Deadline TBA" };
    if (deadline === "rolling") return { cls: "open", text: "Rolling" };
    if (days < 0) return { cls: "closed", text: "Deadline passed" };
    if (days === 0) return { cls: "urgent", text: "Due today" };
    if (days === 1) return { cls: "urgent", text: "Due tomorrow" };
    if (days <= SOON_DAYS) return { cls: "soon", text: `${days} days left` };
    return { cls: "open", text: `${days} days left` };
  }

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function renderCard(o) {
    const days = daysUntil(o.deadline);
    const badge = deadlineBadge(o.deadline, days);

    const card = el("article", `card${days < 0 ? " is-closed" : ""}`);

    const top = el("div", "card-top");
    top.appendChild(el("span", `type-tag type-${slug(o.type)}`, o.type));
    if (profile && profile.majors.length && matchesMajors(o, profile.majors) && !o.majors.includes(ALL_MAJORS)) {
      top.appendChild(el("span", "for-you-tag", "For your major"));
    }
    if (o.sample) top.appendChild(el("span", "sample-tag", "Sample listing"));
    top.appendChild(el("span", `deadline-badge ${badge.cls}`, badge.text));
    card.appendChild(top);

    card.appendChild(el("h3", "card-title", o.title));
    card.appendChild(el("p", "card-org", o.organization));

    const meta = el("dl", "card-meta");
    const addMeta = (label, value, cls) => {
      const row = el("div", cls ? `meta-row ${cls}` : "meta-row");
      row.appendChild(el("dt", null, label));
      row.appendChild(el("dd", null, value));
      meta.appendChild(row);
    };
    const deadlineText = {
      rolling: o.type === "Club" ? "Rolling: join anytime" : "Rolling admissions",
      tbd: "Not announced yet",
    }[o.deadline] || formatDate(o.deadline);
    addMeta("Deadline", deadlineText, "meta-deadline");
    const eventLabel = { Event: "Event date", Club: "First meeting" }[o.type] || "Starts";
    if (o.eventDate) addMeta(eventLabel, formatDate(o.eventDate) + (o.time ? `, ${o.time}` : ""));
    if (o.location) addMeta("Location", o.location);
    if (o.paid !== undefined) addMeta("Compensation", o.paid ? "Paid / funded" : "Unpaid / for credit");
    if (o.classYears) addMeta("Class years", o.classYears.join(", "));
    if (o.contact) {
      addMeta("Contact", "");
      const link = el("a", null, o.contact);
      link.href = `mailto:${o.contact}`;
      meta.lastChild.querySelector("dd").appendChild(link);
    }
    if (o.award) addMeta("Funding", o.award, "meta-wide");
    if (o.cost) addMeta("Cost", o.cost, "meta-wide");
    if (o.deadlineNote) addMeta("Deadline details", o.deadlineNote, "meta-wide");
    card.appendChild(meta);

    if (o.description) card.appendChild(el("p", "card-desc", o.description));

    const elig = el("div", "eligibility");
    elig.appendChild(el("h4", null, "Eligibility requirements"));
    const ul = el("ul");
    o.eligibility.forEach((req) => ul.appendChild(el("li", null, req)));
    elig.appendChild(ul);
    card.appendChild(elig);

    const footer = el("div", "card-footer");
    const majors = el("div", "major-tags");
    o.majors.forEach((m) => {
      const isActive = state.majors.has(m);
      majors.appendChild(el("span", `major-tag${isActive ? " active" : ""}`, m));
    });
    footer.appendChild(majors);

    const actions = el("div", "card-actions");
    const signedUp = !!profile && profile.signedUp.includes(o.id);
    const attended = !!profile && profile.attended.some((a) => a.id === o.id);
    const trackBtn = (label, activeLabel, active, onClick) => {
      const btn = el("button", `track-btn${active ? " active" : ""}`, active ? activeLabel : label);
      btn.type = "button";
      btn.setAttribute("aria-pressed", active);
      btn.addEventListener("click", onClick);
      return btn;
    };
    if (days >= 0 || signedUp) {
      const [label, activeLabel] = ["Summer Program", "Funding"].includes(o.type)
        ? ["Mark as applied", "✓ Applied"]
        : ["Mark as signed up", "✓ Signed up"];
      actions.appendChild(trackBtn(label, activeLabel, signedUp, () => ProfileUI.toggleSignedUp(o)));
    }
    if (o.type !== "Club") {
      const [label, activeLabel] = o.type === "Funding"
        ? ["Mark as received", "✓ Received"]
        : ["Mark attended", "✓ Attended"];
      actions.appendChild(trackBtn(label, activeLabel, attended, () => ProfileUI.toggleAttended(o)));
    }
    if (o.link) {
      const a = el("a", "apply-btn", days < 0 ? "View details" : "Learn more & apply");
      a.href = o.link;
      a.target = "_blank";
      a.rel = "noopener";
      actions.appendChild(a);
    }
    footer.appendChild(actions);
    card.appendChild(footer);

    return card;
  }

  function renderChips() {
    els.chips.innerHTML = "";
    const add = (label, onRemove) => {
      const chip = el("button", "chip");
      chip.type = "button";
      chip.innerHTML = `<span></span><span aria-hidden="true">×</span>`;
      chip.firstChild.textContent = label;
      chip.setAttribute("aria-label", `Remove filter: ${label}`);
      chip.addEventListener("click", () => { onRemove(); syncInputs(); update(); });
      els.chips.appendChild(chip);
    };
    if (state.forYou && profile) add("Matching my profile", () => { state.forYou = false; });
    state.majors.forEach((m) => add(m, () => state.majors.delete(m)));
    state.types.forEach((t) => add(t, () => state.types.delete(t)));
    state.years.forEach((y) => add(y, () => state.years.delete(y)));
    if (state.closingSoon) add(`Closing within ${SOON_DAYS} days`, () => { state.closingSoon = false; });
    if (state.query) add(`“${state.query}”`, () => { state.query = ""; });
  }

  function render() {
    const list = sortList(opportunities.filter(matches));
    els.results.innerHTML = "";

    if (list.length === 0) {
      const empty = el("div", "empty");
      empty.appendChild(el("h3", null, "No opportunities match these filters"));
      empty.appendChild(el("p", null, "Try selecting more majors, clearing the search, or showing past deadlines."));
      els.results.appendChild(empty);
    } else {
      list.forEach((o) => els.results.appendChild(renderCard(o)));
    }

    const n = list.length;
    els.count.textContent = `${n} ${n === 1 ? "opportunity" : "opportunities"}`;
    renderChips();
  }

  // ---------- URL state (shareable links, e.g. ?major=Biology) ----------

  function writeUrl() {
    const p = new URLSearchParams();
    state.majors.forEach((m) => p.append("major", m));
    state.types.forEach((t) => p.append("type", t));
    state.years.forEach((y) => p.append("year", y));
    if (state.query) p.set("q", state.query);
    if (!state.hideClosed) p.set("closed", "1");
    if (state.closingSoon) p.set("soon", "1");
    if (state.sort !== "deadline") p.set("sort", state.sort);
    const qs = p.toString();
    history.replaceState(null, "", location.pathname + (qs ? `?${qs}` : ""));
  }

  function readUrl() {
    const p = new URLSearchParams(location.search);
    p.getAll("major").filter((m) => MAJORS.includes(m)).forEach((m) => state.majors.add(m));
    p.getAll("type").filter((t) => TYPES.includes(t)).forEach((t) => state.types.add(t));
    p.getAll("year").filter((y) => CLASS_YEARS.includes(y)).forEach((y) => state.years.add(y));
    state.query = (p.get("q") || "").toLowerCase();
    state.hideClosed = p.get("closed") !== "1";
    state.closingSoon = p.get("soon") === "1";
    if (["deadline", "title", "newest"].includes(p.get("sort"))) state.sort = p.get("sort");
  }

  function syncInputs() {
    const sync = (container, set) =>
      container.querySelectorAll("input").forEach((i) => { i.checked = set.has(i.value); });
    sync(els.majorList, state.majors);
    sync(els.typeList, state.types);
    sync(els.yearList, state.years);
    els.search.value = state.query;
    els.hideClosed.checked = state.hideClosed;
    els.closingSoon.checked = state.closingSoon;
    els.forYou.checked = state.forYou;
    els.sort.value = state.sort;
  }

  function syncProfileFilter() {
    els.forYouFieldset.hidden = !profile;
    if (!profile) return;
    const parts = [];
    if (profile.majors.length) parts.push(profile.majors.join(" & "));
    if (profile.classYear) parts.push(profile.classYear);
    els.forYouHint.textContent = parts.length
      ? `Showing listings for ${parts.join(", ")}.`
      : "Add your major in My Profile to get tailored listings.";
    els.forYou.disabled = !parts.length;
    if (!parts.length) state.forYou = false;
  }

  window.addEventListener("profilechange", (e) => {
    const wasSignedIn = !!profile;
    const wasDisabled = els.forYou.disabled;
    profile = e.detail;
    if (!profile) state.forYou = false;
    else if (!wasSignedIn) state.forYou = true; // tailor results right after signing in
    syncProfileFilter();
    // Also turn it on the first time a new account saves a major or class year.
    if (profile && wasDisabled && !els.forYou.disabled) state.forYou = true;
    syncInputs();
    render();
  });

  function update() {
    writeUrl();
    render();
  }

  // ---------- Events ----------

  let searchTimer;
  els.search.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.query = els.search.value.trim().toLowerCase();
      update();
    }, 150);
  });
  els.hideClosed.addEventListener("change", () => { state.hideClosed = els.hideClosed.checked; update(); });
  els.closingSoon.addEventListener("change", () => { state.closingSoon = els.closingSoon.checked; update(); });
  els.forYou.addEventListener("change", () => { state.forYou = els.forYou.checked; update(); });
  els.sort.addEventListener("change", () => { state.sort = els.sort.value; update(); });
  els.clear.addEventListener("click", () => {
    state.majors.clear();
    state.types.clear();
    state.years.clear();
    state.query = "";
    state.hideClosed = true;
    state.closingSoon = false;
    state.forYou = false;
    els.majorSearch.value = "";
    els.majorList.querySelectorAll(".check").forEach((l) => { l.hidden = false; });
    syncInputs();
    update();
  });

  readUrl();
  // Returning signed-in students start with tailored results unless a shared link set filters.
  state.forYou = !!profile && !location.search;
  syncProfileFilter();
  syncInputs();
  render();
})();

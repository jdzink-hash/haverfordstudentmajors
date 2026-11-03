// Calendar helpers: "Add to Google Calendar" links for signed-up listings,
// plus a placeholder for emailing invites once an email service is connected.

const Calendar = (function () {
  "use strict";

  // ---------- Email invites (not connected yet) ----------
  //
  // To email invites automatically, connect a sending service (for example
  // EmailJS or a Firebase/Supabase function), set EMAIL_INVITES_ENABLED to
  // true, and fill in emailInvite() below. It's called whenever a signed-in
  // user marks a listing as signed up.
  const EMAIL_INVITES_ENABLED = false;

  async function emailInvite(profile, o) {
    if (!EMAIL_INVITES_ENABLED) return false;
    const invite = details(o);
    if (!invite) return false;
    // TODO: send `invite` (title, start, end, allDay, location, notes) to profile.email.
    return false;
  }

  // ---------- Google Calendar links ----------

  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  // Matches times like "5–6 PM ET", "10:30–11:30 AM ET" and "11 AM–12 PM ET".
  const TIME = /(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\s*[–-]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*ET/i;

  function to24(hour, ampm) {
    hour = Number(hour) % 12;
    return ampm.toUpperCase() === "PM" ? hour + 12 : hour;
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function addDay(date) {
    const [y, m, d] = date.split("-").map(Number);
    const next = new Date(y, m - 1, d + 1);
    return `${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`;
  }

  // The event to put on the calendar: the event date if there is one,
  // otherwise the application deadline. Null when there's no fixed date.
  function details(o) {
    const isEvent = DATE.test(o.eventDate || "");
    const date = isEvent ? o.eventDate : DATE.test(o.deadline) ? o.deadline : null;
    if (!date) return null;

    const invite = {
      title: isEvent ? o.title : `Deadline: ${o.title}`,
      date,
      allDay: true,
      location: o.location || "",
      notes: [o.organization, o.description, o.link].filter(Boolean).join("\n\n"),
    };

    const m = isEvent && o.time ? TIME.exec(o.time) : null;
    if (m) {
      let start = to24(m[1], m[3] || m[6]);
      const end = to24(m[4], m[6]);
      if (!m[3] && start > end) start -= 12; // e.g. "11–1 PM" starts in the morning
      invite.allDay = false;
      invite.start = `${pad(start)}${m[2] || "00"}00`;
      invite.end = `${pad(end)}${m[5] || "00"}00`;
    }
    return invite;
  }

  function googleUrl(o) {
    const invite = details(o);
    if (!invite) return null;
    const day = invite.date.replace(/-/g, "");
    const dates = invite.allDay
      ? `${day}/${addDay(invite.date)}`
      : `${day}T${invite.start}/${day}T${invite.end}`;
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: invite.title,
      dates,
      details: invite.notes,
      location: invite.location,
    });
    if (!invite.allDay) params.set("ctz", "America/New_York");
    return `https://calendar.google.com/calendar/render?${params.toString().replace(/\+/g, "%20")}`;
  }

  return { googleUrl, emailInvite, EMAIL_INVITES_ENABLED };
})();

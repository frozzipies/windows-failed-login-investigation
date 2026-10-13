/* RedLimit SOC dashboard template.
 *
 * One renderer for every lab in this bank. The per-lab differences (which
 * columns exist, which events are the hostile ones, which filters appear)
 * come from window.RL_CONFIG, which the Jinja template sets. Nothing in here
 * is specific to SSH or to Windows.
 *
 * This is a log viewer only. Tasks, answers and scoring live on the
 * hack.redlimit.id platform, so the dashboard reads one endpoint:
 *   GET /api/events -> { events, dataset_version, ... }
 */
(function () {
  "use strict";

  var CFG = window.RL_CONFIG || {};
  var COLUMNS = CFG.columns || [];

  var allEvents = [];
  var sortKey = CFG.defaultSort || (COLUMNS[0] && COLUMNS[0].key);
  var sortAsc = true;

  function $(id) { return document.getElementById(id); }

  function text(el, value) { if (el) el.textContent = value; }


  function isHostile(row) {
    if (!CFG.hostileField) return false;
    return (CFG.hostileValues || []).indexOf(String(row[CFG.hostileField])) !== -1;
  }

  /* Every state below names what happened and what to do next. */
  function showState(title, detail, actionLabel, onAction) {
    var body = $("rows");
    if (!body) return;
    var span = COLUMNS.length || 1;
    body.innerHTML = "";
    var tr = document.createElement("tr");
    var td = document.createElement("td");
    td.colSpan = span;
    td.className = "rl-state";
    var b = document.createElement("b");
    b.textContent = title;
    td.appendChild(b);
    td.appendChild(document.createTextNode(detail));
    if (actionLabel && onAction) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rl-btn rl-btn-quiet";
      btn.textContent = actionLabel;
      btn.addEventListener("click", onAction);
      td.appendChild(document.createElement("br"));
      td.appendChild(btn);
    }
    tr.appendChild(td);
    body.appendChild(tr);
  }

  /* ------------------------------------------------------------- events -- */

  function loadEvents() {
    showState("Loading the dataset", "Reading the event log from this lab instance.");
    return fetch("/api/events")
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        allEvents = data.events || [];
        text($("dsmeta"),
          (data.dataset_version ? "dataset " + data.dataset_version + " " : "") +
          allEvents.length + " events");
        fillEventTypes();
        applyFilters();
      })
      .catch(function (err) {
        showState(
          "The event log did not load",
          "The request to /api/events failed (" + err.message + "). The lab " +
          "container may still be starting.",
          "Try again",
          loadEvents
        );
      });
  }

  function fillEventTypes() {
    var sel = $("f-type");
    if (!sel || !CFG.hostileField) return;
    var seen = {};
    allEvents.forEach(function (e) {
      var v = e[CFG.hostileField];
      if (v !== undefined && v !== null) seen[v] = true;
    });
    Object.keys(seen).sort().forEach(function (v) {
      var o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      sel.appendChild(o);
    });
  }

  function parseTs(v) {
    if (!v) return null;
    var t = Date.parse(v.length <= 10 ? v + "T00:00:00Z" : v);
    return isNaN(t) ? null : t;
  }

  function currentFilters() {
    var f = { q: "", from: null, to: null, fields: {} };
    var q = $("q");
    if (q) f.q = q.value.trim().toLowerCase();
    (CFG.filters || []).forEach(function (spec) {
      var el = $(spec.id);
      if (el && el.value.trim()) f.fields[spec.field] = el.value.trim().toLowerCase();
    });
    var from = $("f-from"), to = $("f-to");
    if (from) f.from = parseTs(from.value.trim());
    if (to) f.to = parseTs(to.value.trim());
    return f;
  }

  function matches(row, f) {
    if (f.q) {
      var hay = (CFG.searchFields || Object.keys(row))
        .map(function (k) { return String(row[k] === undefined ? "" : row[k]); })
        .join(" ").toLowerCase();
      if (hay.indexOf(f.q) === -1) return false;
    }
    for (var field in f.fields) {
      if (String(row[field] === undefined ? "" : row[field]).toLowerCase()
          .indexOf(f.fields[field]) === -1) return false;
    }
    if (f.from || f.to) {
      var t = Date.parse(row[CFG.timeField || "timestamp"]);
      if (!isNaN(t)) {
        if (f.from && t < f.from) return false;
        if (f.to && t > f.to) return false;
      }
    }
    return true;
  }

  function applyFilters() {
    var f = currentFilters();
    var rows = allEvents.filter(function (r) { return matches(r, f); });

    rows.sort(function (a, b) {
      var x = a[sortKey], y = b[sortKey];
      if (x === y) return 0;
      var r = (x === undefined ? "" : x) > (y === undefined ? "" : y) ? 1 : -1;
      return sortAsc ? r : -r;
    });

    var hostileShown = rows.filter(isHostile).length;
    text($("count"),
      rows.length === allEvents.length
        ? allEvents.length + " events"
        : rows.length + " of " + allEvents.length + " events" +
          (hostileShown ? ", " + hostileShown + " flagged" : ""));

    if (!rows.length) {
      showState(
        "No event matches these filters",
        "The dataset has " + allEvents.length + " events, but none match what is " +
        "set above. Widen the search or clear the filters.",
        "Clear filters",
        clearFilters
      );
      return;
    }
    renderRows(rows);
  }

  function renderRows(rows) {
    var body = $("rows");
    body.innerHTML = "";
    var frag = document.createDocumentFragment();

    rows.forEach(function (row) {
      var tr = document.createElement("tr");
      COLUMNS.forEach(function (col) {
        var td = document.createElement("td");
        if (col.cls) td.className = col.cls;
        var value = row[col.key];
        value = (value === undefined || value === null || value === "") ? "" : String(value);

        if (col.type === "event") {
          td.className = (col.cls ? col.cls + " " : "") + "rl-event";
          var mark = document.createElement("span");
          mark.className = "rl-mark" + (isHostile(row) ? " is-hostile" : "");
          mark.setAttribute("aria-hidden", "true");
          td.appendChild(mark);
          td.appendChild(document.createTextNode(value));
        } else {
          td.textContent = value;
        }
        tr.appendChild(td);
      });
      frag.appendChild(tr);
    });
    body.appendChild(frag);
  }

  function clearFilters() {
    var q = $("q");
    if (q) q.value = "";
    (CFG.filters || []).forEach(function (s) { var el = $(s.id); if (el) el.value = ""; });
    ["f-type", "f-from", "f-to"].forEach(function (id) { var el = $(id); if (el) el.value = ""; });
    applyFilters();
  }

  function wireTable() {
    var q = $("q");
    if (q) q.addEventListener("input", applyFilters);
    (CFG.filters || []).forEach(function (s) {
      var el = $(s.id);
      if (el) el.addEventListener("input", applyFilters);
    });
    ["f-from", "f-to"].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener("input", applyFilters);
    });
    var sel = $("f-type");
    if (sel) sel.addEventListener("change", applyFilters);
    var clear = $("clearBtn");
    if (clear) clear.addEventListener("click", clearFilters);

    document.querySelectorAll("th.sortable").forEach(function (th) {
      th.addEventListener("click", function () {
        var key = th.dataset.sort;
        if (sortKey === key) sortAsc = !sortAsc;
        else { sortKey = key; sortAsc = true; }
        document.querySelectorAll("th.sortable .dir").forEach(function (d) { d.textContent = ""; });
        var dir = th.querySelector(".dir");
        if (dir) dir.textContent = sortAsc ? " ascending" : " descending";
        applyFilters();
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    wireTable();
    loadEvents();
  });
})();

export function fmtMoney(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
  });
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function currentMonth() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

export function monthLabel(ym) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("en-CA", { month: "long", year: "numeric" });
}

// All YYYY-MM months from a start date to an end date (inclusive), clipped to a year.
export function monthsInYearForRange(startDate, endDate, year) {
  const months = [];
  const start = new Date(startDate + "T00:00:00");
  const end = endDate ? new Date(endDate + "T00:00:00") : new Date();
  const yearStart = new Date(`${year}-01-01T00:00:00`);
  const yearEnd = new Date(`${year}-12-01T00:00:00`);

  let cursor = start > yearStart ? start : yearStart;
  cursor = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const stop = end < yearEnd ? end : yearEnd;

  while (cursor <= stop) {
    months.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`
    );
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

export function normalizeName(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s&]/g, "")
    .trim();
}

// Loose match: true if either name's normalized tokens overlap meaningfully.
export function looseNameMatch(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const ta = na.split(/\s+|&/).filter(Boolean);
  const tb = nb.split(/\s+|&/).filter(Boolean);
  return ta.some((t) => t.length > 2 && tb.includes(t));
}

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function")
      node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

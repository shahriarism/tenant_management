import { Units, Tenancies, Payments } from "./db.js";
import { el, fmtMoney, monthsInYearForRange, monthLabel } from "./utils.js";

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

let selectedYear = new Date().getFullYear();

export async function renderPaymentsTab(container, ctx) {
  container.innerHTML = "";

  const header = el("div", { class: "tab-header" }, [
    el("h2", {}, "Payments"),
    yearPicker((y) => {
      selectedYear = y;
      renderPaymentsTab(container, ctx);
    }),
  ]);
  container.appendChild(header);

  const [units, tenancies] = await Promise.all([Units.list(), Tenancies.list()]);
  const relevantTenancies = tenancies.filter((t) => overlapsYear(t, selectedYear));

  if (relevantTenancies.length === 0) {
    container.appendChild(
      el(
        "p",
        { class: "empty-state" },
        `No tenancies recorded for ${selectedYear} yet. Add tenants in the Units & Tenants tab.`
      )
    );
    return;
  }

  await ensurePaymentsExist(relevantTenancies, selectedYear);
  const payments = await Payments.listByYear(selectedYear);
  const byKey = {};
  for (const p of payments) byKey[`${p.tenancyId}_${p.month}`] = p;

  const table = el("table", { class: "ledger-table" });
  const thead = el("thead", {}, [
    el("tr", {}, [
      el("th", { class: "sticky-col" }, "Unit / tenant"),
      ...MONTH_SHORT.map((m) => el("th", {}, m)),
      el("th", {}, "Year total"),
    ]),
  ]);
  table.appendChild(thead);

  const tbody = el("tbody");
  const monthlyTotals = Array(12).fill(0);
  let grandTotal = 0;

  for (const unit of units) {
    const unitTenancies = relevantTenancies
      .filter((t) => t.unitId === unit.id)
      .sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));
    for (const tenancy of unitTenancies) {
      const activeMonths = new Set(
        monthsInYearForRange(tenancy.startDate, tenancy.endDate, selectedYear)
      );
      let rowTotal = 0;
      const row = el("tr", {}, [
        el("td", { class: "sticky-col" }, [
          el("div", { class: "cell-unit" }, unit.name),
          el("div", { class: "cell-tenant" }, tenancy.tenantName),
        ]),
      ]);
      for (let m = 1; m <= 12; m++) {
        const ym = `${selectedYear}-${String(m).padStart(2, "0")}`;
        if (!activeMonths.has(ym)) {
          row.appendChild(el("td", { class: "cell-na" }, "—"));
          continue;
        }
        const payment = byKey[`${tenancy.id}_${ym}`];
        rowTotal += payment?.amountPaid || 0;
        monthlyTotals[m - 1] += payment?.amountPaid || 0;
        grandTotal += payment?.amountPaid || 0;
        row.appendChild(paymentCell(payment, tenancy, ym, container, ctx));
      }
      row.appendChild(el("td", { class: "cell-rowtotal" }, fmtMoney(rowTotal)));
      tbody.appendChild(row);
    }
  }
  table.appendChild(tbody);

  const tfoot = el("tfoot", {}, [
    el("tr", {}, [
      el("td", { class: "sticky-col" }, "Monthly total"),
      ...monthlyTotals.map((t) => el("td", {}, t ? fmtMoney(t) : "—")),
      el("td", { class: "cell-rowtotal" }, fmtMoney(grandTotal)),
    ]),
  ]);
  table.appendChild(tfoot);

  container.appendChild(table);
}

function overlapsYear(tenancy, year) {
  const start = tenancy.startDate?.slice(0, 4);
  const end = tenancy.endDate ? tenancy.endDate.slice(0, 4) : String(new Date().getFullYear());
  if (!start) return false;
  return Number(start) <= year && Number(end) >= year;
}

async function ensurePaymentsExist(tenancies, year) {
  const existing = await Payments.listByYear(year);
  const have = new Set(existing.map((p) => `${p.tenancyId}_${p.month}`));
  const toCreate = [];
  for (const t of tenancies) {
    for (const ym of monthsInYearForRange(t.startDate, t.endDate, year)) {
      if (!have.has(`${t.id}_${ym}`)) {
        toCreate.push({
          tenancyId: t.id,
          unitId: t.unitId,
          month: ym,
          amountDue: t.rentAmount,
          amountPaid: 0,
          status: "unpaid",
          datePaid: null,
          method: "",
          notes: "",
        });
      }
    }
  }
  await Promise.all(toCreate.map((p) => Payments.add(p)));
}

function paymentCell(payment, tenancy, ym, container, ctx) {
  const status = payment?.status || "unpaid";
  const td = el("td", { class: `cell-payment status-${status}` });
  const btn = el(
    "button",
    { class: "cell-btn", title: `${monthLabel(ym)} — click to edit` },
    status === "paid" ? "Paid" : status === "partial" ? "Partial" : "Unpaid"
  );
  btn.addEventListener("click", () =>
    openPaymentEditor(payment, tenancy, ym, container, ctx)
  );
  td.appendChild(btn);
  return td;
}

function openPaymentEditor(payment, tenancy, ym, container, ctx) {
  const form = el("form", { class: "modal-form" });
  form.appendChild(el("h3", {}, `${tenancy.tenantName} — ${monthLabel(ym)}`));

  const amountField = labeledInput(
    "Amount paid (CAD)",
    "number",
    "amountPaid",
    payment?.amountPaid ?? 0,
    { step: "0.01" }
  );
  const dueField = labeledInput(
    "Amount due (CAD)",
    "number",
    "amountDue",
    payment?.amountDue ?? tenancy.rentAmount,
    { step: "0.01" }
  );
  const dateField = labeledInput("Date paid", "date", "datePaid", payment?.datePaid || "");
  const methodField = el("label", { class: "form-field" }, [
    el("span", {}, "Method"),
    el(
      "select",
      { name: "method" },
      ["", "e-transfer", "cash", "cheque", "other"].map((m) =>
        el(
          "option",
          { value: m, ...(payment?.method === m ? { selected: "selected" } : {}) },
          m || "— not set —"
        )
      )
    ),
  ]);
  const notesField = labeledInput("Notes", "text", "notes", payment?.notes || "");

  form.append(dueField, amountField, dateField, methodField, notesField);
  form.appendChild(
    el("div", { class: "modal-actions" }, [
      el(
        "button",
        { type: "button", class: "btn btn-quiet", onclick: () => overlay.remove() },
        "Cancel"
      ),
      el("button", { type: "submit", class: "btn" }, "Save"),
    ])
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const amountPaid = Number(data.amountPaid) || 0;
    const amountDue = Number(data.amountDue) || 0;
    const status = amountPaid <= 0 ? "unpaid" : amountPaid < amountDue ? "partial" : "paid";
    const update = {
      amountPaid,
      amountDue,
      datePaid: data.datePaid || null,
      method: data.method,
      notes: data.notes || "",
      status,
    };
    if (payment) {
      await Payments.update(payment.id, update);
    } else {
      await Payments.add({
        tenancyId: tenancy.id,
        unitId: tenancy.unitId,
        month: ym,
        ...update,
      });
    }
    overlay.remove();
    ctx.toast("Payment updated.");
    renderPaymentsTab(container, ctx);
  });

  const overlay = el("div", { class: "modal-overlay" }, [form]);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}

function labeledInput(label, type, name, value, extra = {}) {
  const input = el("input", { type, name, ...extra });
  input.value = value;
  return el("label", { class: "form-field" }, [el("span", {}, label), input]);
}

function yearPicker(onChange) {
  const wrap = el("div", { class: "year-picker" });
  const select = el(
    "select",
    {},
    range(2023, new Date().getFullYear() + 1).map((y) =>
      el("option", { value: y, ...(y === selectedYear ? { selected: "selected" } : {}) }, String(y))
    )
  );
  select.value = String(selectedYear);
  select.addEventListener("change", () => onChange(Number(select.value)));
  wrap.appendChild(select);
  return wrap;
}

function range(a, b) {
  const out = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

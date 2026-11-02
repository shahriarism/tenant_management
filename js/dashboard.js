import { Units, Tenancies, Payments, Expenses } from "./db.js";
import { el, fmtMoney, currentMonth, monthLabel, todayISO } from "./utils.js";

const FLOOR_ORDER = ["Main Floor", "Basement"];

export async function renderDashboardTab(container, ctx) {
  container.innerHTML = "";
  container.appendChild(el("h2", {}, "Dashboard"));

  const [units, tenancies] = await Promise.all([Units.list(), Tenancies.list()]);
  const active = tenancies.filter((t) => !t.endDate);
  const thisMonth = currentMonth();

  container.appendChild(el("h3", { class: "section-label" }, monthLabel(thisMonth)));

  const unitsByFloor = {};
  for (const unit of units) {
    const floor = unit.floor || "Other";
    (unitsByFloor[floor] = unitsByFloor[floor] || []).push(unit);
  }
  const orderedFloors = [
    ...FLOOR_ORDER.filter((f) => unitsByFloor[f]),
    ...Object.keys(unitsByFloor).filter((f) => !FLOOR_ORDER.includes(f)),
  ];

  for (const floorName of orderedFloors) {
    container.appendChild(el("h3", { class: "floor-heading" }, floorName));
    const grid = el("div", { class: "dash-grid" });

    for (const unit of unitsByFloor[floorName]) {
      const tenancy = active.find((t) => t.unitId === unit.id);
      const card = el("div", { class: "dash-card" });
      card.appendChild(el("div", { class: "dash-unit-name" }, unit.name));
      if (!tenancy) {
        card.appendChild(el("div", { class: "dash-vacant" }, "Vacant"));
        grid.appendChild(card);
        continue;
      }

      const payment = await ensureCurrentPayment(tenancy, thisMonth);
      card.appendChild(el("div", { class: "dash-tenant-name" }, tenancy.tenantName));
      card.appendChild(el("div", { class: "dash-rent" }, fmtMoney(tenancy.rentAmount)));

      const statusBtn = el(
        "button",
        { class: `dash-status status-${payment.status}` },
        payment.status === "paid"
          ? "Paid ✓"
          : payment.status === "partial"
          ? "Partial"
          : "Mark as paid"
      );
      statusBtn.addEventListener("click", async () => {
        if (payment.status === "paid") return;
        await Payments.update(payment.id, {
          amountPaid: tenancy.rentAmount,
          status: "paid",
          datePaid: todayISO(),
          method: payment.method || "e-transfer",
        });
        renderDashboardTab(container, ctx);
      });
      card.appendChild(statusBtn);

      card.appendChild(renewalBlock(tenancy, container, ctx));
      grid.appendChild(card);
    }
    container.appendChild(grid);
  }

  container.appendChild(el("h3", { class: "section-label" }, "Revenue VS Expenses"));
  container.appendChild(await buildRevenueExpenseChart());
}

function renewalBlock(tenancy, container, ctx) {
  const date = tenancy.leaseRenewalDate;
  let tone = "";
  let text = "No renewal date set";
  if (date) {
    const days = Math.round(
      (new Date(date + "T00:00:00") - new Date(todayISO() + "T00:00:00")) / 86400000
    );
    text = `Lease renews ${date}`;
    if (days < 0) {
      tone = "renewal-overdue";
      text += ` (${Math.abs(days)}d overdue)`;
    } else if (days <= 60) {
      tone = "renewal-soon";
      text += ` (in ${days}d)`;
    }
  }
  const btn = el("button", { class: "dash-renew-btn" }, "Renewed");
  btn.addEventListener("click", () => openRenewedDialog(tenancy, container, ctx));
  return el("div", { class: "dash-renewal" }, [
    el("div", { class: `dash-renewal-text ${tone}` }, text),
    btn,
  ]);
}

function openRenewedDialog(tenancy, container, ctx) {
  const input = el("input", { type: "date", name: "leaseRenewalDate", required: "required" });
  input.value = tenancy.leaseRenewalDate || "";
  const form = el("form", { class: "modal-form" }, [
    el("h3", {}, `${tenancy.tenantName} — lease renewed`),
    el("label", { class: "form-field" }, [el("span", {}, "New renewal date"), input]),
    el("div", { class: "modal-actions" }, [
      el(
        "button",
        { type: "button", class: "btn btn-quiet", onclick: () => overlay.remove() },
        "Cancel"
      ),
      el("button", { type: "submit", class: "btn" }, "Save"),
    ]),
  ]);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await Tenancies.update(tenancy.id, { leaseRenewalDate: input.value });
    overlay.remove();
    ctx.toast("Renewal date updated.");
    renderDashboardTab(container, ctx);
  });
  const overlay = el("div", { class: "modal-overlay" }, [form]);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}

async function ensureCurrentPayment(tenancy, ym) {
  const existing = await Payments.listByTenancy(tenancy.id);
  const found = existing.find((p) => p.month === ym);
  if (found) return found;
  const data = {
    tenancyId: tenancy.id,
    unitId: tenancy.unitId,
    month: ym,
    amountDue: tenancy.rentAmount,
    amountPaid: 0,
    status: "unpaid",
    datePaid: null,
    method: "",
    notes: "",
  };
  const created = await Payments.add(data);
  return { id: created.id, ...data };
}

async function buildRevenueExpenseChart() {
  const year = new Date().getFullYear();
  const [payments, expenses] = await Promise.all([
    Payments.listByYear(year),
    Expenses.listByYear(year),
  ]);
  const revenue = payments.reduce((s, p) => s + (p.amountPaid || 0), 0);
  const spent = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const max = Math.max(1, revenue, spent);

  const row = (label, value, cls) => {
    const fill = el("div", { class: `hbar-fill ${cls}` });
    fill.style.width = `${Math.max(1, (value / max) * 100)}%`;
    return el("div", { class: "hbar-row" }, [
      el("div", { class: "hbar-label" }, label),
      el("div", { class: "hbar-track" }, [fill]),
      el("div", { class: "hbar-value" }, fmtMoney(value)),
    ]);
  };

  return el("div", { class: "hbar-chart" }, [
    el("div", { class: "hbar-year" }, String(year)),
    row("Revenue", revenue, "bar-revenue"),
    row("Expenses", spent, "bar-expense"),
  ]);
}

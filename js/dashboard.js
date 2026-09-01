import { Units, Tenancies, Payments, Expenses } from "./db.js";
import { el, fmtMoney, currentMonth, monthLabel } from "./utils.js";

export async function renderDashboardTab(container, ctx) {
  container.innerHTML = "";
  container.appendChild(el("h2", {}, "Dashboard"));

  const [units, tenancies] = await Promise.all([Units.list(), Tenancies.list()]);
  const active = tenancies.filter((t) => !t.endDate);
  const thisMonth = currentMonth();

  container.appendChild(el("h3", { class: "section-label" }, monthLabel(thisMonth)));
  const grid = el("div", { class: "dash-grid" });

  for (const unit of units) {
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
      payment.status === "paid" ? "Paid ✓" : payment.status === "partial" ? "Partial" : "Mark as paid"
    );
    statusBtn.addEventListener("click", async () => {
      if (payment.status === "paid") return;
      await Payments.update(payment.id, {
        amountPaid: tenancy.rentAmount,
        status: "paid",
        datePaid: new Date().toISOString().slice(0, 10),
        method: payment.method || "e-transfer",
      });
      renderDashboardTab(container, ctx);
    });
    card.appendChild(statusBtn);
    grid.appendChild(card);
  }
  container.appendChild(grid);

  container.appendChild(el("h3", { class: "section-label" }, "Revenue vs. expenses by year"));
  container.appendChild(await buildYearlyChart());
}

async function ensureCurrentPayment(tenancy, ym) {
  const existing = await Payments.listByTenancy(tenancy.id);
  const found = existing.find((p) => p.month === ym);
  if (found) return found;
  const created = await Payments.add({
    tenancyId: tenancy.id,
    unitId: tenancy.unitId,
    month: ym,
    amountDue: tenancy.rentAmount,
    amountPaid: 0,
    status: "unpaid",
    datePaid: null,
    method: "",
    notes: "",
  });
  return {
    id: created.id,
    tenancyId: tenancy.id,
    unitId: tenancy.unitId,
    month: ym,
    amountDue: tenancy.rentAmount,
    amountPaid: 0,
    status: "unpaid",
  };
}

async function buildYearlyChart() {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 2, currentYear - 1, currentYear];
  const data = [];
  for (const y of years) {
    const [payments, expenses] = await Promise.all([
      Payments.listByYear(y),
      Expenses.listByYear(y),
    ]);
    data.push({
      year: y,
      revenue: payments.reduce((s, p) => s + (p.amountPaid || 0), 0),
      expenses: expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0),
    });
  }
  const max = Math.max(1, ...data.map((d) => Math.max(d.revenue, d.expenses)));

  const chart = el("div", { class: "chart" });
  for (const d of data) {
    const group = el("div", { class: "chart-year-group" }, [
      el("div", { class: "chart-bars" }, [
        bar(d.revenue, max, "bar-revenue"),
        bar(d.expenses, max, "bar-expense"),
      ]),
      el("div", { class: "chart-year-label" }, String(d.year)),
    ]);
    chart.appendChild(group);
  }
  const legend = el("div", { class: "chart-legend" }, [
    el("span", { class: "legend-swatch legend-revenue" }, ""),
    el("span", {}, "Revenue"),
    el("span", { class: "legend-swatch legend-expense" }, ""),
    el("span", {}, "Expenses"),
  ]);
  const wrap = el("div", {}, [chart, legend]);
  return wrap;
}

function bar(value, max, cls) {
  const heightPct = Math.max(2, (value / max) * 100);
  const b = el("div", { class: `chart-bar ${cls}`, title: fmtMoney(value) });
  b.style.height = `${heightPct}%`;
  return b;
}

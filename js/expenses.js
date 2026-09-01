import { Expenses, Payments } from "./db.js";
import { el, fmtMoney } from "./utils.js";

const DEFAULT_CATEGORIES = [
  "Mortgage Interest",
  "Property Tax",
  "Insurance",
  "Hydro",
  "Gas",
  "Water",
  "Internet",
  "Hot Water Tank Rental",
  "Furnace Rental",
  "Heat Pump Rental",
  "Lawn / Snow Maintenance",
  "Property Upgrade / Improvement",
  "Repairs & Maintenance",
  "Cash for Keys",
];

let selectedYear = new Date().getFullYear();

export async function renderExpensesTab(container, ctx) {
  container.innerHTML = "";

  const header = el("div", { class: "tab-header" }, [
    el("h2", {}, "Expenses & profit/loss"),
    yearPicker((y) => {
      selectedYear = y;
      renderExpensesTab(container, ctx);
    }),
  ]);
  container.appendChild(header);

  const [expenses, payments] = await Promise.all([
    Expenses.listByYear(selectedYear),
    Payments.listByYear(selectedYear),
  ]);

  const revenue = payments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const netProfit = revenue - totalExpenses;

  container.appendChild(
    el("div", { class: "summary-strip" }, [
      summaryStat("Rent collected", revenue, "positive"),
      summaryStat("Total expenses", totalExpenses, "negative"),
      summaryStat("Net profit / loss", netProfit, netProfit >= 0 ? "positive" : "negative"),
    ])
  );

  const presentCategories = new Set(expenses.map((e) => e.category));
  const allCategories = [
    ...DEFAULT_CATEGORIES,
    ...[...presentCategories].filter((c) => !DEFAULT_CATEGORIES.includes(c)),
  ];

  const table = el("table", { class: "expense-table" });
  table.appendChild(
    el("thead", {}, [
      el("tr", {}, [
        el("th", {}, "Category"),
        el("th", {}, "Amount"),
        el("th", {}, "Notes"),
        el("th", {}, ""),
      ]),
    ])
  );
  const tbody = el("tbody");

  for (const cat of allCategories) {
    const existing = expenses.find((e) => e.category === cat);
    tbody.appendChild(expenseRow(cat, existing, container, ctx));
  }
  table.appendChild(tbody);
  container.appendChild(table);

  container.appendChild(
    el(
      "button",
      { class: "btn btn-quiet", onclick: () => openCustomCategoryForm(container, ctx) },
      "+ Add custom expense line"
    )
  );
}

function summaryStat(label, value, tone) {
  return el("div", { class: `summary-stat summary-${tone}` }, [
    el("div", { class: "summary-value" }, fmtMoney(value)),
    el("div", { class: "summary-label" }, label),
  ]);
}

function expenseRow(category, existing, container, ctx) {
  const amountInput = el("input", {
    type: "number",
    step: "0.01",
    placeholder: "0.00",
    class: "expense-amount-input",
  });
  amountInput.value = existing?.amount ?? "";

  const notesInput = el("input", {
    type: "text",
    placeholder: "optional",
    class: "expense-notes-input",
  });
  notesInput.value = existing?.notes ?? "";

  const save = async () => {
    const amount = Number(amountInput.value) || 0;
    const notes = notesInput.value;
    if (existing) {
      await Expenses.update(existing.id, { amount, notes });
    } else if (amount || notes) {
      const created = await Expenses.add({
        year: selectedYear,
        category,
        amount,
        notes,
      });
      existing = { id: created.id, year: selectedYear, category, amount, notes };
    }
    renderExpensesTab(container, ctx);
  };

  amountInput.addEventListener("change", save);
  notesInput.addEventListener("change", save);

  const removeBtn = existing
    ? el(
        "button",
        {
          class: "btn btn-link btn-sm",
          onclick: async () => {
            await Expenses.remove(existing.id);
            renderExpensesTab(container, ctx);
          },
        },
        "Clear"
      )
    : "";

  return el("tr", {}, [
    el("td", {}, category),
    el("td", {}, amountInput),
    el("td", {}, notesInput),
    el("td", {}, removeBtn),
  ]);
}

function openCustomCategoryForm(container, ctx) {
  const form = el("form", { class: "modal-form" }, [
    el("h3", {}, "Add a custom expense line"),
    el("label", { class: "form-field" }, [
      el("span", {}, "Category name"),
      el("input", { type: "text", name: "category", placeholder: "e.g. Legal fees" }),
    ]),
    el("label", { class: "form-field" }, [
      el("span", {}, "Amount (CAD)"),
      el("input", { type: "number", name: "amount", step: "0.01" }),
    ]),
    el("label", { class: "form-field" }, [
      el("span", {}, "Notes"),
      el("input", { type: "text", name: "notes" }),
    ]),
  ]);
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
    if (!data.category) return overlay.remove();
    await Expenses.add({
      year: selectedYear,
      category: data.category,
      amount: Number(data.amount) || 0,
      notes: data.notes || "",
    });
    overlay.remove();
    renderExpensesTab(container, ctx);
  });
  const overlay = el("div", { class: "modal-overlay" }, [form]);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
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

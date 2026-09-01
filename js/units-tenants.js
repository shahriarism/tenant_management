import { Units, Tenancies } from "./db.js";
import { el, fmtMoney, todayISO } from "./utils.js";

export async function renderUnitsTab(container, ctx) {
  container.innerHTML = "";
  const [units, tenancies] = await Promise.all([Units.list(), Tenancies.list()]);

  const header = el("div", { class: "tab-header" }, [
    el("h2", {}, "Units & tenants"),
    el(
      "button",
      { class: "btn btn-quiet", onclick: () => openUnitForm(container, ctx) },
      "+ Add unit"
    ),
  ]);
  container.appendChild(header);

  if (units.length === 0) {
    container.appendChild(
      el("p", { class: "empty-state" }, "No units yet. Add your first room or unit above.")
    );
    return;
  }

  const grid = el("div", { class: "unit-grid" });
  for (const unit of units) {
    const unitTenancies = tenancies
      .filter((t) => t.unitId === unit.id)
      .sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));
    const active = unitTenancies.find((t) => !t.endDate);
    const history = unitTenancies.filter((t) => t.endDate);

    const card = el("div", { class: "unit-card" });
    card.appendChild(
      el("div", { class: "unit-card-head" }, [
        el("h3", {}, unit.name),
        el("span", { class: "unit-floor-tag" }, unit.floor || ""),
      ])
    );

    if (active) {
      card.appendChild(
        el("div", { class: "tenancy-active" }, [
          el("div", { class: "tenancy-name" }, active.tenantName),
          el(
            "div",
            { class: "tenancy-meta" },
            `${fmtMoney(active.rentAmount)}/mo · since ${active.startDate}`
          ),
          el("div", { class: "tenancy-actions" }, [
            el(
              "button",
              {
                class: "btn btn-quiet btn-sm",
                onclick: () => openEditTenancyForm(container, ctx, active),
              },
              "Edit"
            ),
            el(
              "button",
              {
                class: "btn btn-quiet btn-sm",
                onclick: () => openMoveOutForm(container, ctx, unit, active),
              },
              "Tenant moving out"
            ),
          ]),
        ])
      );
    } else {
      card.appendChild(
        el("div", { class: "tenancy-empty" }, [
          el("p", {}, "Vacant — no active tenant."),
          el(
            "button",
            {
              class: "btn btn-sm",
              onclick: () => openNewTenancyForm(container, ctx, unit),
            },
            "+ Move in a tenant"
          ),
        ])
      );
    }

    if (active) {
      card.appendChild(
        el(
          "button",
          {
            class: "btn btn-link btn-sm",
            onclick: () => openNewTenancyForm(container, ctx, unit),
          },
          "Replace with a new tenant"
        )
      );
    }

    if (history.length) {
      const histWrap = el("details", { class: "tenancy-history" });
      histWrap.appendChild(el("summary", {}, `History (${history.length})`));
      const list = el("ul", {});
      for (const h of history) {
        list.appendChild(
          el(
            "li",
            {},
            `${h.tenantName} — ${fmtMoney(h.rentAmount)}/mo · ${h.startDate} to ${h.endDate}`
          )
        );
      }
      histWrap.appendChild(list);
      card.appendChild(histWrap);
    }

    grid.appendChild(card);
  }
  container.appendChild(grid);
}

function openUnitForm(container, ctx) {
  const overlay = formOverlay("Add a unit", [
    field("text", "name", "Unit name", "e.g. Main Floor – Room A"),
    selectField("floor", "Floor / area", ["Main Floor", "Basement", "Other"]),
  ]);
  overlay.onSubmit = async (data) => {
    await Units.add({ name: data.name, floor: data.floor, order: Date.now() });
    ctx.toast("Unit added.");
    ctx.refreshTab();
  };
  document.body.appendChild(overlay.node);
}

function openNewTenancyForm(container, ctx, unit) {
  const overlay = formOverlay(`Move a tenant into ${unit.name}`, [
    field("text", "tenantName", "Tenant name", "e.g. Priya Shah"),
    field("number", "rentAmount", "Monthly rent (CAD)", "850", { step: "0.01" }),
    field("date", "startDate", "Move-in date", "", { value: todayISO() }),
  ]);
  overlay.onSubmit = async (data) => {
    await Tenancies.add({
      unitId: unit.id,
      tenantName: data.tenantName,
      rentAmount: Number(data.rentAmount) || 0,
      startDate: data.startDate,
      endDate: null,
      status: "active",
    });
    ctx.toast("Tenant moved in.");
    ctx.refreshTab();
  };
  document.body.appendChild(overlay.node);
}

function openEditTenancyForm(container, ctx, tenancy) {
  const overlay = formOverlay(`Edit ${tenancy.tenantName}`, [
    field("text", "tenantName", "Tenant name", "", { value: tenancy.tenantName }),
    field("number", "rentAmount", "Monthly rent (CAD)", "", {
      value: tenancy.rentAmount,
      step: "0.01",
    }),
    field("date", "startDate", "Move-in date", "", { value: tenancy.startDate }),
  ]);
  overlay.onSubmit = async (data) => {
    await Tenancies.update(tenancy.id, {
      tenantName: data.tenantName,
      rentAmount: Number(data.rentAmount) || 0,
      startDate: data.startDate,
    });
    ctx.toast("Tenancy updated.");
    ctx.refreshTab();
  };
  document.body.appendChild(overlay.node);
}

function openMoveOutForm(container, ctx, unit, tenancy) {
  const overlay = formOverlay(`${tenancy.tenantName} is moving out`, [
    field("date", "endDate", "Move-out date", "", { value: todayISO() }),
  ]);
  overlay.node.querySelector("form").appendChild(
    el(
      "p",
      { class: "form-hint" },
      "This closes out their tenancy — all their past payments stay on record. You can add a new tenant to this unit right after."
    )
  );
  overlay.onSubmit = async (data) => {
    await Tenancies.update(tenancy.id, { endDate: data.endDate, status: "ended" });
    ctx.toast(`${tenancy.tenantName}'s tenancy closed.`);
    ctx.refreshTab();
    openNewTenancyForm(container, ctx, unit);
  };
  document.body.appendChild(overlay.node);
}

// ---------- tiny form-builder helpers ----------
function field(type, name, label, placeholder, extra = {}) {
  return { type, name, label, placeholder, extra };
}
function selectField(name, label, options) {
  return { type: "select", name, label, options };
}

function formOverlay(title, fields) {
  const form = el("form", { class: "modal-form" });
  form.appendChild(el("h3", {}, title));
  for (const f of fields) {
    const wrap = el("label", { class: "form-field" }, [el("span", {}, f.label)]);
    let input;
    if (f.type === "select") {
      input = el(
        "select",
        { name: f.name },
        f.options.map((o) => el("option", { value: o }, o))
      );
    } else {
      input = el("input", {
        type: f.type,
        name: f.name,
        placeholder: f.placeholder || "",
        ...(f.extra?.step ? { step: f.extra.step } : {}),
      });
      if (f.extra?.value !== undefined) input.value = f.extra.value;
    }
    wrap.appendChild(input);
    form.appendChild(wrap);
  }
  const actions = el("div", { class: "modal-actions" }, [
    el(
      "button",
      { type: "button", class: "btn btn-quiet", onclick: () => overlayNode.remove() },
      "Cancel"
    ),
    el("button", { type: "submit", class: "btn" }, "Save"),
  ]);
  form.appendChild(actions);

  const overlayNode = el("div", { class: "modal-overlay" }, [form]);
  overlayNode.addEventListener("click", (e) => {
    if (e.target === overlayNode) overlayNode.remove();
  });

  const result = { node: overlayNode, onSubmit: null };
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    if (result.onSubmit) await result.onSubmit(data);
    overlayNode.remove();
  });
  return result;
}

import { watchAuth, signIn, signOutUser, auth } from "./db.js";
import { el } from "./utils.js";
import { renderDashboardTab } from "./dashboard.js";
import { renderUnitsTab } from "./units-tenants.js";
import { renderPaymentsTab } from "./payments.js";
import { renderExpensesTab } from "./expenses.js";

// Logomark: a roofline that resolves into a checkmark (rent confirmed paid),
// over a ledger line with a "paid" dot — ties the house + bookkeeping concept
// together instead of a generic initials monogram.
const BRAND_MARK_SVG = `
<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M9 29 L32 12 L55 29" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="15" y="29" width="34" height="24" rx="2" stroke="currentColor" stroke-width="4"/>
  <line x1="21" y1="38" x2="38" y2="38" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
  <line x1="21" y1="46" x2="32" y2="46" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
  <circle cx="42.5" cy="46" r="3.4" fill="var(--paid)"/>
</svg>`;

const TABS = [
  { id: "dashboard", label: "Dashboard", render: renderDashboardTab },
  { id: "units", label: "Units & tenants", render: renderUnitsTab },
  { id: "payments", label: "Payments", render: renderPaymentsTab },
  { id: "expenses", label: "Expenses", render: renderExpensesTab },
];

let activeTab = "dashboard";

function toast(message, isError = false) {
  const node = el("div", { class: `toast ${isError ? "toast-error" : ""}` }, message);
  document.getElementById("toast-root").appendChild(node);
  requestAnimationFrame(() => node.classList.add("toast-visible"));
  setTimeout(() => {
    node.classList.remove("toast-visible");
    setTimeout(() => node.remove(), 300);
  }, 3200);
}

function buildCtx(contentEl) {
  return {
    toast,
    refreshTab: () => renderActiveTab(contentEl),
  };
}

function renderActiveTab(contentEl) {
  const tab = TABS.find((t) => t.id === activeTab);
  const ctx = buildCtx(contentEl);
  tab.render(contentEl, ctx).catch((e) => {
    console.error(e);
    toast("Something went wrong loading this tab.", true);
  });
}

function renderNav(navEl, contentEl) {
  navEl.innerHTML = "";
  for (const tab of TABS) {
    const btn = el(
      "button",
      {
        class: `nav-btn ${tab.id === activeTab ? "nav-btn-active" : ""}`,
        onclick: () => {
          activeTab = tab.id;
          renderNav(navEl, contentEl);
          renderActiveTab(contentEl);
        },
      },
      tab.label
    );
    navEl.appendChild(btn);
  }
}

function renderApp(user) {
  const root = document.getElementById("app-root");
  root.innerHTML = "";

  const sidebar = el("nav", { class: "sidebar" }, [
    el("div", { class: "brand" }, [
      el("div", { class: "brand-mark", html: BRAND_MARK_SVG }),
      el("div", { class: "brand-name" }, "Tenant Ledger"),
    ]),
  ]);
  const navList = el("div", { class: "nav-list" });
  sidebar.appendChild(navList);
  sidebar.appendChild(
    el("div", { class: "sidebar-footer" }, [
      el("div", { class: "user-email" }, user.email || ""),
      el(
        "button",
        { class: "btn btn-quiet btn-sm", onclick: () => signOutUser() },
        "Sign out"
      ),
    ])
  );

  const content = el("main", { class: "content" });
  root.appendChild(sidebar);
  root.appendChild(content);

  renderNav(navList, content);
  renderActiveTab(content);
}

function renderSignIn() {
  const root = document.getElementById("app-root");
  root.innerHTML = "";
  root.appendChild(
    el("div", { class: "signin-screen" }, [
      el("div", { class: "signin-card" }, [
        el("div", { class: "brand-mark brand-mark-lg", html: BRAND_MARK_SVG }),
        el("h1", {}, "Tenant Ledger"),
        el("p", {}, "Sign in with the Google account tied to your Firebase project."),
        el(
          "button",
          { class: "btn", onclick: () => signIn().catch((e) => console.error(e)) },
          "Sign in with Google"
        ),
      ]),
    ])
  );
}

watchAuth((user) => {
  if (user) renderApp(user);
  else renderSignIn();
});

// expose for debugging in the console if needed
window.__auth = auth;

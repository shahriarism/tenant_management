import { watchAuth, signIn, signOutUser, auth } from "./db.js";
import { el } from "./utils.js";
import { renderDashboardTab } from "./dashboard.js";
import { renderUnitsTab } from "./units-tenants.js";
import { renderPaymentsTab } from "./payments.js";
import { renderExpensesTab } from "./expenses.js";

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
      el("div", { class: "brand-mark" }, "TL"),
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
        el("div", { class: "brand-mark brand-mark-lg" }, "TL"),
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

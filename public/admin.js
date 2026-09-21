const state = { users: [], news: [], store: [], partners: [], team: [], creators: [], settings: {} };
const $ = (selector) => document.querySelector(selector);
const message = $("#admin-auth-message");

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Erro na solicitação.");
  return data;
}

async function boot() {
  try {
    const me = await request("/api/me");
    if (me.user?.role === "admin") showDashboard();
    else showAuth();
  } catch {
    showAuth();
  }
}

function showAuth() {
  $("#admin-auth").hidden = false;
  $("#dashboard").hidden = true;
}

function showDashboard() {
  $("#admin-auth").hidden = true;
  $("#dashboard").hidden = false;
  loadAll();
}

async function loadAll() {
  [state.users, state.news, state.store, state.partners, state.team, state.creators, state.settings] = await Promise.all([
    request("/api/admin/users"),
    request("/api/admin/news"),
    request("/api/admin/store"),
    request("/api/admin/partners"),
    request("/api/admin/team"),
    request("/api/admin/creators"),
    request("/api/admin/settings"),
  ]);
  $("#count-users").textContent = state.users.length;
  $("#count-news").textContent = state.news.length;
  $("#count-store").textContent = state.store.length;
  renderUsers();
  renderNews();
  renderStore();
  renderPartners();
  renderPeople(state.team, "#team-list", "team");
  renderPeople(state.creators, "#creators-list", "creator");
  renderSettings();
}

function renderUsers() {
  $("#users-table").innerHTML = state.users.map((user) => `
    <tr><td><strong>${esc(user.name)}</strong></td><td>${esc(user.email)}</td>
    <td><span class="role-pill role-${user.role === "admin" ? "administrador" : "usuario"}">${user.role === "admin" ? "Administrador" : "Usuário"}</span></td>
    <td>${user.email !== "rhuanprodutor3@gmail.com" ? `<button class="delete-button" data-delete-user="${esc(user.id)}">Excluir</button>` : "Principal"}</td></tr>
  `).join("");
}

function renderNews() {
  $("#news-list").innerHTML = state.news.map((item) => `
    <article class="content-list-card">
      ${item.image ? `<img src="${item.image}" alt="">` : '<div class="list-placeholder">F</div>'}
      <div><span class="eyebrow">${esc(item.category || "COMUNIDADE")}</span><h3>${esc(item.title)}</h3><p>${esc(item.body)}</p></div>
      <button class="card-delete" data-delete-news="${esc(item.id)}">Excluir</button>
    </article>
  `).join("") || "<p class=\"admin-muted\">Nenhuma notícia publicada.</p>";
}

function renderStore() {
  $("#store-list").innerHTML = state.store.map((item) => `
    <article class="content-list-card">
      ${item.image ? `<img src="${item.image}" alt="">` : '<div class="list-placeholder">F</div>'}
      <div><span class="eyebrow">${esc(item.category || "GERAL")}${item.featured ? " · MAIS VENDIDO" : ""}</span><h3>${esc(item.name)} <small>${esc(item.price)}</small></h3><p>${esc(item.description || "Sem descrição.")}</p></div>
      <button class="card-delete" data-delete-store="${esc(item.id)}">Excluir</button>
    </article>
  `).join("") || "<p class=\"admin-muted\">Nenhum item cadastrado.</p>";
}

function renderPartners() {
  $("#partners-list").innerHTML = state.partners.map((partner) => `
    <article class="content-list-card partner-admin-card">
      ${partner.image ? `<img src="${partner.image}" alt="">` : '<div class="list-placeholder">◆</div>'}
      <div><h3>${esc(partner.name)}</h3><p>${esc(partner.address)}${partner.description ? ` — ${esc(partner.description)}` : ""}</p></div>
      <button class="card-delete" data-delete-partner="${esc(partner.id)}">Excluir</button>
    </article>
  `).join("") || "<p class=\"admin-muted\">Nenhum servidor parceiro cadastrado.</p>";
}

function renderPeople(people, selector, type) {
  $(selector).innerHTML = people.map((person) => `
    <article class="content-list-card person-admin-card role-card role-${roleSlug(person.role)}">
      <img class="admin-person-face" src="https://mc-heads.net/avatar/${encodeURIComponent(person.skinNick || person.nick)}/64" alt="">
      <div class="person-admin-copy"><span class="person-role-badge">${esc(person.role)}</span><h3>${esc(person.nick)}</h3><p>${esc(person.discord)}${person.description ? ` — ${esc(person.description)}` : ""}</p></div>
      <button class="card-delete" data-delete-${type}="${esc(person.id)}">Excluir</button>
    </article>
  `).join("") || `<p class="admin-muted">Nenhuma pessoa cadastrada em ${type === "team" ? "Equipe" : "Creators"}.</p>`;
}

function roleSlug(role) {
  return String(role || "membro")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\+/g, "-plus")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "membro";
}

function renderSettings() {
  for (const [key, value] of Object.entries(state.settings)) {
    const field = $(`#settings-form [name="${key}"]`);
    if (field) field.value = value || "";
  }
  const rulesField = $("#rules-text");
  if (rulesField) rulesField.value = state.settings.rulesText || "";
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[character]));
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");
    if (file.size > 4_000_000) return reject(new Error("A imagem precisa ter no máximo 4 MB."));
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });
}

async function formPayload(form) {
  const payload = Object.fromEntries(new FormData(form));
  const file = form.querySelector('input[type="file"]')?.files?.[0];
  delete payload.imageFile;
  if (file) payload.image = await fileToDataUrl(file);
  return payload;
}

async function submitForm(form, url) {
  try {
    await request(url, { method: "POST", body: JSON.stringify(await formPayload(form)) });
    form.reset();
    await loadAll();
  } catch (error) {
    alert(error.message);
  }
}

$("#admin-auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "Aguarde...";
  const payload = {
    email: $("#admin-email").value,
    password: $("#admin-password").value,
    name: $("#admin-name").value,
  };
  try {
    const result = await request("/api/auth/login", { method: "POST", body: JSON.stringify(payload) });
    if (result.user?.role !== "admin") throw new Error("Este acesso não é administrador.");
    showDashboard();
  } catch (error) {
    if (error.message.includes("incorretos")) {
      try {
        const setup = await request("/api/auth/setup", { method: "POST", body: JSON.stringify(payload) });
        if (setup.user?.role === "admin") showDashboard();
      } catch (setupError) {
        message.textContent = setupError.message;
      }
    } else {
      message.textContent = error.message;
    }
  }
});

$("#logout-button").addEventListener("click", async () => {
  await request("/api/auth/logout", { method: "POST" });
  showAuth();
});

document.querySelectorAll(".admin-tabs button").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll(".admin-tabs button, .admin-tab").forEach((element) => element.classList.remove("active"));
  button.classList.add("active");
  $(`#tab-${button.dataset.tab}`).classList.add("active");
}));

$("#user-form").addEventListener("submit", (event) => { event.preventDefault(); submitForm(event.currentTarget, "/api/admin/users"); });
$("#news-form").addEventListener("submit", (event) => { event.preventDefault(); submitForm(event.currentTarget, "/api/admin/news"); });
$("#store-form").addEventListener("submit", (event) => { event.preventDefault(); submitForm(event.currentTarget, "/api/admin/store"); });
$("#partner-form").addEventListener("submit", (event) => { event.preventDefault(); submitForm(event.currentTarget, "/api/admin/partners"); });
$("#team-form").addEventListener("submit", (event) => { event.preventDefault(); submitForm(event.currentTarget, "/api/admin/team"); });
$("#creator-form").addEventListener("submit", (event) => { event.preventDefault(); submitForm(event.currentTarget, "/api/admin/creators"); });
$("#settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await request("/api/admin/settings", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
    alert("Configurações salvas.");
    await loadAll();
  } catch (error) {
    alert(error.message);
  }
});
$("#rules-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await request("/api/admin/settings", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
    alert("Regras salvas.");
    await loadAll();
  } catch (error) {
    alert(error.message);
  }
});

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-delete-user],[data-delete-news],[data-delete-store],[data-delete-partner],[data-delete-team],[data-delete-creator]");
  if (!target) return;
  const actions = [
    ["deleteUser", "users"],
    ["deleteNews", "news"],
    ["deleteStore", "store"],
    ["deletePartner", "partners"],
    ["deleteTeam", "team"],
    ["deleteCreator", "creators"],
  ];
  for (const [attribute, collection] of actions) {
    if (!target.dataset[attribute]) continue;
    if (!confirm("Excluir este registro?")) return;
    try {
      await request(`/api/admin/${collection}/${target.dataset[attribute]}`, { method: "DELETE" });
      await loadAll();
    } catch (error) {
      alert(error.message);
    }
    return;
  }
});

boot();
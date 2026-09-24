const toast = document.querySelector("#toast");
let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2200);
}

document.querySelectorAll("[data-copy]").forEach((button) => button.addEventListener("click", async () => {
  const value = button.dataset.copy;
  try {
    await navigator.clipboard.writeText(value);
    showToast(`${value} copiado!`);
  } catch {
    showToast(`IP do servidor: ${value}`);
  }
}));

const body = document.body;
const themeToggle = document.querySelector("#theme-toggle");
if (localStorage.getItem("flansland-theme") === "dark") {
  body.classList.add("dark-mode");
  themeToggle.textContent = "☀";
}
themeToggle.addEventListener("click", () => {
  const dark = body.classList.toggle("dark-mode");
  themeToggle.textContent = dark ? "☀" : "☾";
  localStorage.setItem("flansland-theme", dark ? "dark" : "light");
});

const menu = document.querySelector("#mobile-menu");
document.querySelector("#menu-open").addEventListener("click", () => menu.classList.add("open"));
document.querySelector("#mobile-close").addEventListener("click", () => menu.classList.remove("open"));
menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => menu.classList.remove("open")));
document.querySelector("#announcement-close").addEventListener("click", (event) => event.currentTarget.closest(".announcement").remove());
document.querySelector("#year").textContent = new Date().getFullYear();

const modal = document.querySelector("#auth-modal");
const authTitle = document.querySelector("#auth-title");
const authDescription = document.querySelector("#auth-description");
const authForm = document.querySelector("#auth-form");
const authName = document.querySelector("#auth-name");
const authNameWrap = document.querySelector("#auth-name-wrap");
const authMinecraft = document.querySelector("#auth-minecraft");
const authMinecraftWrap = document.querySelector("#auth-minecraft-wrap");
const authMessage = document.querySelector("#auth-message");
const oauthButtons = document.querySelectorAll("[data-oauth-provider]");

fetch("/api/auth/providers")
  .then((response) => response.json())
  .then((providers) => {
    oauthButtons.forEach((button) => {
      button.hidden = !providers[button.dataset.oauthProvider];
    });
  })
  .catch(() => {});

const oauthError = new URLSearchParams(window.location.search).get("message");
if (new URLSearchParams(window.location.search).get("oauth") === "error" && oauthError) {
  openAuth("login");
  authMessage.textContent = oauthError;
  window.history.replaceState({}, document.title, window.location.pathname);
}

function openAuth(mode) {
  modal.hidden = false;
  const register = mode === "register";
  authForm.dataset.mode = mode;
  authTitle.textContent = register ? "Criar sua conta" : "Entrar na Flansland";
  authDescription.textContent = register ? "Crie seu acesso à comunidade." : "Acesse sua conta Flansland.";
  authNameWrap.hidden = !register;
  authMinecraftWrap.hidden = !register;
  authMessage.textContent = "";
}
document.querySelectorAll("[data-auth]").forEach((link) => link.addEventListener("click", (event) => {
  event.preventDefault();
  openAuth(link.dataset.auth);
}));
document.querySelector("#auth-close").addEventListener("click", () => { modal.hidden = true; });

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authMessage.textContent = "Aguarde...";
  const mode = authForm.dataset.mode;
  const payload = {
    email: document.querySelector("#auth-email").value,
    password: document.querySelector("#auth-password").value,
  };
  if (mode === "register") payload.name = authName.value;
  if (mode === "register") payload.minecraftNick = authMinecraft.value;
  const response = await fetch(`/api/auth/${mode}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    authMessage.textContent = data.error || "Não foi possível concluir.";
    return;
  }
  modal.hidden = true;
  showToast(mode === "login" ? "Login realizado!" : "Conta criada com sucesso!");
  window.location.href = data.user?.role === "admin" ? "/admin" : "/cliente";
});

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[character]));
}

function renderDynamicContent(news, store) {
  const newsBox = document.querySelector("#dynamic-news .dynamic-items");
  const storeBox = document.querySelector("#store-preview .store-items");
  if (newsBox) {
    newsBox.innerHTML = news.slice(0, 4).map((item) => `
      <article class="dynamic-item ${item.image ? "has-image" : ""}">
        ${item.image ? `<img src="${item.image}" alt="">` : '<div class="dynamic-item-mark">F</div>'}
        <div><small>${escapeHtml(item.category || "COMUNIDADE")} · ${escapeHtml(item.date || "")}</small><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></div>
      </article>
    `).join("") || '<p class="empty-public">Nenhuma notícia nova ainda.</p>';
  }
  if (storeBox) {
    storeBox.innerHTML = store.slice(0, 4).map((item) => `
      <article class="store-item ${item.image ? "has-image" : ""}">
        ${item.image ? `<img src="${item.image}" alt="">` : '<div class="store-item-mark">◆</div>'}
        <div><small>${escapeHtml(item.category || "GERAL")}</small><h3>${escapeHtml(item.name)}</h3><strong>${escapeHtml(item.price || "Consulte na loja")}</strong></div>
      </article>
    `).join("") || '<p class="empty-public">A loja será atualizada em breve.</p>';
  }
}

function renderPartners(partners) {
  const track = document.querySelector("#partners-track");
  if (!track) return;
  const placeholder = { name: "Seu servidor pode aparecer aqui", address: "Cadastre pelo painel administrativo", description: "Crie uma parceria com a Flansland.", image: "" };
  const seen = new Set();
  const uniquePartners = partners.filter((partner) => {
    const key = partner.id || `${partner.name}|${partner.address}|${partner.link || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const items = uniquePartners.length ? uniquePartners : [placeholder];
  track.innerHTML = items.map((partner) => `
    <a class="partner-card" href="${escapeHtml(partner.link || "#parceiros")}" ${partner.link ? 'target="_blank" rel="noreferrer"' : ""}>
      ${partner.image ? `<img src="${partner.image}" alt="">` : '<span class="partner-logo">◆</span>'}
      <span><strong>${escapeHtml(partner.name)}</strong><small>${escapeHtml(partner.address)}</small></span><b>↗</b>
    </a>
  `).join("");
}

async function loadPublicContent() {
  try {
    const [settingsResponse, newsResponse, storeResponse, partnersResponse, statsResponse, discordResponse] = await Promise.all([
      fetch("/api/settings"), fetch("/api/news"), fetch("/api/store"), fetch("/api/partners"), fetch("/api/stats"), fetch("/api/discord/config"),
    ]);
    const settings = await settingsResponse.json();
    const news = await newsResponse.json();
    const store = await storeResponse.json();
    const partners = await partnersResponse.json();
    const stats = await statsResponse.json();
    const discordConfig = await discordResponse.json();
    const account = await fetch("/api/me").then((response) => response.json());
    if (account.user?.role === "user") {
      document.querySelectorAll("[data-auth]").forEach((element) => { element.hidden = true; });
      const accountNav = document.querySelector("#account-nav");
      if (accountNav) accountNav.hidden = false;
    }
    const statsMembers = document.querySelector("#registered-count");
    const newestMember = document.querySelector("#newest-member");
    if (statsMembers) statsMembers.textContent = stats.members;
    const onlineNumber = document.querySelector("#online-number");
     const onlinePlayers = Number(stats.minecraftOnline || 0);
     const maxPlayers = Number(stats.minecraftMax || 0);
     const minecraftStatus = stats.minecraftStatus || {};
     const onlineLabel = maxPlayers ? `${onlinePlayers} / ${maxPlayers}` : String(onlinePlayers);
     if (onlineNumber) onlineNumber.textContent = onlineLabel;
     const statsOnlineNumber = document.querySelector("#stats-online-number");
     if (statsOnlineNumber) statsOnlineNumber.textContent = onlineLabel;
     const playerCount = document.querySelector("#player-count");
     if (playerCount) playerCount.textContent = `${onlinePlayers} online • Clique para jogar`;
     const progress = document.querySelector(".progress span");
     if (progress) progress.style.width = `${maxPlayers ? Math.min(100, (onlinePlayers / maxPlayers) * 100) : 0}%`;
    const onlineBadge = document.querySelector(".online-badge");
    if (onlineBadge) {
      onlineBadge.textContent = minecraftStatus.isOnline ? "ONLINE" : "OFFLINE";
      onlineBadge.classList.toggle("offline", !minecraftStatus.isOnline);
    }
    const discordWidget = document.querySelector("[data-discord-widget]");
    if (discordWidget && discordConfig.widgetUrl) discordWidget.src = discordConfig.widgetUrl;
    document.querySelectorAll('a[href="https://dsc.gg/flansland"]').forEach((link) => {
      if (discordConfig.inviteUrl) link.href = discordConfig.inviteUrl;
    });
    if (newestMember) {
      newestMember.textContent = stats.lastMinecraftEntry
        ? `${stats.lastMinecraftEntry.nick} · ${new Date(stats.lastMinecraftEntry.joinedAt).toLocaleString("pt-BR")}`
        : "Nenhuma entrada registrada";
    }
    const heroIp = document.querySelector("#hero-server-ip");
    if (heroIp) heroIp.textContent = settings.serverIp || "flansland.fun";
    document.querySelectorAll('a[href*="discord.gg"],a[href*="dsc.gg"]').forEach((link) => {
      if (settings.discordUrl) link.href = settings.discordUrl;
    });
    document.querySelectorAll(".brand span").forEach((brandName) => { brandName.textContent = settings.siteName || "Flansland"; });
    document.title = `${settings.siteName || "Flansland"} • Início`;
    document.querySelectorAll("[data-copy]").forEach((element) => { element.dataset.copy = settings.serverIp || "flansland.fun"; });
    const announcementTitle = document.querySelector("#announcement strong");
    const announcementText = document.querySelector("#announcement p");
    if (announcementTitle) announcementTitle.textContent = settings.announcementTitle;
    if (announcementText) announcementText.textContent = settings.announcementText;
    renderDynamicContent(news, [...store.filter((item) => item.featured), ...store.filter((item) => !item.featured)]);
    renderPartners(partners);
  } catch (error) {
    console.warn("Conteúdo dinâmico indisponível", error);
  }
}
loadPublicContent();
window.setInterval(loadPublicContent, 15000);
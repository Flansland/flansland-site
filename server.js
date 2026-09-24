const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { URL } = require("node:url");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const ADMIN_EMAIL = "rhuanprodutor3@gmail.com";
const MINECRAFT_API_KEY = process.env.MINECRAFT_API_KEY || "";
const MINECRAFT_STATUS_TIMEOUT_MS = Math.max(30_000, Number(process.env.MINECRAFT_STATUS_TIMEOUT_MS || 90_000));
const MINECRAFT_PINGER_HOST = "expressing-pursue.tun.ply.gg:23012";
const PUBLIC_URL = String(process.env.PUBLIC_URL || "").replace(/\/+$/, "");
const DISCORD_SERVER_ID = process.env.DISCORD_SERVER_ID || "1549100473506734160";
const DISCORD_INVITE_URL = process.env.DISCORD_INVITE_URL || "https://dsc.gg/flansland";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || "";
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || "";
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_FILE = path.join(ROOT, "data.json");
const sessions = new Map();
const oauthStates = new Map();

const DEFAULT_SETTINGS = {
  siteName: "Flansland",
  serverIp: "flansland.fun",
  discordUrl: "https://dsc.gg/flansland",
  announcementTitle: "Novidades da Flansland",
  announcementText: "Entre no servidor e acompanhe os próximos eventos da comunidade.",
  rulesText: `📜 Regras

Este servidor foi estabelecido para promover um ambiente harmonioso e bem organizado. Ao se juntar, você aceita os regulamentos a seguir.

1️⃣ Convivência e respeito
É estritamente proibido qualquer tipo de desrespeito. Isso inclui insultos, ameaças, discriminação, discursos de ódio, perseguições, assédios ou a divulgação de dados pessoais. Comentários provocativos, insinuações e ataques contra a equipe ou outros participantes podem resultar em punições imediatas.

2️⃣ Divulgação e autopromoção
A divulgação de servidores, redes sociais, canais, produtos, serviços, links externos ou qualquer tipo de propaganda é vetada sem a autorização prévia da equipe. Propagar cheats, hacks, exploits ou outros conteúdos ilegais é absolutamente proibido.

3️⃣ Uso do chat
É importante evitar mensagens repetitivas, flood, spam, uso excessivo de CAPS LOCK, correntes ou qualquer poluição visual no chat. Comportamentos que impeçam a comunicação adequada serão punidos.

4️⃣ Conduta inadequada
Comportamentos que tenham como objetivo provocar, confundir ou prejudicar outros usuários são inaceitáveis. Isso inclui fingir ser outra pessoa, abusar de menções, usar bots de forma inadequada, ou tentar burlar regras ou sistemas do servidor.

5️⃣ Conteúdo permitido
Todo material compartilhado deve ser adequado para todas as idades. É proibido divulgar conteúdo NSFW, ilegal ou ofensivo. Os usuários devem obedecer aos Termos e Diretrizes do Discord.

6️⃣ Desordem e tumulto
Criar confusão intencionalmente, incentivar brigas, espalhar rumores ou tentar desestabilizar o servidor vai contra o propósito da comunidade e resultará em punição.

7️⃣ Autoridade da staff
A equipe admin possui total autoridade para interpretar e aplicar as regras. As punições podem variar de acordo com a gravidade da infração e podem ser aplicadas sem aviso prévio.

Flansland — Todos os direitos reservados.`,
};

function id(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function checkPassword(password, stored) {
  const [salt, expected] = String(stored || "").split(":");
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function emptyData() {
  return { users: [], news: [], store: [], partners: [], team: [], creators: [], minecraftPlayers: [], minecraftStatus: { online: 0, max: 0, updatedAt: null }, settings: { ...DEFAULT_SETTINGS } };
}

function readData() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return {
      ...emptyData(),
      ...parsed,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
      partners: Array.isArray(parsed.partners) ? parsed.partners : [],
      team: Array.isArray(parsed.team) ? parsed.team : [],
      creators: Array.isArray(parsed.creators) ? parsed.creators : [],
      minecraftPlayers: Array.isArray(parsed.minecraftPlayers) ? parsed.minecraftPlayers : [],
      minecraftStatus: { online: 0, max: 0, updatedAt: null, ...(parsed.minecraftStatus || {}) },
    };
  } catch {
    const data = emptyData();
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return data;
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let data = readData();
if (data.settings.discordUrl === "https://discord.gg/Kfxv2sCrHb") {
  data.settings.discordUrl = DEFAULT_SETTINGS.discordUrl;
  writeData(data);
}
if (!data.users.some((user) => user.role === "admin") && process.env.ADMIN_PASSWORD) {
  data.users.push({
    id: id("usr"),
    name: "Administrador",
    email: ADMIN_EMAIL,
    role: "admin",
    passwordHash: hashPassword(process.env.ADMIN_PASSWORD),
    createdAt: new Date().toISOString(),
  });
  writeData(data);
  console.log(`Administrador criado para ${ADMIN_EMAIL}.`);
}

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

function safeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    minecraftNick: user.minecraftNick || "",
    minecraftUuid: user.minecraftUuid || "",
    minecraftLastSeen: user.minecraftLastSeen || null,
    authProvider: user.oauthProvider || "password",
    avatar: user.avatar || "",
  };
}

function parseCookies(request) {
  return Object.fromEntries((request.headers.cookie || "").split(";").filter(Boolean).map((part) => {
    const index = part.indexOf("=");
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }));
}

function currentUser(request) {
  const token = parseCookies(request).flansland_session;
  const session = sessions.get(token);
  if (!session || session.expires < Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }
  return data.users.find((user) => user.id === session.userId) || null;
}

function requireAdmin(request, response) {
  const user = currentUser(request);
  if (!user || user.role !== "admin") {
    json(response, 401, { error: "Acesso administrativo necessário." });
    return null;
  }
  return user;
}

function createSession(response, user) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { userId: user.id, expires: Date.now() + 1000 * 60 * 60 * 24 * 7 });
  response.setHeader("Set-Cookie", `flansland_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`);
}

function redirect(response, location) {
  response.writeHead(302, { Location: location, "Cache-Control": "no-store" });
  response.end();
}

function publicOrigin(request) {
  if (PUBLIC_URL) return PUBLIC_URL;
  const forwardedProto = String(request.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const protocol = forwardedProto || (request.socket.encrypted ? "https" : "http");
  return `${protocol}://${request.headers.host || "localhost:${PORT}"}`;
}

function oauthRedirectUri(provider, request) {
  return `${publicOrigin(request)}/auth/${provider}/callback`;
}

function oauthProviderConfig(provider, request) {
  if (provider === "google") {
    return {
      name: "Google",
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      redirectUri: oauthRedirectUri("google", request),
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
    };
  }
  if (provider === "discord") {
    return {
      name: "Discord",
      clientId: DISCORD_CLIENT_ID,
      clientSecret: DISCORD_CLIENT_SECRET,
      redirectUri: oauthRedirectUri("discord", request),
      authorizationUrl: "https://discord.com/oauth2/authorize",
      tokenUrl: "https://discord.com/api/oauth2/token",
    };
  }
  return null;
}

function isOAuthConfigured(provider) {
  return provider === "google"
    ? Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET)
    : provider === "discord"
      ? Boolean(DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET)
      : false;
}

function createOAuthState(provider) {
  const state = crypto.randomBytes(24).toString("hex");
  oauthStates.set(state, { provider, expires: Date.now() + 10 * 60 * 1000 });
  return state;
}

function consumeOAuthState(state, provider) {
  const saved = oauthStates.get(state);
  oauthStates.delete(state);
  return Boolean(saved && saved.provider === provider && saved.expires > Date.now());
}

function oauthErrorUrl(message) {
  return `/?oauth=error&message=${encodeURIComponent(message)}`;
}

async function exchangeOAuthCode(provider, code, request) {
  const config = oauthProviderConfig(provider, request);
  const tokenResponse = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
    }),
  });
  const token = await tokenResponse.json();
  if (!tokenResponse.ok || !token.access_token) throw new Error(`${config.name} não autorizou o login.`);

  const userResponse = await fetch(provider === "google"
    ? "https://openidconnect.googleapis.com/v1/userinfo"
    : "https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const profile = await userResponse.json();
  const providerId = provider === "google" ? profile.sub : profile.id;
  if (!userResponse.ok || !providerId) throw new Error(`Não foi possível carregar a conta do ${config.name}.`);
  profile.id = providerId;
  return profile;
}

function userFromOAuth(provider, profile) {
  const providerId = String(profile.id);
  const email = String(profile.email || `${provider}-${providerId}@oauth.flansland.local`).toLowerCase();
  const existing = data.users.find((user) => (
    (user.oauthProvider === provider && user.oauthId === providerId) || user.email === email
  ));
  if (existing) {
    existing.oauthProvider = provider;
    existing.oauthId = providerId;
    existing.avatar = provider === "google"
      ? String(profile.picture || "")
      : profile.avatar ? `https://cdn.discordapp.com/avatars/${providerId}/${profile.avatar}.png` : "";
    if (!existing.name) existing.name = text(profile.name || profile.global_name || profile.username, "Jogador").slice(0, 80);
    return existing;
  }
  if (email === ADMIN_EMAIL) return null;
  const user = {
    id: id("usr"),
    name: text(profile.name || profile.global_name || profile.username, "Jogador").slice(0, 80),
    email,
    role: "user",
    passwordHash: "",
    oauthProvider: provider,
    oauthId: providerId,
    avatar: provider === "google"
      ? String(profile.picture || "")
      : profile.avatar ? `https://cdn.discordapp.com/avatars/${providerId}/${profile.avatar}.png` : "",
    createdAt: new Date().toISOString(),
  };
  data.users.push(user);
  return user;
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 8_000_000) request.destroy();
    });
    request.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error("JSON inválido.")); }
    });
    request.on("error", reject);
  });
}

function text(value, fallback = "") {
  return String(value ?? fallback).trim().slice(0, 5000);
}

function image(value) {
  const candidate = String(value || "");
  return candidate.startsWith("data:image/") ? candidate.slice(0, 6_000_000) : "";
}

function pluginIsAuthorized(request) {
  return Boolean(MINECRAFT_API_KEY) && request.headers["x-api-key"] === MINECRAFT_API_KEY;
}

function latestMinecraftEntry() {
  return [...data.minecraftPlayers].sort((a, b) => String(b.joinedAt).localeCompare(String(a.joinedAt)))[0] || null;
}

function minecraftStatusSnapshot() {
  const updatedAt = data.minecraftStatus.updatedAt || null;
  const updatedTime = updatedAt ? Date.parse(updatedAt) : NaN;
  const isOnline = Number.isFinite(updatedTime) && Date.now() - updatedTime <= MINECRAFT_STATUS_TIMEOUT_MS;
  const max = Math.max(0, Number(data.minecraftStatus.max) || 0);
  const online = isOnline ? Math.min(max || Number.MAX_SAFE_INTEGER, Math.max(0, Number(data.minecraftStatus.online) || 0)) : 0;
  return {
    online,
    max,
    onlinePlayers: online,
    maxPlayers: max,
    isOnline,
    stale: !isOnline,
    updatedAt,
    timeoutSeconds: Math.round(MINECRAFT_STATUS_TIMEOUT_MS / 1000),
  };
}

async function minecraftPingerStatus() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(
      `https://www.minecraftpinger.com/api/v1/${MINECRAFT_PINGER_HOST}`,
      {
        headers: {
          "User-Agent": "Flansland-Website/1.0",
          "Accept": "application/json",
        },
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      throw new Error(`MinecraftPinger HTTP ${response.status}`);
    }

    const result = await response.json();

    if (result.message !== "ok" || !result.server) {
      return {
        online: false,
        players: 0,
        max: 0,
      };
    }

    return {
      online: true,
      players: Number(result.server.players?.online) || 0,
      max: Number(result.server.players?.max) || 0,
      ip: result.server.ip || MINECRAFT_PINGER_HOST.split(":")[0],
      port: Number(result.server.port) || 23012,
      motd: result.server.motd || "",
      version: result.server.version || "",
      ping: Number(result.server.ping) || 0,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function api(request, response, url) {
  const body = ["POST", "PUT", "PATCH"].includes(request.method) ? await readBody(request) : {};
  const route = url.pathname;
    if (request.method === "GET" && route === "/api/minecraft/pinger") {
    try {
      const status = await minecraftPingerStatus();
      return json(response, 200, status);
    } catch (error) {
      console.error("Erro no MinecraftPinger:", error.message);

      return json(response, 200, {
        online: false,
        players: 0,
        max: 0,
      });
    }
  }

  if (request.method === "GET" && route === "/api/auth/providers") {
    return json(response, 200, {
      google: isOAuthConfigured("google"),
      discord: isOAuthConfigured("discord"),
    });
  }
  if (request.method === "GET" && route === "/api/discord/config") {
    return json(response, 200, {
      serverId: DISCORD_SERVER_ID,
      inviteUrl: DISCORD_INVITE_URL,
      widgetUrl: `https://discord.com/widget?id=${encodeURIComponent(DISCORD_SERVER_ID)}&theme=dark`,
    });
  }
  if (request.method === "GET" && route === "/api/me") {
    return json(response, 200, { user: safeUser(currentUser(request)) });
  }
  if (request.method === "GET" && route === "/api/minecraft/latest") {
    const entry = latestMinecraftEntry();
    return json(response, 200, { entry });
  }
  if (request.method === "GET" && route === "/api/minecraft/status") return json(response, 200, minecraftStatusSnapshot());
  if ((request.method === "POST" && (route === "/api/minecraft/player-join" || route === "/api/minecraft/heartbeat"))) {
    if (!MINECRAFT_API_KEY) return json(response, 503, { error: "A API do Minecraft ainda não foi configurada no servidor." });
    if (!pluginIsAuthorized(request)) return json(response, 401, { error: "Chave da API do Minecraft inválida." });
    if (route === "/api/minecraft/heartbeat") {
      if (Number.isFinite(Number(body.onlinePlayers))) data.minecraftStatus.online = Math.floor(Math.max(0, Number(body.onlinePlayers)));
      if (Number.isFinite(Number(body.maxPlayers))) data.minecraftStatus.max = Math.floor(Math.max(0, Number(body.maxPlayers)));
      if (data.minecraftStatus.max > 0) data.minecraftStatus.online = Math.min(data.minecraftStatus.online, data.minecraftStatus.max);
      data.minecraftStatus.updatedAt = new Date().toISOString();
      writeData(data);
      return json(response, 200, { ok: true, status: minecraftStatusSnapshot() });
    }
    const nick = text(body.nick || body.username, "").slice(0, 32);
    if (!nick) return json(response, 400, { error: "Informe o nick do jogador." });
    const joinedAt = body.joinedAt && !Number.isNaN(Date.parse(body.joinedAt)) ? new Date(body.joinedAt).toISOString() : new Date().toISOString();
    const uuid = text(body.uuid, "").slice(0, 64);
    if (Number.isFinite(Number(body.onlinePlayers))) data.minecraftStatus.online = Math.floor(Math.max(0, Number(body.onlinePlayers)));
    if (Number.isFinite(Number(body.maxPlayers))) data.minecraftStatus.max = Math.floor(Math.max(0, Number(body.maxPlayers)));
    if (data.minecraftStatus.max > 0) data.minecraftStatus.online = Math.min(data.minecraftStatus.online, data.minecraftStatus.max);
    if (body.onlinePlayers !== undefined || body.maxPlayers !== undefined) data.minecraftStatus.updatedAt = new Date().toISOString();
    const existingIndex = data.minecraftPlayers.findIndex((player) => (uuid && player.uuid === uuid) || player.nick.toLowerCase() === nick.toLowerCase());
    const player = {
      id: existingIndex >= 0 ? data.minecraftPlayers[existingIndex].id : id("mc"),
      nick,
      uuid,
      joinedAt,
      updatedAt: new Date().toISOString(),
    };
    if (existingIndex >= 0) data.minecraftPlayers[existingIndex] = player;
    else data.minecraftPlayers.push(player);
    const accountEmail = text(body.accountEmail).toLowerCase();
    const linkedUser = data.users.find((user) => (accountEmail && user.email === accountEmail) || (user.minecraftNick && user.minecraftNick.toLowerCase() === nick.toLowerCase()));
    if (linkedUser) {
      linkedUser.minecraftNick = nick;
      linkedUser.minecraftUuid = uuid;
      linkedUser.minecraftLastSeen = joinedAt;
    }
    writeData(data);
    return json(response, 200, { ok: true, player, user: safeUser(linkedUser) });
  }
  if (request.method === "GET" && route === "/api/news") return json(response, 200, data.news);
  if (request.method === "GET" && route === "/api/store") return json(response, 200, data.store);
  if (request.method === "GET" && route === "/api/settings") return json(response, 200, data.settings);
  if (request.method === "GET" && route === "/api/partners") return json(response, 200, data.partners);
  if (request.method === "GET" && route === "/api/team") return json(response, 200, data.team);
  if (request.method === "GET" && route === "/api/creators") return json(response, 200, data.creators);
  if (request.method === "GET" && route === "/api/stats") {
    const members = data.users.filter((user) => user.role !== "admin");
    const newestUser = [...members].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
    const minecraftStatus = minecraftStatusSnapshot();
    return json(response, 200, {
      members: members.length,
      news: data.news.length,
      products: data.store.length,
      partners: data.partners.length,
      newestMember: newestUser ? newestUser.name : "Nenhuma conta ainda",
      lastMinecraftEntry: latestMinecraftEntry(),
      minecraftOnline: minecraftStatus.online,
      minecraftMax: minecraftStatus.max,
      minecraftStatus,
    });
  }

  if (request.method === "POST" && route === "/api/auth/setup") {
    if (data.users.some((user) => user.role === "admin")) return json(response, 409, { error: "O administrador já foi configurado." });
    const email = text(body.email).toLowerCase();
    const password = String(body.password || "");
    if (email !== ADMIN_EMAIL) return json(response, 403, { error: "Este e-mail não tem permissão de administrador." });
    if (password.length < 8) return json(response, 400, { error: "A senha precisa ter pelo menos 8 caracteres." });
    const admin = { id: id("usr"), name: "Administrador", email, role: "admin", passwordHash: hashPassword(password), createdAt: new Date().toISOString() };
    data.users.push(admin);
    writeData(data);
    createSession(response, admin);
    return json(response, 201, { user: safeUser(admin) });
  }

  if (request.method === "POST" && (route === "/api/auth/login" || route === "/api/auth/register")) {
    const email = text(body.email).toLowerCase();
    const password = String(body.password || "");
    if (route.endsWith("register")) {
      if (!email || !password || !text(body.name)) return json(response, 400, { error: "Preencha nome, e-mail e senha." });
      if (email === ADMIN_EMAIL) return json(response, 403, { error: "Use a configuração do administrador para este e-mail." });
      if (data.users.some((user) => user.email === email)) return json(response, 409, { error: "Este e-mail já está cadastrado." });
      const user = { id: id("usr"), name: text(body.name, "Jogador"), email, role: "user", minecraftNick: text(body.minecraftNick, "").slice(0, 32), passwordHash: hashPassword(password), createdAt: new Date().toISOString() };
      data.users.push(user);
      writeData(data);
      createSession(response, user);
      return json(response, 201, { user: safeUser(user) });
    }
    const user = data.users.find((candidate) => candidate.email === email);
    if (!user || !checkPassword(password, user.passwordHash)) return json(response, 401, { error: "E-mail ou senha incorretos." });
    createSession(response, user);
    return json(response, 200, { user: safeUser(user) });
  }

  if (request.method === "POST" && route === "/api/auth/logout") {
    const token = parseCookies(request).flansland_session;
    sessions.delete(token);
    response.setHeader("Set-Cookie", "flansland_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
    return json(response, 200, { ok: true });
  }

  if (request.method === "PUT" && route === "/api/me/profile") {
    const user = currentUser(request);
    if (!user) return json(response, 401, { error: "Faça login para editar o perfil." });
    if (body.name !== undefined) user.name = text(body.name, user.name).slice(0, 80);
    if (body.minecraftNick !== undefined) user.minecraftNick = text(body.minecraftNick).slice(0, 32);
    writeData(data);
    return json(response, 200, { user: safeUser(user) });
  }

  const admin = requireAdmin(request, response);
  if (!admin) return;
  if (request.method === "GET" && route === "/api/admin/users") return json(response, 200, data.users.map(safeUser));
  if (request.method === "GET" && route === "/api/admin/settings") return json(response, 200, data.settings);
  if (request.method === "GET" && route === "/api/admin/partners") return json(response, 200, data.partners);
  if (request.method === "GET" && route === "/api/admin/team") return json(response, 200, data.team);
  if (request.method === "GET" && route === "/api/admin/creators") return json(response, 200, data.creators);

  if (request.method === "POST" && route === "/api/admin/users") {
    const email = text(body.email).toLowerCase();
    if (!email || !text(body.name) || String(body.password || "").length < 8) return json(response, 400, { error: "Nome, e-mail e senha com pelo menos 8 caracteres são obrigatórios." });
    if (data.users.some((user) => user.email === email)) return json(response, 409, { error: "Este e-mail já existe." });
    const user = { id: id("usr"), name: text(body.name), email, role: body.role === "admin" ? "admin" : "user", passwordHash: hashPassword(String(body.password)), createdAt: new Date().toISOString() };
    data.users.push(user);
    writeData(data);
    return json(response, 201, { user: safeUser(user) });
  }

  const userMatch = route.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (userMatch && request.method === "DELETE") {
    if (userMatch[1] === admin.id) return json(response, 400, { error: "Você não pode excluir o próprio acesso." });
    data.users = data.users.filter((user) => user.id !== userMatch[1]);
    writeData(data);
    return json(response, 200, { ok: true });
  }

  if (request.method === "POST" && route === "/api/admin/settings") {
    const allowed = Object.keys(DEFAULT_SETTINGS);
    for (const key of allowed) if (body[key] !== undefined) data.settings[key] = text(body[key], DEFAULT_SETTINGS[key]);
    writeData(data);
    return json(response, 200, { settings: data.settings });
  }

  if (request.method === "POST" && route === "/api/admin/partners") {
    const partner = {
      id: id("partner"),
      name: text(body.name),
      address: text(body.address),
      description: text(body.description),
      link: text(body.link),
      image: image(body.image),
    };
    if (!partner.name || !partner.address) return json(response, 400, { error: "Nome e endereço do servidor são obrigatórios." });
    data.partners.unshift(partner);
    writeData(data);
    return json(response, 201, { partner });
  }

  const peopleMatch = route.match(/^\/api\/admin\/(team|creators)$/);
  if (peopleMatch && request.method === "POST") {
    const collection = peopleMatch[1];
    const person = {
      id: id(collection === "team" ? "staff" : "creator"),
      nick: text(body.nick, "").slice(0, 32),
      discord: text(body.discord, "").slice(0, 120),
      role: text(body.role || body.function, collection === "team" ? "Membro da equipe" : "Creator"),
      skinNick: text(body.skinNick || body.nick, "").slice(0, 32),
      description: text(body.description, ""),
    };
    if (!person.nick || !person.discord || !person.role) return json(response, 400, { error: "Nick, Discord e função são obrigatórios." });
    if (collection === "creators" && !["Creator", "Creator+"].includes(person.role)) return json(response, 400, { error: "Escolha Creator ou Creator+." });
    data[collection].unshift(person);
    writeData(data);
    return json(response, 201, { person });
  }

  const partnerMatch = route.match(/^\/api\/admin\/partners\/([^/]+)$/);
  if (partnerMatch && request.method === "DELETE") {
    data.partners = data.partners.filter((partner) => partner.id !== partnerMatch[1]);
    writeData(data);
    return json(response, 200, { ok: true });
  }

  const peopleDeleteMatch = route.match(/^\/api\/admin\/(team|creators)\/([^/]+)$/);
  if (peopleDeleteMatch && request.method === "DELETE") {
    const collection = peopleDeleteMatch[1];
    const before = data[collection].length;
    data[collection] = data[collection].filter((person) => person.id !== peopleDeleteMatch[2]);
    if (data[collection].length === before) return json(response, 404, { error: "Registro não encontrado." });
    writeData(data);
    return json(response, 200, { ok: true });
  }

  const match = route.match(/^\/api\/admin\/(news|store)(?:\/([^/]+))?$/);
  if (match) {
    const collection = match[1];
    const key = collection === "news" ? "news" : "store";
    const itemId = match[2];
    if (request.method === "POST") {
      const item = collection === "news"
        ? { id: id("news"), title: text(body.title), category: text(body.category, "COMUNIDADE"), body: text(body.body), image: image(body.image), date: new Date().toLocaleDateString("pt-BR") }
        : { id: id("item"), name: text(body.name), category: text(body.category, "GERAL"), price: text(body.price), description: text(body.description), image: image(body.image), featured: body.featured === true || body.featured === "true" || body.featured === "on" };
      if (!item.title && !item.name) return json(response, 400, { error: "Preencha os campos obrigatórios." });
      data[key].unshift(item);
      writeData(data);
      return json(response, 201, { item });
    }
    if (request.method === "DELETE" && itemId) {
      const before = data[key].length;
      data[key] = data[key].filter((item) => item.id !== itemId);
      if (data[key].length === before) return json(response, 404, { error: "Registro não encontrado." });
      writeData(data);
      return json(response, 200, { ok: true });
    }
    if (request.method === "GET") return json(response, 200, data[key]);
  }

  return json(response, 404, { error: "Rota não encontrada." });
}

async function oauthRoute(request, response, url) {
  const match = url.pathname.match(/^\/auth\/(google|discord)(?:\/callback)?$/);
  if (!match || request.method !== "GET") return false;
  const provider = match[1];
  const isCallback = url.pathname.endsWith("/callback");

  if (!isCallback) {
    if (!isOAuthConfigured(provider)) {
      redirect(response, oauthErrorUrl(`Login com ${provider === "google" ? "Google" : "Discord"} ainda não configurado.`));
      return true;
    }
    const config = oauthProviderConfig(provider, request);
    const state = createOAuthState(provider);
    const authorizationUrl = new URL(config.authorizationUrl);
    authorizationUrl.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: provider === "google" ? "openid email profile" : "identify email",
      state,
      ...(provider === "google" ? { access_type: "online", prompt: "select_account" } : {}),
    }).toString();
    redirect(response, authorizationUrl.toString());
    return true;
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || !consumeOAuthState(state, provider)) {
    redirect(response, oauthErrorUrl("A sessão de login expirou. Tente novamente."));
    return true;
  }
  if (url.searchParams.get("error")) {
    redirect(response, oauthErrorUrl("O login foi cancelado."));
    return true;
  }
  try {
    const profile = await exchangeOAuthCode(provider, code, request);
    const user = userFromOAuth(provider, profile);
    if (!user) {
      redirect(response, oauthErrorUrl("Configure primeiro o administrador com e-mail e senha."));
      return true;
    }
    writeData(data);
    createSession(response, user);
    redirect(response, user.role === "admin" ? "/admin" : "/cliente");
  } catch (error) {
    console.error(`Falha no login OAuth (${provider}):`, error.message);
    redirect(response, oauthErrorUrl("Não foi possível concluir o login. Tente novamente."));
  }
  return true;
}

function serveStatic(request, response, url) {
  let pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  if (pathname === "/admin" || pathname === "/admin/") pathname = "/admin.html";
  if (pathname === "/cliente" || pathname === "/cliente/") pathname = "/client.html";
  if (pathname === "/loja" || pathname === "/loja/") pathname = "/shop.html";
  if (pathname === "/noticias" || pathname === "/noticias/") pathname = "/news.html";
  if (pathname === "/regras" || pathname === "/regras/") pathname = "/rules.html";
  if (pathname === "/comunidade" || pathname === "/comunidade/") pathname = "/community.html";
  const filePath = path.resolve(PUBLIC_DIR, `.${pathname}`);
  if (!filePath.startsWith(PUBLIC_DIR)) return json(response, 403, { error: "Acesso negado." });
  fs.readFile(filePath, (error, content) => {
    if (error) return json(response, 404, { error: "Página não encontrada." });
    const type = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" }[path.extname(filePath)] || "application/octet-stream";
    response.writeHead(200, { "Content-Type": `${type}; charset=utf-8` });
    response.end(content);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  try {
    if (url.pathname.startsWith("/api/")) return await api(request, response, url);
    if (await oauthRoute(request, response, url)) return;
    serveStatic(request, response, url);
  } catch (error) {
    console.error(error);
    json(response, 500, { error: "Erro interno do servidor." });
  }
});

server.listen(PORT, HOST, () => console.log(`Flansland rodando em http://${HOST}:${PORT}`));
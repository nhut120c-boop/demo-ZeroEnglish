/**
 * ZeroEnglish Auth API - Netlify Function
 * Database: Supabase (free tier, PostgreSQL)
 * Security: JWT (HS256), bcrypt, rate limiting, CSRF-safe headers
 *
 * ENV vars needed (set in Netlify → Site settings → Environment variables):
 *   SUPABASE_URL           = https://xxxx.supabase.co
 *   SUPABASE_SERVICE_KEY   = your service_role key (secret, never expose to client)
 *   JWT_SECRET             = random 64-char string (openssl rand -hex 32)
 *   ADMIN_EMAIL            = admin@yourdomain.com
 *   ADMIN_INIT_TOKEN       = one-time token to create the first admin account
 */

import { timingSafeEqual, createHmac } from "node:crypto";

// ─────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const JWT_SECRET = process.env.JWT_SECRET || "";
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
const ADMIN_INIT_TOKEN = process.env.ADMIN_INIT_TOKEN || "";

const JWT_EXPIRY_SECONDS = 60 * 60 * 24 * 7; // 7 days

// In-memory rate limiter (resets on cold start – good enough for serverless)
const rateLimitMap = new Map(); // key → { count, firstAt }
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 min
const RATE_LIMIT_MAX = 10; // max attempts per window per IP

// ─────────────────────────────────────────────────────
// HELPERS — HTTP
// ─────────────────────────────────────────────────────
function jsonRes(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      ...extraHeaders,
    },
  });
}

function errRes(message, status = 400) {
  return jsonRes({ error: message }, status);
}

// ─────────────────────────────────────────────────────
// HELPERS — RATE LIMITING
// ─────────────────────────────────────────────────────
function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, firstAt: now };
  if (now - entry.firstAt > RATE_LIMIT_WINDOW_MS) {
    entry.count = 0;
    entry.firstAt = now;
  }
  entry.count += 1;
  rateLimitMap.set(ip, entry);
  return entry.count <= RATE_LIMIT_MAX;
}

function getIp(request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

// ─────────────────────────────────────────────────────
// HELPERS — JWT (pure, no external libs)
// ─────────────────────────────────────────────────────
function base64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function signJwt(payload) {
  if (!JWT_SECRET) throw new Error("JWT_SECRET chưa được cấu hình.");
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + JWT_EXPIRY_SECONDS }));
  const sig = base64url(
    createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest()
  );
  return `${header}.${body}.${sig}`;
}

function verifyJwt(token) {
  if (!JWT_SECRET) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expected = base64url(
      createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest()
    );
    const sigBuf = Buffer.from(sig, "base64");
    const expBuf = Buffer.from(expected, "base64");
    if (sigBuf.length !== expBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expBuf)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────
// HELPERS — BCRYPT via Supabase RPC (avoid native modules)
// We call Supabase's built-in pgcrypto functions via RPC
// ─────────────────────────────────────────────────────
async function supabaseFetch(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Supabase chưa được cấu hình.");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `Supabase lỗi ${res.status}`);
  return text ? JSON.parse(text) : null;
}

async function rpc(fn, args) {
  return supabaseFetch(`rpc/${fn}`, {
    method: "POST",
    body: JSON.stringify(args),
    prefer: "",
  });
}

// Hash password using Supabase pgcrypto (bcrypt, 12 rounds)
async function hashPassword(password) {
  const result = await rpc("hash_password", { plain: password });
  return result;
}

// Verify password using Supabase pgcrypto
async function verifyPassword(plain, hash) {
  const result = await rpc("verify_password", { plain, hash });
  return Boolean(result);
}

// ─────────────────────────────────────────────────────
// HELPERS — VALIDATION
// ─────────────────────────────────────────────────────
function validateEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

function validatePassword(pw) {
  // Min 8 chars, at least 1 letter + 1 digit
  return typeof pw === "string" && pw.length >= 8 && /[a-zA-Z]/.test(pw) && /[0-9]/.test(pw);
}

function sanitize(str, maxLen = 200) {
  if (typeof str !== "string") throw new Error("Dữ liệu không hợp lệ.");
  return str.trim().slice(0, maxLen);
}

// ─────────────────────────────────────────────────────
// HELPERS — GET AUTH USER FROM REQUEST
// ─────────────────────────────────────────────────────
function getAuthPayload(request) {
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  return verifyJwt(auth.slice(7));
}

// ─────────────────────────────────────────────────────
// DB QUERIES
// ─────────────────────────────────────────────────────
async function findUserByEmail(email) {
  const rows = await supabaseFetch(`users?email=eq.${encodeURIComponent(email)}&select=*&limit=1`);
  return rows?.[0] || null;
}

async function findUserById(id) {
  const rows = await supabaseFetch(`users?id=eq.${encodeURIComponent(id)}&select=id,email,name,plan,role,created_at&limit=1`);
  return rows?.[0] || null;
}

async function createUser({ email, name, passwordHash, plan = "classic", role = "user" }) {
  const rows = await supabaseFetch("users", {
    method: "POST",
    body: JSON.stringify({ email, name, password_hash: passwordHash, plan, role }),
  });
  return rows?.[0] || null;
}

async function updateUserPlan(userId, plan) {
  await supabaseFetch(`users?id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify({ plan }),
    prefer: "return=minimal",
  });
}

async function updateUserRole(userId, role) {
  await supabaseFetch(`users?id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
    prefer: "return=minimal",
  });
}

async function listUsers() {
  return supabaseFetch("users?select=id,email,name,plan,role,created_at&order=created_at.desc&limit=200");
}

// ─────────────────────────────────────────────────────
// HANDLERS
// ─────────────────────────────────────────────────────

// POST /auth/register
async function handleRegister(body) {
  const email = sanitize(body.email || "", 254).toLowerCase();
  const name = sanitize(body.name || "", 100);
  const password = body.password || "";

  if (!validateEmail(email)) throw new Error("Email không hợp lệ.");
  if (!name) throw new Error("Tên không được để trống.");
  if (!validatePassword(password)) {
    throw new Error("Mật khẩu phải có ít nhất 8 ký tự, gồm chữ và số.");
  }

  const existing = await findUserByEmail(email);
  if (existing) throw new Error("Email này đã được đăng ký.");

  const passwordHash = await hashPassword(password);
  const user = await createUser({ email, name, passwordHash });

  const token = signJwt({ sub: user.id, email, name, plan: "classic", role: "user" });
  return jsonRes({ token, user: { id: user.id, email, name, plan: "classic", role: "user" } }, 201);
}

// POST /auth/login
async function handleLogin(body) {
  const email = sanitize(body.email || "", 254).toLowerCase();
  const password = body.password || "";

  if (!email || !password) throw new Error("Vui lòng nhập email và mật khẩu.");

  const user = await findUserByEmail(email);
  if (!user) throw new Error("Email hoặc mật khẩu không đúng.");

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) throw new Error("Email hoặc mật khẩu không đúng.");

  const token = signJwt({ sub: user.id, email: user.email, name: user.name, plan: user.plan, role: user.role });
  return jsonRes({
    token,
    user: { id: user.id, email: user.email, name: user.name, plan: user.plan, role: user.role },
  });
}

// GET /auth/me
async function handleMe(request) {
  const payload = getAuthPayload(request);
  if (!payload) return errRes("Chưa đăng nhập hoặc phiên hết hạn.", 401);
  const user = await findUserById(payload.sub);
  if (!user) return errRes("Tài khoản không tồn tại.", 404);
  return jsonRes({ user });
}

// POST /auth/upgrade  (simulate Pro upgrade – integrate real payment later)
async function handleUpgrade(request) {
  const payload = getAuthPayload(request);
  if (!payload) return errRes("Chưa đăng nhập.", 401);
  await updateUserPlan(payload.sub, "pro");
  const token = signJwt({ ...payload, plan: "pro" });
  return jsonRes({ token, message: "Nâng cấp Pro thành công!" });
}

// ─────────────────────────────────────────────────────
// ADMIN HANDLERS
// ─────────────────────────────────────────────────────

function requireAdmin(request) {
  const payload = getAuthPayload(request);
  if (!payload) throw new Error("Chưa đăng nhập.");
  if (payload.role !== "admin") throw new Error("Không có quyền truy cập.");
  return payload;
}

// POST /auth/admin/init — Create first admin (one-time, secured by ADMIN_INIT_TOKEN)
async function handleAdminInit(body) {
  if (!ADMIN_INIT_TOKEN) throw new Error("Tính năng khởi tạo admin chưa được cấu hình.");
  const token = sanitize(body.init_token || "", 200);
  const tokenBuf = Buffer.from(token, "utf8");
  const expectedBuf = Buffer.from(ADMIN_INIT_TOKEN, "utf8");
  if (tokenBuf.length !== expectedBuf.length || !timingSafeEqual(tokenBuf, expectedBuf)) {
    throw new Error("Token khởi tạo không hợp lệ.");
  }
  if (!ADMIN_EMAIL) throw new Error("ADMIN_EMAIL chưa được cấu hình.");

  const existing = await findUserByEmail(ADMIN_EMAIL);
  if (existing) {
    // Elevate to admin if already exists
    await updateUserRole(existing.id, "admin");
    return jsonRes({ message: "Tài khoản đã được nâng cấp lên admin." });
  }

  const password = sanitize(body.password || "", 200);
  if (!validatePassword(password)) throw new Error("Mật khẩu admin phải ≥ 8 ký tự, gồm chữ và số.");
  const passwordHash = await hashPassword(password);
  await createUser({ email: ADMIN_EMAIL, name: "Admin", passwordHash, plan: "pro", role: "admin" });
  return jsonRes({ message: "Tài khoản admin đã được tạo thành công." }, 201);
}

// GET /auth/admin/users
async function handleAdminUsers(request) {
  requireAdmin(request);
  const users = await listUsers();
  return jsonRes({ users });
}

// PATCH /auth/admin/set-plan
async function handleAdminSetPlan(request, body) {
  requireAdmin(request);
  const userId = sanitize(body.user_id || "", 100);
  const plan = body.plan === "pro" ? "pro" : "classic";
  if (!userId) throw new Error("Thiếu user_id.");
  await updateUserPlan(userId, plan);
  return jsonRes({ message: `Đã cập nhật plan thành ${plan}.` });
}

// PATCH /auth/admin/set-role
async function handleAdminSetRole(request, body) {
  requireAdmin(request);
  const userId = sanitize(body.user_id || "", 100);
  const role = body.role === "admin" ? "admin" : "user";
  if (!userId) throw new Error("Thiếu user_id.");
  await updateUserRole(userId, role);
  return jsonRes({ message: `Đã cập nhật role thành ${role}.` });
}

// ─────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────
export default async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/auth\/?/, "");

  // Rate limit all auth endpoints by IP
  const ip = getIp(request);
  if (!checkRateLimit(ip)) {
    return errRes("Quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.", 429);
  }

  try {
    // GET endpoints (no body)
    if (request.method === "GET" && path === "me") return handleMe(request);
    if (request.method === "GET" && path === "admin/users") return handleAdminUsers(request);

    // POST / PATCH endpoints (need body)
    let body = {};
    if (request.method === "POST" || request.method === "PATCH") {
      const raw = await request.text();
      body = raw ? JSON.parse(raw) : {};
    }

    if (request.method === "POST" && path === "register") return handleRegister(body);
    if (request.method === "POST" && path === "login") return handleLogin(body);
    if (request.method === "POST" && path === "upgrade") return handleUpgrade(request);
    if (request.method === "POST" && path === "admin/init") return handleAdminInit(body);
    if (request.method === "PATCH" && path === "admin/set-plan") return handleAdminSetPlan(request, body);
    if (request.method === "PATCH" && path === "admin/set-role") return handleAdminSetRole(request, body);

    return errRes("Endpoint không tồn tại.", 404);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi máy chủ nội bộ.";
    const status =
      msg.includes("Chưa đăng nhập") || msg.includes("phiên hết hạn") ? 401 :
      msg.includes("Không có quyền") ? 403 :
      msg.includes("không tồn tại") ? 404 :
      msg.includes("Quá nhiều") ? 429 : 400;
    return errRes(msg, status);
  }
};

export const config = {
  path: "/auth/*",
};

# 🔐 ZeroEnglish — Hướng Dẫn Cài Đặt Auth, Database & Plans

## Tổng quan tính năng mới

| Tính năng | Mô tả |
|-----------|-------|
| 🔑 Đăng ký / Đăng nhập | JWT (HS256), bcrypt 12 rounds, rate limiting |
| 🆓 Gói **Classic** | Thẻ từ, giải thích câu, ghép từ, ngữ pháp (miễn phí) |
| ⭐ Gói **Pro** | Tất cả Classic + Đọc hiểu AI, Chat AI, Nghe AI, Tiếng Trung |
| 👑 Tài khoản **Admin** | Quản lý người dùng, đổi plan/role qua giao diện |
| 🗄️ Database | Supabase (PostgreSQL free tier) |
| 🛡️ Bảo mật | Rate limit 10 req/15min, RLS Supabase, CORS headers |

---

## BƯỚC 1 — Tạo database Supabase (miễn phí)

1. Vào **https://supabase.com** → Đăng ký/đăng nhập
2. Tạo Project mới (chọn region Singapore cho Việt Nam)
3. Vào **SQL Editor** → paste toàn bộ nội dung file `supabase-setup.sql` → Run

   File này sẽ tạo:
   - Bảng `users` (id, email, name, password_hash, plan, role, ...)
   - Extension `pgcrypto` (bcrypt)
   - 2 RPC functions: `hash_password`, `verify_password`
   - Row Level Security (RLS) — chặn client truy cập thẳng DB

4. Lấy thông tin kết nối:
   - **SUPABASE_URL**: Project Settings → API → Project URL
   - **SUPABASE_SERVICE_KEY**: Project Settings → API → `service_role` key (secret!)

---

## BƯỚC 2 — Deploy lên Netlify

### Cách 1: Kéo thả (đơn giản nhất)
1. Vào **https://netlify.com** → Đăng nhập
2. Kéo thả thư mục `zeroenglish-auth` lên trang Netlify
3. Netlify tự deploy trong < 1 phút

### Cách 2: Git (khuyến nghị)
```bash
git init
git add .
git commit -m "Add auth system"
# Push lên GitHub, kết nối Netlify với repo
```

---

## BƯỚC 3 — Cài đặt Environment Variables trên Netlify

Vào **Site settings → Environment variables → Add variable**:

| Tên biến | Giá trị | Ghi chú |
|----------|---------|---------|
| `SUPABASE_URL` | `https://xxxx.supabase.co` | URL project của bạn |
| `SUPABASE_SERVICE_KEY` | `eyJhb...` | Key `service_role` (giữ bí mật!) |
| `JWT_SECRET` | 64 ký tự random | Tạo bằng lệnh bên dưới |
| `GROQ_API_KEY` | Key Groq của bạn | Để AI hoạt động |
| `ADMIN_EMAIL` | `admin@yourdomain.com` | Email tài khoản admin |
| `ADMIN_INIT_TOKEN` | Token bí mật | Dùng 1 lần để tạo admin |

**Tạo JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Tạo ADMIN_INIT_TOKEN** (bất kỳ chuỗi ngẫu nhiên dài):
```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

---

## BƯỚC 4 — Tạo tài khoản Admin (1 lần duy nhất)

Sau khi deploy xong, gọi API này **1 lần** để tạo admin:

```bash
curl -X POST https://your-site.netlify.app/auth/admin/init \
  -H "Content-Type: application/json" \
  -d '{
    "init_token": "ADMIN_INIT_TOKEN_của_bạn",
    "password": "MatKhauAdmin123"
  }'
```

Sau đó đăng nhập bằng `ADMIN_EMAIL` và mật khẩu vừa đặt.
Bạn sẽ thấy nút **👑 Admin** ở thanh trên cùng.

---

## BƯỚC 5 — Quản lý người dùng (Admin Panel)

1. Đăng nhập bằng tài khoản admin
2. Nhấn nút **👑 Admin** trên thanh nav
3. Xem toàn bộ danh sách user
4. Đổi plan (Classic ↔ Pro) và role (User ↔ Admin) trực tiếp trên bảng

---

## Phân quyền tính năng

| Endpoint | Classic | Pro | Ẩn danh |
|----------|---------|-----|---------|
| Thẻ từ (tĩnh) | ✅ | ✅ | ✅ |
| Ghép từ, Ngữ pháp | ✅ | ✅ | ❌ cần đăng nhập |
| Tạo chủ đề AI | ✅ | ✅ | ❌ |
| Đọc hiểu AI | ❌ | ✅ | ❌ |
| Chat AI (Gia sư) | ❌ | ✅ | ❌ |
| Luyện nghe AI | ❌ | ✅ | ❌ |
| Toàn bộ Tiếng Trung | ❌ | ✅ | ❌ |

---

## Kiến trúc bảo mật

```
Browser
  ↓ HTTPS
Netlify Edge (CDN)
  ↓
Netlify Function: auth.mjs
  ├─ Rate limit: 10 req / 15 phút / IP
  ├─ Input validation + sanitization
  ├─ JWT HS256 (7 ngày, chứa plan + role)
  └─ Supabase (service_role key, RLS bật)
       └─ pgcrypto bcrypt 12 rounds

Netlify Function: api.mjs
  ├─ Verify JWT từ Authorization header
  ├─ Check plan (Classic vs Pro)
  └─ Groq AI calls
```

**Các lớp bảo vệ:**
- ✅ HTTPS bắt buộc (Netlify tự enforce)
- ✅ Rate limiting per-IP
- ✅ bcrypt 12 rounds (không thể bruteforce)
- ✅ JWT timing-safe comparison
- ✅ Supabase RLS (client không thể query DB trực tiếp)
- ✅ Service role key chỉ dùng server-side
- ✅ Input sanitization & length limits
- ✅ No SQL injection (Supabase REST API dùng parameterized)
- ✅ XSS: HTML escape tất cả output
- ✅ CSRF: SameSite cookies không cần (dùng Bearer token)

---

## Nâng cấp thanh toán thực (tùy chọn)

Để tích hợp thanh toán thật (Stripe/VNPay), thay endpoint `/auth/upgrade` bằng:

```javascript
// Netlify function: payment.mjs
// Dùng Stripe Checkout hoặc VNPay
// Sau khi thanh toán thành công → gọi updateUserPlan()
```

---

## Cấu trúc file mới

```
zeroenglish-auth/
├── netlify/functions/
│   ├── api.mjs          ← Thêm JWT verification + plan gating
│   └── auth.mjs         ← MỚI: đăng ký/đăng nhập/admin API
├── public/
│   ├── index.html       ← Thêm <script src="auth.js">
│   ├── auth.js          ← MỚI: giao diện đăng nhập/đăng ký
│   ├── script.js
│   └── style.css
├── supabase-setup.sql   ← MỚI: chạy 1 lần trên Supabase
└── SETUP-GUIDE.md       ← File này
```

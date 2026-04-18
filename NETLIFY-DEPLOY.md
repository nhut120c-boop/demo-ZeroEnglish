# Deploy ZeroEnglish lên Netlify

## 1. Chuẩn bị repo

- Push thư mục dự án này lên GitHub.
- Đảm bảo các file sau đã có trong repo:
  - `netlify.toml`
  - `netlify/functions/api.mjs`
  - `public/`
  - `index.html`, `style.css`, `src/`, `data.js`, `build.mjs`

## 2. Import vào Netlify

- Vào Netlify.
- Chọn `Add new project` rồi connect repo GitHub của bạn.
- Netlify sẽ đọc `netlify.toml` tự động:
  - Build command: `node build.mjs`
  - Publish directory: `public`
  - Functions directory: `netlify/functions`

Lưu ý:

- Nên deploy bằng cách connect repo GitHub hoặc dùng Netlify CLI.
- Không nên chỉ kéo thả riêng thư mục `public/`, vì cách đó sẽ không mang theo `netlify/functions/api.mjs`.

## 3. Thêm biến môi trường

Trong Netlify, vào:

- `Project configuration`
- `Environment variables`

Thêm các biến sau:

- `GROQ_API_KEY`
  - API key thật của Groq.
- `ZEROENGLISH_ADMIN_TOKEN`
  - Một chuỗi bí mật chỉ bạn biết, dùng cho route admin.
- `ZEROENGLISH_MODEL`
  - Tùy chọn. Mặc định là `llama-3.1-8b-instant`.

## 4. Deploy

- Bấm `Deploy site`.
- Sau khi build xong, truy cập domain Netlify được cấp.

## 5. Kiểm tra nhanh sau deploy

- Mở trang web và kiểm tra banner trạng thái.
- Test tab `Ghép từ AI`.
- Nếu đã set `GROQ_API_KEY`, test thêm:
  - Tạo chủ đề AI
  - Đọc hiểu AI
  - Chat AI
  - Luyện nghe

## 6. Nếu AI chưa chạy

Kiểm tra lại:

- `GROQ_API_KEY` đã được thêm trong Netlify chưa.
- Sau khi sửa env vars, bạn đã `Trigger deploy` lại chưa.
- Deploy logs và Functions logs trong Netlify có báo lỗi gì không.

## 7. Lưu ý bảo mật

- Không đưa `GROQ_API_KEY` vào `script.js`, `index.html`, hay `netlify.toml`.
- `netlify.toml` chỉ cấu hình build và functions, không phải nơi giữ secret runtime.
- Publish dir đang là `public`, nên source phụ trợ như `server.py`, `build.py`, `src/` sẽ không bị public trực tiếp trên site demo.

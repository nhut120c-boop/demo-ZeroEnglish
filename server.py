from __future__ import annotations

import json
import os
import secrets
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent
PUBLIC_FILES = {
    "/": "index.html",
    "/index.html": "index.html",
    "/style.css": "style.css",
    "/script.js": "script.js",
}
CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
}
LEVEL_LABELS = {
    "easy": "Dễ (A1-A2)",
    "medium": "Trung bình (B1-B2)",
    "hard": "Khó (C1-C2)",
}
GRAMMAR_TOPICS = {
    "Thì hiện tại đơn",
    "Thì quá khứ đơn",
    "Câu điều kiện loại 1",
    "Mệnh đề quan hệ",
}
MATCHING_FALLBACK = {
    "easy": [
        {"en": "apple", "vi": "quả táo"},
        {"en": "water", "vi": "nước"},
        {"en": "book", "vi": "quyển sách"},
        {"en": "house", "vi": "ngôi nhà"},
        {"en": "friend", "vi": "bạn bè"},
        {"en": "school", "vi": "trường học"},
    ],
    "medium": [
        {"en": "deadline", "vi": "hạn chót"},
        {"en": "meeting", "vi": "cuộc họp"},
        {"en": "journey", "vi": "hành trình"},
        {"en": "improve", "vi": "cải thiện"},
        {"en": "decision", "vi": "quyết định"},
        {"en": "practice", "vi": "luyện tập"},
        {"en": "support", "vi": "hỗ trợ"},
        {"en": "project", "vi": "dự án"},
    ],
    "hard": [
        {"en": "resilient", "vi": "kiên cường"},
        {"en": "perspective", "vi": "góc nhìn"},
        {"en": "sustainable", "vi": "bền vững"},
        {"en": "compliance", "vi": "sự tuân thủ"},
        {"en": "vulnerable", "vi": "dễ bị tổn thương"},
        {"en": "negotiate", "vi": "đàm phán"},
        {"en": "misleading", "vi": "gây hiểu lầm"},
        {"en": "constraint", "vi": "ràng buộc"},
        {"en": "scalable", "vi": "có thể mở rộng"},
        {"en": "transparent", "vi": "minh bạch"},
    ],
}
RATE_LIMIT_WINDOW = 60
RATE_LIMIT_COUNT = 25
REQUEST_LOG: dict[str, list[float]] = {}
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


def load_env_file() -> None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


load_env_file()

HOST = os.getenv("ZEROENGLISH_HOST", "127.0.0.1")
PORT = int(os.getenv("ZEROENGLISH_PORT", "8080"))
MODEL = os.getenv("ZEROENGLISH_MODEL", "llama-3.1-8b-instant")
GROQ_API_KEY = (
    os.getenv("GROQ_API_KEY", "").strip()
    or os.getenv("ZEROENGLISH_GROQ_API_KEY", "").strip()
)
ADMIN_TOKEN = os.getenv("ZEROENGLISH_ADMIN_TOKEN", "").strip()


def clean_text(value: object, *, max_length: int, allow_empty: bool = False) -> str:
    if not isinstance(value, str):
        raise ValueError("Dữ liệu gửi lên không hợp lệ.")
    cleaned = value.strip()
    if not cleaned and not allow_empty:
        raise ValueError("Thiếu nội dung cần xử lý.")
    if len(cleaned) > max_length:
        raise ValueError("Nội dung vượt quá giới hạn cho phép.")
    return cleaned


def extract_json_payload(text: str) -> str:
    for start_index, char in enumerate(text):
        if char not in "{[":
            continue

        stack = ["}" if char == "{" else "]"]
        in_string = False
        escaped = False

        for end_index in range(start_index + 1, len(text)):
            current = text[end_index]
            if in_string:
                if escaped:
                    escaped = False
                elif current == "\\":
                    escaped = True
                elif current == '"':
                    in_string = False
                continue

            if current == '"':
                in_string = True
            elif current in "{[":
                stack.append("}" if current == "{" else "]")
            elif current in "}]":
                if not stack or current != stack[-1]:
                    break
                stack.pop()
                if not stack:
                    return text[start_index:end_index + 1]

    raise ValueError("AI không trả về JSON hợp lệ.")


def normalize_word_entry(item: object) -> dict[str, str]:
    if not isinstance(item, dict):
        raise ValueError("Mỗi từ phải là một object.")

    en = clean_text(item.get("en"), max_length=80)
    vi = clean_text(item.get("vi"), max_length=120)
    pro = clean_text(item.get("pro", ""), max_length=80, allow_empty=True)
    ex = clean_text(item.get("ex"), max_length=220)
    return {"en": en, "vi": vi, "pro": pro or "/.../", "ex": ex}


def normalize_vocab_map(value: object) -> dict[str, str]:
    if not isinstance(value, dict):
        raise ValueError("Từ điển từ vựng không hợp lệ.")

    normalized: dict[str, str] = {}
    for key, meaning in value.items():
        word = clean_text(key, max_length=60)
        normalized[word.lower()] = clean_text(meaning, max_length=120)
    return normalized


def normalize_grammar_examples(value: object) -> list[str]:
    if not isinstance(value, list):
        raise ValueError("Ví dụ ngữ pháp không hợp lệ.")
    examples = [clean_text(item, max_length=180) for item in value if isinstance(item, str)]
    if not examples:
        raise ValueError("Thiếu ví dụ ngữ pháp.")
    return examples[:5]


def normalize_questions(value: object) -> list[dict[str, object]]:
    if not isinstance(value, list):
        raise ValueError("Danh sách câu hỏi không hợp lệ.")

    questions = []
    for item in value[:4]:
        if not isinstance(item, dict):
            continue
        question = clean_text(item.get("q"), max_length=160)
        options_raw = item.get("options")
        answer_index = item.get("answerIndex")
        if not isinstance(options_raw, list) or len(options_raw) != 4:
            continue
        options = [clean_text(option, max_length=120) for option in options_raw]
        if not isinstance(answer_index, int) or answer_index not in range(4):
            continue
        questions.append({"q": question, "options": options, "answerIndex": answer_index})

    if not questions:
        raise ValueError("Không tạo được bộ câu hỏi hợp lệ.")
    return questions


def normalize_pairs(value: object, level: str) -> list[dict[str, object]]:
    if not isinstance(value, list):
        raise ValueError("Danh sách ghép từ không hợp lệ.")

    pairs = []
    expected_count = 6 if level == "easy" else 8 if level == "medium" else 10
    for index, item in enumerate(value[:expected_count]):
        if not isinstance(item, dict):
            continue
        en = clean_text(item.get("en"), max_length=80)
        vi = clean_text(item.get("vi"), max_length=120)
        pairs.append({"id": index + 1, "en": en, "vi": vi})

    if len(pairs) < min(expected_count, 5):
        raise ValueError("AI chưa tạo đủ số cặp từ hợp lệ.")
    return pairs


def normalize_reading_payload(data: object) -> dict[str, object]:
    if not isinstance(data, dict):
        raise ValueError("Dữ liệu bài đọc không hợp lệ.")

    return {
        "title": clean_text(data.get("title"), max_length=120),
        "content": clean_text(data.get("content"), max_length=1200),
        "translation": clean_text(data.get("translation"), max_length=1600),
        "vocab": normalize_vocab_map(data.get("vocab")),
    }


def throttle(ip_address: str) -> None:
    now = time.time()
    timestamps = REQUEST_LOG.setdefault(ip_address, [])
    REQUEST_LOG[ip_address] = [stamp for stamp in timestamps if now - stamp < RATE_LIMIT_WINDOW]
    if len(REQUEST_LOG[ip_address]) >= RATE_LIMIT_COUNT:
        raise RuntimeError("Bạn gửi hơi nhanh. Hãy đợi một chút rồi thử lại.")
    REQUEST_LOG[ip_address].append(now)


def ensure_ai_configured() -> None:
    if not GROQ_API_KEY:
        raise RuntimeError(
            "AI backend chưa được cấu hình. Hãy tạo file .env từ .env.example và thêm GROQ_API_KEY."
        )


def groq_request(messages: list[dict[str, str]], temperature: float) -> str:
    ensure_ai_configured()
    payload = {
        "model": MODEL,
        "messages": messages,
        "temperature": temperature,
    }
    request = Request(
        GROQ_URL,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {GROQ_API_KEY}",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=45) as response:
            data = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        error_body = exc.read().decode("utf-8", "replace")
        raise RuntimeError(f"AI trả về lỗi HTTP {exc.code}: {error_body}") from exc
    except URLError as exc:
        raise RuntimeError(f"Không kết nối được tới AI provider: {exc.reason}") from exc

    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError("AI trả về dữ liệu không đúng định dạng.") from exc


def groq_json(system_prompt: str, user_prompt: str, temperature: float = 0.35) -> object:
    raw_text = groq_request(
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=temperature,
    )
    return json.loads(extract_json_payload(raw_text))


class ZeroEnglishHandler(BaseHTTPRequestHandler):
    server_version = "ZeroEnglish/2.0"

    def log_message(self, format: str, *args: object) -> None:
        return

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "same-origin")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
        )
        super().end_headers()

    def do_GET(self) -> None:
        try:
            parsed = urlparse(self.path)
            path = parsed.path

            if path == "/api/bootstrap":
                self.write_json(
                    200,
                    {
                        "brand": "ZeroEnglish",
                        "aiEnabled": bool(GROQ_API_KEY),
                        "secureMode": True,
                        "matchingFallback": True,
                    },
                )
                return

            if path == "/api/admin/status":
                self.require_admin()
                self.write_json(
                    200,
                    {
                        "brand": "ZeroEnglish",
                        "aiEnabled": bool(GROQ_API_KEY),
                        "adminProtected": True,
                        "model": MODEL,
                        "serverTime": time.strftime("%Y-%m-%d %H:%M:%S"),
                    },
                )
                return

            filename = PUBLIC_FILES.get(path)
            if not filename:
                self.write_json(404, {"error": "Không tìm thấy tài nguyên yêu cầu."})
                return

            file_path = ROOT / filename
            if not file_path.exists():
                self.write_json(404, {"error": f"Thiếu file public: {filename}"})
                return

            payload = file_path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", CONTENT_TYPES[file_path.suffix])
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        except ValueError as exc:
            self.write_json(400, {"error": str(exc)})
        except RuntimeError as exc:
            self.write_json(503, {"error": str(exc)})
        except Exception:
            self.write_json(500, {"error": "Có lỗi nội bộ xảy ra trên server."})

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/"):
            self.write_json(404, {"error": "Không tìm thấy API yêu cầu."})
            return

        try:
            payload = self.read_json()
            if parsed.path.startswith("/api/ai/"):
                throttle(self.client_address[0])

            if parsed.path == "/api/ai/topic":
                self.handle_generate_topic(payload)
            elif parsed.path == "/api/ai/explain":
                self.handle_explain(payload)
            elif parsed.path == "/api/ai/reading":
                self.handle_reading(payload)
            elif parsed.path == "/api/ai/grammar":
                self.handle_grammar(payload)
            elif parsed.path == "/api/ai/chat":
                self.handle_chat(payload)
            elif parsed.path == "/api/ai/listening":
                self.handle_listening(payload)
            elif parsed.path == "/api/ai/matching":
                self.handle_matching(payload)
            else:
                self.write_json(404, {"error": "Endpoint không tồn tại."})
        except ValueError as exc:
            self.write_json(400, {"error": str(exc)})
        except RuntimeError as exc:
            self.write_json(503, {"error": str(exc)})
        except Exception:
            self.write_json(500, {"error": "Có lỗi nội bộ xảy ra trên server."})

    def read_json(self) -> dict[str, object]:
        length_header = self.headers.get("Content-Length")
        if not length_header:
            raise ValueError("Thiếu Content-Length.")

        length = int(length_header)
        if length <= 0 or length > 64_000:
            raise ValueError("Payload không hợp lệ hoặc quá lớn.")

        raw_body = self.rfile.read(length).decode("utf-8")
        data = json.loads(raw_body)
        if not isinstance(data, dict):
            raise ValueError("Payload phải là object JSON.")
        return data

    def write_json(self, status: int, data: dict[str, object]) -> None:
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def require_admin(self) -> None:
        if not ADMIN_TOKEN:
            raise RuntimeError("Admin token chưa được cấu hình.")
        incoming = self.headers.get("X-Admin-Token", "")
        if not secrets.compare_digest(incoming, ADMIN_TOKEN):
            raise ValueError("Sai admin token.")

    def handle_generate_topic(self, payload: dict[str, object]) -> None:
        topic = clean_text(payload.get("topic"), max_length=80)
        system_prompt = (
            "You generate safe JSON for a Vietnamese English-learning app. "
            "Never return markdown, code fences, HTML, or explanations."
        )
        user_prompt = (
            f'Tạo 16 từ tiếng Anh theo chủ đề "{topic}". '
            'Trả về duy nhất một JSON array dạng: '
            '[{"en":"word","vi":"nghĩa tiếng Việt","pro":"/phiên âm/","ex":"Ví dụ ngắn"}].'
        )
        raw_data = groq_json(system_prompt, user_prompt, temperature=0.45)
        if not isinstance(raw_data, list):
            raise ValueError("AI không trả về danh sách từ.")
        words = [normalize_word_entry(item) for item in raw_data[:20]]
        if len(words) < 6:
            raise ValueError("AI chưa tạo đủ bộ từ hợp lệ.")
        self.write_json(200, {"topic": topic, "words": words})

    def handle_explain(self, payload: dict[str, object]) -> None:
        sentence = clean_text(payload.get("sentence"), max_length=240)
        raw_data = groq_json(
            "Bạn là gia sư tiếng Anh. Chỉ trả JSON thuần, không thêm markdown.",
            (
                f'Giải thích ngữ pháp thật dễ hiểu cho câu sau: "{sentence}". '
                'Trả JSON: {"explanation":"..."}'
            ),
            temperature=0.2,
        )
        if not isinstance(raw_data, dict):
            raise ValueError("AI không trả về giải thích hợp lệ.")
        explanation = clean_text(raw_data.get("explanation"), max_length=800)
        self.write_json(200, {"explanation": explanation})

    def handle_reading(self, payload: dict[str, object]) -> None:
        level = clean_text(payload.get("level"), max_length=20)
        if level not in LEVEL_LABELS:
            raise ValueError("Cấp độ đọc không hợp lệ.")
        raw_data = groq_json(
            "Bạn tạo nội dung học tiếng Anh cho người Việt. Chỉ trả JSON thuần.",
            (
                f'Viết 1 đoạn tiếng Anh 80-110 từ ở mức {LEVEL_LABELS[level]}. '
                'Kèm tiêu đề, bản dịch tiếng Việt và nghĩa từng từ quan trọng. '
                'Trả JSON: {"title":"...","content":"...","translation":"...","vocab":{"word":"nghĩa"}}'
            ),
            temperature=0.45,
        )
        self.write_json(200, normalize_reading_payload(raw_data))

    def handle_grammar(self, payload: dict[str, object]) -> None:
        topic = clean_text(payload.get("topic"), max_length=80)
        if topic not in GRAMMAR_TOPICS:
            raise ValueError("Chủ đề ngữ pháp không hợp lệ.")
        raw_data = groq_json(
            "Bạn viết bài giảng tiếng Anh siêu ngắn, dễ hiểu, và chỉ trả JSON.",
            (
                f'Viết bài ngữ pháp ngắn gọn về "{topic}". '
                'Trả JSON: {"title":"...","formula":"...","usage":"...","examples":["...","..."]}'
            ),
            temperature=0.25,
        )
        if not isinstance(raw_data, dict):
            raise ValueError("AI không trả về bài ngữ pháp hợp lệ.")
        self.write_json(
            200,
            {
                "title": clean_text(raw_data.get("title"), max_length=120),
                "formula": clean_text(raw_data.get("formula"), max_length=220),
                "usage": clean_text(raw_data.get("usage"), max_length=900),
                "examples": normalize_grammar_examples(raw_data.get("examples")),
            },
        )

    def handle_chat(self, payload: dict[str, object]) -> None:
        history = payload.get("history", [])
        if not isinstance(history, list):
            raise ValueError("Lịch sử chat không hợp lệ.")

        messages = [
            {
                "role": "system",
                "content": (
                    "Bạn là gia sư tiếng Anh của ZeroEnglish. "
                    "Trả lời bằng tiếng Việt, ngắn gọn, dễ hiểu, thân thiện, không dùng HTML."
                ),
            }
        ]
        for item in history[-8:]:
            if not isinstance(item, dict):
                continue
            role = item.get("role")
            if role not in {"user", "assistant"}:
                continue
            content = clean_text(item.get("content"), max_length=600)
            messages.append({"role": role, "content": content})

        answer = groq_request(messages, temperature=0.55)
        self.write_json(200, {"message": clean_text(answer, max_length=2400)})

    def handle_listening(self, payload: dict[str, object]) -> None:
        level = clean_text(payload.get("level"), max_length=20)
        if level not in LEVEL_LABELS:
            raise ValueError("Cấp độ nghe không hợp lệ.")
        raw_data = groq_json(
            "Bạn tạo bài listening cho người Việt và chỉ trả JSON thuần.",
            (
                f'Tạo transcript nghe 70-100 từ ở mức {LEVEL_LABELS[level]}. '
                'Sinh 3 câu trắc nghiệm, mỗi câu có 4 lựa chọn và answerIndex. '
                'Trả JSON: {"transcript":"...","questions":[{"q":"...","options":["A","B","C","D"],"answerIndex":0}]}'
            ),
            temperature=0.25,
        )
        if not isinstance(raw_data, dict):
            raise ValueError("AI không trả về bài nghe hợp lệ.")
        transcript = clean_text(raw_data.get("transcript"), max_length=1400)
        questions = normalize_questions(raw_data.get("questions"))
        self.write_json(200, {"transcript": transcript, "questions": questions})

    def handle_matching(self, payload: dict[str, object]) -> None:
        level = clean_text(payload.get("level"), max_length=20)
        if level not in LEVEL_LABELS:
            raise ValueError("Cấp độ ghép từ không hợp lệ.")

        if GROQ_API_KEY:
            raw_data = groq_json(
                "Bạn tạo bài ghép từ tiếng Anh - tiếng Việt và chỉ trả JSON thuần.",
                (
                    f'Tạo bộ ghép từ ở mức {LEVEL_LABELS[level]}. '
                    'Chỉ dùng từ hoặc cụm từ ngắn, tránh trùng lặp. '
                    'Trả JSON: {"pairs":[{"en":"...","vi":"..."}]}'
                ),
                temperature=0.35,
            )
            if not isinstance(raw_data, dict):
                raise ValueError("AI không trả về bộ ghép từ hợp lệ.")
            pairs = normalize_pairs(raw_data.get("pairs"), level)
            self.write_json(200, {"pairs": pairs, "levelLabel": LEVEL_LABELS[level], "source": "ai"})
            return

        fallback = [
            {"id": index + 1, "en": item["en"], "vi": item["vi"]}
            for index, item in enumerate(MATCHING_FALLBACK[level])
        ]
        self.write_json(200, {"pairs": fallback, "levelLabel": LEVEL_LABELS[level], "source": "fallback"})


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), ZeroEnglishHandler)
    print(f"ZeroEnglish server đang chạy tại http://{HOST}:{PORT}")
    print("API key được giữ ở server-side. Tạo file .env để bật AI nếu cần.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nĐã dừng server.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

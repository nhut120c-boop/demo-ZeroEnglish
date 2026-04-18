import { timingSafeEqual } from "node:crypto";

const BRAND = "ZeroEnglish";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const LEVEL_LABELS = {
  easy: "Dễ (A1-A2)",
  medium: "Trung bình (B1-B2)",
  hard: "Khó (C1-C2)",
};
const GRAMMAR_TOPICS = new Set([
  "Thì hiện tại đơn",
  "Thì quá khứ đơn",
  "Câu điều kiện loại 1",
  "Mệnh đề quan hệ",
]);
const MATCHING_FALLBACK = {
  easy: [
    { en: "apple", vi: "quả táo" },
    { en: "water", vi: "nước" },
    { en: "book", vi: "quyển sách" },
    { en: "house", vi: "ngôi nhà" },
    { en: "friend", vi: "bạn bè" },
    { en: "school", vi: "trường học" },
  ],
  medium: [
    { en: "deadline", vi: "hạn chót" },
    { en: "meeting", vi: "cuộc họp" },
    { en: "journey", vi: "hành trình" },
    { en: "improve", vi: "cải thiện" },
    { en: "decision", vi: "quyết định" },
    { en: "practice", vi: "luyện tập" },
    { en: "support", vi: "hỗ trợ" },
    { en: "project", vi: "dự án" },
  ],
  hard: [
    { en: "resilient", vi: "kiên cường" },
    { en: "perspective", vi: "góc nhìn" },
    { en: "sustainable", vi: "bền vững" },
    { en: "compliance", vi: "sự tuân thủ" },
    { en: "vulnerable", vi: "dễ bị tổn thương" },
    { en: "negotiate", vi: "đàm phán" },
    { en: "misleading", vi: "gây hiểu lầm" },
    { en: "constraint", vi: "ràng buộc" },
    { en: "scalable", vi: "có thể mở rộng" },
    { en: "transparent", vi: "minh bạch" },
  ],
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left ?? ""), "utf8");
  const rightBuffer = Buffer.from(String(right ?? ""), "utf8");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function cleanText(value, { maxLength, allowEmpty = false } = {}) {
  if (typeof value !== "string") {
    throw new Error("Dữ liệu gửi lên không hợp lệ.");
  }

  const cleaned = value.trim();
  if (!cleaned && !allowEmpty) {
    throw new Error("Thiếu nội dung cần xử lý.");
  }
  if (cleaned.length > maxLength) {
    throw new Error("Nội dung vượt quá giới hạn cho phép.");
  }
  return cleaned;
}

function extractJsonPayload(text) {
  for (let startIndex = 0; startIndex < text.length; startIndex += 1) {
    const char = text[startIndex];
    if (char !== "{" && char !== "[") {
      continue;
    }

    const stack = [char === "{" ? "}" : "]"];
    let inString = false;
    let escaped = false;

    for (let endIndex = startIndex + 1; endIndex < text.length; endIndex += 1) {
      const current = text[endIndex];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (current === "\\") {
          escaped = true;
        } else if (current === "\"") {
          inString = false;
        }
        continue;
      }

      if (current === "\"") {
        inString = true;
      } else if (current === "{" || current === "[") {
        stack.push(current === "{" ? "}" : "]");
      } else if (current === "}" || current === "]") {
        if (!stack.length || current !== stack.at(-1)) {
          break;
        }
        stack.pop();
        if (!stack.length) {
          return text.slice(startIndex, endIndex + 1);
        }
      }
    }
  }

  throw new Error("AI không trả về JSON hợp lệ.");
}

function normalizeWordEntry(item) {
  if (!item || typeof item !== "object") {
    throw new Error("Mỗi từ phải là một object.");
  }

  return {
    en: cleanText(item.en, { maxLength: 80 }),
    vi: cleanText(item.vi, { maxLength: 120 }),
    pro: cleanText(item.pro ?? "", { maxLength: 80, allowEmpty: true }) || "/.../",
    ex: cleanText(item.ex, { maxLength: 220 }),
  };
}

function normalizeVocabMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Từ điển từ vựng không hợp lệ.");
  }

  const normalized = {};
  for (const [key, meaning] of Object.entries(value)) {
    normalized[cleanText(key, { maxLength: 60 }).toLowerCase()] = cleanText(meaning, { maxLength: 120 });
  }
  return normalized;
}

function normalizeGrammarExamples(value) {
  if (!Array.isArray(value)) {
    throw new Error("Ví dụ ngữ pháp không hợp lệ.");
  }

  const examples = value
    .filter((item) => typeof item === "string")
    .map((item) => cleanText(item, { maxLength: 180 }))
    .slice(0, 5);

  if (!examples.length) {
    throw new Error("Thiếu ví dụ ngữ pháp.");
  }

  return examples;
}

function normalizeQuestions(value) {
  if (!Array.isArray(value)) {
    throw new Error("Danh sách câu hỏi không hợp lệ.");
  }

  const questions = value.slice(0, 4).flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    if (!Array.isArray(item.options) || item.options.length !== 4) {
      return [];
    }
    if (!Number.isInteger(item.answerIndex) || item.answerIndex < 0 || item.answerIndex > 3) {
      return [];
    }

    return [{
      q: cleanText(item.q, { maxLength: 160 }),
      options: item.options.map((option) => cleanText(option, { maxLength: 120 })),
      answerIndex: item.answerIndex,
    }];
  });

  if (!questions.length) {
    throw new Error("Không tạo được bộ câu hỏi hợp lệ.");
  }
  return questions;
}

function normalizePairs(value, level) {
  if (!Array.isArray(value)) {
    throw new Error("Danh sách ghép từ không hợp lệ.");
  }

  const expectedCount = level === "easy" ? 6 : level === "medium" ? 8 : 10;
  const pairs = value.slice(0, expectedCount).flatMap((item, index) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    return [{
      id: index + 1,
      en: cleanText(item.en, { maxLength: 80 }),
      vi: cleanText(item.vi, { maxLength: 120 }),
    }];
  });

  if (pairs.length < Math.min(expectedCount, 5)) {
    throw new Error("AI chưa tạo đủ số cặp từ hợp lệ.");
  }
  return pairs;
}

function normalizeReadingPayload(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Dữ liệu bài đọc không hợp lệ.");
  }

  return {
    title: cleanText(data.title, { maxLength: 120 }),
    content: cleanText(data.content, { maxLength: 1200 }),
    translation: cleanText(data.translation, { maxLength: 1600 }),
    vocab: normalizeVocabMap(data.vocab),
  };
}

function parseLevel(value) {
  const level = cleanText(value, { maxLength: 20 });
  if (!(level in LEVEL_LABELS)) {
    throw new Error("Cấp độ không hợp lệ.");
  }
  return level;
}

function parseRequestBody(request) {
  if (request.method === "GET" || request.method === "HEAD") {
    return Promise.resolve({});
  }
  return request.json().catch(() => {
    throw new Error("Payload JSON không hợp lệ.");
  });
}

function requireAi() {
  const apiKey = process.env.GROQ_API_KEY?.trim() || process.env.ZEROENGLISH_GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("AI backend chưa được cấu hình. Hãy thêm GROQ_API_KEY trong Netlify environment variables.");
  }
  return apiKey;
}

async function groqRequest(messages, temperature = 0.35) {
  const apiKey = requireAi();
  const model = process.env.ZEROENGLISH_MODEL?.trim() || "llama-3.1-8b-instant";

  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`AI trả về lỗi HTTP ${response.status}.`);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("AI trả về dữ liệu không đúng định dạng.");
  }
  return content;
}

async function groqJson(systemPrompt, userPrompt, temperature = 0.35) {
  const rawText = await groqRequest([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ], temperature);

  return JSON.parse(extractJsonPayload(rawText));
}

function requireAdmin(request) {
  const adminToken = process.env.ZEROENGLISH_ADMIN_TOKEN?.trim();
  if (!adminToken) {
    throw new Error("Admin token chưa được cấu hình.");
  }
  const incoming = request.headers.get("x-admin-token") || "";
  if (!safeEqual(incoming, adminToken)) {
    throw new Error("Sai admin token.");
  }
}

async function handleBootstrap() {
  return jsonResponse({
    brand: BRAND,
    aiEnabled: Boolean(process.env.GROQ_API_KEY?.trim() || process.env.ZEROENGLISH_GROQ_API_KEY?.trim()),
    secureMode: true,
    matchingFallback: true,
  });
}

async function handleAdminStatus(request) {
  requireAdmin(request);
  return jsonResponse({
    brand: BRAND,
    aiEnabled: Boolean(process.env.GROQ_API_KEY?.trim() || process.env.ZEROENGLISH_GROQ_API_KEY?.trim()),
    adminProtected: true,
    model: process.env.ZEROENGLISH_MODEL?.trim() || "llama-3.1-8b-instant",
    serverTime: new Date().toISOString(),
  });
}

async function handleTopic(body) {
  const topic = cleanText(body.topic, { maxLength: 80 });
  const rawData = await groqJson(
    "You generate safe JSON for a Vietnamese English-learning app. Never return markdown, code fences, HTML, or explanations.",
    `Tạo 16 từ tiếng Anh theo chủ đề "${topic}". Trả về duy nhất một JSON array dạng: [{"en":"word","vi":"nghĩa tiếng Việt","pro":"/phiên âm/","ex":"Ví dụ ngắn"}].`,
    0.45,
  );

  if (!Array.isArray(rawData)) {
    throw new Error("AI không trả về danh sách từ.");
  }

  const words = rawData.slice(0, 20).map(normalizeWordEntry);
  if (words.length < 6) {
    throw new Error("AI chưa tạo đủ bộ từ hợp lệ.");
  }

  return jsonResponse({ topic, words });
}

async function handleExplain(body) {
  const sentence = cleanText(body.sentence, { maxLength: 240 });
  const rawData = await groqJson(
    "Bạn là gia sư tiếng Anh. Chỉ trả JSON thuần, không thêm markdown.",
    `Giải thích ngữ pháp thật dễ hiểu cho câu sau: "${sentence}". Trả JSON: {"explanation":"..."}`,
    0.2,
  );

  const explanation = cleanText(rawData?.explanation, { maxLength: 800 });
  return jsonResponse({ explanation });
}

async function handleReading(body) {
  const level = parseLevel(body.level);
  const rawData = await groqJson(
    "Bạn tạo nội dung học tiếng Anh cho người Việt. Chỉ trả JSON thuần.",
    `Viết 1 đoạn tiếng Anh 80-110 từ ở mức ${LEVEL_LABELS[level]}. Kèm tiêu đề, bản dịch tiếng Việt và nghĩa từng từ quan trọng. Trả JSON: {"title":"...","content":"...","translation":"...","vocab":{"word":"nghĩa"}}`,
    0.45,
  );

  return jsonResponse(normalizeReadingPayload(rawData));
}

async function handleGrammar(body) {
  const topic = cleanText(body.topic, { maxLength: 80 });
  if (!GRAMMAR_TOPICS.has(topic)) {
    throw new Error("Chủ đề ngữ pháp không hợp lệ.");
  }

  const rawData = await groqJson(
    "Bạn viết bài giảng tiếng Anh siêu ngắn, dễ hiểu, và chỉ trả JSON.",
    `Viết bài ngữ pháp ngắn gọn về "${topic}". Trả JSON: {"title":"...","formula":"...","usage":"...","examples":["...","..."]}`,
    0.25,
  );

  return jsonResponse({
    title: cleanText(rawData?.title, { maxLength: 120 }),
    formula: cleanText(rawData?.formula, { maxLength: 220 }),
    usage: cleanText(rawData?.usage, { maxLength: 900 }),
    examples: normalizeGrammarExamples(rawData?.examples),
  });
}

async function handleChat(body) {
  if (!Array.isArray(body.history)) {
    throw new Error("Lịch sử chat không hợp lệ.");
  }

  const messages = [{
    role: "system",
    content: "Bạn là gia sư tiếng Anh của ZeroEnglish. Trả lời bằng tiếng Việt, ngắn gọn, dễ hiểu, thân thiện, không dùng HTML.",
  }];

  body.history.slice(-8).forEach((item) => {
    if (!item || typeof item !== "object") {
      return;
    }
    if (item.role !== "user" && item.role !== "assistant") {
      return;
    }
    messages.push({
      role: item.role,
      content: cleanText(item.content, { maxLength: 600 }),
    });
  });

  const message = cleanText(await groqRequest(messages, 0.55), { maxLength: 2400 });
  return jsonResponse({ message });
}

async function handleListening(body) {
  const level = parseLevel(body.level);
  const rawData = await groqJson(
    "Bạn tạo bài listening cho người Việt và chỉ trả JSON thuần.",
    `Tạo transcript nghe 70-100 từ ở mức ${LEVEL_LABELS[level]}. Sinh 3 câu trắc nghiệm, mỗi câu có 4 lựa chọn và answerIndex. Trả JSON: {"transcript":"...","questions":[{"q":"...","options":["A","B","C","D"],"answerIndex":0}]}`,
    0.25,
  );

  return jsonResponse({
    transcript: cleanText(rawData?.transcript, { maxLength: 1400 }),
    questions: normalizeQuestions(rawData?.questions),
  });
}

async function handleMatching(body) {
  const level = parseLevel(body.level);
  const aiEnabled = Boolean(process.env.GROQ_API_KEY?.trim() || process.env.ZEROENGLISH_GROQ_API_KEY?.trim());

  if (!aiEnabled) {
    const fallback = MATCHING_FALLBACK[level].map((pair, index) => ({
      id: index + 1,
      en: pair.en,
      vi: pair.vi,
    }));
    return jsonResponse({
      pairs: fallback,
      levelLabel: LEVEL_LABELS[level],
      source: "fallback",
    });
  }

  const rawData = await groqJson(
    "Bạn tạo bài ghép từ tiếng Anh - tiếng Việt và chỉ trả JSON thuần.",
    `Tạo bộ ghép từ ở mức ${LEVEL_LABELS[level]}. Chỉ dùng từ hoặc cụm từ ngắn, tránh trùng lặp. Trả JSON: {"pairs":[{"en":"...","vi":"..."}]}`,
    0.35,
  );

  return jsonResponse({
    pairs: normalizePairs(rawData?.pairs, level),
    levelLabel: LEVEL_LABELS[level],
    source: "ai",
  });
}

function resolveEndpoint(pathname) {
  return pathname.replace(/^\/api\/?/, "");
}



// ─────────────────────────────────────────────────────
// CHINESE HANDLERS
// ─────────────────────────────────────────────────────

const CN_MATCHING_FALLBACK = {
  easy: [
    { en: "你好", vi: "Xin chào" }, { en: "谢谢", vi: "Cảm ơn" },
    { en: "再见", vi: "Tạm biệt" }, { en: "吃饭", vi: "Ăn cơm" },
    { en: "学习", vi: "Học tập" }, { en: "朋友", vi: "Bạn bè" },
  ],
  medium: [
    { en: "工作", vi: "Công việc" }, { en: "问题", vi: "Vấn đề" },
    { en: "时间", vi: "Thời gian" }, { en: "城市", vi: "Thành phố" },
    { en: "文化", vi: "Văn hóa" }, { en: "旅游", vi: "Du lịch" },
    { en: "经验", vi: "Kinh nghiệm" }, { en: "发展", vi: "Phát triển" },
  ],
  hard: [
    { en: "可持续", vi: "Bền vững" }, { en: "透明度", vi: "Sự minh bạch" },
    { en: "竞争力", vi: "Năng lực cạnh tranh" }, { en: "创新", vi: "Sáng tạo" },
    { en: "效率", vi: "Hiệu quả" }, { en: "挑战", vi: "Thách thức" },
    { en: "机遇", vi: "Cơ hội" }, { en: "战略", vi: "Chiến lược" },
    { en: "合作", vi: "Hợp tác" }, { en: "影响", vi: "Ảnh hưởng" },
  ],
};

async function handleChineseTopic(body) {
  const topic = cleanText(body.topic, { maxLength: 80 });
  const rawData = await groqJson(
    "Bạn tạo từ điển tiếng Trung cho người Việt học. Chỉ trả JSON thuần, không markdown.",
    `Tạo 16 từ tiếng Trung theo chủ đề "${topic}". Trả về duy nhất một JSON array: [{"zh":"汉字","vi":"nghĩa tiếng Việt","pro":"pinyin","ex":"Câu ví dụ tiếng Trung (phiên âm - dịch nghĩa)"}].`,
    0.45,
  );
  if (!Array.isArray(rawData)) throw new Error("AI không trả về danh sách từ.");
  const words = rawData.slice(0, 20).map((item) => ({
    zh: cleanText(item.zh, { maxLength: 60 }),
    vi: cleanText(item.vi, { maxLength: 120 }),
    pro: cleanText(item.pro ?? "", { maxLength: 80, allowEmpty: true }) || "...",
    ex: cleanText(item.ex, { maxLength: 300 }),
  }));
  if (words.length < 6) throw new Error("AI chưa tạo đủ bộ từ hợp lệ.");
  return jsonResponse({ topic, words });
}

async function handleChineseExplain(body) {
  const sentence = cleanText(body.sentence, { maxLength: 300 });
  const rawData = await groqJson(
    "Bạn là gia sư tiếng Trung. Chỉ trả JSON thuần, không markdown.",
    `Giải thích ngắn gọn câu tiếng Trung sau cho người Việt: "${sentence}". Trả JSON: {"explanation":"..."}`,
    0.2,
  );
  const explanation = cleanText(rawData?.explanation, { maxLength: 800 });
  return jsonResponse({ explanation });
}

async function handleChineseReading(body) {
  const level = parseLevel(body.level);
  const rawData = await groqJson(
    "Bạn tạo bài đọc tiếng Trung cho người Việt học. Chỉ trả JSON thuần.",
    `Viết 1 đoạn tiếng Trung 60-90 từ ở mức ${LEVEL_LABELS[level]}. Kèm tiêu đề bằng tiếng Trung, bản dịch tiếng Việt và nghĩa các từ quan trọng. Trả JSON: {"title":"...","content":"...","translation":"...","vocab":{"汉字":"nghĩa"}}`,
    0.45,
  );
  return jsonResponse({
    title: cleanText(rawData?.title, { maxLength: 120 }),
    content: cleanText(rawData?.content, { maxLength: 1200 }),
    translation: cleanText(rawData?.translation, { maxLength: 1600 }),
    vocab: normalizeVocabMap(rawData?.vocab),
  });
}

async function handleChineseListening(body) {
  const level = parseLevel(body.level);
  const rawData = await groqJson(
    "Bạn tạo bài nghe tiếng Trung cho người Việt. Chỉ trả JSON thuần.",
    `Tạo transcript hội thoại tiếng Trung 50-80 từ ở mức ${LEVEL_LABELS[level]}. Sinh 3 câu trắc nghiệm bằng tiếng Việt, mỗi câu 4 lựa chọn và answerIndex. Trả JSON: {"transcript":"...","questions":[{"q":"...","options":["A","B","C","D"],"answerIndex":0}]}`,
    0.25,
  );
  return jsonResponse({
    transcript: cleanText(rawData?.transcript, { maxLength: 1400 }),
    questions: normalizeQuestions(rawData?.questions),
  });
}

async function handleChineseMatching(body) {
  const level = parseLevel(body.level);
  const aiEnabled = Boolean(process.env.GROQ_API_KEY?.trim() || process.env.ZEROENGLISH_GROQ_API_KEY?.trim());
  if (!aiEnabled) {
    const fallback = CN_MATCHING_FALLBACK[level].map((pair, index) => ({ id: index + 1, en: pair.en, vi: pair.vi }));
    return jsonResponse({ pairs: fallback, levelLabel: LEVEL_LABELS[level], source: "fallback" });
  }
  const rawData = await groqJson(
    "Bạn tạo bài ghép từ tiếng Trung - tiếng Việt. Chỉ trả JSON thuần.",
    `Tạo bộ ghép từ tiếng Trung ở mức ${LEVEL_LABELS[level]}. Chỉ dùng từ hoặc cụm từ ngắn. Trả JSON: {"pairs":[{"en":"汉字","vi":"nghĩa tiếng Việt"}]}`,
    0.35,
  );
  return jsonResponse({
    pairs: normalizePairs(rawData?.pairs, level),
    levelLabel: LEVEL_LABELS[level],
    source: "ai",
  });
}

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  const url = new URL(request.url);
  const endpoint = resolveEndpoint(url.pathname);

  try {
    if (request.method === "GET" && endpoint === "bootstrap") {
      return await handleBootstrap();
    }
    if (request.method === "GET" && endpoint === "admin/status") {
      return await handleAdminStatus(request);
    }
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method không được hỗ trợ." }, 405);
    }

    const body = await parseRequestBody(request);

    if (endpoint === "ai/topic") {
      return await handleTopic(body);
    }
    if (endpoint === "ai/explain") {
      return await handleExplain(body);
    }
    if (endpoint === "ai/reading") {
      return await handleReading(body);
    }
    if (endpoint === "ai/grammar") {
      return await handleGrammar(body);
    }
    if (endpoint === "ai/chat") {
      return await handleChat(body);
    }
    if (endpoint === "ai/listening") {
      return await handleListening(body);
    }
    if (endpoint === "ai/matching") {
      return await handleMatching(body);
    }
    if (endpoint === "ai/cn/topic") {
      return await handleChineseTopic(body);
    }
    if (endpoint === "ai/cn/explain") {
      return await handleChineseExplain(body);
    }
    if (endpoint === "ai/cn/reading") {
      return await handleChineseReading(body);
    }
    if (endpoint === "ai/cn/listening") {
      return await handleChineseListening(body);
    }
    if (endpoint === "ai/cn/matching") {
      return await handleChineseMatching(body);
    }

    return jsonResponse({ error: "Endpoint không tồn tại." }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Có lỗi nội bộ xảy ra trên server.";
    const status = (
      message.includes("không hợp lệ")
      || message.includes("Thiếu")
      || message.includes("Sai admin token")
      || message.includes("Method không được hỗ trợ")
    ) ? 400 : (
      message.includes("chưa được cấu hình")
      || message.includes("AI backend")
      || message.includes("AI trả về lỗi HTTP")
    ) ? 503 : 500;

    return jsonResponse({ error: message }, status);
  }
};

export const config = {
  path: "/api/*",
};
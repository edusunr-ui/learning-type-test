import { chromium } from "playwright";

const RESULT_TYPE_NAMES = {
  ACE: "파스칼형",
  ACF: "아인슈타인형",
  BCE: "러셀형",
  BCF: "가우스형",
  ADE: "뉴턴형",
  ADF: "피타고라스형",
  BDE: "데카르트형",
  BDF: "칸트형",
};

const LEVEL_LABELS = {
  elementary: "초등부",
  middle: "중등부",
  high: "고등부",
};

const MAX_SCORE_BY_LEVEL = {
  elementary: 35,
  middle: 50,
  high: 50,
};

function inferPairs(record) {
  return [
    {
      label: "긍정형 vs 부정형",
      winner: Number(record.positiveScore || 0) >= Number(record.negativeScore || 0) ? "긍정형" : "부정형",
    },
    {
      label: "내적동기형 vs 외적동기형",
      winner: Number(record.internalScore || 0) >= Number(record.externalScore || 0) ? "내적동기형" : "외적동기형",
    },
    {
      label: "논리적 접근형 vs 직관적 접근형",
      winner: Number(record.logicalScore || 0) >= Number(record.intuitiveScore || 0) ? "논리적 접근형" : "직관적 접근형",
    },
  ];
}

function buildRenderPayload(record) {
  return {
    attemptId: record.attemptId || `cloud-export-${Date.now()}`,
    createdAt: record.createdAt || new Date().toISOString(),
    level: record.level,
    levelLabel: record.levelLabel || LEVEL_LABELS[record.level] || "",
    maxScore: Number(record.maxScore || MAX_SCORE_BY_LEVEL[record.level] || 50),
    info: {
      school: record.school || "",
      grade: record.grade || "",
      name: record.name || "",
    },
    result: {
      code: record.resultCode,
      type: {
        name: record.resultType || RESULT_TYPE_NAMES[record.resultCode] || "미분류",
      },
      scores: [
        { key: "positive", label: "긍정형", score: Number(record.positiveScore || 0) },
        { key: "negative", label: "부정형", score: Number(record.negativeScore || 0) },
        { key: "internal", label: "내적동기형", score: Number(record.internalScore || 0) },
        { key: "external", label: "외적동기형", score: Number(record.externalScore || 0) },
        { key: "logical", label: "논리적 접근형", score: Number(record.logicalScore || 0) },
        { key: "intuitive", label: "직관적 접근형", score: Number(record.intuitiveScore || 0) },
      ],
      pairs: inferPairs(record),
    },
  };
}

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

function buildRenderUrl(record) {
  const baseUrl = String(process.env.RESULT_RENDER_URL || "").trim();
  if (!baseUrl) {
    throw new Error("RESULT_RENDER_URL is required.");
  }

  const payload = encodePayload(buildRenderPayload(record));
  const url = new URL(baseUrl);
  url.searchParams.set("payload", payload);
  return url.toString();
}

export function buildPdfName(record) {
  const submittedAt = new Date(record.submittedAt || Date.now());
  const y = submittedAt.getFullYear();
  const m = String(submittedAt.getMonth() + 1).padStart(2, "0");
  const d = String(submittedAt.getDate()).padStart(2, "0");
  const safeSchool = String(record.school || "학교").replace(/[\\/:*?"<>|]/g, "_");
  const safeGrade = String(record.grade || "-").replace(/[\\/:*?"<>|]/g, "_");
  const safeName = String(record.name || "학생").replace(/[\\/:*?"<>|]/g, "_");
  const safeType = String(record.resultType || RESULT_TYPE_NAMES[record.resultCode] || "결과").replace(/[\\/:*?"<>|]/g, "_");
  return `${String(y).slice(-2)}.${m}.${d}_${safeSchool}_${safeGrade}_${safeName}_${safeType}.pdf`;
}

export async function renderTeacherResultPdf(record) {
  const browser = await chromium.launch({
    headless: true,
    args: ["--allow-file-access-from-files"],
  });

  try {
    const page = await browser.newPage();
    await page.goto(buildRenderUrl(record), { waitUntil: "networkidle" });
    await page.emulateMedia({ media: "screen" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "0",
        right: "0",
        bottom: "0",
        left: "0",
      },
    });
    return {
      bytes: pdf,
      fileName: buildPdfName(record),
    };
  } finally {
    await browser.close();
  }
}

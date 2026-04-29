const SPREADSHEET_ID = "여기에_실제_구글시트_ID";
const SHEET_NAME = "Results";

// Optional: leave blank to save PDFs in My Drive root.
const PDF_FOLDER_ID = "";

const HEADERS = [
  "attemptId",
  "createdAt",
  "submittedAt",
  "school",
  "grade",
  "name",
  "level",
  "levelLabel",
  "questionCount",
  "perCategory",
  "answersJson",
  "resultCode",
  "resultType",
  "positiveScore",
  "negativeScore",
  "internalScore",
  "externalScore",
  "logicalScore",
  "intuitiveScore",
  "positiveVsNegative",
  "internalVsExternal",
  "logicalVsIntuitive",
  "siteUrl",
  "resultPdfFileId",
  "resultPdfUrl",
  "resultPdfName",
];

const CATEGORIES = [
  { key: "positive", label: "긍정형", code: "A" },
  { key: "negative", label: "부정형", code: "B" },
  { key: "internal", label: "내적동기형", code: "C" },
  { key: "external", label: "외적동기형", code: "D" },
  { key: "logical", label: "논리적 접근형", code: "E" },
  { key: "intuitive", label: "직관적 접근형", code: "F" },
];

const RESULT_TYPES = {
  ACE: "파스칼형",
  ACF: "아인슈타인형",
  BCE: "러셀형",
  BCF: "가우스형",
  ADE: "뉴턴형",
  ADF: "피타고라스형",
  BDE: "데카르트형",
  BDF: "칸트형",
};

const RESULT_SUMMARIES = {
  "파스칼형": "과정을 분석하며 차근차근 이해를 쌓는 경향이 강합니다.",
  "아인슈타인형": "직관과 호기심을 바탕으로 새로운 접근을 잘 시도합니다.",
  "러셀형": "논리적 구조를 세우고 안정적으로 문제를 해결하는 편입니다.",
  "가우스형": "빠른 패턴 인식과 계산 감각이 강점입니다.",
  "뉴턴형": "목표 중심으로 계획을 세워 밀도 있게 학습합니다.",
  "피타고라스형": "직관과 감각을 살려 문제 흐름을 빠르게 잡습니다.",
  "데카르트형": "분석과 구조화를 통해 해결의 실마리를 찾습니다.",
  "칸트형": "자기 방식으로 개념을 정리하며 이해를 깊게 만듭니다.",
};

const LEVEL_DEFAULTS = {
  elementary: { questionCount: 42, perCategory: 7 },
  middle: { questionCount: 60, perCategory: 10 },
  high: { questionCount: 60, perCategory: 10 },
};

function doPost(e) {
  try {
    const payload = normalizePayload_(e.parameter || {});
    const result = calculateResult_(payload);
    const sheet = getSheet_();
    const rowIndex = findRowByAttemptId_(sheet, payload.attemptId);
    const existingRow = rowIndex > 0 ? getExistingRowMap_(sheet, rowIndex) : {};
    const pdfInfo = createOrReplaceResultPdf_(result, existingRow);
    const rowRecord = { ...result, ...pdfInfo };
    const rowValues = HEADERS.map((header) => rowRecord[header] || "");

    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }

    return jsonResponse_({
      ok: true,
      attemptId: payload.attemptId,
      resultCode: result.resultCode,
      resultPdfUrl: pdfInfo.resultPdfUrl,
    });
  } catch (error) {
    return jsonResponse_({ ok: false, message: String(error) });
  }
}

function doGet() {
  return jsonResponse_({ ok: true, message: "Learning type sheet endpoint is running." });
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  } else {
    const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
    if (HEADERS.some((header, index) => firstRow[index] !== header)) {
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    }
  }

  return sheet;
}

function findRowByAttemptId_(sheet, attemptId) {
  if (!attemptId || sheet.getLastRow() < 2) return -1;

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  const rowOffset = values.findIndex(([value]) => String(value) === String(attemptId));
  return rowOffset === -1 ? -1 : rowOffset + 2;
}

function getExistingRowMap_(sheet, rowIndex) {
  const values = sheet.getRange(rowIndex, 1, 1, HEADERS.length).getValues()[0];
  return Object.fromEntries(HEADERS.map((header, index) => [header, values[index]]));
}

function normalizePayload_(payload) {
  const normalized = {
    attemptId: String(payload.attemptId || "").trim(),
    createdAt: String(payload.createdAt || "").trim(),
    submittedAt: String(payload.submittedAt || "").trim(),
    school: String(payload.school || "").trim(),
    grade: String(payload.grade || "").trim(),
    name: String(payload.name || "").trim(),
    level: String(payload.level || "").trim(),
    levelLabel: String(payload.levelLabel || "").trim(),
    questionCount: String(payload.questionCount || "").trim(),
    perCategory: String(payload.perCategory || "").trim(),
    answersJson: String(payload.answersJson || "").trim(),
    siteUrl: String(payload.siteUrl || "").trim(),
  };

  if (!normalized.attemptId) throw new Error("attemptId is required.");
  if (!normalized.answersJson) throw new Error("answersJson is required.");

  return normalized;
}

function calculateResult_(payload) {
  const defaults = LEVEL_DEFAULTS[payload.level] || {};
  const questionCount = Number(payload.questionCount || defaults.questionCount || 0);
  const perCategory = Number(payload.perCategory || defaults.perCategory || 0);
  const answers = parseAnswers_(payload.answersJson, questionCount);

  if (!perCategory) {
    throw new Error("perCategory is required.");
  }

  const scores = CATEGORIES.map((category, categoryIndex) => {
    const startIndex = categoryIndex * perCategory;
    const score = answers
      .slice(startIndex, startIndex + perCategory)
      .reduce((sum, value) => sum + Number(value || 0), 0);
    return { key: category.key, label: category.label, code: category.code, score };
  });

  const first = scores[0].score >= scores[1].score ? "A" : "B";
  const second = scores[2].score >= scores[3].score ? "C" : "D";
  const third = scores[4].score >= scores[5].score ? "E" : "F";
  const resultCode = `${first}${second}${third}`;
  const resultType = RESULT_TYPES[resultCode] || "미분류";

  return {
    attemptId: payload.attemptId,
    createdAt: payload.createdAt,
    submittedAt: payload.submittedAt,
    school: payload.school,
    grade: payload.grade,
    name: payload.name,
    level: payload.level,
    levelLabel: payload.levelLabel,
    questionCount: String(questionCount),
    perCategory: String(perCategory),
    answersJson: JSON.stringify(answers),
    resultCode: resultCode,
    resultType: resultType,
    positiveScore: String(scores[0].score),
    negativeScore: String(scores[1].score),
    internalScore: String(scores[2].score),
    externalScore: String(scores[3].score),
    logicalScore: String(scores[4].score),
    intuitiveScore: String(scores[5].score),
    positiveVsNegative: first === "A" ? "긍정형" : "부정형",
    internalVsExternal: second === "C" ? "내적동기형" : "외적동기형",
    logicalVsIntuitive: third === "E" ? "논리적 접근형" : "직관적 접근형",
    siteUrl: payload.siteUrl,
  };
}

function parseAnswers_(answersJson, questionCount) {
  let answers;
  try {
    answers = JSON.parse(answersJson);
  } catch (error) {
    throw new Error(`answersJson parse failed: ${error}`);
  }

  if (!Array.isArray(answers)) {
    throw new Error("answersJson must be an array.");
  }

  const normalized = answers.map((value) => Number(value || 0));
  if (questionCount && normalized.length !== questionCount) {
    throw new Error(`answersJson length mismatch: expected ${questionCount}, received ${normalized.length}`);
  }

  return normalized;
}

function createOrReplaceResultPdf_(result, existingRow) {
  if (existingRow.resultPdfFileId) {
    try {
      DriveApp.getFileById(String(existingRow.resultPdfFileId)).setTrashed(true);
    } catch (error) {
      Logger.log(`Existing PDF cleanup skipped: ${error}`);
    }
  }

  const folder = getPdfFolder_();
  const pdfName = buildPdfName_(result);
  const doc = DocumentApp.create(`TMP_${pdfName}`);
  const body = doc.getBody();

  body.clear();
  body.appendParagraph("학습유형검사 결과 보고서")
    .setHeading(DocumentApp.ParagraphHeading.HEADING1)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  body.appendParagraph(`${result.name || "학생"} / ${result.school || "-"} / ${result.grade || "-"}학년 / ${result.levelLabel || "-"}`)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  body.appendParagraph(`제출 시각: ${result.submittedAt || "-"}`)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  body.appendParagraph("");
  body.appendParagraph(`결과 유형: ${result.resultType} (${result.resultCode})`)
    .setHeading(DocumentApp.ParagraphHeading.HEADING2);

  body.appendParagraph(RESULT_SUMMARIES[result.resultType] || "학습유형검사 결과 요약입니다.");

  body.appendParagraph("");
  body.appendParagraph("영역별 점수")
    .setHeading(DocumentApp.ParagraphHeading.HEADING2);

  body.appendTable([
    ["영역", "점수"],
    ["긍정형", result.positiveScore],
    ["부정형", result.negativeScore],
    ["내적동기형", result.internalScore],
    ["외적동기형", result.externalScore],
    ["논리적 접근형", result.logicalScore],
    ["직관적 접근형", result.intuitiveScore],
  ]);

  body.appendParagraph("");
  body.appendParagraph("비교 결과")
    .setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph(`긍정형 vs 부정형: ${result.positiveVsNegative}`);
  body.appendParagraph(`내적동기형 vs 외적동기형: ${result.internalVsExternal}`);
  body.appendParagraph(`논리적 접근형 vs 직관적 접근형: ${result.logicalVsIntuitive}`);

  body.appendParagraph("");
  body.appendParagraph("원본 응답")
    .setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph(result.answersJson);

  doc.saveAndClose();

  const docFile = DriveApp.getFileById(doc.getId());
  const pdfBlob = docFile.getAs(MimeType.PDF).setName(pdfName);
  const pdfFile = folder.createFile(pdfBlob);
  docFile.setTrashed(true);

  return {
    resultPdfFileId: pdfFile.getId(),
    resultPdfUrl: pdfFile.getUrl(),
    resultPdfName: pdfFile.getName(),
  };
}

function getPdfFolder_() {
  if (!String(PDF_FOLDER_ID || "").trim()) {
    return DriveApp.getRootFolder();
  }
  return DriveApp.getFolderById(PDF_FOLDER_ID);
}

function buildPdfName_(result) {
  const submitted = result.submittedAt
    ? Utilities.formatDate(new Date(result.submittedAt), Session.getScriptTimeZone(), "yyyyMMdd_HHmm")
    : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmm");
  const safeName = String(result.name || "학생").replace(/[\\/:*?"<>|]/g, "_");
  return `${safeName}_${result.resultType}_${submitted}.pdf`;
}

function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

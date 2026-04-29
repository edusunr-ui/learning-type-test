const SPREADSHEET_ID = "여기에_실제_구글시트_ID를_넣으세요";
const SHEET_NAME = "Results";

// Optional: leave blank to save PDFs in My Drive root.
const PDF_FOLDER_ID = "";
const RESULT_TEMPLATE_BASE_URL = "https://edusunr-ui.github.io/learning-type-test/assets/results";
const CLOUD_PDF_ENDPOINT = "";
const CLOUD_PDF_TOKEN = "";

// Teacher portal login password.
const ADMIN_PASSWORD = "여기에_선생님용_비밀번호를_넣으세요";
const ADMIN_SESSION_HOURS = 8;
const ADMIN_RESULTS_LIMIT = 300;

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

const RESULT_PDF_SLUGS = {
  파스칼형: "pascal",
  아인슈타인형: "einstein",
  러셀형: "russell",
  가우스형: "gauss",
  뉴턴형: "newton",
  피타고라스형: "pythagoras",
  데카르트형: "descartes",
  칸트형: "kant",
};

const LEVEL_DEFAULTS = {
  elementary: { questionCount: 42, perCategory: 7, maxScore: 35 },
  middle: { questionCount: 60, perCategory: 10, maxScore: 50 },
  high: { questionCount: 60, perCategory: 10, maxScore: 50 },
};

const ADMIN_SESSION_PREFIX = "adminSession:";

function doPost(e) {
  const params = (e && e.parameter) || {};
  try {
    const action = String(params.action || "").trim();

    if (action) {
      return responseFromData_(handleAdminAction_(action, params), params);
    }

    return responseFromData_(handleSurveySubmit_(params), params);
  } catch (error) {
    return responseFromData_({ ok: false, message: String(error) }, params);
  }
}

function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = String(params.action || "").trim();
  try {
    if (action && action !== "status") {
      return responseFromData_(handleAdminAction_(action, params), params);
    }
  } catch (error) {
    return responseFromData_({ ok: false, message: String(error) }, params);
  }

  if (action === "status") {
    return responseFromData_({ ok: true, message: "Learning type sheet endpoint is running." }, params);
  }

  return responseFromData_({ ok: true, message: "Learning type sheet endpoint is running." }, params);
}

function handleSurveySubmit_(params) {
  const payload = normalizePayload_(params);
  const result = calculateResult_(payload);
  const sheet = getSheet_();
  const rowIndex = findRowByAttemptId_(sheet, payload.attemptId);
  const existingRow = rowIndex > 0 ? getExistingRowMap_(sheet, rowIndex) : {};
  const pdfInfo = createResultPdf_(result, existingRow);
  const rowRecord = { ...result, ...pdfInfo };
  const rowValues = HEADERS.map((header) => rowRecord[header] || "");

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  return {
    ok: true,
    attemptId: payload.attemptId,
    resultCode: result.resultCode,
    resultPdfUrl: pdfInfo.resultPdfUrl,
  };
}

function handleAdminAction_(action, params) {
  cleanupAdminSessions_();

  switch (action) {
    case "login":
      return loginAdmin_(params);
    case "logout":
      return logoutAdmin_(params);
    case "listResults":
      return listResults_(params);
    case "getResult":
      return getResult_(params);
    case "deleteResults":
      return deleteResults_(params);
    default:
      return { ok: false, message: `Unknown action: ${action}` };
  }
}

function loginAdmin_(params) {
  const password = String(params.password || "").trim();
  if (!String(ADMIN_PASSWORD || "").trim()) {
    throw new Error("ADMIN_PASSWORD is not configured.");
  }
  if (!password) {
    throw new Error("비밀번호를 입력해 주세요.");
  }
  if (password !== String(ADMIN_PASSWORD).trim()) {
    throw new Error("비밀번호가 올바르지 않습니다.");
  }

  const session = createAdminSession_();
  return {
    ok: true,
    token: session.token,
    expiresAt: session.expiresAt,
  };
}

function logoutAdmin_(params) {
  const token = requireAdminSessionToken_(params);
  deleteAdminSession_(token);
  return { ok: true };
}

function listResults_(params) {
  requireAdminSession_(params);

  const sheet = getSheet_();
  if (sheet.getLastRow() < 2) {
    return { ok: true, items: [] };
  }

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues();
  const items = values
    .map((row) => rowToMap_(row))
    .filter((row) => String(row.attemptId || "").trim())
    .sort(compareSubmittedAtDesc_)
    .slice(0, ADMIN_RESULTS_LIMIT)
    .map((row) => ({
      attemptId: String(row.attemptId || ""),
      submittedAt: String(row.submittedAt || ""),
      school: String(row.school || ""),
      grade: String(row.grade || ""),
      name: String(row.name || ""),
      levelLabel: String(row.levelLabel || ""),
      resultCode: String(row.resultCode || ""),
      resultType: String(row.resultType || ""),
      resultPdfUrl: String(row.resultPdfUrl || ""),
    }));

  return { ok: true, items };
}

function getResult_(params) {
  requireAdminSession_(params);

  const attemptId = String(params.attemptId || "").trim();
  if (!attemptId) {
    throw new Error("attemptId is required.");
  }

  const sheet = getSheet_();
  const rowIndex = findRowByAttemptId_(sheet, attemptId);
  if (rowIndex < 0) {
    throw new Error("해당 결과를 찾을 수 없습니다.");
  }

  const row = getExistingRowMap_(sheet, rowIndex);
  return {
    ok: true,
    payload: buildTeacherResultPayload_(row),
  };
}

function deleteResults_(params) {
  requireAdminSession_(params);

  const attemptIds = parseAttemptIds_(params.attemptIds);
  if (!attemptIds.length) {
    throw new Error("삭제할 결과가 없습니다.");
  }

  const sheet = getSheet_();
  const attemptIdSet = new Set(attemptIds);
  const deletedPdfFileIds = [];

  if (sheet.getLastRow() >= 2) {
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues();
    for (let index = values.length - 1; index >= 0; index -= 1) {
      const row = rowToMap_(values[index]);
      if (!attemptIdSet.has(String(row.attemptId || "").trim())) continue;

      if (String(row.resultPdfFileId || "").trim()) {
        deletedPdfFileIds.push(String(row.resultPdfFileId).trim());
      }

      sheet.deleteRow(index + 2);
    }
  }

  deletedPdfFileIds.forEach((fileId) => {
    try {
      DriveApp.getFileById(fileId).setTrashed(true);
    } catch (error) {
      Logger.log(`PDF cleanup skipped for ${fileId}: ${error}`);
    }
  });

  return {
    ok: true,
    deletedCount: attemptIds.length,
  };
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
  return rowToMap_(values);
}

function rowToMap_(rowValues) {
  return Object.fromEntries(HEADERS.map((header, index) => [header, rowValues[index]]));
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
    resultCode,
    resultType,
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

function parseAttemptIds_(attemptIdsJson) {
  const raw = String(attemptIdsJson || "").trim();
  if (!raw) return [];

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`attemptIds parse failed: ${error}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("attemptIds must be an array.");
  }

  return parsed.map((value) => String(value || "").trim()).filter(Boolean);
}

function createResultPdf_(result, existingRow) {
  const endpoint = String(CLOUD_PDF_ENDPOINT || "").trim();
  if (endpoint) {
    return requestCloudResultPdf_(result);
  }

  return copyTemplateResultPdf_(result, existingRow);
}

function copyTemplateResultPdf_(result, existingRow) {
  if (existingRow.resultPdfFileId) {
    try {
      DriveApp.getFileById(String(existingRow.resultPdfFileId)).setTrashed(true);
    } catch (error) {
      Logger.log(`Existing PDF cleanup skipped: ${error}`);
    }
  }

  const folder = getPdfFolder_();
  const pdfName = buildPdfName_(result);
  const pdfFile = folder.createFile(fetchTemplatePdfBlob_(result).setName(pdfName));

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

function fetchTemplatePdfBlob_(result) {
  const slug = RESULT_PDF_SLUGS[result.resultType];
  if (!slug) {
    throw new Error(`Unknown resultType for PDF template: ${result.resultType}`);
  }

  const templateUrl = `${RESULT_TEMPLATE_BASE_URL}/${slug}.pdf`;
  const response = UrlFetchApp.fetch(templateUrl, { muteHttpExceptions: true });
  const statusCode = response.getResponseCode();

  if (statusCode !== 200) {
    throw new Error(`Result PDF template fetch failed: ${statusCode} ${templateUrl}`);
  }

  return response.getBlob();
}

function requestCloudResultPdf_(result) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (String(CLOUD_PDF_TOKEN || "").trim()) {
    headers.Authorization = `Bearer ${String(CLOUD_PDF_TOKEN).trim()}`;
  }

  const response = UrlFetchApp.fetch(String(CLOUD_PDF_ENDPOINT).trim(), {
    method: "post",
    contentType: "application/json",
    headers,
    payload: JSON.stringify(result),
    muteHttpExceptions: true,
  });

  const statusCode = response.getResponseCode();
  const text = response.getContentText();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(`Cloud PDF response parse failed: ${error} / body=${text}`);
  }

  if (statusCode < 200 || statusCode >= 300 || !data.ok) {
    throw new Error(`Cloud PDF generation failed: status=${statusCode} body=${text}`);
  }

  return {
    resultPdfFileId: String(data.resultPdfFileId || ""),
    resultPdfUrl: String(data.resultPdfUrl || ""),
    resultPdfName: String(data.resultPdfName || ""),
  };
}

function buildPdfName_(result) {
  const submitted = result.submittedAt
    ? Utilities.formatDate(new Date(result.submittedAt), Session.getScriptTimeZone(), "yyyyMMdd_HHmm")
    : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmm");
  const safeName = String(result.name || "학생").replace(/[\\/:*?"<>|]/g, "_");
  return `${safeName}_${result.resultType}_${submitted}.pdf`;
}

function buildTeacherResultPayload_(row) {
  const levelConfig = LEVEL_DEFAULTS[String(row.level || "").trim()] || LEVEL_DEFAULTS.middle;

  return {
    attemptId: String(row.attemptId || ""),
    info: {
      school: String(row.school || ""),
      grade: String(row.grade || ""),
      name: String(row.name || ""),
      level: String(row.level || ""),
      levelLabel: String(row.levelLabel || ""),
      submittedAt: String(row.submittedAt || ""),
    },
    maxScore: Number(levelConfig.maxScore || 50),
    result: {
      type: {
        code: String(row.resultCode || ""),
        name: String(row.resultType || "미분류"),
      },
      scores: [
        { label: "긍정형", score: Number(row.positiveScore || 0) },
        { label: "부정형", score: Number(row.negativeScore || 0) },
        { label: "내적동기형", score: Number(row.internalScore || 0) },
        { label: "외적동기형", score: Number(row.externalScore || 0) },
        { label: "논리적 접근형", score: Number(row.logicalScore || 0) },
        { label: "직관적 접근형", score: Number(row.intuitiveScore || 0) },
      ],
      pairs: [
        { left: "긍정형", right: "부정형", winner: String(row.positiveVsNegative || "") },
        { left: "내적동기형", right: "외적동기형", winner: String(row.internalVsExternal || "") },
        { left: "논리적 접근형", right: "직관적 접근형", winner: String(row.logicalVsIntuitive || "") },
      ],
    },
  };
}

function requireAdminSessionToken_(params) {
  const token = String(params.token || "").trim();
  if (!token) {
    throw new Error("로그인 세션이 필요합니다.");
  }
  return token;
}

function requireAdminSession_(params) {
  const token = requireAdminSessionToken_(params);
  const properties = PropertiesService.getScriptProperties();
  const raw = properties.getProperty(`${ADMIN_SESSION_PREFIX}${token}`);
  if (!raw) {
    throw new Error("세션이 만료되었습니다. 다시 로그인해 주세요.");
  }

  let session;
  try {
    session = JSON.parse(raw);
  } catch (error) {
    properties.deleteProperty(`${ADMIN_SESSION_PREFIX}${token}`);
    throw new Error(`세션을 읽을 수 없습니다: ${error}`);
  }

  if (!session.expiresAt || Number(session.expiresAt) <= Date.now()) {
    properties.deleteProperty(`${ADMIN_SESSION_PREFIX}${token}`);
    throw new Error("세션이 만료되었습니다. 다시 로그인해 주세요.");
  }

  return session;
}

function createAdminSession_() {
  const token = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
  const expiresAt = Date.now() + Number(ADMIN_SESSION_HOURS || 8) * 60 * 60 * 1000;
  PropertiesService.getScriptProperties().setProperty(
    `${ADMIN_SESSION_PREFIX}${token}`,
    JSON.stringify({ token, expiresAt })
  );
  return { token, expiresAt };
}

function deleteAdminSession_(token) {
  PropertiesService.getScriptProperties().deleteProperty(`${ADMIN_SESSION_PREFIX}${token}`);
}

function cleanupAdminSessions_() {
  const properties = PropertiesService.getScriptProperties();
  const all = properties.getProperties();
  const now = Date.now();

  Object.keys(all).forEach((key) => {
    if (!key.startsWith(ADMIN_SESSION_PREFIX)) return;
    try {
      const session = JSON.parse(all[key]);
      if (!session.expiresAt || Number(session.expiresAt) <= now) {
        properties.deleteProperty(key);
      }
    } catch (error) {
      properties.deleteProperty(key);
    }
  });
}

function compareSubmittedAtDesc_(a, b) {
  const aTime = parseDateValue_(a.submittedAt);
  const bTime = parseDateValue_(b.submittedAt);
  return bTime - aTime;
}

function parseDateValue_(value) {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function responseFromData_(data, params) {
  const callback = sanitizeJsonpCallback_(params && params.callback);
  if (callback) {
    return ContentService
      .createTextOutput(`${callback}(${JSON.stringify(data)})`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return jsonResponse_(data);
}

function sanitizeJsonpCallback_(value) {
  const callback = String(value || "").trim();
  if (!callback) return "";
  return /^[A-Za-z0-9_.$]+$/.test(callback) ? callback : "";
}

function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

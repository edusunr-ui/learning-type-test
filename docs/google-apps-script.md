# Google Sheets 제출 전용 설정

학생 화면에는 결과를 보여주지 않고, 응답만 제출한 뒤 Google Sheets에서 결과를 계산해서 확인하는 운영용 설정입니다.

## 1. Google Sheets 준비

1. 새 Google Sheets 문서를 만듭니다.
2. 결과를 저장할 탭 이름을 `Results`로 둡니다.
3. 시트 URL에서 스프레드시트 ID를 복사합니다.

예시:

```text
https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890/edit
```

위 주소에서 ID는 아래 부분입니다.

```text
1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890
```

## 2. Apps Script 코드

구글 시트에서 `확장 프로그램 > Apps Script`로 들어간 뒤 `Code.gs` 전체를 아래 코드로 바꿔 넣으세요.

```javascript
const SPREADSHEET_ID = "여기에_실제_구글시트_ID";
const SHEET_NAME = "Results";

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
    const rowValues = HEADERS.map((header) => result[header] || "");

    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }

    return jsonResponse_({ ok: true, attemptId: payload.attemptId, resultCode: result.resultCode });
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

  if (!normalized.attemptId) {
    throw new Error("attemptId is required.");
  }

  if (!normalized.answersJson) {
    throw new Error("answersJson is required.");
  }

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
    resultType: RESULT_TYPES[resultCode] || "미분류",
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

function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## 3. 웹앱 배포

1. 오른쪽 위 `배포` 클릭
2. `새 배포` 또는 `배포 관리 > 수정`
3. 유형은 `웹 앱`
4. 실행 계정은 `나`
5. 액세스 권한은 `모든 사용자`
6. 배포 후 나온 웹앱 URL을 복사

브라우저에서 웹앱 URL을 직접 열었을 때 아래처럼 보이면 정상입니다.

```json
{"ok":true,"message":"Learning type sheet endpoint is running."}
```

## 4. 사이트와 연결

`[sheets-config.js](Z:\01. 개인 폴더\04. 강다슬\학습유형검사\docs\sheets-config.js)`의 `endpoint`에 방금 배포한 웹앱 URL을 넣습니다.

```javascript
window.LEARNING_TYPE_CONFIG = {
  googleSheets: {
    endpoint: "https://script.google.com/macros/s/배포아이디/exec",
  },
};
```

## 5. 저장되는 항목

- 학생 정보: 학교명, 학년, 이름, 검사급
- 원본 응답: `answersJson`
- 계산 결과: `resultCode`, `resultType`
- 6개 영역 점수
- 3개 비교 결과
- 제출 시각, 페이지 주소

## 운영 메모

- 학생은 제출 완료 메시지만 보고 결과를 직접 볼 수 없습니다.
- 결과 유형 계산은 Google Sheets용 Apps Script에서 처리됩니다.
- 같은 `attemptId`로 다시 제출되면 기존 행을 업데이트합니다.

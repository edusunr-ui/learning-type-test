const RESULT_STORAGE_NAMESPACE = "learning-type-result-v2";
const SURVEY_STORAGE_NAMESPACE = "learning-type-survey-v2";
const PENDING_SHEETS_STORAGE_NAMESPACE = "learning-type-pending-sheets-v1";
const SHEETS_CONFIG = window.LEARNING_TYPE_CONFIG?.googleSheets || {};

function attemptIdFromUrl() {
  return new URL(window.location.href).searchParams.get("attempt") || "";
}

function resultStorageKey(attemptId) {
  return `${RESULT_STORAGE_NAMESPACE}:${attemptId}`;
}

function surveyStorageKey(attemptId) {
  return `${SURVEY_STORAGE_NAMESPACE}:${attemptId}`;
}

function pendingSheetsStorageKey(attemptId) {
  return `${PENDING_SHEETS_STORAGE_NAMESPACE}:${attemptId}`;
}

function sheetsEndpoint() {
  const endpoint = String(SHEETS_CONFIG.endpoint || "").trim();
  return endpoint || "";
}

function loadPendingSheetsPayload(attemptId) {
  if (!attemptId) return null;
  const raw = sessionStorage.getItem(pendingSheetsStorageKey(attemptId));
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    sessionStorage.removeItem(pendingSheetsStorageKey(attemptId));
    return null;
  }
}

function clearPendingSheetsPayload(attemptId) {
  if (!attemptId) return;
  sessionStorage.removeItem(pendingSheetsStorageKey(attemptId));
}

async function retryPendingSheetsSave(attemptId) {
  const endpoint = sheetsEndpoint();
  const payload = loadPendingSheetsPayload(attemptId);
  if (!endpoint || !payload) return;

  try {
    await fetch(endpoint, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: new URLSearchParams(
        Object.entries(payload).map(([key, value]) => [key, value == null ? "" : String(value)])
      ).toString(),
      keepalive: true,
    });
    clearPendingSheetsPayload(attemptId);
  } catch (error) {
    console.error("Retrying Google Sheets save failed.", error);
  }
}

const TYPE_DETAILS = {
  "파스칼형": {
    person: "Blaise Pascal (1623 ~ 1662)",
    mark: "P",
    intro: "분석적인 사고와 내적 동기가 강한 탐구형 학습자입니다.",
    description:
      "파스칼형은 스스로 납득할 때 몰입이 깊어지고, 문제의 구조와 원리를 파악하려는 힘이 좋습니다. 정답만 확인하기보다 왜 그런지 설명하는 과정에서 실력이 안정적으로 쌓입니다.",
    strategies: [
      "풀이 과정을 말이나 글로 설명하며 개념 이해를 확인하세요.",
      "틀린 문제는 정답보다 오답 원인을 먼저 분류하세요.",
      "어려운 문제는 작은 조건 단위로 나누어 접근하면 강점이 살아납니다.",
    ],
  },
  "아인슈타인형": {
    person: "Albert Einstein (1879 ~ 1955)",
    mark: "E",
    intro: "호기심과 직관이 강해 새로운 관점으로 문제를 바라보는 학습자입니다.",
    description:
      "아인슈타인형은 흥미가 생기면 빠르게 몰입하고, 여러 가능성을 떠올리며 해결 실마리를 찾습니다. 다만 풀이 절차를 정리하는 습관을 함께 만들면 성과가 더 안정적입니다.",
    strategies: [
      "먼저 떠오른 아이디어를 적고, 그 뒤 식과 근거를 정리하세요.",
      "개념을 그림, 예시, 비유로 연결하면 기억이 오래갑니다.",
      "풀이 후에는 답이 맞은 이유를 한 줄로 검증하세요.",
    ],
  },
  "러셀형": {
    person: "Bertrand Russell (1872 ~ 1970)",
    mark: "R",
    intro: "신중하고 논리적인 기준으로 학습을 점검하는 학습자입니다.",
    description:
      "러셀형은 문제를 체계적으로 해석하고 근거를 따지는 힘이 있습니다. 불안이나 자기 의심이 커질 수 있으므로 작은 성공 경험을 자주 확인하는 방식이 좋습니다.",
    strategies: [
      "개념, 공식, 조건을 체크리스트로 만들고 하나씩 확인하세요.",
      "틀린 문제는 ‘몰라서’, ‘실수’, ‘조건 누락’으로 나누어 기록하세요.",
      "완벽히 이해하려는 부담보다 오늘의 기준을 정해 마무리하세요.",
    ],
  },
  "가우스형": {
    person: "Carl Friedrich Gauss (1777 ~ 1855)",
    mark: "G",
    intro: "정확성과 직관을 함께 활용하는 문제 해결형 학습자입니다.",
    description:
      "가우스형은 패턴을 빠르게 발견하고 답의 방향을 잡는 힘이 좋습니다. 풀이 속도는 장점이지만, 중간 계산과 조건 확인을 남기는 습관이 성적 안정성을 높입니다.",
    strategies: [
      "빠르게 푼 문제도 핵심 조건과 계산 과정을 표시하세요.",
      "감으로 잡은 풀이 방향을 공식이나 정의로 다시 확인하세요.",
      "실수 노트를 만들어 반복되는 계산 오류를 줄이세요.",
    ],
  },
  "뉴턴형": {
    person: "Isaac Newton (1643 ~ 1727)",
    mark: "N",
    intro: "목표 지향적이고 논리적으로 성과를 쌓아가는 학습자입니다.",
    description:
      "뉴턴형은 목표가 분명할수록 집중력이 올라가고, 원리와 절차를 통해 문제를 해결하려는 성향이 강합니다. 계획을 점검 가능한 단위로 나누면 꾸준함이 더 좋아집니다.",
    strategies: [
      "주간 목표를 문항 수, 오답 수, 개념 단위로 구체화하세요.",
      "풀이 전 조건 분석, 풀이 중 계산, 풀이 후 검산 순서를 고정하세요.",
      "점수 목표와 함께 개념 이해 목표를 같이 세우세요.",
    ],
  },
  "피타고라스형": {
    person: "Pythagoras (c. 570 ~ c. 495 BC)",
    mark: "Y",
    intro: "목표 의식과 직관적 감각이 함께 작동하는 실전형 학습자입니다.",
    description:
      "피타고라스형은 성취 목표가 있을 때 실행력이 좋아지고, 문제의 흐름을 빠르게 파악하는 편입니다. 풀이 감각을 안정적인 점수로 바꾸려면 복습 루틴이 중요합니다.",
    strategies: [
      "시험 전에는 유형별 대표 문제를 반복해 감각을 고정하세요.",
      "맞힌 문제도 풀이 근거를 짧게 적어 재현 가능하게 만드세요.",
      "목표 달성 보상과 학습 루틴을 연결하면 지속력이 좋아집니다.",
    ],
  },
  "데카르트형": {
    person: "Rene Descartes (1596 ~ 1650)",
    mark: "D",
    intro: "논리적인 사고와 분석을 통해 차근차근 답을 찾아가는 학습자입니다.",
    description:
      "데카르트형은 조건을 정리하고 근거를 세워 문제를 해결하는 데 강점이 있습니다. 불안이 생길 때도 풀이 절차를 작게 나누면 안정감을 회복하고 실수를 줄일 수 있습니다.",
    strategies: [
      "문제를 읽고 조건, 구하는 것, 사용할 개념을 먼저 표시하세요.",
      "풀이가 막히면 전체 문제를 작은 단계로 나누어 해결하세요.",
      "오답을 고칠 때는 ‘어느 단계에서 흔들렸는지’를 기록하세요.",
    ],
  },
  "칸트형": {
    person: "Immanuel Kant (1724 ~ 1804)",
    mark: "K",
    intro: "스스로의 기준과 직관을 바탕으로 학습 방향을 잡는 학습자입니다.",
    description:
      "칸트형은 자신만의 방식으로 이해하려는 힘이 있고, 납득이 되면 꾸준히 밀고 나갈 수 있습니다. 다만 불안이 커지면 시작이 늦어질 수 있어 작은 실행 단위가 필요합니다.",
    strategies: [
      "처음부터 완벽히 이해하려 하기보다 10분 단위로 시작하세요.",
      "개념을 자기 말로 바꾸어 적고 예시 문제를 바로 풀어보세요.",
      "학습 후 오늘 이해한 것과 아직 헷갈리는 것을 분리해 적으세요.",
    ],
  },
};

const PALETTE = {
  "파스칼형": "#2f6f73",
  "아인슈타인형": "#7a5c9e",
  "러셀형": "#5f6f86",
  "가우스형": "#2f6fa3",
  "뉴턴형": "#6e7b3c",
  "피타고라스형": "#a56b3a",
  "데카르트형": "#315f9c",
  "칸트형": "#7b5d73",
};

const RESULT_PAGE_SLUGS = {
  "파스칼형": "pascal",
  "아인슈타인형": "einstein",
  "러셀형": "russell",
  "가우스형": "gauss",
  "뉴턴형": "newton",
  "피타고라스형": "pythagoras",
  "데카르트형": "descartes",
  "칸트형": "kant",
};

const FOOTER_LABEL = "수학의힘∫외대HS어학원 학습유형검사";
const RADAR_AXES = [
  { label: "논리적 접근형", shortLabel: "논리" },
  { label: "내적동기형", shortLabel: "내적" },
  { label: "긍정형", shortLabel: "긍정" },
  { label: "직관적 접근형", shortLabel: "직관" },
  { label: "외적동기형", shortLabel: "외적" },
  { label: "부정형", shortLabel: "부정" },
];

const PAIR_ROWS = [
  { left: "긍정형", right: "부정형", label: "" },
  { left: "내적동기형", right: "외적동기형", label: "" },
  { left: "논리적 접근형", right: "직관적 접근형", label: "" },
];

function $(selector) {
  return document.querySelector(selector);
}

function loadResult() {
  const attemptId = attemptIdFromUrl();
  if (!attemptId) {
    window.location.replace("./index.html?new=1");
    return null;
  }

  const raw = sessionStorage.getItem(resultStorageKey(attemptId));
  if (!raw) {
    window.location.replace("./index.html?new=1");
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    sessionStorage.removeItem(resultStorageKey(attemptId));
    window.location.replace("./index.html?new=1");
    return null;
  }
}

function studentName(info) {
  return (info?.name || "").trim() || "학생";
}

function buildDiagnosisSummary(result) {
  const winners = result?.pairs?.map((pair) => pair.winner).filter(Boolean) || [];
  if (winners.length !== 3) return result?.type?.name || "학습유형";

  const [mindset, motivation, approach] = winners;
  return `${result.type?.name || "학습유형"} : ${motivation} + ${mindset} + ${approach}`;
}

function buildPageTitle(name, pageNumber) {
  if (pageNumber === 1) {
    return `${name}님 학습유형검사 결과`;
  }

  if (pageNumber >= 2 && pageNumber <= 5) {
    return `${name}님 학습스타일 세부진단 (${pageNumber - 1})`;
  }

  return `${name}님에게 추천하는 학습 전략 (${pageNumber - 5})`;
}

function buildPageSummary(name, type) {
  return `${name} 학생의 학습 스타일은 ${type}으로 분류됩니다`;
}

function buildScoreLookup(result) {
  return Object.fromEntries((result?.scores || []).map((item) => [item.label, Number(item.score || 0)]));
}

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function buildRadarSvg(result, maxScore) {
  const lookup = buildScoreLookup(result);
  const center = 120;
  const radius = 78;
  const levels = 5;
  const angleStep = 360 / RADAR_AXES.length;

  const gridPolygons = Array.from({ length: levels }, (_, index) => {
    const levelRadius = (radius * (index + 1)) / levels;
    const points = RADAR_AXES.map((_, axisIndex) => {
      const point = polarToCartesian(center, center, levelRadius, axisIndex * angleStep);
      return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
    }).join(" ");
    return `<polygon points="${points}" class="radar-grid-level"></polygon>`;
  }).join("");

  const axisLines = RADAR_AXES.map((_, axisIndex) => {
    const point = polarToCartesian(center, center, radius, axisIndex * angleStep);
    return `<line x1="${center}" y1="${center}" x2="${point.x.toFixed(2)}" y2="${point.y.toFixed(2)}" class="radar-axis-line"></line>`;
  }).join("");

  const dataPoints = RADAR_AXES.map((axis, axisIndex) => {
    const score = lookup[axis.label] || 0;
    const point = polarToCartesian(center, center, radius * (score / maxScore), axisIndex * angleStep);
    return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
  }).join(" ");

  const labels = RADAR_AXES.map((axis, axisIndex) => {
    const labelPoint = polarToCartesian(center, center, radius + 26, axisIndex * angleStep);
    const score = lookup[axis.label] || 0;
    return `
      <text x="${labelPoint.x.toFixed(2)}" y="${labelPoint.y.toFixed(2)}" class="radar-label">${axis.shortLabel}</text>
      <text x="${labelPoint.x.toFixed(2)}" y="${(labelPoint.y + 14).toFixed(2)}" class="radar-score">${score}</text>
    `;
  }).join("");

  return `
    <svg class="result-radar" viewBox="0 0 240 240" aria-label="학습유형 레이더 차트" role="img">
      <circle cx="${center}" cy="${center}" r="${radius}" class="radar-outer-ring"></circle>
      ${gridPolygons}
      ${axisLines}
      <polygon points="${dataPoints}" class="radar-shape"></polygon>
      ${labels}
    </svg>
  `;
}

function buildComparisonRows(result, maxScore) {
  const lookup = buildScoreLookup(result);
  return PAIR_ROWS.map((row) => {
    const leftScore = lookup[row.left] || 0;
    const rightScore = lookup[row.right] || 0;
    const leftPercent = (leftScore / maxScore) * 100;
    const rightPercent = (rightScore / maxScore) * 100;
    return `
      <div class="result-bar-row">
        <div class="result-bar-meta">
          <span class="result-bar-pair">${row.label}</span>
          <span class="result-bar-values">${leftScore} : ${rightScore}</span>
        </div>
        <div class="result-bar-track" aria-hidden="true">
          <div class="result-bar-fill is-left" style="width:${leftPercent}%"></div>
          <div class="result-bar-fill is-right" style="width:${rightPercent}%"></div>
        </div>
        <div class="result-bar-labels">
          <span>${row.left}</span>
          <span>${row.right}</span>
        </div>
      </div>
    `;
  }).join("");
}

function buildGraphOverlay(result, maxScore) {
  if (!result?.scores?.length || !maxScore) return "";

  return `
    <div class="pdf-graph-overlay">
      <div class="pdf-graph-panel">
        <div class="pdf-graph-radar-wrap">
          ${buildRadarSvg(result, maxScore)}
        </div>
        <div class="pdf-graph-bars">
          ${buildComparisonRows(result, maxScore)}
        </div>
      </div>
    </div>
  `;
}

function render() {
  const payload = loadResult();
  if (!payload) return;

  const { result, info, maxScore } = payload;
  const name = studentName(info);
  const type = result.type?.name || "미분류";
  const diagnosisSummary = buildDiagnosisSummary(result);

  document.title = `${name}님 학습유형검사 결과`;
  $("#personalTitle").textContent = `${name}님 학습유형검사 결과`;
  $("#studentLine").textContent = diagnosisSummary;
  $("#metaLine").textContent = "";
  $("#detailTitle").textContent = `${name}님 학습스타일 세부진단`;
  renderPdfPageImages(type, name, result, maxScore);
  retryPendingSheetsSave(payload.attemptId);
}

function renderPdfPageImages(type, name, result, maxScore) {
  const slug = RESULT_PAGE_SLUGS[type];
  if (!slug) return;

  $("#pdfPageImages").innerHTML = Array.from({ length: 8 }, (_, index) => {
    const pageNumber = index + 1;
    const page = String(pageNumber).padStart(2, "0");
    const src = `./assets/result-pages/${slug}/${slug}-${page}.png`;
    const titleClass = pageNumber === 1 ? "pdf-page-title-overlay is-cover" : "pdf-page-title-overlay is-detail";
    const pageOverlay = `
        <div class="pdf-cover-overlay">
          <div class="${titleClass}">${escapeHtml(buildPageTitle(name, pageNumber))}</div>
          ${pageNumber === 1 ? `<div class="pdf-summary-overlay">${escapeHtml(buildPageSummary(name, type))}</div>` : ""}
          ${pageNumber === 1 ? buildGraphOverlay(result, maxScore) : ""}
          <div class="pdf-footer-overlay">
            <span class="pdf-footer-label">${escapeHtml(FOOTER_LABEL)}</span>
          </div>
        </div>
      `;
    return `
      <figure class="pdf-page-card${index === 0 ? " pdf-page-card--cover" : ""}">
        <img src="${src}" alt="${type} 상세 해설 ${index + 1}페이지" loading="lazy">
        ${pageOverlay}
      </figure>
    `;
  })
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

$("#printResultBtn").addEventListener("click", () => window.print());
$("#restartLink").addEventListener("click", (event) => {
  event.preventDefault();
  const attemptId = attemptIdFromUrl();
  if (attemptId) {
    sessionStorage.removeItem(resultStorageKey(attemptId));
    sessionStorage.removeItem(surveyStorageKey(attemptId));
    clearPendingSheetsPayload(attemptId);
  }
  window.location.href = "./index.html?new=1";
});
render();

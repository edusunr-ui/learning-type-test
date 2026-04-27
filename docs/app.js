const LEVELS = {
  elementary: {
    label: "초등부",
    form: "./assets/forms/elementary.pdf",
    questionCount: 42,
    perCategory: 7,
    maxScore: 35,
  },
  middle: {
    label: "중등부",
    form: "./assets/forms/middle.pdf",
    questionCount: 60,
    perCategory: 10,
    maxScore: 50,
  },
  high: {
    label: "고등부",
    form: "./assets/forms/high.pdf",
    questionCount: 60,
    perCategory: 10,
    maxScore: 50,
  },
};

const CATEGORIES = [
  { key: "positive", label: "긍정형", code: "A" },
  { key: "negative", label: "부정형", code: "B" },
  { key: "internal", label: "내적동기형", code: "C" },
  { key: "external", label: "외적동기형", code: "D" },
  { key: "logical", label: "논리적 접근형", code: "E" },
  { key: "intuitive", label: "직관적 접근형", code: "F" },
];

const RESULT_TYPES = {
  ACE: { name: "파스칼형", pdf: "./assets/results/pascal.pdf" },
  ACF: { name: "아인슈타인형", pdf: "./assets/results/einstein.pdf" },
  BCE: { name: "러셀형", pdf: "./assets/results/russell.pdf" },
  BCF: { name: "가우스형", pdf: "./assets/results/gauss.pdf" },
  ADE: { name: "뉴턴형", pdf: "./assets/results/newton.pdf" },
  ADF: { name: "피타고라스형", pdf: "./assets/results/pythagoras.pdf" },
  BDE: { name: "데카르트형", pdf: "./assets/results/descartes.pdf" },
  BDF: { name: "칸트형", pdf: "./assets/results/kant.pdf" },
};

const STORAGE_NAMESPACE = "learning-type-survey-v2";
const RESULT_STORAGE_NAMESPACE = "learning-type-result-v2";
const PENDING_SHEETS_STORAGE_NAMESPACE = "learning-type-pending-sheets-v1";
const SHEETS_CONFIG = window.LEARNING_TYPE_CONFIG?.googleSheets || {};

const state = {
  attemptId: "",
  stage: "home",
  level: "elementary",
  answers: {},
  currentQuestion: 1,
  info: {
    school: "",
    grade: "",
    name: "",
  },
};

const els = {
  homeView: document.querySelector("#homeView"),
  purposeView: document.querySelector("#purposeView"),
  surveyView: document.querySelector("#surveyView"),
  school: document.querySelector("#schoolInput"),
  grade: document.querySelector("#gradeInput"),
  name: document.querySelector("#nameInput"),
  tabs: Array.from(document.querySelectorAll(".level-tab")),
  answerGrid: document.querySelector("#answerGrid"),
  questionNav: document.querySelector("#questionNav"),
  progressText: document.querySelector("#progressText"),
  progressBar: document.querySelector("#progressBar"),
  prevQuestion: document.querySelector("#prevQuestionBtn"),
  nextQuestion: document.querySelector("#nextQuestionBtn"),
  firstMissing: document.querySelector("#firstMissingBtn"),
  showResult: document.querySelector("#showResultBtn"),
  startPurpose: document.querySelector("#startPurposeBtn"),
  startSurvey: document.querySelector("#startSurveyBtn"),
  backHome: document.querySelector("#backHomeBtn"),
  reset: document.querySelector("#resetBtn"),
};

function currentLevel() {
  return LEVELS[state.level];
}

function answerKey(level = state.level) {
  return `${level}Answers`;
}

function createAttemptId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `attempt-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function ensureAttemptId(forceNew = false) {
  const url = new URL(window.location.href);
  const existing = forceNew ? "" : url.searchParams.get("attempt");
  const attemptId = existing || createAttemptId();

  url.searchParams.set("attempt", attemptId);
  url.searchParams.delete("new");
  window.history.replaceState({}, "", url);

  state.attemptId = attemptId;
  return attemptId;
}

function stateStorageKey() {
  return `${STORAGE_NAMESPACE}:${state.attemptId}`;
}

function resultStorageKey(attemptId = state.attemptId) {
  return `${RESULT_STORAGE_NAMESPACE}:${attemptId}`;
}

function pendingSheetsStorageKey(attemptId = state.attemptId) {
  return `${PENDING_SHEETS_STORAGE_NAMESPACE}:${attemptId}`;
}

function persistResultPayload(payload) {
  const serialized = JSON.stringify(payload);
  sessionStorage.setItem(resultStorageKey(payload.attemptId), serialized);
  localStorage.setItem(resultStorageKey(payload.attemptId), serialized);
}

function clearStoredResultPayload(attemptId = state.attemptId) {
  if (!attemptId) return;
  sessionStorage.removeItem(resultStorageKey(attemptId));
  localStorage.removeItem(resultStorageKey(attemptId));
}

function sheetsEndpoint() {
  const endpoint = String(SHEETS_CONFIG.endpoint || "").trim();
  return endpoint || "";
}

function buildSheetsPayload(result, createdAt) {
  const scoreMap = Object.fromEntries(result.scores.map((item) => [item.key, Number(item.score || 0)]));

  return {
    attemptId: state.attemptId,
    createdAt,
    submittedAt: new Date().toISOString(),
    school: state.info.school,
    grade: state.info.grade,
    name: state.info.name,
    level: state.level,
    levelLabel: currentLevel().label,
    resultCode: result.code,
    resultType: result.type?.name || "미분류",
    positiveScore: scoreMap.positive || 0,
    negativeScore: scoreMap.negative || 0,
    internalScore: scoreMap.internal || 0,
    externalScore: scoreMap.external || 0,
    logicalScore: scoreMap.logical || 0,
    intuitiveScore: scoreMap.intuitive || 0,
    positiveVsNegative: result.pairs?.[0]?.winner || "",
    internalVsExternal: result.pairs?.[1]?.winner || "",
    logicalVsIntuitive: result.pairs?.[2]?.winner || "",
    siteUrl: window.location.origin + window.location.pathname,
  };
}

function createSheetsRequestBody(payload) {
  return new URLSearchParams(
    Object.entries(payload).map(([key, value]) => [key, value == null ? "" : String(value)])
  );
}

function markSheetsPayloadPending(payload) {
  try {
    sessionStorage.setItem(pendingSheetsStorageKey(payload.attemptId), JSON.stringify(payload));
  } catch (error) {
    console.warn("Pending Google Sheets payload could not be cached.", error);
  }
}

function clearPendingSheetsPayload(attemptId = state.attemptId) {
  if (!attemptId) return;
  sessionStorage.removeItem(pendingSheetsStorageKey(attemptId));
}

async function saveResultToGoogleSheets(payload) {
  const endpoint = sheetsEndpoint();
  if (!endpoint) return false;

  try {
    const body = createSheetsRequestBody(payload);

    if (navigator.sendBeacon) {
      const beaconQueued = navigator.sendBeacon(endpoint, body);
      if (beaconQueued) {
        return true;
      }
    }

    await fetch(endpoint, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: body.toString(),
      keepalive: true,
    });
    return true;
  } catch (error) {
    console.error("Google Sheets save failed.", error);
    return false;
  }
}

function loadState() {
  ensureAttemptId(new URL(window.location.href).searchParams.get("new") === "1");
  const raw = sessionStorage.getItem(stateStorageKey());
  if (!raw) return;

  try {
    const saved = JSON.parse(raw);
    if (["home", "purpose", "survey"].includes(saved.stage)) state.stage = saved.stage;
    if (saved.level && LEVELS[saved.level]) state.level = saved.level;
    state.answers = saved.answers || {};
    state.currentQuestion = Number(saved.currentQuestion || 1);
    state.info = { ...state.info, ...(saved.info || {}) };
    state.stage = "home";
  } catch {
    sessionStorage.removeItem(stateStorageKey());
  }
}

function saveState() {
  ensureAttemptId();
  sessionStorage.setItem(
    stateStorageKey(),
    JSON.stringify({
      attemptId: state.attemptId,
      level: state.level,
      stage: state.stage,
      answers: state.answers,
      currentQuestion: state.currentQuestion,
      info: state.info,
    })
  );
}

function getAnswersForLevel(level = state.level) {
  if (!state.answers[answerKey(level)]) {
    state.answers[answerKey(level)] = {};
  }
  return state.answers[answerKey(level)];
}

function setLevel(level) {
  state.level = level;
  state.currentQuestion = 1;
  render();
  saveState();
}

function setStage(stage) {
  state.stage = stage;
  render();
  saveState();
}

function categoryForQuestion(questionNumber) {
  const index = Math.floor((questionNumber - 1) / currentLevel().perCategory);
  return CATEGORIES[index];
}

function render() {
  const level = currentLevel();
  const answers = getAnswersForLevel();
  const hasStageViews = els.homeView && els.purposeView && els.surveyView;

  if (hasStageViews) {
    els.homeView.hidden = state.stage !== "home";
    els.purposeView.hidden = state.stage !== "purpose";
    els.surveyView.hidden = state.stage !== "survey";
  }

  if (els.reset) {
    els.reset.hidden = hasStageViews && state.stage !== "survey";
  }

  els.tabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.level === state.level);
  });

  els.school.value = state.info.school;
  els.grade.value = ["1", "2", "3"].includes(state.info.grade) ? state.info.grade : "";
  els.name.value = state.info.name;

  state.currentQuestion = Math.min(Math.max(1, state.currentQuestion), level.questionCount);
  els.answerGrid.innerHTML = "";
  els.answerGrid.appendChild(createQuestionCard(state.currentQuestion, answers[state.currentQuestion]));
  renderQuestionNav();

  renderProgress();
}

function validateInfo() {
  if (state.info.grade && !["1", "2", "3"].includes(state.info.grade)) {
    state.info.grade = "";
    els.grade.value = "";
  }

  const missing = [
    ["학교명", state.info.school, els.school],
    ["학년", state.info.grade, els.grade],
    ["이름", state.info.name, els.name],
  ].find(([, value]) => !value.trim());

  if (!missing) return true;

  alert(`${missing[0]}을 입력해 주세요.`);
  missing[2]?.focus();
  return false;
}

function createQuestionCard(questionNumber, value) {
  const question = getQuestions()[questionNumber - 1];
  const card = document.createElement("section");
  card.className = "question-card question-card--single";
  card.id = `q-${questionNumber}`;
  card.dataset.question = questionNumber;

  const title = document.createElement("div");
  title.className = "question-title";
  title.innerHTML = `<strong>${questionNumber}번 문항</strong>`;

  const text = document.createElement("p");
  text.className = "question-text";
  text.textContent = question?.text || `${questionNumber}번 문항`;

  const choices = document.createElement("div");
  choices.className = "choices";

  for (let score = 1; score <= 5; score += 1) {
    const button = document.createElement("button");
    button.className = "choice";
    button.type = "button";
    button.innerHTML = `<strong>${score}</strong><span>${choiceLabel(score)}</span>`;
    button.title = `${questionNumber}번 ${score}점`;
    button.setAttribute("aria-label", `${questionNumber}번 ${score}점`);
    button.classList.toggle("is-selected", Number(value) === score);
    button.addEventListener("click", () => setAnswer(questionNumber, score));
    choices.appendChild(button);
  }

  card.append(title, text, choices);
  return card;
}

function getQuestions() {
  return window.SURVEY_QUESTIONS?.[state.level] || [];
}

function choiceLabel(score) {
  return {
    1: "매우\n그렇지 않다",
    2: "그렇지 않다",
    3: "보통이다",
    4: "그렇다",
    5: "매우 그렇다",
  }[score];
}

function setAnswer(questionNumber, score) {
  getAnswersForLevel()[questionNumber] = score;
  saveState();
  if (questionNumber < currentLevel().questionCount) {
    state.currentQuestion = questionNumber + 1;
  }
  render();
}

function renderProgress() {
  const level = currentLevel();
  const count = Object.keys(getAnswersForLevel()).length;
  const percent = Math.round((count / level.questionCount) * 100);

  els.progressText.textContent = `${count} / ${level.questionCount}`;
  els.progressBar.style.width = `${percent}%`;
  els.showResult.disabled = count !== level.questionCount;
}

function firstMissingQuestion() {
  const answers = getAnswersForLevel();
  for (let i = 1; i <= currentLevel().questionCount; i += 1) {
    if (!answers[i]) return i;
  }
  return null;
}

function markAndScrollToMissing() {
  document.querySelectorAll(".question-card").forEach((card) => card.classList.remove("is-missing"));
  const missing = firstMissingQuestion();
  if (!missing) return;

  state.currentQuestion = missing;
  render();
  document.querySelector(`#q-${missing}`)?.classList.add("is-missing");
}

function moveQuestion(delta) {
  state.currentQuestion = Math.min(
    Math.max(1, state.currentQuestion + delta),
    currentLevel().questionCount
  );
  saveState();
  render();
}

function renderQuestionNav() {
  const answers = getAnswersForLevel();
  els.prevQuestion.disabled = state.currentQuestion === 1;
  els.nextQuestion.disabled = state.currentQuestion === currentLevel().questionCount;

  els.questionNav.innerHTML = "";
  for (let i = 1; i <= currentLevel().questionCount; i += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = i;
    button.className = "nav-dot";
    button.classList.toggle("is-current", i === state.currentQuestion);
    button.classList.toggle("is-answered", Boolean(answers[i]));
    button.title = `${i}번 문항`;
    button.addEventListener("click", () => {
      state.currentQuestion = i;
      saveState();
      render();
    });
    els.questionNav.appendChild(button);
  }
}

function calculateResult() {
  const level = currentLevel();
  const answers = getAnswersForLevel();
  const scores = CATEGORIES.map((category, categoryIndex) => {
    const start = categoryIndex * level.perCategory + 1;
    let total = 0;
    for (let q = start; q < start + level.perCategory; q += 1) {
      total += Number(answers[q] || 0);
    }
    return { ...category, score: total };
  });

  const first = scores[0].score >= scores[1].score ? "A" : "B";
  const second = scores[2].score >= scores[3].score ? "C" : "D";
  const third = scores[4].score >= scores[5].score ? "E" : "F";
  const code = `${first}${second}${third}`;

  return {
    code,
    type: RESULT_TYPES[code] || { name: "미분류", pdf: "" },
    scores,
    pairs: [
      { label: "긍정형 vs 부정형", winner: first === "A" ? "긍정형" : "부정형" },
      { label: "내적동기형 vs 외적동기형", winner: second === "C" ? "내적동기형" : "외적동기형" },
      { label: "논리적 접근형 vs 직관적 접근형", winner: third === "E" ? "논리적 접근형" : "직관적 접근형" },
    ],
  };
}

async function showResult() {
  if (firstMissingQuestion()) {
    markAndScrollToMissing();
    return;
  }

  const result = calculateResult();
  const createdAt = new Date().toISOString();
  const resultPayload = {
    attemptId: state.attemptId,
    result,
    info: state.info,
    level: state.level,
    levelLabel: currentLevel().label,
    maxScore: currentLevel().maxScore,
    createdAt,
  };

  persistResultPayload(resultPayload);

  const sheetsPayload = buildSheetsPayload(result, createdAt);
  markSheetsPayloadPending(sheetsPayload);

  const savedToSheets = await Promise.race([
    saveResultToGoogleSheets(sheetsPayload),
    new Promise((resolve) => window.setTimeout(resolve, 1500)),
  ]);

  if (savedToSheets) {
    clearPendingSheetsPayload();
  }

  window.location.href = `./result.html?attempt=${encodeURIComponent(state.attemptId)}`;
}

function resetAnswers() {
  if (!confirm("현재 검사 응답을 초기화할까요?")) return;
  state.answers[answerKey()] = {};
  clearStoredResultPayload();
  clearPendingSheetsPayload();
  saveState();
  render();
}

function bindEvents() {
  els.tabs.forEach((tab) => tab.addEventListener("click", () => setLevel(tab.dataset.level)));
  els.prevQuestion.addEventListener("click", () => moveQuestion(-1));
  els.nextQuestion.addEventListener("click", () => moveQuestion(1));
  els.firstMissing.addEventListener("click", markAndScrollToMissing);
  els.showResult.addEventListener("click", showResult);
  els.reset.addEventListener("click", resetAnswers);
  els.startPurpose?.addEventListener("click", () => {
    if (validateInfo()) setStage("purpose");
  });
  els.startSurvey?.addEventListener("click", () => setStage("survey"));
  els.backHome?.addEventListener("click", () => setStage("home"));

  [
    ["school", els.school],
    ["grade", els.grade],
    ["name", els.name],
  ].forEach(([key, input]) => {
    const syncValue = () => {
      const value = input.value.trim();
      state.info[key] = key === "grade"
        ? (["1", "2", "3"].includes(value) ? value : "")
        : value;
      saveState();
    };

    input.addEventListener("input", syncValue);
    input.addEventListener("change", syncValue);
  });
}

loadState();
bindEvents();
render();


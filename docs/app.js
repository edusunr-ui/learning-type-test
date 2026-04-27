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

const STORAGE_NAMESPACE = "learning-type-survey-v2";
const PENDING_SHEETS_STORAGE_NAMESPACE = "learning-type-pending-sheets-v2";
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
  completion: {
    name: "",
    school: "",
    grade: "",
    levelLabel: "",
    submittedAt: "",
  },
};

const els = {
  homeView: document.querySelector("#homeView"),
  purposeView: document.querySelector("#purposeView"),
  surveyView: document.querySelector("#surveyView"),
  completeView: document.querySelector("#completeView"),
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
  startNew: document.querySelector("#startNewBtn"),
  completionName: document.querySelector("#completionName"),
  completionMeta: document.querySelector("#completionMeta"),
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

function pendingSheetsStorageKey(attemptId = state.attemptId) {
  return `${PENDING_SHEETS_STORAGE_NAMESPACE}:${attemptId}`;
}

function sheetsEndpoint() {
  const endpoint = String(SHEETS_CONFIG.endpoint || "").trim();
  return endpoint || "";
}

function buildSheetsPayload(createdAt) {
  const answers = getAnswersForLevel();
  const answerList = Array.from(
    { length: currentLevel().questionCount },
    (_, index) => Number(answers[index + 1] || 0)
  );
  return {
    attemptId: state.attemptId,
    createdAt,
    submittedAt: new Date().toISOString(),
    school: state.info.school,
    grade: state.info.grade,
    name: state.info.name,
    level: state.level,
    levelLabel: currentLevel().label,
    questionCount: String(currentLevel().questionCount),
    perCategory: String(currentLevel().perCategory),
    answersJson: JSON.stringify(answerList),
    siteUrl: window.location.origin + window.location.pathname,
  };
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

function submitSheetsPayload(payload) {
  const endpoint = sheetsEndpoint();
  if (!endpoint) return false;

  try {
    const iframeName = "google-sheets-sync-target";
    let iframe = document.querySelector(`iframe[name="${iframeName}"]`);
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.name = iframeName;
      iframe.hidden = true;
      iframe.tabIndex = -1;
      document.body.appendChild(iframe);
    }

    const form = document.createElement("form");
    form.method = "POST";
    form.action = endpoint;
    form.target = iframeName;
    form.hidden = true;

    Object.entries(payload).forEach(([key, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = value == null ? "" : String(value);
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
    window.setTimeout(() => form.remove(), 1000);
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
    if (["home", "purpose", "survey", "complete"].includes(saved.stage)) state.stage = saved.stage;
    if (saved.level && LEVELS[saved.level]) state.level = saved.level;
    state.answers = saved.answers || {};
    state.currentQuestion = Number(saved.currentQuestion || 1);
    state.info = { ...state.info, ...(saved.info || {}) };
    state.completion = { ...state.completion, ...(saved.completion || {}) };
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
      completion: state.completion,
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
  const hasStageViews = els.homeView && els.purposeView && els.surveyView && els.completeView;

  if (hasStageViews) {
    els.homeView.hidden = state.stage !== "home";
    els.purposeView.hidden = state.stage !== "purpose";
    els.surveyView.hidden = state.stage !== "survey";
    els.completeView.hidden = state.stage !== "complete";
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
  if (els.completionName) {
    const fallbackName = state.completion.name || "학생";
    els.completionName.textContent = `${fallbackName} 학생의 검사가 제출되었습니다.`;
  }
  if (els.completionMeta) {
    const parts = [
      state.completion.school,
      state.completion.grade ? `${state.completion.grade}학년` : "",
      state.completion.levelLabel,
    ].filter(Boolean);
    els.completionMeta.textContent = parts.length
      ? `제출 정보: ${parts.join(" · ")}`
      : "제출 내용을 학원에서 확인하고 결과를 안내드립니다.";
  }

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

function resetAttemptState() {
  state.answers = {};
  state.currentQuestion = 1;
  state.info = {
    school: "",
    grade: "",
    name: "",
  };
}

function startNewSurvey() {
  clearPendingSheetsPayload();
  resetAttemptState();
  state.completion = {
    name: "",
    school: "",
    grade: "",
    levelLabel: "",
    submittedAt: "",
  };
  sessionStorage.removeItem(stateStorageKey());
  ensureAttemptId(true);
  setStage("home");
}

function submitSurvey() {
  if (firstMissingQuestion()) {
    markAndScrollToMissing();
    return;
  }

  const createdAt = new Date().toISOString();
  const sheetsPayload = buildSheetsPayload(createdAt);
  markSheetsPayloadPending(sheetsPayload);

  const savedToSheets = submitSheetsPayload(sheetsPayload);

  if (!savedToSheets) {
    alert("제출 연결을 확인해 주세요. 잠시 후 다시 제출해 주세요.");
    return;
  }
  clearPendingSheetsPayload();

  state.completion = {
    name: state.info.name,
    school: state.info.school,
    grade: state.info.grade,
    levelLabel: currentLevel().label,
    submittedAt: createdAt,
  };
  resetAttemptState();
  setStage("complete");
}

function resetAnswers() {
  if (!confirm("현재 검사 응답을 초기화할까요?")) return;
  state.answers[answerKey()] = {};
  clearPendingSheetsPayload();
  saveState();
  render();
}

function bindEvents() {
  els.tabs.forEach((tab) => tab.addEventListener("click", () => setLevel(tab.dataset.level)));
  els.prevQuestion.addEventListener("click", () => moveQuestion(-1));
  els.nextQuestion.addEventListener("click", () => moveQuestion(1));
  els.firstMissing.addEventListener("click", markAndScrollToMissing);
  els.showResult.addEventListener("click", submitSurvey);
  els.reset.addEventListener("click", resetAnswers);
  els.startPurpose?.addEventListener("click", () => {
    if (validateInfo()) setStage("purpose");
  });
  els.startSurvey?.addEventListener("click", () => setStage("survey"));
  els.backHome?.addEventListener("click", () => setStage("home"));
  els.startNew?.addEventListener("click", startNewSurvey);

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


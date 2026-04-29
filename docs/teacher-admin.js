const ADMIN_SESSION_STORAGE_KEY = "learning-type-admin-session-v1";
const RESULT_STORAGE_NAMESPACE = "learning-type-result-v2";
const LAST_RESULT_STORAGE_KEY = "learning-type-last-result-v1";
const SHEETS_CONFIG = window.LEARNING_TYPE_CONFIG?.googleSheets || {};

const adminState = {
  token: "",
  results: [],
};

const adminEls = {
  loginView: document.querySelector("#adminLoginView"),
  portalView: document.querySelector("#adminPortalView"),
  loginForm: document.querySelector("#adminLoginForm"),
  passwordInput: document.querySelector("#adminPasswordInput"),
  loginMessage: document.querySelector("#adminLoginMessage"),
  searchInput: document.querySelector("#adminSearchInput"),
  refreshBtn: document.querySelector("#adminRefreshBtn"),
  logoutBtn: document.querySelector("#adminLogoutBtn"),
  resultCount: document.querySelector("#adminResultCount"),
  empty: document.querySelector("#adminResultsEmpty"),
  list: document.querySelector("#adminResultsList"),
};

function adminEndpoint() {
  return String(SHEETS_CONFIG.endpoint || "").trim();
}

function resultStorageKey(attemptId) {
  return `${RESULT_STORAGE_NAMESPACE}:${attemptId}`;
}

function loadStoredSession() {
  try {
    const raw = sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
    if (!raw) return "";
    const saved = JSON.parse(raw);
    return String(saved.token || "");
  } catch {
    sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    return "";
  }
}

function saveSession(token) {
  adminState.token = token;
  sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify({ token }));
}

function clearSession() {
  adminState.token = "";
  sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
}

function postAdminAction(action, payload = {}) {
  const endpoint = adminEndpoint();
  if (!endpoint) {
    return Promise.reject(new Error("Apps Script endpoint is not configured."));
  }

  return new Promise((resolve, reject) => {
    const callbackName = `__learningTypeAdminCallback_${Date.now()}_${Math.random()
      .toString(16)
      .slice(2)}`;
    const script = document.createElement("script");
    const url = new URL(endpoint);

    const cleanup = () => {
      delete window[callbackName];
      script.remove();
    };

    window[callbackName] = (data) => {
      cleanup();
      if (!data?.ok) {
        reject(new Error(data?.message || "관리자 요청에 실패했습니다."));
        return;
      }
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("관리자 연결에 실패했습니다."));
    };

    Object.entries({ action, ...payload, callback: callbackName }).forEach(([key, value]) => {
      url.searchParams.set(key, value == null ? "" : String(value));
    });

    script.src = url.toString();
    document.body.appendChild(script);
  });
}

function setLoginMessage(message) {
  adminEls.loginMessage.hidden = !message;
  adminEls.loginMessage.textContent = message || "";
}

function setPortalVisible(visible) {
  adminEls.loginView.hidden = visible;
  adminEls.portalView.hidden = !visible;
}

function filteredResults() {
  const keyword = String(adminEls.searchInput.value || "").trim().toLowerCase();
  if (!keyword) return adminState.results;

  return adminState.results.filter((item) =>
    [item.name, item.school, item.resultType, item.grade, item.levelLabel]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword))
  );
}

function formatSubmittedAt(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderResults() {
  const items = filteredResults();
  adminEls.resultCount.textContent = `총 ${items.length}건의 결과가 표시되고 있습니다.`;
  adminEls.empty.hidden = items.length !== 0;

  adminEls.list.innerHTML = items
    .map(
      (item) => `
        <article class="admin-result-card">
          <div class="admin-result-head">
            <div>
              <p class="admin-result-name">${escapeHtml(item.name || "학생")}</p>
              <p class="admin-result-meta">${escapeHtml(item.school || "-")} · ${escapeHtml(item.grade || "-")}학년 · ${escapeHtml(item.levelLabel || "-")}</p>
            </div>
            <span class="admin-result-type">${escapeHtml(item.resultType || "미분류")} (${escapeHtml(item.resultCode || "-")})</span>
          </div>
          <dl class="admin-result-info">
            <div><dt>제출 시각</dt><dd>${escapeHtml(formatSubmittedAt(item.submittedAt))}</dd></div>
            <div><dt>시도 ID</dt><dd>${escapeHtml(item.attemptId || "-")}</dd></div>
          </dl>
          <div class="admin-result-actions">
            <button type="button" data-attempt-id="${escapeHtml(item.attemptId)}" class="primary-button admin-open-result">결과 보기</button>
            ${
              item.resultPdfUrl
                ? `<a class="secondary-link" href="${escapeHtml(item.resultPdfUrl)}" target="_blank" rel="noopener">저장된 PDF</a>`
                : ""
            }
          </div>
        </article>
      `
    )
    .join("");

  adminEls.list.querySelectorAll(".admin-open-result").forEach((button) => {
    button.addEventListener("click", () => openTeacherResult(button.dataset.attemptId || ""));
  });
}

async function loadResults() {
  adminEls.resultCount.textContent = "결과를 불러오는 중입니다.";
  const data = await postAdminAction("listResults", { token: adminState.token });
  adminState.results = Array.isArray(data.items) ? data.items : [];
  renderResults();
}

function persistTeacherPayload(payload) {
  const attemptId = String(payload.attemptId || `teacher-view-${Date.now()}`);
  payload.attemptId = attemptId;
  const serialized = JSON.stringify(payload);
  sessionStorage.setItem(resultStorageKey(attemptId), serialized);
  localStorage.setItem(resultStorageKey(attemptId), serialized);
  localStorage.setItem(LAST_RESULT_STORAGE_KEY, serialized);
  return attemptId;
}

async function openTeacherResult(attemptId) {
  if (!attemptId) return;
  const detailWindow = window.open("about:blank", "_blank");

  try {
    const data = await postAdminAction("getResult", {
      token: adminState.token,
      attemptId,
    });
    const savedAttemptId = persistTeacherPayload(data.payload || {});
    const targetUrl = `./teacher-result.html?attempt=${encodeURIComponent(savedAttemptId)}`;
    if (detailWindow) {
      detailWindow.location.replace(targetUrl);
    } else {
      window.location.href = targetUrl;
    }
  } catch (error) {
    detailWindow?.close();
    if (/세션|로그인|권한/.test(String(error.message || ""))) {
      clearSession();
      setPortalVisible(false);
      setLoginMessage("세션이 만료되었습니다. 다시 로그인해 주세요.");
      return;
    }
    alert(error.message || "결과를 열지 못했습니다.");
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const password = String(adminEls.passwordInput.value || "").trim();
  if (!password) {
    setLoginMessage("비밀번호를 입력해 주세요.");
    adminEls.passwordInput.focus();
    return;
  }

  try {
    setLoginMessage("");
    const data = await postAdminAction("login", { password });
    saveSession(String(data.token || ""));
    adminEls.passwordInput.value = "";
    setPortalVisible(true);
    await loadResults();
  } catch (error) {
    setLoginMessage(error.message || "로그인에 실패했습니다.");
  }
}

async function bootstrapAdminPortal() {
  adminState.token = loadStoredSession();
  if (!adminState.token) {
    setPortalVisible(false);
    return;
  }

  try {
    setPortalVisible(true);
    await loadResults();
  } catch (error) {
    clearSession();
    setPortalVisible(false);
    setLoginMessage("세션이 만료되었습니다. 다시 로그인해 주세요.");
  }
}

adminEls.loginForm.addEventListener("submit", handleLogin);
adminEls.searchInput.addEventListener("input", renderResults);
adminEls.refreshBtn.addEventListener("click", () => {
  loadResults().catch((error) => alert(error.message || "새로고침에 실패했습니다."));
});
adminEls.logoutBtn.addEventListener("click", async () => {
  try {
    if (adminState.token) {
      await postAdminAction("logout", { token: adminState.token });
    }
  } catch (error) {
    console.warn("관리자 로그아웃 응답을 받지 못했습니다.", error);
  }
  clearSession();
  adminState.results = [];
  adminEls.list.innerHTML = "";
  setPortalVisible(false);
  setLoginMessage("");
});

bootstrapAdminPortal();

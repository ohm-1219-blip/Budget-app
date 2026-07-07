/* ===== 데이터 정의 ===== */
const CATEGORIES = {
  "식비": ["외식", "장보기", "배달", "배달앱", "카페"],
  "교통": ["대중교통", "주유", "주차", "톨비", "차량유지비", "보험비"],
  "주거": ["집대출", "관리비", "공과금"],
  "통신": ["휴대폰", "인터넷"],
  "의료": ["병원", "약국"],
  "보험": ["보험료"],
  "교육": ["학원", "교재"],
  "여가": ["취미", "여행", "구독"],
  "의류": ["의류", "잡화"],
  "경조사": ["경조사비"],
  "저축/투자": ["적금", "투자"],
  "기타": ["기타"]
};

const INCOME_CATEGORIES = {
  "급여": ["본봉", "상여금/보너스"],
  "부수입": ["프리랜서", "부업"],
  "금융수익": ["이자", "배당금", "주식매도"],
  "정부지원": ["아동수당", "육아휴직급여", "보조금"],
  "기타수입": ["용돈", "경조사수입", "환급금", "기타"]
};
const PAYMENT_METHODS = ["현금", "체크카드", "신용카드", "계좌이체", "간편결제", "청주페이"];

/* ===== Supabase 공용 DB 연동 ===== */
/* config.js 에서 SUPABASE_URL, SUPABASE_ANON_KEY 를 설정하세요. */
const db_client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function dbAll() {
  const { data, error } = await db_client.from("transactions").select("*").order("date", { ascending: false });
  if (error) { console.error(error); return []; }
  return data.map(mapTxnFromDB);
}

async function dbPut(item) {
  const { error } = await db_client.from("transactions").upsert(mapTxnToDB(item));
  if (error) console.error(error);
}

async function dbDelete(id) {
  const { error } = await db_client.from("transactions").delete().eq("id", id);
  if (error) console.error(error);
}

function mapTxnToDB(t) {
  return {
    id: t.id,
    type: t.type,
    amount: t.amount,
    date: t.date,
    category_main: t.categoryMain,
    category_sub: t.categorySub,
    payment: t.payment,
    memo: t.memo,
    is_fixed: t.isFixed,
    created_at: t.createdAt
  };
}

function mapTxnFromDB(r) {
  return {
    id: r.id,
    type: r.type,
    amount: r.amount,
    date: r.date,
    categoryMain: r.category_main,
    categorySub: r.category_sub,
    payment: r.payment,
    memo: r.memo,
    isFixed: r.is_fixed,
    createdAt: r.created_at
  };
}

async function getMeta(key, fallback) {
  const { data, error } = await db_client.from("meta").select("value").eq("key", key).maybeSingle();
  if (error || !data) return fallback;
  return data.value;
}

async function setMeta(key, value) {
  const { error } = await db_client.from("meta").upsert({ key, value });
  if (error) console.error(error);
}

async function dbAllAssets() {
  const { data, error } = await db_client.from("assets").select("*");
  if (error) { console.error(error); return []; }
  return data;
}

async function dbPutAsset(asset) {
  const { error } = await db_client.from("assets").upsert(asset);
  if (error) console.error(error);
}

async function dbDeleteAsset(id) {
  const { error } = await db_client.from("assets").delete().eq("id", id);
  if (error) console.error(error);
}

async function dbPutSnapshot(snap) {
  const { error } = await db_client.from("asset_snapshots").upsert(snap);
  if (error) console.error(error);
}

async function dbAllSnapshots() {
  const { data, error } = await db_client.from("asset_snapshots").select("*").order("date", { ascending: true });
  if (error) { console.error(error); return []; }
  return data;
}

/* ===== 전역 상태 ===== */
const state = {
  tab: "home",
  locked: true,
  pinInput: "",
  txns: [],
  viewMonth: new Date().toISOString().slice(0, 7),
  goals: { savingsRatio: 20 },
  assets: [],
  snapshots: [],
  assetDraft: { name: "", type: "현금", balance: "" },
  editingAssetId: null,
  editingTxn: null,
  draft: {
    type: "지출",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    categoryMain: "식비",
    categorySub: "외식",
    payment: "신용카드",
    memo: "",
    isFixed: false
  }
};

function fmt(n) {
  return Math.round(n).toLocaleString("ko-KR");
}

function monthLabel(ym) {
  const [y, m] = ym.split("-");
  return `${y}년 ${parseInt(m)}월`;
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function monthTxns(ym) {
  return state.txns.filter((t) => t.date.slice(0, 7) === ym);
}

function summarize(ym) {
  const list = monthTxns(ym);
  let income = 0, expense = 0, savings = 0;
  const catTotals = {};
  for (const t of list) {
    if (t.type === "수입") income += t.amount;
    else if (t.type === "지출") {
      expense += t.amount;
      if (t.categoryMain === "저축/투자") savings += t.amount;
      else {
        catTotals[t.categoryMain] = (catTotals[t.categoryMain] || 0) + t.amount;
      }
    }
  }
  return { income, expense, savings, catTotals };
}

/* ===== 렌더 ===== */
const app = document.getElementById("app");

function render() {
  if (state.locked) {
    app.innerHTML = renderLock();
    bindLockEvents();
    return;
  }
  let html = "";
  if (state.tab === "home") html = renderHome();
  else if (state.tab === "input") html = renderInput();
  else if (state.tab === "stats") html = renderStats();
  else if (state.tab === "assets") html = renderAssets();
  else if (state.tab === "settings") html = renderSettings();

  app.innerHTML = html + renderTabbar();
  bindEvents();
}

function renderLock() {
  const dots = "●".repeat(state.pinInput.length) + "○".repeat(4 - state.pinInput.length);
  const shake = state.pinError ? "style='animation:shake 0.3s;'" : "";
  return `
  <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:24px;">
    <p style="font-size:28px;margin:0;">🏠</p>
    <h2 style="margin:0;">우리집 가계부</h2>
    <p style="font-size:32px;letter-spacing:12px;margin:0;" ${shake}>${dots}</p>
    ${state.pinError ? '<p style="font-size:13px;color:var(--danger);margin:0;">PIN이 틀렸어요</p>' : '<p style="font-size:13px;color:var(--text-secondary);margin:0;">PIN 4자리를 입력하세요</p>'}
    <div style="display:grid;grid-template-columns:repeat(3,72px);gap:12px;">
      ${[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map(k => `
        <button data-pin="${k}" style="width:72px;height:72px;border-radius:50%;border:1px solid var(--border);background:var(--card);font-size:22px;cursor:pointer;${k===""?"visibility:hidden;":""}">
          ${k}
        </button>`).join("")}
    </div>
  </div>`;
}

function bindLockEvents() {
  document.querySelectorAll("[data-pin]").forEach(btn => {
    btn.onclick = async () => {
      const val = btn.dataset.pin;
      if (val === "⌫") {
        state.pinInput = state.pinInput.slice(0, -1);
      } else if (val !== "") {
        state.pinInput += val;
        if (state.pinInput.length === 4) {
          const savedPin = await getMeta("pin", null);
          if (!savedPin) {
            await setMeta("pin", state.pinInput);
            state.locked = false;
            state.pinInput = "";
          } else if (state.pinInput === savedPin) {
            state.locked = false;
            state.pinInput = "";
          } else {
            state.pinError = true;
            state.pinInput = "";
            render();
            setTimeout(() => { state.pinError = false; render(); }, 600);
            return;
          }
        }
      }
      state.pinError = false;
      render();
    };
  });
}

function renderTabbar() {
  const tabs = [
    { id: "home", icon: "🏠" },
    { id: "input", icon: "➕" },
    { id: "stats", icon: "📊" },
    { id: "assets", icon: "💰" },
    { id: "settings", icon: "⚙️" }
  ];
  return `<div class="tabbar">${tabs.map(t =>
    `<button data-tab="${t.id}" class="${state.tab === t.id ? "active" : ""}">${t.icon}</button>`
  ).join("")}</div>`;
}

function renderHome() {
  const { income, expense, savings, catTotals } = summarize(state.viewMonth);
  const savingsRatio = income > 0 ? (savings / income) * 100 : 0;
  const recent = [...state.txns].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  const comment = buildComment(income, expense, savings, savingsRatio, catTotals);

  return `
  <header class="page-header">
    <p class="sub">${monthLabel(state.viewMonth)}</p>
    <h1>우리집 가계부</h1>
  </header>
  <div class="grid-3">
    <div class="metric-card"><p class="label">수입</p><p class="value">${fmt(income)}원</p></div>
    <div class="metric-card"><p class="label">지출</p><p class="value">${fmt(expense)}원</p></div>
    <div class="metric-card"><p class="label">저축/투자</p><p class="value">${fmt(savings)}원</p></div>
  </div>
  <div class="section">
    <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
      <span style="font-size:13px;color:var(--text-secondary);">저축률 목표 대비</span>
      <span style="font-size:13px;font-weight:600;">${savingsRatio.toFixed(0)}% / ${state.goals.savingsRatio}%</span>
    </div>
    <div class="progress-bar"><div class="fill" style="width:${Math.min(100, (savingsRatio / state.goals.savingsRatio) * 100)}%"></div></div>
  </div>
  <div class="section">
    <h3>최근 거래</h3>
    ${recent.length === 0 ? '<p class="empty-state">아직 입력된 거래가 없어요.</p>' :
      recent.map(t => `
      <div class="list-row">
        <div class="left">
          <div>
            <p class="name">${t.categoryMain} &gt; ${t.categorySub}</p>
            <p class="meta">${t.date} · ${t.payment}${t.memo ? " · " + t.memo : ""}</p>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <p class="amount ${t.type === "수입" ? "income" : "expense"}">${t.type === "수입" ? "+" : "-"}${fmt(t.amount)}</p>
          <button data-edit="${t.id}" style="font-size:12px;padding:2px 8px;border:1px solid var(--border);border-radius:6px;background:none;cursor:pointer;color:var(--text-secondary);">수정</button>
          <button data-del="${t.id}" style="font-size:12px;padding:2px 8px;border:1px solid var(--border);border-radius:6px;background:none;cursor:pointer;color:var(--danger);">삭제</button>
        </div>
      </div>`).join("")}
  </div>
  <div class="comment-card">
    <p class="title">이달의 코멘트</p>
    <p class="body">${comment}</p>
  </div>
  `;
}

function buildComment(income, expense, savings, savingsRatio, catTotals) {
  if (income === 0 && expense === 0) return "이번 달 거래를 입력하면 분석 코멘트를 보여드려요.";
  const parts = [];
  const diff = savingsRatio - state.goals.savingsRatio;
  if (diff >= 0) parts.push(`저축률 ${savingsRatio.toFixed(0)}%로 목표(${state.goals.savingsRatio}%)를 ${diff.toFixed(0)}%p 초과 달성했어요.`);
  else parts.push(`저축률이 ${savingsRatio.toFixed(0)}%로 목표(${state.goals.savingsRatio}%)보다 ${Math.abs(diff).toFixed(0)}%p 낮습니다.`);

  const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  if (sorted.length > 0 && income > 0) {
    const [topCat, topAmt] = sorted[0];
    const ratio = (topAmt / income) * 100;
    if (ratio > 25) parts.push(`${topCat} 지출이 수입의 ${ratio.toFixed(0)}%로 비중이 큰 편이에요.`);
  }
  return parts.join(" ");
}

function renderInput() {
  const d = state.draft;
  const isEditing = !!state.editingTxn;
  const activeCats = d.type === "수입" ? INCOME_CATEGORIES : CATEGORIES;
  const subOptions = activeCats[d.categoryMain] || Object.values(activeCats)[0] || [];

  return `
  <header class="page-header" style="display:flex;align-items:center;justify-content:space-between;">
    <h1>${isEditing ? "거래 수정" : "거래 입력"}</h1>
    ${isEditing ? '<button id="cancelEditBtn" style="font-size:13px;color:var(--text-secondary);border:none;background:none;cursor:pointer;">취소</button>' : ""}
  </header>
  <div class="type-toggle">
    <button data-type="지출" class="${d.type === "지출" ? "active expense" : ""}">지출</button>
    <button data-type="수입" class="${d.type === "수입" ? "active income" : ""}">수입</button>
    <button data-type="이체" class="${d.type === "이체" ? "active" : ""}">이체</button>
  </div>
  <div class="amount-input">
    <input type="number" id="amount" placeholder="0" value="${d.amount}" />
    <span style="font-size:13px;color:var(--text-secondary);">원</span>
  </div>
  <div class="section">
    <div class="field-row">
      <label>날짜</label>
      <input type="date" id="date" value="${d.date}" />
    </div>
    <div class="field-row">
      <label>대분류</label>
      <select id="categoryMain">
        ${Object.keys(activeCats).map(c => `<option value="${c}" ${c === d.categoryMain ? "selected" : ""}>${c}</option>`).join("")}
      </select>
    </div>
    <div class="field-row">
      <label>소분류</label>
      <select id="categorySub">
        ${subOptions.map(s => `<option value="${s}" ${s === d.categorySub ? "selected" : ""}>${s}</option>`).join("")}
      </select>
    </div>
    <div class="field-row">
      <label>결제수단</label>
      <select id="payment">
        ${PAYMENT_METHODS.map(p => `<option value="${p}" ${p === d.payment ? "selected" : ""}>${p}</option>`).join("")}
      </select>
    </div>
    <div class="field-row">
      <label>고정비 여부</label>
      <input type="checkbox" id="isFixed" ${d.isFixed ? "checked" : ""} />
    </div>
    <div class="field-row">
      <label>메모</label>
      <input type="text" id="memo" placeholder="메모 입력" value="${d.memo}" />
    </div>
  </div>
  <div class="section">
    <button class="btn-primary" id="saveBtn">${isEditing ? "수정 완료" : "저장"}</button>
  </div>
  `;
}

function renderStats() {
  const { income, expense, savings, catTotals } = summarize(state.viewMonth);
  const total = income > 0 ? income : (expense + savings) || 1;
  const expenseOnlyRatio = ((expense - savings) / total) * 100;
  const savingsRatio = (savings / total) * 100;
  const remainRatio = Math.max(0, 100 - expenseOnlyRatio - savingsRatio);

  const colors = ["#1a6ef5", "#35d3ff", "#f0997b", "#5dcaa5", "#d4537e", "#ba7517", "#7f77dd", "#85b7eb"];
  const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const catTotal = sortedCats.reduce((s, [, v]) => s + v, 0) || 1;

  const r = 60, c = 2 * Math.PI * r;
  let offset = 0;
  const segs = [
    { val: expenseOnlyRatio, color: "#f0997b" },
    { val: savingsRatio, color: "#5dcaa5" },
    { val: remainRatio, color: "#85b7eb" }
  ];
  const arcs = segs.map(s => {
    const len = (s.val / 100) * c;
    const arc = `<circle cx="80" cy="80" r="${r}" fill="none" stroke="${s.color}" stroke-width="24" stroke-dasharray="${len} ${c}" stroke-dashoffset="${-offset}" transform="rotate(-90 80 80)"></circle>`;
    offset += len;
    return arc;
  }).join("");

  return `
  <div class="month-nav">
    <button data-shift="-1">‹</button>
    <h3 style="margin:0;">${monthLabel(state.viewMonth)}</h3>
    <button data-shift="1">›</button>
  </div>
  <div class="donut-wrap">
    <svg width="160" height="160" viewBox="0 0 160 160" role="img" aria-label="수입 대비 지출 저축 비중">
      ${arcs}
      <text x="80" y="76" text-anchor="middle" style="font-size:12px;fill:#6b7280;">저축률</text>
      <text x="80" y="94" text-anchor="middle" style="font-size:18px;font-weight:600;fill:#1a1a1a;">${savingsRatio.toFixed(0)}%</text>
    </svg>
  </div>
  <div class="legend">
    <span><span class="dot" style="background:#f0997b;"></span>지출 ${expenseOnlyRatio.toFixed(0)}%</span>
    <span><span class="dot" style="background:#5dcaa5;"></span>저축 ${savingsRatio.toFixed(0)}%</span>
    <span><span class="dot" style="background:#85b7eb;"></span>잔여 ${remainRatio.toFixed(0)}%</span>
  </div>
  <div class="section">
    <h3>카테고리별 지출</h3>
    ${sortedCats.length === 0 ? '<p class="empty-state">지출 데이터가 없어요.</p>' :
      sortedCats.map(([cat, val], i) => `
      <div class="cat-row">
        <div class="top"><span>${cat}</span><span style="color:var(--text-secondary);">${((val / catTotal) * 100).toFixed(0)}%</span></div>
        <div class="progress-bar"><div class="fill" style="width:${(val / catTotal) * 100}%;background:${colors[i % colors.length]};"></div></div>
      </div>`).join("")}
  </div>
  <div class="comment-card">
    <p class="title">이달의 코멘트</p>
    <p class="body">${buildComment(income, expense, savings, savingsRatio, catTotals)}</p>
  </div>
  <button class="btn-primary export-btn" id="exportBtn">이번 달 엑셀로 내보내기</button>
  `;
}

function renderAssets() {
  const assets = state.assets;
  const total = assets.reduce((s, a) => s + (a.type === "부채" ? -a.balance : a.balance), 0);
  const snaps = state.snapshots;
  const prev = snaps.length >= 2 ? snaps[snaps.length - 2] : null;
  const diff = prev ? total - prev.total : null;

  const typeIcon = { "현금": "💵", "예적금": "🏦", "투자": "📈", "부채": "📉" };

  return `
  <header class="page-header"><h1>자산 현황</h1></header>
  <div class="section">
    <div class="metric-card" style="margin-bottom:12px;">
      <p class="label">순자산</p>
      <p class="value" style="font-size:22px;">${fmt(total)}원</p>
      ${diff !== null ? `<p style="font-size:12px;margin:4px 0 0;color:${diff >= 0 ? "var(--success)" : "var(--danger)"};">전월 대비 ${diff >= 0 ? "+" : ""}${fmt(diff)}원</p>` : ""}
    </div>
  </div>
  <div class="section">
    <h3>자산 목록</h3>
    ${assets.length === 0 ? '<p class="empty-state">등록된 자산이 없어요. 아래에서 추가해보세요.</p>' :
      assets.map(a => `
      <div class="list-row">
        <div class="left">
          <span style="font-size:18px;">${typeIcon[a.type] || "💼"}</span>
          <div>
            <p class="name">${a.name}</p>
            <p class="meta">${a.type}</p>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          ${state.editingAssetId === a.id
            ? `<input type="number" id="editAssetBalance" value="${a.balance}" style="width:100px;text-align:right;border:1px solid var(--border);border-radius:6px;padding:2px 6px;font-size:13px;" />
               <button data-save-asset="${a.id}" style="font-size:12px;padding:2px 8px;border:none;border-radius:6px;background:var(--blue);color:white;cursor:pointer;">저장</button>
               <button data-cancel-asset style="font-size:12px;padding:2px 8px;border:1px solid var(--border);border-radius:6px;background:none;cursor:pointer;">취소</button>`
            : `<p class="amount">${a.type === "부채" ? "-" : ""}${fmt(a.balance)}원</p>
               <button data-edit-asset="${a.id}" style="font-size:12px;padding:2px 8px;border:1px solid var(--border);border-radius:6px;background:none;cursor:pointer;color:var(--text-secondary);">수정</button>
               <span data-del-asset="${a.id}" style="color:var(--danger);font-size:12px;padding:2px 8px;border:1px solid var(--border);border-radius:6px;cursor:pointer;">삭제</span>`
          }
        </div>
      </div>`).join("")}
  </div>
  <div class="section">
    <h3>자산 추가</h3>
    <div class="field-row">
      <label>이름</label>
      <input type="text" id="assetName" placeholder="예: 청주은행 예금" value="${state.assetDraft.name}" />
    </div>
    <div class="field-row">
      <label>종류</label>
      <select id="assetType">
        ${["현금", "예적금", "투자", "부채"].map(t => `<option value="${t}" ${t === state.assetDraft.type ? "selected" : ""}>${t}</option>`).join("")}
      </select>
    </div>
    <div class="field-row">
      <label>잔액</label>
      <input type="number" id="assetBalance" placeholder="0" value="${state.assetDraft.balance}" />
    </div>
    <button class="btn-primary" id="addAssetBtn">추가</button>
  </div>
  ${snaps.length > 1 ? `
  <div class="section">
    <h3>순자산 변화 추이</h3>
    ${snaps.slice(-6).reverse().map((s, i, arr) => {
      const next = arr[i + 1];
      const d = next ? s.total - next.total : null;
      return `
      <div class="list-row">
        <p class="name">${s.date}</p>
        <div style="display:flex;align-items:center;gap:8px;">
          <p class="amount">${fmt(s.total)}원</p>
          ${d !== null ? `<span style="font-size:11px;color:${d >= 0 ? "var(--success)" : "var(--danger)"};">${d >= 0 ? "+" : ""}${fmt(d)}</span>` : ""}
        </div>
      </div>`;
    }).join("")}
  </div>` : ""}
  `;
}

function renderSettings() {
  return `
  <header class="page-header"><h1>설정</h1></header>
  <div class="settings-row">
    <span>저축/투자 목표 비율</span>
    <span class="right"><input type="number" id="goalInput" value="${state.goals.savingsRatio}" style="width:50px;text-align:right;border:none;background:none;" />%</span>
  </div>
  <div class="settings-row">
    <span>전체 데이터 초기화</span>
    <span class="right" id="resetBtn" style="color:var(--danger);cursor:pointer;">초기화</span>
  </div>
  <p class="empty-state">카테고리 관리, 고정비 관리, 계좌 관리 기능은 추후 추가될 예정이에요.</p>
  `;
}

/* ===== 이벤트 바인딩 ===== */
function bindEvents() {
  document.querySelectorAll("[data-tab]").forEach(btn => {
    btn.onclick = () => { state.tab = btn.dataset.tab; render(); };
  });

  // 홈: 수정/삭제 버튼
  document.querySelectorAll("[data-edit]").forEach(btn => {
    btn.onclick = () => {
      const t = state.txns.find(x => x.id === btn.dataset.edit);
      if (!t) return;
      state.editingTxn = t;
      state.draft = { type: t.type, amount: t.amount, date: t.date, categoryMain: t.categoryMain, categorySub: t.categorySub, payment: t.payment, memo: t.memo || "", isFixed: t.isFixed };
      state.tab = "input";
      render();
    };
  });
  document.querySelectorAll("[data-del]").forEach(btn => {
    btn.onclick = async () => {
      if (!confirm("이 거래를 삭제할까요?")) return;
      await dbDelete(btn.dataset.del);
      state.txns = state.txns.filter(x => x.id !== btn.dataset.del);
      render();
    };
  });

  if (state.tab === "input") {
    const cancelBtn = document.getElementById("cancelEditBtn");
    if (cancelBtn) cancelBtn.onclick = () => {
      state.editingTxn = null;
      state.draft = { type: "지출", amount: "", date: new Date().toISOString().slice(0, 10), categoryMain: "식비", categorySub: "외식", payment: "신용카드", memo: "", isFixed: false };
      state.tab = "home";
      render();
    };
    document.querySelectorAll("[data-type]").forEach(btn => {
      btn.onclick = () => {
        state.draft.type = btn.dataset.type;
        const cats = btn.dataset.type === "수입" ? INCOME_CATEGORIES : CATEGORIES;
        state.draft.categoryMain = Object.keys(cats)[0];
        state.draft.categorySub = Object.values(cats)[0][0];
        render();
      };
    });
    const amountEl = document.getElementById("amount");
    if (amountEl) amountEl.oninput = (e) => state.draft.amount = e.target.value;
    const dateEl = document.getElementById("date");
    if (dateEl) dateEl.onchange = (e) => state.draft.date = e.target.value;
    const catMain = document.getElementById("categoryMain");
    if (catMain) catMain.onchange = (e) => {
      state.draft.categoryMain = e.target.value;
      const cats = state.draft.type === "수입" ? INCOME_CATEGORIES : CATEGORIES;
      state.draft.categorySub = (cats[e.target.value] || [])[0] || "";
      render();
    };
    const catSub = document.getElementById("categorySub");
    if (catSub) catSub.onchange = (e) => state.draft.categorySub = e.target.value;
    const payment = document.getElementById("payment");
    if (payment) payment.onchange = (e) => state.draft.payment = e.target.value;
    const isFixed = document.getElementById("isFixed");
    if (isFixed) isFixed.onchange = (e) => state.draft.isFixed = e.target.checked;
    const memo = document.getElementById("memo");
    if (memo) memo.oninput = (e) => state.draft.memo = e.target.value;
    const saveBtn = document.getElementById("saveBtn");
    if (saveBtn) saveBtn.onclick = saveTxn;
  }

  if (state.tab === "stats") {
    document.querySelectorAll("[data-shift]").forEach(btn => {
      btn.onclick = () => { state.viewMonth = shiftMonth(state.viewMonth, parseInt(btn.dataset.shift)); render(); };
    });
    const exportBtn = document.getElementById("exportBtn");
    if (exportBtn) exportBtn.onclick = exportExcel;
  }

  if (state.tab === "assets") {
    const nameEl = document.getElementById("assetName");
    if (nameEl) nameEl.oninput = (e) => state.assetDraft.name = e.target.value;
    const typeEl = document.getElementById("assetType");
    if (typeEl) typeEl.onchange = (e) => state.assetDraft.type = e.target.value;
    const balanceEl = document.getElementById("assetBalance");
    if (balanceEl) balanceEl.oninput = (e) => state.assetDraft.balance = e.target.value;
    const addBtn = document.getElementById("addAssetBtn");
    if (addBtn) addBtn.onclick = saveAsset;

    // 수정 버튼
    document.querySelectorAll("[data-edit-asset]").forEach(el => {
      el.onclick = () => { state.editingAssetId = el.dataset.editAsset; render(); };
    });
    // 수정 저장
    document.querySelectorAll("[data-save-asset]").forEach(el => {
      el.onclick = async () => {
        const newBal = parseFloat(document.getElementById("editAssetBalance").value);
        if (isNaN(newBal)) return;
        const asset = state.assets.find(a => a.id === el.dataset.saveAsset);
        if (!asset) return;
        asset.balance = newBal;
        await dbPutAsset(asset);
        await saveSnapshot();
        state.editingAssetId = null;
        render();
      };
    });
    // 수정 취소
    const cancelAsset = document.querySelector("[data-cancel-asset]");
    if (cancelAsset) cancelAsset.onclick = () => { state.editingAssetId = null; render(); };

    document.querySelectorAll("[data-del-asset]").forEach(el => {
      el.onclick = async () => {
        await dbDeleteAsset(el.dataset.delAsset);
        state.assets = state.assets.filter(a => a.id !== el.dataset.delAsset);
        await saveSnapshot();
        render();
      };
    });
  }

  if (state.tab === "settings") {
    const goalInput = document.getElementById("goalInput");
    if (goalInput) goalInput.onchange = async (e) => {
      state.goals.savingsRatio = parseFloat(e.target.value) || 0;
      await setMeta("goals", state.goals);
      render();
    };
    const resetBtn = document.getElementById("resetBtn");
    if (resetBtn) resetBtn.onclick = async () => {
      if (confirm("모든 거래 데이터를 삭제할까요? 되돌릴 수 없어요.")) {
        for (const t of state.txns) await dbDelete(t.id);
        state.txns = [];
        render();
      }
    };
  }
}

async function saveAsset() {
  const d = state.assetDraft;
  const balance = parseFloat(d.balance);
  if (!d.name || isNaN(balance)) { alert("이름과 잔액을 입력해주세요."); return; }
  const item = { id: crypto.randomUUID(), name: d.name, type: d.type, balance };
  await dbPutAsset(item);
  state.assets.push(item);
  state.assetDraft = { name: "", type: "현금", balance: "" };
  await saveSnapshot();
  render();
}

async function saveSnapshot() {
  const total = state.assets.reduce((s, a) => s + (a.type === "부채" ? -a.balance : a.balance), 0);
  const today = new Date().toISOString().slice(0, 10);
  const snap = { date: today, total };
  await dbPutSnapshot(snap);
  const idx = state.snapshots.findIndex(s => s.date === today);
  if (idx >= 0) state.snapshots[idx] = snap;
  else state.snapshots.push(snap);
  state.snapshots.sort((a, b) => a.date.localeCompare(b.date));
}

async function saveTxn() {
  const d = state.draft;
  const amount = parseFloat(d.amount);
  if (!amount || amount <= 0) { alert("금액을 입력해주세요."); return; }

  if (state.editingTxn) {
    // 수정 모드
    const updated = { ...state.editingTxn, type: d.type, amount, date: d.date, categoryMain: d.categoryMain, categorySub: d.categorySub, payment: d.payment, memo: d.memo, isFixed: d.isFixed };
    await dbPut(updated);
    state.txns = state.txns.map(t => t.id === updated.id ? updated : t);
    state.editingTxn = null;
  } else {
    // 신규 입력
    const item = {
      id: crypto.randomUUID(),
      type: d.type,
      amount,
      date: d.date,
      categoryMain: d.categoryMain,
      categorySub: d.categorySub,
      payment: d.payment,
      memo: d.memo,
      isFixed: d.isFixed,
      createdAt: new Date().toISOString()
    };
    await dbPut(item);
    state.txns.push(item);
  }
  state.draft = { type: "지출", amount: "", date: new Date().toISOString().slice(0, 10), categoryMain: "식비", categorySub: "외식", payment: "신용카드", memo: "", isFixed: false };
  state.tab = "home";
  render();
}

function exportExcel() {
  const ym = state.viewMonth;
  const { income, expense, savings, catTotals } = summarize(ym);
  const list = monthTxns(ym);
  const savingsRatio = income > 0 ? (savings / income) * 100 : 0;

  const wb = XLSX.utils.book_new();

  const summarySheet = XLSX.utils.aoa_to_sheet([
    ["항목", "금액"],
    ["총수입", income],
    ["총지출", expense],
    ["저축/투자", savings],
    ["순잔액", income - expense],
    ["저축률(%)", savingsRatio.toFixed(1)],
    ["목표 저축률(%)", state.goals.savingsRatio]
  ]);
  XLSX.utils.book_append_sheet(wb, summarySheet, "요약");

  const catRows = [["대분류", "금액", "비율(%)"]];
  Object.entries(catTotals).forEach(([cat, val]) => {
    catRows.push([cat, val, income > 0 ? ((val / income) * 100).toFixed(1) : "0"]);
  });
  const catSheet = XLSX.utils.aoa_to_sheet(catRows);
  XLSX.utils.book_append_sheet(wb, catSheet, "카테고리별 지출");

  const txnRows = [["날짜", "구분", "대분류", "소분류", "금액", "결제수단", "고정비", "메모"]];
  list.sort((a, b) => a.date.localeCompare(b.date)).forEach(t => {
    txnRows.push([t.date, t.type, t.categoryMain, t.categorySub, t.amount, t.payment, t.isFixed ? "Y" : "N", t.memo || ""]);
  });
  const txnSheet = XLSX.utils.aoa_to_sheet(txnRows);
  XLSX.utils.book_append_sheet(wb, txnSheet, "거래 내역");

  const commentSheet = XLSX.utils.aoa_to_sheet([
    ["월간 코멘트"],
    [buildComment(income, expense, savings, savingsRatio, catTotals)]
  ]);
  XLSX.utils.book_append_sheet(wb, commentSheet, "코멘트");

  XLSX.writeFile(wb, `가계부_${ym}.xlsx`);
}

/* ===== 초기화 ===== */
async function init() {
  state.txns = await dbAll();
  state.goals = await getMeta("goals", state.goals);
  state.assets = await dbAllAssets();
  state.snapshots = await dbAllSnapshots();
  render();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

init();

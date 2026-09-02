/* 麻的🔥小辛辣 營運巡檢 App — 主流程 */
(function () {
  'use strict';
  const Q = window.MDSSL_QUESTIONS, SC = window.MDSSL_SCORING,
        ST = window.MDSSL_STORE, PH = window.MDSSL_PHOTOS, RP = window.MDSSL_REPORT;

  const app = document.getElementById('app');
  let state = null;
  let saveTimer = null;

  function key(f, c, n) { return f + '.' + c + '.' + n; }
  function todayStr() { const d = new Date(); const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  function blankInspection() {
    return {
      inspectionId: ST.newId(), store: '', date: todayStr(), inspector: '巡店主管',
      answers: { scores: {}, bonuses: {}, freeBonuses: {}, penalties: {}, reasons: {}, photos: {} },
      meta: { compareLast: '', note: '' }, status: '草稿', createdAt: Date.now(),
    };
  }

  function scheduleSave() {
    if (!state || !state.inspection) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { ST.saveDraft(state.inspection); }, 600);
  }

  /* ============ 畫面路由 ============ */
  function go(screen) { state.screen = screen; render(); window.scrollTo(0, 0); }
  function render() {
    if (!state.passcodeOk) return renderLogin();
    if (state.screen === 'start') return renderStart();
    if (state.screen === 'inspect') return renderInspect();
    if (state.screen === 'report') return renderReport();
    renderStart();
  }

  /* ============ 登入 ============ */
  function renderLogin() {
    app.innerHTML =
      '<div class="screen"><div class="login-wrap">' +
      '<div class="logo">🔥</div>' +
      '<h1>營運巡檢</h1><p class="tag">麻的🔥小辛辣 · 門市巡檢</p>' +
      '<div style="width:100%;max-width:320px">' +
      '<label class="fld">通行碼</label>' +
      '<input id="pass" type="tel" inputmode="numeric" placeholder="請輸入通行碼" autocomplete="off">' +
      '<div class="err" id="passErr"></div>' +
      '<button class="btn" id="loginBtn">進入</button>' +
      '</div></div></div>';
    const inp = document.getElementById('pass');
    const doLogin = () => {
      const pass = inp.value.trim();
      const btn = document.getElementById('loginBtn');
      btn.disabled = true; document.getElementById('passErr').textContent = '';
      ST.auth(pass).then(ok => {
        if (ok) { state.passcodeOk = true; go('start'); }
        else { document.getElementById('passErr').textContent = '通行碼錯誤'; btn.disabled = false; }
      }).catch(() => { document.getElementById('passErr').textContent = '連線失敗，請稍後再試'; btn.disabled = false; });
    };
    document.getElementById('loginBtn').onclick = doLogin;
    inp.onkeydown = e => { if (e.key === 'Enter') doLogin(); };
    inp.focus();
  }

  /* ============ 開始巡檢 ============ */
  function renderStart() {
    app.innerHTML =
      '<div class="brandbar"><span class="flame">🔥</span>營運巡檢<span class="sub">麻的小辛辣</span></div>' +
      '<div class="screen"><div class="pad">' +
      '<div class="card">' +
      '<label class="fld">選擇門市</label>' +
      '<div class="store-grid" id="storeGrid">' +
      Q.STORES.map(s => '<button class="store-opt" data-store="' + s + '">' + s + '</button>').join('') +
      '</div>' +
      '<label class="fld">巡檢日期</label><input id="date" type="date" value="' + todayStr() + '">' +
      '<label class="fld">巡檢人</label><input id="inspector" type="text" value="巡店主管">' +
      '<div style="height:16px"></div>' +
      '<button class="btn" id="startBtn" disabled>開始巡檢</button>' +
      '<button class="btn ghost" id="demoBtn" style="margin-top:8px">🎬 填入示範資料（試看完整報告）</button>' +
      '</div>' +
      '<div id="draftArea"></div>' +
      '<div id="historyArea"></div>' +
      '</div></div>';

    let chosen = '';
    const grid = document.getElementById('storeGrid');
    grid.onclick = e => {
      const b = e.target.closest('[data-store]'); if (!b) return;
      chosen = b.dataset.store;
      [].forEach.call(grid.children, c => c.classList.toggle('sel', c === b));
      document.getElementById('startBtn').disabled = false;
    };
    document.getElementById('startBtn').onclick = () => {
      const insp = blankInspection();
      insp.store = chosen;
      insp.date = document.getElementById('date').value || todayStr();
      insp.inspector = document.getElementById('inspector').value.trim() || '巡店主管';
      state.inspection = insp; state.activeForm = Q.FORMS[0].id; state.reportMode = null;
      ST.saveDraft(insp); go('inspect');
    };
    document.getElementById('demoBtn').onclick = () => {
      const btn = document.getElementById('demoBtn');
      btn.disabled = true; btn.textContent = '產生示範資料中…';
      window.MDSSL_DEMO.build(chosen || '光復').then(insp => {
        state.inspection = insp; state.activeForm = Q.FORMS[0].id; state.reportMode = null;
        ST.saveDraft(insp).then(() => go('report'));
      });
    };
    renderDraftList();
    renderHistoryList();
  }

  function renderHistoryList() {
    ST.listSubmitted().then(list => {
      const area = document.getElementById('historyArea');
      if (!area) return;
      if (!list.length) { area.innerHTML = ''; return; }
      area.innerHTML = '<div class="section-title">歷史紀錄（已送出）</div><div class="card" id="histCard">' +
        list.map(d => {
          const op = d.operational == null ? '營運未評' : ('營運 ' + d.operational + '(' + d.operationalGrade + ')');
          const mg = d.management == null ? '經營未評' : ('經營 ' + d.management + '(' + d.managementGrade + ')');
          return '<div class="draft-row" data-id="' + d.inspectionId + '">' +
            '<div class="meta"><b>' + esc(d.store) + '店</b> <small>' + esc(d.date) + ' · ' + op + ' · ' + mg + '</small></div>' +
            '<button class="btn ghost view" style="width:auto" data-id="' + d.inspectionId + '">查看</button>' +
          '</div>';
        }).join('') + '</div>';
      area.querySelector('#histCard').onclick = e => {
        const v = e.target.closest('.view'); if (!v) return;
        v.textContent = '載入中…';
        ST.getSubmitted(v.dataset.id).then(rec => {
          if (rec) { state.inspection = rec; state.reportMode = 'history'; go('report'); }
          else { v.textContent = '查看'; toast('讀取失敗'); }
        });
      };
    });
  }

  function renderDraftList() {
    ST.listDrafts().then(drafts => {
      const area = document.getElementById('draftArea');
      if (!area) return;
      if (!drafts.length) { area.innerHTML = ''; return; }
      area.innerHTML = '<div class="section-title">未完成的草稿</div><div class="card" id="draftCard">' +
        drafts.map(d => {
          const r = SC.computeAll(d.answers);
          const opTxt = r.operationalScore == null ? '營運未評' : ('營運 ' + r.operationalScore + '分(' + r.operationalGrade + ')');
          return '<div class="draft-row" data-id="' + d.inspectionId + '">' +
            '<div class="meta"><b>' + esc(d.store) + '店</b> <small>' + esc(d.date) + ' · ' + opTxt + '</small></div>' +
            '<button class="btn ghost resume" style="width:auto" data-id="' + d.inspectionId + '">繼續</button>' +
            '<button class="btn ghost del" style="width:auto;color:#78716C" data-id="' + d.inspectionId + '">刪</button>' +
            '</div>';
        }).join('') + '</div>';
      area.querySelector('#draftCard').onclick = e => {
        const rz = e.target.closest('.resume'), dl = e.target.closest('.del');
        if (rz) { ST.loadDraft(rz.dataset.id).then(d => { state.inspection = d; state.activeForm = Q.FORMS[0].id; state.reportMode = null; go('inspect'); }); }
        else if (dl) { if (confirm('確定刪除此草稿？')) ST.deleteDraft(dl.dataset.id).then(renderDraftList); }
      };
    });
  }

  /* ============ 巡檢主畫面 ============ */
  function renderInspect() {
    const insp = state.inspection;
    app.innerHTML =
      '<div class="brandbar"><span class="flame">🔥</span>' + esc(insp.store) + '店 · ' + esc(insp.date) +
      '<span class="sub" id="backStart">＜ 返回</span></div>' +
      '<div class="tabbar" id="tabbar"></div>' +
      '<div class="scorebar" id="scorebar"></div>' +
      '<div class="screen"><div class="pad" id="formBody"></div></div>' +
      '<div class="bottombar"><button class="btn secondary" id="saveBtn">存草稿</button>' +
      '<button class="btn" id="doneBtn">完成 · 看報告</button></div>';
    document.getElementById('backStart').onclick = () => { ST.saveDraft(insp); go('start'); };
    document.getElementById('saveBtn').onclick = () => { ST.saveDraft(insp).then(() => toast('草稿已存')); };
    document.getElementById('doneBtn').onclick = () => { ST.saveDraft(insp); state.reportMode = null; go('report'); };
    renderTabs(); renderFormBody(); updateScoreUI();
    ensurePhotoInput();
  }

  function renderTabs() {
    const bar = document.getElementById('tabbar');
    bar.innerHTML = Q.FORMS.map(f =>
      '<button data-form="' + f.id + '"' + (f.id === state.activeForm ? ' class="active"' : '') + '>' + f.name +
      '<span class="dot hidden" data-badge="' + f.id + '"></span></button>').join('');
    bar.onclick = e => { const b = e.target.closest('[data-form]'); if (!b) return; state.activeForm = b.dataset.form; renderTabs(); renderFormBody(); updateScoreUI(); window.scrollTo(0, 0); };
  }

  function renderFormBody() {
    const form = Q.FORMS.find(f => f.id === state.activeForm);
    const body = document.getElementById('formBody');
    body.innerHTML = form.categories.map(cat => catHTML(form, cat)).join('');
    bindFormEvents(body, form);
  }

  function catHTML(form, cat) {
    const wtxt = cat.role === 'scored' ? '<span class="w">權重 ' + cat.weight + '</span>' : '';
    return '<div class="cat-head">' + esc(cat.name) + wtxt + '</div>' +
      cat.items.map(it => itemHTML(form, cat, it)).join('');
  }

  function itemHTML(form, cat, it) {
    const k = key(form.id, cat.id, it.n);
    const a = state.inspection.answers;
    const qhtml = '<div class="q"><span class="n">' + it.n + '.</span> ' + esc(it.text) + '</div>';

    if (it.type === 'score') {
      const v = a.scores[k];
      const dots = [0, 1, 2, 3, 4, 5].map(x =>
        '<button class="dot-btn' + (v === x ? ' sel' : '') + '" data-act="score" data-k="' + k + '" data-v="' + x + '">' + x + '</button>').join('');
      const flagged = v != null && v < 5;
      return card(k, flagged, v != null && v <= 3, qhtml +
        '<div class="dots">' + dots + '</div><div class="dot-scale"><span>0 差</span><span>5 佳</span></div>' +
        detailBlock(form, cat, it, k, flagged));
    }
    if (it.type === 'critical') {
      const v = a.scores[k]; const hit = v === 0;
      return card(k, false, false, qhtml +
        '<div class="seg"><button class="ok' + (v === 5 ? ' sel' : '') + '" data-act="crit" data-k="' + k + '" data-v="5">正常</button>' +
        '<button class="bad' + (hit ? ' sel' : '') + '" data-act="crit" data-k="' + k + '" data-v="0">發生（該項0分）</button></div>' +
        detailBlock(form, cat, it, k, hit), hit ? 'critical-hit' : '');
    }
    if (it.type === 'binary') {
      const v = a.scores[k];
      return card(k, v === 0, false, qhtml +
        '<div class="seg"><button class="bad' + (v === 0 ? ' sel' : '') + '" data-act="score" data-k="' + k + '" data-v="0">未達（0）</button>' +
        '<button class="ok' + (v === 5 ? ' sel' : '') + '" data-act="score" data-k="' + k + '" data-v="5">有做到（5）</button></div>' +
        detailBlock(form, cat, it, k, v === 0));
    }
    if (it.type === 'bonus') {
      const on = !!a.bonuses[k];
      return '<div class="item"><label class="chk"><input type="checkbox" data-act="bonus" data-k="' + k + '"' + (on ? ' checked' : '') + '>' +
        '<span class="q" style="margin:0"><span class="n">' + it.n + '.</span> ' + esc(it.text) + ' <b style="color:var(--green)">＋' + it.points + '</b></span></label></div>';
    }
    if (it.type === 'bonus_free') {
      const arr = a.freeBonuses[k] || [];
      const rows = [];
      for (let i = 0; i < it.max; i++) rows.push('<div class="free-row"><input type="text" data-act="free" data-k="' + k + '" data-i="' + i + '" value="' + esc(arr[i] || '') + '" placeholder="具體事實 ' + (i + 1) + '（每項＋' + it.points + '）"></div>');
      return '<div class="item"><div class="q"><span class="n">' + it.n + '.</span> ' + esc(it.text) + '</div>' + rows.join('') + '</div>';
    }
    if (it.type === 'penalty') {
      const p = a.penalties[k] || {};
      return '<div class="item' + (p.checked ? ' critical-hit' : '') + '"><label class="chk"><input type="checkbox" data-act="pen" data-k="' + k + '"' + (p.checked ? ' checked' : '') + '>' +
        '<span class="q" style="margin:0"><span class="n">' + it.n + '.</span> ' + esc(it.text) + ' <b style="color:var(--red)">−' + it.points + '</b></span></label>' +
        '<div class="reason"><input type="text" data-act="pennote" data-k="' + k + '" value="' + esc(p.note || '') + '" placeholder="說明（品項 / 日期）"></div>' +
        photoStrip(k) + '</div>';
    }
    return '';
  }

  function card(k, flagged, prompt, inner, extraCls) {
    const cls = 'item' + (flagged ? ' flag' : '') + (extraCls ? ' ' + extraCls : '');
    return '<div class="' + cls + '" data-item="' + k + '">' + inner + '</div>';
  }

  // 缺失佐證區：flagged 時展開，否則隱藏（但有內容仍顯示）
  function detailBlock(form, cat, it, k, flagged) {
    const a = state.inspection.answers;
    const has = (a.reasons[k] && a.reasons[k].length) || (a.photos[k] && a.photos[k].length);
    const show = flagged || has;
    return '<div class="detail" data-detail="' + k + '"' + (show ? '' : ' style="display:none"') + '>' +
      '<div class="reason"><textarea data-act="reason" data-k="' + k + '" placeholder="扣分原因簡述">' + esc(a.reasons[k] || '') + '</textarea></div>' +
      photoStrip(k) + '</div>';
  }

  function photoStrip(k) {
    const arr = (state.inspection.answers.photos[k]) || [];
    const thumbs = arr.map(p => '<div class="photo-thumb"><img src="' + p.thumb + '"><button class="x" data-act="rmphoto" data-k="' + k + '" data-id="' + p.id + '">✕</button></div>').join('');
    return '<div class="photos" data-strip="' + k + '">' + thumbs +
      '<button class="add-photo" data-act="addphoto" data-k="' + k + '"><span class="ic">📷</span>加照片</button></div>';
  }

  /* ============ 事件 ============ */
  function bindFormEvents(root, form) {
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const act = b.dataset.act, k = b.dataset.k, a = state.inspection.answers;
      if (act === 'score' || act === 'crit') {
        const val = Number(b.dataset.v); a.scores[k] = (a.scores[k] === val && act === 'score') ? a.scores[k] : val;
        a.scores[k] = val;
        refreshItem(k); updateScoreUI(); scheduleSave();
      } else if (act === 'addphoto') { openPhotoPicker(k); }
      else if (act === 'rmphoto') {
        a.photos[k] = (a.photos[k] || []).filter(p => p.id !== b.dataset.id);
        refreshStrip(k); scheduleSave();
      }
    });
    root.addEventListener('change', e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const act = b.dataset.act, k = b.dataset.k, a = state.inspection.answers;
      if (act === 'bonus') { a.bonuses[k] = b.checked; updateScoreUI(); scheduleSave(); }
      else if (act === 'pen') {
        a.penalties[k] = a.penalties[k] || {}; a.penalties[k].checked = b.checked;
        const item = b.closest('.item'); if (item) item.classList.toggle('critical-hit', b.checked);
        updateScoreUI(); scheduleSave();
      }
    });
    root.addEventListener('input', e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const act = b.dataset.act, k = b.dataset.k, a = state.inspection.answers;
      if (act === 'reason') { a.reasons[k] = b.value; scheduleSave(); }
      else if (act === 'pennote') { a.penalties[k] = a.penalties[k] || {}; a.penalties[k].note = b.value; scheduleSave(); }
      else if (act === 'free') {
        a.freeBonuses[k] = a.freeBonuses[k] || []; a.freeBonuses[k][Number(b.dataset.i)] = b.value;
        updateScoreUI(); scheduleSave();
      }
    });
  }

  // 只重繪單一 item（避免整頁重繪、保留捲動）
  function refreshItem(k) {
    const node = document.querySelector('[data-item="' + k + '"]'); if (!node) return;
    const info = findItem(k); if (!info) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = itemHTML(info.form, info.cat, info.it);
    node.replaceWith(tmp.firstElementChild);
  }
  function refreshStrip(k) {
    const strip = document.querySelector('[data-strip="' + k + '"]');
    if (strip) { const tmp = document.createElement('div'); tmp.innerHTML = photoStrip(k); strip.replaceWith(tmp.firstElementChild); }
    const det = document.querySelector('[data-detail="' + k + '"]');
    if (det && det.style.display === 'none') det.style.display = '';
  }
  function findItem(k) {
    const [fid, cid, n] = k.split('.');
    const form = Q.FORMS.find(f => f.id === fid); if (!form) return null;
    const cat = form.categories.find(c => c.id === cid); if (!cat) return null;
    const it = cat.items.find(i => String(i.n) === n); if (!it) return null;
    return { form, cat, it };
  }

  /* ============ 照片選取 ============ */
  let photoTargetKey = null;
  function ensurePhotoInput() {
    if (document.getElementById('photoInput')) return;
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.setAttribute('capture', 'environment');
    inp.multiple = true; inp.id = 'photoInput'; inp.className = 'hidden';
    inp.onchange = () => {
      const files = [].slice.call(inp.files); inp.value = '';
      if (!files.length || !photoTargetKey) return;
      const k = photoTargetKey; const a = state.inspection.answers;
      a.photos[k] = a.photos[k] || [];
      Promise.all(files.map(f => PH.process(f))).then(results => {
        results.forEach(r => a.photos[k].push(r));
        refreshStrip(k); ST.saveDraft(state.inspection);
      });
    };
    document.body.appendChild(inp);
  }
  function openPhotoPicker(k) { photoTargetKey = k; const inp = document.getElementById('photoInput'); if (inp) inp.click(); }

  /* ============ 分數列 / 頁籤徽章 ============ */
  function updateScoreUI() {
    const r = SC.computeAll(state.inspection.answers);
    const form = Q.FORMS.find(f => f.id === state.activeForm);
    const fr = r.byForm[state.activeForm];
    const sb = document.getElementById('scorebar');
    const fmt = v => (v == null ? '未評' : v);
    if (sb) {
      if (form.standalone) {
        sb.innerHTML = '<span>本表（' + esc(form.name) + '）</span><span class="big">' + fmt(fr.scoreRounded) + '</span>' +
          '<span class="grade">' + r.managementGrade + '</span><span class="spacer"></span>' +
          '<span>經營評鑑 ' + fmt(r.managementScore) + '（' + r.managementGrade + '）</span>';
      } else {
        sb.innerHTML = '<span>本表 ' + esc(form.name) + '</span><span class="big">' + fmt(fr.scoreRounded) + '</span>' +
          '<span class="spacer"></span><span>營運總分</span><span class="big">' + fmt(r.operationalScore) + '</span>' +
          '<span class="grade">' + r.operationalGrade + '</span>';
      }
    }
    // 頁籤缺失數徽章
    Q.FORMS.forEach(f => {
      const badge = document.querySelector('[data-badge="' + f.id + '"]');
      if (!badge) return;
      const n = countDeficiencies(f, r.byForm[f.id]);
      if (n > 0) { badge.textContent = n; badge.classList.remove('hidden'); } else badge.classList.add('hidden');
    });
  }

  function countDeficiencies(form, fr) {
    const a = state.inspection.answers; let n = 0;
    form.categories.forEach(cat => {
      if (cat.role === 'scored') cat.items.forEach(it => {
        const v = a.scores[key(form.id, cat.id, it.n)];
        if (v != null && v < 5) n++;
      });
      else if (cat.role === 'penalty') cat.items.forEach(it => { const p = a.penalties[key(form.id, cat.id, it.n)]; if (p && p.checked) n++; });
    });
    return n;
  }

  /* ============ 報告 ============ */
  function renderReport() {
    const mode = state.reportMode || 'edit';
    RP.render(app, state, {
      mode: mode,
      onBack: () => {
        if (mode === 'history') { state.reportMode = null; state.inspection = null; go('start'); }
        else go('inspect');
      },
      onSubmit: doSubmit,
      onMetaChange: () => scheduleSave(),
    });
  }

  function doSubmit() {
    const insp = state.inspection;
    const box = showProgress();
    ST.submit(insp, (i, total) => box.update(i, total)).then(res => {
      box.close();
      toast('已送出 ✓ 照片 ' + res.count + ' 張');
      setTimeout(() => { state.inspection = null; go('start'); }, 1200);
    });
  }

  /* ============ 小工具 ============ */
  function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 1800);
  }
  function showProgress() {
    const wrap = document.createElement('div'); wrap.className = 'progress-wrap';
    wrap.innerHTML = '<div class="progress-box"><div id="pgTxt">準備上傳…</div><div class="bar"><i id="pgBar"></i></div></div>';
    document.body.appendChild(wrap);
    return {
      update(i, total) { document.getElementById('pgTxt').textContent = total ? ('上傳照片 ' + i + ' / ' + total) : '送出中…'; document.getElementById('pgBar').style.width = total ? (i / total * 100) + '%' : '100%'; },
      close() { wrap.remove(); },
    };
  }

  /* ============ 啟動 ============ */
  state = { passcodeOk: false, screen: 'login', activeForm: Q.FORMS[0].id, inspection: null, reportMode: null };
  render();
  window.MDSSL_APP = { state: () => state, go };
})();

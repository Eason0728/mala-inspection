/* 麻的🔥小辛辣 營運巡檢 App — 資料層
 * 草稿一律存本機 IndexedDB（照片以 Blob 存）。送出/歷史依 config.MODE：
 *   local → 存本機（測流程）；cloud → 打 Apps Script 後端。
 * 對外 API 兩種模式一致：auth / saveDraft / loadDraft / listDrafts / deleteDraft /
 *   submit / listSubmitted / getSubmitted。
 */
(function (global) {
  'use strict';

  const CFG = global.MDSSL_CONFIG || { MODE: 'local', LOCAL_PASSCODE: '1688' };
  const Q = global.MDSSL_QUESTIONS, SC = global.MDSSL_SCORING, PH = global.MDSSL_PHOTOS;
  const DB_NAME = 'mdssl-inspection', DB_VER = 1;
  let _passcode = '';

  /* ---------- 本機儲存：優先 IndexedDB，不可用時退回記憶體 ----------
   * 直接以 file:// 開單檔、或 Safari 私密視窗封鎖 IndexedDB 時，
   * 自動退回記憶體（流程照跑，只是不跨重整保存）。 */
  let _useIDB = null, _db = null;
  const _mem = { drafts: {}, submitted: {} };
  const _ready = new Promise(function (resolve) {
    try {
      if (!global.indexedDB) { _useIDB = false; return resolve(); }
      const req = global.indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function (e) {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('drafts')) d.createObjectStore('drafts', { keyPath: 'inspectionId' });
        if (!d.objectStoreNames.contains('submitted')) d.createObjectStore('submitted', { keyPath: 'inspectionId' });
      };
      req.onsuccess = function () { _db = req.result; _useIDB = true; resolve(); };
      req.onerror = function () { _useIDB = false; resolve(); };
      req.onblocked = function () { _useIDB = false; resolve(); };
    } catch (e) { _useIDB = false; resolve(); }
  });
  function idbTx(store, mode) { return _db.transaction(store, mode).objectStore(store); }
  function kvPut(store, obj) {
    return _ready.then(function () {
      if (!_useIDB) { _mem[store][obj.inspectionId] = obj; return true; }
      return new Promise(function (res, rej) { const t = _db.transaction(store, 'readwrite'); t.objectStore(store).put(obj); t.oncomplete = function () { res(true); }; t.onerror = function () { rej(t.error); }; });
    });
  }
  function kvGet(store, id) {
    return _ready.then(function () {
      if (!_useIDB) return _mem[store][id];
      return new Promise(function (res, rej) { const r = idbTx(store, 'readonly').get(id); r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; });
    });
  }
  function kvGetAll(store) {
    return _ready.then(function () {
      if (!_useIDB) return Object.keys(_mem[store]).map(function (k) { return _mem[store][k]; });
      return new Promise(function (res, rej) { const r = idbTx(store, 'readonly').getAll(); r.onsuccess = function () { res(r.result || []); }; r.onerror = function () { rej(r.error); }; });
    });
  }
  function kvDel(store, id) {
    return _ready.then(function () {
      if (!_useIDB) { delete _mem[store][id]; return true; }
      return new Promise(function (res, rej) { const t = _db.transaction(store, 'readwrite'); t.objectStore(store).delete(id); t.oncomplete = function () { res(true); }; t.onerror = function () { rej(t.error); }; });
    });
  }

  function newId() {
    const d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + '-' + Math.random().toString(36).slice(2, 6);
  }
  function isCloud() { return CFG.MODE === 'cloud' && CFG.APPS_SCRIPT_URL; }
  // 試算表會把 "2026-09-02" 自動轉成日期物件，回來變 ISO 字串；取回日期部分
  function fmtDate(v) { if (v == null) return ''; const m = String(v).match(/^(\d{4}-\d{2}-\d{2})/); return m ? m[1] : String(v); }

  /* ---------- 後端呼叫 ---------- */
  function api(payload) {
    payload.passcode = _passcode;
    return fetch(CFG.APPS_SCRIPT_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload), redirect: 'follow',
    }).then(function (r) { return r.json(); });
  }

  /* ---------- 序列化（前端狀態 → 後端格式） ---------- */
  function serialize(insp) {
    const r = SC.computeAll(insp.answers);
    const summary = {
      service: r.byForm.service.scoreRounded, serviceBonus: r.byForm.service.bonus.total,
      environment: r.byForm.environment.scoreRounded, food: r.byForm.food.scoreRounded,
      penalty: r.penaltyTotal, operational: r.operationalScore, operationalGrade: r.operationalGrade,
      management: r.managementScore, managementBonus: r.byForm.management.bonus.total, managementGrade: r.managementGrade,
    };
    const details = [];
    Q.FORMS.forEach(function (f) {
      f.categories.forEach(function (c) {
        if (c.role === 'scored') c.items.forEach(function (it) {
          const k = f.id + '.' + c.id + '.' + it.n, v = insp.answers.scores[k];
          details.push({ itemKey: k, form: f.name, cat: c.name, n: it.n, text: it.text.split('\n')[0], score: (v == null ? '' : v), reason: (insp.answers.reasons[k] || '') });
        });
        else if (c.role === 'penalty') c.items.forEach(function (it) {
          const k = f.id + '.' + c.id + '.' + it.n, p = insp.answers.penalties[k];
          details.push({ itemKey: k, form: f.name, cat: c.name, n: it.n, text: it.text, score: (p && p.checked ? '發生' : ''), reason: (p && p.note) || '' });
        });
        else if (c.role === 'bonus') c.items.forEach(function (it) {
          const k = f.id + '.' + c.id + '.' + it.n;
          if (it.type === 'bonus') { if (insp.answers.bonuses[k]) details.push({ itemKey: k, form: f.name, cat: c.name, n: it.n, text: it.text.split('\n')[0], score: '達成', reason: '' }); }
          else if (it.type === 'bonus_free') (insp.answers.freeBonuses[k] || []).forEach(function (txt) { if (txt && txt.trim()) details.push({ itemKey: k, form: f.name, cat: c.name, n: it.n, text: it.text.split('\n')[0], score: '加分', reason: txt }); });
        });
      });
    });
    return { summary: summary, details: details };
  }
  function itemType(k) {
    const p = k.split('.'), f = Q.FORMS.find(function (x) { return x.id === p[0]; });
    const c = f && f.categories.find(function (x) { return x.id === p[1]; });
    const it = c && c.items.find(function (x) { return String(x.n) === p[2]; });
    return it ? it.type : 'score';
  }
  function keyMeta(k) {
    const p = k.split('.'), f = Q.FORMS.find(function (x) { return x.id === p[0]; });
    const c = f && f.categories.find(function (x) { return x.id === p[1]; });
    return { form: f ? f.name : p[0], cat: c ? c.name : p[1], n: p[2] };
  }
  function photosForUpload(insp) {
    const out = [], ph = insp.answers.photos || {};
    Object.keys(ph).forEach(function (k) {
      (ph[k] || []).forEach(function (p, idx) { out.push({ itemKey: k, photo: p, filename: k.replace(/\./g, '-') + '-' + (idx + 1) + '.jpg' }); });
    });
    return out;
  }
  // 後端 get 回傳 → 前端狀態（歷史唯讀報告用）
  function deserialize(resp) {
    const m = resp.master || {}, details = resp.details || [], photos = resp.photos || [];
    const answers = { scores: {}, bonuses: {}, freeBonuses: {}, penalties: {}, reasons: {}, photos: {} };
    details.forEach(function (d) {
      const k = d['項目鍵'], score = d['分數'], reason = d['扣分原因'], type = itemType(k);
      if (type === 'penalty') { if (String(score) === '發生') answers.penalties[k] = { checked: true, note: reason || '' }; }
      else if (type === 'bonus') answers.bonuses[k] = true;
      else if (type === 'bonus_free') { answers.freeBonuses[k] = answers.freeBonuses[k] || []; if (reason) answers.freeBonuses[k].push(reason); }
      else { if (score !== '' && score != null) answers.scores[k] = Number(score); if (reason) answers.reasons[k] = reason; }
    });
    photos.forEach(function (p) {
      const k = p['項目鍵']; answers.photos[k] = answers.photos[k] || [];
      answers.photos[k].push({ id: p['連結'], thumb: p['連結'], url: p['連結'] });
    });
    return {
      inspectionId: m['巡檢ID'], store: m['店名'], date: fmtDate(m['巡檢日期']), inspector: m['巡檢人'],
      answers: answers, meta: { compareLast: m['較上次'], note: m['溝通事項'] },
      submittedAt: m['送出時間'], status: '已送出',
    };
  }

  function uploadPhotos(insp, photos, onProgress) {
    let i = 0;
    function next() {
      if (onProgress) onProgress(i, photos.length);
      if (i >= photos.length) return Promise.resolve();
      const ph = photos[i], meta = keyMeta(ph.itemKey);
      return PH.blobToDataURL(ph.photo.blob).then(function (dataUrl) {
        return api({ action: 'photo', inspectionId: insp.inspectionId, store: insp.store, date: insp.date, itemKey: ph.itemKey, form: meta.form, cat: meta.cat, n: meta.n, filename: ph.filename, dataUrl: dataUrl });
      }).then(function () { i++; return next(); });
    }
    return next();
  }

  function collectPhotosLocal(state) {
    const out = [], ph = (state.answers && state.answers.photos) || {};
    Object.keys(ph).forEach(function (k) { (ph[k] || []).forEach(function (p) { out.push(p); }); });
    return out;
  }

  const Store = {
    newId: newId,
    setPasscode: function (p) { _passcode = p; },

    auth: function (passcode) {
      _passcode = passcode;
      if (!isCloud()) return Promise.resolve(String(passcode) === String(CFG.LOCAL_PASSCODE));
      return api({ action: 'auth' }).then(function (r) { return !!(r && r.ok); }).catch(function () { return false; });
    },

    /* 草稿一律本機 */
    saveDraft: function (state) { state.updatedAt = Date.now(); return kvPut('drafts', state); },
    loadDraft: function (id) { return kvGet('drafts', id); },
    listDrafts: function () { return kvGetAll('drafts').then(function (a) { return (a || []).sort(function (x, y) { return (y.updatedAt || 0) - (x.updatedAt || 0); }); }); },
    deleteDraft: function (id) { return kvDel('drafts', id); },

    /* 送出 */
    submit: function (state, onProgress) {
      if (isCloud()) {
        const ser = serialize(state), photos = photosForUpload(state);
        return api({
          action: 'submit',
          inspection: { inspectionId: state.inspectionId, store: state.store, date: state.date, inspector: state.inspector, compareLast: state.meta.compareLast, note: state.meta.note },
          summary: ser.summary, details: ser.details,
        }).then(function (res) {
          if (!res.ok) throw new Error(res.error || '送出失敗');
          return uploadPhotos(state, photos, onProgress);
        }).then(function () {
          return api({ action: 'finalize', inspectionId: state.inspectionId });
        }).then(function () {
          return Store.deleteDraft(state.inspectionId);
        }).then(function () { return { inspectionId: state.inspectionId, count: photos.length }; });
      }
      // 本機模擬：逐張「上傳」後搬到 submitted
      return new Promise(function (resolve) {
        const photos = collectPhotosLocal(state); let i = 0;
        (function step() {
          if (onProgress) onProgress(i, photos.length);
          if (i < photos.length) { i++; setTimeout(step, 120); return; }
          state.status = '已送出'; state.submittedAt = Date.now();
          kvPut('submitted', state)
            .then(function () { return Store.deleteDraft(state.inspectionId); })
            .then(function () { resolve({ inspectionId: state.inspectionId, count: photos.length }); });
        })();
      });
    },

    /* 歷史清單（正規化：inspectionId/store/date/operational/… ） */
    listSubmitted: function (filter) {
      filter = filter || {};
      if (isCloud()) {
        return api({ action: 'list', store: filter.store, month: filter.month }).then(function (r) {
          return (r && r.ok && r.list) ? r.list.map(function (x) {
            return { inspectionId: x.inspectionId, store: x.store, date: fmtDate(x.date), operational: x.operational, operationalGrade: x.operationalGrade, management: x.management, managementGrade: x.managementGrade };
          }) : [];
        });
      }
      return kvGetAll('submitted').then(function (arr) {
        return (arr || []).sort(function (a, b) { return (b.submittedAt || 0) - (a.submittedAt || 0); }).map(function (d) {
          const r = SC.computeAll(d.answers);
          return { inspectionId: d.inspectionId, store: d.store, date: d.date, operational: r.operationalScore, operationalGrade: r.operationalGrade, management: r.managementScore, managementGrade: r.managementGrade };
        });
      });
    },

    /* 取單筆完整內容（供歷史唯讀報告） */
    getSubmitted: function (id) {
      if (isCloud()) return api({ action: 'get', inspectionId: id }).then(function (r) { return r && r.ok ? deserialize(r) : null; });
      return kvGet('submitted', id);
    },
  };

  global.MDSSL_STORE = Store;
})(typeof window !== 'undefined' ? window : globalThis);

/* 麻的🔥小辛辣 營運巡檢 App — 算分引擎（純函式）
 * 公式見 docs/spec.md 第 4 節。
 *
 * answers 結構：
 *   scores:      { 'form.cat.n': 0..5 }        // score/critical/binary 題
 *   bonuses:     { 'form.cat.n': true }        // bonus 題打勾
 *   freeBonuses: { 'form.cat.n': ['事實1',..] } // bonus_free 自由填寫
 *   penalties:   { 'form.cat.n': {checked:true, note:''} } // 加重扣分
 * 未作答的題：critical 預設 5（正常/未發生），其餘預設 0。
 */
(function (global) {
  'use strict';

  const Q = global.MDSSL_QUESTIONS;
  const FORMS = Q.FORMS;
  const GRADE_BANDS = Q.GRADE_BANDS;

  function itemKey(formId, catId, n) { return formId + '.' + catId + '.' + n; }

  // 沒評=不計分：只算「實際評過」的項目（含重大缺失，需明確點選正常/發生才算評過）
  function computeCategory(form, cat, ans) {
    const scores = ans.scores || {};
    let sum = 0, answered = 0;
    cat.items.forEach(function (it) {
      const k = itemKey(form.id, cat.id, it.n);
      if (k in scores && scores[k] != null) { sum += Number(scores[k]); answered++; }
    });
    const max = answered * 5;
    return { id: cat.id, name: cat.name, weight: cat.weight, sum: sum, answered: answered, max: max, ratio: answered ? sum / max : null };
  }

  function computeBonus(form, ans) {
    let total = 0; const detail = [];
    form.categories.filter(function (c) { return c.role === 'bonus'; }).forEach(function (cat) {
      cat.items.forEach(function (it) {
        const k = itemKey(form.id, cat.id, it.n);
        if (it.type === 'bonus') {
          if (ans.bonuses && ans.bonuses[k]) { total += it.points; detail.push({ key: k, points: it.points, text: it.text }); }
        } else if (it.type === 'bonus_free') {
          const arr = (ans.freeBonuses && ans.freeBonuses[k]) || [];
          arr.filter(function (s) { return s && s.trim(); }).slice(0, it.max).forEach(function (s) {
            total += it.points; detail.push({ key: k, points: it.points, text: s });
          });
        }
      });
    });
    return { total: total, detail: detail };
  }

  function computePenalty(form, ans) {
    let total = 0; const detail = [];
    form.categories.filter(function (c) { return c.role === 'penalty'; }).forEach(function (cat) {
      cat.items.forEach(function (it) {
        const k = itemKey(form.id, cat.id, it.n);
        const p = ans.penalties && ans.penalties[k];
        if (p && p.checked) { total += it.points; detail.push({ key: k, points: it.points, text: it.text, note: (p.note || '') }); }
      });
    });
    return { total: total, detail: detail };
  }

  function round1(x) { return Math.round(x * 10) / 10; }

  function computeForm(form, ans) {
    ans = ans || {};
    const cats = form.categories.filter(function (c) { return c.role === 'scored'; })
      .map(function (c) { return computeCategory(form, c, ans); });
    const answeredCats = cats.filter(function (c) { return c.ratio !== null; });
    const bonus = computeBonus(form, ans);
    const penalty = computePenalty(form, ans);
    // 只用「評過」的分類算加權，權重按評過的重新正規化；一項都沒評→未評(null)
    let base = null, score = null;
    if (answeredCats.length) {
      const wsum = answeredCats.reduce(function (s, c) { return s + c.weight; }, 0);
      base = answeredCats.reduce(function (s, c) { return s + c.ratio * c.weight; }, 0) / wsum * 100;
      score = base + bonus.total;
    }
    return {
      formId: form.id, categories: cats, base: base,
      bonus: bonus, penalty: penalty, evaluated: answeredCats.length > 0,
      score: score, scoreRounded: score == null ? null : round1(score),
    };
  }

  function gradeOf(score) {
    for (let i = 0; i < GRADE_BANDS.length; i++) {
      if (score >= GRADE_BANDS[i].min) return GRADE_BANDS[i].grade;
    }
    return '未達';
  }

  function computeAll(ans) {
    ans = ans || {};
    const byForm = {};
    FORMS.forEach(function (f) { byForm[f.id] = computeForm(f, ans); });

    const op = FORMS.filter(function (f) { return f.inOperational; });
    const evaluated = op.filter(function (f) { return byForm[f.id].evaluated; });
    const penaltyTotal = op.reduce(function (s, f) { return s + byForm[f.id].penalty.total; }, 0);

    // 營運總分＝已評的表(服務/環境/菜色)平均 − 加重扣分；都沒評→未評(null)
    let operationalScore = null, operationalGrade = '未評';
    if (evaluated.length) {
      const avg = evaluated.reduce(function (s, f) { return s + byForm[f.id].score; }, 0) / evaluated.length;
      operationalScore = round1(avg - penaltyTotal);
      operationalGrade = gradeOf(operationalScore);
    }

    const mg = byForm['management'];
    const managementScore = mg.evaluated ? round1(mg.score) : null;
    const managementGrade = mg.evaluated ? gradeOf(managementScore) : '未評';

    return {
      byForm: byForm,
      operationalScore: operationalScore,
      operationalGrade: operationalGrade,
      penaltyTotal: penaltyTotal,
      managementScore: managementScore,
      managementGrade: managementGrade,
    };
  }

  const api = { itemKey: itemKey, computeForm: computeForm, computeAll: computeAll, gradeOf: gradeOf, round1: round1 };
  global.MDSSL_SCORING = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

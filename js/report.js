/* 麻的🔥小辛辣 營運巡檢 App — 報告畫面 + 存成圖片 + 列印/PDF */
(function (global) {
  'use strict';
  const Q = global.MDSSL_QUESTIONS, SC = global.MDSSL_SCORING;

  function key(f, c, n) { return f + '.' + c + '.' + n; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  function collectDeficiencies(state) {
    const a = state.inspection.answers; const out = [];
    Q.FORMS.forEach(form => {
      form.categories.forEach(cat => {
        cat.items.forEach(it => {
          const k = key(form.id, cat.id, it.n);
          let hit = false, tag = '', scoreTxt = '';
          if (cat.role === 'scored' && (it.type === 'score' || it.type === 'binary')) {
            const v = a.scores[k]; if (v != null && v < 5) { hit = true; scoreTxt = v + '分'; }
          } else if (it.type === 'critical') {
            if (a.scores[k] === 0) { hit = true; tag = '重大缺失'; scoreTxt = '0分'; }
          } else if (it.type === 'penalty') {
            const p = a.penalties[k]; if (p && p.checked) { hit = true; tag = '加重扣分 −' + it.points; }
          }
          if (!hit) return;
          out.push({
            form: form.name, cat: cat.name, n: it.n, text: it.text.split('\n')[0],
            tag: tag, scoreTxt: scoreTxt,
            reason: (a.reasons[k] || (a.penalties[k] && a.penalties[k].note) || ''),
            photos: (a.photos[k] || []),
          });
        });
      });
    });
    return out;
  }

  function gradeLabel(g) { return !g ? '' : (g === '未評' ? '未評' : g + ' 級'); }
  function scoreCard(lbl, val, grade) {
    const v = (val == null ? '未評' : val);
    return '<div class="sc"><div class="lbl">' + esc(lbl) + '</div><div class="v">' + v + '</div>' +
      (grade ? '<div class="g">' + gradeLabel(grade) + '</div>' : '') + '</div>';
  }

  function render(app, state, opts) {
    const insp = state.inspection;
    const mode = opts.mode || 'edit'; // 'edit' | 'history'
    const r = SC.computeAll(insp.answers);
    const defs = collectDeficiencies(state);

    const defsHTML = defs.length ? defs.map(d =>
      '<div class="def"><div class="t">' + (d.tag ? '<span class="tag">' + esc(d.tag) + '</span>' : '') +
      '<b>【' + esc(d.form) + '·' + esc(d.cat) + '】</b> ' + esc(d.n) + '. ' + esc(d.text) +
      (d.scoreTxt ? ' <span style="color:var(--red-dark);font-weight:700">' + d.scoreTxt + '</span>' : '') + '</div>' +
      (d.reason ? '<div class="rs">原因：' + esc(d.reason) + '</div>' : '') +
      (d.photos.length ? '<div class="imgs">' + d.photos.map(p => '<img src="' + p.thumb + '">').join('') + '</div>' : '') +
      '</div>').join('') : '<div class="empty">本次巡檢無扣分項目 🎉</div>';

    // 較上次 / 溝通事項：編輯模式可改，歷史模式顯示文字
    let metaHTML;
    if (mode === 'history') {
      metaHTML = '<div class="rpt-meta">' +
        '<div class="mrow"><span class="mk">較上次情形</span><span class="mv">' + (esc(insp.meta.compareLast) || '—') + '</span></div>' +
        '<div class="mrow"><span class="mk">本次溝通事項</span><span class="mv">' + (esc(insp.meta.note) || '—') + '</span></div>' +
        '<div class="mrow"><span class="mk">送出時間</span><span class="mv">' + esc(fmtTime(insp.submittedAt)) + '</span></div>' +
        '</div>';
    } else {
      metaHTML = '<div class="rpt-meta">' +
        '<label class="fld" style="margin-top:0">本次門市稽核，較上次情形</label>' +
        '<select id="compareLast"><option value="">— 請選擇 —</option>' +
        ['較差', '未改善', '有改善', '佳'].map(o => '<option' + (insp.meta.compareLast === o ? ' selected' : '') + '>' + o + '</option>').join('') + '</select>' +
        '<label class="fld">本次溝通事項</label><textarea id="note" style="min-height:64px">' + esc(insp.meta.note || '') + '</textarea>' +
        '</div>';
    }

    const actions = mode === 'history'
      ? '<button class="btn secondary" id="imgBtn">存圖片</button><button class="btn secondary" id="printBtn">列印 / PDF</button><button class="btn" id="backBtn">返回</button>'
      : '<button class="btn secondary" id="imgBtn">存圖片</button><button class="btn secondary" id="printBtn">列印 / PDF</button><button class="btn" id="submitBtn">送出</button>';

    app.innerHTML =
      '<div class="brandbar"><span class="flame">🔥</span>巡檢報告<span class="sub" id="back">＜ ' + (mode === 'history' ? '回列表' : '回巡檢') + '</span></div>' +
      '<div class="screen">' +
      '<div id="reportBody" class="report">' +
        '<div class="rpt-head"><h2>' + esc(insp.store) + '店 · 營運巡檢報告</h2>' +
        '<div class="m">日期 ' + esc(insp.date) + '　巡檢人 ' + esc(insp.inspector) + '</div></div>' +
        '<div class="score-cards">' +
          scoreCard('服務', r.byForm.service.scoreRounded, null) +
          scoreCard('環境', r.byForm.environment.scoreRounded, null) +
          scoreCard('菜色', r.byForm.food.scoreRounded, null) +
          scoreCard('經營評鑑', r.managementScore, r.managementGrade) +
          '<div class="sc total"><div class="lbl">營運巡檢總分（服務+環境+菜色平均）− 加重扣分 ' + r.penaltyTotal + '</div>' +
          '<div class="v">' + (r.operationalScore == null ? '未評' : r.operationalScore) + '</div><div class="g">' + gradeLabel(r.operationalGrade) + '</div></div>' +
        '</div>' +
        '<div class="def-list"><div class="section-title">缺失明細（' + defs.length + '）</div>' + defsHTML + '</div>' +
        metaHTML +
      '</div>' +
      '</div>' +
      '<div class="bottombar report-actions">' + actions + '</div>';

    document.getElementById('back').onclick = opts.onBack;
    document.getElementById('imgBtn').onclick = () => exportImage(insp);
    document.getElementById('printBtn').onclick = () => printReport();
    if (mode === 'history') { document.getElementById('backBtn').onclick = opts.onBack; }
    else {
      document.getElementById('compareLast').onchange = e => { insp.meta.compareLast = e.target.value; if (opts.onMetaChange) opts.onMetaChange(); };
      document.getElementById('note').oninput = e => { insp.meta.note = e.target.value; if (opts.onMetaChange) opts.onMetaChange(); };
      document.getElementById('submitBtn').onclick = opts.onSubmit;
    }
  }

  function fmtTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts); const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function exportImage(insp) {
    const node = document.getElementById('reportBody');
    if (!global.html2canvas) { alert('圖片元件載入中，請稍後再試'); return; }
    global.html2canvas(node, { scale: 2, backgroundColor: '#ffffff', useCORS: true }).then(canvas => {
      const a = document.createElement('a');
      a.download = insp.store + '店-' + insp.date + '-巡檢報告.png';
      a.href = canvas.toDataURL('image/png');
      a.click();
    });
  }

  // 列印：瀏覽器列印對話框可選「儲存為 PDF」或送印表機
  function printReport() { window.print(); }

  global.MDSSL_REPORT = { render: render, collectDeficiencies: collectDeficiencies };
})(typeof window !== 'undefined' ? window : globalThis);

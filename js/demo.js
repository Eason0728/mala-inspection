/* 麻的🔥小辛辣 營運巡檢 App — 示範資料產生器（試看完整報告用） */
(function (global) {
  'use strict';
  const Q = global.MDSSL_QUESTIONS, ST = global.MDSSL_STORE;
  function key(f, c, n) { return f + '.' + c + '.' + n; }
  function today() { const d = new Date(); const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }

  // 產生一張「示範照片」佔位圖（柔灰底＋相機圖示＋標籤），看起來像現場照但明確標示示範
  function makePhoto(label) {
    return new Promise(res => {
      const c = document.createElement('canvas'); c.width = 1000; c.height = 750;
      const ctx = c.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, 0, 750);
      g.addColorStop(0, '#e7e5e4'); g.addColorStop(1, '#d6d3d1');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 1000, 750);
      ctx.textAlign = 'center';
      ctx.font = '150px sans-serif'; ctx.fillText('📷', 500, 380);
      ctx.fillStyle = '#57534e'; ctx.font = 'bold 46px "PingFang TC",sans-serif';
      ctx.fillText(label, 500, 470);
      ctx.fillStyle = '#a8a29e'; ctx.font = '30px "PingFang TC",sans-serif';
      ctx.fillText('示範照片', 500, 525);
      const t = document.createElement('canvas'); t.width = 220; t.height = 165;
      t.getContext('2d').drawImage(c, 0, 0, 220, 165);
      const thumb = t.toDataURL('image/jpeg', 0.6);
      c.toBlob(b => res({ id: 'demo-' + Math.random().toString(36).slice(2, 7), blob: b, thumb: thumb, w: 1000, h: 750, size: b.size }), 'image/jpeg', 0.7);
    });
  }

  async function build(store) {
    const insp = {
      inspectionId: ST.newId(), store: store || '光復', date: today(), inspector: '巡店主管',
      answers: { scores: {}, bonuses: {}, freeBonuses: {}, penalties: {}, reasons: {}, photos: {} },
      meta: { compareLast: '有改善', note: '整體表現進步，服務動線流暢；請加強冰箱清潔與門口文宣維護，粉專發文頻率再提升。' },
      status: '草稿', createdAt: Date.now(),
    };
    const a = insp.answers;

    // 先把所有評分項設為滿分（含重大缺失＝正常5、班表＝5）
    Q.FORMS.forEach(f => f.categories.forEach(c => {
      if (c.role === 'scored') c.items.forEach(it => { a.scores[key(f.id, c.id, it.n)] = 5; });
    }));

    // 幾處實際缺失（分數＋原因＋示範照片）
    const defs = [
      ['service', 'basic', 1, 4, '同仁制服有明顯油漬未更換', '制服髒污'],
      ['service', 'thoughtful', 4, 3, '未主動詢問是否加香菜、白芝麻', '未問配料'],
      ['environment', 'facade', 5, 4, '門口海報邊角翹起、略褪色', '海報翹角'],
      ['environment', 'work', 6, 3, '冰箱鰭片與濾網積灰，需清潔', '冰箱積灰'],
      ['food', 'ala_carte', 6, 4, '炸蒜頭色澤偏深，接近焦化', '炸蒜偏深'],
      ['management', 'admin', 8, 4, '本月粉專發文僅一篇，互動偏低', '粉專成效'],
    ];
    for (let i = 0; i < defs.length; i++) {
      const d = defs[i]; const k = key(d[0], d[1], d[2]);
      a.scores[k] = d[3]; a.reasons[k] = d[4];
      a.photos[k] = [await makePhoto(d[5])];
    }

    // 加分項（服務）
    a.bonuses[key('service', 'bonus', 1)] = true;
    a.bonuses[key('service', 'bonus', 2)] = true;
    a.freeBonuses[key('service', 'bonus', 4)] = ['主動協助行動不便長者提餐至座位'];

    return insp;
  }

  global.MDSSL_DEMO = { build: build };
})(typeof window !== 'undefined' ? window : globalThis);

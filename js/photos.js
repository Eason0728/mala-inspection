/* 麻的🔥小辛辣 營運巡檢 App — 照片模組
 * 拍照/選圖 → 壓縮（長邊≤1280、JPEG 0.7）→ Blob + 縮圖 dataURL
 */
(function (global) {
  'use strict';

  const MAX_EDGE = 1280;
  const QUALITY = 0.7;
  const THUMB_EDGE = 200;

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function (e) { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
  }

  function drawScaled(img, maxEdge) {
    let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const scale = Math.min(1, maxEdge / Math.max(w, h));
    w = Math.round(w * scale); h = Math.round(h * scale);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    return c;
  }

  function canvasToBlob(canvas, quality) {
    return new Promise(function (resolve) {
      if (canvas.toBlob) canvas.toBlob(function (b) { resolve(b); }, 'image/jpeg', quality);
      else {
        const data = canvas.toDataURL('image/jpeg', quality);
        const bin = atob(data.split(',')[1]);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        resolve(new Blob([arr], { type: 'image/jpeg' }));
      }
    });
  }

  const Photos = {
    // file → { id, blob, thumb, w, h, size }
    process: function (file) {
      return loadImage(file).then(function (img) {
        const big = drawScaled(img, MAX_EDGE);
        const thumbCanvas = drawScaled(img, THUMB_EDGE);
        const thumb = thumbCanvas.toDataURL('image/jpeg', 0.6);
        return canvasToBlob(big, QUALITY).then(function (blob) {
          return {
            id: 'p-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            blob: blob, thumb: thumb, w: big.width, h: big.height, size: blob.size,
          };
        });
      });
    },
    // Blob → dataURL（報告 / 上傳用）
    blobToDataURL: function (blob) {
      return new Promise(function (resolve) {
        const r = new FileReader();
        r.onload = function () { resolve(r.result); };
        r.readAsDataURL(blob);
      });
    },
  };

  global.MDSSL_PHOTOS = Photos;
})(typeof window !== 'undefined' ? window : globalThis);

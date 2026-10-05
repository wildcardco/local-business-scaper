function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}

const SLOT_STYLE = `<style id="wc-studio-slot-style">
img[data-photo-query]:not([src]),
img[data-photo-query][src=""],
img[data-photo-slot]:not([src]),
img[data-photo-slot][src=""],
figure[data-photo-query]:not(:has(img[src^="http"])),
figure[data-photo-slot]:not(:has(img[src^="http"])) {
  min-height: 180px;
  background: #201F25;
}
img[data-photo-query]:not([src]),
img[data-photo-query][src=""],
img[data-photo-slot]:not([src]),
img[data-photo-slot][src=""] {
  display: block;
  width: 100%;
}
</style>`

function slotScript(parentOrigin: string): string {
  const origin = JSON.stringify(parentOrigin)
  return `<script id="wc-studio-slots">
(function () {
  var PARENT = ${origin};
  var layer = document.createElement('div');
  layer.id = 'wc-studio-slot-layer';
  layer.setAttribute('style', 'position:fixed;inset:0;z-index:2147483646;pointer-events:none;');
  var state = { activeIndex: null, assignments: {}, armed: false };
  function root() { return document.body || document.documentElement; }
  function list() {
    return Array.prototype.slice.call(document.querySelectorAll('[data-photo-slot], [data-photo-query]'));
  }
  function slotKey(el) {
    return String(el.getAttribute('data-photo-slot') || '').replace(/\\s+/g, ' ').trim();
  }
  function phrase(el) {
    var query = String(el.getAttribute('data-photo-query') || '').replace(/\\s+/g, ' ').trim();
    if (query) return query;
    return slotName(slotKey(el));
  }
  function slotName(key) {
    return String(key || '').split(/[-_\\s]+/).filter(Boolean).map(function (part) {
      if (/^\\d+$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }).join(' ');
  }
  function labelText(el, index) {
    var key = slotKey(el);
    var query = String(el.getAttribute('data-photo-query') || '').replace(/\\s+/g, ' ').trim();
    if (key) {
      var name = slotName(key);
      if (!query || query.toLowerCase() === name.toLowerCase()) return name;
      return name + ' · ' + query;
    }
    return (index === 0 ? 'Hero · ' : 'Slot ' + (index + 1) + ' · ') + phrase(el);
  }
  function directSrc(el) {
    if (!el || String(el.tagName).toUpperCase() !== 'IMG') return '';
    return String(el.getAttribute('src') || '');
  }
  function currentSrc(el) {
    var img = String(el.tagName).toUpperCase() === 'IMG' ? el : el.querySelector('img');
    var src = img ? String(img.getAttribute('src') || '') : '';
    return /^https?:\\/\\//i.test(src) ? src : '';
  }
  function applyUrl(el, url) {
    var img = String(el.tagName).toUpperCase() === 'IMG' ? el : el.querySelector('img');
    if (img) {
      if (!img.getAttribute('data-studio-original')) img.setAttribute('data-studio-original', directSrc(img));
      img.setAttribute('src', url);
      return;
    }
    el.style.backgroundImage = 'url("' + String(url).replace(/"/g, '') + '")';
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
  }
  function restore(el) {
    var img = String(el.tagName).toUpperCase() === 'IMG' ? el : el.querySelector('img');
    if (!img || !img.hasAttribute('data-studio-original')) return;
    img.setAttribute('src', img.getAttribute('data-studio-original') || '');
  }
  function report() {
    var slots = list().map(function (el, index) {
      return { index: index, query: phrase(el), slot: slotKey(el) || undefined, open: !currentSrc(el) };
    });
    parent.postMessage({ source: 'studio-preview', type: 'slots', slots: slots }, PARENT);
  }
  function paint() {
    if (!layer.parentNode) root().appendChild(layer);
    var nodes = list();
    layer.textContent = '';
    nodes.forEach(function (el, index) {
      var assigned = state.assignments[index] || state.assignments[String(index)] || '';
      if (assigned && /^https?:\\/\\//i.test(assigned)) applyUrl(el, assigned);
      else restore(el);
      var rect = el.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) return;
      var open = !currentSrc(el);
      var active = state.activeIndex === index;
      var box = document.createElement('button');
      box.type = 'button';
      box.setAttribute('data-studio-slot', String(index));
      var named = slotKey(el) ? slotName(slotKey(el)) : '';
      var text = labelText(el, index);
      box.textContent = open || active || assigned ? text : (named || (index === 0 ? 'Hero' : 'Slot ' + (index + 1)));
      box.setAttribute('style', [
        'position:absolute',
        'pointer-events:auto',
        'box-sizing:border-box',
        'left:' + rect.left + 'px',
        'top:' + rect.top + 'px',
        'width:' + rect.width + 'px',
        'height:' + rect.height + 'px',
        'border:' + (active ? '3px solid #D6293E' : '2px solid #C9A227'),
        'background:' + (open ? 'rgba(26,26,26,0.55)' : 'transparent'),
        'color:#F2F2F0',
        'font:600 13px/1.35 system-ui,sans-serif',
        'text-align:left',
        'padding:8px 10px',
        'cursor:' + (state.armed ? 'copy' : 'pointer'),
        'overflow:hidden',
        'text-shadow:0 1px 2px #1A1A1A'
      ].join(';'));
      box.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        parent.postMessage({ source: 'studio-preview', type: 'pick', index: index }, PARENT);
      });
      box.addEventListener('dragover', function (event) {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      });
      box.addEventListener('drop', function (event) {
        event.preventDefault();
        var url = '';
        if (event.dataTransfer) url = event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text/plain') || '';
        parent.postMessage({ source: 'studio-preview', type: 'drop', index: index, url: url }, PARENT);
      });
      layer.appendChild(box);
    });
  }
  window.addEventListener('message', function (event) {
    if (event.origin !== PARENT) return;
    var data = event.data || {};
    if (data.source !== 'studio-parent' || data.type !== 'paint') return;
    state = {
      activeIndex: typeof data.activeIndex === 'number' ? data.activeIndex : null,
      assignments: data.assignments || {},
      armed: !!data.armed
    };
    paint();
  });
  window.addEventListener('scroll', paint, true);
  window.addEventListener('resize', paint);
  window.addEventListener('load', function () { report(); paint(); });
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    report();
    paint();
  } else {
    document.addEventListener('DOMContentLoaded', function () { report(); paint(); });
  }
  setTimeout(function () { report(); paint(); }, 400);
  setTimeout(paint, 1400);
})();
</script>`
}

export function prepareMockupPreviewHtml(html: string, opts: { pageUrl: string, origin: string }): string {
  let next = html
  if (!/<base\b/i.test(next)) {
    const base = `<base href="${escapeAttr(opts.pageUrl)}">`
    if (/<head\b[^>]*>/i.test(next)) next = next.replace(/<head\b[^>]*>/i, match => `${match}${base}`)
    else next = `${base}${next}`
  }
  if (!next.includes('id="wc-studio-slot-style"')) {
    if (/<head\b[^>]*>/i.test(next)) next = next.replace(/<head\b[^>]*>/i, match => `${match}${SLOT_STYLE}`)
    else next = `${SLOT_STYLE}${next}`
  }
  next = next.replace(/<meta[^>]+http-equiv=["']content-security-policy["'][^>]*>/gi, '')
  const script = slotScript(opts.origin)
  if (/<\/body>/i.test(next)) return next.replace(/<\/body>/i, `${script}</body>`)
  return `${next}${script}`
}

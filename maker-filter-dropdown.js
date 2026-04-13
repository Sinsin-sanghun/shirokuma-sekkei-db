// Excel-style Maker Filter Dropdown
(function () {
  'use strict';

  function waitForReady(cb) {
    if (typeof docsData !== 'undefined' && document.getElementById('toolbar')) {
      cb();
    } else {
      setTimeout(() => waitForReady(cb), 200);
    }
  }

  waitForReady(init);

  function init() {
    injectStyles();
    buildDropdown();
  }

  function injectStyles() {
    const css = `
.maker-dropdown-wrap { position: relative; display: inline-block; margin-left: 6px; vertical-align: middle; }
.maker-dropdown-btn { display: inline-flex; align-items: center; gap: 6px; padding: 5px 14px; font-size: 12px; font-weight: 600; border: 1.5px solid #e67e22; border-radius: 6px; background: #e67e22; color: #fff; cursor: pointer; transition: background .2s; white-space: nowrap; user-select: none; }
.maker-dropdown-btn:hover { background: #cf6d17; border-color: #cf6d17; }
.maker-dropdown-btn .arrow { font-size: 10px; transition: transform .2s; }
.maker-dropdown-btn.open .arrow { transform: rotate(180deg); }
.maker-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 5px; font-size: 10px; font-weight: 700; background: #fff; color: #e67e22; border-radius: 9px; line-height: 1; }
.maker-dropdown-panel { display: none; position: absolute; top: calc(100% + 4px); left: 0; z-index: 9999; min-width: 300px; max-width: 400px; background: #fff; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.15); overflow: hidden; flex-direction: column; }
.maker-dropdown-panel.show { display: flex; }
.maker-search-box { display: flex; align-items: center; padding: 8px 10px; border-bottom: 1px solid #eee; background: #fafafa; }
.maker-search-box input { flex: 1; border: 1px solid #ddd; border-radius: 5px; padding: 6px 10px; font-size: 13px; outline: none; color: #333; background: #fff; }
.maker-search-box input:focus { border-color: #e67e22; box-shadow: 0 0 0 2px rgba(230,126,34,.15); }
.maker-quick-actions { display: flex; gap: 6px; padding: 6px 10px; border-bottom: 1px solid #eee; background: #fafafa; }
.maker-quick-btn { flex: 1; padding: 4px 0; font-size: 11px; font-weight: 600; text-align: center; border: 1px solid #ddd; border-radius: 4px; background: #fff; color: #555; cursor: pointer; }
.maker-quick-btn:hover { background: #f0f0f0; }
.maker-quick-btn.accent { background: #e67e22; color: #fff; border-color: #e67e22; }
.maker-quick-btn.accent:hover { background: #cf6d17; }
.maker-list { max-height: 320px; overflow-y: auto; padding: 4px 0; }
.maker-list::-webkit-scrollbar { width: 6px; }
.maker-list::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }
.maker-item { display: flex; align-items: center; gap: 8px; padding: 6px 12px; cursor: pointer; font-size: 13px; color: #333; }
.maker-item:hover { background: #fef4e8; }
.maker-item input[type="checkbox"] { accent-color: #e67e22; width: 15px; height: 15px; cursor: pointer; }
.maker-item-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.maker-item-count { font-size: 11px; color: #999; }
.maker-item.hidden { display: none; }
.maker-no-result { padding: 16px; text-align: center; color: #aaa; font-size: 13px; }
.maker-applied-tags { display: flex; flex-wrap: wrap; gap: 5px; padding: 4px 16px; }
.maker-tag { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; font-size: 11px; background: #fef4e8; border: 1px solid #f0c78a; color: #b35f00; border-radius: 12px; }
.maker-tag-x { cursor: pointer; font-weight: 700; font-size: 13px; color: #c97a2a; }
.maker-tag-x:hover { color: #e74c3c; }
`;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  function buildDropdown() {
    const toolbar = document.getElementById('toolbar');
    if (!toolbar) return;

    const makerCounts = {};
    docsData.forEach(d => { if (d.m) makerCounts[d.m] = (makerCounts[d.m] || 0) + 1; });
    const allMakers = Object.keys(makerCounts).sort((a, b) => {
      const aJ = /^[^\x00-\x7F]/.test(a), bJ = /^[^\x00-\x7F]/.test(b);
      if (aJ !== bJ) return aJ ? 1 : -1;
      return a.localeCompare(b, 'ja');
    });

    const selectedMakers = new Set();
    toolbar.style.display = 'none';

    const wrap = document.createElement('div');
    wrap.className = 'maker-dropdown-wrap';
    const triggerBtn = document.createElement('button');
    triggerBtn.className = 'maker-dropdown-btn';
    triggerBtn.innerHTML = '\u003cspan\u003eメーカーフィルター\u003c/span\u003e \u003cspan class="maker-badge" id="maker-badge"\u003eALL\u003c/span\u003e \u003cspan class="arrow"\u003e▼\u003c/span\u003e';
    wrap.appendChild(triggerBtn);

    const panel = document.createElement('div');
    panel.className = 'maker-dropdown-panel';
    panel.addEventListener('click', e => e.stopPropagation());

    const searchBox = document.createElement('div');
    searchBox.className = 'maker-search-box';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'メーカー名で検索...';
    searchBox.appendChild(searchInput);
    panel.appendChild(searchBox);

    const actions = document.createElement('div');
    actions.className = 'maker-quick-actions';
    function mkBtn(t, acc) { const b = document.createElement('button'); b.className = 'maker-quick-btn' + (acc ? ' accent' : ''); b.textContent = t; b.type = 'button'; return b; }
    const btnAll = mkBtn('すべて選択', false);
    const btnNone = mkBtn('すべて解除', false);
    const btnApply = mkBtn('適用', true);
    actions.appendChild(btnAll);
    actions.appendChild(btnNone);
    actions.appendChild(btnApply);
    panel.appendChild(actions);

    const list = document.createElement('div');
    list.className = 'maker-list';
    const noResult = document.createElement('div');
    noResult.className = 'maker-no-result';
    noResult.textContent = '該当するメーカーがありません';
    noResult.style.display = 'none';
    list.appendChild(noResult);

    const itemEls = [];
    allMakers.forEach(maker => {
      const item = document.createElement('label');
      item.className = 'maker-item';
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = true; cb.dataset.maker = maker;
      const lbl = document.createElement('span');
      lbl.className = 'maker-item-label'; lbl.textContent = maker;
      const cnt = document.createElement('span');
      cnt.className = 'maker-item-count'; cnt.textContent = '(' + makerCounts[maker] + ')';
      item.appendChild(cb); item.appendChild(lbl); item.appendChild(cnt);
      list.appendChild(item);
      itemEls.push({ el: item, cb, maker });
    });
    panel.appendChild(list);
    wrap.appendChild(panel);

    const tagArea = document.createElement('div');
    tagArea.className = 'maker-applied-tags';

    toolbar.parentElement.insertBefore(wrap, toolbar);
    toolbar.parentElement.insertBefore(tagArea, toolbar.nextSibling);

    triggerBtn.addEventListener('click', e => {
      e.stopPropagation();
      panel.classList.toggle('show');
      triggerBtn.classList.toggle('open');
      if (panel.classList.contains('show')) searchInput.focus();
    });
    document.addEventListener('click', e => { if (!wrap.contains(e.target)) { panel.classList.remove('show'); triggerBtn.classList.remove('open'); } });

    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase().trim();
      let vis = 0;
      itemEls.forEach(({ el, maker }) => { const m = !q || maker.toLowerCase().includes(q); el.classList.toggle('hidden', !m); if (m) vis++; });
      noResult.style.display = vis === 0 ? 'block' : 'none';
    });

    btnAll.addEventListener('click', () => { itemEls.forEach(({ cb, el }) => { if (!el.classList.contains('hidden')) cb.checked = true; }); });
    btnNone.addEventListener('click', () => { itemEls.forEach(({ cb, el }) => { if (!el.classList.contains('hidden')) cb.checked = false; }); });
    btnApply.addEventListener('click', () => { applyFilter(); panel.classList.remove('show'); triggerBtn.classList.remove('open'); });
    searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') { applyFilter(); panel.classList.remove('show'); triggerBtn.classList.remove('open'); } });

    function applyFilter() {
      selectedMakers.clear();
      const allChecked = itemEls.every(({ cb }) => cb.checked);
      const noneChecked = itemEls.every(({ cb }) => !cb.checked);
      if (!allChecked && !noneChecked) {
        itemEls.forEach(({ cb, maker }) => { if (cb.checked) selectedMakers.add(maker); });
      }
      updateBadge(); updateTags();
      toolbar.style.display = 'none';
      const allOrigBtn = Array.from(toolbar.querySelectorAll('.btn-filter')).find(b => b.textContent.trim() === 'すべて');
      if (allOrigBtn) { allOrigBtn.click(); toolbar.style.display = 'none'; }
      setTimeout(() => { toolbar.style.display = 'none'; applyMultiFilter(); }, 50);
    }

    function updateBadge() {
      const badge = document.getElementById('maker-badge');
      badge.textContent = selectedMakers.size === 0 ? 'ALL' : selectedMakers.size;
    }

    function updateTags() {
      tagArea.innerHTML = '';
      if (selectedMakers.size === 0) return;
      selectedMakers.forEach(maker => {
        const tag = document.createElement('span');
        tag.className = 'maker-tag';
        const x = document.createElement('span');
        x.className = 'maker-tag-x';
        x.dataset.m = maker;
        x.innerHTML = '×';
        tag.textContent = maker + ' ';
        tag.appendChild(x);
        tagArea.appendChild(tag);
      });
      tagArea.querySelectorAll('.maker-tag-x').forEach(x => {
        x.addEventListener('click', () => {
          selectedMakers.delete(x.dataset.m);
          itemEls.forEach(({ cb, maker }) => { if (maker === x.dataset.m) cb.checked = false; });
          if (selectedMakers.size === 0) itemEls.forEach(({ cb }) => cb.checked = true);
          updateBadge(); updateTags();
          toolbar.style.display = 'none';
          const a = Array.from(toolbar.querySelectorAll('.btn-filter')).find(b => b.textContent.trim() === 'すべて');
          if (a) { a.click(); toolbar.style.display = 'none'; }
          setTimeout(() => { toolbar.style.display = 'none'; applyMultiFilter(); }, 50);
        });
      });
    }

    function applyMultiFilter() {
      toolbar.style.display = 'none';
      if (selectedMakers.size === 0) return;
      document.querySelectorAll('table tbody tr').forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 3) return;
        row.style.display = selectedMakers.has(cells[2].textContent.trim()) ? '' : 'none';
      });
      document.querySelectorAll('.card-item, .doc-card').forEach(card => {
        const m = card.querySelector('.card-maker, [data-maker]');
        if (!m) return;
        card.style.display = selectedMakers.has(m.dataset.maker || m.textContent.trim()) ? '' : 'none';
      });
    }

    let mt = null;
    const obs = new MutationObserver(() => {
      toolbar.style.display = 'none';
      if (selectedMakers.size > 0) { clearTimeout(mt); mt = setTimeout(() => applyMultiFilter(), 30); }
    });
    const main = document.querySelector('main');
    if (main) obs.observe(main, { childList: true, subtree: true });
  }
})();

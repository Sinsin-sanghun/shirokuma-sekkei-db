// ══════════════════════════════════════
//  Metadata Loader (v2)
//  Fetches model_number / key_specs / purpose / summary from Supabase
//  Exposes: window.getItemMeta(relPath, filename) => {model, specs, purpose, summary} | null
//  Backward-compat: window.getSummary(relPath, filename) => string | null
//  Triggers renderView() after load.
// ══════════════════════════════════════

(function() {
  const SUPABASE_URL = 'https://manowprcyrfqonzdoqja.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hbm93cHJjeXJmcW9uemRvcWphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMTU5NDIsImV4cCI6MjA4ODc5MTk0Mn0.eZ9UHW041t85kLBglI_CK6p0uX5dRVMbWyJO0oR50Kc';

  const byRelPath = new Map();
  const byFilename = new Map();
  let loaded = false;

  function lookup(map, key) {
    if (!key) return null;
    if (map.has(key)) return map.get(key);
    try {
      const dec = decodeURI(key);
      if (map.has(dec)) return map.get(dec);
    } catch (e) {}
    return null;
  }

  // Main API: returns full meta object or null
  window.getItemMeta = function(relPath, filename) {
    if (!loaded) return null;
    return lookup(byRelPath, relPath) || lookup(byFilename, filename);
  };

  // Backward compat: summary only
  window.getSummary = function(relPath, filename) {
    const m = window.getItemMeta(relPath, filename);
    return m ? (m.summary || null) : null;
  };

  async function fetchAll() {
    try {
      const url = SUPABASE_URL + '/rest/v1/sekkei_documents'
        + '?select=filename,relative_path,summary,model_number,key_specs,purpose'
        + '&or=(summary.not.is.null,model_number.not.is.null,key_specs.not.is.null,purpose.not.is.null)';
      const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Accept-Profile': 'public'
      };

      let offset = 0;
      const pageSize = 1000;
      let totalLoaded = 0;
      while (true) {
        const resp = await fetch(url, {
          headers: Object.assign({}, headers, {
            'Range-Unit': 'items',
            'Range': offset + '-' + (offset + pageSize - 1)
          })
        });
        if (!resp.ok) {
          console.warn('[meta-loader] fetch failed:', resp.status);
          break;
        }
        const rows = await resp.json();
        if (!Array.isArray(rows) || rows.length === 0) break;
        rows.forEach(r => {
          const meta = {
            model:   r.model_number || null,
            specs:   r.key_specs || null,
            purpose: r.purpose || null,
            summary: r.summary || null
          };
          if (r.relative_path) byRelPath.set(r.relative_path, meta);
          if (r.filename) byFilename.set(r.filename, meta);
        });
        totalLoaded += rows.length;
        if (rows.length < pageSize) break;
        offset += pageSize;
      }
      loaded = true;
      console.log('[meta-loader] loaded ' + totalLoaded + ' items');

      if (typeof window.renderView === 'function') {
        try { window.renderView(); } catch (e) { console.warn(e); }
      }
    } catch (err) {
      console.error('[meta-loader] error:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchAll);
  } else {
    fetchAll();
  }
})();

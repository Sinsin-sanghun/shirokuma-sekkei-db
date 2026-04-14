// ══════════════════════════════════════
//  Summary Loader
//  Fetches 3-line summaries from Supabase and makes them available
//  for the list view renderers.
//  ──────────────────────────────────────
//  Exposes: window.getSummary(relPath, filename) => string | null
//  Triggers renderView() after load so summaries appear once fetched.
// ══════════════════════════════════════

(function() {
  const SUPABASE_URL = 'https://manowprcyrfqonzdoqja.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hbm93cHJjeXJmcW9uemRvcWphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMTU5NDIsImV4cCI6MjA4ODc5MTk0Mn0.eZ9UHW041t85kLBglI_CK6p0uX5dRVMbWyJO0oR50Kc';

  // Internal lookup maps
  const byRelPath = new Map();
  const byFilename = new Map();
  let loaded = false;

  // Public API: returns summary string or null
  window.getSummary = function(relPath, filename) {
    if (!loaded) return null;
    if (relPath && byRelPath.has(relPath)) return byRelPath.get(relPath);
    if (filename && byFilename.has(filename)) return byFilename.get(filename);
    // Try decoded versions
    try {
      const decRel = decodeURI(relPath || '');
      if (byRelPath.has(decRel)) return byRelPath.get(decRel);
    } catch (e) {}
    return null;
  };

  // Fetch all rows that actually have summaries
  async function fetchSummaries() {
    try {
      const url = SUPABASE_URL + '/rest/v1/sekkei_documents'
        + '?select=filename,relative_path,summary'
        + '&summary=not.is.null';
      const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Accept-Profile': 'public'
      };

      // Paginate using Range headers (Supabase REST default cap is 1000)
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
          console.warn('[summary-loader] fetch failed:', resp.status);
          break;
        }
        const rows = await resp.json();
        if (!Array.isArray(rows) || rows.length === 0) break;
        rows.forEach(r => {
          if (r.summary) {
            if (r.relative_path) byRelPath.set(r.relative_path, r.summary);
            if (r.filename) byFilename.set(r.filename, r.summary);
          }
        });
        totalLoaded += rows.length;
        if (rows.length < pageSize) break;
        offset += pageSize;
      }
      loaded = true;
      console.log('[summary-loader] loaded ' + totalLoaded + ' summaries');

      // Trigger re-render if page already rendered
      if (typeof window.renderView === 'function') {
        try { window.renderView(); } catch (e) { console.warn(e); }
      }
    } catch (err) {
      console.error('[summary-loader] error:', err);
    }
  }

  // Start fetching as soon as possible (non-blocking)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchSummaries);
  } else {
    fetchSummaries();
  }
})();

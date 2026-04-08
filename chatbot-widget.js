// =============================================================
//  chatbot-widget.js
//  部材情報DB 用 AI チャットウィジェット
// =============================================================
(function() {
  'use strict';
  var style = document.createElement('style');
  style.textContent = '#ai-chat-toggle{position:fixed;bottom:24px;right:24px;z-index:9999;width:56px;height:56px;border-radius:50%;background:#2563eb;color:#fff;border:none;cursor:pointer;box-shadow:0 4px 14px rgba(37,99,235,.4);display:flex;align-items:center;justify-content:center;transition:transform .2s}#ai-chat-toggle:hover{transform:scale(1.08)}#ai-chat-toggle svg{width:26px;height:26px}#ai-chat-panel{position:fixed;bottom:24px;right:24px;z-index:9999;width:384px;height:520px;background:#fff;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.18);border:1px solid #e5e7eb;display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,sans-serif}#ai-chat-panel.open{display:flex}#ai-chat-header{background:#2563eb;color:#fff;padding:12px 16px;display:flex;align-items:center;justify-content:space-between}#ai-chat-header .title{font-weight:700;font-size:14px;display:flex;align-items:center;gap:8px}#ai-chat-close{background:none;border:none;color:#fff;font-size:22px;cursor:pointer;line-height:1}#ai-chat-messages{flex:1;overflow-y:auto;padding:12px;background:#f9fafb;display:flex;flex-direction:column;gap:10px}.ai-msg{max-width:82%;padding:8px 12px;border-radius:10px;font-size:13px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}.ai-msg.user{align-self:flex-end;background:#2563eb;color:#fff}.ai-msg.assistant{align-self:flex-start;background:#fff;border:1px solid #e5e7eb;color:#1f2937}.ai-msg-empty{text-align:center;color:#9ca3af;font-size:13px;margin-top:40px}#ai-chat-input-area{border-top:1px solid #e5e7eb;padding:12px;background:#fff;display:flex;gap:8px}#ai-chat-input{flex:1;border:1px solid #d1d5db;border-radius:8px;padding:8px 12px;font-size:13px;outline:none}#ai-chat-input:focus{border-color:#2563eb;box-shadow:0 0 0 2px rgba(37,99,235,.2)}#ai-chat-send{background:#2563eb;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:13px;cursor:pointer}#ai-chat-send:hover{background:#1d4ed8}#ai-chat-send:disabled{opacity:.5;cursor:not-allowed}';
  document.head.appendChild(style);

  var toggle = document.createElement('button');
  toggle.id = 'ai-chat-toggle';
  toggle.title = 'AI\u30c1\u30e3\u30c3\u30c8';
  toggle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>';
  document.body.appendChild(toggle);

  var panel = document.createElement('div');
  panel.id = 'ai-chat-panel';
  panel.innerHTML = '<div id="ai-chat-header"><div class="title"><span>\ud83e\udd16</span><span>AI\u90e8\u6750\u30a2\u30b7\u30b9\u30bf\u30f3\u30c8</span></div><button id="ai-chat-close">&times;</button></div><div id="ai-chat-messages"><div class="ai-msg-empty">\ud83d\udcac \u90e8\u6750\u30fb\u8a2d\u8a08\u306b\u95a2\u3059\u308b\u8cea\u554f\u3092\u3069\u3046\u305e<br><small>\u4f8b: \u300c\u67b6\u53f0\u306e\u5728\u5eab\u72b6\u6cc1\u306f\uff1f\u300d</small></div></div><div id="ai-chat-input-area"><input id="ai-chat-input" type="text" placeholder="\u8cea\u554f\u3092\u5165\u529b..." /><button id="ai-chat-send">\u9001\u4fe1</button></div>';
  document.body.appendChild(panel);

  var msgArea = panel.querySelector('#ai-chat-messages');
  var input = panel.querySelector('#ai-chat-input');
  var sendBtn = panel.querySelector('#ai-chat-send');
  var closeBtn = panel.querySelector('#ai-chat-close');
  var chatHistory = [];
  var loading = false;

  toggle.addEventListener('click', function() { panel.classList.add('open'); toggle.style.display = 'none'; input.focus(); });
  closeBtn.addEventListener('click', function() { panel.classList.remove('open'); toggle.style.display = 'flex'; });

  function addMsg(role, text) {
    var empty = msgArea.querySelector('.ai-msg-empty');
    if (empty) empty.remove();
    var div = document.createElement('div');
    div.className = 'ai-msg ' + role;
    div.textContent = text || '';
    msgArea.appendChild(div);
    msgArea.scrollTop = msgArea.scrollHeight;
    return div;
  }

  async function sendMessage() {
    var text = input.value.trim();
    if (!text || loading) return;
    input.value = '';
    addMsg('user', text);
    loading = true;
    sendBtn.disabled = true;
    input.disabled = true;

    try {
      var res = await fetch('/.netlify/functions/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: chatHistory.slice(-8) }),
      });
      if (!res.ok) throw new Error('API error: ' + res.status);

      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var assistantMsg = '';
      var msgEl = addMsg('assistant', '');

      while (true) {
        var result = await reader.read();
        if (result.done) break;
        var chunk = decoder.decode(result.value, { stream: true });
        var lines = chunk.split('\n');
        for (var i = 0; i < lines.length; i++) {
          if (lines[i].startsWith('data: ')) {
            try {
              var data = JSON.parse(lines[i].slice(6));
              if (data.type === 'content_block_delta' && data.delta && data.delta.text) {
                assistantMsg += data.delta.text;
                msgEl.textContent = assistantMsg;
                msgArea.scrollTop = msgArea.scrollHeight;
              }
            } catch(e) {}
          }
        }
      }
      chatHistory.push({ role: 'user', content: text });
      chatHistory.push({ role: 'assistant', content: assistantMsg });
    } catch(err) {
      console.error('Chat error:', err);
      addMsg('assistant', '\u30a8\u30e9\u30fc\u304c\u767a\u751f\u3057\u307e\u3057\u305f\u3002\u3082\u3046\u4e00\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002');
    } finally {
      loading = false;
      sendBtn.disabled = false;
      input.disabled = false;
      input.focus();
    }
  }

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
})();

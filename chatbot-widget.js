(function(){
'use strict';
var CHAT_API='/.netlify/functions/chat';
var history=[];
var isOpen=false;

// Create styles
var style=document.createElement('style');
style.textContent='#ai-sidebar{position:fixed;top:0;right:0;width:380px;height:100vh;background:#fff;box-shadow:-2px 0 12px rgba(0,0,0,.15);z-index:9999;display:flex;flex-direction:column;transform:translateX(100%);transition:transform .3s ease;font-family:-apple-system,BlinkMacSystemFont,sans-serif}#ai-sidebar.open{transform:translateX(0)}#ai-sidebar-header{background:linear-gradient(135deg,#1e40af,#3b82f6);color:#fff;padding:16px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}#ai-sidebar-header h3{margin:0;font-size:16px;font-weight:600}#ai-sidebar-close{background:none;border:none;color:#fff;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:4px}#ai-sidebar-close:hover{background:rgba(255,255,255,.2)}#ai-sidebar-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px}.ai-msg-user{align-self:flex-end;background:#e0e7ff;color:#1e3a5f;padding:10px 14px;border-radius:16px 16px 4px 16px;max-width:85%;word-break:break-word;font-size:14px;line-height:1.5}.ai-msg-ai{align-self:flex-start;background:#f1f5f9;color:#1e293b;padding:10px 14px;border-radius:16px 16px 16px 4px;max-width:90%;word-break:break-word;font-size:14px;line-height:1.6}.ai-msg-ai p{margin:4px 0}.ai-msg-ai ul,.ai-msg-ai ol{margin:4px 0 4px 18px;padding:0}.ai-msg-ai li{margin:2px 0}.ai-msg-ai strong{font-weight:600}.ai-msg-ai code{background:#e2e8f0;padding:1px 4px;border-radius:3px;font-size:13px}#ai-sidebar-input-area{border-top:1px solid #e2e8f0;padding:12px;display:flex;gap:8px;flex-shrink:0;background:#f8fafc}#ai-sidebar-input{flex:1;border:1px solid #cbd5e1;border-radius:20px;padding:10px 16px;font-size:14px;outline:none;resize:none}#ai-sidebar-input:focus{border-color:#3b82f6;box-shadow:0 0 0 2px rgba(59,130,246,.2)}#ai-sidebar-send{background:#2563eb;color:#fff;border:none;border-radius:50%;width:38px;height:38px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:16px}#ai-sidebar-send:hover{background:#1d4ed8}#ai-sidebar-send:disabled{background:#94a3b8;cursor:not-allowed}#ai-toggle-btn{position:fixed;bottom:24px;right:24px;background:linear-gradient(135deg,#1e40af,#3b82f6);color:#fff;border:none;border-radius:50px;padding:14px 22px;font-size:15px;font-weight:600;cursor:pointer;z-index:9998;box-shadow:0 4px 14px rgba(37,99,235,.4);display:flex;align-items:center;gap:8px;transition:all .2s}#ai-toggle-btn:hover{transform:scale(1.05);box-shadow:0 6px 20px rgba(37,99,235,.5)}#ai-toggle-btn.hidden{display:none}.ai-welcome{text-align:center;color:#64748b;padding:40px 20px;font-size:14px;line-height:1.6}.ai-welcome-icon{font-size:40px;margin-bottom:12px}.ai-typing{color:#64748b;font-style:italic;font-size:13px;padding:8px 14px}.ai-typing::after{content:"...";animation:dots 1.2s infinite}@keyframes dots{0%,20%{content:"."}40%{content:".."}60%,100%{content:"..."}}';
document.head.appendChild(style);

// Create toggle button
var toggleBtn=document.createElement('button');
toggleBtn.id='ai-toggle-btn';
toggleBtn.innerHTML='\ud83e\udd16 AI\u30c1\u30e3\u30c3\u30c8';
document.body.appendChild(toggleBtn);

// Create sidebar
var sidebar=document.createElement('div');
sidebar.id='ai-sidebar';
sidebar.innerHTML='<div id="ai-sidebar-header"><h3>\ud83e\udd16 AI\u90e8\u6750\u30a2\u30b7\u30b9\u30bf\u30f3\u30c8</h3><button id="ai-sidebar-close">\u2715</button></div>'+'<div id="ai-sidebar-messages"><div class="ai-welcome"><div class="ai-welcome-icon">\ud83d\udcac</div>\u90e8\u6750\u30fb\u8a2d\u8a08\u306b\u95a2\u3059\u308b\u8cea\u554f\u3092\u3069\u3046\u305e<br><span style="color:#94a3b8;font-size:13px">\u4f8b: \u300c\u67b6\u53f0\u306e\u5728\u5eab\u72b6\u6cc1\u306f\uff1f\u300d</span></div></div>'+'<div id="ai-sidebar-input-area"><input id="ai-sidebar-input" type="text" placeholder="\u8cea\u554f\u3092\u5165\u529b..." /><button id="ai-sidebar-send">\u27a4</button></div>';
document.body.appendChild(sidebar);

// Toggle sidebar
toggleBtn.addEventListener('click',function(){sidebar.classList.add('open');toggleBtn.classList.add('hidden');isOpen=true;document.getElementById('ai-sidebar-input').focus();});
document.getElementById('ai-sidebar-close').addEventListener('click',function(){sidebar.classList.remove('open');toggleBtn.classList.remove('hidden');isOpen=false;});

// Markdown helper
function md(t){
  t=t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  t=t.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  t=t.replace(/`([^`]+)`/g,'<code>$1</code>');
  t=t.replace(/^### (.+)$/gm,'<strong style="font-size:15px">$1</strong>');
  t=t.replace(/^## (.+)$/gm,'<strong style="font-size:16px">$1</strong>');
  t=t.replace(/^[\-\*] (.+)$/gm,'<li>$1</li>');
  t=t.replace(/(<li>.*<\/li>)/gs,'<ul>$1</ul>');
  t=t.replace(/<\/ul>\s*<ul>/g,'');
  t=t.replace(/\n\n/g,'</p><p>');
  t=t.replace(/\n/g,'<br>');
  return '<p>'+t+'</p>';
}

// Send message
function sendMsg(){
  var input=document.getElementById('ai-sidebar-input');
  var msg=input.value.trim();
  if(!msg)return;
  input.value='';
  var msgs=document.getElementById('ai-sidebar-messages');
  // Remove welcome
  var welcome=msgs.querySelector('.ai-welcome');
  if(welcome)welcome.remove();
  // Add user message
  var uDiv=document.createElement('div');
  uDiv.className='ai-msg-user';
  uDiv.textContent=msg;
  msgs.appendChild(uDiv);
  // Add typing indicator
  var typing=document.createElement('div');
  typing.className='ai-typing';
  typing.textContent='\u56de\u7b54\u4e2d';
  msgs.appendChild(typing);
  msgs.scrollTop=msgs.scrollHeight;
  // Disable send
  var sendBtn=document.getElementById('ai-sidebar-send');
  sendBtn.disabled=true;

  fetch(CHAT_API,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({message:msg,history:history.slice(-6)})
  }).then(function(r){
    var ct=r.headers.get('content-type')||'';
    if(ct.indexOf('text/event-stream')>-1){
      // Streaming SSE response
      typing.remove();
      var aiDiv=document.createElement('div');
      aiDiv.className='ai-msg-ai';
      aiDiv.innerHTML='<span class="ai-typing">\u56de\u7b54\u4e2d</span>';
      msgs.appendChild(aiDiv);
      var fullText='';
      var reader=r.body.getReader();
      var decoder=new TextDecoder();
      function read(){
        reader.read().then(function(res){
          if(res.done){
            aiDiv.innerHTML=md(fullText||'\u5fdc\u7b54\u306a\u3057');
            history.push({role:'user',content:msg},{role:'assistant',content:fullText});
            sendBtn.disabled=false;
            msgs.scrollTop=msgs.scrollHeight;
            return;
          }
          var chunk=decoder.decode(res.value,{stream:true});
          var lines=chunk.split('\n');
          for(var i=0;i<lines.length;i++){
            var line=lines[i];
            if(!line.startsWith('data: '))continue;
            var payload=line.slice(6);
            if(payload==='[DONE]')continue;
            try{
              var ev=JSON.parse(payload);
              if(ev.type==='content_block_delta'&&ev.delta&&ev.delta.type==='text_delta'){
                fullText+=ev.delta.text;
                aiDiv.innerHTML=md(fullText);
                msgs.scrollTop=msgs.scrollHeight;
              }
            }catch(e){}
          }
          read();
        });
      }
      read();
    } else {
      // JSON response
      return r.json().then(function(d){
        typing.remove();
        var aiDiv=document.createElement('div');
        aiDiv.className='ai-msg-ai';
        if(d.error){
          aiDiv.innerHTML='<span style="color:#ef4444">\u26a0\ufe0f '+d.error+'</span>';
        } else {
          var txt=d.response||'\u5fdc\u7b54\u306a\u3057';
          aiDiv.innerHTML=md(txt);
          history.push({role:'user',content:msg},{role:'assistant',content:txt});
        }
        msgs.appendChild(aiDiv);
        sendBtn.disabled=false;
        msgs.scrollTop=msgs.scrollHeight;
      });
    }
  }).catch(function(e){
    typing.remove();
    var errDiv=document.createElement('div');
    errDiv.className='ai-msg-ai';
    errDiv.innerHTML='<span style="color:#ef4444">\u26a0\ufe0f \u63a5\u7d9a\u30a8\u30e9\u30fc: '+e.message+'</span>';
    msgs.appendChild(errDiv);
    sendBtn.disabled=false;
    msgs.scrollTop=msgs.scrollHeight;
  });
}

// Event listeners
document.getElementById('ai-sidebar-send').addEventListener('click',sendMsg);
document.getElementById('ai-sidebar-input').addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg();}});

})();

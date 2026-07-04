
(function(){
  var ready=false;

  var DEFAULT_SETTINGS={
    enVoiceURI:'',
    jaVoiceURI:'',
    enRate:0.92,
    jaRate:0.82,
    enPitch:1.08,
    jaPitch:1.0,
    voiceEngine:'openai',
    openAiEnabled:true,
    openAiProxyUrl:'',
    openAiVoice:'marin',
    rexVoice:'marin'
  };

  var SETTINGS_KEYS=[
    'rexEnglishMaster.voice',
    'rexEnglishMaster.voice.v74',
    'rexEnglishMaster.voice.v74',
    'rexEnglishMaster.voice.v74',
    'rexVoiceSettings'
  ];

  var voiceSettings=Object.assign({}, DEFAULT_SETTINGS);

  function safeJson(raw){ try{ return raw ? JSON.parse(raw) : null; }catch(e){ return null; } }

  function readSettings(){
    var merged=Object.assign({}, DEFAULT_SETTINGS);
    SETTINGS_KEYS.forEach(function(k){
      var v=safeJson(localStorage.getItem(k));
      if(v) merged=Object.assign(merged, v);
    });

    var en=document.getElementById('enVoiceSelect');
    var ja=document.getElementById('jaVoiceSelect');
    var er=document.getElementById('enRateSelect');
    var jr=document.getElementById('jaRateSelect');
    var openRadio=document.getElementById('voiceEngineOpenAI');
    var safariRadio=document.getElementById('voiceEngineSafari');
    var chk=document.getElementById('openAiVoiceEnabled');
    var proxy=document.getElementById('openAiProxyUrl');
    var ovoice=document.getElementById('openAiVoiceSelect');

    if(en) merged.enVoiceURI=en.value || '';
    if(ja) merged.jaVoiceURI=ja.value || '';
    if(er) merged.enRate=Number(er.value || merged.enRate || 0.92);
    if(jr) merged.jaRate=Number(jr.value || merged.jaRate || 0.82);
    if(proxy) merged.openAiProxyUrl=(proxy.value || '').trim();

    if(ovoice){
      merged.openAiVoice=ovoice.value || merged.openAiVoice || 'marin';
      merged.rexVoice=ovoice.value || merged.rexVoice || merged.openAiVoice || 'marin';
    }

    if(safariRadio && safariRadio.checked) merged.voiceEngine='safari';
    else if(openRadio && openRadio.checked) merged.voiceEngine='openai';

    if(chk) merged.openAiEnabled=!!chk.checked;
    else merged.openAiEnabled=merged.voiceEngine !== 'safari';

    if(!merged.voiceEngine) merged.voiceEngine=merged.openAiEnabled===false ? 'safari' : 'openai';
    merged.openAiEnabled = merged.voiceEngine !== 'safari';

    voiceSettings=merged;
    window.REX_CURRENT_VOICE_SETTINGS=voiceSettings;
    return voiceSettings;
  }

  function saveSettings(next){
    voiceSettings=Object.assign(readSettings(), next || {});
    localStorage.setItem('rexEnglishMaster.voice', JSON.stringify(voiceSettings));
    localStorage.setItem('rexVoiceSettings', JSON.stringify(voiceSettings));
    window.REX_CURRENT_VOICE_SETTINGS=voiceSettings;
    return voiceSettings;
  }

  function voices(){ return window.speechSynthesis && speechSynthesis.getVoices ? speechSynthesis.getVoices() : []; }
  function norm(s){ return String(s || '').toLowerCase(); }
  function isJapaneseVoice(v){ return norm(v.lang).indexOf('ja')===0 || /japanese|日本|kyoko|otoya|nanami|haruka/i.test(v.name || ''); }
  function isEnglishVoice(v){ return norm(v.lang).indexOf('en')===0 || /english|samantha|karen|tessa|moira|ava|aria/i.test(v.name || ''); }

  function findVoice(value){
    if(!value) return null;
    var vs=voices();
    for(var i=0;i<vs.length;i++){
      if(vs[i].voiceURI===value || vs[i].name===value) return vs[i];
    }
    return null;
  }

  function pickVoice(lang){
    readSettings();
    var isJa=String(lang || '').toLowerCase().indexOf('ja')===0;
    var selected = isJa ? findVoice(voiceSettings.jaVoiceURI) : findVoice(voiceSettings.enVoiceURI);
    if(selected) return selected;
    var list=voices().filter(isJa ? isJapaneseVoice : isEnglishVoice);
    var prefs=isJa ? ['Kyoko','Otoya','Nanami','Haruka','Siri','Japanese','日本'] : ['Samantha','Karen','Tessa','Moira','Ava','Aria','Google US English','English'];
    for(var p=0;p<prefs.length;p++){
      for(var j=0;j<list.length;j++){
        if(norm(list[j].name).indexOf(norm(prefs[p]))>=0) return list[j];
      }
    }
    return list[0] || null;
  }

  function browserSpeak(text, lang){
    return new Promise(function(resolve){
      readSettings();
      text=String(text || '').trim();
      if(!text || !('speechSynthesis' in window)){ resolve(); return; }
      var done=false;
      function finish(){ if(done) return; done=true; resolve(); }
      try{ speechSynthesis.cancel(); }catch(e){}
      var u=new SpeechSynthesisUtterance(text);
      u.lang=lang || 'en-US';
      u.voice=pickVoice(u.lang);
      if(String(u.lang).toLowerCase().indexOf('ja')===0){
        u.pitch=Number(voiceSettings.jaPitch || 1.0);
        u.rate=Number(voiceSettings.jaRate || 0.82);
      }else{
        u.pitch=Number(voiceSettings.enPitch || 1.08);
        u.rate=Number(voiceSettings.enRate || 0.92);
      }
      u.volume=1;
      u.onend=finish;
      u.onerror=finish;
      try{ speechSynthesis.speak(u); }catch(e){ finish(); }
      var safeMs=Math.max(3500, text.length * (String(u.lang).indexOf('ja')===0 ? 230 : 170));
      setTimeout(finish, safeMs);
    });
  }

  function normalizeProxyUrl(url){
    url=String(url || '').trim();
    if(!url) return '';
    if(!/\/tts\/?$/.test(url)) url=url.replace(/\/+$/,'') + '/tts';
    return url;
  }

  async function openAiSpeak(text, lang, role){
    readSettings();
    var proxy=normalizeProxyUrl(voiceSettings.openAiProxyUrl);
    if(!proxy) throw new Error('OpenAI proxy URL is not set');
    text=String(text || '').trim();
    if(!text) return;

    var isJa=String(lang || '').toLowerCase().indexOf('ja')===0;
    var voice = role==='rex'
      ? (voiceSettings.rexVoice || voiceSettings.openAiVoice || 'marin')
      : (voiceSettings.openAiVoice || voiceSettings.rexVoice || 'marin');

    var instructions;
    if(role==='rex'){
      instructions = isJa
        ? '明るく、かわいく、やさしい恐竜レックスの声で自然な日本語で話してください。中学生を前向きに励ます相棒の雰囲気。'
        : 'Speak as Rex, a cute friendly dinosaur buddy. Bright, warm, encouraging, and clear for a junior high school learner.';
    }else if(isJa){
      instructions = '自然で聞き取りやすい日本語で話してください。中学生向けに、やさしく明るい声。合成音っぽくならないように自然に。';
    }else{
      instructions = 'Speak clearly in natural English for a junior high school learner. Friendly and easy to understand.';
    }

    var res=await fetch(proxy,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({text:text, lang:lang || 'ja-JP', voice:voice, instructions:instructions, role:role || ''})
    });
    if(!res.ok) throw new Error('OpenAI voice proxy error: '+res.status);
    var blob=await res.blob();
    var url=URL.createObjectURL(blob);
    await new Promise(function(resolve,reject){
      var audio=new Audio(url);
      audio.onended=function(){ URL.revokeObjectURL(url); resolve(); };
      audio.onerror=function(){ URL.revokeObjectURL(url); reject(new Error('audio playback error')); };
      audio.play().catch(reject);
    });
  }

  async function speak(text, lang, role){
    readSettings();
    role=role || (String(lang || '').toLowerCase().indexOf('ja')===0 ? 'japanese' : 'english');
    var isJa=String(lang || '').toLowerCase().indexOf('ja')===0;
    var hasProxy=!!normalizeProxyUrl(voiceSettings.openAiProxyUrl);

    var shouldUseOpenAI =
      hasProxy &&
      voiceSettings.openAiEnabled &&
      voiceSettings.voiceEngine !== 'safari' &&
      (isJa || role === 'rex');

    if(shouldUseOpenAI){
      try{
        await openAiSpeak(text, lang, role);
        return;
      }catch(e){
        console.warn('OpenAI voice fallback to Safari:', e);
      }
    }
    return browserSpeak(text, lang);
  }

  function unlock(){
    if('speechSynthesis' in window) try{ speechSynthesis.cancel(); }catch(e){}
    return speak('Ready','en-US','rex').then(function(){ ready=true; return true; });
  }
  function cancel(){ try{ if('speechSynthesis' in window) speechSynthesis.cancel(); }catch(e){} }
  function isReady(){ return ready; }

  function populateVoiceSelects(){
    readSettings();
    var enSel=document.getElementById('enVoiceSelect');
    var jaSel=document.getElementById('jaVoiceSelect');
    var vs=voices();
    function fill(sel, arr, selectedURI, fallbackLabel){
      if(!sel) return;
      var old=sel.value || selectedURI || '';
      sel.innerHTML='';
      var auto=document.createElement('option');
      auto.value='';
      auto.textContent='自動選択（おすすめ）';
      sel.appendChild(auto);
      if(!arr.length){
        var opt=document.createElement('option');
        opt.value='';
        opt.textContent=fallbackLabel;
        sel.appendChild(opt);
      }else{
        arr.forEach(function(v){
          var opt=document.createElement('option');
          opt.value=v.voiceURI;
          opt.textContent=v.name+' / '+v.lang;
          sel.appendChild(opt);
        });
      }
      sel.value=old;
    }

    fill(enSel, vs.filter(isEnglishVoice), voiceSettings.enVoiceURI, '英語音声が見つかりません');
    fill(jaSel, vs.filter(isJapaneseVoice), voiceSettings.jaVoiceURI, '日本語音声が見つかりません');

    var er=document.getElementById('enRateSelect');
    var jr=document.getElementById('jaRateSelect');
    if(er) er.value=String(voiceSettings.enRate || 0.92);
    if(jr) jr.value=String(voiceSettings.jaRate || 0.82);

    var chk=document.getElementById('openAiVoiceEnabled');
    var openRadio=document.getElementById('voiceEngineOpenAI');
    var safariRadio=document.getElementById('voiceEngineSafari');
    var proxy=document.getElementById('openAiProxyUrl');
    var ovoice=document.getElementById('openAiVoiceSelect');

    if(openRadio) openRadio.checked=voiceSettings.voiceEngine !== 'safari';
    if(safariRadio) safariRadio.checked=voiceSettings.voiceEngine === 'safari';
    if(chk) chk.checked=voiceSettings.voiceEngine !== 'safari';
    if(proxy) proxy.value=voiceSettings.openAiProxyUrl || '';
    if(ovoice) ovoice.value=voiceSettings.rexVoice || voiceSettings.openAiVoice || 'marin';
  }

  function saveFromUI(){
    var safariRadio=document.getElementById('voiceEngineSafari');
    var chk=document.getElementById('openAiVoiceEnabled');
    var ovoice=document.getElementById('openAiVoiceSelect');
    var engine = safariRadio && safariRadio.checked ? 'safari' : 'openai';
    if(chk) chk.checked = engine === 'openai';
    return saveSettings({
      enVoiceURI: document.getElementById('enVoiceSelect') ? document.getElementById('enVoiceSelect').value : '',
      jaVoiceURI: document.getElementById('jaVoiceSelect') ? document.getElementById('jaVoiceSelect').value : '',
      enRate: document.getElementById('enRateSelect') ? Number(document.getElementById('enRateSelect').value) : 0.92,
      jaRate: document.getElementById('jaRateSelect') ? Number(document.getElementById('jaRateSelect').value) : 0.82,
      voiceEngine: engine,
      openAiEnabled: engine === 'openai',
      openAiProxyUrl: document.getElementById('openAiProxyUrl') ? document.getElementById('openAiProxyUrl').value.trim() : '',
      openAiVoice: ovoice ? ovoice.value : 'marin',
      rexVoice: ovoice ? ovoice.value : 'marin'
    });
  }

  function bindVoiceAutoSave(){
    ['enVoiceSelect','jaVoiceSelect','enRateSelect','jaRateSelect','openAiVoiceEnabled','voiceEngineOpenAI','voiceEngineSafari','openAiProxyUrl','openAiVoiceSelect'].forEach(function(id){
      var el=document.getElementById(id);
      if(!el || el.dataset.rexVoiceAutoSave==='1') return;
      el.dataset.rexVoiceAutoSave='1';
      var ev=(el.tagName==='INPUT' && el.type==='text') ? 'input' : 'change';
      el.addEventListener(ev,function(){
        saveFromUI();
        if(id==='voiceEngineOpenAI'){
          var chk=document.getElementById('openAiVoiceEnabled'); if(chk) chk.checked=true;
        }
        if(id==='voiceEngineSafari'){
          var chk2=document.getElementById('openAiVoiceEnabled'); if(chk2) chk2.checked=false;
        }
      });
    });
  }

  if('speechSynthesis' in window){
    speechSynthesis.onvoiceschanged=function(){ populateVoiceSelects(); bindVoiceAutoSave(); };
  }
  setTimeout(function(){ populateVoiceSelects(); bindVoiceAutoSave(); }, 250);
  setTimeout(function(){ populateVoiceSelects(); bindVoiceAutoSave(); }, 1000);
  setInterval(bindVoiceAutoSave, 1000);

  window.RexSpeech={
    speak:speak,
    speakText:speak,
    speakRex:function(en, ja){
      return speak(en,'en-US','rex').then(function(){ return ja ? speak(ja,'ja-JP','rex') : null; });
    },
    unlock:unlock,
    cancel:cancel,
    isReady:isReady,
    populateVoiceSelects:populateVoiceSelects,
    saveFromUI:saveFromUI,
    settings:function(){ return readSettings(); }
  };

  window.RexVoiceSpeak=speak;
})();



/* v74: voice diagnostics override */
(function(){
  function q(id){return document.getElementById(id);}
  function getSettings(){
    var s={};
    try{s=JSON.parse(localStorage.getItem('rexEnglishMaster.voice')||localStorage.getItem('rexVoiceSettings')||'{}')||{};}catch(e){}
    s.engine=(q('voiceEngineSafari')&&q('voiceEngineSafari').checked)?'safari':'openai';
    s.openAiEnabled=s.engine!=='safari';
    s.proxy=q('openAiProxyUrl')?(q('openAiProxyUrl').value||'').trim():(s.openAiProxyUrl||'');
    s.openAiProxyUrl=s.proxy;
    s.openAiVoice=q('openAiVoiceSelect')?(q('openAiVoiceSelect').value||'marin'):(s.openAiVoice||'marin');
    s.rexVoice=s.openAiVoice;
    s.enVoiceURI=q('enVoiceSelect')?(q('enVoiceSelect').value||''):(s.enVoiceURI||'');
    s.jaVoiceURI=q('jaVoiceSelect')?(q('jaVoiceSelect').value||''):(s.jaVoiceURI||'');
    s.enRate=q('enRateSelect')?Number(q('enRateSelect').value||0.92):(s.enRate||0.92);
    s.jaRate=q('jaRateSelect')?Number(q('jaRateSelect').value||0.82):(s.jaRate||0.82);
    return s;
  }
  function save(){
    var s=getSettings();
    localStorage.setItem('rexEnglishMaster.voice',JSON.stringify(s));
    localStorage.setItem('rexVoiceSettings',JSON.stringify(s));
    status();
    return s;
  }
  function proxyUrl(s){
    var u=String((s||getSettings()).openAiProxyUrl||'').trim();
    if(!u)return '';
    if(!/\/tts\/?$/.test(u))u=u.replace(/\/+$/,'')+'/tts';
    return u;
  }
  function diag(msg,type){
    var el=q('voiceDiagStatus');
    if(el){el.textContent=msg;el.className='voiceDiagStatus '+(type||'');}
    var st=q('status');
    if(st && type==='error') st.textContent=msg.replace(/^音声診断：/,'');
  }
  function voices(){return window.speechSynthesis&&speechSynthesis.getVoices?speechSynthesis.getVoices():[];}
  function findVoice(uri){
    if(!uri)return null;
    var vs=voices();
    for(var i=0;i<vs.length;i++){if(vs[i].voiceURI===uri||vs[i].name===uri)return vs[i];}
    return null;
  }
  function browser(text,lang){
    return new Promise(function(resolve){
      text=String(text||'').trim(); if(!text||!window.speechSynthesis){resolve();return;}
      var s=getSettings(), done=false;
      function finish(){if(done)return;done=true;resolve();}
      try{speechSynthesis.cancel();}catch(e){}
      var u=new SpeechSynthesisUtterance(text);
      u.lang=lang||'en-US';
      u.voice=(String(u.lang).indexOf('ja')===0)?findVoice(s.jaVoiceURI):findVoice(s.enVoiceURI);
      u.rate=(String(u.lang).indexOf('ja')===0)?Number(s.jaRate||0.82):Number(s.enRate||0.92);
      u.pitch=(String(u.lang).indexOf('ja')===0)?1.0:1.08;
      u.onend=finish; u.onerror=finish;
      try{speechSynthesis.speak(u);}catch(e){finish();}
      setTimeout(finish,Math.max(3500,text.length*(String(u.lang).indexOf('ja')===0?230:170)));
    });
  }
  async function openai(text,lang,role){
    var s=save(), url=proxyUrl(s);
    if(!url){diag('音声診断：OpenAIプロキシURLが未設定です。','error');throw new Error('OpenAI proxy URL is not set');}
    var isJa=String(lang||'').indexOf('ja')===0;
    var voice=(role==='rex')?(s.rexVoice||s.openAiVoice||'marin'):(s.openAiVoice||'marin');
    var instructions=role==='rex'
      ? (isJa?'明るく、かわいく、やさしい恐竜レックスの声で自然な日本語で話してください。':'Speak as Rex, a cute friendly dinosaur buddy.')
      : (isJa?'自然で聞き取りやすい日本語で、やさしく明るく話してください。':'Speak clearly in friendly English.');
    diag('音声診断：OpenAI接続中... voice='+voice+' / role='+(role||'japanese'),'checking');
    var res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:String(text||''),lang:lang||'ja-JP',voice:voice,instructions:instructions,role:role||''})});
    if(!res.ok){
      var detail=''; try{detail=(await res.text()).slice(0,120);}catch(e){}
      diag('音声診断：OpenAI接続エラー '+res.status+'。Worker/API設定を確認してください。','error');
      throw new Error('OpenAI voice proxy error: '+res.status+' '+detail);
    }
    var blob=await res.blob(), au=URL.createObjectURL(blob);
    await new Promise(function(resolve,reject){
      var a=new Audio(au);
      a.onended=function(){URL.revokeObjectURL(au);resolve();};
      a.onerror=function(){URL.revokeObjectURL(au);reject(new Error('audio playback error'));};
      a.play().catch(reject);
    });
    diag('音声診断：OpenAI音声OK / '+(role==='rex'?'レックス':'日本語')+' / voice='+voice,'ok');
  }
  async function speak(text,lang,role){
    var s=save();
    role=role||(String(lang||'').indexOf('ja')===0?'japanese':'english');
    var isJa=String(lang||'').indexOf('ja')===0;
    if(s.engine!=='safari' && s.openAiEnabled && proxyUrl(s) && (isJa||role==='rex')){
      try{return await openai(text,lang,role);}catch(e){console.warn(e);diag('音声診断：OpenAI失敗。Safariへ一時フォールバック中。'+(e.message||e),'error');}
    }else if((isJa||role==='rex') && s.engine!=='safari'){
      diag('音声診断：OpenAI未接続。プロキシURLを設定してください。','error');
    }
    return browser(text,lang);
  }
  function status(){
    var s=getSettings(), url=proxyUrl(s);
    if(s.engine==='safari'){diag('音声診断：Safari標準音声モード','checking');return;}
    if(!url){diag('音声診断：英語=Safari / 日本語=OpenAI未設定 / レックス=OpenAI未設定','error');return;}
    diag('音声診断：英語=Safari / 日本語=OpenAI '+(s.openAiVoice||'marin')+' / レックス=OpenAI '+(s.rexVoice||s.openAiVoice||'marin'),'ok');
  }
  function bind(){
    ['enVoiceSelect','jaVoiceSelect','enRateSelect','jaRateSelect','voiceEngineOpenAI','voiceEngineSafari','openAiProxyUrl','openAiVoiceSelect'].forEach(function(id){
      var el=q(id); if(!el||el.dataset.v74diag)return; el.dataset.v74diag='1';
      el.addEventListener(id==='openAiProxyUrl'?'input':'change',save);
    });
    var ja=q('jaOpenAiTestBtn');
    if(ja&&!ja.dataset.v74test){ja.dataset.v74test='1';ja.onclick=function(){openai('こんにちは。これはOpenAIの日本語音声テストです。','ja-JP','japanese').catch(function(e){diag('音声診断：日本語OpenAIテスト失敗。'+(e.message||e),'error');});};}
    var rex=q('rexOpenAiTestBtn');
    if(rex&&!rex.dataset.v74test){rex.dataset.v74test='1';rex.onclick=function(){openai('こんにちは、レックスだよ。ぼくはいつでも味方だよ。一緒に英語をがんばろう。','ja-JP','rex').catch(function(e){diag('音声診断：レックスOpenAIテスト失敗。'+(e.message||e),'error');});};}
  }
  setTimeout(function(){bind();status();},300);
  setTimeout(function(){bind();status();},1200);
  setInterval(function(){bind();},1500);
  window.RexSpeech={speak:speak,speakText:speak,speakRex:function(en,ja){return speak(en,'en-US','rex').then(function(){return ja?speak(ja,'ja-JP','rex'):null;});},unlock:function(){return browser('Ready','en-US');},cancel:function(){try{if(speechSynthesis)speechSynthesis.cancel();}catch(e){}},isReady:function(){return true;},populateVoiceSelects:function(){},saveFromUI:save,settings:getSettings,diagnose:function(){status();},testJapaneseOpenAI:function(){return openai('こんにちは。これはOpenAIの日本語音声テストです。','ja-JP','japanese');},testRexOpenAI:function(){return openai('こんにちは、レックスだよ。ぼくはいつでも味方だよ。一緒に英語をがんばろう。','ja-JP','rex');}};
  window.RexVoiceSpeak=speak;
})();


/* v74: full OpenAI voice diagnostics */
(function(){
  function el(id){return document.getElementById(id)}
  function clearLog(){var b=el('voiceDiagLog'); if(b)b.textContent=''}
  function log(m){var b=el('voiceDiagLog'); var t=new Date().toLocaleTimeString(); if(b){var c=(b.textContent||'').indexOf('診断ログ')>=0?'':b.textContent; b.textContent=c+'['+t+'] '+m+'\n'; b.scrollTop=b.scrollHeight} console.log('[RexVoiceDiag]',m)}
  function sum(m,c){var s=el('voiceDiagSummary'); if(s){s.textContent=m;s.className='voiceDiagSummary '+(c||'')} var v=el('voiceDiagStatus'); if(v){v.textContent='音声診断：'+m;v.className='voiceDiagStatus '+(c||'')}}
  function raw(){try{return JSON.parse(localStorage.getItem('rexEnglishMaster.voice')||localStorage.getItem('rexVoiceSettings')||'{}')||{}}catch(e){return {}}}
  function settings(){var s=raw(); var p=el('openAiProxyUrl'),v=el('openAiVoiceSelect'),sf=el('voiceEngineSafari'); s.openAiProxyUrl=p?(p.value||'').trim():(s.openAiProxyUrl||''); s.openAiVoice=v?(v.value||s.openAiVoice||'coral'):(s.openAiVoice||'coral'); s.rexVoice=s.openAiVoice; s.voiceEngine=sf&&sf.checked?'safari':'openai'; s.openAiEnabled=s.voiceEngine!=='safari'; return s}
  function save(){var s=settings(); localStorage.setItem('rexEnglishMaster.voice',JSON.stringify(s)); localStorage.setItem('rexVoiceSettings',JSON.stringify(s)); return s}
  function url(s){var u=String((s||settings()).openAiProxyUrl||'').trim(); if(!u)return ''; if(!/\/tts\/?$/.test(u))u=u.replace(/\/+$/,'')+'/tts'; return u}
  async function post(u,payload){var r=await fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); var ct=r.headers.get('content-type')||''; var tx=''; if(!r.ok||ct.indexOf('audio')<0){try{tx=await r.text()}catch(e){}} return {ok:r.ok,status:r.status,ct:ct,text:tx,response:r}}
  async function play(r){var blob=await r.blob(); var u=URL.createObjectURL(blob); await new Promise(function(res,rej){var a=new Audio(u); a.onended=function(){URL.revokeObjectURL(u);res()}; a.onerror=function(){URL.revokeObjectURL(u);rej(new Error('audio playback error'))}; a.play().catch(rej)})}
  async function diagnose(){clearLog();sum('診断中...','checking'); var s=save(), u=url(s); log('保存済み設定: '+JSON.stringify({voiceEngine:s.voiceEngine,openAiEnabled:s.openAiEnabled,openAiProxyUrl:s.openAiProxyUrl,normalizedUrl:u,openAiVoice:s.openAiVoice,rexVoice:s.rexVoice},null,2)); if(!s.openAiProxyUrl){sum('❌ Worker URLが未入力です','error');log('NG: 音声プロキシURL欄が空です。');return false} log('OK: Worker URL入力あり'); log('実際にPOSTするURL: '+u); if(!/^https:\/\//.test(u)){sum('❌ URL形式エラー','error');log('NG: URLは https:// で始まる必要があります。');return false} var payload={text:'こんにちは。OpenAI音声診断テストです。',lang:'ja-JP',voice:s.openAiVoice||'coral',role:'diagnostic',instructions:'自然で聞き取りやすい日本語で、短く明るく話してください。'}; log('POST payload: '+JSON.stringify(payload,null,2)); var result; try{result=await post(u,payload)}catch(e){sum('❌ Workerへ通信できません','error');log('NG: fetch失敗: '+(e.message||e));return false} log('Worker応答 status='+result.status+' content-type='+result.ct); if(!result.ok){sum('❌ Worker/OpenAIエラー '+result.status,'error');log('Response body: '+(result.text||'(empty)')); if(result.status===401||/api|key|unauthorized|auth/i.test(result.text))log('推定原因: OPENAI_API_KEY が未設定または無効です。'); else if(result.status===404)log('推定原因: Workerが /tts を受け付けていません。'); else if(result.status===429)log('推定原因: OpenAI APIのレート制限またはクォータ不足です。'); else if(result.status>=500)log('推定原因: Worker内部エラーです。'); return false} if((result.ct||'').indexOf('audio')<0){sum('❌ 音声ではない応答です','error');log('content-type='+result.ct);log('Response body: '+(result.text||'(empty)'));return false} log('OK: 音声データを受信。再生テストします。'); try{await play(result.response);sum('✅ OpenAI音声接続OK','ok');log('OK: 音声再生まで成功しました。');return true}catch(e){sum('⚠️ 音声データ受信OK・再生失敗','error');log('audio playback failed: '+(e.message||e));return false}}
  function exportSettings(){clearLog(); var s=save(); sum('音声設定を表示しました','checking'); log(JSON.stringify({normalizedUrl:url(s),settings:s,localStorageVoice:localStorage.getItem('rexEnglishMaster.voice'),userAgent:navigator.userAgent},null,2))}
  function bind(){var b=el('openAiFullDiagBtn'); if(b&&!b.dataset.v74){b.dataset.v74='1';b.addEventListener('click',function(){diagnose().catch(function(e){sum('❌ 診断エラー','error');log('Exception: '+(e.stack||e.message||e))})})} var ex=el('exportVoiceSettingsBtn'); if(ex&&!ex.dataset.v74){ex.dataset.v74='1';ex.addEventListener('click',exportSettings)}}
  setTimeout(bind,300);setTimeout(bind,1200);setInterval(bind,1500); window.RexVoiceDiagnostics={run:diagnose,exportSettings:exportSettings};
})();

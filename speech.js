
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
    'rexEnglishMaster.voice.v70',
    'rexEnglishMaster.voice.v71',
    'rexVoiceSettings'
  ];

  var voiceSettings=Object.assign({}, DEFAULT_SETTINGS);

  function safeJson(raw){
    try{ return raw ? JSON.parse(raw) : null; }catch(e){ return null; }
  }

  function readSettings(){
    var merged=Object.assign({}, DEFAULT_SETTINGS);
    for(var i=0;i<SETTINGS_KEYS.length;i++){
      var v=safeJson(localStorage.getItem(SETTINGS_KEYS[i]));
      if(v) merged=Object.assign(merged, v);
    }

    // UI values are the source of truth when controls are visible.
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

  function voices(){
    return window.speechSynthesis && speechSynthesis.getVoices ? speechSynthesis.getVoices() : [];
  }
  function norm(s){ return String(s || '').toLowerCase(); }
  function isJapaneseVoice(v){
    return norm(v.lang).indexOf('ja')===0 || /japanese|日本|kyoko|otoya|nanami|haruka/i.test(v.name || '');
  }
  function isEnglishVoice(v){
    return norm(v.lang).indexOf('en')===0 || /english|samantha|karen|tessa|moira|ava|aria/i.test(v.name || '');
  }
  function findVoice(value){
    if(!value) return null;
    var vs=voices();
    for(var i=0;i<vs.length;i++){
      if(vs[i].voiceURI===value || vs[i].name===value) return vs[i];
    }
    return null;
  }

  function pickVoice(lang, role){
    readSettings();
    var isJa=String(lang || '').toLowerCase().indexOf('ja')===0;
    var selected = isJa ? findVoice(voiceSettings.jaVoiceURI) : findVoice(voiceSettings.enVoiceURI);
    if(selected) return selected;

    var list=voices().filter(isJa ? isJapaneseVoice : isEnglishVoice);
    var prefs=isJa
      ? ['Kyoko','Otoya','Nanami','Haruka','Siri','Japanese','日本']
      : ['Samantha','Karen','Tessa','Moira','Ava','Aria','Google US English','English'];
    for(var p=0;p<prefs.length;p++){
      for(var j=0;j<list.length;j++){
        if(norm(list[j].name).indexOf(norm(prefs[p]))>=0) return list[j];
      }
    }
    return list[0] || null;
  }

  function browserSpeak(text, lang, role){
    return new Promise(function(resolve){
      readSettings();
      text=String(text || '').trim();
      if(!text || !('speechSynthesis' in window)){ resolve(); return; }
      var done=false;
      function finish(){ if(done) return; done=true; resolve(); }

      try{ speechSynthesis.cancel(); }catch(e){}
      var u=new SpeechSynthesisUtterance(text);
      u.lang=lang || 'en-US';
      u.voice=pickVoice(u.lang, role);
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
    // Worker guide says POST /tts. If user entered root URL, add /tts.
    if(!/\/tts\/?$/.test(url)){
      url=url.replace(/\/+$/,'') + '/tts';
    }
    return url;
  }

  async function openAiSpeak(text, lang, role){
    readSettings();
    var proxy=normalizeProxyUrl(voiceSettings.openAiProxyUrl);
    if(!voiceSettings.openAiEnabled || !proxy) throw new Error('OpenAI voice not configured');
    text=String(text || '').trim();
    if(!text) return;

    var isJa=String(lang || '').toLowerCase().indexOf('ja')===0;
    var voice = role==='rex'
      ? (voiceSettings.rexVoice || voiceSettings.openAiVoice || 'marin')
      : (voiceSettings.openAiVoice || 'marin');

    var instructions;
    if(role==='rex'){
      instructions = isJa
        ? '明るく、かわいく、やさしい恐竜レックスの声で自然な日本語で話してください。中学生を前向きに励ます相棒の雰囲気。'
        : 'Speak as Rex, a cute friendly dinosaur buddy. Bright, warm, encouraging, and clear for a junior high school learner.';
    }else if(isJa){
      instructions = '自然で聞き取りやすい日本語で話してください。中学生向けに、やさしく明るい声。';
    }else{
      instructions = 'Speak clearly in natural English for a junior high school learner. Friendly and easy to understand.';
    }

    var res=await fetch(proxy,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({text:text, lang:lang || 'en-US', voice:voice, instructions:instructions, role:role || ''})
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
    if(voiceSettings.voiceEngine !== 'safari' && voiceSettings.openAiEnabled && voiceSettings.openAiProxyUrl){
      try{
        await openAiSpeak(text, lang, role);
        return;
      }catch(e){
        console.warn('OpenAI voice fallback to Safari:', e);
      }
    }
    return browserSpeak(text, lang, role);
  }

  function unlock(){
    if('speechSynthesis' in window) try{ speechSynthesis.cancel(); }catch(e){}
    return speak('Ready','en-US','rex').then(function(){ ready=true; return true; });
  }
  function cancel(){
    try{ if('speechSynthesis' in window) speechSynthesis.cancel(); }catch(e){}
  }
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
    var openRadio=document.getElementById('voiceEngineOpenAI');
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

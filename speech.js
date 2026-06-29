
(function(){
  var ready=false;
  var voiceSettings={
    enVoiceURI:'',jaVoiceURI:'',enRate:0.92,jaRate:0.82,enPitch:1.08,jaPitch:1.0,
    openAiEnabled:true,voiceEngine:'openai',openAiProxyUrl:'',openAiVoice:'marin'
  };

  function readSettings(){
    try{
      var saved=JSON.parse(localStorage.getItem('rexEnglishMaster.voice.v55')||localStorage.getItem('rexEnglishMaster.voice.v55')||'{}');
      voiceSettings=Object.assign(voiceSettings,saved||{});
    }catch(e){}
  }
  function saveSettings(next){
    voiceSettings=Object.assign(voiceSettings,next||{});
    localStorage.setItem('rexEnglishMaster.voice.v55',JSON.stringify(voiceSettings));
  }
  readSettings();
  if(!voiceSettings.voiceEngine){
    voiceSettings.voiceEngine = voiceSettings.openAiEnabled === false ? 'safari' : 'openai';
  }
  voiceSettings.openAiEnabled = voiceSettings.voiceEngine !== 'safari';

  function voices(){ return window.speechSynthesis && speechSynthesis.getVoices ? speechSynthesis.getVoices() : []; }
  function isJapaneseVoice(v){ return (v.lang||'').toLowerCase().indexOf('ja')===0 || /japanese|kyoko|otoya|siri/i.test(v.name||''); }
  function isEnglishVoice(v){ return (v.lang||'').toLowerCase().indexOf('en')===0 || /english|samantha|karen|tessa|moira|aria/i.test(v.name||''); }
  function byURI(uri){ if(!uri) return null; var vs=voices(); for(var i=0;i<vs.length;i++){ if(vs[i].voiceURI===uri) return vs[i]; } return null; }

  function pickVoice(lang){
    var selected = lang==='ja-JP' ? byURI(voiceSettings.jaVoiceURI) : byURI(voiceSettings.enVoiceURI);
    if(selected) return selected;
    var vs=voices();
    var list=vs.filter(function(v){ return lang==='ja-JP' ? isJapaneseVoice(v) : isEnglishVoice(v); });
    var prefs = lang==='ja-JP'
      ? ['Kyoko','Otoya','Siri','Japanese','Google 日本語','Microsoft Nanami','Microsoft Haruka']
      : ['Samantha','Karen','Tessa','Moira','Ava','Google US English','Microsoft Aria','English'];
    for(var p=0;p<prefs.length;p++){
      for(var j=0;j<list.length;j++){
        if((list[j].name||'').toLowerCase().indexOf(prefs[p].toLowerCase())>=0) return list[j];
      }
    }
    return list[0] || null;
  }

  function browserSpeak(text, lang){
    return new Promise(function(resolve){
      if(!text || !('speechSynthesis' in window)){ resolve(); return; }
      var done=false;
      function finish(){
        if(done) return;
        done=true;
        resolve();
      }
      var u = new SpeechSynthesisUtterance(text);
      u.lang=lang;
      u.voice=pickVoice(lang);
      if(lang==='ja-JP'){
        u.pitch=Number(voiceSettings.jaPitch||1.0);
        u.rate=Number(voiceSettings.jaRate||0.82);
      } else {
        u.pitch=Number(voiceSettings.enPitch||1.08);
        u.rate=Number(voiceSettings.enRate||0.92);
      }
      u.volume=1;
      u.onend=finish;
      u.onerror=finish;
      speechSynthesis.speak(u);

      // 安全タイマー。短すぎるとズレるので長めにする。
      var safeMs = Math.max(4500, String(text).length * (lang==='ja-JP' ? 260 : 190));
      setTimeout(finish, safeMs);
    });
  }

  async function openAiSpeak(text, lang){
    if(!voiceSettings.openAiEnabled || !voiceSettings.openAiProxyUrl) throw new Error('OpenAI voice not configured');
    var instructions = lang==='ja-JP'
      ? '明るく、やさしく、自然な日本語で話してください。中学生を応援するかわいい恐竜レックスの相棒らしい声。怒らず、前向き。'
      : 'Speak in a bright, friendly, encouraging voice like Rex, a cute dinosaur learning buddy. Clear pronunciation for a junior high school student.';
    var res = await fetch(voiceSettings.openAiProxyUrl, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({text:text, lang:lang, voice:voiceSettings.openAiVoice||'marin', instructions:instructions})
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

  async function speak(text, lang){
    if(voiceSettings.openAiEnabled && voiceSettings.openAiProxyUrl){
      try{ await openAiSpeak(text, lang); return; }
      catch(e){ console.warn(e); }
    }
    return browserSpeak(text, lang);
  }

  function unlock(){
    if(!('speechSynthesis' in window) && !voiceSettings.openAiEnabled){ return Promise.resolve(false); }
    if('speechSynthesis' in window) speechSynthesis.cancel();
    return speak('Ready','en-US').then(function(){ ready=true; return true; });
  }
  function isReady(){ return ready; }
  function cancel(){ if('speechSynthesis' in window) speechSynthesis.cancel(); }

  function populateVoiceSelects(){
    var enSel=document.getElementById('enVoiceSelect');
    var jaSel=document.getElementById('jaVoiceSelect');
    if(enSel && jaSel){
      var vs=voices();
      var en=vs.filter(isEnglishVoice);
      var ja=vs.filter(isJapaneseVoice);
      function fill(sel, arr, selectedURI, fallbackLabel){
        sel.innerHTML='';
        var auto=document.createElement('option'); auto.value=''; auto.textContent='自動選択（おすすめ）'; sel.appendChild(auto);
        if(!arr.length){ var opt=document.createElement('option'); opt.value=''; opt.textContent=fallbackLabel; sel.appendChild(opt); }
        else { arr.forEach(function(v){ var opt=document.createElement('option'); opt.value=v.voiceURI; opt.textContent=v.name+' / '+v.lang; sel.appendChild(opt); }); }
        sel.value=selectedURI||'';
      }
      fill(enSel,en,voiceSettings.enVoiceURI,'英語音声が見つかりません');
      fill(jaSel,ja,voiceSettings.jaVoiceURI,'日本語音声が見つかりません');
      var er=document.getElementById('enRateSelect'), jr=document.getElementById('jaRateSelect');
      if(er) er.value=String(voiceSettings.enRate||0.92);
      if(jr) jr.value=String(voiceSettings.jaRate||0.92);
    }

    var chk=document.getElementById('openAiVoiceEnabled');
    var openRadio=document.getElementById('voiceEngineOpenAI');
    var safariRadio=document.getElementById('voiceEngineSafari');
    var proxy=document.getElementById('openAiProxyUrl');
    var ovoice=document.getElementById('openAiVoiceSelect');
    if(openRadio) openRadio.checked=(voiceSettings.voiceEngine||'openai')==='openai';
    if(safariRadio) safariRadio.checked=(voiceSettings.voiceEngine||'openai')==='safari';
    if(chk) chk.checked=(voiceSettings.voiceEngine||'openai')==='openai';
    if(proxy) proxy.value=voiceSettings.openAiProxyUrl||'';
    if(ovoice) ovoice.value=voiceSettings.openAiVoice||'marin';
    if(openRadio) openRadio.onchange=function(){ if(chk) chk.checked=true; };
    if(safariRadio) safariRadio.onchange=function(){ if(chk) chk.checked=false; };
  }


  function bindVoiceAutoSave(){
    ['enVoiceSelect','jaVoiceSelect','enRateSelect','jaRateSelect','openAiVoiceEnabled','voiceEngineOpenAI','voiceEngineSafari','openAiProxyUrl','openAiVoiceSelect'].forEach(function(id){
      var el=document.getElementById(id);
      if(!el || el.dataset.rexVoiceAutoSave==='1') return;
      el.dataset.rexVoiceAutoSave='1';
      var ev = (el.tagName==='INPUT' && el.type==='text') ? 'input' : 'change';
      el.addEventListener(ev,function(){ saveFromUI(); });
    });
  }

  function saveFromUI(){
    var enSel=document.getElementById('enVoiceSelect');
    var jaSel=document.getElementById('jaVoiceSelect');
    var er=document.getElementById('enRateSelect');
    var jr=document.getElementById('jaRateSelect');
    var chk=document.getElementById('openAiVoiceEnabled');
    var openRadio=document.getElementById('voiceEngineOpenAI');
    var safariRadio=document.getElementById('voiceEngineSafari');
    var proxy=document.getElementById('openAiProxyUrl');
    var ovoice=document.getElementById('openAiVoiceSelect');
    var engine = safariRadio && safariRadio.checked ? 'safari' : 'openai';
    saveSettings({
      enVoiceURI: enSel ? enSel.value : '',
      jaVoiceURI: jaSel ? jaSel.value : '',
      enRate: er ? Number(er.value) : 0.92,
      jaRate: jr ? Number(jr.value) : 0.92,
      voiceEngine: engine,
      openAiEnabled: engine === 'openai',
      openAiProxyUrl: proxy ? proxy.value.trim() : '',
      openAiVoice: ovoice ? ovoice.value : 'marin'
    });
  }

  if('speechSynthesis' in window){
    speechSynthesis.onvoiceschanged=function(){ populateVoiceSelects(); };
    setTimeout(function(){ populateVoiceSelects(); bindVoiceAutoSave(); },300);
    setTimeout(function(){ populateVoiceSelects(); bindVoiceAutoSave(); },1200);
  } else {
    setTimeout(function(){ populateVoiceSelects(); bindVoiceAutoSave(); },300);
  }

  window.RexSpeech={
    speak:speak, speakText:speak, unlock:unlock, cancel:cancel, isReady:isReady,
    populateVoiceSelects:populateVoiceSelects, saveFromUI:saveFromUI,
    settings:function(){return voiceSettings;}
  };
})();


/* v55: sequential speech fix.
   Prevents Japanese from being read for a different English word during continuous playback. */
(function(){
  var seqToken = 0;
  function getMeaning(item){
    if(!item) return '';
    return item.ja || item.jp || item.meaning || item.mean || item.def || item.translation || '';
  }
  function getEnglish(item){
    if(!item) return '';
    return item.en || item.word || item.english || item.text || '';
  }
  function delay(ms){ return new Promise(function(resolve){ setTimeout(resolve, ms); }); }

  async function speakOneTextV50(text, lang){
    text = String(text || '').trim();
    if(!text) return;
    if(window.RexSpeech && typeof window.RexSpeech.speakText === 'function'){
      await window.RexSpeech.speakText(text, lang);
      return;
    }
    if(window.speakText && window.speakText !== speakOneTextV50){
      var r = window.speakText(text, lang);
      if(r && typeof r.then === 'function') await r;
      else await delay(350);
      return;
    }
    if('speechSynthesis' in window){
      await new Promise(function(resolve){
        var u = new SpeechSynthesisUtterance(text);
        u.lang = lang || 'en-US';
        u.onend = resolve;
        u.onerror = resolve;
        speechSynthesis.speak(u);
      });
    }
  }

  window.playWordSequenceV50 = async function(items, options){
    var token = ++seqToken;
    options = options || {};
    var interval = Number(options.interval || localStorage.getItem('rexSpeechInterval') || 0.4);
    var pattern = options.pattern || localStorage.getItem('rexSpeechPattern') || 'en-ja-en-ja';

    // Snapshot the current words first. This prevents index/current-card mutation while playing.
    var queue = (items || []).map(function(item){
      return {
        en: getEnglish(item),
        ja: getMeaning(item)
      };
    }).filter(function(x){ return x.en || x.ja; });

    if('speechSynthesis' in window) speechSynthesis.cancel();

    for(var i=0; i<queue.length; i++){
      if(token !== seqToken) return;
      var q = queue[i];

      if(pattern === 'en-ja-en-ja'){
        await speakOneTextV50(q.en, 'en-US'); if(token !== seqToken) return; await delay(interval*1000);
        await speakOneTextV50(q.ja, 'ja-JP'); if(token !== seqToken) return; await delay(interval*1000);
        await speakOneTextV50(q.en, 'en-US'); if(token !== seqToken) return; await delay(interval*1000);
        await speakOneTextV50(q.ja, 'ja-JP'); if(token !== seqToken) return; await delay(interval*1000);
      }else if(pattern === 'en-ja'){
        await speakOneTextV50(q.en, 'en-US'); if(token !== seqToken) return; await delay(interval*1000);
        await speakOneTextV50(q.ja, 'ja-JP'); if(token !== seqToken) return; await delay(interval*1000);
      }else{
        await speakOneTextV50(q.en, 'en-US'); if(token !== seqToken) return; await delay(interval*1000);
      }
    }
  };

  window.stopWordSequenceV50 = function(){
    seqToken++;
    if('speechSynthesis' in window) speechSynthesis.cancel();
  };

  // Compatibility aliases used by app.js variants.
  window.playContinuousWordsFixed = window.playWordSequenceV50;
})();

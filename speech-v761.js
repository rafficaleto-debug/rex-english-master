/* v76: Rebuilt voice engine.
   Kokoro is used only where the browser package actually supports voices reliably (English/Rex).
   Japanese is routed to Safari speech on iPhone because the public Kokoro browser model used here
   does not expose Japanese jf_* voices in the runtime voice list. This prevents silent failures. */
(function(){
  'use strict';
  var VERSION='v76.1-safari-stable-cachefix';
  var MODEL_ID='onnx-community/Kokoro-82M-v1.0-ONNX';
  var MODULE_URLS=['https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm','https://esm.sh/kokoro-js@1.2.1'];
  var LOAD_TIMEOUT_MS=120000;
  var GENERATE_TIMEOUT_MS=120000;
  var SUPPORTED_KOKORO_VOICES=['af_heart','af_alloy','af_aoede','af_bella','af_jessica','af_kore','af_nicole','af_nova','af_river','af_sarah','af_sky','am_adam','am_echo','am_eric','am_fenrir','am_liam','am_michael','am_onyx','am_puck','am_santa','bf_emma','bf_isabella','bm_george','bm_lewis','bf_alice','bf_lily','bm_daniel','bm_fable'];
  var DEFAULT_SETTINGS={enRate:0.9,jaRate:0.86,voiceEngine:'safari',kokoroEnabled:true,kokoroEnglishVoice:'af_heart',kokoroJapaneseVoice:'safari-ja',kokoroRexVoice:'af_heart',kokoroDType:'q8',kokoroDevice:'wasm',openAiEnabled:false,openAiProxyUrl:'',openAiVoice:'af_heart',rexVoice:'af_heart'};
  var SETTINGS_KEYS=['rexEnglishMaster.voice','rexEnglishMaster.voice.v75','rexEnglishMaster.voice.v74','rexVoiceSettings'];
  var settings=Object.assign({},DEFAULT_SETTINGS);
  var ttsInstance=null, ttsPromise=null, kokoroModule=null, audioContext=null;
  var queue=Promise.resolve();
  var unlocked=false, kokoroDisabled=false, lastError=null;

  function $(id){ return document.getElementById(id); }
  function now(){ return (new Date()).toLocaleTimeString(); }
  function setText(id,msg){ var el=$(id); if(el) el.textContent=msg; }
  function log(msg){ var el=$('voiceDiagLog'); if(!el) return; var old=(el.textContent||'').indexOf('診断ログ')>=0?'':el.textContent; el.textContent=old+'['+now()+'] '+msg+'\n'; el.scrollTop=el.scrollHeight; }
  function clearLog(){ var el=$('voiceDiagLog'); if(el) el.textContent=''; }
  function status(msg,cls){ setText('status',msg); var s=$('voiceDiagSummary'); if(s){s.textContent=msg; s.className='voiceDiagSummary '+(cls||'checking');} var d=$('voiceDiagStatus'); if(d){d.textContent='音声診断：'+msg; d.className='voiceDiagStatus '+(cls||'checking');} }
  function safeJson(x){ try{return x?JSON.parse(x):null;}catch(e){return null;} }
  function timeout(p,ms,label){ var timer; return Promise.race([p,new Promise(function(_,rej){timer=setTimeout(function(){rej(new Error(label+' timeout after '+Math.round(ms/1000)+'s'));},ms);})]).then(function(v){clearTimeout(timer);return v;},function(e){clearTimeout(timer);throw e;}); }
  function isJa(lang,text){ return String(lang||'').toLowerCase().indexOf('ja')===0 || /[ぁ-んァ-ン一-龯]/.test(String(text||'')); }
  function clamp(n,min,max,def){ n=Number(n); if(!isFinite(n)) return def; return Math.max(min,Math.min(max,n)); }
  function ensureAudioContext(){ try{ var AC=window.AudioContext||window.webkitAudioContext; if(!AC) return null; if(!audioContext) audioContext=new AC(); if(audioContext.state==='suspended') audioContext.resume().catch(function(){}); return audioContext; }catch(e){return null;} }

  function readSettings(){
    var merged=Object.assign({},DEFAULT_SETTINGS);
    SETTINGS_KEYS.forEach(function(k){ var v=safeJson(localStorage.getItem(k)); if(v){ var keep={}; ['enRate','jaRate','kokoroEnglishVoice','kokoroRexVoice','enVoiceSelect','jaVoiceSelect','enRateSelect','jaRateSelect'].forEach(function(key){ if(v[key]!=null) keep[key]=v[key]; }); merged=Object.assign(merged,keep); } });
    var en=$('kokoroEnglishVoiceSelect')||$('openAiVoiceSelect');
    var ja=$('kokoroJapaneseVoiceSelect');
    var rex=$('kokoroRexVoiceSelect');
    var er=$('enRateSelect'), jr=$('jaRateSelect');
    if(en) merged.kokoroEnglishVoice=en.value||merged.kokoroEnglishVoice;
    if(ja) merged.kokoroJapaneseVoice=ja.value||'safari-ja';
    if(rex) merged.kokoroRexVoice=rex.value||merged.kokoroRexVoice;
    if(er) merged.enRate=clamp(er.value,0.7,1.25,0.92);
    if(jr) merged.jaRate=clamp(jr.value,0.7,1.25,0.88);
    merged.voiceEngine=($('voiceEngineSafari')&&$('voiceEngineSafari').checked)?'safari':'kokoro';
    merged.openAiEnabled=false; merged.openAiProxyUrl=''; merged.rexVoice=merged.kokoroRexVoice; merged.openAiVoice=merged.kokoroEnglishVoice;
    settings=merged; window.REX_CURRENT_VOICE_SETTINGS=settings; return settings;
  }
  function saveSettings(next){ settings=Object.assign(readSettings(),next||{}); localStorage.setItem('rexEnglishMaster.voice',JSON.stringify(settings)); localStorage.setItem('rexEnglishMaster.voice.v75',JSON.stringify(settings)); localStorage.setItem('rexVoiceSettings',JSON.stringify(settings)); window.REX_CURRENT_VOICE_SETTINGS=settings; return settings; }

  function pickSafariVoice(lang,text){
    var voices=[]; try{ voices=speechSynthesis.getVoices()||[]; }catch(e){}
    var ja=isJa(lang,text); var prefs=ja?['Kyoko','Otoya','Hattori','Google 日本語','Japanese Japan']:['Samantha','Ava','Alex','Google US English','English United States'];
    for(var p=0;p<prefs.length;p++){ for(var i=0;i<voices.length;i++){ var v=voices[i]; if((v.name||'').indexOf(prefs[p])>=0) return v; } }
    for(var j=0;j<voices.length;j++){ if(ja && /^ja/i.test(voices[j].lang||'')) return voices[j]; if(!ja && /^en/i.test(voices[j].lang||'')) return voices[j]; }
    return null;
  }
  function safariSpeak(text,lang){
    return new Promise(function(resolve){
      text=String(text||'').trim(); if(!text || !('speechSynthesis' in window)){ resolve(); return; }
      try{ speechSynthesis.cancel(); }catch(e){}
      var u=new SpeechSynthesisUtterance(text); var ja=isJa(lang,text); u.lang=ja?'ja-JP':'en-US'; u.rate=ja?clamp(settings.jaRate,0.7,1.25,0.88):clamp(settings.enRate,0.7,1.25,0.9); u.pitch=1; u.volume=1;
      var v=pickSafariVoice(u.lang,text); if(v) u.voice=v;
      var done=false; function finish(){ if(done) return; done=true; resolve(); }
      u.onstart=function(){ log('Safari再生開始: '+u.lang+' voice='+(u.voice?u.voice.name:'auto')); }; u.onend=finish; u.onerror=function(ev){ log('Safari音声エラー: '+(ev&&ev.error?ev.error:'unknown')); finish(); };
      try{ speechSynthesis.speak(u); log('Safari speak投入: '+u.lang+' text='+text.slice(0,40)); }catch(e){ log('Safari speak例外: '+(e.message||e)); finish(); }
      setTimeout(finish,Math.max(3000,text.length*(ja?230:170)));
    });
  }
  function unlock(){
    readSettings(); ensureAudioContext(); unlocked=true; sessionStorage.setItem('rexEnglishMaster.audioUnlocked','1');
    // User-gesture friendly short utterance. This makes later Safari fallback much more reliable on iPhone.
    return safariSpeak('Ready','en-US').then(function(){ status('音声OK（Safari予備音声も準備済み）','ok'); return true; });
  }

  async function importKokoro(){
    if(kokoroModule) return kokoroModule; var err=null;
    for(var i=0;i<MODULE_URLS.length;i++){
      try{ log('Kokoroライブラリ読み込み: '+MODULE_URLS[i]); kokoroModule=await timeout(import(MODULE_URLS[i]),30000,'Kokoro library import'); return kokoroModule; }
      catch(e){ err=e; log('Kokoroライブラリ失敗: '+(e.message||e)); }
    }
    throw err||new Error('Kokoroライブラリを読み込めません');
  }
  async function getTTS(){
    if(kokoroDisabled) throw new Error('Kokoroは手動で無効化されています');
    if(ttsInstance) return ttsInstance; if(ttsPromise) return ttsPromise;
    status('Kokoro初回読み込み中…時間がかかります','checking');
    ttsPromise=(async function(){
      var mod=await importKokoro();
      var K=mod.KokoroTTS || (mod.default&&mod.default.KokoroTTS) || mod.default;
      if(!K || !K.from_pretrained) throw new Error('KokoroTTS.from_pretrained が見つかりません');
      var opts={dtype:settings.kokoroDType||'q8',device:settings.kokoroDevice||'wasm',progress_callback:function(p){ var label=(p&&p.file)||p&&p.name||p&&p.status||''; var pr=(p&&typeof p.progress==='number')?Math.round(p.progress)+'% ':''; if(label||pr){ log('progress: '+pr+String(label).split('/').pop()); } }};
      var tts=await timeout(K.from_pretrained(MODEL_ID,opts),LOAD_TIMEOUT_MS,'Kokoro model load');
      ttsInstance=tts; status('Kokoro準備OK','ok'); log('OK: Kokoroモデル読み込み完了'); return tts;
    })().catch(function(e){ lastError=e; ttsPromise=null; status('Kokoro読み込み失敗。Safari予備音声で続行','error'); log('Kokoro読み込みNG: '+(e.stack||e.message||e)); throw e; });
    return ttsPromise;
  }
  function selectedKokoroVoice(role){
    readSettings(); var v=(role==='rex')?settings.kokoroRexVoice:settings.kokoroEnglishVoice;
    return SUPPORTED_KOKORO_VOICES.indexOf(v)>=0?v:'af_heart';
  }
  function rawAudio(raw){
    if(!raw) return null; var d=raw.audio||raw.data||raw.waveform||raw.samples||raw.array; if(d&&d.data) d=d.data; if(d instanceof Float32Array) return d; if(Array.isArray(d)) return new Float32Array(d); return null;
  }
  function wavBlob(samples,rate){
    rate=rate||24000; var n=samples.length; var buf=new ArrayBuffer(44+n*2), v=new DataView(buf); function s(o,t){for(var i=0;i<t.length;i++)v.setUint8(o+i,t.charCodeAt(i));}
    s(0,'RIFF');v.setUint32(4,36+n*2,true);s(8,'WAVE');s(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);s(36,'data');v.setUint32(40,n*2,true);var off=44;for(var i=0;i<n;i++,off+=2){var x=Math.max(-1,Math.min(1,samples[i]));v.setInt16(off,x<0?x*0x8000:x*0x7fff,true);}return new Blob([buf],{type:'audio/wav'});
  }
  async function toBlob(raw){ if(raw&&typeof raw.toBlob==='function') return await raw.toBlob(); if(raw&&typeof raw.blob==='function') return await raw.blob(); var d=rawAudio(raw); if(!d) throw new Error('Kokoroの音声データ形式を解釈できません'); return wavBlob(d,raw.sample_rate||raw.sampling_rate||raw.sampleRate||24000); }
  async function playBlob(blob){
    ensureAudioContext(); var url=URL.createObjectURL(blob);
    return new Promise(function(resolve,reject){ var a=new Audio(url); a.preload='auto'; a.onended=function(){URL.revokeObjectURL(url); resolve();}; a.onerror=function(){URL.revokeObjectURL(url); reject(new Error('Audio再生エラー'));}; var p=a.play(); if(p&&p.catch) p.catch(function(e){URL.revokeObjectURL(url); reject(e);}); });
  }
  async function kokoroSpeak(text,lang,role){
    if(isJa(lang,text)) throw new Error('このKokoroブラウザモデルには日本語voiceがありません。日本語はSafari音声を使います。');
    var tts=await getTTS(); var voice=selectedKokoroVoice(role); var speed=clamp(settings.enRate,0.7,1.25,0.92);
    status('Kokoro生成中… '+voice,'checking'); log('Kokoro生成 voice='+voice+' text='+String(text).slice(0,50));
    var raw=await timeout(tts.generate(String(text).slice(0,500),{voice:voice,speed:speed}),GENERATE_TIMEOUT_MS,'Kokoro generate');
    var blob=await toBlob(raw); await playBlob(blob); status('Kokoro音声OK','ok');
  }
  function speak(text,lang,role){
    queue=queue.then(async function(){
      readSettings();
      var useKokoro=settings.voiceEngine!=='safari' && !isJa(lang,text) && !kokoroDisabled;
      if(useKokoro){ try{ await kokoroSpeak(text,lang,role); return; }catch(e){ lastError=e; log('Kokoro失敗→Safari: '+(e.message||e)); status('Safari予備音声で再生','checking'); } }
      await safariSpeak(text,lang);
    });
    return queue;
  }
  function cancel(){ try{ if(window.speechSynthesis) speechSynthesis.cancel(); }catch(e){} queue=Promise.resolve(); }

  function opts(list,selected){ return list.map(function(o){return '<option value="'+o[0]+'"'+(o[0]===selected?' selected':'')+'>'+o[1]+'</option>';}).join(''); }
  function populateVoiceSelects(){
    readSettings();
    var enList=[['af_heart','af_heart（英語・おすすめ）'],['af_bella','af_bella（英語・自然）'],['af_nova','af_nova（英語）'],['af_sarah','af_sarah（英語）'],['am_puck','am_puck（レックス候補）'],['am_fenrir','am_fenrir（男性）'],['am_onyx','am_onyx（低め）']];
    var jaList=[['safari-ja','Safari日本語（安定・おすすめ）']];
    var rexList=[['af_heart','af_heart（レックスおすすめ）'],['am_puck','am_puck（元気）'],['am_fenrir','am_fenrir（低め）'],['am_onyx','am_onyx（太め）']];
    var en=$('kokoroEnglishVoiceSelect')||$('openAiVoiceSelect'); if(en) en.innerHTML=opts(enList,settings.kokoroEnglishVoice);
    var ja=$('kokoroJapaneseVoiceSelect'); if(ja) ja.innerHTML=opts(jaList,'safari-ja');
    var rex=$('kokoroRexVoiceSelect'); if(rex) rex.innerHTML=opts(rexList,settings.kokoroRexVoice);
    var proxy=$('openAiProxyUrl'); if(proxy) proxy.value='URL不要・APIキー不要';
    var o=$('voiceEngineOpenAI'), sf=$('voiceEngineSafari'); if(o) o.checked=settings.voiceEngine!=='safari'; if(sf) sf.checked=settings.voiceEngine==='safari';
    if($('openAiVoiceSaveBtn')) $('openAiVoiceSaveBtn').textContent='Kokoro音声設定を保存';
    if($('openAiVoiceTestBtn')) $('openAiVoiceTestBtn').textContent='英語音声テスト';
    if($('jaOpenAiTestBtn')) $('jaOpenAiTestBtn').textContent='日本語音声テスト';
    if($('rexOpenAiTestBtn')) $('rexOpenAiTestBtn').textContent='レックス音声テスト';
    if($('openAiFullDiagBtn')) $('openAiFullDiagBtn').textContent='音声接続診断';
  }
  function saveFromUI(){ saveSettings(); status('音声設定を保存しました','ok'); log('設定保存: '+JSON.stringify(settings)); return settings; }
  async function diagnose(){
    clearLog(); saveFromUI(); kokoroDisabled=false;
    log('v76診断開始: '+JSON.stringify({model:MODEL_ID, english:settings.kokoroEnglishVoice, japanese:'safari-ja', rex:settings.kokoroRexVoice, note:'日本語はSafari安全音声'},null,2));
    await unlock();
    await safariSpeak('Hello. Safari English voice test.','en-US');
    await safariSpeak('こんにちは。日本語音声テストです。','ja-JP');
    if(settings.voiceEngine!=='safari'){ try{ await kokoroSpeak('Hello. This is Kokoro English voice test.','en-US','english'); log('OK: Kokoro英語音声'); } catch(e){ log('Kokoro英語NG: '+(e.message||e)); } }
    status('診断完了：まずSafari音声ルートを確認しました','ok'); log('OK: 診断完了'); return true;
  }
  function exportSettings(){ clearLog(); log(JSON.stringify({version:VERSION, settings:readSettings(), supportedKokoroVoices:SUPPORTED_KOKORO_VOICES, lastError:lastError?String(lastError.message||lastError):null},null,2)); }
  function resetKokoro(){ ttsInstance=null; ttsPromise=null; kokoroModule=null; kokoroDisabled=false; lastError=null; status('Kokoroをリセットしました','checking'); log('Kokoro reset'); }
  function useSafariFallback(){ kokoroDisabled=true; if($('voiceEngineSafari')) $('voiceEngineSafari').checked=true; saveSettings({voiceEngine:'safari'}); status('Safari予備音声モード','checking'); log('Safari予備音声に固定'); }

  function bind(){
    ['openAiVoiceSelect','kokoroJapaneseVoiceSelect','kokoroRexVoiceSelect','enRateSelect','jaRateSelect','voiceEngineOpenAI','voiceEngineSafari'].forEach(function(id){ var el=$(id); if(!el||el.dataset.v76) return; el.dataset.v76='1'; el.addEventListener('change',saveFromUI); });
    var map=[['unlockAudioBtn',function(){unlock();}],['voiceTestBtn',function(){cancel(); speak('Great job! Let us try one more sentence.','en-US').then(function(){return speak('今日もよくがんばったね。','ja-JP');});}],['voiceSaveBtn',saveFromUI],['openAiVoiceSaveBtn',saveFromUI],['openAiVoiceTestBtn',function(){speak('Hello! I am Rex. I am always on your side.','en-US','rex');}],['jaOpenAiTestBtn',function(){speak('こんにちは。日本語音声テストです。','ja-JP','japanese');}],['rexOpenAiTestBtn',function(){speak('Hello! I am Rex. Let us study English together.','en-US','rex');}],['openAiFullDiagBtn',diagnose],['exportVoiceSettingsBtn',exportSettings]];
    map.forEach(function(x){ var el=$(x[0]); if(!el||el.dataset.v76click) return; el.dataset.v76click='1'; el.addEventListener('click',function(ev){ try{ ev.preventDefault(); }catch(e){} x[1](); }); });
  }
  function init(){ populateVoiceSelects(); bind(); status('音声スタートを押してください','checking'); if('speechSynthesis' in window){ speechSynthesis.onvoiceschanged=function(){ populateVoiceSelects(); }; } }
  setTimeout(init,100); setTimeout(init,1000); setInterval(bind,2000);
  window.RexSpeech={speak:speak,speakText:speak,speakRex:function(en,ja){return speak(en,'en-US','rex').then(function(){return ja?speak(ja,'ja-JP','rex'):null;});},unlock:unlock,cancel:cancel,isReady:function(){return unlocked;},populateVoiceSelects:populateVoiceSelects,saveFromUI:saveFromUI,settings:readSettings,diagnose:diagnose,resetKokoro:resetKokoro,useSafariFallback:useSafariFallback,testJapaneseOpenAI:function(){return speak('こんにちは。日本語音声テストです。','ja-JP','japanese');},testRexOpenAI:function(){return speak('Hello! I am Rex. Let us study English together.','en-US','rex');}};
  window.RexVoiceSpeak=speak; window.RexVoiceDiagnostics={run:diagnose,exportSettings:exportSettings,reset:resetKokoro,safari:useSafariFallback};
})();

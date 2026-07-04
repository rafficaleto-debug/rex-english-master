/* v75.2: Kokoro-first voice engine with iPhone/Safari safe diagnostics.
   No OpenAI, no Cloudflare, no API key. If Kokoro cannot load on the device, it fails visibly
   and falls back to Safari only so the app never freezes. */
(function(){
  'use strict';

  var VERSION='v75.2-kokoro-safari-safe';
  var MODEL_ID='onnx-community/Kokoro-82M-v1.0-ONNX';
  var MODULE_URLS=[
    'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm',
    'https://esm.sh/kokoro-js@1.2.1'
  ];
  var LOAD_TIMEOUT_MS=45000;
  var GENERATE_TIMEOUT_MS=30000;

  var DEFAULT_SETTINGS={
    enVoiceURI:'', jaVoiceURI:'', enRate:0.92, jaRate:0.92, enPitch:1.0, jaPitch:1.0,
    voiceEngine:'kokoro', kokoroEnabled:true,
    kokoroEnglishVoice:'af_heart', kokoroJapaneseVoice:'jf_alpha', kokoroRexVoice:'af_heart',
    kokoroDType:'q8', kokoroDevice:'wasm',
    openAiEnabled:false, openAiProxyUrl:'', openAiVoice:'', rexVoice:'af_heart'
  };
  var SETTINGS_KEYS=['rexEnglishMaster.voice','rexEnglishMaster.voice.v75','rexEnglishMaster.voice.v74','rexVoiceSettings'];
  var voiceSettings=Object.assign({}, DEFAULT_SETTINGS);
  var ttsPromise=null, ttsInstance=null, audioContext=null, audioQueue=Promise.resolve(), ready=false;
  var lastLoadError=null, forceSafari=false;

  function q(id){return document.getElementById(id);} 
  function now(){return (new Date()).toLocaleTimeString();}
  function setText(id,msg){var el=q(id); if(el) el.textContent=msg;}
  function status(msg, cls){
    setText('status',msg);
    var ds=q('voiceDiagStatus'); if(ds){ ds.textContent='音声診断：'+msg; ds.className='voiceDiagStatus '+(cls||'checking'); }
    var sm=q('voiceDiagSummary'); if(sm){ sm.textContent=msg; sm.className='voiceDiagSummary '+(cls||'checking'); }
  }
  function log(msg){
    var el=q('voiceDiagLog'); if(!el) return;
    var old=(el.textContent||'').indexOf('診断ログ')>=0 ? '' : el.textContent;
    el.textContent=old+'['+now()+'] '+msg+'\n'; el.scrollTop=el.scrollHeight;
  }
  function clearLog(){var l=q('voiceDiagLog'); if(l) l.textContent='';}
  function safeJson(raw){try{return raw?JSON.parse(raw):null;}catch(e){return null;}}
  function withTimeout(promise, ms, label){
    var t; var timeout=new Promise(function(_,reject){t=setTimeout(function(){reject(new Error(label+' timeout after '+Math.round(ms/1000)+'s'));},ms);});
    return Promise.race([promise,timeout]).finally(function(){clearTimeout(t);});
  }

  function readSettings(){
    var merged=Object.assign({}, DEFAULT_SETTINGS);
    SETTINGS_KEYS.forEach(function(k){var v=safeJson(localStorage.getItem(k)); if(v) merged=Object.assign(merged,v);});
    var en=q('kokoroEnglishVoiceSelect') || q('openAiVoiceSelect');
    var ja=q('kokoroJapaneseVoiceSelect'); var rex=q('kokoroRexVoiceSelect');
    var er=q('enRateSelect'); var jr=q('jaRateSelect');
    if(en) merged.kokoroEnglishVoice=en.value || merged.kokoroEnglishVoice || 'af_heart';
    if(ja) merged.kokoroJapaneseVoice=ja.value || merged.kokoroJapaneseVoice || 'jf_alpha';
    if(rex) merged.kokoroRexVoice=rex.value || merged.kokoroRexVoice || merged.kokoroEnglishVoice || 'af_heart';
    if(er) merged.enRate=Number(er.value || merged.enRate || 0.92);
    if(jr) merged.jaRate=Number(jr.value || merged.jaRate || 0.92);
    merged.voiceEngine='kokoro'; merged.kokoroEnabled=true; merged.openAiEnabled=false; merged.openAiProxyUrl=''; merged.rexVoice=merged.kokoroRexVoice;
    voiceSettings=merged; window.REX_CURRENT_VOICE_SETTINGS=voiceSettings; return voiceSettings;
  }
  function saveSettings(next){
    voiceSettings=Object.assign(readSettings(), next||{});
    localStorage.setItem('rexEnglishMaster.voice',JSON.stringify(voiceSettings));
    localStorage.setItem('rexEnglishMaster.voice.v75',JSON.stringify(voiceSettings));
    localStorage.setItem('rexVoiceSettings',JSON.stringify(voiceSettings));
    window.REX_CURRENT_VOICE_SETTINGS=voiceSettings; return voiceSettings;
  }
  function ensureAudioContext(){
    try{ var AC=window.AudioContext||window.webkitAudioContext; if(!AC) return null; if(!audioContext) audioContext=new AC(); if(audioContext.state==='suspended') audioContext.resume().catch(function(){}); return audioContext; }
    catch(e){return null;}
  }

  async function importKokoro(){
    var lastErr=null;
    for(var i=0;i<MODULE_URLS.length;i++){
      try{ log('Kokoroライブラリ読み込み開始: '+MODULE_URLS[i]); return await withTimeout(import(MODULE_URLS[i]),15000,'Kokoro library import'); }
      catch(e){ lastErr=e; log('ライブラリ読み込み失敗: '+(e.message||e)); }
    }
    throw lastErr || new Error('kokoro-js import failed');
  }
  function progressLabel(p){
    if(!p) return '';
    var file=p.file||p.name||p.status||''; var pct=(typeof p.progress==='number')?Math.round(p.progress):null;
    return (pct!=null?pct+'% ':'')+(file?String(file).split('/').pop():'');
  }
  async function getTTS(){
    if(forceSafari) throw new Error('Kokoroはこの端末で無効化されています。Safari音声に切替済みです。');
    if(ttsInstance) return ttsInstance;
    if(ttsPromise) return ttsPromise;
    status('Kokoro初回読み込み中…最大45秒待ちます','checking');
    log('iPhone/Safari対策版 v75.2: 読み込みタイムアウトつきで開始');
    ttsPromise=(async function(){
      var mod=await importKokoro();
      var KokoroTTS=mod.KokoroTTS || (mod.default&&mod.default.KokoroTTS) || mod.default;
      if(!KokoroTTS || !KokoroTTS.from_pretrained) throw new Error('KokoroTTS.from_pretrained が見つかりません');
      var opts={ dtype:voiceSettings.kokoroDType||'q8', device:voiceSettings.kokoroDevice||'wasm', progress_callback:function(p){var label=progressLabel(p); if(label) {status('Kokoro準備中 '+label,'checking'); log('progress: '+label);} } };
      var tts=await withTimeout(KokoroTTS.from_pretrained(MODEL_ID,opts), LOAD_TIMEOUT_MS, 'Kokoro model load');
      ttsInstance=tts; ready=true; status('Kokoro準備OK','ok'); log('OK: Kokoroモデル読み込み完了'); return tts;
    })().catch(function(e){ lastLoadError=e; ttsPromise=null; status('Kokoro読み込み失敗。Safari予備音声に切替できます','error'); log('NG: '+(e.stack||e.message||e)); throw e; });
    return ttsPromise;
  }

  function isJa(lang,text){return String(lang||'').toLowerCase().indexOf('ja')===0 || /[ぁ-んァ-ン一-龯]/.test(String(text||''));}
  function selectKokoroVoice(text,lang,role){ var s=readSettings(); if(role==='rex') return s.kokoroRexVoice||s.kokoroEnglishVoice||'af_heart'; return isJa(lang,text)?(s.kokoroJapaneseVoice||'jf_alpha'):(s.kokoroEnglishVoice||'af_heart'); }
  function speedFor(text,lang){ var s=readSettings(); var rate=isJa(lang,text)?Number(s.jaRate||0.92):Number(s.enRate||0.92); return Math.max(0.7,Math.min(1.25,rate)); }
  function rawAudioData(raw){
    if(!raw) return null; var data=raw.audio||raw.data||raw.waveform||raw.samples||raw.array;
    if(data&&data.data&&(data.data instanceof Float32Array||Array.isArray(data.data))) data=data.data;
    if(data instanceof Float32Array) return data; if(data instanceof ArrayBuffer) return new Float32Array(data); if(Array.isArray(data)) return new Float32Array(data); return null;
  }
  function rawSampleRate(raw){return raw.sample_rate||raw.sampling_rate||raw.sampleRate||raw.rate||24000;}
  function wavBlobFromFloat32(samples,sampleRate){
    var n=samples.length, buffer=new ArrayBuffer(44+n*2), view=new DataView(buffer);
    function str(off,s){for(var i=0;i<s.length;i++) view.setUint8(off+i,s.charCodeAt(i));}
    str(0,'RIFF'); view.setUint32(4,36+n*2,true); str(8,'WAVE'); str(12,'fmt '); view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,1,true);
    view.setUint32(24,sampleRate,true); view.setUint32(28,sampleRate*2,true); view.setUint16(32,2,true); view.setUint16(34,16,true); str(36,'data'); view.setUint32(40,n*2,true);
    var offset=44; for(var i=0;i<n;i++,offset+=2){var s=Math.max(-1,Math.min(1,samples[i])); view.setInt16(offset,s<0?s*0x8000:s*0x7fff,true);} return new Blob([buffer],{type:'audio/wav'});
  }
  async function blobFromRawAudio(raw){ if(raw&&typeof raw.toBlob==='function') return await raw.toBlob(); if(raw&&typeof raw.blob==='function') return await raw.blob(); var data=rawAudioData(raw); if(!data) throw new Error('Kokoro音声データを取り出せません'); return wavBlobFromFloat32(data,rawSampleRate(raw)); }
  async function playBlob(blob){
    ensureAudioContext(); var url=URL.createObjectURL(blob);
    await new Promise(function(resolve,reject){ var a=new Audio(url); a.preload='auto'; a.onended=function(){URL.revokeObjectURL(url); resolve();}; a.onerror=function(){URL.revokeObjectURL(url); reject(new Error('audio playback error'));}; var p=a.play(); if(p&&p.catch) p.catch(function(err){URL.revokeObjectURL(url); reject(err);}); });
  }
  function browserSpeak(text,lang){
    return new Promise(function(resolve){ text=String(text||'').trim(); if(!text||!('speechSynthesis' in window)){resolve();return;} var done=false; function finish(){if(done)return;done=true;resolve();}
      try{speechSynthesis.cancel();}catch(e){} var u=new SpeechSynthesisUtterance(text); u.lang=lang||'en-US'; u.rate=isJa(lang,text)?0.86:0.88; u.pitch=1; u.volume=1; u.onend=finish; u.onerror=finish;
      try{speechSynthesis.speak(u);}catch(e){finish();} setTimeout(finish,Math.max(3000,text.length*(isJa(lang,text)?230:170))); });
  }
  async function kokoroSpeakOnce(text,lang,role){
    text=String(text||'').trim(); if(!text) return; var tts=await getTTS(); var voice=selectKokoroVoice(text,lang,role), speed=speedFor(text,lang);
    status('Kokoro生成中… '+voice,'checking'); log('generate voice='+voice+' speed='+speed+' text='+text.slice(0,60));
    var raw=await withTimeout(tts.generate(text,{voice:voice,speed:speed}),GENERATE_TIMEOUT_MS,'Kokoro generate'); var blob=await blobFromRawAudio(raw); await playBlob(blob); status('Kokoro音声OK','ok');
  }
  async function speak(text,lang,role){
    audioQueue=audioQueue.then(async function(){
      if(forceSafari){ await browserSpeak(text,lang); return; }
      try{ await kokoroSpeakOnce(text,lang,role); }
      catch(e){ console.warn('Kokoro failed, fallback to Safari:',e); log('Kokoro失敗: '+(e.message||e)); status('Kokoro失敗。Safariで再生しました','error'); await browserSpeak(text,lang); }
    });
    return audioQueue;
  }

  async function diagnose(){
    clearLog(); saveSettings(); forceSafari=false; status('Kokoro診断中…','checking');
    log('設定: '+JSON.stringify({version:VERSION, model:MODEL_ID, english:voiceSettings.kokoroEnglishVoice, japanese:voiceSettings.kokoroJapaneseVoice, rex:voiceSettings.kokoroRexVoice, dtype:voiceSettings.kokoroDType, device:voiceSettings.kokoroDevice, timeoutSeconds:LOAD_TIMEOUT_MS/1000},null,2));
    try{ await getTTS(); await kokoroSpeakOnce('Hello. This is Kokoro English voice test.','en-US','english'); await kokoroSpeakOnce('こんにちは。これはココロの日本語音声テストです。','ja-JP','japanese'); status('✅ Kokoro接続OK','ok'); log('OK: Kokoro音声の生成と再生に成功しました。'); ready=true; return true; }
    catch(e){ status('❌ Kokoro診断失敗：Safari予備音声は利用可能','error'); log('NG: '+(e.stack||e.message||e)); log('対策: 通信の良い環境で再読み込み、またはPC/Android Chromeで確認してください。iPhoneではモデル読み込みが失敗する場合があります。'); return false; }
  }

  function fillSelect(sel,opts,selected){ if(!sel) return; var old=sel.value||selected; sel.innerHTML=''; opts.forEach(function(o){var opt=document.createElement('option'); opt.value=o[0]; opt.textContent=o[1]; sel.appendChild(opt);}); sel.value=old; if(!sel.value&&opts[0]) sel.value=opts[0][0]; }
  function populateVoiceSelects(){
    readSettings();
    var enOpts=[['af_heart','af_heart（英語・おすすめ）'],['af_bella','af_bella（英語・自然）'],['af_sarah','af_sarah（英語）'],['af_nova','af_nova（英語）'],['am_puck','am_puck（英語・レックス候補）'],['am_fenrir','am_fenrir（英語・男性）']];
    var jaOpts=[['jf_alpha','jf_alpha（日本語・おすすめ）'],['jf_gongitsune','jf_gongitsune（日本語）'],['jf_nezumi','jf_nezumi（日本語）'],['jf_tebukuro','jf_tebukuro（日本語）'],['jm_kumo','jm_kumo（日本語・男性）']];
    var rexOpts=[['af_heart','af_heart（レックスおすすめ）'],['am_puck','am_puck（元気）'],['am_fenrir','am_fenrir（低め）'],['jf_alpha','jf_alpha（日本語レックス）'],['jm_kumo','jm_kumo（日本語男性）']];
    fillSelect(q('kokoroEnglishVoiceSelect')||q('openAiVoiceSelect'),enOpts,voiceSettings.kokoroEnglishVoice); fillSelect(q('kokoroJapaneseVoiceSelect'),jaOpts,voiceSettings.kokoroJapaneseVoice); fillSelect(q('kokoroRexVoiceSelect'),rexOpts,voiceSettings.kokoroRexVoice);
    var er=q('enRateSelect'), jr=q('jaRateSelect'); if(er) er.value=String(voiceSettings.enRate||0.92); if(jr) jr.value=String(voiceSettings.jaRate||0.92);
    var open=q('voiceEngineOpenAI'); if(open) open.checked=true; var safari=q('voiceEngineSafari'); if(safari) safari.checked=false; var chk=q('openAiVoiceEnabled'); if(chk) chk.checked=true; var proxy=q('openAiProxyUrl'); if(proxy) proxy.value='KokoroはURL不要';
  }
  function saveFromUI(){ var s=saveSettings(); status('Kokoro設定を保存しました','ok'); return s; }
  function resetKokoro(){ ttsPromise=null; ttsInstance=null; lastLoadError=null; forceSafari=false; ready=false; status('Kokoroをリセットしました','checking'); log('Kokoro loader reset'); }
  function useSafariFallback(){ forceSafari=true; ready=true; status('Safari予備音声モード','checking'); log('手動でSafari予備音声に切替'); }
  function bindVoiceAutoSave(){
    ['kokoroEnglishVoiceSelect','kokoroJapaneseVoiceSelect','kokoroRexVoiceSelect','openAiVoiceSelect','enRateSelect','jaRateSelect','voiceEngineOpenAI','voiceEngineSafari'].forEach(function(id){var el=q(id); if(!el||el.dataset.v752kokoro) return; el.dataset.v752kokoro='1'; el.addEventListener('change',saveFromUI);});
    var unlock=q('unlockAudioBtn'); if(unlock&&!unlock.dataset.v752kokoro){unlock.dataset.v752kokoro='1'; unlock.addEventListener('click',function(){ensureAudioContext(); speak('Ready','en-US','rex');});}
    var save=q('openAiVoiceSaveBtn'); if(save&&!save.dataset.v752kokoro){save.dataset.v752kokoro='1'; save.textContent='Kokoro音声設定を保存'; save.addEventListener('click',saveFromUI);} 
    var test=q('openAiVoiceTestBtn'); if(test&&!test.dataset.v752kokoro){test.dataset.v752kokoro='1'; test.textContent='Kokoro英語テスト'; test.addEventListener('click',function(){speak('Hello! I am Rex. I am always on your side.','en-US','rex');});}
    var ja=q('jaOpenAiTestBtn'); if(ja&&!ja.dataset.v752kokoro){ja.dataset.v752kokoro='1'; ja.textContent='日本語Kokoroテスト'; ja.addEventListener('click',function(){speak('こんにちは。これはココロの日本語音声テストです。','ja-JP','japanese');});}
    var rex=q('rexOpenAiTestBtn'); if(rex&&!rex.dataset.v752kokoro){rex.dataset.v752kokoro='1'; rex.textContent='レックスKokoroテスト'; rex.addEventListener('click',function(){speak('こんにちは、レックスだよ。ぼくはいつでも味方だよ。一緒に英語をがんばろう。','ja-JP','rex');});}
    var diag=q('openAiFullDiagBtn'); if(diag&&!diag.dataset.v752kokoro){diag.dataset.v752kokoro='1'; diag.textContent='Kokoro接続診断'; diag.addEventListener('click',function(){diagnose();});}
    var exp=q('exportVoiceSettingsBtn'); if(exp&&!exp.dataset.v752kokoro){exp.dataset.v752kokoro='1'; exp.textContent='Kokoro設定を表示'; exp.addEventListener('click',function(){clearLog(); log(JSON.stringify(Object.assign({},readSettings(),{lastLoadError:lastLoadError?String(lastLoadError.message||lastLoadError):null}),null,2)); status('Kokoro設定を表示しました','checking');});}
  }
  setTimeout(function(){populateVoiceSelects(); bindVoiceAutoSave(); status('Kokoro未読み込み。音声スタートを押してください','checking');},200);
  setTimeout(function(){populateVoiceSelects(); bindVoiceAutoSave();},1000); setInterval(bindVoiceAutoSave,1500);

  window.RexSpeech={
    speak:speak, speakText:speak, speakRex:function(en,ja){return speak(en,'en-US','rex').then(function(){return ja?speak(ja,'ja-JP','rex'):null;});},
    unlock:function(){ensureAudioContext(); return speak('Ready','en-US','rex').then(function(){ready=true; return true;});}, cancel:function(){try{if(speechSynthesis)speechSynthesis.cancel();}catch(e){}},
    isReady:function(){return ready;}, populateVoiceSelects:populateVoiceSelects, saveFromUI:saveFromUI, settings:function(){return readSettings();}, diagnose:diagnose, resetKokoro:resetKokoro, useSafariFallback:useSafariFallback,
    testJapaneseOpenAI:function(){return speak('こんにちは。これはココロの日本語音声テストです。','ja-JP','japanese');}, testRexOpenAI:function(){return speak('こんにちは、レックスだよ。ぼくはいつでも味方だよ。一緒に英語をがんばろう。','ja-JP','rex');}
  };
  window.RexVoiceSpeak=speak; window.RexVoiceDiagnostics={run:diagnose,exportSettings:function(){clearLog();log(JSON.stringify(readSettings(),null,2));}, reset:resetKokoro, safari:useSafariFallback};
})();

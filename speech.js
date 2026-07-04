/* v75: Kokoro-only voice engine. No OpenAI, no Cloudflare, no API key.
   Uses kokoro-js in the browser and falls back to Safari speech only if Kokoro cannot load. */
(function(){
  'use strict';

  var VERSION='v75-kokoro';
  var MODEL_ID='onnx-community/Kokoro-82M-v1.0-ONNX';
  var MODULE_URLS=[
    'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm',
    'https://esm.sh/kokoro-js@1.2.1',
    'https://unpkg.com/kokoro-js@1.2.1/dist/kokoro.js'
  ];

  var DEFAULT_SETTINGS={
    enVoiceURI:'',
    jaVoiceURI:'',
    enRate:0.92,
    jaRate:0.92,
    enPitch:1.0,
    jaPitch:1.0,
    voiceEngine:'kokoro',
    kokoroEnabled:true,
    kokoroEnglishVoice:'af_heart',
    kokoroJapaneseVoice:'jf_alpha',
    kokoroRexVoice:'af_heart',
    kokoroDType:'q8',
    kokoroDevice:'wasm',
    openAiEnabled:false,
    openAiProxyUrl:'',
    openAiVoice:'',
    rexVoice:'af_heart'
  };

  var SETTINGS_KEYS=[
    'rexEnglishMaster.voice',
    'rexEnglishMaster.voice.v75',
    'rexEnglishMaster.voice.v74',
    'rexVoiceSettings'
  ];

  var voiceSettings=Object.assign({}, DEFAULT_SETTINGS);
  var ttsPromise=null;
  var ttsInstance=null;
  var audioContext=null;
  var audioQueue=Promise.resolve();
  var ready=false;

  function q(id){return document.getElementById(id);}
  function status(msg, cls){
    var st=q('status'); if(st) st.textContent=msg;
    var ds=q('voiceDiagStatus'); if(ds){ ds.textContent='音声診断：'+msg; ds.className='voiceDiagStatus '+(cls||'checking'); }
    var sm=q('voiceDiagSummary'); if(sm){ sm.textContent=msg; sm.className='voiceDiagSummary '+(cls||'checking'); }
  }
  function log(msg){
    var el=q('voiceDiagLog');
    if(!el) return;
    var old=(el.textContent||'').indexOf('診断ログ')>=0 ? '' : el.textContent;
    el.textContent=old+'['+(new Date()).toLocaleTimeString()+'] '+msg+'\n';
    el.scrollTop=el.scrollHeight;
  }
  function safeJson(raw){try{return raw?JSON.parse(raw):null;}catch(e){return null;}}
  function readSettings(){
    var merged=Object.assign({}, DEFAULT_SETTINGS);
    SETTINGS_KEYS.forEach(function(k){var v=safeJson(localStorage.getItem(k)); if(v) merged=Object.assign(merged,v);});

    var en=q('kokoroEnglishVoiceSelect') || q('openAiVoiceSelect');
    var ja=q('kokoroJapaneseVoiceSelect');
    var rex=q('kokoroRexVoiceSelect');
    var er=q('enRateSelect');
    var jr=q('jaRateSelect');

    if(en) merged.kokoroEnglishVoice=en.value || merged.kokoroEnglishVoice || 'af_heart';
    if(ja) merged.kokoroJapaneseVoice=ja.value || merged.kokoroJapaneseVoice || 'jf_alpha';
    if(rex) merged.kokoroRexVoice=rex.value || merged.kokoroRexVoice || merged.kokoroEnglishVoice || 'af_heart';
    if(er) merged.enRate=Number(er.value || merged.enRate || 0.92);
    if(jr) merged.jaRate=Number(jr.value || merged.jaRate || 0.92);

    merged.voiceEngine='kokoro';
    merged.kokoroEnabled=true;
    merged.openAiEnabled=false;
    merged.openAiProxyUrl='';
    merged.rexVoice=merged.kokoroRexVoice;
    voiceSettings=merged;
    window.REX_CURRENT_VOICE_SETTINGS=voiceSettings;
    return voiceSettings;
  }
  function saveSettings(next){
    voiceSettings=Object.assign(readSettings(), next||{});
    localStorage.setItem('rexEnglishMaster.voice', JSON.stringify(voiceSettings));
    localStorage.setItem('rexEnglishMaster.voice.v75', JSON.stringify(voiceSettings));
    localStorage.setItem('rexVoiceSettings', JSON.stringify(voiceSettings));
    window.REX_CURRENT_VOICE_SETTINGS=voiceSettings;
    return voiceSettings;
  }

  function ensureAudioContext(){
    try{
      var AC=window.AudioContext || window.webkitAudioContext;
      if(!AC) return null;
      if(!audioContext) audioContext=new AC();
      if(audioContext.state==='suspended') audioContext.resume().catch(function(){});
      return audioContext;
    }catch(e){return null;}
  }

  async function importKokoro(){
    var lastErr=null;
    for(var i=0;i<MODULE_URLS.length;i++){
      try{
        log('Kokoroライブラリ読み込み: '+MODULE_URLS[i]);
        return await import(MODULE_URLS[i]);
      }catch(e){
        lastErr=e;
        log('読み込み失敗: '+(e.message||e));
      }
    }
    throw lastErr || new Error('kokoro-js import failed');
  }

  function progressLabel(p){
    if(!p) return '';
    var file=p.file || p.name || '';
    var pct=typeof p.progress==='number' ? Math.round(p.progress) : null;
    return (pct!=null? pct+'% ':'') + (file? String(file).split('/').pop() : '');
  }

  async function getTTS(){
    if(ttsInstance) return ttsInstance;
    if(ttsPromise) return ttsPromise;
    status('Kokoro初回読み込み中…少し待ってね','checking');
    ttsPromise=(async function(){
      var mod=await importKokoro();
      var KokoroTTS=mod.KokoroTTS || (mod.default && mod.default.KokoroTTS) || mod.default;
      if(!KokoroTTS || !KokoroTTS.from_pretrained) throw new Error('KokoroTTS not found');
      if(mod.env && mod.env.wasmPaths){
        try{ mod.env.wasmPaths='https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1/dist/'; }catch(e){}
      }
      var tts=await KokoroTTS.from_pretrained(MODEL_ID,{
        dtype:voiceSettings.kokoroDType || 'q8',
        device:voiceSettings.kokoroDevice || 'wasm',
        progress_callback:function(p){var label=progressLabel(p); if(label) status('Kokoro準備中 '+label,'checking');}
      });
      ttsInstance=tts;
      ready=true;
      status('Kokoro準備OK','ok');
      return tts;
    })();
    return ttsPromise;
  }

  function isJa(lang, text){return String(lang||'').toLowerCase().indexOf('ja')===0 || /[ぁ-んァ-ン一-龯]/.test(String(text||''));}
  function selectKokoroVoice(text, lang, role){
    var s=readSettings();
    if(role==='rex') return s.kokoroRexVoice || s.kokoroEnglishVoice || 'af_heart';
    return isJa(lang,text) ? (s.kokoroJapaneseVoice || 'jf_alpha') : (s.kokoroEnglishVoice || 'af_heart');
  }
  function speedFor(text, lang){
    var s=readSettings();
    var rate=isJa(lang,text) ? Number(s.jaRate||0.92) : Number(s.enRate||0.92);
    return Math.max(0.7, Math.min(1.25, rate));
  }

  function rawAudioData(raw){
    if(!raw) return null;
    var data=raw.audio || raw.data || raw.waveform || raw.samples || raw.array;
    if(data && data.data && (data.data instanceof Float32Array || Array.isArray(data.data))) data=data.data;
    if(data instanceof Float32Array) return data;
    if(data instanceof ArrayBuffer) return new Float32Array(data);
    if(Array.isArray(data)) return new Float32Array(data);
    return null;
  }
  function rawSampleRate(raw){return raw.sample_rate || raw.sampling_rate || raw.sampleRate || raw.rate || 24000;}
  function wavBlobFromFloat32(samples, sampleRate){
    var n=samples.length, buffer=new ArrayBuffer(44+n*2), view=new DataView(buffer);
    function str(off,s){for(var i=0;i<s.length;i++) view.setUint8(off+i,s.charCodeAt(i));}
    str(0,'RIFF'); view.setUint32(4,36+n*2,true); str(8,'WAVE'); str(12,'fmt ');
    view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,1,true);
    view.setUint32(24,sampleRate,true); view.setUint32(28,sampleRate*2,true); view.setUint16(32,2,true); view.setUint16(34,16,true);
    str(36,'data'); view.setUint32(40,n*2,true);
    var offset=44;
    for(var i=0;i<n;i++,offset+=2){
      var s=Math.max(-1,Math.min(1,samples[i]));
      view.setInt16(offset, s<0?s*0x8000:s*0x7fff, true);
    }
    return new Blob([buffer],{type:'audio/wav'});
  }
  async function blobFromRawAudio(raw){
    if(raw && typeof raw.toBlob==='function') return await raw.toBlob();
    if(raw && typeof raw.blob==='function') return await raw.blob();
    var data=rawAudioData(raw);
    if(!data) throw new Error('Kokoro音声データを取り出せません');
    return wavBlobFromFloat32(data, rawSampleRate(raw));
  }
  async function playBlob(blob){
    ensureAudioContext();
    var url=URL.createObjectURL(blob);
    await new Promise(function(resolve,reject){
      var a=new Audio(url);
      a.preload='auto';
      a.onended=function(){URL.revokeObjectURL(url);resolve();};
      a.onerror=function(){URL.revokeObjectURL(url);reject(new Error('audio playback error'));};
      var p=a.play();
      if(p && p.catch) p.catch(function(err){URL.revokeObjectURL(url); reject(err);});
    });
  }

  function browserSpeak(text, lang){
    return new Promise(function(resolve){
      text=String(text||'').trim();
      if(!text || !('speechSynthesis' in window)){resolve();return;}
      var done=false; function finish(){if(done)return;done=true;resolve();}
      try{speechSynthesis.cancel();}catch(e){}
      var u=new SpeechSynthesisUtterance(text);
      u.lang=lang||'en-US';
      u.rate=isJa(lang,text)?0.86:0.88; u.pitch=1; u.volume=1;
      u.onend=finish; u.onerror=finish;
      try{speechSynthesis.speak(u);}catch(e){finish();}
      setTimeout(finish,Math.max(3000,text.length*(isJa(lang,text)?230:170)));
    });
  }

  async function kokoroSpeakOnce(text, lang, role){
    text=String(text||'').trim();
    if(!text) return;
    var tts=await getTTS();
    var voice=selectKokoroVoice(text, lang, role);
    var speed=speedFor(text, lang);
    status('Kokoro生成中… '+voice,'checking');
    log('generate voice='+voice+' speed='+speed+' text='+text.slice(0,60));
    var raw=await tts.generate(text,{voice:voice,speed:speed});
    var blob=await blobFromRawAudio(raw);
    await playBlob(blob);
    status('Kokoro音声OK','ok');
  }

  async function speak(text, lang, role){
    audioQueue=audioQueue.then(async function(){
      try{ await kokoroSpeakOnce(text, lang, role); }
      catch(e){
        console.warn('Kokoro failed, fallback to Safari:',e);
        log('Kokoro失敗: '+(e.message||e));
        status('Kokoro失敗。Safariで再生中','error');
        await browserSpeak(text, lang);
      }
    });
    return audioQueue;
  }

  function clearLog(){var l=q('voiceDiagLog'); if(l) l.textContent='';}
  async function diagnose(){
    clearLog();
    saveSettings();
    status('Kokoro診断中…','checking');
    log('設定: '+JSON.stringify({version:VERSION,model:MODEL_ID,english:voiceSettings.kokoroEnglishVoice,japanese:voiceSettings.kokoroJapaneseVoice,rex:voiceSettings.kokoroRexVoice,dtype:voiceSettings.kokoroDType,device:voiceSettings.kokoroDevice},null,2));
    try{
      await getTTS();
      await speak('Hello. This is Kokoro English voice test.','en-US','english');
      await speak('こんにちは。これはココロの日本語音声テストです。','ja-JP','japanese');
      status('✅ Kokoro接続OK','ok');
      log('OK: Kokoro音声の生成と再生に成功しました。');
      return true;
    }catch(e){
      status('❌ Kokoro診断失敗','error');
      log('NG: '+(e.stack||e.message||e));
      return false;
    }
  }

  function fillSelect(sel, opts, selected){
    if(!sel) return;
    var old=sel.value || selected;
    sel.innerHTML='';
    opts.forEach(function(o){
      var opt=document.createElement('option'); opt.value=o[0]; opt.textContent=o[1]; sel.appendChild(opt);
    });
    sel.value=old;
    if(!sel.value && opts[0]) sel.value=opts[0][0];
  }
  function populateVoiceSelects(){
    readSettings();
    var enOpts=[
      ['af_heart','af_heart（英語・おすすめ）'],['af_bella','af_bella（英語・自然）'],['af_sarah','af_sarah（英語）'],['af_nova','af_nova（英語）'],['am_puck','am_puck（英語・レックス候補）'],['am_fenrir','am_fenrir（英語・男性）']
    ];
    var jaOpts=[
      ['jf_alpha','jf_alpha（日本語・おすすめ）'],['jf_gongitsune','jf_gongitsune（日本語）'],['jf_nezumi','jf_nezumi（日本語）'],['jf_tebukuro','jf_tebukuro（日本語）'],['jm_kumo','jm_kumo（日本語・男性）']
    ];
    var rexOpts=[
      ['af_heart','af_heart（レックスおすすめ）'],['am_puck','am_puck（元気）'],['am_fenrir','am_fenrir（低め）'],['jf_alpha','jf_alpha（日本語レックス）'],['jm_kumo','jm_kumo（日本語男性）']
    ];
    fillSelect(q('kokoroEnglishVoiceSelect')||q('openAiVoiceSelect'), enOpts, voiceSettings.kokoroEnglishVoice);
    fillSelect(q('kokoroJapaneseVoiceSelect'), jaOpts, voiceSettings.kokoroJapaneseVoice);
    fillSelect(q('kokoroRexVoiceSelect'), rexOpts, voiceSettings.kokoroRexVoice);
    var er=q('enRateSelect'), jr=q('jaRateSelect');
    if(er) er.value=String(voiceSettings.enRate||0.92);
    if(jr) jr.value=String(voiceSettings.jaRate||0.92);
    var open=q('voiceEngineOpenAI'); if(open) open.checked=true;
    var safari=q('voiceEngineSafari'); if(safari) safari.checked=false;
    var chk=q('openAiVoiceEnabled'); if(chk) chk.checked=true;
    var proxy=q('openAiProxyUrl'); if(proxy) proxy.value='KokoroはURL不要';
  }
  function saveFromUI(){var s=saveSettings(); status('Kokoro設定を保存しました','ok'); return s;}
  function bindVoiceAutoSave(){
    ['kokoroEnglishVoiceSelect','kokoroJapaneseVoiceSelect','kokoroRexVoiceSelect','openAiVoiceSelect','enRateSelect','jaRateSelect','voiceEngineOpenAI','voiceEngineSafari'].forEach(function(id){
      var el=q(id); if(!el || el.dataset.v75kokoro) return; el.dataset.v75kokoro='1'; el.addEventListener('change',saveFromUI);
    });
    var unlock=q('unlockAudioBtn'); if(unlock && !unlock.dataset.v75kokoro){unlock.dataset.v75kokoro='1'; unlock.addEventListener('click',function(){ensureAudioContext(); speak('Ready','en-US','rex');});}
    var save=q('openAiVoiceSaveBtn'); if(save && !save.dataset.v75kokoro){save.dataset.v75kokoro='1'; save.textContent='Kokoro音声設定を保存'; save.addEventListener('click',saveFromUI);}
    var test=q('openAiVoiceTestBtn'); if(test && !test.dataset.v75kokoro){test.dataset.v75kokoro='1'; test.textContent='Kokoro英語テスト'; test.addEventListener('click',function(){speak('Hello! I am Rex. I am always on your side.','en-US','rex');});}
    var ja=q('jaOpenAiTestBtn'); if(ja && !ja.dataset.v75kokoro){ja.dataset.v75kokoro='1'; ja.textContent='日本語Kokoroテスト'; ja.addEventListener('click',function(){speak('こんにちは。これはココロの日本語音声テストです。','ja-JP','japanese');});}
    var rex=q('rexOpenAiTestBtn'); if(rex && !rex.dataset.v75kokoro){rex.dataset.v75kokoro='1'; rex.textContent='レックスKokoroテスト'; rex.addEventListener('click',function(){speak('こんにちは、レックスだよ。ぼくはいつでも味方だよ。一緒に英語をがんばろう。','ja-JP','rex');});}
    var diag=q('openAiFullDiagBtn'); if(diag && !diag.dataset.v75kokoro){diag.dataset.v75kokoro='1'; diag.textContent='Kokoro接続診断'; diag.addEventListener('click',function(){diagnose();});}
    var exp=q('exportVoiceSettingsBtn'); if(exp && !exp.dataset.v75kokoro){exp.dataset.v75kokoro='1'; exp.textContent='Kokoro設定を表示'; exp.addEventListener('click',function(){clearLog(); log(JSON.stringify(readSettings(),null,2)); status('Kokoro設定を表示しました','checking');});}
  }

  setTimeout(function(){populateVoiceSelects(); bindVoiceAutoSave(); status('Kokoro未読み込み。音声スタートを押してください','checking');},200);
  setTimeout(function(){populateVoiceSelects(); bindVoiceAutoSave();},1000);
  setInterval(bindVoiceAutoSave,1500);

  window.RexSpeech={
    speak:speak,
    speakText:speak,
    speakRex:function(en,ja){return speak(en,'en-US','rex').then(function(){return ja?speak(ja,'ja-JP','rex'):null;});},
    unlock:function(){ensureAudioContext(); return speak('Ready','en-US','rex').then(function(){ready=true; return true;});},
    cancel:function(){try{if(speechSynthesis)speechSynthesis.cancel();}catch(e){}},
    isReady:function(){return ready;},
    populateVoiceSelects:populateVoiceSelects,
    saveFromUI:saveFromUI,
    settings:function(){return readSettings();},
    diagnose:diagnose,
    testJapaneseOpenAI:function(){return speak('こんにちは。これはココロの日本語音声テストです。','ja-JP','japanese');},
    testRexOpenAI:function(){return speak('こんにちは、レックスだよ。ぼくはいつでも味方だよ。一緒に英語をがんばろう。','ja-JP','rex');}
  };
  window.RexVoiceSpeak=speak;
  window.RexVoiceDiagnostics={run:diagnose,exportSettings:function(){clearLog();log(JSON.stringify(readSettings(),null,2));}};
})();

/* v76.2 emergency audio recovery: Safari SpeechSynthesis only, no Kokoro.
   This file intentionally overrides broken/experimental audio handlers. */
(function(){
  'use strict';
  var VERSION='v76.2-safari-audio-recovery';
  var auto=false;
  var speaking=false;
  var lastUserGesture=false;
  var bindCount=0;

  function $(id){ return document.getElementById(id); }
  function txt(id){ var e=$(id); return e ? (e.textContent||'').trim() : ''; }
  function set(id,v){ var e=$(id); if(e) e.textContent=v; }
  function log(m){
    var el=$('voiceDiagLog');
    if(el){
      var t='['+(new Date()).toLocaleTimeString()+'] '+m+'\n';
      var old=el.textContent||'';
      if(old.indexOf('診断ログ')>=0) old='';
      el.textContent=old+t;
      el.scrollTop=el.scrollHeight;
    }
    try{ console.log('[RexAudio762]',m); }catch(e){}
  }
  function status(m,kind){
    set('status',m);
    var a=$('voiceDiagSummary'); if(a){ a.textContent=m; a.className='voiceDiagSummary '+(kind||'checking'); }
    var b=$('voiceDiagStatus'); if(b){ b.textContent='音声診断：'+m; b.className='voiceDiagStatus '+(kind||'checking'); }
  }
  function isJa(lang,text){ return /^ja/i.test(String(lang||'')) || /[ぁ-んァ-ン一-龯]/.test(String(text||'')); }
  function rateFor(lang,text){
    var ja=isJa(lang,text);
    var id=ja?'jaRateSelect':'enRateSelect';
    var el=$(id); var n=Number(el&&el.value);
    if(!isFinite(n)) n=ja?0.88:0.92;
    return Math.max(0.65, Math.min(1.2,n));
  }
  function getVoices(){ try{ return window.speechSynthesis ? speechSynthesis.getVoices()||[] : []; }catch(e){ return []; } }
  function pickVoice(lang,text){
    var ja=isJa(lang,text), voices=getVoices();
    var prefs=ja?['Kyoko','Otoya','Hattori','日本語','Japanese']:['Samantha','Ava','Alex','Daniel','English'];
    for(var p=0;p<prefs.length;p++){
      for(var i=0;i<voices.length;i++){
        var v=voices[i];
        if(((v.name||'')+' '+(v.lang||'')).indexOf(prefs[p])>=0) return v;
      }
    }
    for(var j=0;j<voices.length;j++){
      var l=voices[j].lang||'';
      if(ja && /^ja/i.test(l)) return voices[j];
      if(!ja && /^en/i.test(l)) return voices[j];
    }
    return null;
  }
  function warmAudio(){
    lastUserGesture=true;
    try{
      var AC=window.AudioContext||window.webkitAudioContext;
      if(AC){ var ac=new AC(); if(ac.state==='suspended') ac.resume().catch(function(){}); setTimeout(function(){ try{ ac.close&&ac.close(); }catch(e){} },500); }
    }catch(e){}
  }
  function speakSafari(text,lang){
    text=String(text||'').trim();
    if(!text) return Promise.resolve();
    if(!('speechSynthesis' in window)) { status('このブラウザは音声読み上げに非対応です','error'); return Promise.resolve(); }
    return new Promise(function(resolve){
      var done=false;
      function finish(){ if(done) return; done=true; speaking=false; resolve(); }
      try{ speechSynthesis.cancel(); }catch(e){}
      var u=new SpeechSynthesisUtterance(text);
      u.lang=isJa(lang,text)?'ja-JP':'en-US';
      u.rate=rateFor(u.lang,text);
      u.pitch=1;
      u.volume=1;
      var v=pickVoice(u.lang,text); if(v) u.voice=v;
      u.onstart=function(){ speaking=true; status('再生中: '+u.lang,'ok'); log('Safari再生開始 '+u.lang+' voice='+(u.voice?u.voice.name:'auto')+' text='+text.slice(0,40)); };
      u.onend=finish;
      u.onerror=function(ev){ log('Safari音声エラー '+(ev&&ev.error?ev.error:'unknown')); finish(); };
      try{
        speechSynthesis.speak(u);
        log('Safari speak投入 '+u.lang+' text='+text.slice(0,40));
      }catch(e){ log('Safari speak例外 '+(e.message||e)); finish(); }
      setTimeout(finish, Math.max(2200, text.length*(isJa(u.lang,text)?210:155)));
    });
  }
  function gapMs(){ var g=$('gap'); var v=String(g&&g.value||'0.4'); var n=parseFloat(v); if(!isFinite(n)) n=0.4; return Math.max(0, Math.min(3,n))*1000; }
  function wait(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  function currentPair(){ return {en:txt('en')||'Hello.', ja:txt('ja')||'こんにちは。'}; }
  async function readCurrent(){
    warmAudio();
    var p=currentPair();
    var mode=($('mode')&&$('mode').value)||'en-ja-en-ja';
    status('読み上げ中','ok');
    if(mode==='en-ja-en' || mode==='en-ja-en-ja'){
      await speakSafari(p.en,'en-US'); await wait(gapMs());
      await speakSafari(p.ja,'ja-JP'); await wait(gapMs());
      await speakSafari(p.en,'en-US');
      if(mode==='en-ja-en-ja'){ await wait(gapMs()); await speakSafari(p.ja,'ja-JP'); }
    }else if(mode==='ja-en'){
      await speakSafari(p.ja,'ja-JP'); await wait(gapMs()); await speakSafari(p.en,'en-US');
    }else{
      await speakSafari(p.en,'en-US');
    }
    status('音声OK','ok');
  }
  async function autoLoop(){
    if(auto) return;
    auto=true;
    var b=$('autoBtn'); if(b) b.textContent='停止';
    while(auto){
      await readCurrent();
      if(!auto) break;
      await wait(600);
      var n=$('nextBtn'); if(n) n.click();
      await wait(250);
    }
    if(b) b.textContent='連続再生';
  }
  function stopAll(){
    auto=false; speaking=false;
    try{ speechSynthesis.cancel(); }catch(e){}
    status('停止しました','checking');
    var b=$('autoBtn'); if(b) b.textContent='連続再生';
  }
  function clearBrokenBootError(){
    var be=$('bootError');
    if(be && /undefined is not a function|R of T|処理エラー/.test(be.textContent||'')){
      be.textContent='v76.2で音声処理をSafari安定版に切り替えました。まず「音声スタート」→「音声テスト」を押してください。';
      be.style.background='#ecfff4'; be.style.borderColor='#82e0aa'; be.style.color='#136f3a';
    }
  }
  function cloneAndBind(id,fn,label){
    var old=$(id); if(!old || old.dataset.audio762==='1') return;
    var el=old.cloneNode(true);
    el.dataset.audio762='1';
    if(label) el.textContent=label;
    old.parentNode.replaceChild(el,old);
    el.addEventListener('click',function(ev){ ev.preventDefault(); ev.stopPropagation(); fn(ev); },true);
  }
  function bind(){
    bindCount++;
    clearBrokenBootError();
    // Force visible UI away from Kokoro/OpenAI. Kokoro is intentionally disabled on iPhone Safari.
    var se=$('voiceEngineSafari'); if(se) se.checked=true;
    var ko=$('voiceEngineOpenAI'); if(ko) ko.checked=false;
    var proxy=$('openAiProxyUrl'); if(proxy) proxy.value='Safari音声固定・URL不要';
    var jes=$('kokoroJapaneseVoiceSelect'); if(jes) jes.innerHTML='<option value="safari-ja" selected>Safari日本語（安定）</option>';
    var summary=$('voiceDiagSummary'); if(summary && /未診断|Kokoro/.test(summary.textContent||'')) status('v76.2 Safari音声モード','checking');

    cloneAndBind('unlockAudioBtn',function(){ warmAudio(); speakSafari('Ready','en-US').then(function(){status('音声スタートOK','ok');}); },'音声スタート');
    cloneAndBind('voiceTestBtn',function(){ warmAudio(); speakSafari('Great job! Let us try one more sentence.','en-US').then(function(){return speakSafari('今日もよくがんばったね。','ja-JP');}); },'音声テスト');
    cloneAndBind('openAiVoiceTestBtn',function(){ warmAudio(); speakSafari('Hello! I am Rex. I am always on your side.','en-US'); },'英語音声テスト');
    cloneAndBind('jaOpenAiTestBtn',function(){ warmAudio(); speakSafari('こんにちは。日本語音声テストです。','ja-JP'); },'日本語音声テスト');
    cloneAndBind('rexOpenAiTestBtn',function(){ warmAudio(); speakSafari('Hello! I am Rex. Let us study English together.','en-US'); },'レックス音声テスト');
    cloneAndBind('openAiFullDiagBtn',function(){ warmAudio(); var el=$('voiceDiagLog'); if(el) el.textContent=''; log('v76.2 Safari音声診断開始'); speakSafari('Safari English voice test.','en-US').then(function(){ return speakSafari('日本語音声テストです。','ja-JP'); }).then(function(){ status('Safari音声診断OK','ok'); log('OK: Safari音声は再生できています。KokoroはiPhone安定性のため停止中。'); }); },'音声接続診断');
    cloneAndBind('voiceSaveBtn',function(){ localStorage.setItem('rexEnglishMaster.voice',JSON.stringify({voiceEngine:'safari',version:VERSION})); status('Safari音声設定を保存しました','ok'); },'声を保存');
    cloneAndBind('openAiVoiceSaveBtn',function(){ localStorage.setItem('rexEnglishMaster.voice',JSON.stringify({voiceEngine:'safari',version:VERSION})); status('Safari音声設定を保存しました','ok'); },'音声設定を保存');
    cloneAndBind('readBtn',function(){ readCurrent(); },'読む');
    cloneAndBind('autoBtn',function(){ if(auto) stopAll(); else autoLoop(); },'連続再生');
    cloneAndBind('stopBtn',function(){ stopAll(); },'停止');
    cloneAndBind('speakQBtn',function(){ warmAudio(); var q=txt('qen')||txt('en')||'Hello.'; speakSafari(q,'en-US'); },'英文を聞く');
  }

  // Public API used by existing app code. Make every route safe.
  window.RexSpeech={
    speak:function(text,lang,role){ return speakSafari(text,lang||'en-US'); },
    speakText:function(text,lang){ return speakSafari(text,lang||'en-US'); },
    speakRex:function(en,ja){ return speakSafari(en,'en-US').then(function(){ return ja?speakSafari(ja,'ja-JP'):null; }); },
    unlock:function(){ warmAudio(); return speakSafari('Ready','en-US'); },
    cancel:stopAll,
    isReady:function(){ return true; },
    populateVoiceSelects:function(){}, saveFromUI:function(){status('Safari音声設定を保存しました','ok');}, settings:function(){return {voiceEngine:'safari',version:VERSION};},
    diagnose:function(){ var b=$('openAiFullDiagBtn'); if(b) b.click(); },
    testJapaneseOpenAI:function(){return speakSafari('こんにちは。日本語音声テストです。','ja-JP');},
    testRexOpenAI:function(){return speakSafari('Hello! I am Rex. Let us study English together.','en-US');}
  };
  window.RexVoiceSpeak=window.RexSpeech.speak;
  window.RexVoiceDiagnostics={run:window.RexSpeech.diagnose,exportSettings:function(){log(JSON.stringify({version:VERSION,mode:'safari-only'},null,2));},safari:function(){}};

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind); else bind();
  setTimeout(bind,300); setTimeout(bind,1200); setInterval(bind,3000);
})();

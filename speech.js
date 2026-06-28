
(function(){
  var ready=false;
  function pickVoice(lang){
    var voices = window.speechSynthesis && speechSynthesis.getVoices ? speechSynthesis.getVoices() : [];
    var prefix = lang.toLowerCase().slice(0,2);
    var list = voices.filter(function(v){ return (v.lang || '').toLowerCase().indexOf(prefix)===0; });
    var prefs = lang==='ja-JP' ? ['Kyoko','Otoya','Siri','Google 日本語','Japanese'] : ['Samantha','Karen','Tessa','Moira','Google US English','Microsoft Aria','English'];
    for(var i=0;i<prefs.length;i++){
      for(var j=0;j<list.length;j++){
        if((list[j].name || '').toLowerCase().indexOf(prefs[i].toLowerCase())>=0) return list[j];
      }
    }
    return list[0] || null;
  }
  if('speechSynthesis' in window){ speechSynthesis.onvoiceschanged=function(){ speechSynthesis.getVoices(); }; }
  function speak(text, lang){
    return new Promise(function(resolve){
      if(!text || !('speechSynthesis' in window)){ resolve(); return; }
      var u = new SpeechSynthesisUtterance(text);
      u.lang=lang; u.voice=pickVoice(lang);
      u.pitch=lang==='ja-JP'?1.28:1.22;
      u.rate=lang==='ja-JP'?1.04:.92;
      u.volume=1;
      u.onend=resolve; u.onerror=resolve;
      speechSynthesis.speak(u);
      setTimeout(resolve, Math.max(1650, text.length*125));
    });
  }
  function unlock(){
    if(!('speechSynthesis' in window)){ return Promise.resolve(false); }
    speechSynthesis.cancel();
    return speak('Ready','en-US').then(function(){ ready=true; return true; });
  }
  function isReady(){ return ready; }
  function cancel(){ if('speechSynthesis' in window) speechSynthesis.cancel(); }
  window.RexSpeech={speak:speak, unlock:unlock, cancel:cancel, isReady:isReady};
})();

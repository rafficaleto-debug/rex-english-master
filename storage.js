
(function(){
  var APP_VERSION='62.0.0';
  var STORE_KEY='rexEnglishMaster.profile.v62';
  var defaultProfile={
    schemaVersion:1, appVersion:APP_VERSION, contentVersion:window.REX_CONTENT_VERSION || 'unknown',
    added:[], weak:[], fav:[], mistakes:[],
    score:{ok:0,total:0,xp:0,coins:0,friend:0,today:0,streak:0,lastDay:'',name:'レックス'},
    chats:[]
  };
  function clone(x){ return JSON.parse(JSON.stringify(x)); }
  function readJson(key, fallback){ try{ var v=localStorage.getItem(key); return v?JSON.parse(v):fallback; }catch(e){ return fallback; } }
  function saveProfile(p){ p.appVersion=APP_VERSION; p.contentVersion=window.REX_CONTENT_VERSION || 'unknown'; localStorage.setItem(STORE_KEY, JSON.stringify(p)); }
  function loadProfile(){
    var p=readJson(STORE_KEY,null);
    if(p && p.schemaVersion){ return p; }
    var migrated=clone(defaultProfile);
    migrated.added=readJson('added_v62', readJson('added_v62', []));
    migrated.weak=readJson('weak_v62', readJson('weak_v62', []));
    migrated.fav=readJson('fav_v62', readJson('fav_v62', []));
    migrated.mistakes=readJson('mistakes_v62', readJson('mistakes_v62', []));
    migrated.score=readJson('score_v62', readJson('score_v62', defaultProfile.score));
    migrated.chats=readJson('chats_v62', []);
    saveProfile(migrated);
    return migrated;
  }
  function exportProfile(){ saveProfile(window.Rex.profile); return JSON.stringify(window.Rex.profile,null,2); }
  function restoreProfile(text){ var p=JSON.parse(text); if(!p || !p.schemaVersion || !p.score){ throw new Error('Invalid backup'); } saveProfile(p); }
  window.RexStorage={APP_VERSION:APP_VERSION, STORE_KEY:STORE_KEY, defaultProfile:defaultProfile, loadProfile:loadProfile, saveProfile:saveProfile, exportProfile:exportProfile, restoreProfile:restoreProfile};
})();

/* v62 ROOT FIX: stable localStorage keys. */
(function(){try{window.REX_STABLE_STORAGE={app:'grade1-2026-06',profile:'rex_profile',login:'rex_login',progress:'rex_progress',settings:'rex_settings',voice:'rex_voice_settings'}; function copy(f,t){var v=localStorage.getItem(f); if(v!==null&&localStorage.getItem(t)===null)localStorage.setItem(t,v);} var keys=[]; for(var i=0;i<localStorage.length;i++)keys.push(localStorage.key(i)); keys.forEach(function(k){if(!k)return; if(/^grade1-2026-06-v\d+$/.test(k))copy(k,'grade1-2026-06'); if(/^rex[_-]?profile/i.test(k))copy(k,'rex_profile'); if(/^rex[_-]?login/i.test(k))copy(k,'rex_login'); if(/^rex[_-]?progress/i.test(k))copy(k,'rex_progress'); if(/^rex[_-]?settings/i.test(k))copy(k,'rex_settings'); if(k==='rexVoiceSettings'||k==='voiceSettings'||/^rex.*voice/i.test(k))copy(k,'rex_voice_settings');});}catch(e){}})();

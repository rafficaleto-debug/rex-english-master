
(function(){
  var APP_VERSION='56.0.0';
  var STORE_KEY='rexEnglishMaster.profile.v56';
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
    migrated.added=readJson('added_v56', readJson('added_v56', []));
    migrated.weak=readJson('weak_v56', readJson('weak_v56', []));
    migrated.fav=readJson('fav_v56', readJson('fav_v56', []));
    migrated.mistakes=readJson('mistakes_v56', readJson('mistakes_v56', []));
    migrated.score=readJson('score_v56', readJson('score_v56', defaultProfile.score));
    migrated.chats=readJson('chats_v56', []);
    saveProfile(migrated);
    return migrated;
  }
  function exportProfile(){ saveProfile(window.Rex.profile); return JSON.stringify(window.Rex.profile,null,2); }
  function restoreProfile(text){ var p=JSON.parse(text); if(!p || !p.schemaVersion || !p.score){ throw new Error('Invalid backup'); } saveProfile(p); }
  window.RexStorage={APP_VERSION:APP_VERSION, STORE_KEY:STORE_KEY, defaultProfile:defaultProfile, loadProfile:loadProfile, saveProfile:saveProfile, exportProfile:exportProfile, restoreProfile:restoreProfile};
})();

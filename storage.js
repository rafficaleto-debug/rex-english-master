
(function(){
  var APP_VERSION='40.0.0';
  var STORE_KEY='rexEnglishMaster.profile.v1';
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
    migrated.added=readJson('added_v8', readJson('added_v7', []));
    migrated.weak=readJson('weak_v8', readJson('weak_v7', []));
    migrated.fav=readJson('fav_v8', readJson('fav_v7', []));
    migrated.mistakes=readJson('mistakes_v8', readJson('mistakes_v7', []));
    migrated.score=readJson('score_v8', readJson('score_v7', defaultProfile.score));
    migrated.chats=readJson('chats_v8', []);
    saveProfile(migrated);
    return migrated;
  }
  function exportProfile(){ saveProfile(window.Rex.profile); return JSON.stringify(window.Rex.profile,null,2); }
  function restoreProfile(text){ var p=JSON.parse(text); if(!p || !p.schemaVersion || !p.score){ throw new Error('Invalid backup'); } saveProfile(p); }
  window.RexStorage={APP_VERSION:APP_VERSION, STORE_KEY:STORE_KEY, defaultProfile:defaultProfile, loadProfile:loadProfile, saveProfile:saveProfile, exportProfile:exportProfile, restoreProfile:restoreProfile};
})();

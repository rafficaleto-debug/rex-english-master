
(function(){
  var APP_VERSION='59.0.0';
  var STORE_KEY='rexEnglishMaster.profile.v59';
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
    migrated.added=readJson('added_v59', readJson('added_v59', []));
    migrated.weak=readJson('weak_v59', readJson('weak_v59', []));
    migrated.fav=readJson('fav_v59', readJson('fav_v59', []));
    migrated.mistakes=readJson('mistakes_v59', readJson('mistakes_v59', []));
    migrated.score=readJson('score_v59', readJson('score_v59', defaultProfile.score));
    migrated.chats=readJson('chats_v59', []);
    saveProfile(migrated);
    return migrated;
  }
  function exportProfile(){ saveProfile(window.Rex.profile); return JSON.stringify(window.Rex.profile,null,2); }
  function restoreProfile(text){ var p=JSON.parse(text); if(!p || !p.schemaVersion || !p.score){ throw new Error('Invalid backup'); } saveProfile(p); }
  window.RexStorage={APP_VERSION:APP_VERSION, STORE_KEY:STORE_KEY, defaultProfile:defaultProfile, loadProfile:loadProfile, saveProfile:saveProfile, exportProfile:exportProfile, restoreProfile:restoreProfile};
})();


/* v59: migrate old localStorage keys to stable keys */
(function(){
  try{
    var copy=[];
    for(var i=0;i<localStorage.length;i++){
      var k=localStorage.key(i);
      if(!k) continue;
      var nk=k.replace(/grade1-2026-06-v\d+/g,'grade1-2026-06').replace(/rex[_-]english[_-]master[_-]?v\d+/ig,'rex_english_master_stable');
      if(nk!==k && !localStorage.getItem(nk)) copy.push([k,nk]);
    }
    copy.forEach(function(pair){ localStorage.setItem(pair[1], localStorage.getItem(pair[0])); });
  }catch(e){}
})();

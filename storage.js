
(function(){
  var APP_VERSION='61.0.0';
  var STORE_KEY='rexEnglishMaster.profile.v61';
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
    migrated.added=readJson('added_v61', readJson('added_v61', []));
    migrated.weak=readJson('weak_v61', readJson('weak_v61', []));
    migrated.fav=readJson('fav_v61', readJson('fav_v61', []));
    migrated.mistakes=readJson('mistakes_v61', readJson('mistakes_v61', []));
    migrated.score=readJson('score_v61', readJson('score_v61', defaultProfile.score));
    migrated.chats=readJson('chats_v61', []);
    saveProfile(migrated);
    return migrated;
  }
  function exportProfile(){ saveProfile(window.Rex.profile); return JSON.stringify(window.Rex.profile,null,2); }
  function restoreProfile(text){ var p=JSON.parse(text); if(!p || !p.schemaVersion || !p.score){ throw new Error('Invalid backup'); } saveProfile(p); }
  window.RexStorage={APP_VERSION:APP_VERSION, STORE_KEY:STORE_KEY, defaultProfile:defaultProfile, loadProfile:loadProfile, saveProfile:saveProfile, exportProfile:exportProfile, restoreProfile:restoreProfile};
})();

/* v61: migrate old versioned storage keys */
(function(){
  try{
    var pairs=[];
    for(var i=0;i<localStorage.length;i++){
      var k=localStorage.key(i); if(!k) continue;
      var nk=k.replace(/grade1-2026-06-v\d+/g,'grade1-2026-06').replace(/rex[_-]english[_-]master[_-]?v\d+/ig,'rex_english_master_stable');
      if(nk!==k && !localStorage.getItem(nk)) pairs.push([k,nk]);
    }
    pairs.forEach(function(p){ localStorage.setItem(p[1], localStorage.getItem(p[0])); });
  }catch(e){}
})();



/* v61: stable storage keys. Do not version user profile/login/progress keys. */
(function(){
  try{
    window.REX_APP_DATA_KEY = 'grade1-2026-06';
    window.REX_PROFILE_KEY = 'rex_profile_stable';
    window.REX_LOGIN_KEY = 'rex_login_stable';
    window.REX_SETTINGS_KEY = 'rex_settings_stable';
    var pairs=[];
    for(var i=0;i<localStorage.length;i++){
      var k=localStorage.key(i);
      if(!k) continue;
      var nk=k
        .replace(/grade1-2026-06-v\d+/g,'grade1-2026-06')
        .replace(/rex[_-]english[_-]master[_-]?v\d+/ig,'rex_english_master_stable')
        .replace(/rexProfileV\d+/g,'rex_profile_stable')
        .replace(/rexLoginV\d+/g,'rex_login_stable')
        .replace(/rexSettingsV\d+/g,'rex_settings_stable');
      if(nk!==k && !localStorage.getItem(nk)){
        pairs.push([k,nk]);
      }
    }
    pairs.forEach(function(p){ localStorage.setItem(p[1], localStorage.getItem(p[0])); });
  }catch(e){}
})();


(function(){
  var APP_VERSION='74.0.0';
  var STORE_KEY='rexEnglishMaster.profile';
  var LEGACY_PROFILE_KEYS=[
    'rexEnglishMaster.profile.v74','rexEnglishMaster.profile.v74','rexEnglishMaster.profile.v74',
    'rexEnglishMaster.profile.v74','rexEnglishMaster.profile.v74','rexEnglishMaster.profile.v74',
    'rexEnglishMaster.profile.v74','rexEnglishMaster.profile.v74','rexEnglishMaster.profile.v74',
    'rexEnglishMaster.profile.v74'
  ];
  var defaultProfile={
    schemaVersion:1, appVersion:APP_VERSION, contentVersion:window.REX_CONTENT_VERSION || 'unknown',
    added:[], weak:[], fav:[], mistakes:[],
    score:{ok:0,total:0,xp:0,coins:0,friend:0,today:0,streak:0,lastDay:'',name:'レックス'},
    chats:[]
  };
  function clone(x){ return JSON.parse(JSON.stringify(x)); }
  function readJson(key, fallback){ try{ var v=localStorage.getItem(key); return v?JSON.parse(v):fallback; }catch(e){ return fallback; } }
  function writeJson(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch(e){} }
  function findLegacyProfile(){
    for(var i=0;i<LEGACY_PROFILE_KEYS.length;i++){
      var p=readJson(LEGACY_PROFILE_KEYS[i], null);
      if(p && p.schemaVersion && p.score) return p;
    }
    try{
      for(var j=0;j<localStorage.length;j++){
        var k=localStorage.key(j);
        if(k && /^rexEnglishMaster\.profile\.v\d+$/.test(k)){
          var p2=readJson(k,null);
          if(p2 && p2.schemaVersion && p2.score) return p2;
        }
      }
    }catch(e){}
    return null;
  }
  function migrateOldSmallKeys(profile){
    profile.added=profile.added && profile.added.length ? profile.added : readJson('added_v74', []);
    profile.weak=profile.weak && profile.weak.length ? profile.weak : readJson('weak_v74', []);
    profile.fav=profile.fav && profile.fav.length ? profile.fav : readJson('fav_v74', []);
    profile.mistakes=profile.mistakes && profile.mistakes.length ? profile.mistakes : readJson('mistakes_v74', []);
    profile.score=profile.score || readJson('score_v74', defaultProfile.score);
    profile.chats=profile.chats && profile.chats.length ? profile.chats : readJson('chats_v74', []);
    return profile;
  }
  function saveProfile(p){
    p=p || clone(defaultProfile);
    p.appVersion=APP_VERSION;
    p.contentVersion=window.REX_CONTENT_VERSION || 'unknown';
    writeJson(STORE_KEY, p);
  }
  function loadProfile(){
    var p=readJson(STORE_KEY, null);
    if(!p || !p.schemaVersion || !p.score){ p=findLegacyProfile(); }
    if(!p || !p.schemaVersion || !p.score){ p=clone(defaultProfile); }
    p=migrateOldSmallKeys(p);
    saveProfile(p);
    return p;
  }
  function exportProfile(){ var p=(window.Rex && window.Rex.profile) ? window.Rex.profile : loadProfile(); saveProfile(p); return JSON.stringify(p,null,2); }
  function restoreProfile(text){ var p=JSON.parse(text); if(!p || !p.schemaVersion || !p.score){ throw new Error('Invalid backup'); } saveProfile(p); }
  window.RexStorage={APP_VERSION:APP_VERSION, STORE_KEY:STORE_KEY, defaultProfile:defaultProfile, loadProfile:loadProfile, saveProfile:saveProfile, exportProfile:exportProfile, restoreProfile:restoreProfile};
})();


(function(){
  window.addEventListener('error', function(e){
    var box=document.getElementById('bootError');
    if(box){ box.style.display='block'; box.textContent='起動エラーが出ています。\n'+(e.message||'')+'\n'+(e.filename||'')+':'+(e.lineno||''); }
  });
  window.addEventListener('unhandledrejection', function(e){
    var box=document.getElementById('bootError');
    if(box){ box.style.display='block'; box.textContent='処理エラーが出ています。\n'+(e.reason && e.reason.message ? e.reason.message : e.reason); }
  });

  var $=function(id){ return document.getElementById(id); };
  var wait=function(ms){ return new Promise(function(r){ setTimeout(r,ms); }); };

  var profile=RexStorage.loadProfile();
  window.Rex={profile:profile};
  var added=profile.added||[];
  var weak=new Set(profile.weak||[]);
  var fav=new Set(profile.fav||[]);
  var mistakes=new Set(profile.mistakes||[]);
  var score=profile.score||RexStorage.defaultProfile.score;
  var data=[], deck=[], idx=0, auto=false, q=null, selectedStage='中1-01 はじめの英語', special=null;

  function persist(){
    profile.added=added; profile.weak=Array.from(weak); profile.fav=Array.from(fav); profile.mistakes=Array.from(mistakes); profile.score=score;
    RexStorage.saveProfile(profile);
  }
  function all(){
    data=(window.REX_SENTENCES||[]).concat(added).map(function(x,i){ if(!x.id) x.id='a'+i; return x; });
    return data;
  }
  function stages(){ all(); var obj={}; data.forEach(function(x){ obj[x.stage||'中1']=1; }); return Object.keys(obj).sort(); }
  function filteredBase(){
    all();
    if(special==='weak') return data.filter(function(x){return weak.has(x.id);});
    if(special==='fav') return data.filter(function(x){return fav.has(x.id);});
    if(special==='mistakes') return data.filter(function(x){return mistakes.has(x.id);});
    if(selectedStage==='すべて') return data;
    return data.filter(function(x){return x.stage===selectedStage;});
  }
  function unitsForCurrent(){ var arr=filteredBase(), obj={'すべて':1}; arr.forEach(function(x){ obj[x.unit||x.cat||'例文']=1; }); return Object.keys(obj); }
  function todayStr(){ return new Date().toISOString().slice(0,10); }
  function ensureDay(){
    var t=todayStr();
    if(score.lastDay!==t){
      score.today=0; score.lastDay=t; score.streak=(score.streak||0)+1; score.coins=(score.coins||0)+20; persist();
      var ps=privateSettings(); setBubble('Welcome back!', ps.childName ? 'おかえり、'+ps.childName+'！また会えてうれしいよ。' : 'おかえり！また会えてうれしいよ。');
    }
  }
  function currentDino(){ return RexGame.currentStage(score); }
  function updateDino(){
    var info=currentDino(), s=info.stage, next=info.next, xp=score.xp||0;

    var curCard=document.getElementById('currentRexVisual');
    if(!curCard){
      var bubble=$('dinoBubble');
      if(bubble && bubble.parentElement){
        var row=document.createElement('div');
        row.className='currentRexRow imageVersion';
        var card=document.createElement('div');
        card.id='currentRexVisual';
        card.className='currentRexVisual imageVersion';
        bubble.parentElement.insertBefore(row,bubble);
        row.appendChild(card);
        row.appendChild(bubble);
      }
    }
    var cv=document.getElementById('currentRexVisual');
    if(cv){ cv.innerHTML=rexImageHtml(s,'hero'); }

    $('rankIcon').textContent=s.icon; $('rankName').textContent=s.name; $('level').textContent=info.index+1;
    $('dino').className='rexArt '+s.cls;
    $('dinoName').textContent=score.name||'レックス';
    $('xpText').textContent=xp+' XP';
    $('coinText').textContent=score.coins||0;
    $('friendText').textContent=Math.min(100,score.friend||0);
    $('friendfill').style.width=Math.min(100,score.friend||0)+'%';
    if(info.index===RexGame.dinoStages.length-1){ $('nextXp').textContent='MAX'; $('xpfill').style.width='100%'; }
    else { $('nextXp').textContent=next.xp-xp; $('xpfill').style.width=Math.max(3,Math.min(100,(xp-s.xp)/(next.xp-s.xp)*100))+'%'; }
    renderGrowth();
  }
  function renderGrowth(){
    var cur=currentDino().index;
    $('growth').innerHTML=RexGame.dinoStages.map(function(s,i){
      return '<div class="growStep '+(cur===i?'active':'')+'"><div class="icon">'+rexImageHtml(s,'stage')+'</div><div class="stageBadge">'+(i+1)+'</div><div class="stageName">'+s.name+'</div><div class="mini">Lv.'+(i+1)+'</div></div>';
    }).join('');
  }
  function rexHappy(){ var d=$('dino'); d.classList.remove('happy'); void d.offsetWidth; d.classList.add('happy'); }
  function showToast(t){ var el=$('toast'); el.textContent=t; el.classList.add('show'); setTimeout(function(){el.classList.remove('show');},1800); }
  function showLevelUp(stage){
    $('levelUp').innerHTML='🎉 成長したよ！<br>'+stage.icon+' '+stage.name;
    $('levelUp').classList.add('show');
    setTimeout(function(){ $('levelUp').classList.remove('show'); },2400);
  }
  function addXp(n,c,f){
    var before=currentDino().index;
    score.xp=(score.xp||0)+n; score.coins=(score.coins||0)+(c||0); score.friend=Math.min(100,(score.friend||0)+(f||0)); score.today=(score.today||0)+1;
    var after=currentDino().index;
    if(after>before){ showLevelUp(RexGame.dinoStages[after]); setBubble('I grew up!','やった！少し成長したよ！'); rexHappy(); confetti(); }
  }
  function setBubble(en,ja){ $('dinoBubble').innerHTML=en+'<br><small>'+ja+'</small>'; }
  function dinoTalk(audio){
    var max=Math.min(RexGame.lines.length,3+currentDino().index*2);
    var line=RexGame.lines[Math.floor(Math.random()*max)];
    setBubble(line[0],line[1]); addChat('rex',line[0],line[1]);
    if(audio){ RexSpeech.speak(line[0],'en-US').then(function(){ return RexSpeech.speak(line[1],'ja-JP'); }); }
  }
  function feedDino(){
    if((score.coins||0)<=0){ setBubble('No problem!','コインがなくても、ぼくはいつでも応援してるよ！'); return; }
    score.coins--; score.friend=Math.min(100,(score.friend||0)+2); persist(); updateStats(); setBubble('Yummy!','おいしい！ありがとう！'); rexHappy();
  }
  function petDino(){ score.friend=Math.min(100,(score.friend||0)+1); persist(); updateStats(); setBubble('Thank you!','なでてくれてありがとう！'); rexHappy(); }
  function renameDino(){ var n=prompt('恐竜の名前を入力してね',score.name||'レックス'); if(n){ score.name=n.slice(0,12); persist(); updateStats(); setBubble('Nice name!','すてきな名前をありがとう！'); } }

  function renderStages(){
    all();
    $('stageGrid').innerHTML=stages().map(function(st){
      var n=data.filter(function(x){return x.stage===st;}).length;
      return '<button class="stageBtn '+(selectedStage===st&&!special?'active':'')+'" data-stage="'+escapeHtml(st)+'"><b>'+escapeHtml(st)+'</b><div class="mini">'+n+'文</div></button>';
    }).join('');
    document.querySelectorAll('[data-stage]').forEach(function(b){ b.addEventListener('click',function(){ selectStage(this.getAttribute('data-stage')); }); });
  }
  function selectStage(st){
    special=null;
    if(st==='weak'){ special='weak'; selectedStage='すべて'; }
    else if(st==='fav'){ special='fav'; selectedStage='すべて'; }
    else if(st==='mistakes'){ special='mistakes'; selectedStage='すべて'; }
    else if(st==='all'){ selectedStage='すべて'; }
    else selectedStage=st;
    fillUnits(); resetDeck(); tab('listen'); renderStages();
  }
  function fillUnits(){
    var old=$('unit').value;
    $('unit').innerHTML=unitsForCurrent().map(function(u){ return '<option value="'+escapeHtml(u)+'">'+escapeHtml(u)+'</option>'; }).join('');
    Array.from($('unit').options).forEach(function(o){ if(o.value===old) $('unit').value=old; });
  }
  function resetDeck(){
    var arr=filteredBase(), u=$('unit').value||'すべて';
    deck=arr.filter(function(x){return u==='すべて'||x.unit===u;});
    if($('shuffle').checked) deck.sort(function(){return Math.random()-.5;});
    idx=0; render();
  }
  function render(){
    if(!deck.length){ $('en').textContent='対象なし'; $('ja').textContent='条件を変えてください'; $('count').textContent='0 / 0'; $('bar').style.width='0%'; return; }
    var x=deck[idx];
    $('en').textContent=(fav.has(x.id)?'⭐ ':'')+x.en;
    $('ja').textContent=x.ja;
    $('tag').textContent=(x.stage||'')+' / '+(x.unit||'')+(weak.has(x.id)?' / 苦手':'')+(mistakes.has(x.id)?' / 間違い':'');
    $('count').textContent=(idx+1)+' / '+deck.length;
    $('bar').style.width=((idx+1)/deck.length*100)+'%';
  }
  async function readNow(keepQueue){
    if(!deck.length) return;
    if(!RexSpeech.isReady()) await RexSpeech.unlock();
    await wait(160);
    var x=deck[idx], m=$('mode').value, g=Number($('gap').value||400);
    $('status').textContent='読み上げ中';
    if(!keepQueue) RexSpeech.cancel();
    if(m==='en-ja-en'){
      await RexSpeech.speak(x.en,'en-US'); await wait(g); await RexSpeech.speak(x.speechJa||x.ja,'ja-JP'); await wait(g); await RexSpeech.speak(x.en,'en-US');
    } else if(m==='en-ja-en-ja'){
      await RexSpeech.speak(x.en,'en-US'); await wait(g); await RexSpeech.speak(x.speechJa||x.ja,'ja-JP'); await wait(g); await RexSpeech.speak(x.en,'en-US'); await wait(g); await RexSpeech.speak(x.speechJa||x.ja,'ja-JP');
    } else if(m==='ja-en'){
      await RexSpeech.speak(x.speechJa||x.ja,'ja-JP'); await wait(g); await RexSpeech.speak(x.en,'en-US');
    } else await RexSpeech.speak(x.en,'en-US');
    $('status').textContent=auto?'連続再生中':'音声OK';
  }
  async function toggleAuto(){
    if(auto){ stopAuto(); return; }
    auto=true; $('autoBtn').textContent='停止'; $('status').textContent='連続再生中';
    while(auto && deck.length){ render(); await readNow(true); await wait(Number($('gap').value||400)); if(!auto) break; idx=(idx+1)%deck.length; }
    $('autoBtn').textContent='連続再生';
  }
  function stopAuto(){ auto=false; RexSpeech.cancel(); $('autoBtn').textContent='連続再生'; $('status').textContent='停止しました'; }
  function next(){ stopAuto(); if(deck.length) idx=(idx+1)%deck.length; render(); }
  function prev(){ stopAuto(); if(deck.length) idx=(idx-1+deck.length)%deck.length; render(); }
  function markWeak(){ if(deck.length){ weak.add(deck[idx].id); persist(); render(); updateStats(); showToast('苦手に追加しました'); } }
  function clearWeak(){ if(deck.length){ weak.delete(deck[idx].id); mistakes.delete(deck[idx].id); persist(); render(); updateStats(); showToast('覚えた！'); } }
  function toggleFav(){ if(deck.length){ var id=deck[idx].id; fav.has(id)?fav.delete(id):fav.add(id); persist(); render(); } }

  function pool(){ var p=filteredBase(), u=$('unit').value||'すべて'; if(u!=='すべて') p=p.filter(function(x){return x.unit===u;}); return p.length?p:data; }
  function newQ(){ var p=pool(); q=p[Math.floor(Math.random()*p.length)]; $('qja').textContent=q.ja; $('qen').textContent=q.en; $('qen').classList.add('hidden'); $('ans').value=''; $('ans').classList.remove('correct','wrong'); $('result').textContent=''; $('result').className='result'; $('diff').innerHTML=''; }
  function normalize(s){ return String(s||'').trim().toLowerCase().replace(/[’‘]/g,"'").replace(/[“”]/g,'"').replace(/[。．]/g,'.').replace(/[？]/g,'?').replace(/[！]/g,'!').replace(/\s+/g,' '); }
  function loose(s){ return normalize(s).replace(/[.?!]/g,'').replace(/\s+/g,' '); }
  function diffHtml(a,b){ var A=loose(a).split(' '), B=loose(b).split(' '), out=[], n=Math.max(A.length,B.length); for(var i=0;i<n;i++){ if((A[i]||'')===(B[i]||'')) out.push(escapeHtml(A[i]||'')); else { if(A[i]) out.push('<del>'+escapeHtml(A[i])+'</del>'); if(B[i]) out.push('<ins>'+escapeHtml(B[i])+'</ins>'); } } return out.join(' '); }
  function checkAnswer(){
    if(!q) return;
    var user=$('ans').value, exact=normalize(user)===normalize(q.en), ok=loose(user)===loose(q.en);
    score.total=(score.total||0)+1;
    if(ok){
      score.ok=(score.ok||0)+1; addXp(mistakes.has(q.id)?18:12,mistakes.has(q.id)?8:5,mistakes.has(q.id)?4:2); weak.delete(q.id); mistakes.delete(q.id);
      $('ans').classList.add('correct'); $('ans').classList.remove('wrong'); $('result').textContent=exact?'大正解！ レックスもよろこんでる！':'正解！（ピリオド等はOK）'; $('result').className='result ok'; $('diff').innerHTML=''; setBubble('Good job!','すごい！よくがんばったね！'); rexHappy();
    } else {
      addXp(2,1,1); weak.add(q.id); mistakes.add(q.id); $('ans').classList.add('wrong'); $('ans').classList.remove('correct'); $('result').textContent='惜しい！ 間違い復習に追加しました。'; $('result').className='result ng'; $('diff').innerHTML='あなた: '+diffHtml(user,q.en)+'<br>正解: <b>'+escapeHtml(q.en)+'</b>'; $('qen').classList.remove('hidden'); setBubble('No worries!','だいじょうぶ！一緒にもう一回やってみよう！');
    }
    if((score.today||0)===10){ setBubble('Mission complete!','今日の目標達成！すごいよ！'); confetti(); } persist(); updateStats(); renderStages();
  }
  function showAns(){ if(q){ $('qen').classList.remove('hidden'); RexSpeech.speak(q.en,'en-US'); } }
  function speakQ(){ if(q) RexSpeech.speak(q.en,'en-US'); }
  function manualJudge(ok){ if(!q) return; score.total=(score.total||0)+1; if(ok){ score.ok=(score.ok||0)+1; addXp(mistakes.has(q.id)?18:10,mistakes.has(q.id)?8:4,mistakes.has(q.id)?4:2); weak.delete(q.id); mistakes.delete(q.id); setBubble('Nice!','いいね！その調子！'); rexHappy(); } else { addXp(2,1,1); weak.add(q.id); mistakes.add(q.id); setBubble('You can do it!','きみならできるよ！'); } persist(); updateStats(); newQ(); }

  function addChat(who,en,ja){ profile.chats=profile.chats||[]; profile.chats.push({who:who,en:en,ja:ja}); profile.chats=profile.chats.slice(-20); persist(); renderChat(); }
  function renderChat(){ var chats=profile.chats||[]; if(!chats.length) chats=[{who:'rex',en:'Hi there!',ja:'今日も一緒にがんばろうね！'}]; $('chatBox').innerHTML=chats.map(function(c){ return '<div class="chat '+(c.who==='me'?'me':'')+'"><div class="msg"><b>'+escapeHtml(c.en)+'</b><br><span class="small">'+escapeHtml(c.ja||'')+'</span></div></div>'; }).join(''); $('chatBox').scrollTop=$('chatBox').scrollHeight; }
  function sendQuick(t){ addChat('me',t,''); var replies={'Hello!':['Hello!','会えてうれしいよ！'],'Thank you!':["You're welcome!",'どういたしまして！'],'I will do my best!':['I believe in you!','ぼくは信じてるよ！'],'See you!':['See you!','また会おうね！']}; var r=replies[t]||['Good job!','いいね！']; setTimeout(function(){ addChat('rex',r[0],r[1]); setBubble(r[0],r[1]); RexSpeech.speak(r[0],'en-US'); },300); }

  function renderList(){ all(); var s=($('search').value||'').toLowerCase(); var arr=filteredBase().filter(function(x){return ((x.en||'')+(x.ja||'')+(x.stage||'')+(x.unit||'')).toLowerCase().indexOf(s)>=0;}); $('listbox').innerHTML=arr.map(function(x){ return '<div class="item"><b>'+(fav.has(x.id)?'⭐ ':'')+escapeHtml(x.en)+'</b><br>'+escapeHtml(x.ja)+'<br><span class="small">'+escapeHtml(x.stage||'')+' / '+escapeHtml(x.unit||'')+(weak.has(x.id)?' / 苦手':'')+(mistakes.has(x.id)?' / 間違い':'')+'</span></div>'; }).join('') || '<p class="small">該当なし</p>'; }
  function renderBadges(){ $('badgeGrid').innerHTML=RexGame.badges.map(function(b){ var on=b.need(score,mistakes.size); return '<div class="collectionBadge '+(on?'':'locked')+'"><div style="font-size:34px">'+b.icon+'</div><div>'+b.name+'</div><div class="mini">'+(on?'GET!':'LOCKED')+'</div></div>'; }).join(''); }
  function renderMissions(){ var m=[['10問チャレンジ',(score.today||0)>=10,Math.min(score.today||0,10)+'/10'],['3問正解',(score.ok||0)>=3,Math.min(score.ok||0,3)+'/3'],['間違い復習を空に',mistakes.size===0,'残り'+mistakes.size]]; $('missionBox').innerHTML=m.map(function(x){return '<div class="mission '+(x[1]?'done':'')+'"><span>'+(x[1]?'✅':'🎁')+' '+x[0]+'</span><b>'+x[2]+'</b></div>';}).join(''); }
  function updateDataLabels(){
    if($('dataVersionLabel')) $('dataVersionLabel').textContent=window.REX_CONTENT_VERSION || '-';
    if($('sentenceCountLabel')) $('sentenceCountLabel').textContent=(window.REX_SENTENCES||[]).length + (added?added.length:0);
    if($('contentVersionLabel')) $('contentVersionLabel').textContent=window.REX_CONTENT_VERSION || '-';
    if($('appVersionLabel')) $('appVersionLabel').textContent='v47';
  }


  function rexImageHtml(stage, kind){
    var k = kind || 'stage';
    return '<img class="rexSprite '+k+'" src="'+stage.img+'?v=47" alt="'+stage.name+'">';
  }

  function renderDaily(){
    if($('todayCount')) $('todayCount').textContent=score.today||0;
    if($('streakCount')) $('streakCount').textContent=score.streak||0;
    var acc=(score.total||0)?Math.round((score.ok||0)/(score.total||1)*100):0;
    if($('accuracy')) $('accuracy').textContent=acc+'%';
    var t=Math.min(score.today||0,10);
    if($('dailyGoalText')) $('dailyGoalText').textContent=t+' / 10';
    if($('dailyGoalBar')) $('dailyGoalBar').style.width=(t*10)+'%';
  }
  function renderEvoMap(){ if($('evoMap')) $('evoMap').innerHTML=''; }
  function confetti(){
    var box=document.createElement('div'); box.className='confetti';
    var marks=['🎉','✨','⭐','🦖','💗'];
    for(var i=0;i<24;i++){
      var sp=document.createElement('span');
      sp.textContent=marks[Math.floor(Math.random()*marks.length)];
      sp.style.left=(Math.random()*100)+'%';
      sp.style.animationDelay=(Math.random()*.35)+'s';
      box.appendChild(sp);
    }
    document.body.appendChild(box);
    setTimeout(function(){box.remove();},1900);
  }
  function toggleNight(){
    document.body.classList.toggle('night');
    showToast(document.body.classList.contains('night')?'おやすみモード':'通常モード');
  }

  function updateStats(){ $('ok').textContent=score.ok||0; $('total').textContent=score.total||0; $('mistakeCount').textContent=mistakes.size; $('heroOk').textContent=score.ok||0; $('heroTotal').textContent=score.total||0; $('heroMistake').textContent=mistakes.size; updateDino(); renderMissions(); renderBadges(); renderDaily(); renderEvoMap(); updateDataLabels(); }


  function showRexVoiceGuide(){
    var txt=[
      'OpenAI高品質音声の設定手順',
      '',
      '1. Cloudflare Workersで新しいWorkerを作成',
      '2. このZIPに入っている openai-tts-worker.js の中身を貼り付け',
      '3. WorkerのSettings → Variables → Secretsで OPENAI_API_KEY を追加',
      '4. WorkerをDeploy',
      '5. WorkerのURLの末尾に /tts を付ける',
      '   例: https://xxxxx.workers.dev/tts',
      '6. このアプリの「音声準備・声の設定」にURLを入力',
      '7. 「OpenAI音声を使う」をON',
      '8. 保存して音声テスト',
      '',
      '注意:',
      'APIキーをGitHubやこのアプリの画面に直接入れないでください。',
      '音声が失敗した場合は、自動でSafari標準音声に戻ります。'
    ].join('\\n');
    $('rexVoiceGuideText').value=txt;
  }

  function showUpdateGuide(){
    var txt=[
      'v47以降のGitHub更新手順',
      '',
      '1. 新しいZIPをダウンロード',
      '2. iPhoneの「ファイル」アプリでZIPをタップして解凍',
      '3. GitHubの rex-english-master をSafariで開く',
      '4. Code → Upload files',
      '5. 解凍したフォルダ内のファイルをすべて選択',
      '6. Commit changes',
      '7. 1〜3分後、同じURLを開き直す',
      '',
      '重要:',
      '同じURLなら学習データは残ります。',
      'URLを変える時だけ、先に「データ」タブでバックアップしてください。'
    ].join('\\n');
    $('updateGuideText').value=txt;
  }
  function quickBackup(){
    var backup=RexStorage.exportProfile();
    if($('updateGuideText')) $('updateGuideText').value=backup;
    showToast('バックアップを表示しました');
  }

  function exportData(){ $('dataBackup').value=RexStorage.exportProfile(); $('dataMsg').innerHTML='<span class="restoreOk">バックアップを表示しました。</span>'; }
  async function copyBackup(){ if(!$('dataBackup').value) exportData(); try{ await navigator.clipboard.writeText($('dataBackup').value); $('dataMsg').innerHTML='<span class="restoreOk">コピーしました。</span>'; } catch(e){ $('dataMsg').innerHTML='<span class="restoreNg">コピーできない場合は、テキストを長押ししてコピーしてください。</span>'; } }
  function restoreData(){ try{ RexStorage.restoreProfile($('dataBackup').value); $('dataMsg').innerHTML='<span class="restoreOk">復元しました。再読み込みします。</span>'; setTimeout(function(){location.reload();},600); } catch(e){ $('dataMsg').innerHTML='<span class="restoreNg">復元できません。バックアップJSONを確認してください。</span>'; } }

  function addBulkSentences(){
    var lines=($('bulkAdd').value||'').split('\n').map(function(x){return x.trim();}).filter(Boolean), n=0;
    lines.forEach(function(line){
      var p=line.split('|').map(function(x){return x.trim();});
      if(p.length>=2){
        var ja=p[1], speechJa=ja.replace(/日本人/g,'にほんじん').replace(/日本語/g,'にほんご').replace(/日本出身/g,'にほん出身');
        added.push({id:'u'+Date.now()+Math.random(),en:p[0],ja:ja,stage:p[2]||'中1-16 追加',unit:p[3]||'追加例文',cat:p[3]||'追加例文',speechJa:speechJa});
        n++;
      }
    });
    $('bulkAdd').value=''; persist(); renderStages(); fillUnits(); resetDeck(); updateStats(); showToast(n+'文を追加しました');
  }
  function exportAdded(){
    var lines=added.map(function(x){return [x.en,x.ja,x.stage,x.unit].join(' | ');}).join('\n');
    $('addedExport').value=lines || JSON.stringify(added,null,2);
  }
  function clearAdded(){ if(confirm('追加した例文を消しますか？')){ added=[]; persist(); renderStages(); fillUnits(); resetDeck(); updateStats(); showToast('追加例文をリセットしました'); } }


  function privateSettings(){
    try{return JSON.parse(localStorage.getItem('rexEnglishMaster.private.v47')||'{}');}catch(e){return {};}
  }
  function savePrivateSettings(s){
    localStorage.setItem('rexEnglishMaster.private.v47',JSON.stringify(s||{}));
  }
  function showLock(){
    var s=privateSettings();
    if(!s.appPin){
      if($('appLock')) $('appLock').classList.remove('hidden');
      cancelSetupPanel(); if($('lockMsg')) $('lockMsg').textContent='はじめて使う場合は「はじめて設定」を押してください。';
      return;
    }
    cancelSetupPanel(); if($('appLock')) $('appLock').classList.remove('hidden');
    setTimeout(function(){ if($('appPinInput')) $('appPinInput').focus(); },300);
  }
  function hideLock(){
    if($('appLock')) $('appLock').classList.add('hidden');
  }
  function unlockApp(){
    var s=privateSettings();
    var v=($('appPinInput')&&$('appPinInput').value||'').trim();
    if(!s.appPin){
      if($('lockMsg')) $('lockMsg').textContent='先に「はじめて設定」でパスコードを決めてください。';
      return;
    }
    if(v===s.appPin){
      sessionStorage.setItem('rexEnglishMaster.unlocked','1');
      hideLock();
      var name=s.childName||'';
      if(name){ setBubble('Welcome back!','おかえり、'+name+'！レックス待ってたよ。'); }
      else { setBubble('Welcome back!','おかえり！レックス待ってたよ。'); }
    }else{
      if($('lockMsg')) $('lockMsg').textContent='パスコードが違います。';
    }
  }
  function showSetupPanel(){
    if($('loginPanel')) $('loginPanel').classList.add('hidden');
    if($('setupPanel')) $('setupPanel').classList.remove('hidden');
    if($('lockLead')) $('lockLead').textContent='最初に、呼び名とパスコードを設定してね。';
    if($('lockMsg')) $('lockMsg').textContent='';
    setTimeout(function(){ if($('setupChildName')) $('setupChildName').focus(); },200);
  }
  function cancelSetupPanel(){
    if($('setupPanel')) $('setupPanel').classList.add('hidden');
    if($('loginPanel')) $('loginPanel').classList.remove('hidden');
    if($('lockLead')) $('lockLead').textContent='パスコードを入れると、レックスに会えるよ。';
  }
  function saveFirstSetup(){
    var name=($('setupChildName')&&$('setupChildName').value||'').trim();
    var pin=($('setupAppPin')&&$('setupAppPin').value||'').trim();
    var parent=($('setupParentPin')&&$('setupParentPin').value||'').trim();

    if(!pin || pin.length!==4){
      if($('lockMsg')) $('lockMsg').textContent='娘さん用4桁パスコードを入力してください。';
      return;
    }
    if(!parent || parent.length!==8){ if(msg) msg.textContent='保護者用8桁パスコードを入力してください。'; return; }

    savePrivateSettings({appPin:String(pin),parentPin:String(parent),childName:String(name||'')});
    sessionStorage.setItem('rexEnglishMaster.unlocked','1');

    if($('setupAppPin')) $('setupAppPin').value='';
    if($('setupParentPin')) $('setupParentPin').value='';
    hideLock();

    if(name) setBubble('Nice to meet you!','これから '+name+' 専用のレックスだよ！');
    else setBubble('Nice to meet you!','これから一緒に英語をがんばろうね！');
    showToast('専用設定を保存しました');
  }
  function setupFirstPin(){
    showSetupPanel();
  }
  function requireParentPin(){
    var s=privateSettings();
    if(!s.parentPin) return true;
    var v=prompt('保護者PINを入力してください','');
    return v===s.parentPin;
  }
  function savePrivateFromUI(){
    var s=privateSettings();
    var name=($('childNameInput')&&$('childNameInput').value||'').trim();
    var appPin=($('newAppPinInput')&&$('newAppPinInput').value||'').trim();
    var parentPin=($('newParentPinInput')&&$('newParentPinInput').value||'').trim();
    if(!requireParentPin()){ showToast('保護者PINが違います'); return; }
    if(name) s.childName=name;
    if(appPin){ if(appPin.length!==8){ showToast('8桁で入力してください'); return; } s.appPin=appPin; s.parentPin=appPin; }
    savePrivateSettings(s);
    if($('newAppPinInput')) $('newAppPinInput').value='';
    if($('newParentPinInput')) $('newParentPinInput').value='';
    showToast('専用設定を保存しました');
    if(s.childName) setBubble('Saved!','これから '+s.childName+' って呼ぶね。');
  }
  function loadPrivateUI(){
    var s=privateSettings();
    if($('childNameInput')) $('childNameInput').value=s.childName||'';
  }
  function lockNow(){
    sessionStorage.removeItem('rexEnglishMaster.unlocked');
    if($('appPinInput')) $('appPinInput').value='';
    showLock();
  }
  function resetPins(){
    if(!requireParentPin()){ showToast('保護者PINが違います'); return; }
    if(confirm('起動パスコードと保護者PINをリセットしますか？')){
      localStorage.removeItem('rexEnglishMaster.private.v47');
      sessionStorage.removeItem('rexEnglishMaster.unlocked');
      showToast('PINをリセットしました');
      showLock();
    }
  }


  function parentPasswordOk(){
    var s=privateSettings();
    if(!s.parentPin){
      showToast('先に保護者用8桁パスコードを設定してください');
      return false;
    }
    var v=prompt('保護者メニュー用の8桁パスコードを入力してください','');
    return v===s.parentPin;
  }
  function openParentMenu(){
    if(parentPasswordOk()){
      tab('parentmenu');
      setBubble('Secret base!','ここはおうちの人だけのひみつ基地だよ😊');
    }else{
      showToast('8桁パスコードが違います');
    }
  }

  function tab(id){ if((id==='parent'||id==='private'||id==='data'||id==='update'||id==='rexvoice') && !parentPasswordOk()) { showToast('8桁パスコードが必要です'); return; } if(id==='private') loadPrivateUI(); ['stage','listen','test','talk','collection','settings','voice','parentmenu','parent','list','rexvoice','update','private','data'].forEach(function(x){ if($(x)) $(x).classList.toggle('hidden',x!==id); }); if(id==='test') newQ(); if(id==='list') renderList(); if(id==='collection') renderBadges(); if(id==='talk') renderChat(); if(id==='listen'){ fillUnits(); resetDeck(); } }
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g,function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; }); }


  // v47 global fallback handlers for Safari
  function v47PrivateSettings(){
    try{return JSON.parse(localStorage.getItem('rexEnglishMaster.private.v47')||'{}');}catch(e){return {};}
  }
  function v47SavePrivateSettings(s){
    localStorage.setItem('rexEnglishMaster.private.v47',JSON.stringify(s||{}));
  }
  function v47ShowSetup(){
    var login=document.getElementById('loginPanel');
    var setup=document.getElementById('setupPanel');
    var lead=document.getElementById('lockLead');
    var msg=document.getElementById('lockMsg');
    if(login) login.classList.add('hidden');
    if(setup) setup.classList.remove('hidden');
    if(lead) lead.textContent='最初に、呼び名とパスコードを設定してね。';
    if(msg) msg.textContent='';
    setTimeout(function(){ var n=document.getElementById('setupChildName'); if(n) n.focus(); },120);
  }
  function v47CancelSetup(){
    var login=document.getElementById('loginPanel');
    var setup=document.getElementById('setupPanel');
    var lead=document.getElementById('lockLead');
    if(setup) setup.classList.add('hidden');
    if(login) login.classList.remove('hidden');
    if(lead) lead.textContent='パスコードを入れると、レックスに会えるよ。';
  }
  function v47HideLock(){
    var lock=document.getElementById('appLock');
    if(lock) lock.classList.add('hidden');
  }
  function v47SaveSetup(){
    var name=(document.getElementById('setupChildName')&&document.getElementById('setupChildName').value||'').trim();
    var pin=(document.getElementById('setupAppPin')&&document.getElementById('setupAppPin').value||'').trim();
    var parent=(document.getElementById('setupParentPin')&&document.getElementById('setupParentPin').value||'').trim();
    var msg=document.getElementById('lockMsg');
    if(!pin || pin.length!==4){
      if(msg) msg.textContent='娘さん用4桁パスコードを入力してください。';
      return;
    }
    if(!parent || parent.length!==8){ if(msg) msg.textContent='保護者用8桁パスコードを入力してください。'; return; }
    v47SavePrivateSettings({appPin:String(pin),parentPin:String(parent),childName:String(name||'')});
    sessionStorage.setItem('rexEnglishMaster.unlocked','1');
    v47HideLock();
    try{
      if(typeof setBubble==='function'){
        if(name) setBubble('Nice to meet you!','これから '+name+' 専用のレックスだよ！');
        else setBubble('Nice to meet you!','これから一緒に英語をがんばろうね！');
      }
      if(typeof showToast==='function') showToast('専用設定を保存しました');
    }catch(e){}
  }
  function v47Unlock(){
    var s=v47PrivateSettings();
    var v=(document.getElementById('appPinInput')&&document.getElementById('appPinInput').value||'').trim();
    var msg=document.getElementById('lockMsg');
    if(!s.appPin){
      if(msg) msg.textContent='先に「はじめて設定」でパスコードを決めてください。';
      return;
    }
    if(v===s.appPin){
      sessionStorage.setItem('rexEnglishMaster.unlocked','1');
      v47HideLock();
      try{
        if(typeof setBubble==='function'){
          if(s.childName) setBubble('Welcome back!','おかえり、'+s.childName+'！レックス待ってたよ。');
          else setBubble('Welcome back!','おかえり！レックス待ってたよ。');
        }
      }catch(e){}
    }else{
      if(msg) msg.textContent='パスコードが違います。';
    }
  }
  window.RexPrivateShowSetup=v47ShowSetup;
  window.RexPrivateCancelSetup=v47CancelSetup;
  window.RexPrivateSaveSetup=v47SaveSetup;
  window.RexPrivateUnlock=v47Unlock;

  function bind(){
    $('unlockAudioBtn').addEventListener('click',function(){ RexSpeech.unlock().then(function(){ $('status').textContent='音声OK'; }); });
    $('voiceTestBtn').addEventListener('click',function(){ RexSpeech.cancel(); RexSpeech.saveFromUI && RexSpeech.saveFromUI(); RexSpeech.speak('Great job! Let\'s try one more sentence.','en-US').then(function(){ return RexSpeech.speak('今日もよくがんばったね。あと一文だけ、一緒にやってみよう。','ja-JP'); }); }); if($('voiceSaveBtn')) $('voiceSaveBtn').addEventListener('click',function(){ RexSpeech.saveFromUI && RexSpeech.saveFromUI(); showToast('声の設定を保存しました'); });
    $('feedBtn').addEventListener('click',feedDino); $('petBtn').addEventListener('click',petDino); $('talkBtn').addEventListener('click',function(){dinoTalk(true);}); $('renameBtn').addEventListener('click',renameDino);
    document.querySelectorAll('[data-stage-special]').forEach(function(b){ b.addEventListener('click',function(){ selectStage(this.getAttribute('data-stage-special')); }); });
    $('unit').addEventListener('change',resetDeck); $('shuffle').addEventListener('change',resetDeck);
    $('readBtn').addEventListener('click',function(){ readNow(false); }); if($('nightBtn')) $('nightBtn').addEventListener('click',toggleNight); $('autoBtn').addEventListener('click',toggleAuto); $('stopBtn').addEventListener('click',stopAuto); $('nextBtn').addEventListener('click',next); $('prevBtn').addEventListener('click',prev); $('favBtn').addEventListener('click',toggleFav); $('weakBtn').addEventListener('click',markWeak); $('clearBtn').addEventListener('click',clearWeak);
    $('newQBtn').addEventListener('click',newQ); $('speakQBtn').addEventListener('click',speakQ); $('mistakeModeBtn').addEventListener('click',function(){selectStage('mistakes');}); $('checkBtn').addEventListener('click',checkAnswer); $('showAnsBtn').addEventListener('click',showAns); $('manualOkBtn').addEventListener('click',function(){manualJudge(true);}); $('manualNgBtn').addEventListener('click',function(){manualJudge(false);});
    $('ans').addEventListener('keydown',function(e){ if(e.key==='Enter') checkAnswer(); });
    document.querySelectorAll('[data-quick]').forEach(function(b){ b.addEventListener('click',function(){sendQuick(this.getAttribute('data-quick'));}); });
    document.querySelectorAll('[data-tab]').forEach(function(b){ b.addEventListener('click',function(){tab(this.getAttribute('data-tab'));}); });
    $('search').addEventListener('input',renderList); $('exportBtn').addEventListener('click',exportData); $('copyBtn').addEventListener('click',copyBackup); $('restoreBtn').addEventListener('click',restoreData);
    $('addBulkBtn').addEventListener('click',addBulkSentences); $('exportCsvBtn').addEventListener('click',exportAdded); $('clearAddedBtn').addEventListener('click',clearAdded);
    
    if($('openAiVoiceSaveBtn')) $('openAiVoiceSaveBtn').addEventListener('click',function(){ RexSpeech.saveFromUI && RexSpeech.saveFromUI(); showToast('音声エンジン設定を保存しました'); });
    if($('openAiVoiceTestBtn')) $('openAiVoiceTestBtn').addEventListener('click',function(){ RexSpeech.saveFromUI && RexSpeech.saveFromUI(); RexSpeech.speak('Hello! I am Rex. I am always on your side.','en-US').then(function(){ return RexSpeech.speak('こんにちは、レックスだよ。ぼくはいつでも味方だよ。一緒に英語をがんばろう。','ja-JP'); }); });
    if($('rexVoiceGuideBtn')) $('rexVoiceGuideBtn').addEventListener('click',showRexVoiceGuide);

    if($('showUpdateGuideBtn')) $('showUpdateGuideBtn').addEventListener('click',showUpdateGuide);
    if($('quickBackupBtn')) $('quickBackupBtn').addEventListener('click',quickBackup);
  }
  function init(){ ensureDay(); bind(); if(RexSpeech.populateVoiceSelects) RexSpeech.populateVoiceSelects(); renderStages(); fillUnits(); updateStats(); resetDeck(); newQ(); renderList(); renderChat(); var ok=$('bootOk'); if(ok) ok.textContent='✅ アプリは読み込まれました。音が出ない場合は「音声スタート」を押してください。'; if(sessionStorage.getItem('rexEnglishMaster.unlocked')!=='1') showLock(); }

  try{ init(); }
  catch(e){ var box=$('bootError'); if(box){ box.style.display='block'; box.textContent='起動に失敗しました。\n'+(e.message||e); } console.error(e); }
})();

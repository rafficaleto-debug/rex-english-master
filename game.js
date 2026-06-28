
(function(){
  var dinoStages=[
    {name:'たまご',icon:'🥚',xp:0,cls:'stage1',img:'rex-stage-1.png'},
    {name:'ひび',icon:'🥚',xp:40,cls:'stage2',img:'rex-stage-2.png'},
    {name:'顔を出す',icon:'🐣',xp:100,cls:'stage3',img:'rex-stage-3.png'},
    {name:'赤ちゃん',icon:'🧡',xp:200,cls:'stage4',img:'rex-stage-4.png'},
    {name:'子ども',icon:'🧡',xp:380,cls:'stage5',img:'rex-stage-5.png'},
    {name:'青年',icon:'🧡',xp:650,cls:'stage6',img:'rex-stage-6.png'},
    {name:'大人',icon:'🧡',xp:1000,cls:'stage7',img:'rex-stage-7.png'}
  ];
  var lines=[
    ['Hi!','やあ！'],['Good job!','すごい！よくがんばったね！'],['You can do it!','きみならできるよ！'],
    ['I am happy!','ぼく、うれしい！'],["Let's study together!",'一緒に勉強しよう！'],
    ['You are getting better every day!','毎日うまくなってるよ！'],['Welcome back!','おかえり！'],
    ['I missed you.','会いたかったよ。'],['I am always on your side.','ぼくはいつでも味方だよ。'],
    ['No worries!','間違えてもだいじょうぶ！一緒にやろう！'],['You are my best friend!','きみはぼくの大切な友だちだよ！'],
    ['Thank you for studying with me.','一緒に勉強してくれてありがとう。'],['I am proud of you!','ぼくはきみを誇りに思うよ！'],['Small steps every day!','毎日少しずつで大丈夫！'],['You made me smile!','きみのおかげで笑顔になったよ！'],['One more sentence?','あと1文だけ、一緒にやってみる？'],['Your effort is treasure!','がんばった時間は宝物だよ！'],["Let's roar in English!",'英語でガオーって成長しよう！']
  ];
  var badges=[
    {id:'b1',name:'初正解',icon:'🎯',need:function(s,m){return s.ok>=1;}},
    {id:'b2',name:'赤ちゃん誕生',icon:'🦖',need:function(s,m){return s.xp>=50;}},
    {id:'b3',name:'なかよし',icon:'💗',need:function(s,m){return s.friend>=30;}},
    {id:'b4',name:'10問挑戦',icon:'🔥',need:function(s,m){return s.total>=10;}},
    {id:'b5',name:'100問挑戦',icon:'🏅',need:function(s,m){return s.total>=100;}},
    {id:'b6',name:'おとな恐竜',icon:'👑',need:function(s,m){return s.xp>=800;}},
    {id:'b7',name:'復習クリア',icon:'🛡️',need:function(s,m){return m===0 && s.total>=10;}},
    {id:'b8',name:'伝説の相棒',icon:'🌈',need:function(s,m){return s.xp>=1400;}}
  ];
  function currentStage(score){
    var xp=score.xp||0, idx=0;
    for(var i=0;i<dinoStages.length;i++){ if(xp>=dinoStages[i].xp) idx=i; }
    return {index:idx, stage:dinoStages[idx], next:dinoStages[Math.min(idx+1,dinoStages.length-1)]};
  }
  window.RexGame={dinoStages:dinoStages, lines:lines, badges:badges, currentStage:currentStage};
})();

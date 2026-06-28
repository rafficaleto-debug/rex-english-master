
(function(){
  var dinoStages=[
    {name:'たまご',icon:'🥚',xp:0,cls:'eggArt'},
    {name:'赤ちゃん',icon:'🦖',xp:50,cls:'babyArt'},
    {name:'こども',icon:'🦖',xp:180,cls:'kidArt'},
    {name:'青年期',icon:'🦖',xp:420,cls:'teenArt'},
    {name:'おとな',icon:'🦖',xp:800,cls:'adultArt'},
    {name:'伝説の恐竜',icon:'🦖✨',xp:1400,cls:'adultArt'}
  ];
  var lines=[
    ['Hi!','やあ！'],['Good job!','すごい！よくがんばったね！'],['You can do it!','きみならできるよ！'],
    ['I am happy!','ぼく、うれしい！'],["Let's study together!",'一緒に勉強しよう！'],
    ['You are getting better every day!','毎日うまくなってるよ！'],['Welcome back!','おかえり！'],
    ['I missed you.','会いたかったよ。'],['I am always on your side.','ぼくはいつでも味方だよ。'],
    ['No worries!','間違えてもだいじょうぶ！一緒にやろう！'],['You are my best friend!','きみはぼくの大切な友だちだよ！'],
    ['Thank you for studying with me.','一緒に勉強してくれてありがとう。'],['I am proud of you!','ぼくはきみを誇りに思うよ！']
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

// Fight Locks post-render polish scripts - extracted from index.html for browser caching.
(function(){
  "use strict";
  var fallbackFights=typeof embeddedUfc328FightCard==="function"?embeddedUfc328FightCard():[
    {id:"m1",f1:"Khamzat Chimaev",f2:"Sean Strickland",w:"Middleweight Championship",title:true,bonus:true,o1:-535,o2:400},
    {id:"m2",f1:"Joshua Van",f2:"Tatsuro Taira",w:"Flyweight Championship",title:true,bonus:true,o1:130,o2:-155},
    {id:"m3",f1:"Alexander Volkov",f2:"Waldo Cortes-Acosta",w:"Heavyweight",bonus:true,o1:-142,o2:120},
    {id:"m4",f1:"Sean Brady",f2:"Joaquin Buckley",w:"Welterweight",bonus:true,o1:-185,o2:154},
    {id:"m5",f1:"King Green",f2:"Jeremy Stephens",w:"Catchweight",bonus:true,o1:-425,o2:330},
    {id:"p1",f1:"Ateba Gautier",f2:"Ozzy Diaz",w:"Middleweight",bonus:true,o1:-1050,o2:675},
    {id:"p2",f1:"Joel Alvarez",f2:"Yaroslav Amosov",w:"Welterweight",bonus:true,o1:160,o2:-192}
  ];
  var scoringRules={heavyFavoriteLine:-250,heavyFavoritePts:1,normalFavoritePts:2,smallUnderdogMin:100,smallUnderdogMax:249,smallUnderdogPts:3,bigUnderdogMin:250,bigUnderdogMax:499,bigUnderdogPts:4,majorUnderdogMin:500,majorUnderdogPts:5,methodPts:{ko:2,sub:2,dec:1},timingPts:{r1:3,r2:2,r3:2,r4:2,r5:2,distance:1},overUnderPts:1,lockWinPts:2};
  function esc(v){return String(v==null?"":v).replace(/[&<>'"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c];});}
  function last(v){var parts=String(v||"").trim().split(/\s+/);return parts[parts.length-1]||String(v||"");}
  function restValue(v){
    if(!v)return null;
    if(Object.prototype.hasOwnProperty.call(v,"stringValue"))return v.stringValue;
    if(Object.prototype.hasOwnProperty.call(v,"integerValue"))return parseInt(v.integerValue,10);
    if(Object.prototype.hasOwnProperty.call(v,"doubleValue"))return parseFloat(v.doubleValue);
    if(Object.prototype.hasOwnProperty.call(v,"booleanValue"))return !!v.booleanValue;
    if(Object.prototype.hasOwnProperty.call(v,"timestampValue"))return v.timestampValue;
    if(v.mapValue){var o={},fields=v.mapValue.fields||{};Object.keys(fields).forEach(function(k){o[k]=restValue(fields[k]);});return o;}
    if(v.arrayValue)return (v.arrayValue.values||[]).map(restValue);
    return null;
  }
  function restDoc(doc){
    var data={},fields=doc&&doc.fields||{};
    Object.keys(fields).forEach(function(k){data[k]=restValue(fields[k]);});
    if(doc&&doc.name&&!data.docId)data.docId=String(doc.name).split("/").pop();
    return data;
  }
  function poolId(){
    return new URLSearchParams(location.search).get("pool")||"";
  }
  function entriesUrl(){
    return "https://firestore.googleapis.com/v1/projects/ufc328pool/databases/(default)/documents/pools/"+encodeURIComponent(poolId())+"/entries";
  }
  function resultsUrl(){
    return "https://firestore.googleapis.com/v1/projects/ufc328pool/databases/(default)/documents/pools/"+encodeURIComponent(poolId())+"/results";
  }
  function fightsResultUrl(){
    return resultsUrl()+"/fights";
  }
  function requestJson(url,emptyValue){
    return new Promise(function(resolve){
      try{
        if(typeof fetch==="function"){
          fetch(url).then(function(res){if(!res.ok)return emptyValue;return res.json();}).then(resolve).catch(function(){resolve(emptyValue);});
          return;
        }
        var xhr=new XMLHttpRequest();
        xhr.open("GET",url,true);
        xhr.onreadystatechange=function(){
          if(xhr.readyState!==4)return;
          if(xhr.status<200||xhr.status>=300){resolve(emptyValue);return;}
          try{resolve(JSON.parse(xhr.responseText||"{}"));}catch(e){resolve(emptyValue);}
        };
        xhr.onerror=function(){resolve(emptyValue);};
        xhr.send();
      }catch(e){
        resolve(emptyValue);
      }
    });
  }
  function savedEventFights(){
    try{
      var raw=localStorage.getItem("fightLocksEventsDraft");
      var payload=raw?JSON.parse(raw):null;
      var events=payload&&payload.events;
      if(!events)return [];
      var active=localStorage.getItem("fightLocksActiveEventId")||(payload&&payload.activeEventId)||"";
      var event=(active&&events[active])||events["ufc-328-white-house"]||events[Object.keys(events)[0]];
      var saved=event&&Array.isArray(event.fights)?event.fights:[];
      if(!saved.length)return [];
      var byId={};
      fallbackFights.forEach(function(fight){byId[fight.id]=fight;});
      return saved.filter(function(fight){return fight&&fight.id&&fight.f1&&fight.f2;}).map(function(fight){
        return Object.assign({},byId[fight.id]||{},fight);
      });
    }catch(e){return [];}
  }
  function allPicksFightOrder(){
    try{
      if(typeof window.activeFights==="function"){
        var live=window.activeFights();
        if(Array.isArray(live)&&live.length)return live;
      }
    }catch(e){}
    var saved=savedEventFights();
    return saved.length?saved:fallbackFights;
  }
  function methodLabel(m){return ({ko:"KO/TKO",sub:"Submission",dec:"Decision"})[m]||m||"Method not picked";}
  function timingLabel(t){if(!t)return "Round not picked";return t==="distance"?"Goes Distance":String(t).toUpperCase();}
  function overLabel(v){return v==="over"?"Over":(v==="under"?"Under":"O/U not picked");}
  function winPts(fight,side){
    var odds=parseInt(side===1?fight.o1:fight.o2,10);
    if(isNaN(odds))return scoringRules.normalFavoritePts;
    if(odds<0)return odds<=scoringRules.heavyFavoriteLine?scoringRules.heavyFavoritePts:scoringRules.normalFavoritePts;
    if(odds>=scoringRules.majorUnderdogMin)return scoringRules.majorUnderdogPts;
    if(odds>=scoringRules.bigUnderdogMin)return scoringRules.bigUnderdogPts;
    return scoringRules.smallUnderdogPts;
  }
  function methodPts(m){return scoringRules.methodPts[m]||0;}
  function timingPts(t){return scoringRules.timingPts[t]||0;}
  function overUnderLine(fight){return fight.title?2.5:1.5;}
  function overUnderResult(fight,result){
    if(result&&result.overUnderResult)return result.overUnderResult;
    var timing=result&&result.timing;
    if(timing==="distance")return "over";
    var m=String(timing||"").match(/^r(\d+)$/);
    if(!m)return "";
    var round=parseInt(m[1],10), target=Math.floor(overUnderLine(fight))+1;
    if(round>target)return "over";
    if(round<target)return "under";
    return "";
  }
  function statusOf(result){return String(result&&result.fightStatus||"scheduled").toLowerCase().replace(/\s+/g,"_");}
  function isResolved(result){var s=statusOf(result);return !!(result&&(result.winner||s==="completed"||s==="draw"||s==="cancelled"||s==="no_contest"||s==="disqualification"));}
  function canScoreWinner(result){var s=statusOf(result);return s==="completed"||(s==="scheduled"&&result&&result.winner)||(s==="disqualification"&&result&&result.dqHasOfficialWinner&&result.winner);}
  function canScoreMethod(result){return canScoreWinner(result)&&statusOf(result)!=="disqualification";}
  function canScoreRound(result){return canScoreWinner(result);}
  function canScoreOu(result){var s=statusOf(result);if(s==="completed"||s==="scheduled")return true;if(s==="draw")return !!(result&&result.shouldGradeOverUnder);if(s==="disqualification")return !!(result&&result.dqHasOfficialWinner&&result.winner);return false;}
  function canScoreLock(result){return canScoreWinner(result)&&result&&result.shouldCountForLockOfTheNight!==false;}
  function lockInfo(entry){
    var lock=entry&&entry.props&&entry.props.lock||"";
    var parts=String(lock).split(":");
    return {fightId:parts[0]||"",side:parseInt(parts[1],10)};
  }
  function fightPoints(entry,fight,result){
    var picks=entry.picks||{}, methods=entry.methods||{}, props=entry.props||{}, timings=props.timings||{}, overs=props.overs||{};
    var side=parseInt(picks[fight.id],10), total=0, ou=canScoreOu(result)?overUnderResult(fight,result):"";
    if(!isResolved(result))return 0;
    if(result&&result.winner){
      var won=side===parseInt(result.winner,10);
      if(canScoreWinner(result)&&won)total+=winPts(fight,side);
      if(canScoreMethod(result)&&won&&methods[fight.id]&&methods[fight.id]===result.method)total+=methodPts(result.method);
      if(canScoreRound(result)&&won&&result.timing&&timings[fight.id]&&timings[fight.id]===result.timing)total+=timingPts(result.timing);
      var li=lockInfo(entry);
      if(li.fightId===fight.id&&li.side===parseInt(result.winner,10)&&canScoreLock(result))total+=scoringRules.lockWinPts;
    }
    if(ou&&overs[fight.id]===ou)total+=scoringRules.overUnderPts;
    return total;
  }
  function totalScore(entry,results){
    return allPicksFightOrder().reduce(function(sum,fight){return sum+fightPoints(entry,fight,results[fight.id]||{});},0);
  }
  function chip(label,pts,state){
    var bg=state==="hit"?"#1c4532":(state==="miss"?"#742a2a":(state==="void"?"#2d3748":"#05070c"));
    var col=state==="hit"?"#68d391":(state==="miss"?"#fc8181":(state==="void"?"#f6d46b":"#fff"));
    return '<div><span class="ap-method-pill" style="background:'+bg+';color:'+col+'">'+esc(label)+'<span class="ap-method-pts">'+esc(pts)+'</span></span></div>';
  }
  function lockText(entry,fight,result,resolved){
    var lock=entry&&entry.props&&entry.props.lock||"";
    var parts=String(lock).split(":");
    if(parts[0]!==fight.id)return "";
    var side=parseInt(parts[1],10);
    var hit=resolved&&result&&result.winner&&parseInt(result.winner,10)===side&&canScoreLock(result);
    var miss=resolved&&!hit;
    return chip("LOCK "+last(side===1?fight.f1:fight.f2),resolved?(hit?"+"+scoringRules.lockWinPts+"pt ✓":"0pt"):"+"+scoringRules.lockWinPts+"pt",hit?"hit":(miss?"miss":"pending"));
  }
  function rowHtml(entry,fight,result,scoreInfo){
    var picks=entry.picks||{}, methods=entry.methods||{}, props=entry.props||{};
    var side=parseInt(picks[fight.id],10);
    var pickName=side===1?fight.f1:(side===2?fight.f2:"Pick missing");
    var timings=props.timings||{}, overs=props.overs||{};
    var resolved=isResolved(result), hasWinner=!!(result&&result.winner), won=hasWinner&&side===parseInt(result.winner,10);
    scoreInfo=scoreInfo||null;
    var scoreHtml=scoreInfo?'<div class="ap-score"><span class="ap-score-total">'+esc(scoreInfo.total)+'pt</span><span class="ap-score-breakdown">'+esc(scoreInfo.previous)+' before + '+esc(scoreInfo.gain)+' this fight = '+esc(scoreInfo.total)+' total</span></div>':'<div class="ap-score">'+esc(typeof entry.__fallbackScore==="number"&&!isNaN(entry.__fallbackScore)?entry.__fallbackScore+"pt":"0pt")+'</div>';
    var chips=[];
    var winnerState=resolved?(hasWinner?(won?"hit":"miss"):"void"):"pending";
    chips.push('<div class="ap-pick"><span class="ap-tag combined-pick" style="background:'+(winnerState==="hit"?"#1c4532":(winnerState==="miss"?"#742a2a":"#2d3748"))+';color:'+(winnerState==="hit"?"#68d391":(winnerState==="miss"?"#fc8181":"#f6d46b"))+'">'+(won?"✓ ":"")+esc(last(pickName))+'<span class="ap-tag-pts">'+(resolved?(won?"+"+winPts(fight,side)+"pt ✓":"0pt"):"+"+winPts(fight,side)+"pt")+'</span></span></div>');
    if(methods[fight.id])chips.push(chip(methodLabel(methods[fight.id]),resolved?(hasWinner&&won&&methods[fight.id]===result.method?"+"+methodPts(result.method)+"pt ✓":"0pt"):"+"+methodPts(methods[fight.id])+"pt",resolved?(hasWinner&&won&&methods[fight.id]===result.method?"hit":"miss"):"pending"));
    if(timings[fight.id])chips.push(chip(timingLabel(timings[fight.id]),resolved?(hasWinner&&won&&timings[fight.id]===result.timing?"+"+timingPts(result.timing)+"pt ✓":"0pt"):"+"+timingPts(timings[fight.id])+"pt",resolved?(hasWinner&&won&&timings[fight.id]===result.timing?"hit":"miss"):"pending"));
    if(overs[fight.id]){var ou=canScoreOu(result)?overUnderResult(fight,result):"";chips.push(chip(overLabel(overs[fight.id])+" "+overUnderLine(fight),resolved?(ou&&overs[fight.id]===ou?"+"+scoringRules.overUnderPts+"pt ✓":"0pt"):"+"+scoringRules.overUnderPts+"pt",resolved?(ou&&overs[fight.id]===ou?"hit":"miss"):"pending"));}
    var lock=lockText(entry,fight,result,resolved);
    if(lock)chips.push(lock);
    return '<div class="ap-row plain-nameplate"><div><div class="ap-name">'+esc(entry.name||entry.username||"Player")+'</div>'+scoreHtml+'</div><div class="ap-right">'
      +chips.join("")
      +'</div></div>';
  }
  function tiebreakerHtml(entries){
    var rows=entries.map(function(entry){
      var ft=(entry.props&&entry.props.fastestFinish)||(entry.props&&entry.props.fastestFinishTiebreaker)||entry.fastestFinish||entry.fastestFinishTiebreaker||{};
      var round=String(ft.round||ft.r||"").toUpperCase();
      var mark=ft.mark||ft.time||ft.timeMark||"";
      var text=round&&mark?round+" at "+mark:"Not picked";
      return '<div class="tie-board-row"><span>'+esc(entry.name||"Player")+'</span><strong>'+esc(text)+'</strong></div>';
    }).join("");
    return '<div class="ap-block potential-tie-board" id="fallbackTiebreakerPicks"><div class="ap-header"><div><div class="ap-title">Fastest Finish Tiebreaker Picks</div><div class="ap-split">Shown from first place to last.</div></div><div style="display:flex;align-items:center;gap:8px"><span class="ap-result-label">TIEBREAKER</span><span class="ap-chevron">▼</span></div></div><div class="ap-body">'+rows+'</div></div>';
  }
  function resultLabel(fight,result,entries){
    if(!isResolved(result))return '<span style="color:#555;font-size:10px">Pending</span>';
    var s=statusOf(result), ou=canScoreOu(result)?overUnderResult(fight,result):"";
    if(s==="draw")return '<span class="ap-result-label">RESULT</span><span style="color:#f6d46b;font-size:10px">Draw - winner voided'+(ou?" · O/U "+overUnderLine(fight)+": "+overLabel(ou):"")+'</span>';
    if(s==="cancelled")return '<span class="ap-result-label">RESULT</span><span style="color:#f6d46b;font-size:10px">Cancelled - voided</span>';
    if(s==="no_contest")return '<span class="ap-result-label">RESULT</span><span style="color:#f6d46b;font-size:10px">No Contest - voided</span>';
    if(s==="disqualification"&&!result.winner)return '<span class="ap-result-label">RESULT</span><span style="color:#f6d46b;font-size:10px">DQ - voided</span>';
    if(!result.winner)return '<span class="ap-result-label">RESULT</span><span style="color:#f6d46b;font-size:10px">Winner voided</span>';
    var winner=result.winner===1?fight.f1:fight.f2;
    var correct=entries.filter(function(e){return parseInt((e.picks||{})[fight.id],10)===parseInt(result.winner,10);}).length;
    var bits=[(s==="disqualification"?"DQ winner: ":"✓ ")+last(winner)+" ("+correct+"/"+entries.length+")"];
    if(s==="disqualification")bits.push("Method voided");
    else if(result.method)bits.push(methodLabel(result.method));
    if(result.timing)bits.push(timingLabel(result.timing)+(result.stoppageMark?" at "+result.stoppageMark:""));
    if(ou)bits.push("O/U "+overUnderLine(fight)+": "+overLabel(ou));
    return '<span class="ap-result-label">RESULT</span><span style="color:#68d391;font-size:10px">'+esc(bits.join(" · "))+'</span>';
  }
  function normalizeResults(json){
    var out={};
    if(json&&json.fields){
      var one=restDoc(json);
      Object.keys(one).forEach(function(fid){if(one[fid]&&typeof one[fid]==="object")out[fid]=one[fid];});
      return out;
    }
    (json.documents||[]).forEach(function(doc){
      var id=String(doc.name||"").split("/").pop(), data=restDoc(doc);
      if(id==="fights")Object.keys(data).forEach(function(fid){if(data[fid]&&typeof data[fid]==="object")out[fid]=data[fid];});
      else if(data&&typeof data==="object")out[id]=data;
    });
    return out;
  }
  function syncResultsToApp(results){
    if(!results||!Object.keys(results).length)return;
    var normalized={};
    allPicksFightOrder().forEach(function(fight){
      var raw=results[fight.id];
      if(!raw)return;
      try{
        normalized[fight.id]=typeof window.normalizeFightResultData==="function"?window.normalizeFightResultData(fight,raw):raw;
      }catch(e){
        normalized[fight.id]=raw;
      }
    });
    if(!Object.keys(normalized).length)return;
    window.__standaloneRecoveredFightResults=Object.assign({},window.__standaloneRecoveredFightResults||{},normalized);
    try{window.fightResults=Object.assign({},window.fightResults||{},normalized);}catch(e){}
  }
  function render(entries,results){
    var el=document.getElementById("allPicksContent");
    if(!el||!entries.length)return;
    if(typeof window.canSeeAllPicks==="function"&&!window.canSeeAllPicks()){
      if(typeof window.hiddenPicksMessage==="function")el.innerHTML=window.hiddenPicksMessage();
      return;
    }
    results=results||{};
    syncResultsToApp(results);
    var leaderboardScores={};
    Array.prototype.slice.call(document.querySelectorAll("#lbList .lb-entry")).forEach(function(row){
      var nameEl=row.querySelector(".lb-name"), ptsEl=row.querySelector(".lb-pts");
      var name=(nameEl&&nameEl.textContent||"").replace(/^(?:T-)?\d+\.\s*/,"").trim();
      var pts=parseInt((ptsEl&&ptsEl.textContent||"").replace(/[^\d-]/g,""),10);
      if(name&&!isNaN(pts))leaderboardScores[name]=pts;
    });
    entries.forEach(function(entry){
      var computed=totalScore(entry,results);
      entry.__fallbackScore=leaderboardScores[entry.name]!==undefined?leaderboardScores[entry.name]:computed||0;
    });
    var ordered=entries.slice().sort(function(a,b){
      return (b.__fallbackScore||0)-(a.__fallbackScore||0)||String(a.name||"").localeCompare(String(b.name||""));
    });
    var completedFlow=allPicksFightOrder().slice().reverse().filter(function(fight){return isResolved(results[fight.id]||{});});
    function runningScore(entry,fight){
      var total=0, gain=0, found=false;
      completedFlow.forEach(function(doneFight){
        var pts=fightPoints(entry,doneFight,results[doneFight.id]||{});
        if(!found)total+=pts;
        if(doneFight.id===fight.id){gain=pts;found=true;}
      });
      return {total:total,gain:gain,previous:total-gain,found:found};
    }
    var html=tiebreakerHtml(ordered)+allPicksFightOrder().map(function(fight){
      var result=results[fight.id]||{};
      var f1=ordered.filter(function(e){return parseInt((e.picks||{})[fight.id],10)===1;}).length;
      var f2=ordered.filter(function(e){return parseInt((e.picks||{})[fight.id],10)===2;}).length;
      var resolved=isResolved(result);
      var rowData=ordered.map(function(entry,idx){
        var score=resolved?runningScore(entry,fight):null;
        return {entry:entry,index:idx,score:score};
      });
      if(resolved)rowData.sort(function(a,b){return b.score.total-a.score.total||a.index-b.index;});
      var leadScore=resolved&&rowData.length?rowData[0].score.total:null;
      return '<div class="ap-block" id="fallback_apb_'+esc(fight.id)+'"><div class="ap-header" onclick="document.getElementById(\'fallback_apb_'+esc(fight.id)+'\').classList.toggle(\'open\')"><div><div class="ap-title">'+esc(last(fight.f1)+" vs "+last(fight.f2))+'</div><div class="ap-split">'+esc(last(fight.f1))+' '+f1+' · '+esc(last(fight.f2))+' '+f2+'</div></div><div style="display:flex;align-items:center;gap:8px">'+resultLabel(fight,result,ordered)+'<span class="ap-chevron">▼</span></div></div><div class="ap-body">'+rowData.map(function(row){return rowHtml(row.entry,fight,result,row.score).replace("ap-row plain-nameplate","ap-row "+(resolved&&row.score.total===leadScore?"all-picks-leader ":"")+"plain-nameplate");}).join("")+'</div></div>';
    }).join("");
    el.innerHTML=html;
  }
  function shouldFill(){
    var view=document.getElementById("view-allpicks"), el=document.getElementById("allPicksContent");
    return !!(poolId()&&view&&el&&view.classList.contains("active")&&(!el.querySelector(".ap-block")||el.querySelector("[id^='fallback_apb_']")));
  }
  function shouldSyncResults(){
    var hash=String(location.hash||"").toLowerCase();
    if(!poolId()||window.godModeRequested)return false;
    return hash==="#mine"||hash==="#allpicks"||!!document.getElementById("mineContent")||!!document.getElementById("allPicksContent");
  }
  function syncOnly(){
    if(!shouldSyncResults()||window.__standaloneResultsSyncing)return;
    window.__standaloneResultsSyncing=true;
    if(typeof window.refreshFightResultsForViews==="function"){
      Promise.resolve(window.refreshFightResultsForViews()).finally(function(){window.__standaloneResultsSyncing=false;});
      return;
    }
    Promise.all([
      requestJson(resultsUrl(),{documents:[]}),
      requestJson(fightsResultUrl(),{})
    ])
      .then(function(parts){
        var merged=Object.assign({},normalizeResults(parts[0]||{}),normalizeResults(parts[1]||{}));
        syncResultsToApp(merged);
        try{if(typeof window.renderMySummary==="function")window.renderMySummary();}catch(e){}
        try{if(typeof window.renderLeaderboard==="function")window.renderLeaderboard();}catch(e){}
        try{if(String(location.hash||"").toLowerCase()==="#allpicks"&&typeof window.renderAllPicks==="function")window.renderAllPicks();}catch(e){}
      })
      .catch(function(e){console.warn("Standalone result sync failed",e);})
      .finally(function(){window.__standaloneResultsSyncing=false;});
  }
  function fill(){
    if(!shouldFill()||window.__standaloneAllPicksFilling)return;
    window.__standaloneAllPicksFilling=true;
    Promise.all([
      requestJson(entriesUrl(),{documents:[]}),
      requestJson(resultsUrl(),{documents:[]}),
      requestJson(fightsResultUrl(),{})
    ])
      .then(function(parts){
        var merged=Object.assign({},normalizeResults(parts[1]||{}),normalizeResults(parts[2]||{}));
        render((parts[0].documents||[]).map(restDoc).filter(function(e){return e&&e.docId;}),merged);
      })
      .catch(function(e){console.warn("Standalone All Picks fallback failed",e);})
      .finally(function(){window.__standaloneAllPicksFilling=false;});
  }
  document.addEventListener("click",function(e){
    var btn=e.target&&e.target.closest&&e.target.closest("button");
    if(btn&&/all picks/i.test(btn.textContent||""))setTimeout(fill,80);
    if(btn&&/my picks/i.test(btn.textContent||""))setTimeout(syncOnly,80);
  },true);
  window.addEventListener("hashchange",function(){
    setTimeout(fill,80);
    setTimeout(syncOnly,80);
  });
  setTimeout(fill,400);
  setTimeout(fill,1200);
  setTimeout(fill,2400);
  setTimeout(syncOnly,500);
  setTimeout(syncOnly,1500);
  setTimeout(syncOnly,3000);
})();

(function(){
  "use strict";
  function esc(v){return String(v==null?"":v).replace(/[&<>'"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c];});}
  function normalizedTitle(v){return String(v||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
  function allPicksBlockForTitle(titleText){
    var wanted=normalizedTitle(titleText);
    var blocks=[].slice.call(document.querySelectorAll("#allPicksContent .ap-block"));
    return blocks.find(function(block){
      var title=normalizedTitle(block.querySelector(".ap-title")&&block.querySelector(".ap-title").textContent||"");
      return title&&wanted&&title===wanted;
    })||null;
  }
  function statusFromAllPicksTitle(titleText){
    var block=allPicksBlockForTitle(titleText);
    if(!block)return null;
    var text=block.innerText||"", low=text.toLowerCase();
    var ouMatch=text.match(/O\/U\s+[0-9.]+:\s*(Over|Under)/i);
    var ou=ouMatch?ouMatch[1]:"";
    if(low.indexOf("no contest")>-1)return {label:"No Contest",detail:"No points: fight voided"};
    if(low.indexOf("draw")>-1)return {label:"Draw",detail:"Winner points voided"+(ou?" · O/U: "+ou:"")};
    if(low.indexOf("cancelled")>-1)return {label:"Cancelled",detail:"No points: fight cancelled"};
    if(low.indexOf("dq winner")>-1||low.indexOf("disqualification")>-1){
      var winner=(text.match(/DQ winner:\s*([A-Za-z'.-]+)/i)||[])[1]||"";
      return {label:"DQ",detail:winner?("Official winner: "+winner+" · Method voided"+(ou?" · O/U: "+ou:"")):"No points: DQ voided"};
    }
    return null;
  }
  function patchMySpecialResults(){
    var mineRoot=document.getElementById("mineContent");
    if(!mineRoot)return;
    [].slice.call(document.querySelectorAll("#mineContent .my-pick-detail")).forEach(function(detail){
      var titleEl=detail.querySelector(".my-pick-match,.my-fight");
      var status=titleEl&&statusFromAllPicksTitle(titleEl.textContent||"");
      var wrap=detail.querySelector(".my-fight-wrap");
      if(!wrap)return;
      [].slice.call(detail.querySelectorAll(".my-special-result-bridge,.my-special-result-bridge-score")).forEach(function(node){node.remove();});
      [].slice.call(detail.querySelectorAll("[data-fl-original-text]")).forEach(function(node){
        node.textContent=node.getAttribute("data-fl-original-text")||node.textContent;
        node.removeAttribute("data-fl-original-text");
      });
      if(!status)return;
      var fightTitle=wrap.querySelector(".my-fight");
      var html='<div class="my-result-line my-special-result-bridge"><span class="my-result-label">Result</span><span class="my-result-pill">'+esc(status.label)+'</span><span class="my-result-method">'+esc(status.detail)+'</span></div>';
      if(fightTitle)fightTitle.insertAdjacentHTML("afterend",html);
      else wrap.insertAdjacentHTML("afterbegin",html);
      if(status.label==="No Contest"||status.label==="Cancelled"){
        [].slice.call(detail.querySelectorAll(".my-tag-pts,.my-method-pts,.extra-pill span,.my-lock-pill")).forEach(function(node){
          if(!node.hasAttribute("data-fl-original-text"))node.setAttribute("data-fl-original-text",node.textContent||"");
          node.textContent=node.classList&&node.classList.contains("my-lock-pill")?node.textContent.replace(/·.*/,"· 0 PT"):"0pt";
        });
      }else if(status.label==="Draw"){
        [].slice.call(detail.querySelectorAll(".my-tag-pts,.my-method-pts")).forEach(function(node){
          if(!node.hasAttribute("data-fl-original-text"))node.setAttribute("data-fl-original-text",node.textContent||"");
          node.textContent="0pt";
        });
        [].slice.call(detail.querySelectorAll(".extra-pill")).forEach(function(pill){
          if(!/\b(?:Over|Under)\b/i.test(pill.textContent||"")){
            var span=pill.querySelector("span");
            if(span){
              if(!span.hasAttribute("data-fl-original-text"))span.setAttribute("data-fl-original-text",span.textContent||"");
              span.textContent="0pt";
            }
          }
        });
        [].slice.call(detail.querySelectorAll(".my-lock-pill")).forEach(function(node){
          if(!node.hasAttribute("data-fl-original-text"))node.setAttribute("data-fl-original-text",node.textContent||"");
          node.textContent=node.textContent.replace(/·.*/,"· 0 PT");
        });
      }
      var score=wrap.querySelector(".fight-score-line");
      if(score&&/No points|Winner points voided|fight voided|fight cancelled/i.test(status.detail)){
        score.insertAdjacentHTML("afterbegin",'<span class="fight-score-pill zero my-special-result-bridge-score">'+esc(status.label)+' posted</span>');
      }
    });
  }
  ["click","hashchange"].forEach(function(evt){window.addEventListener(evt,function(){setTimeout(patchMySpecialResults,120);setTimeout(patchMySpecialResults,800);},true);});
  setTimeout(patchMySpecialResults,400);
  setTimeout(patchMySpecialResults,1400);
  setInterval(patchMySpecialResults,2500);
})();

(function(){
  "use strict";
  function parseScore(text){
    var m=String(text||"").match(/-?\d+/);
    return m?parseInt(m[0],10):0;
  }
  function playerName(row){
    return (row.querySelector(".ap-name")&&row.querySelector(".ap-name").textContent||"").trim();
  }
  function rowScore(row){
    return parseScore(row.querySelector(".ap-score,.ap-score-total")&&row.querySelector(".ap-score,.ap-score-total").textContent);
  }
  function scoreMapForBlock(block){
    var out={};
    [].slice.call(block.querySelectorAll(".ap-row")).forEach(function(row){out[playerName(row)]=rowScore(row);});
    return out;
  }
  function sortRows(block){
    var body=block.querySelector(".ap-body");
    if(!body)return;
    [].slice.call(body.querySelectorAll(".ap-row")).sort(function(a,b){
      return rowScore(b)-rowScore(a)||playerName(a).localeCompare(playerName(b));
    }).forEach(function(row,idx){
      row.classList.toggle("all-picks-leader",idx===0);
      body.appendChild(row);
    });
  }
  function polishAllPicksScores(){
    var blocks=[].slice.call(document.querySelectorAll("#allPicksContent .ap-block")).filter(function(block){return block.querySelector(".ap-row");});
    if(!blocks.length)return;
    blocks.forEach(sortRows);
    blocks.forEach(function(block,idx){
      var previousScores=idx<blocks.length-1?scoreMapForBlock(blocks[idx+1]):{};
      [].slice.call(block.querySelectorAll(".ap-row")).forEach(function(row){
        var scoreEl=row.querySelector(".ap-score");
        if(!scoreEl||scoreEl.querySelector(".ap-score-breakdown"))return;
        var total=rowScore(row), name=playerName(row), previous=Object.prototype.hasOwnProperty.call(previousScores,name)?previousScores[name]:0;
        var gain=total-previous;
        scoreEl.innerHTML='<span class="ap-score-total">'+total+'pt</span><span class="ap-score-breakdown">'+previous+' before + '+gain+' this fight = '+total+' total</span>';
      });
    });
  }
  ["click","hashchange"].forEach(function(evt){window.addEventListener(evt,function(){setTimeout(polishAllPicksScores,120);setTimeout(polishAllPicksScores,900);},true);});
  setTimeout(polishAllPicksScores,500);
  setTimeout(polishAllPicksScores,1600);
  setInterval(polishAllPicksScores,3000);
})();

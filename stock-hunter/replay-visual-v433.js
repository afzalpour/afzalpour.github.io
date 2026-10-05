'use strict';
/* Stock Hunter replay visual v4.3.3 — readable Y axis + actual session time scale. */
(function(){
  if(window.STOCK_HUNTER_REPLAY_VISUAL_V433)return;
  const $r=id=>document.getElementById(id);
  const isCross=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&((a<0&&b>=0)||(a>=0&&b<0));
  const segClass=(a,b)=>isCross(a,b)?'cross':b>=0?'positive':'negative';
  const cleanPct=v=>String(R.pct(v,1)).replace(/-/g,'−');
  chart=function(){
    if(!replayRows.length){$r('replayChart').innerHTML='<div class="empty">برای نماد و تاریخ انتخاب‌شده داده بازپخش ثبت نشده است.</div>';return;}
    const vals=replayRows.map(x=>Number(x.close_change_pct)).filter(Number.isFinite),ymin=Math.min(-1,...vals)-.35,ymax=Math.max(1,...vals)+.35;
    const top=24,bottom=198,left=96,right=944,plotW=right-left;
    const session=window.STOCK_HUNTER_REPLAY_SESSION_V433?.current||null;
    const fallbackStart=new Date(replayRows[0].bucket_at).getTime(),fallbackEnd=new Date(replayRows[replayRows.length-1].bucket_at).getTime();
    const startMs=Number.isFinite(session?.start_ms)?session.start_ms:fallbackStart,endMs=Number.isFinite(session?.end_ms)&&session.end_ms>startMs?session.end_ms:Math.max(startMs+1,fallbackEnd);
    const Xtime=t=>left+Math.max(0,Math.min(1,(t-startMs)/(endMs-startMs)))*plotW;
    const X=i=>Xtime(new Date(replayRows[i].bucket_at).getTime());
    const Y=y=>bottom-((y-ymin)/(ymax-ymin))*(bottom-top);
    const ci=Math.min(index,replayRows.length-1),cy=Number(replayRows[ci]?.close_change_pct),zero=Y(0);
    const p=replayRows.slice(0,ci+1).map((x,i)=>({i,y:Number(x.close_change_pct)})).filter(x=>Number.isFinite(x.y));
    const segments=[];for(let j=1;j<p.length;j++){const a=p[j-1],b=p[j],cls=segClass(a.y,b.y);segments.push('<path class="chart-segment '+cls+'" d="M'+X(a.i).toFixed(1)+','+Y(a.y).toFixed(1)+' L'+X(b.i).toFixed(1)+','+Y(b.y).toFixed(1)+'"/>');}
    const prev=ci>0?Number(replayRows[ci-1]?.close_change_pct):NaN,markerClass=Number.isFinite(cy)?(isCross(prev,cy)?'cross':cy>=0?'positive':'negative'):'',markerY=Number.isFinite(cy)?Y(cy):0,labelY=Math.max(18,markerY-14),markerX=X(ci);
    const marker=Number.isFinite(cy)?'<circle class="replay-current '+markerClass+'" cx="'+markerX+'" cy="'+markerY+'" r="7"/><text class="chart-label current-label" x="'+markerX+'" y="'+labelY+'" text-anchor="middle">'+R.time(replayRows[ci].bucket_at)+' · '+cleanPct(cy)+'</text>':'';
    const currentTs=replayRows[ci]?.bucket_at?new Date(replayRows[ci].bucket_at).getTime():Infinity;
    const eventMarks=journey?[['کشف',journey.detected_at],['صفر',journey.crossed_zero_at],['+۱٪',journey.crossed_plus1_at],['+۲٪',journey.crossed_plus2_at],['+۳٪',journey.crossed_plus3_at]].map(([l,t])=>{if(!t||new Date(t).getTime()>currentTs)return '';const tx=Xtime(new Date(t).getTime());return '<line class="replay-event-line" x1="'+tx+'" x2="'+tx+'" y1="'+top+'" y2="'+bottom+'"/><text class="chart-label event-label" x="'+tx+'" y="17" text-anchor="middle">'+l+'</text>';}).join(''):'';
    const tick=(value,y,cls='axis-label')=>'<g class="axis-tick"><line x1="'+(left-6)+'" x2="'+left+'" y1="'+y+'" y2="'+y+'"/><text class="chart-label '+cls+'" x="'+(left-11)+'" y="'+(y+4)+'" text-anchor="end">'+value+'</text></g>';
    const startLabel=session?.start_label||R.time(replayRows[0].bucket_at).slice(0,5),endLabel=session?.end_label||R.time(replayRows[replayRows.length-1].bucket_at).slice(0,5);
    $r('replayChart').innerHTML='<svg viewBox="0 0 960 240" preserveAspectRatio="none" role="img" aria-label="نمودار بازپخش تغییر قیمت در بازه واقعی جلسه"><rect class="replay-axis-gutter" x="0" y="0" width="'+(left-2)+'" height="240"/><rect class="replay-zone-positive" x="'+left+'" y="'+top+'" width="'+plotW+'" height="'+Math.max(0,zero-top)+'"/><rect class="replay-zone-negative" x="'+left+'" y="'+zero+'" width="'+plotW+'" height="'+Math.max(0,bottom-zero)+'"/><line class="chart-y-axis" x1="'+left+'" x2="'+left+'" y1="'+top+'" y2="'+bottom+'"/><line class="chart-zero" x1="'+left+'" x2="'+right+'" y1="'+zero+'" y2="'+zero+'"/>'+tick(cleanPct(ymax),top)+tick('۰٪',zero,'zero-label')+tick(cleanPct(ymin),bottom)+segments.join('')+eventMarks+marker+'<text class="chart-label x-axis-label" x="'+left+'" y="226" text-anchor="start">'+startLabel+'</text><text class="chart-label x-axis-label" x="'+right+'" y="226" text-anchor="end">'+endLabel+'</text></svg>';
  };
  window.STOCK_HUNTER_REPLAY_VISUAL_V433={version:'4.3.3',axis_mode:'RESERVED_GUTTER',axis_gutter_px:96,time_scale:'ACTUAL_SESSION_TIME',chart_mode:'PROGRESSIVE_SIGN_SEGMENTS'};
})();

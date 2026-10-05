'use strict';
(function(){
  const $r=id=>document.getElementById(id);
  const isCross=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&((a<0&&b>=0)||(a>=0&&b<0));
  const segClass=(a,b)=>isCross(a,b)?'cross':b>=0?'positive':'negative';
  const keepActiveRowInsideTable=row=>{
    if(!row)return;
    const wrap=row.closest('.table-wrap');
    if(!wrap)return;
    const rr=row.getBoundingClientRect(),wr=wrap.getBoundingClientRect(),head=38,pad=8;
    if(rr.top<wr.top+head)wrap.scrollTop+=rr.top-(wr.top+head);
    else if(rr.bottom>wr.bottom-pad)wrap.scrollTop+=rr.bottom-(wr.bottom-pad);
  };

  chart=function(){
    if(!replayRows.length){$r('replayChart').innerHTML='<div class="empty">برای نماد و تاریخ انتخاب‌شده داده بازپخش ثبت نشده است.</div>';return;}
    const vals=replayRows.map(x=>Number(x.close_change_pct)).filter(Number.isFinite),ymin=Math.min(-1,...vals)-.35,ymax=Math.max(1,...vals)+.35,n=Math.max(1,replayRows.length-1);
    const top=24,bottom=214,left=48,right=944,X=i=>left+(i/n)*(right-left),Y=y=>bottom-((y-ymin)/(ymax-ymin))*(bottom-top);
    const ci=Math.min(index,replayRows.length-1),cy=Number(replayRows[ci]?.close_change_pct),zero=Y(0);
    const p=replayRows.slice(0,ci+1).map((x,i)=>({i,y:Number(x.close_change_pct)})).filter(x=>Number.isFinite(x.y));
    const segments=[];
    for(let j=1;j<p.length;j++){
      const a=p[j-1],b=p[j],cls=segClass(a.y,b.y);
      segments.push('<path class="chart-segment '+cls+'" d="M'+X(a.i).toFixed(1)+','+Y(a.y).toFixed(1)+' L'+X(b.i).toFixed(1)+','+Y(b.y).toFixed(1)+'"/>');
    }
    const prev=ci>0?Number(replayRows[ci-1]?.close_change_pct):NaN;
    const markerClass=Number.isFinite(cy)?(isCross(prev,cy)?'cross':cy>=0?'positive':'negative'):'';
    const markerY=Number.isFinite(cy)?Y(cy):0,labelY=Math.max(18,markerY-14);
    const marker=Number.isFinite(cy)?'<circle class="replay-current '+markerClass+'" cx="'+X(ci)+'" cy="'+markerY+'" r="7"/><text class="chart-label current-label" x="'+X(ci)+'" y="'+labelY+'" text-anchor="middle">'+R.time(replayRows[ci].bucket_at)+' · '+R.pct(cy,1)+'</text>':'';
    const currentTs=replayRows[ci]?.bucket_at?new Date(replayRows[ci].bucket_at).getTime():Infinity;
    const eventMarks=journey?[['کشف',journey.detected_at],['صفر',journey.crossed_zero_at],['+۱٪',journey.crossed_plus1_at],['+۲٪',journey.crossed_plus2_at],['+۳٪',journey.crossed_plus3_at]].map(([l,t])=>{
      if(!t||new Date(t).getTime()>currentTs)return '';
      const z=new Date(t).getTime();let bi=0,bd=Infinity;for(let i=0;i<=ci;i++){const d=Math.abs(new Date(replayRows[i].bucket_at).getTime()-z);if(d<bd){bd=d;bi=i;}}
      return '<line class="replay-event-line" x1="'+X(bi)+'" x2="'+X(bi)+'" y1="'+top+'" y2="'+bottom+'"/><text class="chart-label event-label" x="'+X(bi)+'" y="17" text-anchor="middle">'+l+'</text>';
    }).join(''):'';
    const maxLabel=R.pct(ymax,1),minLabel=R.pct(ymin,1);
    $r('replayChart').innerHTML='<svg viewBox="0 0 960 240" preserveAspectRatio="none" role="img" aria-label="نمودار بازپخش تغییر قیمت"><rect class="replay-zone-positive" x="'+left+'" y="'+top+'" width="'+(right-left)+'" height="'+Math.max(0,zero-top)+'"/><rect class="replay-zone-negative" x="'+left+'" y="'+zero+'" width="'+(right-left)+'" height="'+Math.max(0,bottom-zero)+'"/><line class="chart-zero" x1="'+left+'" x2="'+right+'" y1="'+zero+'" y2="'+zero+'"/><text class="chart-label axis-label" x="8" y="'+(top+5)+'">'+maxLabel+'</text><text class="chart-label zero-label" x="8" y="'+(zero-5)+'">صفر</text><text class="chart-label axis-label" x="8" y="'+bottom+'">'+minLabel+'</text>'+segments.join('')+eventMarks+marker+'</svg>';
  };

  renderCurrent=function(){
    const x=current();$r('rpCount').textContent=R.fa(replayRows.length);
    const resolutions=[...new Set(replayRows.map(r=>Number(r.bucket_seconds)||30))].sort((a,b)=>a-b);$r('rpResolution').textContent=resolutions.length?resolutions.map(resolutionFa).join(' / '):'—';
    if(!x){for(const id of ['rpTime','rpPrice','rpChange','rpRange','rpQueue'])$r(id).textContent='—';chart();return;}
    $r('rpTime').textContent=R.time(x.bucket_at);$r('rpPrice').textContent=R.fa(x.close_price,0);$r('rpChange').textContent=R.pct(x.close_change_pct);
    $r('rpRange').textContent=R.fa(x.high_price,0)+' / '+R.fa(x.low_price,0);$r('rpQueue').textContent=R.fa(x.max_buy_queue,0)+' / '+R.fa(x.max_sell_queue,0);
    $r('replaySlider').value=String(index);chart();
    document.querySelectorAll('#replayBody tr').forEach((tr,i)=>tr.classList.toggle('replay-active',i===index));
    if(playTimer)keepActiveRowInsideTable(document.querySelector('#replayBody tr.replay-active'));
  };

  window.STOCK_HUNTER_REPLAY_VISUAL_V432={version:'4.3.2',page_scroll_lock:'TABLE_INTERNAL_ONLY',chart_mode:'PROGRESSIVE_SIGN_SEGMENTS'};
})();

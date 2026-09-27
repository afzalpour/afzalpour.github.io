'use strict';

// Stock Hunter 4.1.5 — visual-only direction badges for forecast comparison.
// This layer does not alter any forecast calculation or the integrated decision engine.
function forecastDirectionVisualV415(direction){
  const d=direction||'خنثی';
  if(d==='صعودی')return{cls:'up',icon:'↗',label:'صعودی'};
  if(d==='نزولی')return{cls:'down',icon:'↘',label:'نزولی'};
  return{cls:'flat',icon:'→',label:'خنثی'};
}

modelBox=function(m){
  const d=forecastDirectionVisualV415(m?.data?.direction);
  return `<div class="forecast-box ${m.data.ok?'ok':'wait'}"><b>${esc(m.name)}</b>${m.data.ok?`<div class="forecast-direction ${d.cls}" aria-label="جهت ${esc(d.label)}"><span class="forecast-direction-icon" aria-hidden="true">${d.icon}</span><span>جهت: ${esc(d.label)}</span></div>`:''}<p>${esc(m.data.text)}</p></div>`;
};

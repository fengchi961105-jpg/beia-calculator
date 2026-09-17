/* Channel × product linkage and grade-1 eligibility rules. */
(function(){
  const previousNormalizeChannel=normalize;
  normalize=function(c){
    const source=c||{},out=previousNormalizeChannel(source),preset=DEFAULTS.channels.find(x=>x.name===source.name);
    out.g1=Number.isFinite(Number(source.g1))?Number(source.g1):0;
    out.product=source.product||preset?.product||state?.settings?.defaultSeason||"26秋下12";
    return out;
  };
  const previousNormalizeState=normalizeState;
  normalizeState=function(s){
    const result=previousNormalizeState(s);
    result.channels=result.channels.map(normalize);
    return result;
  };

  function clampShare(v,max=1){return Math.max(0,Math.min(max,Number(v)||0))}
  function productRates(config,productId){
    const product=config.products.find(p=>p.id===productId||p.label===productId),rows=product?.rows||[];
    const average=(key,fallback)=>{const values=rows.filter(r=>r[key]!=null).map(r=>Number(r[key])).filter(Number.isFinite);return values.length?values.reduce((a,b)=>a+b,0)/values.length:fallback};
    return{margin:average("m",.77)*100,refund:average("rf",.90)*100};
  }
  productBlend=function(c,season,config=activeConfig()){
    const productId=season||c.product||config.settings.defaultSeason;
    const product=config.products.find(p=>p.id===productId||p.label===productId);
    if(!product)throw Error("当前应用模版中没有该售卖品："+productId);
    const p1=clampShare(c.g1/100),p2=clampShare(c.g2/100,1-p1),rest=Math.max(0,1-p1-p2)/4;
    const weights=[p1,p2,rest,rest,rest,rest],rows=product.rows;
    const subject=(key)=>rows.reduce((sum,r,i)=>sum+(Number(r[key])||0)*weights[i],0);
    const eligible=rows.map((r,i)=>({r,w:weights[i]})).filter(x=>x.w>0&&x.r.cASP!=null&&x.r.crA!=null);
    const eligibleShare=eligible.reduce((sum,x)=>sum+x.w,0);
    const coupled=(key,fallback)=>eligibleShare?eligible.reduce((sum,x)=>sum+(Number(x.r[key])||0)*x.w,0)/eligibleShare:subject(fallback);
    const rates=productRates(config,productId);
    return{asp:subject("asp"),renew:subject("rA"),cAsp:coupled("cASP","asp"),cRenew:coupled("crA","rA"),eligibleShare,productId,defaultMargin:rates.margin,defaultRefund:rates.refund};
  };
  economics=function(c,eff,output,volume,season,config=activeConfig(),overrides={}){
    c=normalize(c);
    const rate=Math.max(c.rate/100,.01),monthly=c.active+c.idle*(1/rate-1),lpc=monthly/Math.max(c.periods,.01)/Math.max(eff,1),other=c.settle+c.material+c.labor+c.rd,total=other+lpc;
    const p=productBlend(c,season||c.product,config),margin=Number.isFinite(Number(overrides.margin))?Number(overrides.margin):p.defaultMargin,refund=Number.isFinite(Number(overrides.refund))?Number(overrides.refund):p.defaultRefund,coupling=Math.max(0,c.coupling/100)*p.eligibleShare,subjectShare=1/(1+coupling),coupledShare=coupling/(1+coupling);
    const avgCurrent=subjectShare*p.asp+coupledShare*p.cAsp,conversion=avgCurrent>0?Math.max(output,0)/avgCurrent:0;
    const ltvPv=(subjectShare*(p.asp+p.renew)+coupledShare*(p.cAsp+p.cRenew))*(margin/100)*(refund/100)*c.overlap;
    const ltv=c.lead+ltvPv*conversion,north=ltv/Math.max(total,.01),profit=(ltv-total)*volume;
    return{lpc,other,ltv,total,north,profit,gmv:output*volume,people:volume/Math.max(eff,1),conversion,productId:p.productId,effectiveCoupling:coupling,margin,refund};
  };

  const oneDecimalFields=new Set(["lead","settle","material","labor","rd"]);
  function smartParam(value){const n=Number(value);return Number.isFinite(n)?(Number.isInteger(n)?String(n):n.toFixed(1)):""}
  function displayParam(k,value){return oneDecimalFields.has(k)?smartParam(value):value}
  function productOptions(config,value){return config.products.map(p=>`<option value="${esc(p.id)}" ${p.id===value?"selected":""}>${esc(p.label)}</option>`).join("")}
  function rebuildHeaders(){
    const paramHead=document.querySelector("#params .table-wrap .tbl thead tr");
    if(paramHead)paramHead.innerHTML='<th class="sticky-col">渠道</th>'+PARAM_HEADERS.slice(1).map(h=>`<th>${esc(h)}</th>`).join("")+'<th>操作</th>';
    const staffHead=document.querySelector("#staff .staff-table thead");
    if(staffHead)staffHead.innerHTML='<tr class="group-row"><th class="sticky-col" rowspan="2">渠道</th><th rowspan="2">售卖品</th><th colspan="7">承接安排</th><th colspan="10">测算结果</th><th colspan="6">本期参数</th></tr><tr class="sub-row"><th>渠道报量</th><th>承接量</th><th>量级调减</th><th>承接占比</th><th>基准人效</th><th>基准例产</th><th>方案人效</th><th class="param-divider">预计例产</th><th>需求人力</th><th>北A</th><th>LTV收入/例</th><th>单例总成本</th><th>LPC成本/例</th><th>实物成本/例</th><th>人产</th><th>GMV</th><th>北A利润</th><th class="param-divider">毛利率%</th><th>退费系数%</th><th>斜率/+10</th><th>拉新收入</th><th>结算成本</th><th>排班率</th></tr>';
    const staffSeason=$("sSeason")?.closest(".field");if(staffSeason)staffSeason.style.display="none";
    const defaultSeason=$("pDefaultSeason")?.closest(".field");if(defaultSeason)defaultSeason.style.display="none";
    const staffLead=document.querySelector("#staff .card .lead");if(staffLead)staffLead.textContent="每个渠道选择本期售卖品后，系统自动带出该品默认毛利率与退费系数；本期如有实际值，可直接修改后重算。";
    const productNote=document.querySelector("#productCenter>p");if(productNote)productNote.innerHTML='维护一至六年级ASP和续报ASP，并维护售卖品默认毛利率、退费系数。默认值用于初始化，本期测算仍可覆盖。<br>参数来源：<a href="https://docs.yukework.com/doc?fileId=1872221674903367682" target="_blank" rel="noopener noreferrer">各学季北极星参数表</a>';
  }

  fillParams=function(){
    renderProductSelects();const locked=isDefaultTemplate();$("pDefaultSeason").value=state.settings.defaultSeason;$("params").classList.toggle("locked-default",locked);
    const numberFields=PARAM_FIELDS.filter(k=>k!=="product");
    $("paramRows").innerHTML=state.channels.map((raw,i)=>{const c=normalize(raw),ro=locked?" readonly":"",disabled=locked?" disabled":"";return`<tr data-i="${i}"><td class="sticky-col"><input data-k="name" value="${esc(c.name)}" style="width:118px;text-align:left"${ro}></td><td><select data-k="product"${disabled}>${productOptions(state,c.product)}</select></td>${numberFields.map(k=>`<td><input data-k="${k}" type="number" step="${oneDecimalFields.has(k)?"0.1":"any"}" value="${displayParam(k,c[k])}"${ro}></td>`).join("")}<td><div style="display:flex;gap:5px"><button class="btn pcopy" type="button"${locked?" disabled":""}>复制</button><button class="btn pdel danger" type="button"${locked?" disabled":""}>删除</button></div></td></tr>`}).join("");
    $("addParam").disabled=locked;$("savePersonal").disabled=locked;$("deletePersonal").disabled=locked||!personalTemplates()[activeTemplateName];$("applyParams").disabled=false;
    $("paramRows").querySelectorAll(".pdel").forEach(b=>b.onclick=()=>{if(isDefaultTemplate())return;captureStaffDraft();readParams();const i=+b.closest("tr").dataset.i,name=state.channels[i]?.name;state.channels.splice(i,1);persistWorking();fillParams();renderProductCenter();$("saveStatus").textContent=`渠道“${name}”已从编辑中的模版删除，应用后生效。`});
    $("paramRows").querySelectorAll(".pcopy").forEach(b=>b.onclick=()=>{if(isDefaultTemplate())return;readParams();const i=+b.closest("tr").dataset.i,copy=structuredClone(state.channels[i]);copy.name=copy.name+"2";copy.volume=0;state.channels.splice(i+1,0,copy);fillParams();renderProductCenter();$("saveStatus").textContent=`已复制“${state.channels[i].name}”，可为同一渠道配置另一售卖品后比较。`});
    if(typeof renderProductCenter==="function")renderProductCenter();
  };
  readParams=function(){
    const channels=[];[...$("paramRows").rows].forEach(r=>{const c={...state.channels[Number(r.dataset.i)]};r.querySelectorAll("input,select").forEach(x=>{const k=x.dataset.k;if(!k)return;c[k]=(k==="name"||k==="product")?x.value.trim():(x.value.trim()===""?NaN:Number(x.value))});channels.push(normalize(c))});state.channels=channels;state.settings.defaultSeason=$("pDefaultSeason").value||state.settings.defaultSeason;return state;
  };
  uploadParams=async function(file){if(!file)return;try{captureStaffDraft();const rows=parseCsv((await file.text()).replace(/^\ufeff/,""));if(rows.length<2)throw Error("文件中没有渠道数据");const head=rows[0],idx=Object.fromEntries(head.map((h,i)=>[h.trim(),i]));if(idx["渠道"]==null)throw Error("缺少“渠道”列");const fieldByHeader=Object.fromEntries(PARAM_HEADERS.slice(1).map((h,i)=>[h,PARAM_FIELDS[i]]));const channels=rows.slice(1).filter(r=>r[idx["渠道"]]?.trim()).map(r=>{const c={name:r[idx["渠道"]].trim()};Object.entries(fieldByHeader).forEach(([h,k])=>{if(idx[h]==null)throw Error(`缺少“${h}”列`);const raw=r[idx[h]]?.trim();if(k==="product"){const id=state.products.find(p=>p.id===raw||p.label===raw)?.id;if(!id)throw Error(`${c.name} 的“默认售卖品”不存在：${raw}`);c[k]=id}else{const v=raw===""?NaN:Number(raw);if(!Number.isFinite(v))throw Error(`${c.name} 的“${h}”不是有效数字`);c[k]=v}});return normalize(c)});if(!channels.length)throw Error("没有可导入的渠道");const candidate=normalizeState(state);candidate.channels=channels;const check=BeiaValidation.validateConfig(candidate);if(check.errors.length)throw Error(check.errors.join("；"));state=candidate;activeTemplateName="导入参数模版";persistWorking();fillParams();fillPersonalTemplates();$("saveStatus").textContent=`已导入 ${channels.length} 个渠道及逐渠道售卖品，当前为可编辑副本；请命名保存。`}catch(e){$("saveStatus").textContent=`导入失败：${e.message}`}finally{$("paramFile").value=""}};

  rowHtml=function(c,i,values={}){c=normalize(c);const product=values.product||c.product||activeConfig().settings.defaultSeason,rates=productRates(activeConfig(),product),margin=Number.isFinite(Number(values.margin))?Number(values.margin):rates.margin,refund=Number.isFinite(Number(values.refund))?Number(values.refund):rates.refund;return`<tr data-i="${i}"><td class="sticky-col"><span class="channel-name">${esc(c.name)}</span></td><td><select class="edit product">${productOptions(activeConfig(),product)}</select></td><td><input class="edit vol" type="number" value="${values.vol??c.volume}"></td><td><input class="edit take" type="number" value="${values.take??c.volume}"></td><td class="reduce"></td><td class="share"></td><td><input class="locked baseEff" value="${c.baseEff}" readonly></td><td><input class="locked baseOut" value="${c.baseOutput}" readonly></td><td><input class="edit eff" type="number" value="${values.eff??c.baseEff}"></td><td class="param-divider out"></td><td class="need"></td><td class="north" title="点击查看北A与人效曲线"></td><td class="ltvIncome"></td><td class="totalCost"></td><td class="lpcCost"></td><td class="materialCost"></td><td class="humanProduction"></td><td class="gmv"></td><td class="profit"></td><td class="param-divider"><input class="edit margin" type="number" min="0" max="100" step="0.1" value="${smartParam(margin)}"></td><td><input class="edit refund" type="number" min="0" max="100" step="0.1" value="${smartParam(refund)}"></td><td><input class="locked slope" value="${c.slope}" readonly></td><td><input class="locked lead" value="${smartParam(c.lead)}" readonly></td><td><input class="locked settle" value="${smartParam(c.settle)}" readonly></td><td><input class="locked rate" value="${smartParam(c.rate)}" readonly></td></tr>`};
  captureStaffDraft=function(save=true){if($("sPeriod"))staffDraft.period=$("sPeriod").value;if($("sPeople"))staffDraft.people=Number($("sPeople").value);if($("staffRows")){[...$("staffRows").rows].forEach(r=>{const c=rowConfig(r);staffDraft.rows[c.name]={product:r.querySelector(".product").value,vol:Number(r.querySelector(".vol").value),take:Number(r.querySelector(".take").value),eff:Number(r.querySelector(".eff").value),margin:Number(r.querySelector(".margin").value),refund:Number(r.querySelector(".refund").value)}})}if(save)localStorage.setItem(PLAN_KEY,JSON.stringify(staffDraft))};
  bindRows=function(){$("staffRows").querySelectorAll(".edit:not(.product)").forEach(x=>{x.oninput=recalcStaff;x.onchange=recalcStaff});$("staffRows").querySelectorAll(".product").forEach(x=>x.onchange=()=>{const rates=productRates(activeConfig(),x.value),r=x.closest("tr");r.querySelector(".margin").value=smartParam(rates.margin);r.querySelector(".refund").value=smartParam(rates.refund);recalcStaff()});$("staffRows").querySelectorAll(".north").forEach(x=>x.onclick=()=>showNorthCurve(x.closest("tr")))};
  currentPlan=function(){return[...$("staffRows").rows].map(r=>({c:rowConfig(r),product:r.querySelector(".product").value,volume:Math.max(0,+r.querySelector(".take").value),reported:+r.querySelector(".vol").value,eff:+r.querySelector(".eff").value,margin:+r.querySelector(".margin").value,refund:+r.querySelector(".refund").value}))};
  recalcStaff=function(){
    const rows=[...$("staffRows").rows],totalTake=rows.reduce((s,r)=>s+Math.max(0,+r.querySelector(".take").value),0);let totals={volume:0,people:0,gmv:0,profit:0,ltv:0,cost:0,humanProduction:0};
    rows.forEach(r=>{const c=rowConfig(r),product=r.querySelector(".product").value,vol=+r.querySelector(".vol").value,take=Math.max(0,+r.querySelector(".take").value),eff=Math.max(1,+r.querySelector(".eff").value),margin=+r.querySelector(".margin").value,refund=+r.querySelector(".refund").value,out=Math.max(0,c.baseOutput+c.slope*(eff-c.baseEff)/10),humanProduction=eff*out,e=economics(c,eff,out,take,product,activeConfig(),{margin,refund}),nClass=e.north>=.95?"north-hi":e.north>=.85?"north-mid":"north-lo";r.querySelector(".reduce").textContent=(take-vol>0?"+":"")+fmt(take-vol);r.querySelector(".share").textContent=pct(take/Math.max(totalTake,1));r.querySelector(".out").textContent=out.toFixed(0);r.querySelector(".need").textContent=fmt(e.people);r.querySelector(".north").innerHTML=`<span class="${nClass}">${e.north.toFixed(3)}</span>`;r.querySelector(".humanProduction").textContent=money(humanProduction);r.querySelector(".gmv").textContent=money(e.gmv);r.querySelector(".profit").textContent=money(e.profit);r.querySelector(".lpcCost").textContent=money(e.lpc);r.querySelector(".materialCost").textContent=money(c.material);r.querySelector(".totalCost").textContent=money(e.total);r.querySelector(".ltvIncome").textContent=money(e.ltv);totals.volume+=take;totals.people+=e.people;totals.gmv+=e.gmv;totals.profit+=e.profit;totals.ltv+=e.ltv*take;totals.cost+=e.total*take});
    totals.humanProduction=totals.people?totals.gmv/totals.people:0;const available=+$("sPeople").value,gap=available-totals.people,north=totals.cost?totals.ltv/totals.cost:0,northClass=north>=.95?"good":north<.85?"bad":"",staffGapText=gap>=0?`剩余人力 ${fmt(gap)} 人`:`人力缺口 ${fmt(Math.abs(gap))} 人`;
    $("staffTotals").innerHTML=[["总承接量",fmt(totals.volume),""],["需求人力",fmt(totals.people),""],["人力状态",staffGapText,gap>=0?"good":"bad"],["整体北A",north.toFixed(3),northClass],["综合人产",money(totals.humanProduction),""],["总GMV",money(totals.gmv),""],["北A利润",money(totals.profit),totals.profit>=0?"good":"bad"]].map(x=>`<div class="kpi ${x[2]}"><span>${x[0]}</span><b>${x[1]}</b></div>`).join("");
    renderPlans(totals,available,north);lastStaffTotals=Object.assign({period:$("sPeriod").value,peopleCapacity:+$("sPeople").value||0,gap},totals);captureStaffDraft();
  };
  planTotals=function(rows){let z={volume:0,people:0,gmv:0,profit:0,ltv:0,cost:0};rows.forEach(x=>{const out=Math.max(0,x.c.baseOutput+x.c.slope*(x.eff-x.c.baseEff)/10),e=economics(x.c,x.eff,out,x.volume,x.product,activeConfig(),{margin:x.margin,refund:x.refund});z.volume+=x.volume;z.people+=e.people;z.gmv+=e.gmv;z.profit+=e.profit;z.ltv+=e.ltv*x.volume;z.cost+=e.total*x.volume});z.north=z.cost?z.ltv/z.cost:0;return z};
  showNorthCurve=function(r){const c=rowConfig(r),product=r.querySelector(".product").value,overrides={margin:+r.querySelector(".margin").value,refund:+r.querySelector(".refund").value},currentEff=Math.max(1,+r.querySelector(".eff").value),points=[];for(let eff=20;eff<=200;eff+=5){const output=c.baseOutput+c.slope*(eff-c.baseEff)/10;if(output<=0)continue;points.push({eff,output,north:economics(c,eff,output,1,product,activeConfig(),overrides).north})}if(!points.length)return;const best=points.reduce((a,b)=>b.north>a.north?b:a),currentOutput=Math.max(0,c.baseOutput+c.slope*(currentEff-c.baseEff)/10),current=economics(c,currentEff,currentOutput,1,product,activeConfig(),overrides),label=activeConfig().products.find(p=>p.id===product)?.label||product;$("curveTitle").textContent=`${c.name}｜北A与人效曲线`;$("curveNote").textContent=`售卖品：${label}；本期毛利率${smartParam(overrides.margin)}%，退费系数${smartParam(overrides.refund)}%。`;$("curveSummary").innerHTML=[["当前人效",currentEff.toFixed(0)],["当前北A",current.north.toFixed(3)],["最佳人效",best.eff.toFixed(0)],["峰值北A",best.north.toFixed(3)]].map(x=>`<div><span>${x[0]}</span><b>${x[1]}</b></div>`).join("");$("northModal").classList.add("on");drawNorthCurve(points,best,currentEff);requestAnimationFrame(()=>drawNorthCurve(points,best,currentEff))};

  const previousValidatePlan=validatePlan;
  validatePlan=function(){const errors=previousValidatePlan();[...$("staffRows").rows].forEach(r=>{const id=r.querySelector(".product")?.value;if(!activeConfig().products.some(p=>p.id===id))errors.push(rowConfig(r).name+"：请选择有效售卖品");[["margin","毛利率"],["refund","退费系数"]].forEach(([k,label])=>{const v=Number(r.querySelector("."+k)?.value);if(!Number.isFinite(v)||v<0||v>100)errors.push(rowConfig(r).name+"："+label+"须为0—100%")})});return[...new Set(errors)]};
  checkedSnapshot=function(v){
    if(!v||!v.id||!v.name||!v.draft||!Array.isArray(v.rows)||v.formulaVersion!==BeiaValidation.formulaVersion)throw Error("版本格式或公式版本不兼容");
    const check=BeiaValidation.validateConfig(v.config);if(check.errors.length)throw Error(check.errors[0]);const seen=new Set(),totals={volume:0,people:0,gmv:0,profit:0,ltv:0,cost:0};
    for(const row of v.rows){const c=v.config.channels.find(x=>x.name===row.c?.name),draft=v.draft.rows[row.c?.name];if(!c||seen.has(c.name)||!draft||!v.config.products.some(p=>p.id===row.product))throw Error("方案渠道或售卖品无效");seen.add(c.name);if(row.product!==draft.product||row.volume!==draft.take||row.reported!==draft.vol||row.eff!==draft.eff||row.margin!==draft.margin||row.refund!==draft.refund||PARAM_FIELDS.some(k=>row.c[k]!==c[k]))throw Error("方案行与参数快照不一致");const out=Math.max(0,c.baseOutput+c.slope*(row.eff-c.baseEff)/10),e=economics(c,row.eff,out,row.volume,row.product,v.config,{margin:row.margin,refund:row.refund});totals.volume+=row.volume;totals.people+=e.people;totals.gmv+=e.gmv;totals.profit+=e.profit;totals.ltv+=e.ltv*row.volume;totals.cost+=e.total*row.volume}
    totals.north=totals.cost?totals.ltv/totals.cost:0;if(!v.totals||Object.keys(totals).some(k=>!Number.isFinite(v.totals[k])||Math.abs(v.totals[k]-totals[k])>1e-6*Math.max(1,Math.abs(totals[k]))))throw Error("历史结果与公式重算不一致，请核对备份");return v;
  };
  const previousRenderVersions=renderVersions;
  renderVersions=function(){previousRenderVersions();const all=versions(),rows=[...document.querySelectorAll("#versionList tbody tr")];rows.forEach((tr,i)=>{const v=all[i],cell=tr.children[2];if(!v||!cell)return;const labels=[...new Set(v.rows.map(r=>v.config.products.find(p=>p.id===r.product)?.label||r.product).filter(Boolean))];cell.textContent=v.draft.period+" / "+(labels.length===1?labels[0]:labels.length+"种售卖品")})};
  downloadPlan=function(){const head=["渠道","售卖品","渠道报量","承接量","量级调减","承接占比","基准人效","基准例产","方案人效","预计例产","需求人力","北A","LTV收入/例","单例总成本","LPC成本/例","实物成本/例","人产","GMV","北A利润","本期税后毛利率%","本期退费系数%","斜率/+10","拉新收入","结算成本","排班率"],lines=[head.map(csvCell).join(",")];[...$("staffRows").rows].forEach(r=>{const v=[rowConfig(r).name,r.querySelector(".product").selectedOptions[0]?.textContent||r.querySelector(".product").value,r.querySelector(".vol").value,r.querySelector(".take").value,r.querySelector(".reduce").textContent,r.querySelector(".share").textContent,r.querySelector(".baseEff").value,r.querySelector(".baseOut").value,r.querySelector(".eff").value,r.querySelector(".out").textContent,r.querySelector(".need").textContent,r.querySelector(".north").textContent,r.querySelector(".ltvIncome").textContent,r.querySelector(".totalCost").textContent,r.querySelector(".lpcCost").textContent,r.querySelector(".materialCost").textContent,r.querySelector(".humanProduction").textContent,r.querySelector(".gmv").textContent,r.querySelector(".profit").textContent,r.querySelector(".margin").value,r.querySelector(".refund").value,r.querySelector(".slope").value,r.querySelector(".lead").value,r.querySelector(".settle").value,r.querySelector(".rate").value];lines.push(v.map(csvCell).join(","))});downloadBlob(`${$("sPeriod").value}_承接排班方案.csv`,"\ufeff"+lines.join("\r\n"))};

  const style=document.createElement("style");style.textContent='#paramRows select,.staff-table select.product{min-width:150px;height:34px;border:1px solid #cdd7e5;border-radius:7px;padding:5px 8px;background:#fff;color:#26364b}.staff-table select.product,.staff-table input.margin,.staff-table input.refund{background:var(--input);border-color:#e7b94a}.staff-table{min-width:2470px!important}#params .template-panel{grid-template-columns:260px minmax(0,1fr)}';document.head.appendChild(style);
  rebuildHeaders();
  state=normalizeState(state);globalState=normalizeState(globalState);if(appliedState)appliedState=normalizeState(appliedState);
  const validNames=new Set(activeConfig().channels.map(c=>c.name));
  if(Array.isArray(staffDraft.selected))staffDraft.selected=staffDraft.selected.filter(name=>validNames.has(name));
  Object.keys(staffDraft.rows||{}).forEach(name=>{if(!validNames.has(name))delete staffDraft.rows[name]});
  localStorage.setItem(PLAN_KEY,JSON.stringify(staffDraft));
  setTimeout(()=>{rebuildHeaders();init();$("downloadPlan").onclick=downloadPlan},0);
})();

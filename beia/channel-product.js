/* Channel × product linkage and grade-1 eligibility rules. */
(function(){
  const previousNormalizeChannel=normalize;
  normalize=function(c){
    const source=c||{},out=previousNormalizeChannel(source),preset=DEFAULTS.channels.find(x=>x.name===source.name);
    out.g1=Number.isFinite(Number(source.g1))?Number(source.g1):0;
    out.product=source.product||preset?.product||state?.settings?.defaultSeason||"26秋下9";
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
  const activateTemplateBase=activateTemplate;
  function syncStaffProductsFromTemplate(){
    const config=activeConfig();
    config.channels.forEach(c=>{
      const product=c.product||config.settings.defaultSeason;
      if(!config.products.some(p=>p.id===product))return;
      const rates=productRates(config,product),row=staffDraft.rows[c.name]||{};
      staffDraft.rows[c.name]={...row,product,margin:rates.margin,refund:rates.refund};
    });
    localStorage.setItem(PLAN_KEY,JSON.stringify(staffDraft));
  }
  activateTemplate=function(options={}){
    activateTemplateBase();
    if(options.syncProducts)syncStaffProductsFromTemplate();
  };
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
  const paramLabelByField=Object.fromEntries(PARAM_FIELDS.map((field,index)=>[field,PARAM_HEADERS[index+1]]));
  const displayParamFields=["product","baseEff","baseOutput","periods","g1","g2","slope","lead","settle","material","labor","rd","coupling","rate","refund","margin","overlap","active","idle"];
  const stableParamFields=new Set(["refund","margin","overlap","active","idle"]);
  const reviewParamFields=new Set(displayParamFields.filter(field=>!stableParamFields.has(field)));
  function customizeStaffMethodSection(){
    const plans=$("plans"),compareCard=plans?.closest(".card");
    if(compareCard){
      plans.remove();plans.className="";plans.hidden=true;plans.style.display="none";$("staff").appendChild(plans);compareCard.remove();
    }
    const methodCard=[...document.querySelectorAll("#staff>.card")].find(card=>card.querySelector("h2")?.textContent.trim()==="计算逻辑与口径");
    if(!methodCard)return;
    methodCard.querySelector("h2").textContent="计算逻辑与核心指标";
    methodCard.querySelector(".lead").textContent="先把承接量换算为人力与产出，再按每个渠道所选售卖品计算收入、成本和北极星A；总计按金额重新汇总，不对各渠道的比率做简单平均。";
    methodCard.querySelector(".method-overview").innerHTML='<strong>计算顺序</strong><span class="method-step">承接配置</span><span class="method-arrow">→</span><span class="method-step">产能推演</span><span class="method-arrow">→</span><span class="method-step">收入核算</span><span class="method-arrow">→</span><span class="method-step">成本核算</span><span class="method-arrow">→</span><span class="method-step">北A与利润</span>';
    methodCard.querySelector(".formula-grid").innerHTML=`
      <article class="formula-card result"><h3><span class="formula-index">1</span>承接配置与产能</h3><div class="formula-list">
        <div class="formula-row"><span class="formula-name">量级调减</span><span class="formula-expression">承接量 − 渠道报量；负数表示需减少承接</span></div>
        <div class="formula-row"><span class="formula-name">承接占比</span><span class="formula-expression">单渠道承接量 ÷ 全渠道总承接量</span></div>
        <div class="formula-row"><span class="formula-name">需求人力</span><span class="formula-expression">承接量 ÷ 方案人效</span></div>
        <div class="formula-row"><span class="formula-name">预计例产</span><span class="formula-expression">max[0，基准例产＋斜率×（方案人效−基准人效）÷10]</span></div>
        <div class="formula-row"><span class="formula-name">GMV</span><span class="formula-expression">承接量 × 预计例产</span></div>
        <div class="formula-row"><span class="formula-name">人产</span><span class="formula-expression">方案人效 × 预计例产</span></div>
      </div></article>
      <article class="formula-card income"><h3><span class="formula-index">2</span>收入口径</h3><div class="formula-list">
        <div class="formula-row"><span class="formula-name">总PV转化率</span><span class="formula-expression">预计例产 ÷ 年级与耦合结构加权后的当前ASP</span></div>
        <div class="formula-row"><span class="formula-name">班课LTV收入/例</span><span class="formula-expression">加权（当前ASP＋续报ASP-A）×税后毛利率×退费系数×收入重合系数×总PV转化率</span></div>
        <div class="formula-row"><span class="formula-name">拉新收入/例</span><span class="formula-expression"><em>例子拉新收入总额 ÷ 例子量</em>；已实现收入直接计入，不再乘毛利率</span></div>
        <div class="formula-row"><span class="formula-name">LTV收入/例</span><span class="formula-expression">班课LTV收入/例 ＋ 拉新收入/例</span></div>
      </div></article>
      <article class="formula-card cost"><h3><span class="formula-index">3</span>成本口径</h3><div class="formula-list">
        <div class="formula-row"><span class="formula-name">LPC月综合成本</span><span class="formula-expression">排班LPC月成本＋未排班LPC月成本×（1÷排班率−1）</span></div>
        <div class="formula-row"><span class="formula-name">LPC成本/例</span><span class="formula-expression">LPC月综合成本 ÷ 月承接期次 ÷ 方案人效</span></div>
        <div class="formula-row"><span class="formula-name">单例总成本</span><span class="formula-expression">结算＋实物＋市场人力＋市场产研＋LPC成本/例</span></div>
      </div></article>
      <article class="formula-card scope"><h3><span class="formula-index">4</span>单渠道经营结果</h3><div class="formula-list">
        <div class="formula-row"><span class="formula-name">北极星A</span><span class="formula-expression">LTV收入/例 ÷ 单例总成本</span></div>
        <div class="formula-row"><span class="formula-name">单例子北A利润</span><span class="formula-expression">LTV收入/例−单例总成本</span></div>
        <div class="formula-row"><span class="formula-name">北A利润</span><span class="formula-expression">单例子北A利润×承接量</span></div>
        <div class="formula-row"><span class="formula-name">判断标准</span><span class="formula-expression">北A＞1为盈利，＝1为打平，＜1为亏损</span></div>
      </div></article>
      <article class="formula-card total"><h3><span class="formula-index">5</span>总计口径</h3><div class="formula-list">
        <div class="formula-row"><span class="formula-name">总需求人力</span><span class="formula-expression">Σ各渠道需求人力</span></div>
        <div class="formula-row"><span class="formula-name">综合人效</span><span class="formula-expression">总承接量 ÷ 总需求人力</span></div>
        <div class="formula-row"><span class="formula-name">总GMV</span><span class="formula-expression">Σ（承接量×预计例产）</span></div>
        <div class="formula-row"><span class="formula-name">整体北A</span><span class="formula-expression">ΣLTV收入总额 ÷ Σ成本总额；不平均各渠道北A</span></div>
        <div class="formula-row"><span class="formula-name">总计例均值</span><span class="formula-expression">Σ对应金额 ÷ 总承接量；不平均渠道单例值</span></div>
      </div></article>
      <div class="formula-footnote"><strong>口径说明：</strong>每个渠道独立选择售卖品，售卖品联动各年级ASP、续报ASP、默认毛利率和退费系数；一年级不计耦合品。毛利率与退费系数可按当期实际修改。页面按约定位数展示，底层计算保留未取整值。</div>`;
  }
  function rebuildHeaders(){
    const paramHead=document.querySelector("#params .table-wrap .tbl thead tr");
    if(paramHead)paramHead.innerHTML='<th class="sticky-col">渠道</th>'+displayParamFields.map(field=>`<th class="${reviewParamFields.has(field)?"review-param":"stable-param"}">${esc(paramLabelByField[field])}</th>`).join("")+'<th>操作</th>';
    const staffHead=document.querySelector("#staff .staff-table thead");
    if(staffHead)staffHead.innerHTML='<tr class="group-row"><th class="sticky-col" rowspan="2">渠道</th><th rowspan="2">售卖品</th><th colspan="7">承接安排</th><th colspan="11">测算结果</th><th colspan="6">本期参数</th></tr><tr class="sub-row"><th>渠道报量</th><th>承接量</th><th>量级调减</th><th>承接占比</th><th>基准人效</th><th>基准例产</th><th>方案人效</th><th class="param-divider">预计例产</th><th>需求人力</th><th>北A</th><th>LTV收入/例</th><th>单例总成本</th><th>LPC成本/例</th><th>实物成本/例</th><th>人产</th><th>GMV</th><th>单例子北A利润</th><th>北A利润</th><th class="param-divider">毛利率%</th><th>退费系数%</th><th>斜率/+10</th><th>拉新收入</th><th>结算成本</th><th>排班率</th></tr>';
    const staffTable=document.querySelector("#staff .staff-table");
    if(staffTable&&!$("staffTotalRow")){const foot=document.createElement("tfoot");foot.id="staffTotalRow";staffTable.appendChild(foot)}
    const staffSeason=$("sSeason")?.closest(".field");if(staffSeason)staffSeason.style.display="none";
    const defaultSeason=$("pDefaultSeason")?.closest(".field");if(defaultSeason)defaultSeason.style.display="none";
    const staffLead=document.querySelector("#staff .card .lead");if(staffLead)staffLead.textContent="应用参数模版后，各渠道自动带出模版中的默认售卖品及对应毛利率、退费系数；本期如有实际值，仍可在下方直接修改后重算。";
    const productNote=document.querySelector("#productCenter>p");if(productNote)productNote.innerHTML='维护一至六年级ASP和续报ASP，并维护售卖品默认毛利率、退费系数。默认值用于初始化，本期测算仍可覆盖。<br>参数来源：<a href="https://docs.yukework.com/doc?fileId=1872221674903367682" target="_blank" rel="noopener noreferrer">各学季北极星参数表</a>';
    const reviewNote=document.querySelector("#params .actions .muted-lock");if(reviewNote){reviewNote.classList.add("param-review-note");reviewNote.textContent="测算前，需重点核对红色指标。退费系数、税后毛利、收入重合系数及两项LPC月成本为相邻期次相对稳定项，仍需确认当期是否调整。"}
    customizeStaffMethodSection();
  }

  fillParams=function(){
    renderProductSelects();const locked=isDefaultTemplate();$("pDefaultSeason").value=state.settings.defaultSeason;$("params").classList.toggle("locked-default",locked);
    const numberFields=displayParamFields.filter(k=>k!=="product");
    $("paramRows").innerHTML=state.channels.map((raw,i)=>{const c=normalize(raw),ro=locked?" readonly":"",disabled=locked?" disabled":"";return`<tr data-i="${i}"><td class="sticky-col"><input data-k="name" value="${esc(c.name)}" style="width:118px;text-align:left"${ro}></td><td class="review-param"><select data-k="product"${disabled}>${productOptions(state,c.product)}</select></td>${numberFields.map(k=>`<td class="${reviewParamFields.has(k)?"review-param":"stable-param"}"><input data-k="${k}" type="number" step="${oneDecimalFields.has(k)?"0.1":"any"}" value="${displayParam(k,c[k])}"${ro}></td>`).join("")}<td><div style="display:flex;gap:5px"><button class="btn pcopy" type="button"${locked?" disabled":""}>复制</button><button class="btn pdel danger" type="button"${locked?" disabled":""}>删除</button></div></td></tr>`}).join("");
    $("addParam").disabled=locked;$("savePersonal").disabled=locked;$("deletePersonal").disabled=locked||!personalTemplates()[activeTemplateName];$("applyParams").disabled=false;
    $("paramRows").querySelectorAll(".pdel").forEach(b=>b.onclick=()=>{if(isDefaultTemplate())return;captureStaffDraft();readParams();const i=+b.closest("tr").dataset.i,name=state.channels[i]?.name;state.channels.splice(i,1);persistWorking();fillParams();renderProductCenter();$("saveStatus").textContent=`渠道“${name}”已从编辑中的模版删除，应用后生效。`});
    $("paramRows").querySelectorAll(".pcopy").forEach(b=>b.onclick=()=>{if(isDefaultTemplate())return;readParams();const i=+b.closest("tr").dataset.i,copy=structuredClone(state.channels[i]);copy.name=copy.name+"2";copy.volume=0;state.channels.splice(i+1,0,copy);fillParams();renderProductCenter();$("saveStatus").textContent=`已复制“${state.channels[i].name}”，可为同一渠道配置另一售卖品后比较。`});
    $("paramRows").querySelectorAll('select[data-k="product"]').forEach(select=>select.onchange=()=>{if(isDefaultTemplate())return;const row=select.closest("tr"),rates=productRates(state,select.value);row.querySelector('input[data-k="margin"]').value=smartParam(rates.margin);row.querySelector('input[data-k="refund"]').value=smartParam(rates.refund);$("saveStatus").textContent="已按售卖品参数中心同步默认税后毛利率和退费系数，仍可按当期实际修改。"});
    if(typeof renderProductCenter==="function")renderProductCenter();
  };
  readParams=function(){
    const channels=[];[...$("paramRows").rows].forEach(r=>{const c={...state.channels[Number(r.dataset.i)]};r.querySelectorAll("input,select").forEach(x=>{const k=x.dataset.k;if(!k)return;c[k]=(k==="name"||k==="product")?x.value.trim():(x.value.trim()===""?NaN:Number(x.value))});channels.push(normalize(c))});state.channels=channels;state.settings.defaultSeason=$("pDefaultSeason").value||state.settings.defaultSeason;return state;
  };
  uploadParams=async function(file){if(!file)return;try{captureStaffDraft();const rows=parseCsv((await file.text()).replace(/^\ufeff/,""));if(rows.length<2)throw Error("文件中没有渠道数据");const head=rows[0],idx=Object.fromEntries(head.map((h,i)=>[h.trim(),i]));if(idx["渠道"]==null)throw Error("缺少“渠道”列");const fieldByHeader=Object.fromEntries(PARAM_HEADERS.slice(1).map((h,i)=>[h,PARAM_FIELDS[i]]));const channels=rows.slice(1).filter(r=>r[idx["渠道"]]?.trim()).map(r=>{const c={name:r[idx["渠道"]].trim()};Object.entries(fieldByHeader).forEach(([h,k])=>{if(idx[h]==null)throw Error(`缺少“${h}”列`);const raw=r[idx[h]]?.trim();if(k==="product"){const id=state.products.find(p=>p.id===raw||p.label===raw)?.id;if(!id)throw Error(`${c.name} 的“默认售卖品”不存在：${raw}`);c[k]=id}else{const v=raw===""?NaN:Number(raw);if(!Number.isFinite(v))throw Error(`${c.name} 的“${h}”不是有效数字`);c[k]=v}});return normalize(c)});if(!channels.length)throw Error("没有可导入的渠道");const candidate=normalizeState(state);candidate.channels=channels;const check=BeiaValidation.validateConfig(candidate);if(check.errors.length)throw Error(check.errors.join("；"));state=candidate;activeTemplateName="导入参数模版";persistWorking();fillParams();fillPersonalTemplates();$("saveStatus").textContent=`已导入 ${channels.length} 个渠道及逐渠道售卖品，当前为可编辑副本；请命名保存。`}catch(e){$("saveStatus").textContent=`导入失败：${e.message}`}finally{$("paramFile").value=""}};
  downloadParamTemplate=function(){readParams();const lines=[["渠道",...displayParamFields.map(field=>paramLabelByField[field])].map(csvCell).join(",")];state.channels.forEach(c=>lines.push([c.name,...displayParamFields.map(field=>c[field])].map(csvCell).join(",")));downloadBlob("北A经营决策系统_渠道参数模板.csv","\ufeff"+lines.join("\r\n"))};

  rowHtml=function(c,i,values={}){c=normalize(c);const product=values.product||c.product||activeConfig().settings.defaultSeason,rates=productRates(activeConfig(),product),margin=Number.isFinite(Number(values.margin))?Number(values.margin):rates.margin,refund=Number.isFinite(Number(values.refund))?Number(values.refund):rates.refund;return`<tr data-i="${i}"><td class="sticky-col"><span class="channel-name">${esc(c.name)}</span></td><td><select class="edit product">${productOptions(activeConfig(),product)}</select></td><td><input class="edit vol" type="number" value="${values.vol??c.volume}"></td><td><input class="edit take" type="number" value="${values.take??c.volume}"></td><td class="reduce"></td><td class="share"></td><td><input class="locked baseEff" value="${c.baseEff}" readonly></td><td><input class="locked baseOut" value="${c.baseOutput}" readonly></td><td><input class="edit eff" type="number" value="${values.eff??c.baseEff}"></td><td class="param-divider out"></td><td class="need"></td><td class="north" title="点击查看北A与人效曲线"></td><td class="ltvIncome"></td><td class="totalCost"></td><td class="lpcCost"></td><td class="materialCost"></td><td class="humanProduction"></td><td class="gmv"></td><td class="profitPer"></td><td class="profit"></td><td class="param-divider"><input class="edit margin" type="number" min="0" max="100" step="0.1" value="${smartParam(margin)}"></td><td><input class="edit refund" type="number" min="0" max="100" step="0.1" value="${smartParam(refund)}"></td><td><input class="locked slope" value="${c.slope}" readonly></td><td><input class="locked lead" value="${smartParam(c.lead)}" readonly></td><td><input class="locked settle" value="${smartParam(c.settle)}" readonly></td><td><input class="locked rate" value="${smartParam(c.rate)}" readonly></td></tr>`};
  captureStaffDraft=function(save=true){if($("sPeriod"))staffDraft.period=$("sPeriod").value;if($("sPeople"))staffDraft.people=Number($("sPeople").value);if($("staffRows")){[...$("staffRows").rows].forEach(r=>{const c=rowConfig(r);staffDraft.rows[c.name]={product:r.querySelector(".product").value,vol:Number(r.querySelector(".vol").value),take:Number(r.querySelector(".take").value),eff:Number(r.querySelector(".eff").value),margin:Number(r.querySelector(".margin").value),refund:Number(r.querySelector(".refund").value)}})}if(save)localStorage.setItem(PLAN_KEY,JSON.stringify(staffDraft))};
  bindRows=function(){$("staffRows").querySelectorAll(".edit:not(.product)").forEach(x=>{x.oninput=recalcStaff;x.onchange=recalcStaff});$("staffRows").querySelectorAll(".product").forEach(x=>x.onchange=()=>{const rates=productRates(activeConfig(),x.value),r=x.closest("tr");r.querySelector(".margin").value=smartParam(rates.margin);r.querySelector(".refund").value=smartParam(rates.refund);recalcStaff()});$("staffRows").querySelectorAll(".north").forEach(x=>x.onclick=()=>showNorthCurve(x.closest("tr")))};
  currentPlan=function(){return[...$("staffRows").rows].map(r=>({c:rowConfig(r),product:r.querySelector(".product").value,volume:Math.max(0,+r.querySelector(".take").value),reported:+r.querySelector(".vol").value,eff:+r.querySelector(".eff").value,margin:+r.querySelector(".margin").value,refund:+r.querySelector(".refund").value}))};
  function staffSummary(rows){
    const z={reported:0,volume:0,people:0,basePeople:0,baseGmv:0,gmv:0,profit:0,ltv:0,cost:0,lpc:0,material:0,margin:0,refund:0,slope:0,lead:0,settle:0,rate:0,products:new Set()};
    rows.forEach(r=>{
      const c=rowConfig(r),product=r.querySelector(".product").value,reported=Math.max(0,+r.querySelector(".vol").value),volume=Math.max(0,+r.querySelector(".take").value),eff=Math.max(1,+r.querySelector(".eff").value),margin=+r.querySelector(".margin").value,refund=+r.querySelector(".refund").value,output=Math.max(0,c.baseOutput+c.slope*(eff-c.baseEff)/10),e=economics(c,eff,output,volume,product,activeConfig(),{margin,refund});
      z.reported+=reported;z.volume+=volume;z.people+=e.people;z.basePeople+=volume/Math.max(c.baseEff,1);z.baseGmv+=c.baseOutput*volume;z.gmv+=e.gmv;z.profit+=e.profit;z.ltv+=e.ltv*volume;z.cost+=e.total*volume;z.lpc+=e.lpc*volume;z.material+=c.material*volume;z.margin+=margin*volume;z.refund+=refund*volume;z.slope+=c.slope*volume;z.lead+=c.lead*volume;z.settle+=c.settle*volume;z.rate+=c.rate*volume;z.products.add(product);
    });
    const perVolume=key=>z.volume?z[key]/z.volume:0;
    z.baseEff=z.basePeople?z.volume/z.basePeople:0;z.baseOutput=perVolume("baseGmv");z.eff=z.people?z.volume/z.people:0;z.output=perVolume("gmv");z.north=z.cost?z.ltv/z.cost:0;z.ltvPer=perVolume("ltv");z.costPer=perVolume("cost");z.lpcPer=perVolume("lpc");z.materialPer=perVolume("material");z.profitPer=perVolume("profit");z.humanProduction=z.people?z.gmv/z.people:0;z.marginPer=perVolume("margin");z.refundPer=perVolume("refund");z.slopePer=perVolume("slope");z.leadPer=perVolume("lead");z.settlePer=perVolume("settle");z.ratePer=perVolume("rate");return z;
  }
  function renderStaffTotal(z){
    const foot=$("staffTotalRow");if(!foot)return;
    if(!z.volume){foot.innerHTML='<tr class="staff-total-row"><td class="sticky-col">总计</td><td colspan="25">暂无可汇总的承接量</td></tr>';return}
    const productLabel=z.products.size===1?(activeConfig().products.find(p=>p.id===[...z.products][0])?.label||[...z.products][0]):`${z.products.size}种售卖品`,northClass=z.north>=.95?"north-hi":z.north>=.85?"north-mid":"north-lo";
    const cells=[
      '<td class="sticky-col"><strong>总计</strong></td>',`<td>${esc(productLabel)}</td>`,`<td>${fmt(z.reported)}</td>`,`<td>${fmt(z.volume)}</td>`,`<td>${z.volume-z.reported>0?"+":""}${fmt(z.volume-z.reported)}</td>`,'<td>100.0%</td>',`<td>${fmt(z.baseEff)}</td>`,`<td>${fmt(z.baseOutput)}</td>`,`<td>${fmt(z.eff)}</td>`,`<td class="param-divider">${fmt(z.output)}</td>`,`<td>${fmt(z.people)}</td>`,`<td><span class="${northClass}">${z.north.toFixed(3)}</span></td>`,`<td>${money(z.ltvPer)}</td>`,`<td>${money(z.costPer)}</td>`,`<td>${money(z.lpcPer)}</td>`,`<td>${money(z.materialPer)}</td>`,`<td>${money(z.humanProduction)}</td>`,`<td>${money(z.gmv)}</td>`,`<td>${money(z.profitPer)}</td>`,`<td>${money(z.profit)}</td>`,`<td class="param-divider">${smartParam(z.marginPer)}</td>`,`<td>${smartParam(z.refundPer)}</td>`,`<td>${smartParam(z.slopePer)}</td>`,`<td>${money(z.leadPer)}</td>`,`<td>${money(z.settlePer)}</td>`,`<td>${smartParam(z.ratePer)}</td>`
    ];
    foot.innerHTML=`<tr class="staff-total-row">${cells.join("")}</tr>`;
  }
  recalcStaff=function(){
    const rows=[...$("staffRows").rows],totalTake=rows.reduce((s,r)=>s+Math.max(0,+r.querySelector(".take").value),0);
    rows.forEach(r=>{const c=rowConfig(r),product=r.querySelector(".product").value,vol=+r.querySelector(".vol").value,take=Math.max(0,+r.querySelector(".take").value),eff=Math.max(1,+r.querySelector(".eff").value),margin=+r.querySelector(".margin").value,refund=+r.querySelector(".refund").value,out=Math.max(0,c.baseOutput+c.slope*(eff-c.baseEff)/10),humanProduction=eff*out,e=economics(c,eff,out,take,product,activeConfig(),{margin,refund}),nClass=e.north>=.95?"north-hi":e.north>=.85?"north-mid":"north-lo";r.querySelector(".reduce").textContent=(take-vol>0?"+":"")+fmt(take-vol);r.querySelector(".share").textContent=pct(take/Math.max(totalTake,1));r.querySelector(".out").textContent=out.toFixed(0);r.querySelector(".need").textContent=fmt(e.people);r.querySelector(".north").innerHTML=`<span class="${nClass}">${e.north.toFixed(3)}</span>`;r.querySelector(".humanProduction").textContent=money(humanProduction);r.querySelector(".gmv").textContent=money(e.gmv);r.querySelector(".profitPer").textContent=money(e.ltv-e.total);r.querySelector(".profit").textContent=money(e.profit);r.querySelector(".lpcCost").textContent=money(e.lpc);r.querySelector(".materialCost").textContent=money(c.material);r.querySelector(".totalCost").textContent=money(e.total);r.querySelector(".ltvIncome").textContent=money(e.ltv)});
    const totals=staffSummary(rows),available=+$("sPeople").value,gap=available-totals.people,north=totals.north,northClass=north>=.95?"good":north<.85?"bad":"",staffGapText=gap>=0?`剩余人力 ${fmt(gap)} 人`:`人力缺口 ${fmt(Math.abs(gap))} 人`;
    $("staffTotals").innerHTML=[["总承接量",fmt(totals.volume),""],["需求人力",fmt(totals.people),""],["人力状态",staffGapText,gap>=0?"good":"bad"],["整体北A",north.toFixed(3),northClass],["综合人产",money(totals.humanProduction),""],["总GMV",money(totals.gmv),""],["北A利润",money(totals.profit),totals.profit>=0?"good":"bad"]].map(x=>`<div class="kpi ${x[2]}"><span>${x[0]}</span><b>${x[1]}</b></div>`).join("");
    renderStaffTotal(totals);
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
  downloadPlan=function(){
    const head=["渠道","售卖品","渠道报量","承接量","量级调减","承接占比","基准人效","基准例产","方案人效","预计例产","需求人力","北A","LTV收入/例","单例总成本","LPC成本/例","实物成本/例","人产","GMV","单例子北A利润","北A利润","本期税后毛利率%","本期退费系数%","斜率/+10","拉新收入","结算成本","排班率"],rows=[...$("staffRows").rows],lines=[head.map(csvCell).join(",")];
    rows.forEach(r=>{const v=[rowConfig(r).name,r.querySelector(".product").selectedOptions[0]?.textContent||r.querySelector(".product").value,r.querySelector(".vol").value,r.querySelector(".take").value,r.querySelector(".reduce").textContent,r.querySelector(".share").textContent,r.querySelector(".baseEff").value,r.querySelector(".baseOut").value,r.querySelector(".eff").value,r.querySelector(".out").textContent,r.querySelector(".need").textContent,r.querySelector(".north").textContent,r.querySelector(".ltvIncome").textContent,r.querySelector(".totalCost").textContent,r.querySelector(".lpcCost").textContent,r.querySelector(".materialCost").textContent,r.querySelector(".humanProduction").textContent,r.querySelector(".gmv").textContent,r.querySelector(".profitPer").textContent,r.querySelector(".profit").textContent,r.querySelector(".margin").value,r.querySelector(".refund").value,r.querySelector(".slope").value,r.querySelector(".lead").value,r.querySelector(".settle").value,r.querySelector(".rate").value];lines.push(v.map(csvCell).join(","))});
    const z=staffSummary(rows),productLabel=z.products.size===1?(activeConfig().products.find(p=>p.id===[...z.products][0])?.label||[...z.products][0]):`${z.products.size}种售卖品`,total=["总计",productLabel,Math.round(z.reported),Math.round(z.volume),Math.round(z.volume-z.reported),z.volume?"100.0%":"0.0%",Math.round(z.baseEff),Math.round(z.baseOutput),Math.round(z.eff),Math.round(z.output),Math.round(z.people),z.north.toFixed(3),money(z.ltvPer),money(z.costPer),money(z.lpcPer),money(z.materialPer),money(z.humanProduction),money(z.gmv),money(z.profitPer),money(z.profit),smartParam(z.marginPer),smartParam(z.refundPer),smartParam(z.slopePer),money(z.leadPer),money(z.settlePer),smartParam(z.ratePer)];
    lines.push(total.map(csvCell).join(","));downloadBlob(`${$("sPeriod").value}_承接排班方案.csv`,"\ufeff"+lines.join("\r\n"));
  };

  const style=document.createElement("style");style.textContent='#paramRows select,.staff-table select.product{min-width:150px;height:34px;border:1px solid #cdd7e5;border-radius:7px;padding:5px 8px;background:#fff;color:#26364b}.staff-table select.product,.staff-table input.margin,.staff-table input.refund{background:var(--input);border-color:#e7b94a}.staff-table{min-width:2470px!important}#params .template-panel{grid-template-columns:260px minmax(0,1fr)}#params th.review-param{color:#b52f35}.param-review-note{color:#b52f35!important;font-weight:750}#plans[hidden]{display:none!important}.staff-table tfoot td{padding:12px 9px;border-top:2px solid #aebed5;background:#edf3fb;color:#203552;font-weight:800;text-align:right;white-space:nowrap}.staff-table tfoot .sticky-col{position:sticky;left:0;z-index:4;text-align:left;background:#e5eefb}.formula-card.total{border-top:3px solid #2c879a}.formula-card.total .formula-index{background:#e4f5f7;color:#17677a}';document.head.appendChild(style);
  const profitStyle=document.createElement("style");profitStyle.textContent='.staff-table{min-width:2590px!important}';document.head.appendChild(profitStyle);
  rebuildHeaders();
  Promise.resolve(globalThis.beiaLoadPromise).then(()=>{
    state=normalizeState(state);globalState=normalizeState(globalState);if(appliedState)appliedState=normalizeState(appliedState);
    const validNames=new Set(activeConfig().channels.map(c=>c.name));
    if(Array.isArray(staffDraft.selected))staffDraft.selected=staffDraft.selected.filter(name=>validNames.has(name));
    Object.keys(staffDraft.rows||{}).forEach(name=>{if(!validNames.has(name))delete staffDraft.rows[name]});
    localStorage.setItem(PLAN_KEY,JSON.stringify(staffDraft));
    rebuildHeaders();init();$("downloadPlan").onclick=downloadPlan;$("downloadParamTemplate").onclick=downloadParamTemplate;
  });
})();

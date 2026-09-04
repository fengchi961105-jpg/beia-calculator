/* Version snapshots and product maintenance extend, rather than replace, the three existing pages. */
const VERSION_KEY="beia_plan_versions_v1";
const productFields=[["asp","学科ASP"],["rA","续报ASP-A"],["rB","续报ASP-B"],["cASP","耦合ASP"],["crA","耦合续报A"],["crB","耦合续报B"]];
const originalNormalize=normalizeState;
normalizeState=function(s){
  const result=originalNormalize(s);
  if(!Array.isArray(result.products))result.products=Object.entries(BEIA_PRODUCT_DEFAULTS).map(([id,rows])=>({id,label:PRODUCT_OPTIONS.find(p=>p.value===id)?.label||id,rows:structuredClone(rows)}));
  return result;
};
function updateCatalog(){
  state=normalizeState(state);
  PRODUCT_OPTIONS.splice(0,PRODUCT_OPTIONS.length,...state.products.map(p=>({value:p.id,label:p.label})));
  Object.keys(PRODUCTS).forEach(k=>delete PRODUCTS[k]);Object.keys(PRODUCT_KEYS).forEach(k=>delete PRODUCT_KEYS[k]);
  state.products.forEach(p=>{
    PRODUCT_KEYS[p.id]=p.id;PRODUCT_KEYS[p.label]=p.id;
    PRODUCTS[p.id]=p.rows.slice(1).map(r=>[r.asp,r.rA,r.cASP??r.asp,r.crA??r.rA]);
  });
}
const originalRenderSelects=renderProductSelects;
renderProductSelects=function(){updateCatalog();originalRenderSelects()};
syncCalculator=function(){
  $("calculatorFrame")?.contentWindow?.postMessage({type:"BEIA_SHARED_CONFIG",channels:activeConfig().channels,products:activeConfig().products,defaultSeason:activeConfig().settings.defaultSeason},"*");
  setTimeout(resizeCalculator,120);
};
const style=document.createElement("style");
style.textContent=".workbench{margin-top:24px;padding:24px;border:1px solid #dbe3ef;border-radius:14px;background:#fff}.workbench h3{font-size:18px;margin:0 0 10px}.workbench p{color:#64748b;font-size:12px;line-height:1.7}.wb-toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:16px 0}.wb-toolbar input,.wb-toolbar select{min-width:180px;padding:10px;border:1px solid #ccd8e8;border-radius:7px}.wb-scroll{overflow:auto;border:1px solid #e1e8f1;border-radius:10px}.workbench table{width:100%;border-collapse:collapse;min-width:800px}.workbench th,.workbench td{padding:13px 12px;border-bottom:1px solid #e8edf4;text-align:left;white-space:nowrap;font-size:12px}.workbench th{background:#eef3fa;color:#354965}.workbench td input[type=number]{width:106px;padding:8px;border:1px solid #d5dfec;border-radius:6px}.wb-note{padding:12px 16px;background:#f4f7fc;border-left:3px solid #4567df;font-size:12px;line-height:1.8;color:#40536e;margin:12px 0}.wb-error{border-color:#dc4444;background:#fff4f3;color:#9f2424}.wb-pass{border-color:#298567;background:#f0faf5}.wb-delta{display:block;font-size:11px;color:#61748b;margin-top:5px}.wb-selected{background:#f3f7ff}.wb-status{font-size:12px;color:#4c6382;min-height:20px}.workbench button:disabled{opacity:.45;cursor:not-allowed}";
document.head.appendChild(style);
const productPanel=document.createElement("div");
productPanel.className="workbench";productPanel.id="productCenter";
productPanel.innerHTML='<h3>售卖品参数中心</h3><p>维护一至六年级ASP和续报ASP；北A使用续报A，续报B保留用于参数核对。耦合字段留空时沿用学科值。退费、毛利与排班成本仍以各渠道参数为准。</p><div class="wb-toolbar"><select id="productEditor"></select><input id="productLabel" aria-label="售卖品名称"><button class="btn" id="copyProduct">复制售卖品</button><button class="btn danger" id="removeProduct">删除售卖品</button><button class="btn" id="exportProducts">下载售卖品参数</button><button class="btn" id="importProducts">导入售卖品参数</button><input type="file" id="productFile" accept=".json" hidden></div><div class="wb-scroll"><table><thead><tr><th>年级</th>'+productFields.map(x=>'<th>'+x[1]+'（元）</th>').join("")+'</tr></thead><tbody id="productRows"></tbody></table></div><div class="wb-status" id="productStatus">修改后与渠道参数一起命名保存，再应用到测算页面。</div>';
$("params").appendChild(productPanel);
const gatePanel=document.createElement("div");gatePanel.className="workbench";gatePanel.id="releaseGate";
gatePanel.innerHTML='<h3>发布前校验</h3><p>检查参数完整性、取值范围、名称重复及相对默认模版的变化。校验通过不代表预测必然实现；斜率与转化仍需要经营数据支持。</p><div class="wb-toolbar"><button class="btn" id="runValidation">检查当前参数</button><span>公式版本：'+BeiaValidation.formulaVersion+'</span></div><div id="validationResults" class="wb-note">应用、保存或发布前自动检查；有错误时禁止提交。</div>';
$("params").appendChild(gatePanel);
let selectedProduct="";
function renderProductCenter(){
  if(!state.products?.some(p=>p.id===selectedProduct))selectedProduct=state.settings.defaultSeason;
  $("productEditor").innerHTML=state.products.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.label)+'</option>').join("");
  $("productEditor").value=selectedProduct;
  const p=state.products.find(p=>p.id===selectedProduct);if(!p)return;
  const locked=isDefaultTemplate();$("productLabel").value=p.label;$("productLabel").readOnly=locked;
  $("productRows").innerHTML=p.rows.map((r,i)=>'<tr><td>'+esc(r.g)+'</td>'+productFields.map(([k])=>'<td><input type="number" step="any" min="0" data-grade="'+i+'" data-field="'+k+'" value="'+(r[k]??"")+'" '+(locked?"readonly":"")+'></td>').join("")+'</tr>').join("");
  $("copyProduct").disabled=locked;$("removeProduct").disabled=locked;
  $("productRows").querySelectorAll("input").forEach(input=>input.oninput=()=>{p.rows[+input.dataset.grade][input.dataset.field]=input.value===""?(input.dataset.field.startsWith("c")?null:NaN):Number(input.value);$("productStatus").textContent="售卖品参数已修改，尚未应用。请保存或应用当前参数模版。"});
}
const originalFillParams=fillParams;
fillParams=function(){originalFillParams();renderProductCenter()};
$("productEditor").onchange=()=>{selectedProduct=$("productEditor").value;renderProductCenter()};
$("productLabel").onchange=()=>{if(isDefaultTemplate())return;state.products.find(p=>p.id===selectedProduct).label=$("productLabel").value.trim()};
$("copyProduct").onclick=()=>{
  if(isDefaultTemplate())return;const p=structuredClone(state.products.find(p=>p.id===selectedProduct)),name=prompt("新售卖品名称",p.label+"副本");
  if(!name?.trim())return;p.id="product_"+Date.now();p.label=name.trim();state.products.push(p);selectedProduct=p.id;renderProductCenter();
};
$("removeProduct").onclick=()=>{
  if(isDefaultTemplate())return;if(selectedProduct===state.settings.defaultSeason||selectedProduct===$("sSeason").value){alert("该售卖品正在作为默认品或本期售卖品使用，请先切换后再删除。");return}
  if(!confirm("删除此售卖品？已保存的方案版本仍保留原参数。"))return;
  state.products=state.products.filter(p=>p.id!==selectedProduct);renderProductCenter();
};
$("exportProducts").onclick=()=>downloadBlob("售卖品参数模版.json",JSON.stringify({schema:1,products:state.products},null,2),"application/json");
$("importProducts").onclick=()=>$("productFile").click();
$("productFile").onchange=async e=>{
  try{const file=e.target.files[0];if(!file)return;if(file.size>2000000)throw Error("文件超过2MB");const data=JSON.parse(await file.text()),candidate=normalizeState(state);candidate.products=data.products;
    const check=BeiaValidation.validateConfig(candidate);if(check.errors.length)throw Error(check.errors.join("；"));
    state=candidate;if(isDefaultTemplate())activeTemplateName="导入参数模版";fillParams();fillPersonalTemplates();$("productStatus").textContent="已导入，尚未应用；请命名保存。";
  }catch(err){alert("导入失败："+err.message)}finally{e.target.value=""}
};
function configDifferences(){
  const changes=[];const base=normalizeState(globalState);
  state.channels.forEach(c=>{const old=base.channels.find(x=>x.name===c.name);if(!old){changes.push("新增渠道："+c.name);return}PARAM_FIELDS.forEach(k=>{if(c[k]!==old[k])changes.push(c.name+" · "+PARAM_HEADERS[PARAM_FIELDS.indexOf(k)+1]+"："+old[k]+" → "+c[k])})});
  base.channels.filter(c=>!state.channels.some(x=>x.name===c.name)).forEach(c=>changes.push("删除渠道："+c.name));
  state.products.forEach(p=>{const old=base.products.find(x=>x.id===p.id);if(!old){changes.push("新增售卖品："+p.label);return}p.rows.forEach((r,i)=>productFields.forEach(([k,label])=>{if(r[k]!==old.rows[i][k])changes.push(p.label+" "+r.g+" "+label+"："+old.rows[i][k]+" → "+r[k])}))});
  base.products.filter(p=>!state.products.some(x=>x.id===p.id)).forEach(p=>changes.push("删除售卖品："+p.label));
  if(state.settings.defaultSeason!==base.settings.defaultSeason)changes.push("默认售卖品："+base.settings.defaultSeason+" → "+state.settings.defaultSeason);
  return changes;
}
function inspectConfig(){
  if(!isDefaultTemplate())readParams();
  const check=BeiaValidation.validateConfig(state),changes=configDifferences();
  $("validationResults").className="wb-note "+(check.errors.length?"wb-error":"wb-pass");
  $("validationResults").innerHTML='<strong>'+check.errors.length+'项错误 · '+check.warnings.length+'项提醒 · '+changes.length+'项参数变化</strong>'+
    [...check.errors,...check.warnings].map(s=>'<div>'+esc(s)+'</div>').join("")+
    '<details><summary>查看相对默认模版的参数变化</summary>'+changes.map(s=>'<div>'+esc(s)+'</div>').join("")+'</details>';
  return check;
}
function gate(action){
  const check=inspectConfig();if(check.errors.length){alert("无法"+action+"："+check.errors.slice(0,6).join("；"));$("releaseGate").scrollIntoView({block:"center"});return false}
  return !check.warnings.length||confirm(action+"前请确认："+check.warnings.join("；"));
}
$("runValidation").onclick=inspectConfig;
const previousApply=applyParams,previousSavePersonal=savePersonal,previousSave=save;
applyParams=function(...args){if(gate("应用"))previousApply(...args)};
savePersonal=function(){if(gate("保存"))previousSavePersonal()};
save=async function(){if(!gate("发布"))return;const changes=configDifferences();if(!confirm("即将覆盖"+(LOCAL_PREVIEW?"本机":"共享")+"默认模版，共"+changes.length+"项参数变化。确认发布？"))return;await previousSave()};
$("applyParams").onclick=()=>applyParams();$("savePersonal").onclick=savePersonal;$("saveParams").onclick=save;

const versionsPanel=document.createElement("div");versionsPanel.className="workbench";versionsPanel.id="versionCenter";
versionsPanel.innerHTML='<h3>方案版本对比</h3><p>保存承接量、人效、售卖品和全部参数快照。历史结果不随当前参数修改；勾选2—4个版本，以最先保存的所选版本为对照。</p><div class="wb-toolbar"><input id="versionName" placeholder="例如：秋2期 · 图解增量方案" aria-label="方案版本名称"><button class="btn primary" id="saveVersion">保存当前方案版本</button><button class="btn" id="exportVersions">备份所有版本</button><button class="btn" id="importVersions">导入版本备份</button><input id="versionFile" type="file" accept=".json" hidden></div><div class="wb-status" id="versionStatus">版本保存在当前浏览器；跨电脑使用请下载备份。</div><div id="versionList" class="wb-scroll"></div><div id="versionComparison"></div>';
$("staff").appendChild(versionsPanel);
function versions(){try{const x=JSON.parse(localStorage.getItem(VERSION_KEY)||"[]");return Array.isArray(x)?x:[]}catch{return[]}}
function checkedSnapshot(v){
  if(!v||!v.id||!v.name||!v.draft||!Array.isArray(v.rows)||v.formulaVersion!==BeiaValidation.formulaVersion)throw Error("版本格式或公式版本不兼容");
  const check=BeiaValidation.validateConfig(v.config);if(check.errors.length)throw Error(check.errors[0]);
  if(!v.config.products.some(p=>p.id===v.draft.season)||!Number.isFinite(v.draft.people)||v.draft.people<0||!v.draft.rows||!v.rows.length)throw Error("期次参数无效");
  const seen=new Set();
  let totals;
  try{

    // Economics receives the snapshot product explicitly; no dependence on today's selector.
    totals={volume:0,people:0,gmv:0,profit:0,ltv:0,cost:0};
    for(const row of v.rows){
      const c=v.config.channels.find(c=>c.name===row.c?.name),draft=v.draft.rows[row.c?.name];
      if(!c||seen.has(c.name)||!draft||!Number.isFinite(row.volume)||row.volume<0||!Number.isFinite(row.reported)||row.reported<0||!Number.isFinite(row.eff)||row.eff<=0)throw Error("方案渠道或人效无效");
      seen.add(c.name);
      if(row.volume!==draft.take||row.reported!==draft.vol||row.eff!==draft.eff||PARAM_FIELDS.some(k=>row.c[k]!==c[k]))throw Error("方案行与参数快照不一致");
      const out=Math.max(0,c.baseOutput+c.slope*(row.eff-c.baseEff)/10),e=economics(c,row.eff,out,row.volume,v.draft.season,v.config);
      totals.volume+=row.volume;totals.people+=e.people;totals.gmv+=e.gmv;totals.profit+=e.profit;totals.ltv+=e.ltv*row.volume;totals.cost+=e.total*row.volume;
    }
    const selected=v.draft.selected===null?v.config.channels.filter(c=>c.planningDefault!==false).map(c=>c.name):v.draft.selected;
    if(!Array.isArray(selected)||selected.length!==seen.size||selected.some(n=>!seen.has(n)))throw Error("渠道选择与方案行不一致");
    totals.north=totals.cost?totals.ltv/totals.cost:0;
    if(!v.totals||Object.keys(totals).some(k=>!Number.isFinite(v.totals[k])||Math.abs(v.totals[k]-totals[k])>1e-6*Math.max(1,Math.abs(totals[k]))))throw Error("历史结果与公式重算不一致，请核对备份");
    return v;
  }finally{/* Snapshot checks do not change the applied or edited template. */}
}
let compared=new Set();
function storeVersions(v){localStorage.setItem(VERSION_KEY,JSON.stringify(v));renderVersions()}
function validatePlan(){
  const errors=BeiaValidation.validateConfig(activeConfig()).errors.slice();
  if(!$("sPeriod").value.trim())errors.push("请填写期次");
  if(!Number.isFinite(+$("sPeople").value)||+$("sPeople").value<0||$("sPeople").value==="")errors.push("可用人力须为非负数");
  if(!$("staffRows").rows.length)errors.push("请至少选择一个渠道");
  [...$("staffRows").rows].forEach(r=>["vol","take","eff"].forEach(k=>{const s=r.querySelector("."+k).value,n=Number(s);if(!s||!Number.isFinite(n)||n<(k==="eff"?.01:0))errors.push(rowConfig(r).name+"："+k+"无效")}));
  if(!activeConfig().products.some(p=>p.id===$("sSeason").value))errors.push("本期售卖品不存在");
  return errors;
}
function saveVersion(){
  const errors=validatePlan();if(errors.length){alert(errors.join("；"));return}
  const name=$("versionName").value.trim();if(!name){$("versionName").focus();$("versionStatus").textContent="请先填写版本名称。";return}
  const all=versions();if(all.some(v=>v.name===name)){alert("版本名称已存在，请用新名称保存，避免覆盖历史。");return}
  captureStaffDraft();const rows=currentPlan(),totals=planTotals(rows);
  const snapshot={id:"v_"+Date.now(),name,createdAt:new Date().toISOString(),formulaVersion:BeiaValidation.formulaVersion,template:appliedTemplateName,config:structuredClone(activeConfig()),draft:structuredClone(staffDraft),rows:structuredClone(rows),totals};
  try{checkedSnapshot(snapshot)}catch(e){alert("快照校验失败："+e.message);return}
  try{all.push(snapshot);if(compared.size>=4)compared.delete(compared.values().next().value);compared.add(snapshot.id);storeVersions(all);$("versionStatus").textContent="已保存“"+name+"”及参数快照。"}catch(e){alert("保存失败，请立即下载备份："+e.message)}
}
$("saveVersion").onclick=saveVersion;
function renderVersions(){
  const all=versions();$("versionList").innerHTML=all.length?'<table><thead><tr><th>对比</th><th>版本</th><th>期次 / 售卖品</th><th>参数模版</th><th>保存时间</th><th>操作</th></tr></thead><tbody>'+all.map(v=>'<tr><td><input type="checkbox" data-compare="'+esc(v.id)+'" '+(compared.has(v.id)?"checked":"")+'></td><td>'+esc(v.name)+'</td><td>'+esc(v.draft.period)+' / '+esc(v.config.products.find(p=>p.id===v.draft.season)?.label||v.draft.season)+'</td><td>'+esc(v.template)+'</td><td>'+new Date(v.createdAt).toLocaleString()+'</td><td><button class="btn" data-restore="'+esc(v.id)+'">载入副本</button> <button class="btn danger" data-delete="'+esc(v.id)+'">删除</button></td></tr>').join("")+'</tbody></table>':'<p style="padding:14px">还没有保存的方案版本。当前填写内容仍自动保存为工作草稿。</p>';
  $("versionList").querySelectorAll("[data-compare]").forEach(el=>el.onchange=()=>{if(el.checked&&compared.size>=4){el.checked=false;alert("最多同时对比4个版本");return}el.checked?compared.add(el.dataset.compare):compared.delete(el.dataset.compare);renderComparison()});
  $("versionList").querySelectorAll("[data-delete]").forEach(el=>el.onclick=()=>{if(confirm("删除此历史版本？建议先下载备份。")){compared.delete(el.dataset.delete);storeVersions(all.filter(v=>v.id!==el.dataset.delete))}});
  $("versionList").querySelectorAll("[data-restore]").forEach(el=>el.onclick=()=>{
    const v=all.find(x=>x.id===el.dataset.restore);try{checkedSnapshot(v)}catch(e){alert(e.message);return}if(!confirm("载入将替换当前工作草稿，请先保存需要保留的当前方案。继续？"))return;
    state=normalizeState(v.config);staffDraft=structuredClone(v.draft);activeTemplateName="未命名参数模版";
    activateTemplate();persistWorking();localStorage.setItem(PLAN_KEY,JSON.stringify(staffDraft));init();$("versionStatus").textContent="已载入“"+v.name+"”的完整快照为副本，原历史版本不变。";
  });
  renderComparison();
}
function renderComparison(){
  const list=versions().filter(v=>compared.has(v.id));if(list.length<2){$("versionComparison").innerHTML="";return}
  const first=list[0],metrics=[["volume","总承接量",fmt],["people","需求人力",fmt],["north","整体北A",n=>n.toFixed(3)],["gmv","总GMV",money],["profit","北A利润",money]];
  const different=list.some(v=>v.draft.period!==first.draft.period||v.draft.season!==first.draft.season);
  let html='<div class="wb-note">'+(different?"所选版本存在不同期次或售卖品，不宜直接把结果差异归因于排班。":"同一期次、同一售卖品对比；仍需核对参数变化。")+' 北A按总LTV收入÷总成本计算，不对渠道北A简单平均。</div><div class="wb-scroll"><table><thead><tr><th>指标 / 对照：'+esc(first.name)+'</th>'+list.map(v=>'<th>'+esc(v.name)+'</th>').join("")+'</tr></thead><tbody>';
  metrics.forEach(([k,label,format])=>{html+='<tr><th>'+label+'</th>'+list.map((v,i)=>'<td>'+format(v.totals[k])+(i?'<span class="wb-delta">较对照 '+(v.totals[k]-first.totals[k]>=0?"+":"")+format(v.totals[k]-first.totals[k])+'</span>':"")+'</td>').join("")+'</tr>'});
  html+='<tr><th>剩余人力（+富余 / −缺口）</th>'+list.map(v=>{const gap=v.draft.people-v.totals.people;return'<td>'+(gap>=0?"+":"")+fmt(gap)+'</td>'}).join("")+'</tr></tbody></table></div><details><summary style="padding:16px 0">查看各渠道承接量、人效与参数差异</summary><div class="wb-scroll"><table><thead><tr><th>渠道</th>'+list.map(v=>'<th>'+esc(v.name)+'</th>').join("")+'</tr></thead><tbody>';
  const names=[...new Set(list.flatMap(v=>v.rows.map(r=>r.c.name)))];names.forEach(n=>{html+='<tr><th>'+esc(n)+'</th>'+list.map(v=>{const r=v.rows.find(x=>x.c.name===n);return'<td>'+(r?fmt(r.volume)+'例 · 人效'+r.eff+'<span class="wb-delta">基准 '+r.c.baseEff+'/'+r.c.baseOutput+' · 斜率'+r.c.slope+' · 结算¥'+r.c.settle+'</span>':"未参与")+'</td>'}).join("")+'</tr>'});
  $("versionComparison").innerHTML=html+'</tbody></table></div></details>';
}
$("exportVersions").onclick=()=>downloadBlob("北A方案版本备份.json",JSON.stringify({schema:1,versions:versions()},null,2),"application/json");
$("importVersions").onclick=()=>$("versionFile").click();
$("versionFile").onchange=async e=>{
  try{const f=e.target.files[0];if(!f)return;if(f.size>10000000)throw Error("文件超过10MB");const data=JSON.parse(await f.text());
    if(data.schema!==1||!Array.isArray(data.versions))throw Error("不是方案版本备份");
    const all=versions();
    for(const v of data.versions){
      checkedSnapshot(v);
      if(!all.some(x=>x.id===v.id))all.push(v);
    }storeVersions(all);$("versionStatus").textContent="版本备份已导入，未覆盖同编号历史版本。";
  }catch(err){alert("导入失败："+err.message)}finally{e.target.value=""}
};
const originalInit=init;init=function(){originalInit();renderVersions()};
const previousRenderPlans=renderPlans;
renderPlans=function(...args){
  previousRenderPlans(...args);
  $("plans").querySelectorAll("article").forEach((card,i)=>{
    if(!i)return;
    const button=document.createElement("button");button.className="btn";button.textContent="载入此候选方案";
    button.onclick=()=>{
      if(!confirm("用此候选方案替换当前承接量与人效？建议先保存当前版本。"))return;
      const plan=lastPlans[i];captureStaffDraft(false);
      plan.rows.forEach(r=>staffDraft.rows[r.c.name]={vol:r.reported,take:r.volume,eff:r.eff});
      localStorage.setItem(PLAN_KEY,JSON.stringify(staffDraft));fillStaff();
      $("versionName").value=$("sPeriod").value+" · "+plan.name;
      $("versionStatus").textContent="候选方案已载入，请核对各渠道变化后保存版本；候选搜索不等于全局最优。";
    };card.appendChild(button);
  });
};
const previousRecalc=recalcStaff;
recalcStaff=function(){
  const errors=validatePlan();
  if(errors.length&&$("staffRows").rows.length){
    $("staffTotals").innerHTML='<div class="wb-note wb-error">'+esc(errors.slice(0,4).join("；"))+'。请修正输入后再测算。</div>';
    $("plans").innerHTML="";$("staffRows").querySelectorAll(".out,.need,.north,.gmv,.profit,.lpcCost,.totalCost,.ltvIncome").forEach(el=>el.textContent="—");return;
  }
  previousRecalc();
};
$("recalc").onclick=recalcStaff;$("sPeriod").oninput=recalcStaff;$("sPeople").oninput=recalcStaff;$("sSeason").onchange=recalcStaff;
const previousReset=resetStaffPlan;
$("resetPlan").onclick=()=>{if(confirm("重置当前承接量与人效？历史方案版本不会删除。"))previousReset()};
const productActions=document.createElement("div");productActions.className="wb-toolbar";
productActions.innerHTML='<button class="btn" id="productStartEditing">基于默认新建参数模版</button><button class="btn primary" id="productApply">应用当前参数</button><button class="btn" id="productSave">命名保存参数模版</button>';
productPanel.appendChild(productActions);
$("productStartEditing").onclick=beginCustom;
$("productApply").onclick=()=>applyParams();
$("productSave").onclick=()=>savePersonal();
$("downloadPlan").onclick=()=>{const errors=validatePlan();if(errors.length){alert(errors.join("；"));return}downloadPlan()};
const jump=document.createElement("div");jump.className="wb-toolbar";
jump.innerHTML='<button class="btn" type="button">查看已保存版本与对比</button>';
jump.firstChild.onclick=()=>$("versionCenter").scrollIntoView({behavior:"smooth",block:"start"});
$("staff").prepend(jump);
const productJump=document.createElement("div");productJump.className="wb-toolbar";
productJump.innerHTML='<button class="btn" type="button">售卖品ASP参数</button><button class="btn" type="button">发布前校验</button>';
productJump.children[0].onclick=()=>$("productCenter").scrollIntoView({behavior:"smooth",block:"start"});
productJump.children[1].onclick=()=>{inspectConfig();$("releaseGate").scrollIntoView({behavior:"smooth",block:"start"})};
$("params").prepend(productJump);
load();

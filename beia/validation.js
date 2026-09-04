/* Shared by the browser and Worker: publication cannot bypass this gate. */
(function(root){
  function validateConfig(s){
    const errors=[],warnings=[];
    const number=(v,label,min=0,max=Infinity)=>{if(typeof v!=="number"||!Number.isFinite(v)||v<min||v>max)errors.push(label+"必须为"+min+"至"+(max===Infinity?"合理上限":max)+"之间的数字");};
    if(!s||!Array.isArray(s.channels)||!s.channels.length)return {errors:["至少需要一个渠道"],warnings};
    const names=new Set();
    s.channels.forEach((c,i)=>{
      if(!c||typeof c!=="object"){errors.push("渠道格式不正确");return}
      const name=String(c.name||"").trim(),prefix=name||"第"+(i+1)+"个渠道";
      if(!name||names.has(name))errors.push(prefix+"：渠道名称为空或重复");names.add(name);
      ["baseEff","periods"].forEach(k=>number(c[k],prefix+" / "+k,0.01));
      ["baseOutput","lead","settle","material","labor","rd","active","idle","coupling"].forEach(k=>number(c[k],prefix+" / "+k));
      ["g2","refund","margin"].forEach(k=>number(c[k],prefix+" / "+k,0,100));
      number(c.rate,prefix+" / 排班率",0.01,100);
      number(c.overlap,prefix+" / 收入重合系数",0,1);
      number(c.slope,prefix+" / 斜率",-10000,10000);
      if(c.slope>0)warnings.push(prefix+"：正斜率意味着提高人效后例产上升，请确认有数据依据");
      if(![1,2,4].includes(c.periods))warnings.push(prefix+"：月承接期次不是常用的1、2、4期");
    });
    if(!Array.isArray(s.products)||!s.products.length)errors.push("售卖品参数不能为空");
    const ids=new Set(),labels=new Set();
    (Array.isArray(s.products)?s.products:[]).forEach(p=>{
      if(!p||typeof p!=="object"){errors.push("售卖品格式不正确");return}
      if(!p.id||ids.has(p.id)||!String(p.label||"").trim()||labels.has(p.label))errors.push("售卖品名称或编号为空/重复");
      ids.add(p.id);labels.add(p.label);
      if(!Array.isArray(p.rows)||p.rows.length!==6){errors.push(p.label+"：需要一至六年级共6行");return}
      p.rows.forEach((r,i)=>{
        if(!r||typeof r!=="object"){errors.push(p.label+"：年级参数格式不正确");return}
        number(r.asp,p.label+" / "+(i+1)+"年级 ASP",0.01);
        ["rA","rB"].forEach(k=>number(r[k],p.label+" / "+(i+1)+"年级 "+k));
        ["cASP","crA","crB"].forEach(k=>{if(r[k]!==null)number(r[k],p.label+" / "+(i+1)+"年级 "+k)});
      });
    });
    if(!ids.has(s.settings?.defaultSeason))errors.push("默认售卖品不在售卖品参数中心");
    return {errors,warnings};
  }
  root.BeiaValidation={validateConfig,formulaVersion:"north-a-2026-09-v1"};
})(globalThis);

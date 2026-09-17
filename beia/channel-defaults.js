/* One set of built-in channel defaults for both calculation pages. */
(function(root){
  const common={product:"26秋下12",periods:2,g1:0,g2:8,rate:87,refund:90,margin:77,coupling:43,overlap:.993,active:15300,idle:8700,baseEff:80,baseOutput:150,slope:-8,lead:0,settle:0,material:0,labor:0,rd:0,volume:0};
  const channels=[
    {name:"图解数学",periods:2,baseEff:80,baseOutput:161,slope:-8,lead:54.3,settle:158.2,material:17.0,labor:15.8,rd:3.1,coupling:43,volume:32000},
    {name:"大通关",periods:2,baseEff:86,baseOutput:138,slope:-7,lead:44.1,settle:144.9,material:21.6,labor:15.8,rd:3.1,coupling:43,volume:6000},
    {name:"尖子生",periods:2,baseEff:66,baseOutput:267,slope:-17,lead:106.9,settle:305.0,material:55.3,labor:15.8,rd:3.1,coupling:43,volume:7000},
    {name:"商务高价",periods:2,baseEff:109,baseOutput:131,slope:-4.5,lead:8.0,settle:104.3,material:0,labor:15.8,rd:3.1,coupling:43,volume:10000},
    {name:"LEC高价",periods:2,baseEff:110,baseOutput:152,slope:-7,lead:27.7,settle:156.8,material:13.3,labor:5.6,rd:3.4,coupling:43,volume:4500},
    {name:"LEC1元",periods:2,baseEff:143,baseOutput:81,slope:-3,lead:.9,settle:71.9,material:0,labor:5.6,rd:3.4,coupling:43,volume:10500},
    {name:"思维365",product:"26秋寒_新思维",periods:1,baseEff:64,baseOutput:385,slope:-33,coupling:0,lead:181.4,settle:595.1,material:75.0,labor:15.8,rd:3.1,volume:5000},
    {name:"OK转学科",periods:1,baseEff:97,baseOutput:326,slope:-33,lead:160.9,settle:837.1,material:0,labor:0,rd:3.1,coupling:34.23,volume:3000},
    {name:"端内0元",periods:4,baseEff:646,baseOutput:20,slope:-.2,lead:0,settle:7.5,material:0,labor:3.1,rd:1.4,coupling:33.18,volume:3000}
  ].map(c=>({...common,...c}));
  root.BEIA_CHANNEL_COMMON=common;
  root.BEIA_CHANNEL_DEFAULTS={version:5,defaultsRevision:"2026-09-17-nine-channel-template",settings:{defaultSeason:"26秋下12"},channels};
  // Upgrade cached built-in defaults only. Named templates and plan snapshots are untouched.
  root.upgradeLocalDefaults=function(saved){
    if(!saved?.channels)return structuredClone(root.BEIA_CHANNEL_DEFAULTS);
    if(saved.defaultsRevision===root.BEIA_CHANNEL_DEFAULTS.defaultsRevision)return saved;
    const result=structuredClone(saved);
    const latest=Object.fromEntries(channels.map(c=>[c.name,c]));
    result.channels=channels.map(defaultRow=>{
      const old=result.channels.find(c=>c.name===defaultRow.name)||{};
      return{...old,...structuredClone(latest[defaultRow.name]),g1:Number.isFinite(old.g1)?old.g1:0,product:old.product||defaultRow.product};
    });
    result.defaultsRevision=root.BEIA_CHANNEL_DEFAULTS.defaultsRevision;
    return result;
  };
  // Only clean the transient unnamed draft created from an older built-in list.
  // Named personal templates remain untouched, and any genuinely new channel is preserved.
  root.upgradeLocalDraft=function(saved){
    if(!saved?.channels)return saved;
    const retired=new Set(["图解自播","图解达播","LEC9.9"]);
    const result=structuredClone(saved);
    result.channels=result.channels.filter(c=>{
      const name=String(c?.name||"");
      return !retired.has(name)&&!name.startsWith("LEC实物");
    });
    result.defaultsRevision=root.BEIA_CHANNEL_DEFAULTS.defaultsRevision;
    return result;
  };
})(globalThis);

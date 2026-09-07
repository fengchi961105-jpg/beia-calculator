/* One set of built-in channel defaults for both calculation pages. */
(function(root){
  const common={periods:2,g2:8,rate:87,refund:90,margin:77,coupling:43,overlap:.993,active:15300,idle:8700,baseEff:80,baseOutput:150,slope:-8,lead:0,settle:0,material:0,labor:0,rd:0,volume:0};
  const channels=[
    {name:"图解数学",periods:2,baseEff:85,baseOutput:162,slope:-8,lead:53.65,settle:180,material:16.97,labor:15.82,rd:3.14,volume:32000},
    {name:"大通关",periods:2,baseEff:85,baseOutput:139,slope:-7,lead:44.06,settle:150,material:21.56,labor:15.82,rd:3.14,volume:6000},
    {name:"尖子生",periods:2,baseEff:60,baseOutput:257,slope:-17,lead:105.72,settle:300,material:57.93,labor:15.82,rd:3.14,volume:7000},
    {name:"商务高价",periods:2,baseEff:115,baseOutput:130,slope:-4.5,lead:8.32,settle:105,material:0,labor:15.82,rd:3.14,volume:10000},
    {name:"LEC高价",periods:2,baseEff:95,baseOutput:144,slope:-7,lead:20.17,settle:154,material:7.81,labor:5.6,rd:3.4,volume:4500},
    {name:"LEC1元",periods:2,baseEff:135,baseOutput:88,slope:-3,lead:1,settle:75,material:.01,labor:5.6,rd:3.4,volume:10500},
    {name:"图解自播",parentChannel:"图解数学",planningDefault:false,baseEff:85,baseOutput:162,slope:-8,lead:54.08,settle:163.18,material:16.97,labor:15.82,rd:3.14},
    {name:"图解达播",parentChannel:"图解数学",planningDefault:false,baseEff:85,baseOutput:162,slope:-8,lead:52.54,settle:144.71,material:16.97,labor:15.82,rd:3.14},
    {name:"LEC9.9",parentChannel:"LEC高价",planningDefault:false,baseEff:95,baseOutput:144,slope:-7,lead:9.66,settle:119.21,material:0,labor:5.6,rd:3.4},
    {name:"LEC实物（20元+）",parentChannel:"LEC高价",planningDefault:false,baseEff:95,baseOutput:144,slope:-7,lead:28.61,settle:151.46,material:14.99,labor:5.6,rd:3.4},
    {name:"思维365",periods:1,baseEff:55,baseOutput:375,slope:-33,coupling:8,lead:183.60,settle:583.84,material:75,labor:15.82,rd:3.14,volume:5000},
    {name:"OK转学科",periods:1,baseEff:55,baseOutput:375,slope:-33,lead:239.20,settle:650,material:75,labor:15.57,rd:2.77,volume:3000,provisional:true},
    {name:"端内0元",periods:4,baseEff:32,baseOutput:32,slope:-.2,lead:0,settle:7.98,material:0,labor:0,rd:0,volume:3000}
  ].map(c=>({...common,...c}));
  root.BEIA_CHANNEL_COMMON=common;
  root.BEIA_CHANNEL_DEFAULTS={version:2,defaultsRevision:"2026-09-04-confirmed",settings:{defaultSeason:"26秋下12"},channels};
  // Upgrade cached built-in defaults only. Named templates and plan snapshots are untouched.
  root.upgradeLocalDefaults=function(saved){
    if(!saved?.channels)return structuredClone(root.BEIA_CHANNEL_DEFAULTS);
    if(saved.defaultsRevision===root.BEIA_CHANNEL_DEFAULTS.defaultsRevision)return saved;
    const result=structuredClone(saved);
    const changes={"图解数学":{lead:53.65},"尖子生":{lead:105.72,material:57.93},"商务高价":{lead:8.32},"LEC高价":{labor:5.6,rd:3.4},"LEC1元":{lead:1,labor:5.6,rd:3.4},"思维365":{lead:183.6,settle:583.84,material:75,labor:15.82,rd:3.14,coupling:8},"端内0元":{labor:0,rd:0}};
    result.channels=result.channels.map(c=>({...c,...changes[c.name]}));
    channels.filter(c=>c.parentChannel).forEach(c=>{if(!result.channels.some(x=>x.name===c.name))result.channels.push(structuredClone(c))});
    const tail=["思维365","OK转学科","端内0元"];
    result.channels=[...result.channels.filter(c=>!tail.includes(c.name)),...tail.flatMap(n=>result.channels.filter(c=>c.name===n))];
    result.defaultsRevision=root.BEIA_CHANNEL_DEFAULTS.defaultsRevision;
    return result;
  };
})(globalThis);

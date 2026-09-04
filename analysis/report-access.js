/* Reports are encrypted before publication. No plaintext password is shipped. */
(() => {
  const KEY='workbench_analysis_session_v1', payload=JSON.parse(document.getElementById('report-payload').textContent);
  const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  const encode=b=>btoa(String.fromCharCode(...new Uint8Array(b)));
  const form=document.getElementById('access-form'),input=document.getElementById('password'),button=document.getElementById('enter'),error=document.getElementById('error');
  async function open(raw){
    const key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']);
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(payload.iv)},key,bytes(payload.content));
    return new TextDecoder().decode(plain);
  }
  function display(html){
    // Wait for the encrypted wrapper's parser to finish before replacing it.
    // Otherwise automatic session restore can append the report below the gate.
    const replace=()=>setTimeout(()=>{document.open();document.write(html);document.close();},0);
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',replace,{once:true});
    else replace();
  }
  async function resume(){
    try{
      const saved=JSON.parse(sessionStorage.getItem(KEY));
      if(saved?.version!==payload.salt||!Number.isFinite(saved.expires)||saved.expires<=Date.now()||saved.expires>Date.now()+8*3600000)return;
      display(await open(bytes(saved.key)));
    }catch{sessionStorage.removeItem(KEY);}
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(button.disabled)return;button.disabled=true;error.textContent='正在验证…';
    try{
      const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(input.value),'PBKDF2',false,['deriveBits']);
      const raw=await crypto.subtle.deriveBits({name:'PBKDF2',salt:bytes(payload.salt),iterations:payload.iterations,hash:'SHA-256'},material,256);
      const html=await open(raw);
      input.value='';
      sessionStorage.setItem(KEY,JSON.stringify({version:payload.salt,key:encode(raw),expires:Date.now()+8*3600000}));
      display(html);
    }catch{error.textContent='密码不正确或文件加载异常，请重新输入。';input.value='';input.focus();}
    finally{button.disabled=false;}
  });
  resume();
})();

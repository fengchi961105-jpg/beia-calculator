/* Static-page convenience gate only; public source/assets are not server-protected. */
(() => {
  'use strict';
  const HASH = '1c0c395424ab8ab098dde39718de3ebf69c434f4f8be94d25841a5cca413c45d';
  const KEY = 'beia_access_session_v1';
  const HOURS = 8;
  function permitted() {
    try {
      const entry = JSON.parse(sessionStorage.getItem(KEY));
      return entry?.version === HASH && Number.isFinite(entry.expires) && entry.expires > Date.now() && entry.expires <= Date.now() + HOURS * 3600000;
    } catch { return false; }
  }
  const admitted = permitted();
  if (admitted) document.documentElement.removeAttribute('data-beia-locked');
  const css = document.createElement('style');
  css.textContent = `
    #beia-access-gate{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:radial-gradient(ellipse at 50% 15%,#e8eefb,#f5f7fb 65%);font:14px/1.6 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;color:#20314e;padding:24px}
    #beia-access-gate .access-card{box-sizing:border-box;width:min(420px,100%);padding:36px;background:#fff;border:1px solid #e0e6f0;border-radius:18px;box-shadow:0 18px 60px #263e6512}
    #beia-access-gate .access-eyebrow{font-size:11px;letter-spacing:2px;color:#718099;margin-bottom:10px}
    #beia-access-gate h1{font-size:22px;line-height:1.4;margin:0 0 8px;color:#1e3154}
    #beia-access-gate p{margin:0 0 24px;color:#718099;font-size:13px}
    #beia-access-gate label{display:block;font-size:13px;font-weight:600;margin-bottom:8px}
    #beia-access-gate input{box-sizing:border-box;width:100%;height:46px;padding:10px 12px;border:1px solid #ccd6e7;border-radius:9px;font:inherit;background:#fff;color:#20314e}
    #beia-access-gate input:focus{outline:3px solid #e7eeff;border-color:#597de0}
    #beia-access-gate button{width:100%;height:44px;border:0;border-radius:9px;background:#315fc9;color:#fff;font-size:14px;font-weight:600;cursor:pointer;margin-top:14px}
    #beia-access-gate button:disabled{opacity:.65;cursor:wait}
    #beia-access-error{min-height:22px;margin-top:10px;color:#b63f46;font-size:12px}
    #beia-access-gate .access-foot{font-size:11px;color:#8b96a8;margin-top:16px}
    #beia-access-logout{position:fixed;bottom:18px;right:20px;z-index:45;padding:8px 13px;border:1px solid #d5deeb;border-radius:8px;background:#fff;color:#52647f;font:12px -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;cursor:pointer;box-shadow:0 3px 12px #1727440a}
    @media print{#beia-access-logout{display:none}}
  `;
  document.head.appendChild(css);
  function start() {
    if (admitted) {
      if (window.top === window.self) {
        const logout = document.createElement('button');
        logout.id = 'beia-access-logout';
        logout.textContent = '退出访问';
        logout.title = '重新输入访问密码；不会删除已保存的模版或方案';
        logout.onclick = () => { sessionStorage.removeItem(KEY); location.reload(); };
        document.body.appendChild(logout);
      }
      return;
    }
    const gate = document.createElement('main');
    gate.id = 'beia-access-gate';
    gate.innerHTML = `<section class="access-card" aria-labelledby="beia-access-title"><div class="access-eyebrow">经营分析工作台</div><h1 id="beia-access-title">北极星A经营决策系统</h1><p>请输入访问密码，进入计算与排班工作台。</p><form><label for="beia-access-password">访问密码</label><input id="beia-access-password" type="password" autocomplete="current-password" required placeholder="请输入密码" aria-describedby="beia-access-error"><button type="submit">进入系统</button><div id="beia-access-error" role="status" aria-live="polite"></div></form><div class="access-foot">当前标签页验证后可使用8小时。退出访问不会删除已保存数据。</div></section>`;
    document.body.appendChild(gate);
    const form = gate.querySelector('form'), input = gate.querySelector('input'), button = gate.querySelector('button'), error = gate.querySelector('[role=status]');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (button.disabled) return;
      button.disabled = true;
      error.textContent = '';
      try {
        const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input.value));
        const value = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
        if (value !== HASH) {
          error.textContent = '密码不正确，请重新输入。';
          input.value = '';
          await new Promise(resolve => setTimeout(resolve, 600));
          input.focus();
          return;
        }
        sessionStorage.setItem(KEY, JSON.stringify({version: HASH, expires: Date.now() + HOURS * 3600000}));
        location.reload();
      } catch {
        error.textContent = '无法完成验证，请使用HTTPS打开，并允许浏览器存储。';
      } finally { button.disabled = false; }
    });
    input.focus();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
  // A restored page must not silently bypass a logout or expired session.
  window.addEventListener('pageshow', event => { if (event.persisted && !permitted()) location.reload(); });
})();

/**
 * ZeroEnglish — Auth Module v2 (Premium UI)
 */
(function () {
  "use strict";
  const TOKEN_KEY = "ze.auth.token";
  const USER_KEY  = "ze.auth.user";
  const saveSession = (t, u) => { localStorage.setItem(TOKEN_KEY, t); localStorage.setItem(USER_KEY, JSON.stringify(u)); };
  const clearSession = () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); };
  const getToken = () => localStorage.getItem(TOKEN_KEY) || null;
  const getUser  = () => { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } };
  const isLoggedIn = () => Boolean(getToken() && getUser());
  const escHtml = (s) => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  async function apiFetch(path, options = {}) {
    const token = getToken();
    const res = await fetch(path, { ...options, headers: { "Content-Type": "application/json", "Accept": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) }, body: options.body ? JSON.stringify(options.body) : undefined });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) throw new Error(data.error || "Yêu cầu thất bại.");
    return data;
  }
  const apiRegister = (e,n,p) => apiFetch("/auth/register",{method:"POST",body:{email:e,name:n,password:p}});
  const apiLogin    = (e,p)   => apiFetch("/auth/login",{method:"POST",body:{email:e,password:p}});
  const apiUpgrade  = ()      => apiFetch("/auth/upgrade",{method:"POST",body:{}});
  const apiAdminUsers   = ()       => apiFetch("/auth/admin/users");
  const apiAdminSetPlan = (id,pl)  => apiFetch("/auth/admin/set-plan",{method:"PATCH",body:{user_id:id,plan:pl}});
  const apiAdminSetRole = (id,rl)  => apiFetch("/auth/admin/set-role",{method:"PATCH",body:{user_id:id,role:rl}});
  function showToast(msg,ok=true){
    let t=document.getElementById("ze-toast");
    if(!t){t=document.createElement("div");t.id="ze-toast";document.body.appendChild(t);}
    t.innerHTML=`<span class="ze-toast-icon">${ok?"✓":"!"}</span><span>${escHtml(msg)}</span>`;
    t.className="ze-toast "+(ok?"ze-toast-ok":"ze-toast-err")+" ze-toast-in";
    clearTimeout(t._timer);
    t._timer=setTimeout(()=>{t.classList.remove("ze-toast-in");t.classList.add("ze-toast-out");},3000);
  }
  function openModal(html,onReady,wide=false){
    let old=document.getElementById("ze-modal-root");if(old)old.remove();
    const root=document.createElement("div");root.id="ze-modal-root";
    root.innerHTML=`<div class="ze-backdrop" id="ze-backdrop"><div class="ze-modal${wide?" ze-modal-wide":""}" role="dialog" aria-modal="true"><button class="ze-modal-x" id="ze-modal-x" aria-label="Đóng"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>${html}</div></div>`;
    document.body.appendChild(root);
    requestAnimationFrame(()=>root.querySelector(".ze-backdrop").classList.add("ze-backdrop-in"));
    const close=()=>{const bd=root.querySelector(".ze-backdrop");bd.classList.remove("ze-backdrop-in");bd.classList.add("ze-backdrop-out");setTimeout(()=>root.remove(),280);};
    root.querySelector("#ze-modal-x").addEventListener("click",close);
    root.querySelector("#ze-backdrop").addEventListener("click",(e)=>{if(e.target===e.currentTarget)close();});
    if(onReady)onReady(root,close);
    return{root,close};
  }
  function openAuthModal(tab="login"){
    const{root,close}=openModal(`
      <div class="ze-auth-brand"><div class="ze-logo-mark">Z</div><span class="ze-logo-text">Zero<em>English</em></span></div>
      <div class="ze-tab-bar">
        <button class="ze-tab${tab==="login"?" ze-tab-active":""}" data-tab="login">Đăng nhập</button>
        <button class="ze-tab${tab==="register"?" ze-tab-active":""}" data-tab="register">Tạo tài khoản</button>
        <div class="ze-tab-ink" style="left:${tab==="login"?"4px":"calc(50% + 4px)"};width:calc(50% - 8px)"></div>
      </div>
      <form id="ze-form-login" class="ze-form${tab!=="login"?" ze-hidden":""}">
        <div class="ze-field"><label class="ze-label">Email</label><div class="ze-input-wrap"><svg class="ze-input-icon" viewBox="0 0 20 20" fill="none"><path d="M3 6l7 5 7-5M3 6h14v10H3V6z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg><input type="email" id="ze-l-email" class="ze-input" placeholder="ban@email.com" autocomplete="email" required></div></div>
        <div class="ze-field"><label class="ze-label">Mật khẩu</label><div class="ze-input-wrap"><svg class="ze-input-icon" viewBox="0 0 20 20" fill="none"><rect x="3" y="9" width="14" height="9" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M7 9V6a3 3 0 016 0v3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg><input type="password" id="ze-l-pw" class="ze-input" placeholder="Nhập mật khẩu" autocomplete="current-password" required><button type="button" class="ze-eye-btn" id="ze-l-eye" tabindex="-1" aria-label="Hiện"><svg viewBox="0 0 20 20" fill="none" width="16" height="16"><path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" stroke="currentColor" stroke-width="1.4"/><circle cx="10" cy="10" r="2.5" stroke="currentColor" stroke-width="1.4"/></svg></button></div></div>
        <p id="ze-l-err" class="ze-err ze-hidden"></p>
        <button type="submit" class="ze-btn-main ze-btn-login" id="ze-l-submit"><span id="ze-l-label">Đăng nhập</span><span id="ze-l-spin" class="ze-spin ze-hidden"></span></button>
        <p class="ze-switch-hint">Chưa có tài khoản? <button type="button" class="ze-link" data-tab="register">Tạo ngay miễn phí</button></p>
      </form>
      <form id="ze-form-register" class="ze-form${tab!=="register"?" ze-hidden":""}">
        <div class="ze-field"><label class="ze-label">Họ và tên</label><div class="ze-input-wrap"><svg class="ze-input-icon" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="7" r="3" stroke="currentColor" stroke-width="1.4"/><path d="M3 17c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg><input type="text" id="ze-r-name" class="ze-input" placeholder="Nguyễn Văn A" autocomplete="name" required></div></div>
        <div class="ze-field"><label class="ze-label">Email</label><div class="ze-input-wrap"><svg class="ze-input-icon" viewBox="0 0 20 20" fill="none"><path d="M3 6l7 5 7-5M3 6h14v10H3V6z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg><input type="email" id="ze-r-email" class="ze-input" placeholder="ban@email.com" autocomplete="email" required></div></div>
        <div class="ze-field"><label class="ze-label">Mật khẩu</label><div class="ze-input-wrap"><svg class="ze-input-icon" viewBox="0 0 20 20" fill="none"><rect x="3" y="9" width="14" height="9" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M7 9V6a3 3 0 016 0v3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg><input type="password" id="ze-r-pw" class="ze-input" placeholder="Ít nhất 8 ký tự, gồm chữ và số" autocomplete="new-password" required><button type="button" class="ze-eye-btn" id="ze-r-eye" tabindex="-1" aria-label="Hiện"><svg viewBox="0 0 20 20" fill="none" width="16" height="16"><path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" stroke="currentColor" stroke-width="1.4"/><circle cx="10" cy="10" r="2.5" stroke="currentColor" stroke-width="1.4"/></svg></button></div><div class="ze-pw-strength"><div class="ze-pw-bar" id="ze-pw-bar"></div></div><p class="ze-pw-hint" id="ze-pw-hint"></p></div>
        <p id="ze-r-err" class="ze-err ze-hidden"></p>
        <button type="submit" class="ze-btn-main ze-btn-register" id="ze-r-submit"><span id="ze-r-label">Tạo tài khoản miễn phí</span><span id="ze-r-spin" class="ze-spin ze-hidden"></span></button>
        <p class="ze-switch-hint">Đã có tài khoản? <button type="button" class="ze-link" data-tab="login">Đăng nhập</button></p>
      </form>
      <div class="ze-modal-footer"><span class="ze-plan-chip ze-chip-classic">Classic</span> Miễn phí &nbsp;·&nbsp; <span class="ze-plan-chip ze-chip-pro">Pro</span> Không giới hạn AI</div>`);
    root.querySelectorAll("[data-tab]").forEach(el=>el.addEventListener("click",()=>{close();openAuthModal(el.dataset.tab);}));
    const makeEye=(eid,iid)=>{const e=root.querySelector("#"+eid),i=root.querySelector("#"+iid);if(e&&i)e.addEventListener("click",()=>{i.type=i.type==="password"?"text":"password";});};
    makeEye("ze-l-eye","ze-l-pw");makeEye("ze-r-eye","ze-r-pw");
    const pwInp=root.querySelector("#ze-r-pw"),pwBar=root.querySelector("#ze-pw-bar"),pwHint=root.querySelector("#ze-pw-hint");
    if(pwInp)pwInp.addEventListener("input",()=>{const v=pwInp.value;let s=0;if(v.length>=8)s++;if(/[A-Z]/.test(v))s++;if(/[0-9]/.test(v))s++;if(/[^a-zA-Z0-9]/.test(v))s++;const C=["","#e53935","#f57c00","#0d6efd","#1e8f62"],L=["","Yếu","Trung bình","Khá","Mạnh"];pwBar.style.width=s*25+"%";pwBar.style.background=C[s]||"transparent";pwHint.textContent=v.length?(L[s]||""):"";pwHint.style.color=C[s]||"inherit";});
    function submitForm(formId,errId,btnId,lblId,spinId,handler){
      const f=root.querySelector("#"+formId);
      if(!f)return;
      f.addEventListener("submit",async(e)=>{
        e.preventDefault();
        const err=root.querySelector("#"+errId),btn=root.querySelector("#"+btnId),lbl=root.querySelector("#"+lblId),spin=root.querySelector("#"+spinId);
        err.classList.add("ze-hidden");btn.disabled=true;lbl.classList.add("ze-hidden");spin.classList.remove("ze-hidden");
        try{await handler();}catch(ex){err.textContent=ex.message;err.classList.remove("ze-hidden");btn.disabled=false;lbl.classList.remove("ze-hidden");spin.classList.add("ze-hidden");}
      });
    }
    submitForm("ze-form-login","ze-l-err","ze-l-submit","ze-l-label","ze-l-spin",async()=>{
      const data=await apiLogin(root.querySelector("#ze-l-email").value.trim(),root.querySelector("#ze-l-pw").value);
      saveSession(data.token,data.user);close();renderAuthBar();showToast(`Chào mừng trở lại, ${data.user.name}! 👋`);
    });
    submitForm("ze-form-register","ze-r-err","ze-r-submit","ze-r-label","ze-r-spin",async()=>{
      const data=await apiRegister(root.querySelector("#ze-r-email").value.trim(),root.querySelector("#ze-r-name").value.trim(),root.querySelector("#ze-r-pw").value);
      saveSession(data.token,data.user);close();renderAuthBar();showToast(`Tài khoản đã tạo! Chào mừng ${data.user.name} 🎉`);
    });
  }
  function openUpgradeModal(){
    const{root,close}=openModal(`
      <div class="ze-upgrade-glow"></div>
      <div class="ze-upgrade-head"><div class="ze-upgrade-crown">⭐</div><h2 class="ze-upgrade-title">Nâng cấp lên <span class="ze-pro-text">Pro</span></h2><p class="ze-upgrade-sub">Mở khóa toàn bộ trải nghiệm AI</p></div>
      <div class="ze-feature-grid">
        <div class="ze-feature-item ze-feature-free"><div class="ze-feature-label">Classic <span class="ze-chip-free-sm">Miễn phí</span></div><ul class="ze-feat-list"><li class="ok">Thẻ từ vựng không giới hạn</li><li class="ok">Ghép từ & Ngữ pháp</li><li class="ok">Giải thích câu</li><li class="no">Đọc hiểu AI</li><li class="no">Gia sư AI (Chat)</li><li class="no">Luyện nghe AI</li><li class="no">Tiếng Trung (full)</li></ul></div>
        <div class="ze-feature-item ze-feature-pro"><div class="ze-feature-label ze-pro-text">Pro <span class="ze-chip-pro-sm">Tất cả</span></div><ul class="ze-feat-list"><li class="ok">Thẻ từ vựng không giới hạn</li><li class="ok">Ghép từ & Ngữ pháp</li><li class="ok">Giải thích câu</li><li class="ok ze-pro-ok">Đọc hiểu AI ✦</li><li class="ok ze-pro-ok">Gia sư AI (Chat) ✦</li><li class="ok ze-pro-ok">Luyện nghe AI ✦</li><li class="ok ze-pro-ok">Tiếng Trung (full) ✦</li></ul></div>
      </div>
      <p id="ze-up-err" class="ze-err ze-hidden"></p>
      <button class="ze-btn-main ze-btn-pro-upgrade" id="ze-do-upgrade"><span id="ze-up-label">🚀 Kích hoạt Pro ngay</span><span id="ze-up-spin" class="ze-spin ze-hidden"></span></button>
      <p class="ze-upgrade-note">Demo: kích hoạt miễn phí. Tích hợp thanh toán thật sau.</p>`);
    root.querySelector("#ze-do-upgrade").addEventListener("click",async()=>{
      const err=root.querySelector("#ze-up-err"),btn=root.querySelector("#ze-do-upgrade"),lbl=root.querySelector("#ze-up-label"),spin=root.querySelector("#ze-up-spin");
      err.classList.add("ze-hidden");btn.disabled=true;lbl.classList.add("ze-hidden");spin.classList.remove("ze-hidden");
      try{const data=await apiUpgrade();saveSession(data.token,{...getUser(),plan:"pro"});close();renderAuthBar();showToast("🎉 Bạn đã là thành viên Pro!");}
      catch(ex){err.textContent=ex.message;err.classList.remove("ze-hidden");btn.disabled=false;lbl.classList.remove("ze-hidden");spin.classList.add("ze-hidden");}
    });
  }
  async function openAdminPanel(){
    const{root}=openModal(`<div class="ze-admin-head"><div class="ze-admin-icon">👑</div><h2 class="ze-admin-title">Quản trị viên</h2></div><div id="ze-admin-body"><div class="ze-admin-loading"><div class="ze-loading-dots"><span></span><span></span><span></span></div><p>Đang tải dữ liệu...</p></div></div>`,null,true);
    const body=root.querySelector("#ze-admin-body");
    try{
      const data=await apiAdminUsers();const users=data.users||[];
      body.innerHTML=`<div class="ze-admin-stats"><div class="ze-stat-card"><span class="ze-stat-num">${users.length}</span><span class="ze-stat-lbl">Tổng users</span></div><div class="ze-stat-card"><span class="ze-stat-num ze-pro-text">${users.filter(u=>u.plan==="pro").length}</span><span class="ze-stat-lbl">Pro</span></div><div class="ze-stat-card"><span class="ze-stat-num">${users.filter(u=>u.role==="admin").length}</span><span class="ze-stat-lbl">Admin</span></div></div><div class="ze-admin-table-wrap"><table class="ze-admin-tbl"><thead><tr><th>Người dùng</th><th>Plan</th><th>Role</th><th>Ngày tạo</th></tr></thead><tbody>${users.map(u=>`<tr class="ze-admin-row"><td><div class="ze-user-cell"><div class="ze-avatar">${escHtml((u.name||"?")[0].toUpperCase())}</div><div><div class="ze-user-name">${escHtml(u.name)}</div><div class="ze-user-email">${escHtml(u.email)}</div></div></div></td><td><select class="ze-admin-sel ze-plan-sel" data-uid="${escHtml(u.id)}"><option value="classic" ${u.plan==="classic"?"selected":""}>Classic</option><option value="pro" ${u.plan==="pro"?"selected":""}>Pro</option></select></td><td><select class="ze-admin-sel ze-role-sel" data-uid="${escHtml(u.id)}"><option value="user" ${u.role==="user"?"selected":""}>User</option><option value="admin" ${u.role==="admin"?"selected":""}>Admin</option></select></td><td class="ze-user-date">${new Date(u.created_at).toLocaleDateString("vi-VN")}</td></tr>`).join("")}</tbody></table></div>`;
      body.querySelectorAll(".ze-plan-sel").forEach(s=>s.addEventListener("change",async()=>{try{await apiAdminSetPlan(s.dataset.uid,s.value);showToast("Đã cập nhật plan.");}catch(ex){showToast(ex.message,false);}}));
      body.querySelectorAll(".ze-role-sel").forEach(s=>s.addEventListener("change",async()=>{try{await apiAdminSetRole(s.dataset.uid,s.value);showToast("Đã cập nhật role.");}catch(ex){showToast(ex.message,false);}}));
    }catch(ex){body.innerHTML=`<p class="ze-err" style="margin:24px 0">${escHtml(ex.message)}</p>`;}
  }
  function renderAuthBar(){
    let bar=document.getElementById("ze-auth-bar");
    if(!bar){bar=document.createElement("div");bar.id="ze-auth-bar";const t=document.querySelector(".navbar")||document.body;t.insertBefore(bar,t.firstChild);}
    if(!isLoggedIn()){
      bar.innerHTML=`<div class="ze-bar-inner"><div class="ze-bar-left"><span class="ze-plan-chip ze-chip-guest">Khách</span><span class="ze-bar-hint">Đăng nhập để lưu tiến trình học</span></div><div class="ze-bar-right"><button class="ze-bar-btn ze-bar-ghost" id="ze-btn-login">Đăng nhập</button><button class="ze-bar-btn ze-bar-solid" id="ze-btn-register"><svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M10 5v10M5 10h10" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>Tạo tài khoản</button></div></div>`;
      bar.querySelector("#ze-btn-login").addEventListener("click",()=>openAuthModal("login"));
      bar.querySelector("#ze-btn-register").addEventListener("click",()=>openAuthModal("register"));
    }else{
      const user=getUser(),isPro=user.plan==="pro",isAdmin=user.role==="admin";
      const ini=(user.name||"?").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
      bar.innerHTML=`<div class="ze-bar-inner"><div class="ze-bar-left"><div class="ze-bar-avatar">${escHtml(ini)}</div><div class="ze-bar-userinfo"><span class="ze-bar-username">${escHtml(user.name)}</span><span class="ze-plan-chip ${isPro?"ze-chip-pro":"ze-chip-classic"}">${isPro?"⭐ Pro":"Classic"}</span></div></div><div class="ze-bar-right">${isAdmin?`<button class="ze-bar-btn ze-bar-admin" id="ze-btn-admin">👑 Admin</button>`:""} ${!isPro?`<button class="ze-bar-btn ze-bar-upgrade" id="ze-btn-upgrade">⭐ Nâng cấp Pro</button>`:""}<button class="ze-bar-btn ze-bar-ghost" id="ze-btn-logout"><svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M13 15l4-5-4-5M17 10H7M10 3H4a1 1 0 00-1 1v12a1 1 0 001 1h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Đăng xuất</button></div></div>`;
      if(isAdmin)bar.querySelector("#ze-btn-admin").addEventListener("click",openAdminPanel);
      if(!isPro)bar.querySelector("#ze-btn-upgrade").addEventListener("click",openUpgradeModal);
      bar.querySelector("#ze-btn-logout").addEventListener("click",()=>{clearSession();renderAuthBar();showToast("Đã đăng xuất thành công.");});
    }
  }
  function patchFetch(){
    const orig=window.fetch.bind(window);
    window.fetch=function(input,init={}){
      const url=typeof input==="string"?input:(input?.url||"");
      if((url.startsWith("/api/")||url.startsWith("/auth/"))&&getToken()){const h=new Headers(init.headers||{});if(!h.has("Authorization"))h.set("Authorization",`Bearer ${getToken()}`);init={...init,headers:h};}
      return orig(input,init);
    };
  }
  function injectStyles(){
    if(document.getElementById("ze-auth-css"))return;
    const s=document.createElement("style");s.id="ze-auth-css";
    s.textContent=`
#ze-auth-bar{background:rgba(255,255,255,.72);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid rgba(22,69,102,.1);position:sticky;top:0;z-index:100;}
.ze-bar-inner{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 20px;flex-wrap:wrap;}
.ze-bar-left,.ze-bar-right{display:flex;align-items:center;gap:10px;}
.ze-bar-hint{font-size:12px;color:#597286;}
.ze-bar-avatar{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#0d6efd,#1e8f62);color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.ze-bar-userinfo{display:flex;align-items:center;gap:8px;}
.ze-bar-username{font-size:13px;font-weight:600;color:#16344b;}
.ze-plan-chip{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;letter-spacing:.6px;padding:3px 9px;border-radius:20px;text-transform:uppercase;}
.ze-chip-guest{background:#edf2f7;color:#597286;}
.ze-chip-classic{background:#e8f5ee;color:#1e6b42;border:1px solid rgba(30,143,98,.2);}
.ze-chip-pro{background:linear-gradient(90deg,#fff3cd,#ffe0b2);color:#b05e00;border:1px solid rgba(212,138,18,.3);}
.ze-bar-btn{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;border-radius:8px;padding:7px 14px;cursor:pointer;border:none;transition:all .18s ease;white-space:nowrap;}
.ze-bar-ghost{background:transparent;color:#16344b;border:1.5px solid rgba(22,69,102,.2);}
.ze-bar-ghost:hover{background:rgba(22,69,102,.06);border-color:rgba(22,69,102,.35);}
.ze-bar-solid{background:#0d6efd;color:#fff;}
.ze-bar-solid:hover{background:#0a56cc;transform:translateY(-1px);box-shadow:0 4px 12px rgba(13,110,253,.3);}
.ze-bar-upgrade{background:linear-gradient(90deg,#f5a623,#f06828);color:#fff;box-shadow:0 2px 8px rgba(240,104,40,.3);}
.ze-bar-upgrade:hover{box-shadow:0 4px 16px rgba(240,104,40,.45);transform:translateY(-1px);}
.ze-bar-admin{background:#ede9fb;color:#4c38a8;border:1.5px solid rgba(76,56,168,.2);}
.ze-bar-admin:hover{background:#ddd6f7;}
.ze-backdrop{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(15,25,40,0);backdrop-filter:blur(0px);transition:background .28s ease,backdrop-filter .28s ease;padding:20px;}
.ze-backdrop-in{background:rgba(15,25,40,.5);backdrop-filter:blur(6px);}
.ze-backdrop-out{background:rgba(15,25,40,0);backdrop-filter:blur(0px);}
.ze-modal{background:rgba(255,255,255,.96);border-radius:20px;padding:28px 28px 24px;width:min(100%,420px);position:relative;box-shadow:0 32px 80px rgba(15,25,40,.18),0 0 0 1px rgba(22,69,102,.08);transform:translateY(16px) scale(.97);opacity:0;transition:transform .3s cubic-bezier(.34,1.3,.64,1),opacity .25s ease;max-height:90vh;overflow-y:auto;}
.ze-backdrop-in .ze-modal{transform:translateY(0) scale(1);opacity:1;}
.ze-backdrop-out .ze-modal{transform:translateY(12px) scale(.98);opacity:0;}
.ze-modal-wide{width:min(100%,680px);}
.ze-modal-x{position:absolute;top:16px;right:16px;width:28px;height:28px;border-radius:50%;background:rgba(22,69,102,.08);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#597286;transition:all .15s;}
.ze-modal-x:hover{background:rgba(22,69,102,.16);color:#16344b;}
.ze-auth-brand{display:flex;align-items:center;gap:10px;margin-bottom:20px;}
.ze-logo-mark{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#0d6efd,#1e8f62);color:#fff;font-size:18px;font-weight:800;display:flex;align-items:center;justify-content:center;}
.ze-logo-text{font-size:17px;font-weight:700;color:#16344b;}
.ze-logo-text em{color:#0d6efd;font-style:normal;}
.ze-tab-bar{display:flex;background:rgba(22,69,102,.06);border-radius:10px;padding:4px;margin-bottom:22px;position:relative;}
.ze-tab{flex:1;background:none;border:none;padding:9px;border-radius:7px;font-size:13.5px;font-weight:600;color:#597286;cursor:pointer;position:relative;z-index:1;transition:color .2s;}
.ze-tab-active{color:#16344b;}
.ze-tab-ink{position:absolute;top:4px;bottom:4px;background:#fff;border-radius:7px;box-shadow:0 2px 8px rgba(22,69,102,.12);transition:left .25s cubic-bezier(.34,1.2,.64,1);}
.ze-form{display:flex;flex-direction:column;gap:16px;}
.ze-field{display:flex;flex-direction:column;gap:6px;}
.ze-label{font-size:12.5px;font-weight:600;color:#16344b;letter-spacing:.2px;}
.ze-input-wrap{position:relative;}
.ze-input-icon{position:absolute;left:12px;top:50%;transform:translateY(-50%);width:16px;height:16px;color:#8aa4b8;pointer-events:none;}
.ze-input{width:100%;padding:11px 40px 11px 38px;border:1.5px solid rgba(22,69,102,.15);border-radius:10px;background:rgba(255,255,255,.9);color:#16344b;font-size:14px;outline:none;transition:border-color .18s,box-shadow .18s;}
.ze-input:focus{border-color:#0d6efd;box-shadow:0 0 0 4px rgba(13,110,253,.1);}
.ze-input::placeholder{color:#a8bece;}
.ze-eye-btn{position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;padding:4px;cursor:pointer;color:#8aa4b8;display:flex;align-items:center;border-radius:4px;}
.ze-eye-btn:hover{color:#16344b;}
.ze-pw-strength{height:3px;background:rgba(22,69,102,.08);border-radius:2px;margin-top:6px;overflow:hidden;}
.ze-pw-bar{height:100%;width:0;border-radius:2px;transition:width .3s,background .3s;}
.ze-pw-hint{font-size:11.5px;margin-top:3px;font-weight:600;}
.ze-err{color:#d94a43;font-size:12.5px;padding:8px 12px;background:rgba(217,74,67,.08);border-radius:8px;border-left:3px solid #d94a43;}
.ze-btn-main{width:100%;padding:13px;border-radius:11px;border:none;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all .2s;}
.ze-btn-login{background:#0d6efd;color:#fff;box-shadow:0 4px 14px rgba(13,110,253,.3);}
.ze-btn-login:hover:not(:disabled){background:#0a56cc;box-shadow:0 6px 20px rgba(13,110,253,.4);transform:translateY(-1px);}
.ze-btn-register{background:#1e8f62;color:#fff;box-shadow:0 4px 14px rgba(30,143,98,.3);}
.ze-btn-register:hover:not(:disabled){background:#166d4b;box-shadow:0 6px 20px rgba(30,143,98,.4);transform:translateY(-1px);}
.ze-btn-main:disabled{opacity:.65;cursor:not-allowed;transform:none!important;}
.ze-switch-hint{font-size:12.5px;color:#597286;text-align:center;}
.ze-link{background:none;border:none;color:#0d6efd;font-weight:600;cursor:pointer;font-size:inherit;padding:0;}
.ze-link:hover{text-decoration:underline;}
.ze-modal-footer{font-size:11.5px;color:#8aa4b8;text-align:center;margin-top:12px;border-top:1px solid rgba(22,69,102,.08);padding-top:12px;}
.ze-spin{width:16px;height:16px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:ze-rotate .7s linear infinite;}
@keyframes ze-rotate{to{transform:rotate(360deg);}}
.ze-hidden{display:none!important;}
.ze-upgrade-glow{position:absolute;top:-60px;right:-60px;width:200px;height:200px;background:radial-gradient(circle,rgba(245,166,35,.25),transparent 65%);pointer-events:none;border-radius:50%;}
.ze-upgrade-head{text-align:center;margin-bottom:22px;}
.ze-upgrade-crown{font-size:36px;margin-bottom:8px;}
.ze-upgrade-title{font-size:22px;font-weight:800;color:#16344b;margin:0 0 4px;}
.ze-upgrade-sub{font-size:13px;color:#597286;margin:0;}
.ze-pro-text{background:linear-gradient(90deg,#d48a12,#f06828);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.ze-feature-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;}
.ze-feature-item{border-radius:12px;padding:14px;}
.ze-feature-free{background:rgba(22,69,102,.04);border:1.5px solid rgba(22,69,102,.1);}
.ze-feature-pro{background:linear-gradient(135deg,rgba(245,166,35,.08),rgba(240,104,40,.06));border:1.5px solid rgba(245,166,35,.35);}
.ze-feature-label{font-size:12px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:6px;}
.ze-chip-free-sm{background:rgba(22,69,102,.08);color:#597286;font-size:10px;padding:2px 7px;border-radius:20px;}
.ze-chip-pro-sm{background:linear-gradient(90deg,#f5a623,#f06828);color:#fff;font-size:10px;padding:2px 7px;border-radius:20px;}
.ze-feat-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px;}
.ze-feat-list li{font-size:12px;display:flex;align-items:center;gap:6px;color:#597286;}
.ze-feat-list li.ok{color:#16344b;}
.ze-feat-list li.ok::before{content:"✓";color:#1e8f62;font-weight:700;flex-shrink:0;}
.ze-feat-list li.no{opacity:.45;}
.ze-feat-list li.no::before{content:"—";flex-shrink:0;}
.ze-feat-list li.ze-pro-ok{color:#b05e00;font-weight:600;}
.ze-feat-list li.ze-pro-ok::before{color:#d48a12;}
.ze-btn-pro-upgrade{background:linear-gradient(135deg,#f5a623,#f06828);color:#fff;box-shadow:0 6px 20px rgba(240,104,40,.35);}
.ze-btn-pro-upgrade:hover:not(:disabled){box-shadow:0 8px 28px rgba(240,104,40,.5);transform:translateY(-2px);}
.ze-upgrade-note{font-size:11.5px;color:#8aa4b8;text-align:center;margin-top:10px;}
.ze-admin-head{display:flex;align-items:center;gap:12px;margin-bottom:20px;}
.ze-admin-icon{font-size:28px;}
.ze-admin-title{font-size:18px;font-weight:800;color:#16344b;margin:0;}
.ze-admin-loading{text-align:center;padding:40px;color:#597286;}
.ze-loading-dots{display:flex;gap:6px;justify-content:center;margin-bottom:12px;}
.ze-loading-dots span{width:8px;height:8px;border-radius:50%;background:#0d6efd;animation:ze-bounce .9s ease-in-out infinite;}
.ze-loading-dots span:nth-child(2){animation-delay:.15s;}
.ze-loading-dots span:nth-child(3){animation-delay:.30s;}
@keyframes ze-bounce{0%,100%{transform:scale(.6);opacity:.4}50%{transform:scale(1);opacity:1}}
.ze-admin-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px;}
.ze-stat-card{background:rgba(22,69,102,.05);border-radius:10px;padding:12px;text-align:center;}
.ze-stat-num{display:block;font-size:24px;font-weight:800;color:#16344b;}
.ze-stat-lbl{font-size:11px;color:#8aa4b8;font-weight:600;}
.ze-admin-table-wrap{overflow-x:auto;border-radius:12px;border:1.5px solid rgba(22,69,102,.1);}
.ze-admin-tbl{width:100%;border-collapse:collapse;font-size:13px;}
.ze-admin-tbl th{padding:10px 14px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.4px;color:#8aa4b8;background:rgba(22,69,102,.04);border-bottom:1px solid rgba(22,69,102,.1);}
.ze-admin-tbl td{padding:11px 14px;border-bottom:1px solid rgba(22,69,102,.06);vertical-align:middle;}
.ze-admin-row:last-child td{border-bottom:none;}
.ze-admin-row:hover td{background:rgba(13,110,253,.03);}
.ze-user-cell{display:flex;align-items:center;gap:10px;}
.ze-avatar{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#0d6efd,#1e8f62);color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.ze-user-name{font-weight:600;font-size:13px;color:#16344b;}
.ze-user-email{font-size:11.5px;color:#8aa4b8;}
.ze-user-date{font-size:12px;color:#8aa4b8;white-space:nowrap;}
.ze-admin-sel{background:rgba(22,69,102,.06);border:1.5px solid rgba(22,69,102,.14);border-radius:7px;padding:5px 10px;font-size:12px;font-weight:600;color:#16344b;cursor:pointer;transition:border-color .15s;}
.ze-admin-sel:hover,.ze-admin-sel:focus{border-color:#0d6efd;outline:none;}
.ze-toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(20px);background:#16344b;color:#fff;border-radius:12px;padding:12px 20px;font-size:13.5px;font-weight:500;box-shadow:0 12px 32px rgba(22,52,75,.3);display:flex;align-items:center;gap:10px;opacity:0;transition:all .3s cubic-bezier(.34,1.2,.64,1);pointer-events:none;z-index:99999;max-width:90vw;}
.ze-toast-in{opacity:1;transform:translateX(-50%) translateY(0);}
.ze-toast-out{opacity:0;transform:translateX(-50%) translateY(12px);}
.ze-toast-icon{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0;}
.ze-toast-ok .ze-toast-icon{background:#1e8f62;}
.ze-toast-err .ze-toast-icon{background:#d94a43;}
`;
    document.head.appendChild(s);
  }
  function boot(){injectStyles();patchFetch();renderAuthBar();}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
  window.zeAuth={openAuthModal,openUpgradeModal,openAdminPanel,getUser,getToken,isLoggedIn};
})();

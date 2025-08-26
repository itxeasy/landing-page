
(function () {
  const LANG_LABELS = {
    vi:"Tiếng Việt", en:"English", ja:"日本語", ko:"한국어",
    "zh-CN":"中文(简体)", "zh-TW":"中文(繁體)", fr:"Français", de:"Deutsch",
    es:"Español", pt:"Português", it:"Italiano", nl:"Nederlands",
    ru:"Русский", ar:"العربية", hi:"हिन्दी", id:"Bahasa Indonesia",
    ms:"Bahasa Melayu", th:"ไทย", fil:"Filipino", tr:"Türkçe",
  };
  const INITIAL_LANGS = ["vi","en","ja","ko","zh-CN","zh-TW","fr","de","es","pt","it","nl","ru","ar","hi","id","ms","th","fil","tr"];
  const PERSIST_KEY = "gt_lang";

  const HTML_LANG = (document.documentElement.getAttribute("lang") || "en").toLowerCase();
  const PAGE_LANGUAGE = HTML_LANG.includes("zh") ? (HTML_LANG.includes("tw") ? "zh-TW" : "zh-CN") : HTML_LANG;

  function injectCssOnce() {
    if (document.querySelector('style[data-itx-gt]')) return;
    const css = `
      .goog-te-banner-frame,
      .goog-te-banner,
      iframe.skiptranslate,
      iframe[src*="translate.google"],
      iframe[src*="translate.googleapis"]{
        display:none!important;visibility:hidden!important;opacity:0!important;height:0!important;width:0!important;border:0!important;
      }
      #google_translate_element{
        position:fixed!important;left:-9999px!important;top:-9999px!important;
        opacity:0!important;pointer-events:none!important;width:0!important;height:0!important;overflow:hidden!important;
      }
      html,body,html.translated-ltr body,html.translated-rtl body{top:0!important;position:static!important;}
      #goog-gt-tt,.goog-tooltip,.goog-te-balloon-frame{display:none!important;visibility:hidden!important;opacity:0!important;}

      /* ===== Switcher UI ===== */
      #itx-lang-switcher{position:fixed;right:2rem;bottom:5rem;z-index:9999;}
      #itx-lang-switcher .itx-btn{
        height:56px;width:56px;border-radius:9999px;background:#fff;backdrop-filter:saturate(1.2) blur(2px);
        border:1px solid rgba(0,0,0,.1);box-shadow:0 8px 24px rgba(0,0,0,.15);
        display:flex;align-items:center;justify-content:center;cursor:pointer;
        transition:transform .2s ease, box-shadow .2s ease, opacity .2s ease;
      }
      #itx-lang-switcher .itx-btn:hover{
        transform:translateY(-4px) scale(1.03);
        box-shadow:0 14px 32px rgba(0,0,0,.22);
      }
      #itx-lang-switcher .itx-btn-inner{height:50px;width:50px;border-radius:9999px;display:flex;align-items:center;justify-content:center;}

      #itx-lang-switcher .itx-menu{
        position:absolute;right:0;bottom:56px;width:208px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;
        box-shadow:0 16px 48px rgba(0,0,0,.16);overflow:hidden;display:none;
      }
      #itx-lang-switcher .itx-menu.open{display:block;}
      #itx-lang-switcher .itx-item{padding:8px 12px;font-size:14px;text-align:left;width:100%;background:#fff;border:0;cursor:pointer;}
      #itx-lang-switcher .itx-item:hover{background:#f5f5f5;}
      #itx-lang-switcher .itx-item.active{background:#f3f4f6;font-weight:600;}

      /* Busy state + spinner */
      #itx-lang-switcher .itx-btn[aria-busy="true"]{
        pointer-events:none;opacity:.85;transform:translateY(0) scale(1);
        box-shadow:0 8px 24px rgba(0,0,0,.12);
      }
      #itx-lang-switcher .itx-busy{
        position:absolute;right:0;bottom:56px;transform:translateY(8px);
        background:#111827;color:#fff;font-size:12px;padding:6px 10px;
        border-radius:8px;box-shadow:0 10px 24px rgba(0,0,0,.18);
        display:none;align-items:center;gap:8px;white-space:nowrap;
      }
      #itx-lang-switcher .itx-busy.open{display:flex;}
      #itx-lang-switcher .itx-spinner{
        width:16px;height:16px;border-radius:9999px;border:2px solid rgba(255,255,255,.25);
        border-top-color:#fff;animation:itx-spin .9s linear infinite;
      }
      @keyframes itx-spin{to{transform:rotate(360deg);}}
    `;
    const style = document.createElement('style');
    style.setAttribute('data-itx-gt','1');
    style.textContent = css;
    document.head.appendChild(style);
  }

  function hideGoogleBars(){
    try{
      document.querySelectorAll('iframe.goog-te-banner-frame,.goog-te-banner,.goog-te-balloon-frame').forEach(el=>el.remove());
      document.querySelectorAll('iframe').forEach(f=>{
        const src=f.getAttribute('src')||'';
        if(src.includes('translate.google')||src.includes('translate.googleapis')){
          f.style.setProperty('display','none','important');
          f.style.setProperty('visibility','hidden','important');
          f.style.setProperty('opacity','0','important');
        }
      });
      const tt=document.getElementById('goog-gt-tt'); if(tt) tt.remove();
      document.documentElement.style.top='0px'; document.body.style.top='0px';
    }catch{}
  }

  function setGoogTransCookie(source, target){
    const v = `/${source || 'auto'}/${target}`;
    const cookie = `googtrans=${v}`;
    document.cookie = `${cookie}; path=/`;
    const host = location.hostname.replace(/^www\./,'');
    const isLocal = host === '' || host === 'localhost' || host === '127.0.0.1';
    if(!isLocal){
      document.cookie = `${cookie}; domain=.${host}; path=/`;
    }
  }

  function readGoogTransCookie(){
    const m = document.cookie.match(/(?:^|;)\s*googtrans=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  function isTranslatedTo(code){
    const ck = readGoogTransCookie();
    if(!ck || !ck.endsWith(`/${code}`)) return false;
    const html = document.documentElement;
    const okClass = html.classList.contains('translated-ltr') || html.classList.contains('translated-rtl');
    const combo = document.querySelector('.goog-te-combo');
    const okCombo = combo ? combo.value === code : true;
    return okClass && okCombo;
  }

  function waitCombo(maxMs=2000, step=100){
    const t0=Date.now();
    return new Promise(res=>{
      const it=setInterval(()=>{
        const combo=document.querySelector('.goog-te-combo');
        if(combo){ clearInterval(it); res(combo); return; }
        if(Date.now()-t0>maxMs){ clearInterval(it); res(null); }
      }, step);
    });
  }

  let ui = { wrap:null, btn:null, menu:null, list:null, busy:null };

  function setBusy(on){
    if(!ui.btn || !ui.busy) return;
    ui.btn.setAttribute('aria-busy', on ? 'true' : 'false');
    if(on){ ui.busy.classList.add('open'); }
    else{ ui.busy.classList.remove('open'); }
    ui.wrap.querySelectorAll('.itx-item').forEach(el=> el.disabled = !!on);
  }

  function closeMenu(){
    if(ui.menu) ui.menu.classList.remove('open');
  }

  function ensureMountAndUI(){
    if(!document.getElementById('google_translate_element')){
      const mount = document.createElement('div');
      mount.id = 'google_translate_element';
      mount.setAttribute('aria-hidden','true');
      document.body.appendChild(mount);
    }

    if(!document.getElementById('itx-lang-switcher')){
      const wrap = document.createElement('div');
      wrap.id = 'itx-lang-switcher';

      wrap.innerHTML = `
        <button id="itx-lang-btn" type="button" class="itx-btn" aria-label="Language" aria-busy="false">
          <div class="itx-btn-inner">
            <img src="./public/switch-language.jpg" alt="Language" style="height:40px;width:40px;object-fit:contain;pointer-events:none;" draggable="false">
          </div>
        </button>

        <div id="itx-lang-menu" class="itx-menu">
          <ul id="itx-lang-list" style="max-height:256px;overflow:auto;margin:0;padding:0;list-style:none;"></ul>
        </div>

        <div id="itx-busy" class="itx-busy" role="status" aria-live="polite">
          <div class="itx-spinner"></div>
          <span>Applying translation…</span>
        </div>
      `;
      document.body.appendChild(wrap);

      ui.wrap = wrap;
      ui.btn  = wrap.querySelector('#itx-lang-btn');
      ui.menu = wrap.querySelector('#itx-lang-menu');
      ui.list = wrap.querySelector('#itx-lang-list');
      ui.busy = wrap.querySelector('#itx-busy');

      const current = localStorage.getItem(PERSIST_KEY) || PAGE_LANGUAGE;
      ui.list.innerHTML = '';
      INITIAL_LANGS.forEach(code=>{
        const li  = document.createElement('li');
        const btn = document.createElement('button');
        btn.type='button';
        btn.className = 'itx-item' + (code===current?' active':'');
        btn.textContent = LANG_LABELS[code] || code;
        btn.onclick = () => applyLanguage(code);
        li.appendChild(btn);
        ui.list.appendChild(li);
      });

      ui.btn.addEventListener('click', (e)=>{ e.stopPropagation(); ui.menu.classList.toggle('open'); });
      document.addEventListener('mousedown', (e)=>{ if(!ui.wrap.contains(e.target)) closeMenu(); });
      document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeMenu(); });
    }
  }

  async function applyLanguage(code){
    try{
      setBusy(true);
      localStorage.setItem(PERSIST_KEY, code);
      setGoogTransCookie('auto', code);
      setGoogTransCookie(PAGE_LANGUAGE, code);

      const combo = await waitCombo();
      if(combo){
        combo.value = code;
        combo.dispatchEvent(new Event('change', {bubbles:true}));
      }else{
        location.reload();
        return;
      }

      const t0 = Date.now();
      while(Date.now() - t0 < 6000){
        hideGoogleBars();
        if(isTranslatedTo(code)) break;
        await new Promise(r=> setTimeout(r, 50));
      }
    } finally {
      setTimeout(()=> setBusy(false), 200);
      closeMenu();
      setTimeout(hideGoogleBars,0);
      setTimeout(hideGoogleBars,250);
      setTimeout(hideGoogleBars,600);
    }
  }

  window.__itxGtInit = function(){
    try{
      new google.translate.TranslateElement({
        pageLanguage: PAGE_LANGUAGE,
        includedLanguages: INITIAL_LANGS.join(','),
        layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
        autoDisplay: false
      }, 'google_translate_element');
    }catch(e){ console.error(e); }
    setTimeout(hideGoogleBars,0);
    setTimeout(hideGoogleBars,250);
    setTimeout(hideGoogleBars,600);
  };

  function loadGoogle(){
    if (document.querySelector('script[src*="translate_a/element.js"]')) return;
    const s=document.createElement('script');
    s.src='https://translate.google.com/translate_a/element.js?cb=__itxGtInit';
    s.async=true;
    document.head.appendChild(s);
  }


  injectCssOnce();
  ensureMountAndUI();
  loadGoogle();

  const mo = new MutationObserver(()=> hideGoogleBars());
  mo.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('beforeunload', ()=> mo.disconnect());
})();


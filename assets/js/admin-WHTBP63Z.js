import{a as b,b as X}from"./chunks/chunk-EOBQY3KP.js";import{b as Q}from"./chunks/chunk-QNKYQI5P.js";var C="Europe/Paris",N="rdv.token",ne=new URLSearchParams(location.search),z=!b.endpoint||/^(localhost|127\.0\.0\.1)$/.test(location.hostname)&&!ne.has("live"),x=z?await import("./chunks/admin-demo-GFZXQ2WG.js"):null,fe=x?x.createDemoApi(b):null,be=x?x.DEMO_CODE:"",B=Q(b),F=14,se=matchMedia("(min-width: 900px)"),he="https://script.google.com/home/projects/1qEcGYbnnE8en4CDx1dtDnOnCQFtRSflIw9bqGJ1VLoIBwltZ68pduh6T/settings",D=document.getElementById("app"),L=document.getElementById("toast"),t={token:z&&ne.has("entrer")?"demo-token":ve(N),items:[],autoConfirm:!1,bookingTimes:b.bookingTimes.slice(),hoursDraft:null,tab:"todo",open:null,sub:null,planDay:"",days:{},form:null,loaded:!1,busy:!1,error:"",updatedAt:null,pushed:0,listScroll:0};function ve(e){try{return localStorage.getItem(e)||""}catch{return""}}function ae(e,n){try{n?localStorage.setItem(e,n):localStorage.removeItem(e)}catch{}}var l=e=>String(e??"").replace(/[&<>"']/g,n=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[n]),v=e=>`<svg class="ic" aria-hidden="true"><use href="#${e}"/></svg>`,U=e=>e.charAt(0).toUpperCase()+e.slice(1),A=(e,n,s)=>`${e} ${e>1?s:n}`,Z=new Intl.DateTimeFormat("fr-FR",{timeZone:C,weekday:"long",day:"numeric",month:"long"}),ge=new Intl.DateTimeFormat("fr-FR",{timeZone:C,weekday:"short",day:"numeric"}),$e=new Intl.DateTimeFormat("fr-FR",{timeZone:C,weekday:"short"}),we=new Intl.DateTimeFormat("fr-FR",{timeZone:C,day:"numeric"}),ye=new Intl.DateTimeFormat("fr-FR",{timeZone:C,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}),_e=new Intl.DateTimeFormat("en-CA",{timeZone:C,year:"numeric",month:"2-digit",day:"2-digit"});function p(e){return _e.format(e)}t.planDay=p(new Date);var I=e=>{let[n,s,a]=e.split("-").map(Number);return new Date(Date.UTC(n,s-1,a,12))},k=(e,n)=>p(new Date(I(e).getTime()+n*864e5)),V=e=>ye.format(e),$=e=>{let[n,s]=e.split(":");return`${Number(n)} h ${s}`},w=e=>$(V(e)),oe=(e,n)=>{let[s,a]=e.split(":").map(Number),r=s*60+a+n;return`${String(Math.floor(r/60)).padStart(2,"0")}:${String(r%60).padStart(2,"0")}`};function m(e,n=!0){let s=p(new Date);return e===s?"Aujourd\u2019hui":e===k(s,1)?"Demain":e===k(s,-1)?"Hier":U((n?Z:ge).format(I(e)))}var H=e=>U(Z.format(I(e))),De=e=>`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([e.address,e.commune==="Autre commune"?"":e.commune,"Loz\xE8re"].filter(Boolean).join(", "))}`,ie=e=>`tel:${String(e).replace(/[^\d+]/g,"")}`,P=e=>e.commune&&e.commune!=="Autre commune"?e.commune:"Autre commune";function f(e,n=!1){L.textContent=e,L.classList.toggle("toast--error",n),L.hidden=!1,clearTimeout(f.timer),f.timer=setTimeout(()=>L.hidden=!0,n?7e3:5e3)}async function E(e,n={}){let s={action:e,token:t.token,...n};return z?fe(e,s):X(b.endpoint,{body:s,timeout:15e3})}var T=["En attente","Horaire propos\xE9","Confirm\xE9"],_=e=>e.appointment?p(new Date(e.appointment)):null,S=e=>e.appointment&&new Date(e.appointment).getTime()+(e.minutes||30)*6e4>Date.now();function re(){let e=(u,d)=>new Date(u.appointment)-new Date(d.appointment),n=u=>new Date(u.appointment||(u.wishDate?`${u.wishDate}T12:00:00`:u.received)),s=t.items.filter(u=>u.status==="En attente"&&u.appointment).sort(e),a=t.items.filter(u=>u.status==="En attente"&&!u.appointment).sort((u,d)=>n(u)-n(d)),r=t.items.filter(u=>u.status==="Horaire propos\xE9"&&S(u)).sort(e),o=t.items.filter(u=>T.includes(u.status)&&u.appointment&&S(u)),i=t.items.filter(u=>u.status!=="En attente"&&!(T.includes(u.status)&&S(u))).sort((u,d)=>n(d)-n(u));return{toConfirm:s,toCall:a,waiting:r,upcoming:o,history:i,todo:s.length+a.length}}var ke={"En attente":{label:"\xC0 confirmer",kind:"warn"},"Horaire propos\xE9":{label:"Attend le patient",kind:"info"},Confirm\u00E9:{label:"Confirm\xE9",kind:"ok"},Refus\u00E9:{label:"Refus\xE9",kind:"off"},"Refus\xE9 par le patient":{label:"Refus\xE9 par le patient",kind:"off"},Annul\u00E9:{label:"Annul\xE9",kind:"off"}};function J(e){return e.status==="En attente"&&!e.appointment?{label:"\xC0 rappeler",kind:"warn"}:e.status==="Confirm\xE9"&&!S(e)?{label:"Pass\xE9",kind:"off"}:ke[e.status]||{label:e.status,kind:"off"}}var Y=e=>`<span class="pill pill--${e.kind}">${l(e.label)}</span>`,G=[{id:"todo",label:"Demandes",title:"Demandes",icon:"i-inbox"},{id:"plan",label:"Planning",title:"Planning",icon:"i-cal"},{id:"history",label:"Historique",title:"Historique",icon:"i-history"},{id:"settings",label:"R\xE9glages",title:"R\xE9glages",icon:"i-sliders"}];function c(){if(!t.token)return j();let e=re(),n=G.find(o=>o.id===t.tab);t.open&&t.loaded&&!t.items.some(o=>o.id===t.open)&&(t.open=null),!t.open&&t.loaded&&se.matches&&(t.open=Ce(e));let s=t.open&&t.items.find(o=>o.id===t.open),a=t.tab==="settings",r=t.anim;t.anim=null,document.body.classList.toggle("is-open",!!t.open),D.innerHTML=`
    <div class="shell${t.open?" is-open":""}${t.sub?" has-sub":""}${a?" is-solo":""}">
      <header class="bar">
        <div class="bar__in">
          <svg class="bar__logo" aria-hidden="true"><use href="#logo"/></svg>
          <div class="bar__title">
            <p class="bar__app">Mes rendez-vous</p>
            <h1>${n.title}</h1>
          </div>
          <nav class="tabbar" aria-label="Sections">
            ${G.map(o=>`<button type="button" class="tabbar__btn" data-tab="${o.id}"${o.id===t.tab?' aria-current="page"':""}>${v(o.icon)}<span>${o.label}</span>${o.id==="todo"&&e.todo?`<b class="tabbar__count" aria-label="${A(e.todo,"demande","demandes")}">${e.todo}</b>`:""}</button>`).join("")}
          </nav>
          <button type="button" class="iconbtn" data-action="refresh" aria-label="Actualiser"${t.busy?" disabled":""}>${v("i-refresh")}</button>
        </div>
      </header>
      <div class="panes">
        <section class="pane pane--list${r==="list"?" is-entering":""}" aria-label="${n.title}">
          ${z?'<p class="demo">D\xE9monstration avec de fausses donn\xE9es. Rien n\u2019est envoy\xE9 aux patients.</p>':""}
          ${Se(e)}
        </section>
        ${a?"":`<section class="pane pane--detail${r==="detail"?" is-entering":""}" aria-label="Fiche">${s?Me(s):Oe()}</section>`}
      </div>
    </div>`,t.tab==="plan"&&te(t.planDay),t.sub==="propose"&&t.form&&te(t.form.date,!0)}function Ce(e){return t.tab==="todo"?(e.toConfirm[0]||e.toCall[0]||e.waiting[0]||{}).id||null:t.tab==="history"?(e.history[0]||{}).id||null:t.tab==="plan"&&(t.items.filter(s=>s.appointment&&_(s)===t.planDay&&T.includes(s.status)).sort((s,a)=>new Date(s.appointment)-new Date(a.appointment))[0]||{}).id||null}function Ee(){return t.updatedAt?`<p class="stamp">\xC0 jour \xE0 ${w(t.updatedAt)}</p>`:""}function Se(e){return t.loaded?t.error&&!t.items.length?le():t.tab==="todo"?ze(e):t.tab==="plan"?Ae(e):t.tab==="history"?je(e):Ie():Te()}function Te(){return`<p class="lead"><span class="skel skel--lead"></span></p><div class="list">${'<div class="row row--skel"><span class="skel skel--name"></span><span class="skel skel--line"></span></div>'.repeat(3)}</div>`}function le(){return`<div class="notice notice--error"><p>${l(t.error)}</p><button type="button" class="textbtn" data-action="refresh">R\xE9essayer</button></div>`}function ze(e){return`
    <p class="lead">${e.todo?`${A(e.todo,"demande attend","demandes attendent")} votre r\xE9ponse.${e.toConfirm[0]?` La plus proche : ${m(_(e.toConfirm[0])).toLowerCase()} \xE0 ${w(new Date(e.toConfirm[0].appointment))}.`:""}`:"Aucune demande \xE0 traiter. Les nouvelles demandes du site arrivent ici."}</p>
    ${t.autoConfirm?'<p class="note">Confirmation automatique activ\xE9e : les cr\xE9neaux r\xE9serv\xE9s en ligne sont confirm\xE9s tout seuls.</p>':""}
    ${t.error?le():""}
    ${q("Cr\xE9neaux \xE0 confirmer",e.toConfirm,"Aucun cr\xE9neau \xE0 confirmer.")}
    ${q("Patients \xE0 rappeler",e.toCall,"Aucune demande de rappel.")}
    ${e.waiting.length?q("En attente de la r\xE9ponse du patient",e.waiting):""}
    ${Ee()}`}function q(e,n,s=""){return`<div class="group">
    <h2 class="group__title">${e}<span class="num">${n.length}</span></h2>
    ${n.length?`<div class="list">${n.map(ue).join("")}</div>`:`<p class="empty">${s}</p>`}
  </div>`}function ue(e){let n=J(e),s=e.status==="En attente",a;if(e.appointment){let r=new Date(e.appointment);a=`${m(p(r),!1)} \xB7 ${w(r)}`}else a=e.wishDate?`Souhait : ${m(e.wishDate,!1).toLowerCase()}${e.moment&&e.moment!=="Peu importe"?`, ${l(e.moment.toLowerCase())}`:""}`:"Sans date";return`<button type="button" class="row${t.open===e.id?" is-selected":""}" data-open="${l(e.id)}">
    <span class="row__dot${s?" row__dot--on":""}" aria-hidden="true"></span>
    <span class="row__main">
      <span class="row__l1"><span class="row__name">${l(e.name)}</span><span class="row__when num">${a}</span></span>
      <span class="row__l2"><span class="row__what">${l(e.care)} \xB7 ${l(P(e))}</span>${t.tab==="history"?Y(n):""}</span>
    </span>
    ${v("i-next")}
  </button>`}function ce(e,n,s={}){let a=p(new Date),r="";for(let o=0;o<F;o++){let i=k(a,o),u=I(i),d=o===0?"auj.":o===1?"dem.":$e.format(u).replace(".",""),h=s[i]||0;r+=`<button type="button" class="day${i===e?" is-on":""}" data-${n}="${i}" aria-pressed="${i===e}" aria-label="${l(H(i))}${h?`, ${A(h,"rendez-vous","rendez-vous")}`:""}">
      <span class="day__wd">${d}</span><span class="day__n num">${we.format(u)}</span><span class="day__c">${h?`<i style="--n:${Math.min(h,4)}"></i>`:""}</span>
    </button>`}return`<div class="days" role="group" aria-label="Jour">${r}</div>`}function Ae(e){let n=t.planDay,s={};for(let i of e.upcoming)s[_(i)]=(s[_(i)]||0)+1;let a=t.items.filter(i=>i.appointment&&_(i)===n&&T.includes(i.status)).sort((i,u)=>new Date(i.appointment)-new Date(u.appointment)),r=t.days[n],o=r?r.free.length:null;return`
    ${ce(n,"plan-day",s)}
    <div class="daycard">
      <div class="daycard__head">
        <h2>${l(m(n))}</h2>
        <p class="daycard__fig"><span class="num">${o===null?"\u2013":o}</span> ${o===1?"cr\xE9neau libre":"cr\xE9neaux libres"}</p>
      </div>
      ${Le(n,a,r)}
    </div>
    <div class="group">
      <h2 class="group__title">Rendez-vous du site<span class="num">${a.length}</span></h2>
      ${a.length?`<div class="list">${a.map(xe).join("")}</div>`:'<p class="empty">Aucun rendez-vous pris sur le site ce jour-l\xE0.</p>'}
    </div>
    <p class="note">Le planning montre les rendez-vous du site. Vos autres rendez-vous de l\u2019agenda apparaissent en gris dans la journ\xE9e.</p>`}function Le(e,n,s){let a=new Date,r=s?new Set(s.free):null,o={};for(let d of n){let h=V(new Date(d.appointment)),y=Math.max(1,Math.ceil((d.minutes||30)/b.step));for(let O=0;O<y;O++)o[oe(h,O*b.step)]=d.status==="Confirm\xE9"?"site":"wait"}let i=B.map(d=>{let h=new Date(`${e}T${d}:00`),y="free";return o[d]?y=o[d]:h<a?y="past":r?r.has(d)||(y="busy"):y="unknown",`<span class="cell cell--${y}" title="${$(d)}"></span>`}).join(""),u=[7,10,13,16,19].map(d=>`<span style="left:${(d-7)/12*100}%">${d} h</span>`).join("");return`<div class="tl" role="img" aria-label="Journ\xE9e de 7 h \xE0 19 h">
      <div class="tl__cells">${i}</div>
      <div class="tl__ticks">${u}</div>
    </div>
    <ul class="legend">
      <li><span class="cell cell--site"></span>Confirm\xE9</li>
      <li><span class="cell cell--wait"></span>\xC0 confirmer</li>
      <li><span class="cell cell--busy"></span>Agenda</li>
      <li><span class="cell cell--free"></span>Libre</li>
    </ul>`}function xe(e){let n=new Date(e.appointment),s=J(e);return`<button type="button" class="row row--visit${t.open===e.id?" is-selected":""}" data-open="${l(e.id)}">
    <span class="row__time num">${w(n)}</span>
    <span class="row__main">
      <span class="row__l1"><span class="row__name">${l(e.name)}</span>${e.status==="Confirm\xE9"?"":Y(s)}</span>
      <span class="row__l2"><span class="row__what">${l(e.care)} \xB7 ${l(P(e))}</span></span>
    </span>
    ${v("i-next")}
  </button>`}function je(e){return`
    <p class="lead">Les demandes pass\xE9es, refus\xE9es ou annul\xE9es. Elles sont effac\xE9es 3 mois apr\xE8s le rendez-vous.</p>
    ${e.history.length?`<div class="list">${e.history.map(ue).join("")}</div>`:'<p class="empty">Rien pour l\u2019instant.</p>'}`}function Ie(){let e=matchMedia("(display-mode: standalone)").matches||navigator.standalone,n=/iPhone|iPad|iPod/.test(navigator.userAgent);return`
    <div class="setgroup">
      <h2 class="group__title">Confirmation</h2>
      <div class="setrow">
        <div>
          <p class="setrow__title" id="auto-label">Confirmer automatiquement</p>
          <p class="setrow__hint">${t.autoConfirm?"Activ\xE9. Les cr\xE9neaux choisis en ligne sont confirm\xE9s tout de suite : le patient re\xE7oit sa confirmation, vous recevez un e-mail. Vous pouvez toujours d\xE9placer ou annuler.":"D\xE9sactiv\xE9. Chaque cr\xE9neau choisi en ligne attend que vous le confirmiez."}</p>
        </div>
        <button type="button" class="switch" role="switch" aria-checked="${t.autoConfirm}" aria-labelledby="auto-label" data-action="auto"><span></span></button>
      </div>
      <p class="setgroup__foot">Les demandes de rappel (autres soins, autres communes) restent toujours \xE0 traiter vous-m\xEAme.</p>
    </div>
    ${Pe()}
    ${e?"":`<div class="setgroup">
      <h2 class="group__title">Sur l\u2019\xE9cran d\u2019accueil</h2>
      <div class="setrow setrow--text">
        <p>${n?"Dans Safari, touchez <b>Partager</b> (le carr\xE9 avec une fl\xE8che), puis <b>Sur l\u2019\xE9cran d\u2019accueil</b>.":"Dans Chrome, touchez le menu <b>\u22EE</b>, puis <b>Ajouter \xE0 l\u2019\xE9cran d\u2019accueil</b>."} L\u2019ic\xF4ne ouvre ensuite cette page comme une application.</p>
      </div>
    </div>`}
    <div class="setgroup">
      <h2 class="group__title">Si cette page ne r\xE9pond pas</h2>
      <div class="setrow setrow--text">
        <p>Chaque e-mail de nouvelle demande contient aussi un lien de secours, qui ouvre la page de gestion Google comme avant. Les deux marchent en m\xEAme temps.</p>
      </div>
    </div>
    <div class="setgroup">
      <h2 class="group__title">Ce t\xE9l\xE9phone</h2>
      <div class="setrow setrow--text">
        <p>Ce t\xE9l\xE9phone reste connect\xE9. En cas de perte, changez le code dans le script Google : tous les t\xE9l\xE9phones seront d\xE9connect\xE9s.</p>
        <ol class="steps">
          <li>Ouvrez les <a href="${he}" target="_blank" rel="noopener">r\xE9glages du script Google</a>, connect\xE9e \xE0 votre compte Google.</li>
          <li>Descendez jusqu\u2019\xE0 <b>Propri\xE9t\xE9s du script</b>, puis touchez <b>Modifier les propri\xE9t\xE9s du script</b>.</li>
          <li>Sur la ligne <b>CODE_GESTION</b>, remplacez la valeur par le nouveau code, puis <b>Enregistrer les propri\xE9t\xE9s du script</b>.</li>
        </ol>
        <p class="setrow__hint">Le code n\u2019est pas \xE9crit dans le programme lui-m\xEAme (pas de num\xE9ro de ligne \xE0 chercher) : il est seulement dans ces propri\xE9t\xE9s. Pas besoin de red\xE9ployer.</p>
        <button type="button" class="textbtn textbtn--danger" data-action="logout">Se d\xE9connecter de ce t\xE9l\xE9phone</button>
      </div>
    </div>`}function Pe(){let e=t.bookingTimes,n=t.hoursDraft||e,s=t.hoursDraft&&t.hoursDraft.join()!==e.join();return`
    <div class="setgroup">
      <h2 class="group__title" id="hours-label">Heures r\xE9servables en ligne</h2>
      <div class="setrow setrow--text">
        <p class="setrow__hint">Du lundi au vendredi. Touchez une heure pour l\u2019ajouter ou la retirer, puis enregistrez. Une heure d\xE9j\xE0 prise dans votre agenda n\u2019est jamais propos\xE9e.</p>
        <div class="slots hours" role="group" aria-labelledby="hours-label">
          ${B.map(a=>`<button type="button" class="slot num" data-hour="${a}" aria-pressed="${n.includes(a)}">${$(a)}</button>`).join("")}
        </div>
        <p class="hours__sum">${n.length?`${A(n.length,"heure propos\xE9e","heures propos\xE9es")} aux patients.`:"Aucune heure : les patients ne pourront plus choisir de cr\xE9neau en ligne. Les demandes de rappel restent possibles."}</p>
        ${s?`<div class="actions__row hours__actions">
          <button type="button" class="btn btn--primary" data-action="save-hours">Enregistrer</button>
          <button type="button" class="btn" data-action="reset-hours">Annuler</button>
        </div>`:""}
      </div>
    </div>`}async function Re(e){let n=t.hoursDraft;if(n){e.disabled=!0,e.textContent="Envoi\u2026";try{let s=await E("admin.settings",{bookingTimes:n});if(!s.ok){if(s.error==="auth")return R("Session expir\xE9e : entrez \xE0 nouveau votre code.");throw new Error}if(!Array.isArray(s.bookingTimes))throw new Error("script");t.bookingTimes=s.bookingTimes,t.hoursDraft=null,f(s.bookingTimes.length?`Enregistr\xE9 : le site propose maintenant ${s.bookingTimes.map($).join(", ")}.`:"Enregistr\xE9 : plus aucune heure propos\xE9e en ligne.")}catch{f("Les heures n\u2019ont pas pu \xEAtre enregistr\xE9es. R\xE9essayez.",!0)}c()}}function Oe(){return'<div class="placeholder"><svg class="placeholder__logo" aria-hidden="true"><use href="#logo"/></svg><p>Choisissez une demande ou un rendez-vous pour voir la fiche.</p></div>'}function qe(){return t.sub?"Fiche":G.find(e=>e.id===t.tab).label}function Me(e){let n=`<div class="dhead">
      <button type="button" class="back" data-action="back">${v("i-back")}<span>${qe()}</span></button>
    </div>`;if(t.sub==="propose")return n+He(e);if(t.sub==="refuse"||t.sub==="cancel")return n+Ge(e);let s=J(e),a;if(e.appointment){let o=new Date(e.appointment),i=V(o);a=`<p class="when__day">${l(m(p(o)))}${m(p(o))!==H(p(o))?`, ${l(Z.format(o))}`:""}</p>
      <p class="when__time num">${$(i)} \u2013 ${$(oe(i,e.minutes||30))}</p>`}else a=`<p class="when__day">Souhait du patient</p>
      <p class="when__time">${e.wishDate?l(H(e.wishDate)):"Pas de date"}${e.moment&&e.moment!=="Peu importe"?`, ${l(e.moment.toLowerCase())}`:""}</p>`;let r=e.received?new Date(e.received):null;return`${n}
    <article class="fiche" id="r-${l(e.id)}">
      <div class="fiche__top">${Y(s)}<span class="fiche__care">${l(e.care)}</span></div>
      <h2 class="fiche__name">${l(e.name)}</h2>
      <div class="when">${a}</div>
      <div class="contact">
        <a class="cbtn" href="${ie(e.phone)}">${v("i-phone")}<span>Appeler</span></a>
        <a class="cbtn" href="${De(e)}" target="_blank" rel="noopener">${v("i-pin")}<span>Itin\xE9raire</span></a>
        ${e.email?`<a class="cbtn" href="mailto:${l(e.email)}">${v("i-mail")}<span>E-mail</span></a>`:""}
      </div>
      <dl class="kv">
        <div><dt>Adresse</dt><dd>${l(e.address)}<br>${l(P(e))}</dd></div>
        <div><dt>T\xE9l\xE9phone</dt><dd class="num">${l(e.phone)}</dd></div>
        <div><dt>E-mail</dt><dd>${e.email?l(e.email):'<span class="dash">Pas d\u2019e-mail : pr\xE9venez-le par t\xE9l\xE9phone</span>'}</dd></div>
        ${r?`<div><dt>Demande re\xE7ue</dt><dd>${l(m(p(r)))} \xE0 ${w(r)}</dd></div>`:""}
      </dl>
      ${e.access?`<div class="memo"><h3>Indications pour venir</h3><p>${l(e.access)}</p></div>`:""}
      ${e.message?`<div class="memo"><h3>Pr\xE9cisions du patient</h3><p>${l(e.message)}</p></div>`:""}
      ${e.status==="Horaire propos\xE9"?'<p class="note">Le patient a re\xE7u votre proposition par e-mail. Il peut l\u2019accepter ou la refuser.</p>':""}
    </article>
    ${Fe(e)}`}function Fe(e){let n=l(e.id);return e.status==="En attente"&&e.appointment?`<div class="actions">
      <button type="button" class="btn btn--primary" data-action="valider" data-id="${n}">Confirmer ${l(w(new Date(e.appointment)))}</button>
      <div class="actions__row">
        <button type="button" class="btn" data-action="sub" data-sub="propose">Autre horaire</button>
        <button type="button" class="btn" data-action="sub" data-sub="refuse">Refuser</button>
      </div>
    </div>`:e.status==="En attente"?`<div class="actions">
      <button type="button" class="btn btn--primary" data-action="sub" data-sub="propose">Fixer un horaire</button>
      <div class="actions__row">
        <a class="btn" href="${ie(e.phone)}">Appeler d\u2019abord</a>
        <button type="button" class="btn" data-action="sub" data-sub="refuse">Refuser</button>
      </div>
    </div>`:T.includes(e.status)&&S(e)?`<div class="actions">
      <div class="actions__row">
        <button type="button" class="btn" data-action="sub" data-sub="propose">D\xE9placer</button>
        <button type="button" class="btn" data-action="sub" data-sub="cancel">Annuler</button>
      </div>
    </div>`:""}function W(e,n){if(n!=="propose")return{kind:n,message:""};let s=p(new Date),a=e.appointment?p(new Date(e.appointment)):e.wishDate||k(s,1);return a<s&&(a=s),a>k(s,F-1)&&(a=k(s,F-1)),{kind:n,date:a,minutes:e.minutes||30,time:"",agreed:e.status==="Confirm\xE9"||!e.email,message:""}}function He(e){let n=t.form,s=t.days[`${n.date}|${n.minutes}|${e.eventId||""}`],a=e.status==="Confirm\xE9"||e.status==="Horaire propos\xE9",r='<p class="hint">Chargement des horaires libres\u2026</p>';s&&s.error?r='<p class="hint">Impossible de charger les horaires. Tapez une heure ci-dessous.</p>':s&&(r=s.free.length?`<div class="slots">${s.free.map(i=>`<button type="button" class="slot num" data-time="${i}" aria-pressed="${i===n.time}">${$(i)}</button>`).join("")}</div>`:'<p class="hint">Aucun horaire libre ce jour-l\xE0. Choisissez un autre jour ou tapez une heure.</p>');let o=n.time?`${n.agreed?a?"D\xE9placer \xE0":"Confirmer":"Proposer"} ${m(n.date,!1).toLowerCase()} \xE0 ${$(n.time)}`:"Choisissez un horaire";return`<div class="form">
      <h2 class="form__title">${a?"D\xE9placer le rendez-vous":e.appointment?"Proposer un autre horaire":"Fixer un horaire"}</h2>
      <p class="form__who">${l(e.name)} \xB7 ${l(e.care)} \xB7 ${l(P(e))}</p>
      <div class="field">
        <p class="field__label">Jour</p>
        ${ce(n.date,"form-day")}
      </div>
      <div class="field">
        <p class="field__label" id="dur-label">Dur\xE9e</p>
        <div class="seg" role="group" aria-labelledby="dur-label">${[15,30,45,60,90].map(i=>`<button type="button" data-minutes="${i}" aria-pressed="${i===n.minutes}">${i} min</button>`).join("")}</div>
      </div>
      <div class="field">
        <p class="field__label">Horaires libres, ${l(m(n.date).toLowerCase())}</p>
        ${r}
      </div>
      <div class="field">
        <label class="field__label" for="f-time">Ou une autre heure</label>
        <input class="input num" id="f-time" type="time" step="300" min="07:00" max="19:00" value="${n.time}" data-field="time">
      </div>
      <div class="setrow setrow--inline">
        <div>
          <p class="setrow__title" id="agreed-label">D\xE9j\xE0 convenu avec le patient</p>
          <p class="setrow__hint">${n.agreed?"Le rendez-vous est confirm\xE9 directement.":e.email?"Le patient re\xE7oit un e-mail pour accepter ou refuser.":"Pas d\u2019e-mail : appelez le patient avant."}</p>
        </div>
        <button type="button" class="switch" role="switch" aria-checked="${n.agreed}" aria-labelledby="agreed-label" data-action="agreed"><span></span></button>
      </div>
      <div class="field">
        <label class="field__label" for="f-msg">Message pour le patient <span>facultatif</span></label>
        <textarea class="input" id="f-msg" rows="2" data-field="message">${l(n.message)}</textarea>
      </div>
    </div>
    <div class="actions">
      <button type="button" class="btn btn--primary" data-action="proposer" data-id="${l(e.id)}"${n.time?"":" disabled"}>${l(o)}</button>
    </div>`}var de={refuse:["Je suis compl\xE8te ce jour-l\xE0. Appelez-moi pour trouver un autre jour.","Ce soin demande d\u2019en parler d\u2019abord : appelez-moi."],cancel:["J\u2019ai un emp\xEAchement. Appelez-moi pour fixer un autre jour."]};function Ge(e){let n=t.form,s=n.kind==="refuse";return`<div class="form">
      <h2 class="form__title">${s?"Refuser la demande":"Annuler le rendez-vous"}</h2>
      <p class="form__who">${l(e.name)} \xB7 ${l(e.care)}${e.appointment?` \xB7 ${l(m(_(e),!1).toLowerCase())} \xE0 ${w(new Date(e.appointment))}`:""}</p>
      <div class="field">
        <label class="field__label" for="f-msg">Message pour le patient <span>facultatif</span></label>
        <textarea class="input" id="f-msg" rows="3" data-field="message">${l(n.message)}</textarea>
        <div class="quick">${de[n.kind].map((a,r)=>`<button type="button" class="quick__btn" data-reason="${r}">${l(a)}</button>`).join("")}</div>
      </div>
      <p class="hint">${e.email?"Le patient est pr\xE9venu par e-mail":"Pas d\u2019e-mail : pensez \xE0 appeler le patient"}${e.appointment?", et le cr\xE9neau est lib\xE9r\xE9 dans votre agenda.":"."}</p>
    </div>
    <div class="actions">
      <button type="button" class="btn btn--danger" data-action="${s?"refuser":"annuler"}" data-id="${l(e.id)}">${s?"Refuser la demande":"Annuler le rendez-vous"}</button>
    </div>`}function j(e=""){D.innerHTML=`
    <main class="login">
      <svg class="login__logo" aria-hidden="true"><use href="#logo"/></svg>
      <h1>Mes rendez-vous</h1>
      <p class="login__sub">Isabelle Buisson, infirmi\xE8re lib\xE9rale</p>
      <form class="login__form" data-form="login">
        <label for="code">Code</label>
        <input class="input" id="code" name="code" type="password" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false" minlength="6" maxlength="64" required aria-describedby="code-hint">
        <p class="login__hint" id="code-hint">Chiffres et lettres accept\xE9s. Attention aux majuscules.</p>
        <p class="login__error" role="alert">${l(e)}</p>
        <button class="btn btn--primary" type="submit">Entrer</button>
      </form>
      <p class="login__foot">${z?`D\xE9monstration : le code est ${be}.`:"Ce t\xE9l\xE9phone restera connect\xE9."}</p>
    </main>`,setTimeout(()=>document.getElementById("code")?.focus(),50)}function pe(){let[e,n]=decodeURIComponent(location.hash.slice(1)).split("/");return{id:e||null,sub:{horaire:"propose",refus:"refuse",annulation:"cancel"}[n]||null}}function K(e,n){return e?`#${e}${n?`/${{propose:"horaire",refuse:"refus",cancel:"annulation"}[n]}`:""}`:location.pathname+location.search}function ee(e,n=null){!t.open&&e&&(t.listScroll=window.scrollY);let s=e&&t.items.find(a=>a.id===e);t.form=n&&s?W(s,n):null,t.open=e,t.sub=n,t.anim="detail",history.pushState(null,"",K(e,n)),t.pushed+=1,c(),window.scrollTo(0,0)}function Ne(){if(t.pushed>0){history.back();return}let e=t.sub;t.sub=null,t.form=null,e||(t.open=null),history.replaceState(null,"",K(t.open,null)),c(),t.open||window.scrollTo(0,t.listScroll)}window.addEventListener("popstate",()=>{t.pushed=Math.max(0,t.pushed-1);let{id:e,sub:n}=pe(),s=t.open;if(t.open=e,n!==t.sub){let a=e&&t.items.find(r=>r.id===e);t.form=n&&a?W(a,n):null}t.sub=n,t.anim=e?"detail":"list",c(),window.scrollTo(0,!e&&s?t.listScroll:0)});function Be(){let{id:e,sub:n}=pe(),s=e&&t.items.find(r=>r.id===e);if(!s)return;let a=re();t.tab=s.status==="En attente"?"todo":a.upcoming.includes(s)?"plan":"history",t.tab==="plan"&&(t.planDay=_(s)),t.open=e,t.sub=n,t.form=n?W(s,n):null}async function g(e=!1){if(!t.token)return c();let n=!t.loaded;e||(t.busy=!0,t.loaded&&c());try{let s=await E("admin.list");if(!s.ok){if(s.error==="auth")return R("Session expir\xE9e : entrez \xE0 nouveau votre code.");throw new Error(s.message||s.error)}t.items=s.items,t.autoConfirm=!!s.autoConfirm,Array.isArray(s.bookingTimes)&&(t.bookingTimes=s.bookingTimes),t.error="",t.updatedAt=new Date}catch{t.error=`Google n\u2019a pas r\xE9pondu${t.updatedAt?` (liste \xE0 jour \xE0 ${w(t.updatedAt)})`:""}. V\xE9rifiez la connexion internet, puis r\xE9essayez.`}finally{t.loaded=!0,t.busy=!1}n&&Be(),t.days={},c()}async function te(e,n=!1){let s=n&&t.items.find(i=>i.id===t.open),a=n?t.form.minutes:b.step,r=n?`${e}|${a}|${s&&s.eventId||""}`:e;if(r in t.days)return;t.days[r]=null;let o;try{let i=await E("admin.slots",{date:e,commune:n&&s?s.commune:"",ignoreId:n&&s?s.eventId:"",minutes:a});if(!i.ok)throw new Error;o={free:i.times}}catch{o={free:[],error:!0}}t.days[r]=o,(n&&t.sub==="propose"&&t.form&&t.form.date===e||!n&&t.tab==="plan"&&t.planDay===e)&&c()}function R(e=""){t.token="",t.items=[],t.loaded=!1,t.open=null,t.sub=null,ae(N,""),history.replaceState(null,"",location.pathname+location.search),j(e)}async function M(e,n,s={}){let a=[...D.querySelectorAll(".btn")];a.forEach(i=>i.disabled=!0);let r=a.find(i=>i.dataset.action===n||n==="proposer"&&i.dataset.action==="proposer");r&&(r.textContent="Envoi\u2026");let o=()=>{t.sub&&t.pushed>0?history.back():(t.sub=null,t.form=null,history.replaceState(null,"",K(e,null)))};try{let i=await E("admin.decide",{id:e,choice:n,...s});if(!i.ok){if(i.error==="auth")return R("Session expir\xE9e : entrez \xE0 nouveau votre code.");f(U(i.message||"L\u2019action n\u2019a pas pu \xEAtre faite."),!0),/déjà traitée|n’existe plus/.test(i.message||"")?(o(),await g(!0)):c();return}f(i.message),o(),await g(!0)}catch{f("Google met du temps \xE0 r\xE9pondre. La fiche est remise \xE0 jour : v\xE9rifiez si c\u2019est pass\xE9 avant de r\xE9essayer.",!0),o(),await g(!0)}}D.addEventListener("submit",async e=>{if(e.target.dataset.form!=="login")return;e.preventDefault();let n=e.target.code.value.trim(),s=e.target.querySelector("button");s.disabled=!0;try{let a=await E("admin.login",{code:n});if(!a.ok){let r={code:a.left?`Code incorrect. Encore ${A(a.left,"essai","essais")} avant un blocage.`:"Code incorrect.",locked:`Trop d\u2019essais. R\xE9essayez dans ${a.minutes>=60?`${Math.round(a.minutes/60)} h`:`${a.minutes||15} minutes`}.`,nocode:"Le code n\u2019est pas encore r\xE9gl\xE9 dans le script Google (CODE_GESTION).",weak:"Le code r\xE9gl\xE9 dans le script Google est trop court : au moins 6 chiffres, ou 8 caract\xE8res s\u2019il contient des lettres."};j(r[a.error]||"Connexion impossible.");return}t.token=a.token,ae(N,a.token),t.loaded=!1,c(),g()}catch{j("Pas de connexion internet.")}});D.addEventListener("click",e=>{let n=e.target.closest("[data-action], [data-tab], [data-open], [data-time], [data-plan-day], [data-form-day], [data-minutes], [data-reason], [data-hour]");if(!n)return;let s=n.dataset;if(s.hour){let o=new Set(t.hoursDraft||t.bookingTimes);return o.has(s.hour)?o.delete(s.hour):o.add(s.hour),t.hoursDraft=B.filter(i=>o.has(i)),c()}if(s.tab){t.tab=s.tab,t.open=null,t.sub=null,t.form=null,t.pushed=0,history.replaceState(null,"",location.pathname+location.search),c(),window.scrollTo(0,0);return}if(s.open)return ee(s.open);if(s.planDay)return t.planDay=s.planDay,se.matches&&(t.open=null),c();let a=t.form;if(s.formDay&&a)return a.date=s.formDay,a.time="",c();if(s.minutes&&a)return a.minutes=Number(s.minutes),a.time="",c();if(s.time&&a)return a.time=s.time,c();if(s.reason&&a){a.message=de[a.kind][Number(s.reason)];let o=document.getElementById("f-msg");o&&(o.value=a.message);return}let r=t.open&&t.items.find(o=>o.id===t.open);switch(s.action){case"refresh":return t.days={},g();case"logout":return R();case"back":return Ne();case"sub":return ee(t.open,s.sub);case"agreed":return a.agreed=!a.agreed,c();case"auto":return Ue();case"save-hours":return Re(n);case"reset-hours":return t.hoursDraft=null,c();case"valider":return M(s.id,"valider");case"refuser":case"annuler":return M(s.id,s.action,{message:a?a.message:""});case"proposer":return!r||!a||!a.time?f("Choisissez un horaire libre ou tapez une heure.",!0):M(s.id,"proposer",{date:a.date,time:a.time,minutes:a.minutes,agreed:a.agreed,message:a.message});default:}});D.addEventListener("input",e=>{e.target.dataset.field==="message"&&t.form&&(t.form.message=e.target.value)});D.addEventListener("change",e=>{e.target.dataset.field==="time"&&t.form&&(t.form.time=e.target.value,c())});function Ue(){let e=!t.autoConfirm;t.autoConfirm=e,c(),E("admin.settings",{autoConfirm:e}).then(n=>{if(!n.ok)throw new Error;t.autoConfirm=!!n.autoConfirm,f(e?"Confirmation automatique activ\xE9e.":"Confirmation automatique d\xE9sactiv\xE9e."),c()}).catch(()=>{t.autoConfirm=!e,f("Le r\xE9glage n\u2019a pas pu \xEAtre enregistr\xE9.",!0),c()})}var me=()=>document.visibilityState==="visible"&&t.token&&!t.sub;document.addEventListener("visibilitychange",()=>me()&&g(!0));setInterval(()=>me()&&g(!0),12e4);c();g();

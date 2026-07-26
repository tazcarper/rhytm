/* Rhythm Outdoors, live events engine (shared across club sites)
   Reads events from Supabase and renders the calendar, event-detail, and home
   featured events. The club is set per site via  <script data-club="…">. */
(function(){
  const SB_URL = 'https://kfbudiwxjraugzwwlxgh.supabase.co';
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmYnVkaXd4anJhdWd6d3dseGdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2ODg4MzgsImV4cCI6MjA5OTI2NDgzOH0.RY_0HU1Yqo3CH7bn2utR13s0t-89jquaHqmtPKefFaM';
  const S = document.currentScript;
  const CLUB = (S && S.getAttribute('data-club')) || '';
  const H = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };

  // club-aware styling (Horseshoe Bay uses dark labels + green headings)
  const DARK = CLUB === 'Horseshoe Bay Sporting Club';
  const HEAD = DARK ? 'text-moss' : 'text-ink';
  const LABEL = 'text-sand';   // active pill sits on bg-moss; text-ink IS bg-moss
  const btn = pad => `inline-block text-center bg-moss ${LABEL} ${pad} font-eyebrow font-semibold text-[13px] uppercase tracking-[0.1em] hover:bg-moss-dark transition-colors duration-300`;

  const MON  = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const MONT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DOW  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const pd = d => d ? new Date(d + 'T00:00:00') : null;
  const fmtDate = d => { const x = pd(d); return x ? `${DOW[x.getDay()]}, ${MONT[x.getMonth()]} ${x.getDate()}, ${x.getFullYear()}` : ''; };
  const mon = d => { const x = pd(d); return x ? MON[x.getMonth()] : ''; };
  const day = d => { const x = pd(d); return x ? x.getDate() : ''; };
  const fmtTime = t => { if(!t) return ''; let [h,m] = t.split(':'); h=+h; const ap = h>=12?'PM':'AM'; h = h%12||12; return `${h}:${m} ${ap}`; };
  const money = v => (v==null||v==='') ? '' : (/^\$|free/i.test(v) ? v : '$'+v);
  const esc = s => (s==null?'':String(s)).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const img = (e,cls) => e.image ? `<img src="${esc(e.image)}" alt="" class="${cls}">` : `<div class="${cls} img-placeholder img-placeholder-dark"></div>`;

  async function getAll(){
    try{ const r = await fetch(`${SB_URL}/rest/v1/events?select=*&club=eq.${encodeURIComponent(CLUB)}&published=eq.true&order=date.asc`, {headers:H}); return r.ok ? await r.json() : []; }
    catch(e){ return []; }
  }
  async function getOne(id){
    try{ const r = await fetch(`${SB_URL}/rest/v1/events?select=*&id=eq.${encodeURIComponent(id)}&published=eq.true`, {headers:H}); if(!r.ok) return null; const a = await r.json(); return a[0]||null; }
    catch(e){ return null; }
  }
  const upcoming = list => { const t = new Date(); t.setHours(0,0,0,0); return list.filter(e => { const x = pd(e.date); return !x || x >= t; }); };

  // ---------------- CALENDAR ----------------
  // Training programs map to a set of event disciplines. The Education page deep-links
  // here with ?program=shotgun|pistol|outdoor-skills to open a pre-filtered calendar.
  const PROGRAMS = {
    // Hog Heaven + Horseshoe Bay
    'shotgun':         { label:'Shotgun',           disciplines:['Shotgun','Sporting Clays','Skeet','Trap'] },
    'pistol':          { label:'Pistol',            disciplines:['Pistol','Carbine'] },
    'outdoor-skills':  { label:'Outdoor Skills',    disciplines:['Outdoor Skills','Fishing','Land Nav','Archery'] },
    // Packsaddle (no shotgun; third track absorbs fieldcraft, land nav, and adventure)
    'precision-rifle': { label:'Precision Rifle',   disciplines:['Precision Rifle','Rifle','Long Range'] },
    'pistol-carbine':  { label:'Pistol & Carbine',  disciplines:['Pistol','Carbine'] },
    'uncommon-skills': { label:'Uncommon Skills',   disciplines:['Fieldcraft','Outdoor Skills','Land Nav'], types:['Adventure'] }
  };
  const matchProg = e => { const p = PROGRAMS[fProg];
    return (p.disciplines||[]).includes(e.discipline) || (p.types||[]).includes(e.type); };
  let ALL = [], fType='All', fDisc='All', fInc=false, fProg=null;
  const applyFilters = list => list.filter(e =>
    (fType==='All' || e.type===fType) && (fDisc==='All' || e.discipline===fDisc) && (!fInc || e.included_with_membership)
    && (!fProg || matchProg(e)));

  function renderProgNotice(){ const el = document.getElementById('progNotice'); if(!el) return;
    if(!fProg){ el.innerHTML=''; el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.innerHTML = `<div class="flex items-center justify-center gap-4 flex-wrap">
      <span class="font-label-mono text-label-mono uppercase tracking-widest text-on-surface-variant">Showing the ${esc(PROGRAMS[fProg].label)} program</span>
      <button id="clearProg" class="inline-flex items-center gap-1 font-label-mono text-[11px] uppercase tracking-widest text-ink hover:text-moss-dark transition-colors"><span class="material-symbols-outlined text-[16px]">close</span> Clear</button>
    </div>`;
    const c = document.getElementById('clearProg');
    if(c) c.onclick = () => { fProg=null; renderProgNotice(); renderFilters(); renderList(); };
  }
  const catLine = e => [e.type, e.discipline].filter(Boolean).join(' &middot; ') + (e.included_with_membership ? ' &middot; <span class="text-ink font-semibold">Included</span>' : '');

  function updateIncludedCta(){ const sib = document.getElementById('showIncluded'); if(!sib) return;
    sib.innerHTML = `<i class="rio rio-verified text-[18px]"></i> ${fInc ? 'Show all events' : "Show what's included"}`; }

  function fbtn(v, active){ const on = v===active;
    return `<button data-v="${esc(v)}" class="font-label-mono text-label-mono px-6 py-2 border uppercase transition-all ${on ? 'border-accent bg-moss text-sand' : 'border-ink/25 text-ink/90 hover:border-ink hover:text-ink'}">${esc(v)}</button>`; }

  function renderFilters(){
    const tEl = document.getElementById('typeFilters'), dEl = document.getElementById('discFilters');
    if(tEl){ const v = ['All', ...new Set(ALL.map(e=>e.type).filter(Boolean))]; tEl.innerHTML = v.map(x=>fbtn(x,fType)).join('');
      tEl.querySelectorAll('button').forEach(b => b.onclick = () => { fType=b.dataset.v; renderFilters(); renderList(); }); }
    if(dEl){ const v = ['All', ...new Set(ALL.map(e=>e.discipline).filter(Boolean))]; dEl.innerHTML = v.map(x=>fbtn(x,fDisc)).join('');
      dEl.querySelectorAll('button').forEach(b => b.onclick = () => { fDisc=b.dataset.v; renderFilters(); renderList(); }); }
    updateIncludedCta();
  }

  // Standing programmes render wherever #standingWrap is mounted: the events page,
  // and Club Life. They do not depend on the dated calendar being present.
  async function renderStanding(){
    const sw = document.getElementById('standingWrap'); if(!sw) return;
    const STANDING = (await getAll()).filter(e => e.type === 'Standing');
    if(sw){
      if(STANDING.length){
        sw.style.display='';
        sw.innerHTML = `
        <p class="font-eyebrow text-eyebrow uppercase tracking-[0.2em] text-accent-deep mb-3">Standing Programs</p>
        <p class="font-body-lg text-body-lg text-on-surface-variant mb-8 max-w-2xl">Always running, always included: join in on our standing member programs.</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">` +
        STANDING.map(e => `<a href="event-detail.html?id=${encodeURIComponent(e.id)}" class="group flex border border-ink/10 overflow-hidden">
          <div class="w-2/5 relative overflow-hidden min-h-[150px]">${img(e,'absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700')}</div>
          <div class="w-3/5 p-6 flex flex-col bg-surface-container-low">
            <span class="font-label-mono text-[11px] text-accent-deep uppercase tracking-[0.2em] mb-2">${esc(e.schedule||'Standing program')}</span>
            <h4 class="font-headline-md text-[20px] uppercase ${HEAD} mb-2">${esc(e.name)}</h4>
            <p class="font-body-md text-body-md text-on-surface-variant mb-4 flex-grow">${esc(e.description||'')}</p>
            <span class="mt-auto font-eyebrow text-eyebrow uppercase tracking-widest text-ink flex items-center">Details <i class="rio rio-arrow ml-1.5 transition-transform duration-300 group-hover:translate-x-1"></i></span>
          </div></a>`).join('') + `</div>`;
      } else sw.style.display='none';
    }
  }

  function renderList(){
    const listEl = document.getElementById('eventList'); if(!listEl) return;
    const list = applyFilters(upcoming(ALL.filter(e => e.type !== 'Standing')));

    const fw = document.getElementById('featuredWrap');
    if(fw){ const f = list.find(e=>e.featured);
      if(f){ fw.style.display='';
        fw.innerHTML = `<div class="group"><div class="flex flex-col lg:flex-row border border-ink/10 overflow-hidden bg-white">
          <div class="lg:w-7/12 relative overflow-hidden h-96 lg:h-auto min-h-[360px]">${img(f,'absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700')}
            <div class="absolute top-8 left-8 bg-moss ${LABEL} px-4 py-1 font-label-mono text-label-mono uppercase tracking-widest">Featured Event</div></div>
          <div class="lg:w-5/12 p-12 flex flex-col justify-start">
            <span class="font-label-mono text-label-mono text-ink mb-4 uppercase">${esc(fmtDate(f.date))}</span>
            <h2 class="font-headline-md text-headline-md ${HEAD} uppercase mb-6 leading-tight">${esc(f.name)}</h2>
            <p class="font-body-md text-body-md text-on-surface-variant mb-8 leading-relaxed">${esc(f.description||'')}</p>
            <div><a href="event-detail.html?id=${encodeURIComponent(f.id)}" class="${btn('px-8 py-3')}">Details</a></div>
          </div></div></div>`;
      } else fw.style.display='none'; }
    if(!list.length){ listEl.innerHTML = `<p class="font-body-md text-on-surface-variant py-8">No upcoming events${(fInc||fType!=='All'||fDisc!=='All')?' match these filters':''}. Check back soon.</p>`; return; }
    listEl.innerHTML = list.map(e => `<div class="grid grid-cols-1 md:grid-cols-12 gap-8 items-center border-b border-ink/10 pb-12 group">
      <div class="md:col-span-2"><div class="flex flex-col text-center"><span class="font-label-mono text-label-mono text-accent-deep uppercase">${mon(e.date)}</span><span class="font-display-lg text-[48px] leading-none ${HEAD}">${day(e.date)}</span></div></div>
      <div class="md:col-span-3"><div class="aspect-video border border-ink/5 overflow-hidden">${img(e,'w-full h-full object-cover')}</div></div>
      <div class="md:col-span-5"><span class="font-label-mono text-[11px] text-accent-deep uppercase tracking-[0.2em] mb-2 block">${catLine(e)}</span>
        <a href="event-detail.html?id=${encodeURIComponent(e.id)}" class="block"><h4 class="font-headline-md text-[28px] uppercase group-hover:text-ink transition-colors ${HEAD}">${esc(e.name)}</h4></a>
        <p class="font-body-md text-body-md text-on-surface-variant mt-2">${esc(e.description||'')}</p></div>
      <div class="md:col-span-2 text-right"><a href="event-detail.html?id=${encodeURIComponent(e.id)}" class="${btn('px-6 py-2')} w-full md:w-auto">Details</a></div>
    </div>`).join('');
  }

  // ---------------- EVENT DETAIL ----------------
  async function renderDetail(){
    const root = document.getElementById('ed-root'); if(!root) return;
    const crumb = document.getElementById('ed-crumb');
    const id = new URLSearchParams(location.search).get('id');
    const e = id ? await getOne(id) : null;
    if(!e){ if(crumb) crumb.textContent='Event not found';
      root.innerHTML = `<p class="font-body-md text-on-surface-variant py-10">Sorry, we couldn't find that event. <a href="events.html" class="text-ink">Back to the calendar</a>.</p>`; return; }
    if(crumb) crumb.textContent = e.name;
    const isStanding = e.type === 'Standing';
    const dates = isStanding ? (e.schedule || 'Runs year round')
      : (e.recurring && (e.additional_dates||[]).length) ? `${fmtDate(e.date)} + ${e.additional_dates.length} more` : fmtDate(e.date);
    const time = [fmtTime(e.start_time), fmtTime(e.end_time)].filter(Boolean).join(' &ndash; ');
    const rows = [['Date',esc(dates)]]; if(time) rows.push(['Time',time]); rows.push(['Location',esc(e.location||CLUB)]);
    if(e.instructors) rows.push(['Instructors',esc(e.instructors)]); if(e.capacity) rows.push(['Capacity',esc(e.capacity)+' spots']);
    const exp = (e.what_to_expect||[]).map(x=>`<li class="flex gap-3"><span class="text-ink">&bull;</span>${esc(x)}</li>`).join('');
    const gear = ((e.type==='Training' || e.type==='Standing') && (e.required_gear||[]).length) ? (e.required_gear).map(x=>`<li class="flex gap-3"><span class="text-ink">&bull;</span>${esc(x)}</li>`).join('') : '';
    const body = e.description_long || e.description;
    const bodyHtml = body ? body.split(/\n\n+/).map(p=>`<p class="mb-4 last:mb-0">${esc(p)}</p>`).join('') : '';
    // Filson-style two-column content band: big headline left, text right
    const band = (title, inner) => `<section class="border-t border-ink/10 mt-14 pt-12"><div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12"><h2 class="lg:col-span-5 font-display-lg text-3xl md:text-4xl ${HEAD} uppercase leading-tight">${title}</h2><div class="lg:col-span-7">${inner}</div></div></section>`;
    root.innerHTML = `
    <section class="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
      <div class="lg:col-span-7 flex"><div class="w-full border border-ink/10 overflow-hidden min-h-[420px]">${img(e,'w-full h-full object-cover')}</div></div>
      <div class="lg:col-span-5 flex flex-col">
        <p class="font-eyebrow text-[13px] text-accent-deep uppercase tracking-[0.2em] mb-3">${[e.type,e.discipline].filter(Boolean).join(' &middot; ')}${e.included_with_membership?' &middot; Included with Membership':''}</p>
        <h1 class="font-display-lg text-4xl md:text-5xl ${HEAD} uppercase leading-tight mb-6">${esc(e.name)}</h1>
        <div class="space-y-3 border-y border-ink/10 py-6">${rows.map(r=>`<div class="flex gap-4 items-baseline"><span class="font-label-mono text-[11px] uppercase tracking-widest text-on-surface-variant w-28 shrink-0">${r[0]}</span><span class="font-body-md text-body-md text-ink">${r[1]}</span></div>`).join('')}</div>
        <div class="mt-auto pt-8">
          <div class="flex items-end gap-8 mb-6">
            ${(e.member_price!=null&&e.member_price!=='')?`<div><p class="font-label-mono text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">Member</p><p class="font-display-lg text-3xl ${HEAD}">${esc(money(e.member_price))}</p></div>`:''}
            ${(e.non_member_price!=null&&e.non_member_price!=='')?`<div><p class="font-label-mono text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">Non-Member</p><p class="font-display-lg text-3xl ${HEAD}">${esc(money(e.non_member_price))}</p></div>`:''}
            ${e.status?`<div class="ml-auto self-center"><span class="font-label-mono text-[10px] uppercase tracking-widest border border-ink/20 px-2 py-1 text-on-surface-variant">${esc(e.status)}</span></div>`:''}
          </div>
          <a href="${e.registration_url?esc(e.registration_url):'#'}" ${e.registration_url?'target="_blank" rel="noopener noreferrer"':''} class="${btn('px-8 py-4')} block w-full">${isStanding ? 'Get Set Up' : 'Register'}</a>
        </div>
      </div>
    </section>
    ${body?band('About This Event',`<div class="font-body-lg text-body-lg text-ink">${bodyHtml}</div>`):''}
    ${exp?band('What to Expect',`<ul class="space-y-3 font-body-md text-body-md text-ink">${exp}</ul>`):''}
    ${gear?band('Required Gear',`<ul class="space-y-3 font-body-md text-body-md text-ink">${gear}</ul>`):''}`;
  }

  // ---------------- HOME FEATURED ----------------
  async function renderHomeFeatured(){
    // Standing programmes are excluded: the home strip is dated.
    const el = document.getElementById('featuredEvents'); if(!el) return;
    const all = upcoming((await getAll()).filter(e => e.type !== 'Standing'));
    // Homepage picks 3: flagged featured first, then backfill with the soonest
    // events from categories not yet shown, then fill any remainder by soonest.
    const pick = all.filter(e=>e.featured);
    const seen = new Set(pick.map(e=>e.type));
    for(const e of all){ if(pick.length>=3) break; if(pick.includes(e)||seen.has(e.type)) continue; pick.push(e); seen.add(e.type); }
    for(const e of all){ if(pick.length>=3) break; if(pick.includes(e)) continue; pick.push(e); }
    const feat = pick.slice(0,3);
    if(!feat.length){ el.innerHTML = `<p class="font-body-md text-on-surface-variant">Events coming soon.</p>`; return; }
    el.innerHTML = feat.map(e => `<a href="event-detail.html?id=${encodeURIComponent(e.id)}" class="group flex flex-col border border-ink/10 bg-surface-bright transition-colors duration-300 hover:border-accent/60 overflow-hidden">
      <div class="aspect-video overflow-hidden">${img(e,'w-full h-full object-cover')}</div>
      <div class="p-8 flex flex-col flex-grow">
        <span class="font-label-mono text-label-mono text-accent-deep mb-3">${esc(fmtDate(e.date))}</span>
        <h3 class="font-headline-md text-3xl ${HEAD} uppercase mb-4 group-hover:text-ink transition-colors">${esc(e.name)}</h3>
        <p class="font-body-md text-on-surface-variant mb-6 flex-grow">${esc(e.description||'')}</p>
        <span class="mt-auto font-eyebrow text-eyebrow uppercase tracking-widest text-ink flex items-center">Details <i class="rio rio-arrow ml-1.5 transition-transform duration-300 group-hover:translate-x-1"></i></span>
      </div></a>`).join('');
  }


  /* DEEP LINKS TO ONE EVENT.
     <a data-event="Hog Heaven PT"> resolves to that event's detail page at load.
     We look the event up by NAME rather than hardcoding its id in the HTML, because the
     id is generated by the Form Builder: delete and re-create the event and every
     hardcoded link on the site silently rots. The name is the thing a human maintains.
     If the event is not there (unpublished, renamed, deleted), the button disables itself
     rather than sending anyone to a dead detail page. */
  async function linkEvents(){
    const links = document.querySelectorAll('[data-event]');
    if(!links.length) return;
    const all = await getAll();
    links.forEach(function(a){
      const want = (a.getAttribute('data-event')||'').trim().toLowerCase();
      const e = all.find(function(x){ return (x.name||'').trim().toLowerCase() === want; });
      if(e){
        a.setAttribute('href', 'event-detail.html?id=' + encodeURIComponent(e.id));
        a.classList.remove('pointer-events-none','opacity-50');
      }else{
        a.removeAttribute('href');
        a.setAttribute('aria-disabled','true');
        a.classList.add('pointer-events-none','opacity-50');
      }
    });
  }

  async function init(){
    if(document.getElementById('eventList')){ ALL = await getAll();
      const qs = new URLSearchParams(location.search);
      const p = (qs.get('program')||'').toLowerCase(); if(PROGRAMS[p]) fProg = p;
      const d = qs.get('discipline'); if(d) fDisc = d;
      const t = qs.get('type'); if(t) fType = t;
      const sib=document.getElementById('showIncluded');
      if(sib) sib.onclick=()=>{ fInc=!fInc; renderFilters(); renderList(); if(fInc) document.getElementById('eventList').scrollIntoView({behavior:'smooth',block:'start'}); };
      renderProgNotice(); renderFilters(); renderList();
    }
    if(document.getElementById('ed-root')) await renderDetail();
    if(document.getElementById('standingWrap')){
      await renderStanding();
      /* The strip is display:none until this point, so a #standingWrap link arriving from
         another page has nothing to scroll to when the browser first reads the hash.
         Re-honour it now that the element actually exists. */
      if(location.hash === '#standingWrap'){
        const el = document.getElementById('standingWrap');
        if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
      }
    }
    if(document.getElementById('featuredEvents')) await renderHomeFeatured();
    await linkEvents();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

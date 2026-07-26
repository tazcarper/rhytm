/* Rhythm Outdoors, Club Life posts engine (shared across club sites)

   A post is NOT an event. It has no date to attend and nothing to register for.
   It is short and complete, so the POST IS THE CONTENT: there is no article page
   and nothing to link out to.

   LAYOUT. Every recent post is a full-bleed row: photo one side, copy the other,
   edge to edge of the viewport. The photo ALTERNATES sides down the page, and the
   ground alternates with it, dark band then light. That zig-zag is what stops a
   run of posts reading as wallpaper. Nothing else on these sites breaks the
   container, so the break is the effect.

   ARCHIVE. Only the newest 6 posts get a row. Everything older collapses into a
   compact list at the bottom and expands in place when clicked. Without this the
   page grows forever and nobody ever reaches the sections below it.

   COLOUR. Eyebrows on the dark band use `camel`, NOT `accent-deep`. On Packsaddle
   accent-deep is Oxblood, invisible on a dark ground. Camel is the warm accent on
   all three clubs and is legible on all three dark bands. */
(function(){
  const S  = document.currentScript;
  const CLUB = S.getAttribute('data-club');
  const SB_URL = 'https://kfbudiwxjraugzwwlxgh.supabase.co';
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmYnVkaXd4anJhdWd6d3dseGdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2ODg4MzgsImV4cCI6MjA5OTI2NDgzOH0.RY_0HU1Yqo3CH7bn2utR13s0t-89jquaHqmtPKefFaM';
  const H = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };

  // how many posts get a full-bleed row before the rest fall into the archive
  const ROWS = 6;

  const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const para = (s, cls) => String(s||'').split(/\n\s*\n|\n/).map(x=>x.trim()).filter(Boolean)
                    .map(x=>`<p class="font-body-md text-body-md ${cls} mb-4 last:mb-0">${esc(x)}</p>`).join('');
  const when = d => { if(!d) return ''; const [y,m,dd]=d.split('-').map(Number);
    return new Date(y,m-1,dd).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); };

  async function getPosts(){
    try{
      const r = await fetch(`${SB_URL}/rest/v1/posts?select=*&club=eq.${encodeURIComponent(CLUB)}&published=eq.true&order=published_at.desc`, {headers:H});
      return r.ok ? await r.json() : [];
    }catch(e){ return []; }
  }

  const img = (p, cls) => p.image
    ? `<img src="${esc(p.image)}" alt="" loading="lazy" class="${cls}">`
    : `<div class="${cls} img-placeholder img-placeholder-dark" data-file="post image"></div>`;

  const meta = (p, accent, dim) => `
    <div class="flex items-center gap-3 mb-4">
      <span class="font-label-mono text-[11px] uppercase tracking-[0.2em] ${accent}">${esc(p.category||'Announcement')}</span>
      <span class="${dim}">&middot;</span>
      <span class="font-label-mono text-[11px] uppercase tracking-widest ${dim}">${esc(when(p.published_at))}</span>
    </div>`;

  /* A full-bleed row. `i` decides everything about how it looks:
       even  photo left,  dark band right
       odd   photo right, light band left
     The lead (i = 0) is taller than the rest, so it still reads as the lead. */
  function row(p, i){
    const dark  = i % 2 === 0;
    const lead  = i === 0;

    const skin = dark
      ? { bg:'bg-deep-olive', head:'text-white', body:'text-white/85', accent:'text-camel',
          dim:'text-white/60', rule:'bg-white/20', cta:'text-white hover:text-camel' }
      : { bg:'bg-background', head:'text-ink', body:'text-on-surface-variant', accent:'text-accent-deep',
          dim:'text-on-surface-variant', rule:'bg-ink/20', cta:'text-ink hover:text-accent' };

    const photo = `<div class="relative ${lead ? 'min-h-[360px] lg:min-h-[620px]' : 'min-h-[320px] lg:min-h-[500px]'} ${dark ? '' : 'lg:order-2'}">${img(p,'absolute inset-0 w-full h-full object-cover')}</div>`;

    const panel = `
      <div class="${skin.bg} flex flex-col p-10 md:p-16 ${lead ? 'lg:p-20' : 'lg:p-16'} ${dark ? '' : 'lg:order-1'}">
        <div class="w-full max-w-2xl flex flex-col flex-1 ${dark ? '' : 'lg:ml-auto'}">
          ${meta(p, skin.accent, skin.dim)}
          <h2 class="font-headline-md ${lead ? 'text-headline-md' : 'text-[32px]'} ${skin.head} uppercase mb-6 leading-tight">${esc(p.title)}</h2>
          ${para(p.body, skin.body)}
          ${p.link_url ? `
          <div class="mt-auto pt-14">
            <div class="h-px w-full ${skin.rule} mb-6"></div>
            <a href="${esc(p.link_url)}" class="inline-flex items-center gap-2 font-eyebrow text-eyebrow uppercase tracking-widest ${skin.cta} transition-colors">${esc(p.link_label||'Read more')} <i class="rio rio-arrow"></i></a>
          </div>` : ''}
        </div>
      </div>`;

    return `<article class="grid grid-cols-1 lg:grid-cols-2 gap-0 w-full ${lead ? '' : 'mt-16 md:mt-24'}">${photo}${panel}</article>`;
  }

  /* An archive row. Collapsed it is one line. Expanded it is the whole post, in place,
     because there is no article page to send anyone to. */
  function archiveRow(p){
    return `
    <div class="border-t border-ink/15">
      <button type="button" data-post="${esc(p.id)}" class="js-arch w-full text-left py-6 flex items-center gap-6 group">
        <span class="font-label-mono text-[11px] uppercase tracking-[0.2em] text-accent-deep shrink-0 w-32">${esc(p.category||'Announcement')}</span>
        <span class="font-headline-md text-[20px] uppercase leading-tight flex-1 group-hover:text-accent transition-colors">${esc(p.title)}</span>
        <span class="font-label-mono text-[11px] uppercase tracking-widest text-on-surface-variant shrink-0 hidden md:block">${esc(when(p.published_at))}</span>
        <span class="material-symbols-outlined text-[20px] text-on-surface-variant shrink-0 transition-transform js-chev">expand_more</span>
      </button>
      <div class="js-body hidden pb-8 grid grid-cols-1 md:grid-cols-3 gap-8">
        ${p.image ? `<div class="relative aspect-[4/3] md:col-span-1">${img(p,'absolute inset-0 w-full h-full object-cover')}</div>` : ''}
        <div class="${p.image ? 'md:col-span-2' : 'md:col-span-3 max-w-2xl'}">
          ${para(p.body, 'text-on-surface-variant')}
          ${p.link_url ? `<a href="${esc(p.link_url)}" class="mt-6 inline-flex items-center gap-2 font-eyebrow text-eyebrow uppercase tracking-widest text-ink hover:text-accent transition-colors">${esc(p.link_label||'Read more')} <i class="rio rio-arrow"></i></a>` : ''}
        </div>
      </div>
    </div>`;
  }

  function wireArchive(root){
    root.querySelectorAll('.js-arch').forEach(btn => {
      btn.addEventListener('click', () => {
        const body = btn.parentElement.querySelector('.js-body');
        const chev = btn.querySelector('.js-chev');
        const open = !body.classList.contains('hidden');
        body.classList.toggle('hidden', open);
        chev.style.transform = open ? '' : 'rotate(180deg)';
      });
    });
  }

  async function render(){
    const rowsEl = document.getElementById('postRows');
    const archEl = document.getElementById('postArchive');
    const emptyEl= document.getElementById('postEmpty');
    if(!rowsEl) return;

    const all = await getPosts();
    if(!all.length){
      rowsEl.innerHTML = '';
      if(archEl) archEl.innerHTML = '';
      if(emptyEl) emptyEl.classList.remove('hidden');
      return;
    }
    if(emptyEl) emptyEl.classList.add('hidden');

    // the newest featured post leads; if none is featured, the newest post does
    const lead = all.find(p=>p.featured) || all[0];
    const ordered = [lead, ...all.filter(p=>p.id!==lead.id)];

    rowsEl.innerHTML = ordered.slice(0, ROWS).map((p,i)=>row(p,i)).join('');

    const old = ordered.slice(ROWS);
    if(archEl){
      archEl.innerHTML = old.length ? `
        <div class="mb-8">
          <p class="font-eyebrow text-eyebrow uppercase tracking-widest text-accent-deep mb-3">From the Archive</p>
          <h2 class="font-headline-md text-headline-md uppercase">Everything Else</h2>
          <div class="rule"></div>
        </div>
        ${old.map(archiveRow).join('')}
        <div class="border-t border-ink/15"></div>` : '';
      wireArchive(archEl);
    }
  }

  document.addEventListener('DOMContentLoaded', render);
})();

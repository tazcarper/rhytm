/* Rhythm Outdoors, booking links. ONE FILE, TWO URLS.

   When the scheduling platform is live, paste the URLs in below and every
   "Book Lesson" and "Schedule Onboarding" button on this site starts working.
   Nothing else to change.

   Leave a URL as '' and its buttons render as DISABLED with a "Coming Soon" tag,
   not as dead links. A button that looks live and goes nowhere is worse than a
   button that admits it is not ready yet. */
window.RHYTHM_BOOKING = {
  lesson:     '',   // private instruction, one page per instructor or one shared page
  onboarding: '',   // new member onboarding, first visit, with the membership director
  tour:       ''    // private tour of the club, for prospective members
};

/* Any element with data-book="lesson" or data-book="onboarding" gets wired here.
   Call applyBooking() again after rendering anything new (the instructor grid does). */
window.applyBooking = function(root){
  (root || document).querySelectorAll('[data-book]').forEach(function(el){
    var url = window.RHYTHM_BOOKING[el.getAttribute('data-book')] || '';
    if(url){
      el.setAttribute('href', url);
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
      el.classList.remove('pointer-events-none','opacity-60');
      var tag = el.querySelector('.js-soon'); if(tag) tag.remove();
    }else{
      el.removeAttribute('href');
      el.classList.add('pointer-events-none','opacity-60');
      el.setAttribute('aria-disabled','true');
      if(!el.querySelector('.js-soon')){
        var s = document.createElement('span');
        s.className = 'js-soon ml-3 text-[9px] tracking-widest border border-current px-2 py-0.5 opacity-80';
        s.textContent = 'Coming Soon';
        el.appendChild(s);
      }
    }
  });
};
document.addEventListener('DOMContentLoaded', function(){ window.applyBooking(); });

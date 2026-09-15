// Studio Web Local — shared.js (nav, reveal animations, legal modal)
function openLegal(){document.body.classList.add("no-scroll");document.getElementById("legalModal").style.display="block";}
function closeLegal(){document.body.classList.remove("no-scroll");document.getElementById("legalModal").style.display="none";}

document.addEventListener("DOMContentLoaded",function(){
  var obs=new IntersectionObserver(function(entries){
    entries.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");obs.unobserve(e.target)}});
  },{threshold:.07});
  document.querySelectorAll(".reveal").forEach(function(el){obs.observe(el)});

  var burger=document.getElementById('navBurger');
  var links=document.getElementById('navLinks');
  if(burger&&links){
    burger.addEventListener('click',function(){
      links.classList.toggle('open');
      burger.setAttribute('aria-expanded',links.classList.contains('open'));
    });
    links.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click',function(){links.classList.remove('open')});
    });
    document.addEventListener('click',function(e){
      if(!e.target.closest('.main-nav'))links.classList.remove('open');
    });
  }
  var navEl=document.getElementById('mainNav');
  function onScroll(){
    if(navEl)navEl.classList.toggle('nav-solid',window.scrollY>40);
  }
  window.addEventListener('scroll',onScroll,{passive:true});
  onScroll();
});

/* Compteur de sites livres — synchronise avec le serveur sur toutes les pages.
   (index.html a sa propre animation : on ne fait rien s'il l'a deja geree)
   Mise en cache 1 h dans le navigateur pour ne pas reveiller la fonction
   Netlify a chaque chargement de page. */
document.addEventListener("DOMContentLoaded", function(){
  if(typeof window.animateOrderCounter === "function") return;
  var el = document.getElementById("orderCountNum");
  if(!el) return;

  var CACHE_KEY = "swl_count_cache";
  var CACHE_TTL = 3600000; // 1 heure

  function animate(target){
    var start = Math.max(0, target - 12), t0 = performance.now();
    (function step(now){
      var p = Math.min((now - t0) / 1200, 1), e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(start + (target - start) * e);
      if(p < 1) requestAnimationFrame(step);
    })(performance.now());
  }

  try {
    var c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if(c && typeof c.n === "number" && Date.now() - c.t < CACHE_TTL){
      animate(c.n);
      return;
    }
  } catch(e){}

  fetch("/.netlify/functions/order-counter")
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(j){
      if(!j || typeof j.count !== "number") return;
      animate(j.count);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ n: j.count, t: Date.now() }));
      } catch(e){}
    })
    .catch(function(){});
});
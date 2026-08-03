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
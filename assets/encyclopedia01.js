
(function(){
  const links=[...document.querySelectorAll('.encyclopedia-toc a[href^="#"]')];
  const sections=links.map(a=>document.querySelector(a.getAttribute('href'))).filter(Boolean);
  if(!links.length||!sections.length)return;
  const setActive=id=>links.forEach(a=>a.classList.toggle('is-active',a.getAttribute('href')===`#${id}`));
  const observer=new IntersectionObserver(entries=>{
    const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
    if(visible)setActive(visible.target.id);
  },{rootMargin:'-32% 0px -55% 0px',threshold:[0,.15,.35]});
  sections.forEach(section=>observer.observe(section));
})();

/* Startseiten-Bildwechsel: Bild 1 lädt sofort (wichtig für die Ladezeit),
   die weiteren erst nach dem vollständigen Laden der Seite. */
(function () {
  var slides = document.querySelectorAll('.hero-slide');
  if (slides.length < 2) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function loadRest() {
    Array.prototype.forEach.call(slides, function (s) {
      var img = s.querySelector('img[data-src]');
      if (!img) return;
      if (img.dataset.srcset) img.srcset = img.dataset.srcset;
      img.src = img.dataset.src;
      img.removeAttribute('data-src'); img.removeAttribute('data-srcset');
    });
    if (reduce) return;
    var i = 0;
    setInterval(function () {
      if (document.hidden) return;
      slides[i].classList.remove('active');
      i = (i + 1) % slides.length;
      slides[i].classList.add('active');
    }, 6000);
  }
  if (document.readyState === 'complete') setTimeout(loadRest, 1500);
  else window.addEventListener('load', function () { setTimeout(loadRest, 1500); });
})();

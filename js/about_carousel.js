document.addEventListener('DOMContentLoaded', function () {
  var wrap = document.querySelector('.carousel-about');
  if (!wrap) return;
  var track = wrap.querySelector('.carousel-track');
  var items = Array.prototype.slice.call(track.children);
  var box = wrap.querySelector('.carousel-track-container');
  var i = 0;
  function update() {
    items.forEach(function (it, k) { it.classList.toggle('active', k === i); });
    var w = items[i].offsetWidth + 24;
    track.style.transform = 'translateX(' + (box.offsetWidth / 2 - w / 2 - w * i) + 'px)';
  }
  wrap.querySelector('.prev').addEventListener('click', function () { i = (i - 1 + items.length) % items.length; update(); });
  wrap.querySelector('.next').addEventListener('click', function () { i = (i + 1) % items.length; update(); });
  window.addEventListener('resize', update);
  window.addEventListener('load', update);
  update();
});

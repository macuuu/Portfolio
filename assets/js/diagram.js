// Signal diagram: player -> greybox -> readable space. Red pulses run along the lines and light one route.
(function () {
  "use strict";

  var scene = document.querySelector(".signal-scene");
  if (!scene) return;
  var svg = scene.querySelector(".signal-lines");
  var nPlayer = scene.querySelector('[data-node="player"]');
  var nGrey = scene.querySelector('[data-node="greybox"]');
  var box = scene.querySelector(".signal-box");
  var routes = Array.prototype.slice.call(scene.querySelectorAll(".signal-route"));
  var field = nGrey.querySelector("canvas");
  var NS = "http://www.w3.org/2000/svg";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var paths = { a: null, b: null, r: [] };

  function rel(el) {
    var s = scene.getBoundingClientRect(), r = el.getBoundingClientRect();
    return { l: r.left - s.left, r: r.right - s.left, t: r.top - s.top, b: r.bottom - s.top, cy: (r.top + r.bottom) / 2 - s.top };
  }

  function mk(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    (parent || svg).appendChild(e);
    return e;
  }

  // Draw the static lines from the real positions of the cards
  function layout() {
    var w = scene.clientWidth, h = scene.clientHeight;
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var p = rel(nPlayer), g = rel(nGrey), bx = rel(box);
    var y = g.cy;
    var line = { fill: "none", stroke: "#383838", "stroke-width": 1 };
    paths.a = mk("path", Object.assign({ d: "M" + p.r + " " + p.cy + "L" + g.l + " " + y }, line));
    paths.b = mk("path", Object.assign({ d: "M" + g.r + " " + y + "L" + bx.l + " " + y }, line));
    // Opening in the box frame where the line enters
    mk("rect", { x: bx.l - 1, y: y - 16, width: 3, height: 32, fill: "#000" });
    paths.r = routes.map(function (el) {
      var r = rel(el), x0 = bx.l, x1 = r.l, mid = x0 + (x1 - x0) * 0.45;
      return mk("path", Object.assign({ d: "M" + x0 + " " + y + "H" + mid + "C" + (mid + (x1 - mid) * 0.6) + " " + y + " " + (mid + (x1 - mid) * 0.4) + " " + r.cy + " " + x1 + " " + r.cy }, line));
    });
    sizeField();
  }

  // Dithered noise inside the greybox card, stronger while a signal passes
  var fctx = field && field.getContext("2d"), fimg, energy = 0;
  var BAYER = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
  function sizeField() {
    if (!fctx) return;
    field.width = Math.max(8, Math.round(field.clientWidth / 3));
    field.height = Math.max(8, Math.round(field.clientHeight / 3));
    fimg = fctx.createImageData(field.width, field.height);
  }
  function drawField(t) {
    if (!fctx || !fimg) return;
    var W = field.width, H = field.height, d = fimg.data, o = 0;
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var n = Math.sin(x * 0.9 + t * 0.004) * Math.sin(y * 1.3 - t * 0.003) * 0.5 + 0.5;
      var edge = Math.min(x, W - 1 - x) / W;            // brighter near the centre line
      var v = (0.05 + energy * 0.75) * n * (0.4 + edge * 1.2) + Math.random() * 0.06 * energy;
      var on = v > (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
      d[o] = on ? 255 : 0; d[o + 1] = on ? 42 : 0; d[o + 2] = on ? 42 : 0; d[o + 3] = on ? 150 : 0; o += 4;
    }
    fctx.putImageData(fimg, 0, 0);
  }

  // A pulse: red dash with a glowing head, running along one path
  function runPulse(path, dur, done) {
    var L = path.getTotalLength(), d = path.getAttribute("d");
    var trail = mk("path", { d: d, fill: "none", stroke: "#ff2a2a", "stroke-width": 1.4, "stroke-linecap": "round", "stroke-dasharray": "34 " + (L + 40) });
    var glow = mk("circle", { r: 7, fill: "#ff2a2a", opacity: 0.18 });
    var head = mk("circle", { r: 2.4, fill: "#ffd9d4" });
    var t0 = performance.now();
    function step(now) {
      var k = Math.min(1, (now - t0) / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      var pt = path.getPointAtLength(e * L);
      trail.setAttribute("stroke-dashoffset", 34 - e * L);
      glow.setAttribute("cx", pt.x); glow.setAttribute("cy", pt.y);
      head.setAttribute("cx", pt.x); head.setAttribute("cy", pt.y);
      if (k < 1) requestAnimationFrame(step);
      else { svg.removeChild(trail); svg.removeChild(glow); svg.removeChild(head); if (done) done(); }
    }
    requestAnimationFrame(step);
  }

  function light(el, cls, ms) {
    el.classList.add(cls);
    setTimeout(function () { el.classList.remove(cls); }, ms);
  }

  var next = 0, busy = false;
  function signal(target) {
    if (busy || !paths.a) return;
    busy = true;
    var i = typeof target === "number" ? target : next;
    next = (i + 1) % routes.length;
    light(nPlayer, "is-hot", 500);
    runPulse(paths.a, 650, function () {
      energy = 1; light(nGrey, "is-hot", 700);
      setTimeout(function () {
        runPulse(paths.b, 380, function () {
          runPulse(paths.r[i], 520, function () {
            light(routes[i], "is-hot", 1300);
            busy = false;
          });
        });
      }, 220);
    });
  }

  layout();
  if ("ResizeObserver" in window) new ResizeObserver(layout).observe(scene);
  else window.addEventListener("resize", layout);

  if (reduce) { energy = 0.3; drawField(0); return; }

  // Field loop and an automatic signal every few seconds while the scene is visible
  var visible = false, raf = 0, timer = 0;
  function loop(t) { energy *= 0.965; drawField(t); raf = requestAnimationFrame(loop); }
  function start() {
    if (visible) return; visible = true;
    raf = requestAnimationFrame(loop);
    setTimeout(signal, 500);
    timer = setInterval(signal, 3200);
  }
  function stop() { visible = false; cancelAnimationFrame(raf); clearInterval(timer); }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) { en[0].isIntersecting ? start() : stop(); }).observe(scene);
  } else start();

  // Click a route to send a signal to it, click elsewhere for the next one
  scene.addEventListener("click", function (e) {
    var r = e.target.closest(".signal-route");
    clearInterval(timer); if (visible) timer = setInterval(signal, 3200);
    signal(r ? routes.indexOf(r) : undefined);
  });
})();

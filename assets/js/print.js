// Live dithered print: the swirl loop plays in two hero squares as a red 1-bit print, a pair of eyes.
// The right square is mirrored in CSS (.is-mirror), both show the same frame so they stay symmetric.
// The frames are already dithered offline and packed in one sheet (12 columns, 128x128 each),
// so no video decoding or autoplay permission is needed. Every page load starts at a random frame.
// Intro: the squares fade in first, then the page gets "is-on" and the typing log follows (log.js).
// Bend: only the eye of each swirl leans a little toward the cursor (about 3 mm), the rest does not move.
(function () {
  "use strict";

  var hero = document.querySelector(".hero");
  var pair = hero && hero.querySelector(".eyes");
  if (!pair) return;
  var holders = [].slice.call(pair.querySelectorAll(".print-live"));
  if (!holders.length) return;

  var SHEET = pair.getAttribute("data-frames");  // for example assets/img/print-frames.png
  var COUNT = +pair.getAttribute("data-count") || 1;
  var COLS = 12, N = 128, FPS = 30;
  var INK = "#ff2a2a";

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Show the squares once, even when the sheet cannot load: the still print is the fallback
  var on = false;
  function turnOn() {
    if (on) return;
    on = true;
    hero.classList.add("is-on");
    document.dispatchEvent(new CustomEvent("hero:on"));
  }
  setTimeout(turnOn, 2500);

  var eyes = [];
  holders.forEach(function (holder) {
    var canvas = holder.querySelector("canvas");
    var ctx = canvas && canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = N;
    canvas.height = N;
    eyes.push({
      holder: holder,
      still: holder.querySelector("img"),
      ctx: ctx,
      out: ctx.createImageData(N, N),
      mirror: holder.classList.contains("is-mirror"),
      x: 0, y: 0, tx: 0, ty: 0, drawnX: 0, drawnY: 0
    });
  });
  if (!eyes.length || !SHEET) { turnOn(); return; }

  var sheet = new Image();
  var first = Math.floor(Math.random() * COUNT);
  var t0 = 0, last = -1, lastT = 0;

  // Bend: only the eye of the swirl leans toward the cursor, everything outside BEND_R stays fixed.
  // Each frame is warped with a radial falloff: full shift in the middle, zero at BEND_R.
  var CM = 96 / 2.54;              // CSS px in one centimetre
  var BEND_MAX = 0.3 * CM;         // CSS px, biggest shift of the middle
  var BEND_REACH = 400;            // CSS px, cursor distance that gives about 63% of the max shift
  var BEND_EASE = 2.5;             // 1/s, how fast the middle catches up (low = soft)
  var BEND_R = N * 0.18;           // frame px, radius of the area that moves (the eye only)
  var BEND_LIMIT = BEND_R * 0.3;   // frame px, cap so the warp never folds on small screens
  var R = N / 2, R2 = BEND_R * BEND_R;
  var src = document.createElement("canvas");
  src.width = src.height = N;
  var sctx = src.getContext("2d");
  var INK_RGB = [parseInt(INK.substr(1, 2), 16), parseInt(INK.substr(3, 2), 16), parseInt(INK.substr(5, 2), 16)];

  // Each eye aims from its own centre. The mirrored eye is flipped in CSS, so its x aim is flipped too.
  function aimAt(cx, cy) {
    eyes.forEach(function (e) {
      var r = e.holder.getBoundingClientRect();
      if (!r.width) return;
      var dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < 1) { e.tx = e.ty = 0; return; }
      var mag = BEND_MAX * (1 - Math.exp(-d / BEND_REACH));
      var k = (N / r.width) * mag / d;  // CSS px to frame px
      e.tx = dx * k * (e.mirror ? -1 : 1);
      e.ty = dy * k;
      var m = Math.sqrt(e.tx * e.tx + e.ty * e.ty);
      if (m > BEND_LIMIT) { e.tx *= BEND_LIMIT / m; e.ty *= BEND_LIMIT / m; }
    });
  }
  if (!reduce) {
    window.addEventListener("pointermove", function (ev) { aimAt(ev.clientX, ev.clientY); }, { passive: true });
    document.addEventListener("pointerleave", function () { eyes.forEach(function (e) { e.tx = e.ty = 0; }); });
  }

  function ease(t) {
    var dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 0;
    lastT = t;
    var a = 1 - Math.exp(-BEND_EASE * dt);
    eyes.forEach(function (e) {
      e.x += (e.tx - e.x) * a;
      e.y += (e.ty - e.y) * a;
    });
  }

  // Warp the source frame into one eye: white becomes the red ink, black stays black
  function paint(e, s) {
    var o = e.out.data, bx = e.x, by = e.y;
    e.drawnX = bx;
    e.drawnY = by;
    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        var px = x + 0.5 - R, py = y + 0.5 - R;
        var q = (px * px + py * py) / R2;
        var sx = x, sy = y;
        if (q < 1) {
          var f = (1 - q) * (1 - q);  // 1 in the middle, 0 at BEND_R
          sx = Math.round(x - bx * f);
          sy = Math.round(y - by * f);
          if (sx < 0) sx = 0; else if (sx >= N) sx = N - 1;
          if (sy < 0) sy = 0; else if (sy >= N) sy = N - 1;
        }
        var j = (y * N + x) * 4, lit = s[(sy * N + sx) * 4] > 127;
        o[j] = lit ? INK_RGB[0] : 0;
        o[j + 1] = lit ? INK_RGB[1] : 0;
        o[j + 2] = lit ? INK_RGB[2] : 0;
        o[j + 3] = 255;
      }
    }
    e.ctx.putImageData(e.out, 0, 0);
  }

  // Draw one frame: read the sheet once, then repaint only the eyes that need it
  var frame = null;
  function draw(i) {
    var fresh = i !== last;
    if (fresh) {
      last = i;
      sctx.globalCompositeOperation = "copy";
      sctx.drawImage(sheet, (i % COLS) * N, Math.floor(i / COLS) * N, N, N, 0, 0, N, N);
      frame = sctx.getImageData(0, 0, N, N).data;
    }
    eyes.forEach(function (e) {
      var moved = Math.abs(e.x - e.drawnX) + Math.abs(e.y - e.drawnY) > 0.02;
      if (fresh || moved) paint(e, frame);
    });
  }

  function frameAt(t) { return (first + Math.floor((t - t0) * FPS / 1000)) % COUNT; }

  var running = false, raf = 0, paused = 0;
  function loop(t) { ease(t); draw(frameAt(t)); raf = requestAnimationFrame(loop); }
  function start() {
    if (running || reduce) return;
    running = true;
    lastT = 0;
    var now = performance.now();
    t0 += paused ? now - paused : 0; // continue where it stopped
    raf = requestAnimationFrame(loop);
  }
  function stop() { if (!running) return; running = false; paused = performance.now(); cancelAnimationFrame(raf); }

  sheet.onload = function () {
    t0 = performance.now();
    draw(first);
    eyes.forEach(function (e) {
      e.holder.classList.add("is-live");
      if (e.still) e.still.setAttribute("hidden", "");
    });
    turnOn();
    if (reduce) return;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries[0].isIntersecting ? start() : stop();
      }).observe(pair);
    } else {
      start();
    }
  };
  sheet.onerror = turnOn;
  sheet.src = SHEET;
})();

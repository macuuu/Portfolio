// Live dithered print: the swirl loop plays in the hero square as a red 1-bit print.
// The frames are already dithered offline and packed in one sheet (12 columns, 128x128 each),
// so no video decoding or autoplay permission is needed. Every page load starts at a random frame.
// Intro: the square fades in first, then the page gets "is-on" and the typing log follows (log.js).
// Bend: only the eye of the swirl leans a little toward the cursor (about 3 mm), the rest does not move.
(function () {
  "use strict";

  var hero = document.querySelector(".hero");
  var holder = hero && hero.querySelector(".print-live");
  if (!holder) return;
  var canvas = holder.querySelector("canvas");
  var still = holder.querySelector("img");
  var ctx = canvas && canvas.getContext("2d");

  var SHEET = holder.getAttribute("data-frames");  // for example assets/img/print-frames.png
  var COUNT = +holder.getAttribute("data-count") || 1;
  var COLS = 12, N = 128, FPS = 30;
  var INK = "#ff2a2a";

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Show the square once, even when the sheet cannot load: the still print is the fallback
  var on = false;
  function turnOn() {
    if (on) return;
    on = true;
    hero.classList.add("is-on");
    document.dispatchEvent(new CustomEvent("hero:on"));
  }
  setTimeout(turnOn, 2500);
  if (!ctx || !SHEET) { turnOn(); return; }

  canvas.width = N;
  canvas.height = N;
  ctx.imageSmoothingEnabled = false;

  var sheet = new Image();
  var first = Math.floor(Math.random() * COUNT);
  var t0 = 0, last = -1;

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
  var out = ctx.createImageData(N, N);
  var INK_RGB = [parseInt(INK.substr(1, 2), 16), parseInt(INK.substr(3, 2), 16), parseInt(INK.substr(5, 2), 16)];
  var bend = { x: 0, y: 0, tx: 0, ty: 0, drawnX: 0, drawnY: 0, t: 0 };

  function aimAt(cx, cy) {
    var r = holder.getBoundingClientRect();
    if (!r.width) return;
    var dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1) { bend.tx = bend.ty = 0; return; }
    var mag = BEND_MAX * (1 - Math.exp(-d / BEND_REACH));
    var k = (N / r.width) * mag / d;  // CSS px to frame px
    bend.tx = dx * k;
    bend.ty = dy * k;
    var m = Math.sqrt(bend.tx * bend.tx + bend.ty * bend.ty);
    if (m > BEND_LIMIT) { bend.tx *= BEND_LIMIT / m; bend.ty *= BEND_LIMIT / m; }
  }
  if (!reduce) {
    window.addEventListener("pointermove", function (e) { aimAt(e.clientX, e.clientY); }, { passive: true });
    document.addEventListener("pointerleave", function () { bend.tx = bend.ty = 0; });
  }

  function ease(t) {
    var dt = bend.t ? Math.min(0.1, (t - bend.t) / 1000) : 0;
    bend.t = t;
    var a = 1 - Math.exp(-BEND_EASE * dt);
    bend.x += (bend.tx - bend.x) * a;
    bend.y += (bend.ty - bend.y) * a;
  }

  // Draw one frame: the sheet is white on black, white becomes the red ink, black stays black
  function draw(i) {
    var moved = Math.abs(bend.x - bend.drawnX) + Math.abs(bend.y - bend.drawnY) > 0.02;
    if (i === last && !moved) return;
    last = i;
    bend.drawnX = bend.x;
    bend.drawnY = bend.y;
    sctx.globalCompositeOperation = "copy";
    sctx.drawImage(sheet, (i % COLS) * N, Math.floor(i / COLS) * N, N, N, 0, 0, N, N);
    var s = sctx.getImageData(0, 0, N, N).data, o = out.data;
    var bx = bend.x, by = bend.y;
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
        var j = (y * N + x) * 4, on = s[(sy * N + sx) * 4] > 127;
        o[j] = on ? INK_RGB[0] : 0;
        o[j + 1] = on ? INK_RGB[1] : 0;
        o[j + 2] = on ? INK_RGB[2] : 0;
        o[j + 3] = 255;
      }
    }
    ctx.putImageData(out, 0, 0);
  }

  function frameAt(t) { return (first + Math.floor((t - t0) * FPS / 1000)) % COUNT; }

  var running = false, raf = 0, paused = 0;
  function loop(t) { ease(t); draw(frameAt(t)); raf = requestAnimationFrame(loop); }
  function start() {
    if (running || reduce) return;
    running = true;
    bend.t = 0;
    var now = performance.now();
    t0 += paused ? now - paused : 0; // continue where it stopped
    raf = requestAnimationFrame(loop);
  }
  function stop() { if (!running) return; running = false; paused = performance.now(); cancelAnimationFrame(raf); }

  sheet.onload = function () {
    t0 = performance.now();
    draw(first);
    holder.classList.add("is-live");
    if (still) still.setAttribute("hidden", "");
    turnOn();
    if (reduce) return;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries[0].isIntersecting ? start() : stop();
      }).observe(holder);
    } else {
      start();
    }
  };
  sheet.onerror = turnOn;
  sheet.src = SHEET;
})();

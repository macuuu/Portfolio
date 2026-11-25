// Live dithered print: the arch facade capture is pulled slowly into a focus that follows the cursor.
// The image holds a smaller copy of itself in the middle, so one zoom step loops back to the start.
(function () {
  "use strict";

  var holder = document.querySelector(".masthead .print-live");
  if (!holder) return;
  var canvas = holder.querySelector("canvas");
  var still = holder.querySelector("img");
  var ctx = canvas && canvas.getContext("2d");
  if (!ctx) return;

  var SRC = "assets/img/ou/21-arch-modules.webp";
  var CROP = { x: 760, y: 0, s: 982 };   // square part of the capture with the stacked arches
  var TEX = 256;                          // texture size in pixels
  var N = 128;                            // output resolution, scaled up with pixelated rendering
  var K = 2.6;                            // the copy in the middle is 1/K of the frame
  var CYCLE = 30000;                      // milliseconds for one zoom step: slow on purpose

  canvas.width = N;
  canvas.height = N;
  var out = ctx.createImageData(N, N);
  var px = out.data;
  var tex = new Float32Array(TEX * TEX);

  // 8x8 Bayer matrix, normalised to 0..1
  var B = [0,32,8,40,2,34,10,42,48,16,56,24,50,18,58,26,12,44,4,36,14,46,6,38,60,28,52,20,62,30,54,22,
           3,35,11,43,1,33,9,41,51,19,59,27,49,17,57,25,15,47,7,39,13,45,5,37,63,31,55,23,61,29,53,21];
  var T = new Float32Array(64);
  for (var i = 0; i < 64; i++) T[i] = (B[i] + 0.5) / 64;

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Brightness of the texture at q in [-0.5, 0.5]; inside the middle it reads the nested copy
  var EDGE = 0.5 / K;
  // Every copy, the outer one too, has the same thin dark frame: the eye reads the depth,
  // and the image stays exactly self-similar, so the loop has no seam.
  function sample(qx, qy) {
    for (var depth = 0; depth < 14; depth++) {
      var m = Math.max(Math.abs(qx), Math.abs(qy));
      if (m > 0.47) return 0;
      if (m >= EDGE) break;
      qx *= K; qy *= K;
    }
    var x = Math.min(TEX - 1, Math.max(0, ((qx + 0.5) * TEX) | 0));
    var y = Math.min(TEX - 1, Math.max(0, ((qy + 0.5) * TEX) | 0));
    return tex[y * TEX + x];
  }

  // Fisheye pull: the radius around the focus is bent with a power curve, so the focus reads
  // deeper copies and the image seems to drain into it. The focus follows the cursor slowly,
  // like the eye of a designer who watches the player move through the level.
  var GAMMA = 1.6;                        // above 1: stronger pull into the focus
  var STREAKS = 4;                        // samples along the radius, short rays that keep the shape
  var SMEAR = 0.04;                       // distance between the streak samples
  var FOLLOW = 0.025;                     // how fast the focus moves to the cursor, per frame
  var REACH = 0.28;                       // how far the focus can move from the middle

  var fx = 0, fy = 0, tx = 0, ty = 0, lastMove = -1e9;
  window.addEventListener("pointermove", function (e) {
    var r = canvas.getBoundingClientRect();
    if (!r.width) return;
    tx = Math.max(-REACH, Math.min(REACH, (e.clientX - r.left) / r.width - 0.5));
    ty = Math.max(-REACH, Math.min(REACH, (e.clientY - r.top) / r.height - 0.5));
    lastMove = performance.now();
  }, { passive: true });

  function render(t) {
    var phase = reduce ? 0.35 : (t % CYCLE) / CYCLE;
    var z = Math.pow(K, 1 - phase);        // K -> 1: content shrinks into the centre, then loops seamlessly

    // No cursor for a while (or a touch screen): the eye drifts slowly on its own
    if (t - lastMove > 4000) {
      tx = Math.sin(t / 7300) * REACH * 0.6;
      ty = Math.sin(t / 5100 + 1) * REACH * 0.45;
    }
    fx += (tx - fx) * FOLLOW;
    fy += (ty - fy) * FOLLOW;

    var o = 0;
    for (var y = 0; y < N; y++) {
      var dy = (y + 0.5) / N - 0.5 - fy;
      for (var x = 0; x < N; x++) {
        var dx = (x + 0.5) / N - 0.5 - fx;
        var rn = Math.sqrt(dx * dx + dy * dy) * 2;
        var f = rn > 0 ? Math.pow(rn, GAMMA - 1) / z : 0;
        var sx = dx * f, sy = dy * f;
        var lum = 0, wsum = 0, w = 1;
        for (var s = 0; s < STREAKS; s++) {
          var k = 1 + s * SMEAR;          // the trail lies outward: the image moves in, rays point out
          lum += sample(sx * k, sy * k) * w;
          wsum += w;
          w *= 0.8;
        }
        lum = lum / wsum * Math.max(0, Math.min(1.2, 1.45 - rn * 0.75)); // bright focus, darker edge
        var on = lum > T[(y & 7) * 8 + (x & 7)];
        px[o] = on ? 255 : 0;
        px[o + 1] = on ? 42 : 0;
        px[o + 2] = on ? 42 : 0;
        px[o + 3] = 255;
        o += 4;
      }
    }
    ctx.putImageData(out, 0, 0);
  }

  // Read the capture into a grey texture with a print-like contrast curve
  var img = new Image();
  img.onload = function () {
    var c = document.createElement("canvas");
    c.width = TEX; c.height = TEX;
    var g = c.getContext("2d");
    g.drawImage(img, CROP.x, CROP.y, CROP.s, CROP.s, 0, 0, TEX, TEX);
    var d = g.getImageData(0, 0, TEX, TEX).data;
    for (var j = 0, k = 0; j < d.length; j += 4, k++) {
      var l = (0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2]) / 255;
      tex[k] = Math.max(0, Math.min(1, l * 1.9 - 0.12));
    }
    begin();
  };
  img.src = SRC;

  var running = false, raf = 0;
  function loop(t) { render(t); raf = requestAnimationFrame(loop); }
  function start() { if (!running && !reduce) { running = true; raf = requestAnimationFrame(loop); } }
  function stop() { running = false; cancelAnimationFrame(raf); }

  function begin() {
    render(performance.now());
    holder.classList.add("is-live");
    if (still) still.setAttribute("hidden", "");
    if (reduce) return;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries[0].isIntersecting ? start() : stop();
      }).observe(holder);
    } else {
      start();
    }
  }
})();

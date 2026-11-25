// Live dithered print: the arch facade capture is pulled slowly into its own centre, without end.
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
  var CYCLE = 16000;                      // milliseconds for one zoom step: slow on purpose

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
    for (var depth = 0; depth < 9; depth++) {
      var m = Math.max(Math.abs(qx), Math.abs(qy));
      if (m > 0.47) return 0;
      if (m >= EDGE) break;
      qx *= K; qy *= K;
    }
    var x = Math.min(TEX - 1, Math.max(0, ((qx + 0.5) * TEX) | 0));
    var y = Math.min(TEX - 1, Math.max(0, ((qy + 0.5) * TEX) | 0));
    return tex[y * TEX + x];
  }

  function render(t) {
    var phase = reduce ? 0.35 : (t % CYCLE) / CYCLE;
    var z = Math.pow(K, 1 - phase);        // K -> 1: content shrinks into the centre, then loops seamlessly
    var o = 0;
    for (var y = 0; y < N; y++) {
      var py = ((y + 0.5) / N - 0.5) / z;
      for (var x = 0; x < N; x++) {
        var pxq = ((x + 0.5) / N - 0.5) / z;
        var lum = sample(pxq, py);
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

// Live dithered print: a gameplay clip plays in the hero square as a red 1-bit print.
// Each frame is cropped to a square, read at 128x128, put through the print contrast curve
// and an 8x8 Bayer threshold. Every page load starts at a random moment; the clip loops.
(function () {
  "use strict";

  var holder = document.querySelector(".hero .print-live");
  if (!holder) return;
  var canvas = holder.querySelector("canvas");
  var still = holder.querySelector("img");
  var ctx = canvas && canvas.getContext("2d");
  if (!ctx) return;

  var SRC = holder.getAttribute("data-video");  // same-origin clip, for example assets/video/hero.mp4
  var N = 128;                                  // output resolution, scaled up with pixelated rendering
  var FRAME = 0.47;                             // content inside a thin dark frame, like the printed still
  // Black and white points of the clip (0..1): a dark clip is stretched to the full print range
  var LV = (holder.getAttribute("data-levels") || "0 1").split(/\s+/).map(Number);
  var LO = LV[0] || 0, SPAN = Math.max(0.01, (LV[1] || 1) - LO);

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!SRC || reduce) return; // the still print stays

  canvas.width = N;
  canvas.height = N;
  var out = ctx.createImageData(N, N);
  var px = out.data;

  // Small work canvas that receives the square crop of the current frame
  var work = document.createElement("canvas");
  work.width = N; work.height = N;
  var wctx = work.getContext("2d", { willReadFrequently: true });

  // 8x8 Bayer matrix, normalised to 0..1
  var B = [0,32,8,40,2,34,10,42,48,16,56,24,50,18,58,26,12,44,4,36,14,46,6,38,60,28,52,20,62,30,54,22,
           3,35,11,43,1,33,9,41,51,19,59,27,49,17,57,25,15,47,7,39,13,45,5,37,63,31,55,23,61,29,53,21];
  var T = new Float32Array(64);
  for (var i = 0; i < 64; i++) T[i] = (B[i] + 0.5) / 64;

  var video = document.createElement("video");
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "auto";
  video.setAttribute("muted", "");
  video.setAttribute("playsinline", "");

  function render() {
    var vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return;
    var s = Math.min(vw, vh);
    wctx.drawImage(video, (vw - s) / 2, (vh - s) / 2, s, s, 0, 0, N, N);
    var d = wctx.getImageData(0, 0, N, N).data;
    var o = 0;
    for (var y = 0; y < N; y++) {
      var qy = Math.abs((y + 0.5) / N - 0.5);
      for (var x = 0; x < N; x++) {
        var qx = Math.abs((x + 0.5) / N - 0.5);
        var on = false;
        if (qx <= FRAME && qy <= FRAME) {
          var l = ((0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2]) / 255 - LO) / SPAN;
          on = l > T[(y & 7) * 8 + (x & 7)];
        }
        px[o] = on ? 255 : 0;
        px[o + 1] = on ? 42 : 0;
        px[o + 2] = on ? 42 : 0;
        px[o + 3] = 255;
        o += 4;
      }
    }
    ctx.putImageData(out, 0, 0);
  }

  var running = false, raf = 0, shown = false;
  function loop() {
    render();
    if (!shown && video.currentTime > 0) {
      shown = true;
      holder.classList.add("is-live");
      if (still) still.setAttribute("hidden", "");
    }
    raf = requestAnimationFrame(loop);
  }
  function start() {
    if (running) return;
    running = true;
    var p = video.play();
    if (p && p.catch) p.catch(function () {});
    raf = requestAnimationFrame(loop);
  }
  function stop() { running = false; cancelAnimationFrame(raf); video.pause(); }

  // Random start on every load; the loop attribute starts again from 0 at the end
  video.addEventListener("loadedmetadata", function () {
    if (isFinite(video.duration) && video.duration > 2) video.currentTime = Math.random() * (video.duration - 1);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries[0].isIntersecting ? start() : stop();
      }).observe(holder);
    } else {
      start();
    }
  }, { once: true });

  video.src = SRC;
})();

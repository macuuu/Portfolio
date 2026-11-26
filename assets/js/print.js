// Live dithered print: the swirl loop plays in the hero square as a red 1-bit print.
// The frames are already dithered offline and packed in one sheet (12 columns, 128x128 each),
// so no video decoding or autoplay permission is needed. Every page load starts at a random frame.
// Intro: the square fades in first, then the page gets "is-on" and the typing log follows (log.js).
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

  // Draw one frame: the sheet is white on black, multiply turns white into the red ink
  function draw(i) {
    if (i === last) return;
    last = i;
    ctx.globalCompositeOperation = "copy";
    ctx.drawImage(sheet, (i % COLS) * N, Math.floor(i / COLS) * N, N, N, 0, 0, N, N);
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, N, N);
    ctx.globalCompositeOperation = "source-over";
  }

  function frameAt(t) { return (first + Math.floor((t - t0) * FPS / 1000)) % COUNT; }

  var running = false, raf = 0, paused = 0;
  function loop(t) { draw(frameAt(t)); raf = requestAnimationFrame(loop); }
  function start() {
    if (running || reduce) return;
    running = true;
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

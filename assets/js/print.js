// Live dithered print: a greybox corridor rendered per pixel, then ordered-dithered to one red ink.
(function () {
  "use strict";

  var holder = document.querySelector(".masthead .print-live");
  if (!holder) return;
  var canvas = holder.querySelector("canvas");
  var still = holder.querySelector("img");
  var ctx = canvas && canvas.getContext("2d");
  if (!ctx) return;

  var N = 112; // internal resolution, scaled up with pixelated rendering
  canvas.width = N;
  canvas.height = N;
  var img = ctx.createImageData(N, N);
  var px = img.data;

  // 8x8 Bayer matrix, normalised to 0..1
  var B = [0,32,8,40,2,34,10,42,48,16,56,24,50,18,58,26,12,44,4,36,14,46,6,38,60,28,52,20,62,30,54,22,
           3,35,11,43,1,33,9,41,51,19,59,27,49,17,57,25,15,47,7,39,13,45,5,37,63,31,55,23,61,29,53,21];
  var T = new Float32Array(64);
  for (var i = 0; i < 64; i++) T[i] = (B[i] + 0.5) / 64;

  var INK_R = 255, INK_G = 42, INK_B = 42;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Vanishing point follows the pointer, eased
  var vx = 0, vy = 0, tx = 0, ty = 0;
  window.addEventListener("pointermove", function (e) {
    tx = (e.clientX / window.innerWidth - 0.5) * 0.5;
    ty = (e.clientY / window.innerHeight - 0.5) * 0.35;
  }, { passive: true });

  function frac(x) { return x - Math.floor(x); }

  function render(t) {
    vx += (tx - vx) * 0.05;
    vy += (ty - vy) * 0.05;
    var speed = t * 0.00045;
    var spin = t * 0.00022;                // slow roll of the whole corridor
    var o = 0;
    for (var y = 0; y < N; y++) {
      var v0 = (y + 0.5) / N * 2 - 1 - vy;
      for (var x = 0; x < N; x++) {
        var u0 = (x + 0.5) / N * 2 - 1 - vx;
        // Twist grows with depth, so the frames spiral into the centre
        var r0 = Math.sqrt(u0 * u0 + v0 * v0) + 1e-4;
        var a = spin + 0.22 / (r0 + 0.25);
        var ca = Math.cos(a), sa = Math.sin(a);
        var u = u0 * ca - v0 * sa, v = u0 * sa + v0 * ca;
        // Corridor is a box: wider than tall, so floor and ceiling read as planes
        var ax = Math.abs(u) * 0.8, ay = Math.abs(v);
        var d = Math.max(ax, ay) + 1e-4;
        var z = 1 / d;                     // depth along the corridor
        var zw = z - speed * 9;            // frames are pulled away, into the depth

        // Rib frames every unit of depth: thin bright bands
        var rib = frac(zw);
        var ribLine = rib < 0.13 ? 1 : 0;

        // Wall grid: lines along the corridor on the active face
        var side = ax > ay ? v / d : u / d * 0.8;
        var grid = frac(side * 3 + 0.5);
        var gridLine = grid < 0.07 ? 0.7 : 0;
        // Floor tiles across depth on the floor plane only
        var floor = (ay >= ax && v > 0) ? (frac(zw * 2) < 0.12 ? 0.6 : 0) : 0;

        var fog = Math.exp(-z * 0.1);      // far walls fade out
        // Base shading per face: floor brightest, ceiling darkest
        var base = ay >= ax ? (v > 0 ? 0.3 : 0.08) : 0.17;
        var lum = Math.max(base, ribLine, gridLine, floor) * fog;

        // Light pools under the ribs, on the floor
        if (ay >= ax && v > 0) lum += 0.22 * fog * Math.max(0, 1 - Math.abs(rib - 0.5) * 2.6);

        // Streaks that rush into the centre along the corridor
        var ang = Math.atan2(v0, u0);
        var lane = frac(ang * 3.8197 + 0.5);              // 24 radial lanes
        var dash = frac(z * 0.5 - speed * 14 + Math.floor(ang * 3.8197) * 0.37);
        if (lane < 0.12 && dash < 0.18) lum += 0.55 * fog;

        // Exit light at the far end
        var r = Math.sqrt(u * u * 0.64 + v * v);
        lum += Math.max(0, 1 - r * 6) + 0.35 * Math.exp(-r * 4);

        // Slow breathing of the whole print
        lum *= 0.9 + 0.1 * Math.sin(t * 0.0012);

        var on = lum > T[(y & 7) * 8 + (x & 7)];
        px[o] = on ? INK_R : 0;
        px[o + 1] = on ? INK_G : 0;
        px[o + 2] = on ? INK_B : 0;
        px[o + 3] = 255;
        o += 4;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // Run only while the print is on screen
  var running = false, raf = 0;
  function loop(t) { render(t); raf = requestAnimationFrame(loop); }
  function start() { if (!running && !reduce) { running = true; raf = requestAnimationFrame(loop); } }
  function stop() { running = false; cancelAnimationFrame(raf); }

  render(0);
  holder.classList.add("is-live");
  if (still) still.setAttribute("hidden", "");

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      entries[0].isIntersecting ? start() : stop();
    }).observe(holder);
  } else {
    start();
  }
})();

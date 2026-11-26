// Snow from the swirls: while the cursor is over one of the hero eyes, red pixel flakes (the print ink) fall out of it.
// When the cursor leaves the eye, some flakes follow it for a short time.
// The cursor is a wind source: flakes near a moving cursor are pushed along its path.
// Every flake fades out and is removed about 5 seconds (4 to 6) after it is born.
(function () {
  "use strict";

  var hero = document.querySelector(".hero");
  var holders = hero ? [].slice.call(hero.querySelectorAll(".print-live")) : [];
  if (!holders.length) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var canvas = document.createElement("canvas");
  canvas.className = "snow-layer";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var LIFE = 5000;          // ms, mean lifetime of one flake
  var LIFE_JITTER = 1000;   // ms, each flake lives LIFE +/- this
  var FADE = 1200;          // ms, fade out at the end of the life
  var INK = "#ff2a2a";      // same red as the print (print.js)
  var RATE = 45;            // flakes per second while the cursor is over the swirl
  var MAX = 700;            // hard cap
  var WIND_R = 140;         // px, radius of the cursor wind
  var FOLLOW_SHARE = 0.4;   // share of flakes that follow the cursor when it leaves the swirl
  var FOLLOW_TIME = 2200;   // ms, how long the follow pull lasts

  var flakes = [];
  var dpr = 1, vw = 0, vh = 0;
  var mouse = { x: -1e4, y: -1e4, vx: 0, vy: 0, t: 0, inside: false, eye: null };
  var lastScroll = window.scrollY;
  var running = false, lastT = 0, emitAcc = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    vw = window.innerWidth;
    vh = window.innerHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
  }
  resize();
  window.addEventListener("resize", resize);

  // Flakes live in viewport space: shift them on scroll so they stay with the page
  window.addEventListener("scroll", function () {
    var dy = window.scrollY - lastScroll;
    lastScroll = window.scrollY;
    for (var i = 0; i < flakes.length; i++) flakes[i].y -= dy;
  }, { passive: true });

  // Each swirl is a disc in the middle of its square print. The mirrored eye spins the other way.
  function disc(holder) {
    var r = holder.getBoundingClientRect();
    return {
      cx: r.left + r.width / 2, cy: r.top + r.height / 2, r: r.width * 0.42, cell: r.width / 128,
      spin: holder.classList.contains("is-mirror") ? -1 : 1
    };
  }
  // The eye under the point, or null
  function eyeAt(x, y) {
    for (var i = 0; i < holders.length; i++) {
      var d = disc(holders[i]);
      var dx = x - d.cx, dy = y - d.cy;
      if (dx * dx + dy * dy <= d.r * d.r) return holders[i];
    }
    return null;
  }

  function spawn(now) {
    if (flakes.length >= MAX || !mouse.eye) return;
    var d = disc(mouse.eye);
    var a = Math.random() * Math.PI * 2;
    var rr = d.r * Math.sqrt(Math.random());
    var x = d.cx + Math.cos(a) * rr, y = d.cy + Math.sin(a) * rr;
    // Leave the swirl along its spin (tangent) with a small push outward
    var spin = d.spin * (40 + Math.random() * 50), out = 15 + Math.random() * 30;
    flakes.push({
      x: x, y: y,
      vx: -Math.sin(a) * spin + Math.cos(a) * out,
      vy: Math.cos(a) * spin + Math.sin(a) * out,
      size: d.cell, // exactly one print pixel
      born: now,
      life: LIFE + (Math.random() * 2 - 1) * LIFE_JITTER,
      phase: Math.random() * Math.PI * 2,
      sway: 6 + Math.random() * 10,
      follow: 0
    });
  }

  function onMove(e) {
    var now = performance.now();
    var dt = Math.max(8, now - mouse.t);
    if (mouse.t && now - mouse.t < 100) {
      // px per second, smoothed
      mouse.vx = mouse.vx * 0.5 + ((e.clientX - mouse.x) / dt * 1000) * 0.5;
      mouse.vy = mouse.vy * 0.5 + ((e.clientY - mouse.y) / dt * 1000) * 0.5;
    } else {
      mouse.vx = mouse.vy = 0;
    }
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.t = now;

    mouse.eye = hero.classList.contains("is-on") ? eyeAt(mouse.x, mouse.y) : null;
    var inside = !!mouse.eye;
    if (mouse.inside && !inside) {
      // Leaving the swirl: a part of the flakes chases the cursor
      for (var i = 0; i < flakes.length; i++) {
        if (Math.random() < FOLLOW_SHARE) flakes[i].follow = now;
      }
    }
    mouse.inside = inside;
    if (inside || flakes.length) start();
  }
  window.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerleave", function () { mouse.inside = false; mouse.eye = null; mouse.x = mouse.y = -1e4; });

  function start() {
    if (running) return;
    running = true;
    lastT = performance.now();
    requestAnimationFrame(tick);
  }

  function tick(now) {
    var dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;

    if (mouse.inside) {
      emitAcc += RATE * dt;
      while (emitAcc >= 1) { spawn(now); emitAcc -= 1; }
    } else {
      emitAcc = 0;
    }

    // Cursor wind fades quickly when the cursor stops
    var idle = now - mouse.t;
    var windScale = idle > 60 ? Math.max(0, 1 - (idle - 60) / 200) : 1;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);
    ctx.fillStyle = INK;

    var alive = 0;
    for (var i = 0; i < flakes.length; i++) {
      var f = flakes[i];
      var age = now - f.born;
      if (age >= f.life) continue;

      // Snow: slow fall, air drag, a soft side sway
      f.vy += 22 * dt;
      f.vx += Math.sin(now / 700 + f.phase) * f.sway * dt;

      var dx = f.x - mouse.x, dy = f.y - mouse.y;
      var dist = Math.sqrt(dx * dx + dy * dy);

      // Wind: the moving cursor drags nearby flakes with it
      if (windScale > 0 && dist < WIND_R) {
        var w = (1 - dist / WIND_R) * windScale * 5 * dt;
        f.vx += mouse.vx * w;
        f.vy += mouse.vy * w;
      }

      // Follow: pull toward the cursor, weaker with time
      if (f.follow) {
        var ft = (now - f.follow) / FOLLOW_TIME;
        if (ft >= 1) {
          f.follow = 0;
        } else if (dist > 20) {
          var pull = (1 - ft) * 260 * dt / dist;
          f.vx -= dx * pull;
          f.vy -= dy * pull;
        }
      }

      var drag = Math.pow(0.35, dt);
      f.vx *= drag;
      f.vy *= drag;
      f.x += f.vx * dt;
      f.y += f.vy * dt;

      var a = age > f.life - FADE ? (f.life - age) / FADE : Math.min(1, age / 200);
      ctx.globalAlpha = a;
      var s = f.size;
      ctx.fillRect(Math.round(f.x - s / 2), Math.round(f.y - s / 2), s, s);

      flakes[alive++] = f;
    }
    flakes.length = alive;
    ctx.globalAlpha = 1;

    if (alive || mouse.inside) {
      requestAnimationFrame(tick);
    } else {
      running = false;
      ctx.clearRect(0, 0, vw, vh);
    }
  }
})();

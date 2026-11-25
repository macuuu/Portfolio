// Typing log in the hero: the player acts, the level answers.
(function () {
  "use strict";

  var log = document.querySelector(".signal-log");
  if (!log) return;
  var act = log.querySelector(".log-act");
  var res = log.querySelector(".log-res");
  if (!act || !res) return;

  var MOMENTS = [
    ["gets lost", "a light shaft marks the way"],
    ["explores a side room", "a hidden view of the dam"],
    ["takes cover", "cover at the right height"],
    ["looks up", "the route seen from above"],
    ["pushes forward", "a corridor opens into a hall"],
    ["lingers in the dark", "red lights start to flicker"]
  ];

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return; // the first moment stays as static text

  var caret = document.createElement("span");
  caret.className = "caret";

  var run = 0, step = 1, timer = 0;

  function wait(ms, fn) { timer = setTimeout(fn, ms); }

  // Type text into el one character at a time, the caret follows the text
  function type(el, text, speed, id, done) {
    var i = 0;
    el.textContent = "";
    el.appendChild(caret);
    (function tick() {
      if (id !== run) return;
      if (i < text.length) {
        caret.insertAdjacentText("beforebegin", text.charAt(i++));
        wait(speed + Math.random() * speed, tick);
      } else done();
    })();
  }

  function cycle() {
    var id = ++run;
    var m = MOMENTS[step % MOMENTS.length];
    step++;
    res.textContent = "";
    type(act, "player " + m[0], 38, id, function () {
      wait(650, function () {
        type(res, "level: " + m[1], 30, id, function () {
          wait(2600, function () { if (id === run) cycle(); });
        });
      });
    });
  }

  // Start with the static first moment on screen, then type the next ones while visible
  function start() { if (!run) wait(2200, cycle); else cycle(); }
  function stop() { run++; clearTimeout(timer); caret.remove(); }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) { en[0].isIntersecting ? start() : stop(); }).observe(log);
  } else start();
})();

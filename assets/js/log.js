// Typing log in the hero: the player acts, the level answers.
// Moments are generated from situations: any action in a situation fits any answer in it,
// so the pairs always make sense and the log seems to never repeat.
(function () {
  "use strict";

  var log = document.querySelector(".signal-log");
  if (!log) return;
  var act = log.querySelector(".log-act");
  var res = log.querySelector(".log-res");
  if (!act || !res) return;

  var SITUATIONS = [
    { // lost: the level guides without signs
      act: ["gets lost", "hesitates at a junction", "turns around twice", "stops in a dark hall",
            "walks into a dead end", "cannot find the exit", "circles the same room"],
      res: ["a light shaft marks the way", "a red lamp pulls the eye to the door", "the dam wall shows above the roofs",
            "the fog thins over the right path", "a cable on the floor leads to the exit", "the only lit doorway says go here",
            "a draft moves the dust toward the stairs", "a railing points at the next catwalk"]
    },
    { // curious: exploration pays off
      act: ["explores a side room", "climbs a ladder nobody uses", "looks behind the generator", "checks a dead end",
            "crawls under a broken pipe", "opens a locker", "follows a narrow ledge"],
      res: ["a hidden view of the dam", "ammo under a broken stair", "a note that explains the flood",
            "a shortcut back to the hub", "a window into the next fight", "a quiet room nobody else found",
            "a lever that opens an old gate", "the first look at the turbine hall"]
    },
    { // combat: fair, readable spaces
      act: ["takes cover", "flanks left", "falls back", "peeks over a crate", "runs out of ammo",
            "gets pinned down", "pushes the last enemy"],
      res: ["cover at the right height", "a second route around the enemy", "a railing that breaks the line of fire",
            "high ground with a clear view", "a resupply in a lit alcove", "a door to fall back through",
            "pillars that let them move between shots", "a long sightline they can control"]
    },
    { // looking: orientation and reveals
      act: ["looks up", "looks down from a catwalk", "stops at a window", "leans over a railing",
            "reaches the top of the stairs", "steps out of a tunnel"],
      res: ["the route seen from above", "the next goal framed by a door", "the turbine hall opens below",
            "the whole dam in one view", "a light far away to walk toward", "the path they came from, far below"]
    },
    { // momentum: pacing and payoff
      act: ["pushes forward", "sprints down a corridor", "opens a heavy door", "drops into a shaft",
            "rides the elevator down", "crosses the flooded floor"],
      res: ["a corridor opens into a hall", "the space goes quiet for a moment", "a long view across the flooded layer",
            "the ceiling rises, the room breathes", "a slow reveal of the generator hangar", "light returns after a dark stretch"]
    },
    { // dread: tension through space and light
      act: ["lingers in the dark", "walks into a flooded room", "hears something behind a wall",
            "passes the mannequin gallery", "turns off the flashlight", "waits too long"],
      res: ["red lights start to flicker", "the water doubles every light", "a door closes far behind",
            "the figures seem closer than before", "the hum of the turbines stops", "one lamp at a time goes out"]
    },
    { // rest: the level gives a breath
      act: ["finds a quiet corner", "stops to heal", "survives a hard fight", "sits on a stair"],
      res: ["a safe room with soft white light", "a bench under the only working lamp",
            "a view outside, the first daylight", "silence and a clear way forward"]
    },
    { // return: backtracking feels new
      act: ["goes back the same way", "returns to the hub", "retraces their steps"],
      res: ["the space looks new from the other side", "a gate opened by the last fight",
            "a shortcut they unlocked earlier", "the hub, seen from a new height"]
    }
  ];

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return; // the first moment stays as static text

  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  // Avoid repeats: remember the last pairs and situations
  var recent = [], lastSituation = -1;
  function nextMoment() {
    for (var tries = 0; tries < 40; tries++) {
      var si = Math.floor(Math.random() * SITUATIONS.length);
      if (si === lastSituation) continue;
      var s = SITUATIONS[si], a = pick(s.act), r = pick(s.res);
      if (recent.indexOf(a) >= 0 || recent.indexOf(r) >= 0) continue;
      lastSituation = si;
      recent.push(a, r);
      if (recent.length > 24) recent.splice(0, 2);
      return [a, r];
    }
    return [pick(SITUATIONS[0].act), pick(SITUATIONS[0].res)];
  }

  var caret = document.createElement("span");
  caret.className = "caret";
  var run = 0, timer = 0;

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
    var m = nextMoment();
    res.textContent = "";
    type(act, "player " + m[0], 36, id, function () {
      wait(600, function () {
        type(res, "level: " + m[1], 28, id, function () {
          wait(2600, function () { if (id === run) cycle(); });
        });
      });
    });
  }

  // Intro: the line stays empty until the print square has faded in (print.js sends "hero:on"),
  // then the caret blinks for a beat and the first moment is typed.
  var INTRO_WAIT = 2200, CARET_WAIT = 900;
  var hero = document.querySelector(".hero");
  var ready = false, visible = true;

  act.textContent = "";
  res.textContent = "";
  log.classList.add("is-waiting");

  function start() { if (ready && visible) cycle(); }
  function stop() { run++; clearTimeout(timer); }

  function intro() {
    // Own timers: scrolling away during the intro must not cancel it
    setTimeout(function () {
      log.classList.remove("is-waiting");
      act.appendChild(caret);
      setTimeout(function () { ready = true; start(); }, CARET_WAIT);
    }, INTRO_WAIT);
  }
  if (hero && hero.classList.contains("is-on")) intro();
  else document.addEventListener("hero:on", intro, { once: true });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting;
      visible ? start() : stop();
    }).observe(log);
  }
})();

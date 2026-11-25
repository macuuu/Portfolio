// Small helpers: mobile nav, lightbox, scroll reveal, table of contents highlight.
(function () {
  "use strict";

  // Mobile navigation
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") nav.classList.remove("open");
    });
  }

  // Lightbox for every image marked with data-zoom
  var items = Array.prototype.slice.call(document.querySelectorAll("[data-zoom]"));
  if (items.length) {
    var box = document.createElement("div");
    box.className = "lightbox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.innerHTML =
      '<button class="lb-close" aria-label="Close">&times;</button>' +
      '<button class="lb-prev" aria-label="Previous">&#8592;</button>' +
      '<button class="lb-next" aria-label="Next">&#8594;</button>' +
      '<img alt=""><p class="lb-caption"></p>';
    document.body.appendChild(box);
    var img = box.querySelector("img");
    var cap = box.querySelector(".lb-caption");
    var index = 0;

    function captionFor(el) {
      var fig = el.closest("figure");
      var fc = fig && fig.querySelector("figcaption");
      return fc ? fc.textContent : el.getAttribute("alt") || "";
    }
    function show(i) {
      index = (i + items.length) % items.length;
      var el = items[index];
      img.src = el.getAttribute("src");
      img.alt = el.getAttribute("alt") || "";
      cap.textContent = captionFor(el);
    }
    function open(i) { show(i); box.classList.add("open"); document.body.style.overflow = "hidden"; }
    function close() { box.classList.remove("open"); document.body.style.overflow = ""; }

    items.forEach(function (el, i) {
      el.addEventListener("click", function () { open(i); });
    });
    box.querySelector(".lb-close").addEventListener("click", close);
    box.querySelector(".lb-prev").addEventListener("click", function () { show(index - 1); });
    box.querySelector(".lb-next").addEventListener("click", function () { show(index + 1); });
    box.addEventListener("click", function (e) { if (e.target === box) close(); });
    document.addEventListener("keydown", function (e) {
      if (!box.classList.contains("open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") show(index - 1);
      if (e.key === "ArrowRight") show(index + 1);
    });
  }

  // Reveal on scroll
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  // Highlight the active chapter in the table of contents
  var tocLinks = document.querySelectorAll(".toc a");
  if (tocLinks.length && "IntersectionObserver" in window) {
    var map = {};
    tocLinks.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          tocLinks.forEach(function (a) { a.classList.remove("active"); });
          var link = map[en.target.id];
          if (link) link.classList.add("active");
        }
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    Object.keys(map).forEach(function (id) {
      var sec = document.getElementById(id);
      if (sec) spy.observe(sec);
    });
  }

  // Contact: flash the contact buttons when the visitor asks for them
  var contactLinks = document.querySelector("#contact .contact-links");
  function flashContact(delay) {
    if (!contactLinks) return;
    setTimeout(function () {
      contactLinks.classList.remove("flash");
      void contactLinks.offsetWidth; // restart the animation
      contactLinks.classList.add("flash");
    }, delay);
  }
  if (contactLinks) {
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('a[href="#contact"]');
      if (a) flashContact(450);
    });
    if (location.hash === "#contact") flashContact(700);
  }

  // Current year in footer
  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
})();

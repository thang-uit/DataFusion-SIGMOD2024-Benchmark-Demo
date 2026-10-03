/* Page chrome: theme, table of contents, reading progress, copy buttons, lightbox, glossary, quiz. */
"use strict";

(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const root = document.documentElement;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  /* ---------- theme ---------- */
  function currentTheme() {
    if (root.dataset.theme) return root.dataset.theme;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function applyThemeColor() {
    const meta = $$('meta[name="theme-color"]');
    const color = getComputedStyle(root).getPropertyValue("--bg").trim();
    meta.forEach((m) => m.setAttribute("content", color));
  }
  $("#themeToggle").addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("df-theme", next); } catch (e) { /* storage blocked: theme lasts for this visit only */ }
    applyThemeColor();
    window.dispatchEvent(new Event("df-theme-change"));
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (!root.dataset.theme) { applyThemeColor(); window.dispatchEvent(new Event("df-theme-change")); }
  });

  /* ---------- TOC drawer (mobile) ---------- */
  const toc = $("#toc"), tocBtn = $("#tocBtn"), backdrop = $("#tocBackdrop");
  function setDrawer(open) {
    toc.classList.toggle("open", open);
    backdrop.classList.toggle("show", open);
    tocBtn.setAttribute("aria-expanded", String(open));
    if (open) { const first = $("a", toc); if (first) first.focus(); } else if (document.activeElement && toc.contains(document.activeElement)) tocBtn.focus();
  }
  tocBtn.addEventListener("click", () => setDrawer(!toc.classList.contains("open")));
  backdrop.addEventListener("click", () => setDrawer(false));
  toc.addEventListener("click", (e) => { if (e.target.closest("a") && window.matchMedia("(max-width: 1080px)").matches) setDrawer(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && toc.classList.contains("open")) setDrawer(false); });

  /* ---------- scrollspy (IntersectionObserver: no layout reads while scrolling) ---------- */
  const links = $$("a[href^='#']", toc);
  const linkFor = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]));
  const targets = links.map((a) => document.getElementById(a.getAttribute("href").slice(1))).filter(Boolean);
  const visible = new Set();
  let activeId = "";
  function setActive(id) {
    if (!id || id === activeId) return;
    activeId = id;
    links.forEach((a) => a.classList.remove("active"));
    const link = linkFor.get(id);
    if (!link) return;
    link.classList.add("active");
    const parent = link.closest("ol")?.closest("li")?.querySelector(":scope > a");
    if (parent) parent.classList.add("active");
    if (toc.scrollHeight > toc.clientHeight) {
      const r = link.getBoundingClientRect(), tr = toc.getBoundingClientRect();
      if (r.top < tr.top + 40 || r.bottom > tr.bottom - 40) link.scrollIntoView({ block: "nearest" });
    }
  }
  // A heading counts as "current" once it passes the top 35% of the viewport.
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
    const above = targets.filter((t) => visible.has(t) || t.getBoundingClientRect().top < 0);
    const current = [...visible].sort((a, b) => targets.indexOf(a) - targets.indexOf(b))[0] || above[above.length - 1];
    if (current) setActive(current.id);
  }, { rootMargin: "0px 0px -65% 0px" });
  targets.forEach((t) => spy.observe(t));

  /* ---------- progress + back to top ---------- */
  const progress = $("#progress"), toTop = $("#toTop");
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
      toTop.classList.toggle("show", window.scrollY > 900);
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  toTop.addEventListener("click", () => { window.scrollTo({ top: 0 }); $("#heroTitle").focus({ preventScroll: true }); });
  $("#heroTitle").tabIndex = -1;

  /* ---------- copy buttons ---------- */
  $$(".terminal .copy").forEach((btn) => btn.addEventListener("click", async () => {
    const pre = btn.closest(".terminal").querySelector("pre");
    try {
      await navigator.clipboard.writeText(pre.innerText);
      btn.textContent = "Đã sao chép";
    } catch (e) {
      btn.textContent = "Không sao chép được";
    }
    setTimeout(() => { btn.textContent = "Sao chép"; }, 1600);
  }));

  /* ---------- lightbox ---------- */
  const lb = $("#lightbox"), lbImg = $("#lbImg"), lbCap = $("#lbCaption");
  let lastTrigger = null;
  $$("[data-zoom]").forEach((btn) => btn.addEventListener("click", () => {
    lastTrigger = btn;
    const img = $("img", btn);
    lbImg.src = btn.dataset.zoom;
    lbImg.alt = img ? img.alt : "";
    lbCap.textContent = img ? img.alt : "";
    if (typeof lb.showModal === "function") lb.showModal(); else window.open(btn.dataset.zoom, "_blank", "noopener");
  }));
  $("#lbClose").addEventListener("click", () => lb.close());
  lb.addEventListener("click", (e) => { if (e.target === lb) lb.close(); });
  lb.addEventListener("close", () => { if (lastTrigger) lastTrigger.focus(); });

  /* ---------- glossary ---------- */
  const gList = $("#glossList"), gSearch = $("#glossSearch");
  const normalize = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
  function renderGlossary() {
    const q = normalize(gSearch.value.trim());
    const items = DF.GLOSSARY.filter(([t, d]) => !q || normalize(t + " " + d).includes(q));
    gList.replaceChildren();
    if (!items.length) { gList.append(el("p", "gloss-empty", "Không có thuật ngữ khớp. Thử từ khoá ngắn hơn, ví dụ “join” hoặc “parquet”.")); return; }
    items.forEach(([term, def, sec]) => {
      const card = el("div", "gloss-item");
      const a = el("a", null, "Đọc trong bài →");
      a.href = `#${sec}`;
      card.append(el("b", null, term), document.createTextNode(def + " "), a);
      gList.append(card);
    });
  }
  let gTimer = 0;
  gSearch.addEventListener("input", () => { clearTimeout(gTimer); gTimer = setTimeout(renderGlossary, 150); });
  renderGlossary();

  /* ---------- quiz ---------- */
  const quizBox = $("#quizBox"), score = $("#quizScore");
  let answered = 0, correct = 0;
  DF.QUIZ.forEach((item, qi) => {
    const wrap = el("div", "quiz-q");
    wrap.append(el("p", null, `${qi + 1}. ${item.q}`));
    const opts = el("div", "quiz-opts");
    item.opts.forEach((text, oi) => {
      const b = el("button", null, text); b.type = "button";
      b.addEventListener("click", () => {
        if (wrap.classList.contains("answered")) return;
        wrap.classList.add("answered");
        answered++;
        if (oi === item.a) correct++;
        $$("button", opts).forEach((x, xi) => { x.disabled = true; if (xi === item.a) x.classList.add("correct"); else if (xi === oi) x.classList.add("wrong"); });
        score.textContent = `Đúng ${correct}/${answered} câu đã trả lời (tổng ${DF.QUIZ.length} câu).`;
      });
      opts.append(b);
    });
    wrap.append(opts, el("div", "quiz-explain", `Giải thích: ${item.why}`));
    quizBox.append(wrap);
  });

  applyThemeColor();
  onScroll();
})();

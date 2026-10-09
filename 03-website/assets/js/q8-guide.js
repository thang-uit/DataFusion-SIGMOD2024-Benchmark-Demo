"use strict";

(() => {
  function init() {
    const root = document.getElementById("q8Guide");
    if (!root) return;

    const stages = [...root.querySelectorAll("[data-q8-stage]")];
    const next = document.getElementById("q8Next");
    const replay = document.getElementById("q8Replay");
    const status = document.getElementById("q8Status");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const names = ["quét Parquet", "lọc các dòng", "gom nhóm và đếm", "sắp xếp kết quả"];
    let step = 0;
    let timer = null;

    function stop() {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      replay.textContent = "Tự chạy";
    }

    function showStep() {
      stages.forEach((stage, index) => {
        stage.classList.toggle("is-current", index === step);
        stage.classList.toggle("is-done", index < step);
        if (index === step) stage.setAttribute("aria-current", "step");
        else stage.removeAttribute("aria-current");
      });
      root.style.setProperty("--q8-progress", `${((step + 1) / stages.length) * 100}%`);
      status.textContent = `Bước ${step + 1}/${stages.length}: ${names[step]}`;
      next.disabled = step === stages.length - 1;
    }

    next.addEventListener("click", () => {
      stop();
      if (step < stages.length - 1) step += 1;
      showStep();
    });

    replay.addEventListener("click", () => {
      if (timer !== null) {
        stop();
        return;
      }
      if (reducedMotion.matches) {
        step = stages.length - 1;
        showStep();
        return;
      }
      step = 0;
      showStep();
      replay.textContent = "Dừng";
      timer = window.setInterval(() => {
        if (step === stages.length - 1) {
          stop();
          return;
        }
        step += 1;
        showStep();
      }, 1800);
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop();
    });
    reducedMotion.addEventListener("change", () => {
      if (reducedMotion.matches) stop();
    });

    showStep();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

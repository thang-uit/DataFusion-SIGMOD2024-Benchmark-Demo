/* Interactive widgets. Each init function is independent and no-ops when its root is missing.
   innerHTML is only ever fed static strings from data.js; user input goes through textContent. */
"use strict";

(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fmt = (n, d = 2) => n.toLocaleString("vi-VN", { minimumFractionDigits: d, maximumFractionDigits: d });
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  /** Wire a segmented control: buttons with data-<attr>, calls onChange(value). */
  function segmented(root, attr, onChange) {
    const buttons = $$(`[data-${attr}]`, root);
    buttons.forEach((b) => b.addEventListener("click", () => {
      buttons.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      onChange(b.dataset[attr]);
    }));
  }

  /* ---------- Fig 1 ---------- */
  function initFig1() {
    const root = $("#fig1");
    if (!root) return;
    const fig = $(".fig1", root);
    segmented(root, "focus", (v) => { fig.dataset.focus = v; });
  }

  /* ---------- Row vs column layout (2.1) ---------- */
  function initMemLayout() {
    const root = $("#memLayout");
    if (!root) return;
    const strip = $("#memStrip"), readout = $("#memReadout");
    const rows = [["1", "Hà Nội", "31"], ["2", "Huế", "NULL"], ["3", "Đà Nẵng", "29"], ["4", "Cần Thơ", "33"]];
    let layout = "row";
    const cells = [];
    rows.forEach((r, ri) => r.forEach((v, ci) => {
      const c = el("div", `memcell c${ci}${v === "NULL" ? " null" : ""}`, v);
      c.dataset.r = ri; c.dataset.c = ci;
      strip.appendChild(c);
      cells.push(c);
    }));
    function place() {
      const slotW = strip.clientWidth / 12;
      cells.forEach((c) => {
        const r = Number(c.dataset.r), col = Number(c.dataset.c);
        const slot = layout === "row" ? r * 3 + col : col * 4 + r;
        c.style.transform = `translateX(${slot * slotW}px)`;
        c.dataset.slot = slot;
      });
    }
    segmented(root, "layout", (v) => { layout = v; cells.forEach((c) => c.classList.remove("read")); place(); readout.textContent = v === "row" ? "Theo dòng: mỗi bản ghi nằm liền nhau (id, thành phố, nhiệt độ)." : "Theo cột (Arrow): mọi giá trị của một cột nằm liền nhau."; });
    $("#memQuery").addEventListener("click", () => {
      cells.forEach((c) => c.classList.toggle("read", c.dataset.c === "2"));
      const slots = cells.filter((c) => c.dataset.c === "2").map((c) => Number(c.dataset.slot)).sort((a, b) => a - b);
      const contiguous = slots[slots.length - 1] - slots[0] === slots.length - 1;
      readout.innerHTML = contiguous
        ? "Cột theo cột: 4 ô cần đọc <b>nằm liền nhau</b> (ô 8–11). CPU đọc một mạch, cache và SIMD tận dụng tốt. NULL được bỏ qua nhờ validity bitmap <b>1 0 1 1</b>. AVG = (31 + 29 + 33) / 3 = 31."
        : "Theo dòng: 4 ô cần đọc <b>nằm rải rác</b> (ô 2, 5, 8, 11), xen giữa là id và tên thành phố không cần đến — tốn băng thông bộ nhớ. AVG = 31.";
    });
    new ResizeObserver(place).observe(strip);
    place();
  }

  /* ---------- Spark + Comet (3.1) ---------- */
  function initSpark() {
    const root = $("#sparkDemo");
    if (!root) return;
    const bridge = $('[data-swap="bridge"]', root), engine = $('[data-swap="engine"]', root), readout = $("#sparkReadout");
    segmented(root, "mode", (m) => {
      const comet = m === "comet";
      bridge.className = `layer ${comet ? "bridge" : "kept"}`;
      bridge.innerHTML = comet ? "Dịch sang ExecutionPlan của DataFusion <small>qua JNI, dữ liệu Arrow zero-copy</small>" : "Kế hoạch vật lý của Spark <small>giữ nguyên</small>";
      engine.className = `layer ${comet ? "swapped" : "kept"}`;
      engine.innerHTML = comet ? "Thực thi native bằng DataFusion (Rust) <small>+ biểu thức riêng cho ngữ nghĩa Spark</small>" : "Thực thi trên JVM (Java/Scala) <small>chi phí JVM</small>";
      readout.textContent = comet ? "Ba tầng trên của Spark không đổi; chỉ tầng thực thi được thay. Chỗ Spark khác chuẩn (ví dụ decimal) được ghi đè bằng API mở rộng (mục 7)." : "Toàn bộ chạy trong JVM.";
    });
  }

  /* ---------- LLVM parallel (4.1) ---------- */
  function initLlvm() {
    const root = $("#llvmDemo");
    if (!root) return;
    segmented(root, "mode", (m) => { root.dataset.mode = m; });
  }

  /* ---------- Architecture explorer (5.1) ---------- */
  function initArch() {
    const root = $("#arch");
    if (!root) return;
    const detail = $("#archDetail"), nodes = $$(".node", root);
    nodes.forEach((n) => n.addEventListener("click", () => {
      nodes.forEach((x) => x.setAttribute("aria-pressed", String(x === n)));
      const [name, sec, desc] = DF.ARCH[n.dataset.key];
      const kind = n.classList.contains("ext") ? '<span class="tag-blue">Mở rộng</span>' : '<span class="tag-green">Dựng sẵn</span>';
      detail.innerHTML = `<b>${name}</b> · ${kind} · mục ${sec}<br>${desc}`;
    }));
    nodes.forEach((n) => n.setAttribute("aria-pressed", "false"));
  }

  /* ---------- Query lifecycle (5.1) ---------- */
  const highlight = (code) => code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/&lt;h&gt;/g, '<span class="h">').replace(/&lt;\/h&gt;/g, "</span>");

  function initLifecycle() {
    const root = $("#lifecycle");
    if (!root) return;
    const buttons = $$(".stepper button", root), text = $("#stepText"), code = $("#stepCode"), title = $("#stepCodeTitle");
    function show(i) {
      buttons.forEach((b, j) => { b.setAttribute("aria-pressed", String(j === i)); b.classList.toggle("done", j < i); });
      const s = DF.LIFECYCLE[i];
      text.innerHTML = `<p>${s.text}</p><p style="font-size:.85rem;color:var(--ink-3)">Bước ${i + 1}/6 trong danh sách của mục 5.1.</p>`;
      title.textContent = s.title;
      code.innerHTML = highlight(s.code);
    }
    buttons.forEach((b, i) => b.addEventListener("click", () => show(i)));
    show(0);
  }

  /* ---------- SQL vs DataFrame (5.3.3) ---------- */
  function initFrontEnd() {
    const root = $("#feDemo");
    if (!root) return;
    const show = (k) => { $("#feTitle").textContent = DF.FE[k].title; $("#feCode").textContent = DF.FE[k].code; };
    segmented(root, "fe", show);
    show("sql");
  }

  /* ---------- Pull-based streaming (5.5.1) ---------- */
  function initStream() {
    const root = $("#streamDemo");
    if (!root) return;
    const ops = $("#streamOps"), log = $("#streamLog");
    const opEl = (k) => $(`[data-op="${k}"]`, ops);
    const TOTAL_BATCHES = 5, BATCH_ROWS = 8192;
    const passRates = [0.62, 0.55, 0.71, 0.48, 0.66]; // fraction passing amount > 100 per batch (illustrative)
    let next = 0, absorbed = 0, done = false, busy = false, timer = 0;

    function write(line) { const d = el("div", null, line); log.appendChild(d); log.scrollTop = log.scrollHeight; }
    function yOf(k) { const o = opEl(k); return o.offsetTop + o.offsetHeight / 2 - 9; }
    function pulse(k) { const o = opEl(k); o.classList.remove("pulse"); void o.offsetWidth; o.classList.add("pulse"); }
    const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion() ? 0 : ms));

    // Only transform/opacity are animated (GPU-friendly): position = translate, batch size = scaleX.
    const place = (b, y, scale) => { b.dataset.y = y; b.dataset.s = scale; b.style.transform = `translate(-50%, ${y}px) scaleX(${scale})`; };
    async function moveBatch(fromK, toK, scale, color) {
      const b = el("div", "batch");
      if (color) b.style.background = color;
      b.style.top = "0px";
      place(b, yOf(fromK), scale);
      ops.appendChild(b);
      await wait(30);
      place(b, yOf(toK), scale);
      await wait(720);
      return b;
    }

    async function step() {
      if (busy || done) return;
      busy = true;
      pulse("agg");
      if (next >= TOTAL_BATCHES) {
        write("Aggregate.next() → Filter.next() → Scan.next() → None (hết dữ liệu)");
        write(`Aggregate đã nuốt đủ ${absorbed.toLocaleString("vi-VN")} dòng → bây giờ mới xuất 1 batch kết quả (5 nhóm).`);
        const out = await moveBatch("agg", "agg", 0.35, "var(--hl)");
        place(out, -30, 0.35); out.style.opacity = "0";
        await wait(600); out.remove();
        done = true; busy = false; stopAuto();
        return;
      }
      write(`Aggregate.next() → Filter.next() → Scan.next()`);
      await wait(250); pulse("filter"); await wait(250); pulse("scan");
      const b = await moveBatch("scan", "filter", 1);
      const kept = Math.round(BATCH_ROWS * passRates[next]);
      write(`  Scan trả batch #${next + 1}: ${BATCH_ROWS} dòng · Filter giữ ${kept} dòng`);
      place(b, yOf("filter"), passRates[next]);
      await wait(400);
      place(b, yOf("agg"), passRates[next]);
      await wait(720);
      b.style.opacity = "0";
      absorbed += kept;
      write(`  Aggregate cập nhật bảng băm, chưa xuất gì (pipeline breaker).`);
      await wait(300); b.remove();
      next++; busy = false;
    }

    function stopAuto() { clearInterval(timer); timer = 0; $("#streamAuto").setAttribute("aria-pressed", "false"); $("#streamAuto").textContent = "Tự chạy"; }
    $("#streamStep").addEventListener("click", step);
    $("#streamAuto").addEventListener("click", (e) => {
      if (timer) { stopAuto(); return; }
      e.currentTarget.setAttribute("aria-pressed", "true"); e.currentTarget.textContent = "Dừng";
      step(); timer = setInterval(step, 2600);
    });
    $("#streamReset").addEventListener("click", () => {
      stopAuto(); next = 0; absorbed = 0; done = false; busy = false;
      $$(".batch", ops).forEach((b) => b.remove());
      log.replaceChildren(el("div", null, `Sẵn sàng. Tệp có ${TOTAL_BATCHES} batch × ${BATCH_ROWS} dòng.`));
    });
  }

  /* ---------- Partitions (5.5.2) ---------- */
  function initPartitions() {
    const root = $("#partDemo");
    if (!root) return;
    const range = $("#partRange"), lanes = $("#lanes");
    const TOTAL = 32, PER_BATCH_S = 0.25, OVERHEAD_S = 0.06; // illustrative constants
    const model = (p) => { const per = Math.ceil(TOTAL / p); return { per, time: per * PER_BATCH_S + (p - 1) * OVERHEAD_S }; };
    function build() {
      const p = Number(range.value), m = model(p), base = model(1).time;
      $("#partVal").textContent = p;
      $("#partBatches").textContent = m.per;
      $("#partTime").textContent = `${fmt(m.time, 1)} s`;
      $("#partSpeed").textContent = `${fmt(base / m.time, 1)}×`;
      lanes.replaceChildren();
      for (let i = 0; i < p; i++) {
        const lane = el("div", "lane");
        lane.append(el("span", null, `Partition ${i}`));
        const track = el("div", "lane-track"); track.append(el("div", "lane-fill"));
        lane.append(track); lanes.append(lane);
      }
    }
    function run() {
      const m = model(Number(range.value));
      $$(".lane-fill", lanes).forEach((f) => {
        f.classList.remove("run"); f.style.transform = "scaleX(0)";
        void f.offsetWidth;
        f.style.setProperty("--dur", `${reduceMotion() ? 0 : m.time * 0.6}s`);
        f.classList.add("run"); f.style.transform = "scaleX(1)";
      });
    }
    range.addEventListener("input", build);
    $("#partRun").addEventListener("click", run);
    build();
  }

  /* ---------- MemoryPool (5.5.4) ---------- */
  function initPool() {
    const root = $("#poolDemo");
    if (!root) return;
    const LIMIT = 1000;
    const REQUESTS = [["sort", 300], ["agg", 200], ["sort", 400], ["agg", 300], ["sort", 200], ["agg", 250]];
    const NAMES = { sort: "Sort", agg: "HashAggregate" };
    let pool = "greedy", i = 0, used = { sort: 0, agg: 0 }, spills = { sort: 0, agg: 0 };
    const log = $("#poolLog");
    function render() {
      $("#poolSort").style.transform = `scaleX(${used.sort / LIMIT})`;
      $("#poolAgg").style.transform = `scaleX(${used.agg / LIMIT})`;
      $("#poolTotal").style.transform = `scaleX(${(used.sort + used.agg) / LIMIT})`;
      $("#poolSortV").textContent = `${used.sort} MB`;
      $("#poolAggV").textContent = `${used.agg} MB`;
      $("#poolTotalV").textContent = `${used.sort + used.agg} / ${LIMIT}`;
      const fair = pool === "fair";
      ["capSort", "capAgg"].forEach((id) => { const c = $("#" + id); c.hidden = !fair; c.style.left = "50%"; });
    }
    function reset() { i = 0; used = { sort: 0, agg: 0 }; spills = { sort: 0, agg: 0 }; log.textContent = pool === "fair" ? "FairPool: mỗi toán tử spill được tối đa 1000 / 2 = 500 MB (vạch đỏ)." : "GreedyPool: chỉ có trần chung 1000 MB, ai xin trước được trước."; render(); }
    function stepReq() {
      if (i >= REQUESTS.length) { log.textContent = `Hết kịch bản. Số lần spill: Sort ${spills.sort}, HashAggregate ${spills.agg}. Bấm “Làm lại” hoặc đổi loại pool để so sánh.`; return; }
      const [who, mb] = REQUESTS[i++];
      const total = used.sort + used.agg;
      const cap = pool === "fair" ? LIMIT / 2 : LIMIT;
      const ok = total + mb <= LIMIT && used[who] + mb <= cap;
      if (ok) { used[who] += mb; log.textContent = `${NAMES[who]} grow(${mb} MB) → được cấp.`; }
      else {
        spills[who]++;
        const spilled = used[who];
        used[who] = 0; // spill: write buffered data to disk, then shrink
        const fits = used.sort + used.agg + mb <= LIMIT && mb <= cap;
        if (fits) used[who] = mb;
        log.textContent = `${NAMES[who]} grow(${mb} MB) → bị từ chối (${pool === "fair" ? "vượt phần chia công bằng" : "vượt trần chung"}) → ghi ${spilled} MB ra đĩa (spill), shrink về 0${fits ? `, rồi được cấp ${mb} MB` : ", vẫn chưa đủ chỗ"}.`;
      }
      render();
    }
    segmented(root, "pool", (p) => { pool = p; reset(); });
    $("#poolStep").addEventListener("click", stepReq);
    $("#poolReset").addEventListener("click", reset);
    reset();
  }

  /* ---------- Pushdown before/after (6.1) ---------- */
  function initPush() {
    const root = $("#pushDemo");
    if (!root) return;
    const show = (k) => { const d = DF.PUSH[k]; $("#pushTitle").textContent = d.title; $("#pushCode").innerHTML = highlight(d.code); $("#pushReadout").innerHTML = d.text; };
    segmented(root, "push", show);
    show("before");
  }

  /* ---------- Two-phase aggregation (6.3) ---------- */
  function initAgg() {
    const root = $("#aggDemo");
    if (!root) return;
    const stage = $("#aggStage"), readout = $("#aggReadout");
    const PARTS = [["HN", "SG", "HN", "DN", "SG"], ["DN", "DN", "HN", "SG"], ["SG", "HN", "SG", "SG", "DN"], ["HN", "DN", "HN"]];
    const KEYS = ["HN", "DN", "SG"];
    const LABEL = { HN: "HN", DN: "ĐN", SG: "SG" };
    const STEPS = [
      "Dữ liệu đầu vào: 4 partition, mỗi partition là các bản ghi của nó (mỗi chấm = một bản ghi, màu = thành phố).",
      "Pha 1 — AggregateExec mode=Partial: mỗi partition tự đếm cục bộ, song song, không cần nói chuyện với nhau.",
      "RepartitionExec Hash: các kết quả cục bộ được gửi theo hash(khoá) — mọi bản đếm của cùng một thành phố về cùng một partition đích.",
      "Pha 2 — AggregateExec mode=FinalPartitioned: mỗi partition đích cộng các bản đếm cục bộ thành kết quả cuối. Không khoá nào bị tính ở hai nơi."
    ];
    let s = 0;
    const dot = (k) => { const d = el("span", `dot k-${k}`, LABEL[k]); return d; };
    const pill = (k, n) => { const p = el("span", "pill"); p.append(dot(k), document.createTextNode(` ${n}`)); return p; };
    const countOf = (arr) => KEYS.map((k) => [k, arr.filter((x) => x === k).length]).filter(([, n]) => n > 0);
    function box(title, children) { const b = el("div", "agg-box"); b.append(el("span", "box-title", title)); const w = el("div", "dots"); children.forEach((c) => w.append(c)); b.append(w); return b; }
    function render() {
      stage.replaceChildren();
      const grid = el("div", "agg-grid");
      if (s === 0) PARTS.forEach((p, i) => grid.append(box(`Partition ${i}`, p.map(dot))));
      if (s === 1) PARTS.forEach((p, i) => grid.append(box(`Partial ${i}`, countOf(p).map(([k, n]) => pill(k, n)))));
      if (s >= 2) {
        // hash routing: HN → 0, DN → 1, SG → 2, partition 3 receives no key in this toy example
        const route = { HN: 0, DN: 1, SG: 2 };
        const dest = [[], [], [], []];
        PARTS.forEach((p) => countOf(p).forEach(([k, n]) => dest[route[k]].push([k, n])));
        dest.forEach((items, i) => {
          if (s === 2) grid.append(box(`Đích ${i}`, items.map(([k, n]) => pill(k, n))));
          else {
            const totals = KEYS.map((k) => [k, items.filter(([kk]) => kk === k).reduce((a, [, n]) => a + n, 0)]).filter(([, n]) => n > 0);
            grid.append(box(`Final ${i}`, totals.map(([k, n]) => pill(k, n))));
          }
        });
      }
      stage.append(grid);
      readout.textContent = STEPS[s] + (s === 3 ? " Kết quả: HN 6, ĐN 5, SG 6. (Partition đích 3 rỗng vì ví dụ chỉ có 3 khoá.)" : "");
      $("#aggStep").disabled = s === 3;
    }
    $("#aggStep").addEventListener("click", () => { if (s < 3) { s++; render(); } });
    $("#aggReset").addEventListener("click", () => { s = 0; render(); });
    render();
  }

  /* ---------- Sorted vs unsorted streaming aggregation (6.7) ---------- */
  function initSorted() {
    const root = $("#sortedDemo");
    if (!root) return;
    const HOURS = 12, PER_HOUR = 20;
    let order = "sorted", timer = 0;
    // deterministic pseudo-random shuffle so the demo is repeatable
    function shuffled(arr) { const a = arr.slice(); let seed = 42; for (let i = a.length - 1; i > 0; i--) { seed = (seed * 1103515245 + 12345) % 2147483648; const j = seed % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
    const base = []; for (let h = 0; h < HOURS; h++) for (let k = 0; k < PER_HOUR; k++) base.push(h);
    function run() {
      clearInterval(timer);
      const data = order === "sorted" ? base : shuffled(base);
      const open = new Set(); let seen = 0, out = 0, peak = 0, current = -1;
      const render = () => { $("#sortedSeen").textContent = seen; $("#sortedOpen").textContent = open.size; $("#sortedOut").textContent = out; $("#sortedPeak").textContent = peak; };
      const STEP = 6;
      const tick = () => {
        for (let n = 0; n < STEP && seen < data.length; n++) {
          const h = data[seen++];
          if (order === "sorted" && h !== current) { if (open.has(current)) { open.delete(current); out++; } current = h; }
          open.add(h); peak = Math.max(peak, open.size);
        }
        if (seen >= data.length) { out += open.size; open.clear(); clearInterval(timer); }
        render();
      };
      if (reduceMotion()) { while (seen < data.length) tick(); } else { timer = setInterval(tick, 60); }
    }
    segmented(root, "order", (o) => { order = o; run(); });
    $("#sortedRun").addEventListener("click", run);
  }

  /* ---------- RowFormat encoder (6.6) ---------- */
  function encode(value, type) {
    const buf = new ArrayBuffer(type === "f64" ? 8 : 4), dv = new DataView(buf);
    if (type === "u32") dv.setUint32(0, value, false);
    if (type === "i32") dv.setInt32(0, value, false);
    if (type === "f64") dv.setFloat64(0, value, false);
    const raw = Array.from(new Uint8Array(buf)); // big-endian bytes
    const norm = raw.slice(); const flipped = raw.map(() => false);
    if (type === "i32") { norm[0] ^= 0x80; flipped[0] = true; }
    if (type === "f64") {
      if (raw[0] & 0x80) { for (let i = 0; i < norm.length; i++) { norm[i] ^= 0xff; flipped[i] = true; } }
      else { norm[0] ^= 0x80; flipped[0] = true; }
    }
    const little = raw.slice().reverse();
    return { little, big: raw, norm, flipped };
  }
  const hex = (b) => b.toString(16).padStart(2, "0").toUpperCase();
  const memcmp = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };

  function initRowFormat() {
    const root = $("#rfDemo");
    if (!root) return;
    const typeSel = $("#rfType"), orderSel = $("#rfOrder"), input = $("#rfValues"), table = $("#rfTable"), verdict = $("#rfVerdict");
    const RANGE = { u32: [0, 4294967295], i32: [-2147483648, 2147483647] };
    function parse() {
      const type = typeSel.value, errors = [], values = [];
      input.value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 8).forEach((s) => {
        const n = Number(s);
        if (!Number.isFinite(n)) { errors.push(`“${s}” không phải số`); return; }
        if (type !== "f64" && (!Number.isInteger(n) || n < RANGE[type][0] || n > RANGE[type][1])) { errors.push(`${s} không hợp lệ cho ${type === "u32" ? "UInt32" : "Int32"}`); return; }
        values.push(n);
      });
      return { values, errors };
    }
    function bytesCell(bytes, flipped) {
      const td = el("td", "hex");
      bytes.forEach((b, i) => { const sp = el("span", flipped && flipped[i] ? "flip" : null, hex(b)); td.append(sp, document.createTextNode(" ")); });
      return td;
    }
    function render() {
      const { values, errors } = parse(), type = typeSel.value, desc = orderSel.value === "desc";
      table.replaceChildren();
      const head = el("tr");
      ["Giá trị", "Little-endian (trong RAM x86)", "Big-endian", "RowFormat (khoá chuẩn hoá)"].forEach((h) => head.append(el("th", null, h)));
      table.append(head);
      const rows = values.map((v) => {
        const e = encode(v, type);
        const key = desc ? e.norm.map((b) => b ^ 0xff) : e.norm;
        const flips = desc ? e.norm.map(() => true) : e.flipped;
        return { v, e, key, flips };
      });
      rows.forEach((r) => {
        const tr = el("tr");
        tr.append(el("td", null, String(r.v)), bytesCell(r.e.little), bytesCell(r.e.big), bytesCell(r.key, r.flips));
        table.append(tr);
      });
      if (errors.length) { verdict.textContent = `Bỏ qua: ${errors.join("; ")}.`; }
      if (rows.length < 2) { if (!errors.length) verdict.textContent = "Nhập ít nhất 2 số."; return; }
      const expected = rows.slice().sort((a, b) => desc ? b.v - a.v : a.v - b.v).map((r) => r.v);
      const byKey = rows.slice().sort((a, b) => memcmp(a.key, b.key)).map((r) => r.v);
      const byLittle = rows.slice().sort((a, b) => memcmp(a.e.little, b.e.little)).map((r) => r.v);
      const same = (a, b) => a.every((x, i) => Object.is(x, b[i]) || x === b[i]);
      verdict.replaceChildren();
      const line = (label, arr, ok) => { const p = el("div"); p.append(el("span", null, `${label}: ${arr.join(", ")} `), el("span", `verdict ${ok ? "ok" : "bad"}`, ok ? "✓ đúng thứ tự" : "✗ sai thứ tự")); return p; };
      verdict.append(el("div", null, `Thứ tự đúng (${desc ? "DESC" : "ASC"}): ${expected.join(", ")}`));
      verdict.append(line("memcmp trên little-endian", byLittle, !desc && same(byLittle, expected)));
      verdict.append(line("memcmp trên RowFormat", byKey, same(byKey, expected)));
      if (errors.length) verdict.append(el("div", null, `Bỏ qua: ${errors.join("; ")}.`));
    }
    const SAMPLES = { u32: "258, 3, 70000, 0, 1", i32: "258, 3, -7, 0, -300", f64: "2.5, -0.75, 100, -3, 0" };
    typeSel.addEventListener("change", () => { input.value = SAMPLES[typeSel.value]; render(); });
    orderSel.addEventListener("change", render);
    input.addEventListener("input", render);
    render();
  }

  /* ---------- Parquet pruning + late materialization (6.8) ---------- */
  function initPruning() {
    const root = $("#pruneDemo");
    if (!root) return;
    const LETTERS = "ABCDEFGH".split("");
    // Row-group statistics (A numeric, B letters). Toy data, consistent with the rows generated below.
    const GROUPS = [
      { aMin: 0, aMax: 30, bMin: "A", bMax: "D" }, { aMin: 10, aMax: 60, bMin: "C", bMax: "H" },
      { aMin: 31, aMax: 90, bMin: "E", bMax: "G" }, { aMin: 5, aMax: 34, bMin: "F", bMax: "F" },
      { aMin: 40, aMax: 100, bMin: "A", bMax: "C" }, { aMin: 36, aMax: 80, bMin: "B", bMax: "F" },
      { aMin: 20, aMax: 75, bMin: "G", bMax: "H" }, { aMin: 50, aMax: 95, bMin: "D", bMax: "F" }
    ];
    const ROWS = 20, PAGE = 5;
    const selA = $("#pruneA"), selB = $("#pruneB"), grid = $("#rgGrid"), vis = $("#rowsVis"), readout = $("#pruneReadout");
    LETTERS.forEach((l) => { const o = el("option", null, l); o.value = l; if (l === "F") o.selected = true; selB.append(o); });
    let rstep = 0;

    function reason(g, a, b) {
      if (g.aMax <= a) return `A_max = ${g.aMax} ≤ ${a}`;
      if (g.bMax < b) return `B_max = ${g.bMax} < ${b}`;
      if (g.bMin > b) return `B_min = ${g.bMin} > ${b}`;
      return "";
    }
    // Deterministic rows inside a row group that respect its min/max.
    function rowsFor(g) {
      const out = [];
      const span = g.aMax - g.aMin, bLo = g.bMin.charCodeAt(0), bSpan = g.bMax.charCodeAt(0) - bLo;
      for (let i = 0; i < ROWS; i++) {
        const a = g.aMin + Math.round(span * ((i * 7) % ROWS) / (ROWS - 1));
        const b = String.fromCharCode(bLo + (bSpan ? Math.floor(((i * 3) % ROWS) / ROWS * (bSpan + 1)) : 0));
        out.push({ a, b, c: (i * 13) % 97 });
      }
      return out;
    }

    function render() {
      const a = Number(selA.value), b = selB.value;
      $("#pruneAVal").textContent = a; $("#pruneBVal").textContent = b;
      grid.replaceChildren();
      let firstKept = -1, keptCount = 0;
      GROUPS.forEach((g, i) => {
        const why = reason(g, a, b), kept = !why;
        if (kept) { keptCount++; if (firstKept < 0) firstKept = i; }
        const card = el("div", `rg ${kept ? "kept" : "pruned"}`);
        card.append(el("b", null, `Row group ${i}`), el("span", null, `A ∈ [${g.aMin}, ${g.aMax}]`), el("br"), el("span", null, `B ∈ [${g.bMin}, ${g.bMax}]`), el("span", "why", kept ? "giữ lại – có thể khớp" : `bỏ: ${why}`));
        grid.append(card);
      });
      vis.replaceChildren();
      if (firstKept < 0) {
        readout.textContent = `Bước 1: cả ${GROUPS.length} row group đều bị bỏ chỉ nhờ metadata — không giải mã byte dữ liệu nào.`;
        return;
      }
      const rows = rowsFor(GROUPS[firstKept]);
      const bHit = rows.map((r) => r.b === b);
      const pagesWithB = new Set(rows.map((r, i) => (bHit[i] ? Math.floor(i / PAGE) : -1)).filter((p) => p >= 0));
      const aHit = rows.map((r, i) => bHit[i] && r.a > a);
      const addRow = (label, cls) => { vis.append(el("span", "lbl", label)); rows.forEach((r, i) => vis.append(cls(r, i))); };
      const cell = (cls, text) => el("i", cls, text);
      let decodedB = 0, decodedA = 0, decodedC = 0;
      addRow("B", (r, i) => { if (rstep >= 2) { decodedB++; return cell(bHit[i] ? "hit" : "miss", r.b); } return cell("", r.b); });
      addRow("A", (r, i) => {
        if (rstep < 3) return cell("", String(r.a));
        if (!pagesWithB.has(Math.floor(i / PAGE))) return cell("skip", String(r.a));
        decodedA++;
        return cell(aHit[i] ? "hit" : (bHit[i] ? "miss" : "dec"), String(r.a));
      });
      addRow("C", (r, i) => {
        if (rstep < 4) return cell("", String(r.c));
        if (!aHit[i]) return cell("skip", String(r.c));
        decodedC++;
        return cell("dec", String(r.c));
      });
      const finalRows = aHit.filter(Boolean).length;
      const msg = [`Bước 1: giữ ${keptCount}/${GROUPS.length} row group. Đang xem row group ${firstKept}.`];
      if (rstep >= 2) msg.push(`Bước 2: giải mã ${decodedB} giá trị B, RowSelection = ${bHit.filter(Boolean).length} dòng thoả B = ${b}.`);
      if (rstep >= 3) msg.push(`Bước 3: chỉ giải mã ${pagesWithB.size}/${ROWS / PAGE} page của A (${decodedA} giá trị), còn ${finalRows} dòng thoả A > ${a}.`);
      if (rstep >= 4) msg.push(`Bước 4: giải mã C cho đúng ${decodedC} dòng. Tổng ${decodedB + decodedA + decodedC} giá trị được giải mã, thay vì ${ROWS * 3} nếu đọc hết.`);
      if (rstep < 2) msg.push("Bấm bước 2, 3, 4 để xem late materialization.");
      readout.textContent = msg.join(" ");
    }
    $$("[data-rstep]", root).forEach((btn) => btn.addEventListener("click", () => {
      rstep = Number(btn.dataset.rstep);
      $$("[data-rstep]", root).forEach((x) => x.setAttribute("aria-pressed", String(Number(x.dataset.rstep) <= rstep)));
      render();
    }));
    selA.addEventListener("input", render);
    selB.addEventListener("change", render);
    render();
  }

  /* ---------- Extension board (7) ---------- */
  function initExt() {
    const root = $("#extBoard");
    if (!root) return;
    const board = $(".ext-board", root), detail = $("#extDetail");
    DF.EXT.forEach((x) => {
      const b = el("button", "ext-card"); b.type = "button"; b.setAttribute("aria-pressed", "false");
      b.append(el("b", null, `${x.sec} · ${x.name}`), el("code", null, x.api), el("br"), el("small", null, "Bấm để xem chi tiết"));
      b.addEventListener("click", () => {
        $$(".ext-card", board).forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
        detail.innerHTML = `<b>${x.name}</b> (mục ${x.sec}) — <code>${x.api}</code><br><b>Bạn viết gì:</b> ${x.what}<br><b>Ví dụ trong bài:</b> ${x.example}<br><b>Vì sao đáng nói:</b> ${x.why}`;
      });
      board.append(b);
    });
  }

  /* ---------- Table 1 diverging bar chart (8.1) ---------- */
  function initTable1() {
    const root = $("#t1Chart");
    if (!root) return;
    const barsEl = $("#t1Bars"), tip = $("#tooltip"), readout = $("#t1Readout");
    const data = DF.TABLE1.map(([q, df, duck]) => ({ q, df, duck, ratio: duck / df }));
    const maxLog = Math.max(...data.map((d) => Math.abs(Math.log2(d.ratio))));
    let sortBy = "q", activeCat = null;
    const label = (d) => (d.ratio >= 1 ? `DataFusion nhanh hơn ${fmt(d.ratio)}×` : `DuckDB nhanh hơn ${fmt(1 / d.ratio)}×`);

    function showTip(d, x, y) {
      tip.replaceChildren(el("b", null, `Q${d.q}`), el("br"), document.createTextNode(`DataFusion: ${fmt(d.df)} s`), el("br"), document.createTextNode(`DuckDB: ${fmt(d.duck)} s`), el("br"), document.createTextNode(label(d)));
      const w = 220;
      tip.style.left = `${Math.min(window.innerWidth - w - 8, x + 14)}px`;
      tip.style.top = `${y + 14}px`;
      tip.classList.add("show");
    }
    const hideTip = () => tip.classList.remove("show");

    function render() {
      const rows = data.slice().sort((a, b) => (sortBy === "q" ? a.q - b.q : b.ratio - a.ratio));
      barsEl.replaceChildren();
      const cat = activeCat ? DF.T1_CATS[activeCat].qs : null;
      barsEl.classList.toggle("dim", Boolean(cat));
      rows.forEach((d) => {
        const row = el("div", "bar-row"); row.tabIndex = 0;
        row.setAttribute("aria-label", `Q${d.q}: DataFusion ${fmt(d.df)} giây, DuckDB ${fmt(d.duck)} giây, ${label(d)}`);
        if (cat && cat.includes(d.q)) row.classList.add("on");
        const left = el("div", "left"), right = el("div", "right");
        const pct = Math.abs(Math.log2(d.ratio)) / maxLog * 100;
        const bar = el("i"); bar.style.width = `max(2px, calc(${pct}% - 2px))`;
        (d.ratio >= 1 ? right : left).append(bar);
        row.append(el("span", "q", `Q${d.q}`), left, right, el("span", "r", d.ratio >= 1 ? `${fmt(d.ratio)}×` : `${fmt(1 / d.ratio)}×`));
        row.addEventListener("pointerenter", (e) => showTip(d, e.clientX, e.clientY));
        row.addEventListener("pointermove", (e) => showTip(d, e.clientX, e.clientY));
        row.addEventListener("pointerleave", hideTip);
        row.addEventListener("focus", () => { const r = row.getBoundingClientRect(); showTip(d, r.left + r.width / 2, r.top); });
        row.addEventListener("blur", hideTip);
        barsEl.append(row);
      });
    }
    segmented(root, "sort", (s) => { sortBy = s; render(); });
    $$("[data-cat]", root).forEach((c) => c.addEventListener("click", () => {
      activeCat = activeCat === c.dataset.cat ? null : c.dataset.cat;
      $$("[data-cat]", root).forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.cat === activeCat)));
      readout.textContent = activeCat ? DF.T1_CATS[activeCat].text : "Chọn một nhóm để xem bài báo giải thích thế nào.";
      render();
    }));
    window.addEventListener("scroll", hideTip, { passive: true });

    const table = $("#t1Table");
    const head = el("tr"); ["Truy vấn", "DataFusion (s)", "DuckDB (s)", "Chênh lệch"].forEach((h) => head.append(el("th", null, h)));
    table.append(head);
    data.forEach((d) => { const tr = el("tr"); [`Q${d.q}`, fmt(d.df), fmt(d.duck), label(d)].forEach((v) => tr.append(el("td", null, v))); table.append(tr); });
    render();
  }

  /* ---------- Scaling concept (8.2) ---------- */
  function initScale() {
    const root = $("#scaleDemo");
    if (!root) return;
    const svg = $("#scaleSvg"), range = $("#scaleOverhead"), NS = "http://www.w3.org/2000/svg";
    const CORES = [1, 2, 4, 8, 16, 32, 64, 128, 192];
    const W = 640, H = 280, PAD = { l: 52, r: 16, t: 14, b: 36 };
    const mk = (tag, attrs) => { const e = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v)); return e; };
    function render() {
      const level = Number(range.value) / 100; // 0..1
      const work = 10, coord = 0.0004 + level * 0.012; // seconds (illustrative)
      const ideal = CORES.map((n) => work / n);
      const real = CORES.map((n) => work / n + coord * n);
      const yMin = Math.log10(Math.min(...ideal) * 0.8), yMax = Math.log10(work * 1.3);
      const x = (i) => PAD.l + (i / (CORES.length - 1)) * (W - PAD.l - PAD.r);
      const y = (v) => PAD.t + (1 - (Math.log10(v) - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);
      svg.replaceChildren();
      const g = mk("g", { class: "grid" });
      [0.1, 1, 10].forEach((v) => { if (Math.log10(v) < yMin || Math.log10(v) > yMax) return; g.append(mk("line", { x1: PAD.l, x2: W - PAD.r, y1: y(v), y2: y(v) })); const t = mk("text", { x: PAD.l - 8, y: y(v) + 4, "text-anchor": "end" }); t.textContent = `${v} s`; svg.append(t); });
      svg.append(g);
      CORES.forEach((n, i) => { const t = mk("text", { x: x(i), y: H - 12, "text-anchor": "middle" }); t.textContent = n; svg.append(t); });
      const xl = mk("text", { x: W - PAD.r, y: H - 0, "text-anchor": "end" }); xl.textContent = "số lõi"; svg.append(xl);
      const path = (vals, color, dash) => { const p = mk("path", { d: vals.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(""), fill: "none", stroke: color, "stroke-width": 2, "stroke-dasharray": dash || "none", "stroke-linejoin": "round" }); svg.append(p); };
      const css = getComputedStyle(document.documentElement);
      path(ideal, css.getPropertyValue("--ink-3").trim(), "5 4");
      path(real, css.getPropertyValue("--chart-df").trim());
      real.forEach((v, i) => svg.append(mk("circle", { cx: x(i), cy: y(v), r: 4, fill: css.getPropertyValue("--chart-df").trim(), stroke: css.getPropertyValue("--surface").trim(), "stroke-width": 2 })));
      const best = real.indexOf(Math.min(...real));
      $("#scaleVal").textContent = level < 0.15 ? "thấp" : level < 0.5 ? "vừa" : "cao";
      $("#scaleReadout").textContent = best === CORES.length - 1
        ? "Chi phí phối hợp nhỏ: thêm lõi đến 192 vẫn nhanh hơn, giống Q28, Q29 trong Hình 7."
        : `Nhanh nhất ở ${CORES[best]} lõi; thêm lõi nữa thì chậm đi vì phần việc mỗi lõi quá ít so với chi phí phối hợp — dạng chữ U giống Q11, Q14, Q32.`;
    }
    range.addEventListener("input", render);
    window.addEventListener("df-theme-change", render);
    render();
  }

  /* ---------- v2 illustrations ---------- */
  function initFactory() {
    const f = $("#factory");
    if (!f || reduceMotion()) return;
    // animate only while visible: no work for off-screen decoration
    new IntersectionObserver(([e]) => f.classList.toggle("play", e.isIntersecting)).observe(f);
  }

  function initHub() {
    const root = $("#hubDemo");
    if (!root) return;
    const wrap = $(".hubwrap", root), readout = $("#hubReadout");
    const TEXT = {
      before: "Không có chuẩn chung: 4 công cụ cần tới 6 “phiên dịch viên” (bộ chuyển định dạng) — mỗi lần dữ liệu đi qua là một lần sao chép, tốn thời gian và dễ sai.",
      after: "Cùng nói “tiếng Arrow”: mọi công cụ hiểu ngay bố cục bộ nhớ của nhau, không cần chuyển đổi (zero-copy). Thêm công cụ thứ 5 chỉ cần nối thêm 1 đường."
    };
    segmented(root, "hub", (m) => { wrap.dataset.mode = m; readout.textContent = TEXT[m]; });
    readout.textContent = TEXT.before;
  }

  function initWarehouse() {
    const root = $("#warehouse");
    if (!root) return;
    const crates = $$(".crate", root), readout = $("#whReadout"), btn = $("#whScan"), reset = $("#whReset");
    btn.addEventListener("click", () => {
      let opened = 0;
      crates.forEach((c) => {
        const max = Number(c.dataset.max);
        const open = max > 35;
        c.classList.toggle("open", open); c.classList.toggle("skip", !open);
        $(".mark", c).textContent = open ? "📦" : "✕";
        if (open) opened++;
      });
      readout.textContent = `Chỉ cần mở ${opened}/${crates.length} thùng. ${crates.length - opened} thùng có nhãn “lớn nhất ≤ 35” nên chắc chắn không có món nào > 35 — bỏ qua mà không cần mở. Bộ đọc Parquet làm y như vậy với min/max của từng row group.`;
      btn.disabled = true;
    });
    reset.addEventListener("click", () => {
      crates.forEach((c) => c.classList.remove("open", "skip"));
      readout.textContent = "Bấm “Đọc nhãn” để xem thùng nào phải mở.";
      btn.disabled = false;
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    [initFactory, initHub, initWarehouse, initFig1, initMemLayout, initSpark, initLlvm, initArch, initLifecycle, initFrontEnd, initStream, initPartitions,
      initPool, initPush, initAgg, initSorted, initRowFormat, initPruning, initExt, initTable1, initScale]
      .forEach((fn) => { try { fn(); } catch (err) { console.error(`[demos] ${fn.name} failed`, err); } });
  });
})();

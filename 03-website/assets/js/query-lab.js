/* Chỉ mô phỏng cách đọc hai kế hoạch. SQL và thời gian là kết quả đo riêng trên MacBook. */
"use strict";

(() => {
  const cases = {
    q6: {
      name: "Q6: tính tổng tiền chiết khấu",
      purpose: "Chọn các dòng hàng giao trong năm 1994, có mức chiết khấu 5-7% và số lượng nhỏ hơn 24, sau đó cộng tiền chiết khấu.",
      source: "Tệp lineitem/part-0.parquet: 59.986.052 dòng, 16 cột, 58 nhóm hàng. Truy vấn chỉ cần bốn cột để lọc và tính tổng.",
      parquet: {
        intro: "Parquet lưu dữ liệu theo cột và chia tệp thành các row group. Footer của tệp chứa schema cùng thống kê như giá trị nhỏ nhất và lớn nhất của từng cột trong từng row group.",
        steps: [
          ["Footer", "Đọc metadata trước: biết cột nào tồn tại và khoảng giá trị của từng row group."],
          ["Chọn cột", "Projection pushdown chỉ yêu cầu l_shipdate, l_discount, l_quantity và l_extendedprice; các cột khác không cần giải mã."],
          ["Thử loại nhóm", "Bộ đọc có thể so min/max với điều kiện. Chẳng hạn, nhóm có l_shipdate_max trước 1994 thì không chứa dòng giao năm 1994 và có thể bỏ qua."],
          ["Lọc từng dòng", "Ở lần đo này DataFusion không loại nhóm hay dòng ngay trong ParquetExec: FilterExec lọc sau khi đọc. DuckDB tích hợp điều kiện lọc vào READ_PARQUET."]
        ],
        why: "Q6 nhanh hơn trong bộ đo: 1,364 giây so với 2,776 giây. Hồ sơ bổ sung cho thấy DuckDB xuất 1.139.264 dòng ngay tại READ_PARQUET, còn DataFusion xuất 59.986.052 dòng từ ParquetExec rồi FilterExec mới giữ 1.139.264 dòng. DataFusion báo row_groups_pruned=0, pushdown_rows_filtered=0. Vậy DataFusion không thắng nhờ loại nhiều nhóm hay lọc nhiều dòng ngay trong bộ đọc hơn DuckDB. Lượt hồ sơ riêng cho thấy phần tốn thời gian nằm chủ yếu ở đường đọc–giải mã–lọc, chứ không phải phép SUM; chưa thể tách ra một nguyên nhân vi mô duy nhất."
      },
      sql: `select sum(l_extendedprice * l_discount) as revenue
from lineitem
where l_shipdate >= date '1994-01-01'
  and l_shipdate < date '1995-01-01'
  and l_discount between 0.06 - 0.01 and 0.06 + 0.01
  and l_quantity < 24;`,
      datafusion: { seconds: 1.364, winner: true },
      duckdb: { seconds: 2.776, winner: false },
      stages: [
        {
          label: "Đọc tệp Parquet",
          df: "ParquetExec chỉ đọc bốn cột cần thiết; có pruning_predicate để xét min/max của nhóm.",
          duck: "READ_PARQUET cũng chỉ đọc cột cần thiết, đồng thời mang các điều kiện Filters trong nút đọc.",
          explanation: "Cả hai dùng cùng tệp Parquet. DataFusion ghi row_groups_pruned=0, page_index_rows_filtered=0: trong lượt này không nhóm hàng hoặc dòng nào bị loại bằng hai cơ chế ấy."
        },
        {
          label: "Lọc các dòng",
          df: "FilterExec giữ các dòng có ngày, chiết khấu và số lượng phù hợp.",
          duck: "READ_PARQUET tích hợp bộ lọc vào nút đọc thay vì vẽ một nút Filter riêng.",
          explanation: "DataFusion ParquetExec xuất 59.986.052 dòng; FilterExec giữ 1.139.264 dòng (1,9%). DuckDB READ_PARQUET đã xuất 1.139.264 dòng sau bộ lọc tích hợp. Đó là khác biệt vị trí lọc nhìn thấy trong hồ sơ, không phải bằng chứng DuckDB nhanh hơn."
        },
        {
          label: "Tính tiền chiết khấu",
          df: "ProjectionExec giữ hai cột l_extendedprice và l_discount rồi nhân từng cặp giá trị.",
          duck: "PROJECTION tính cùng biểu thức l_extendedprice * l_discount.",
          explanation: "Phép nhân chỉ áp dụng cho các dòng còn lại. Arrow là biểu diễn cột trong bộ nhớ của DataFusion; DuckDB cũng có xử lý theo véc-tơ riêng."
        },
        {
          label: "Cộng thành một kết quả",
          df: "AggregateExec mode=Single, gby=[]: chỉ một tổng, không tạo nhiều nhóm.",
          duck: "UNGROUPED_AGGREGATE: cũng tính một tổng duy nhất.",
          explanation: "Kết quả của cả hai là 1.230.113.636,0101. Kế hoạch hai bên có cùng bản chất; chênh lệch thời gian không thể quy cho một bên có tối ưu lọc mà bên kia không có."
        }
      ],
      interpretation: "DataFusion nhanh hơn trên MacBook với Q6 dù ParquetExec xuất toàn bộ gần 60 triệu dòng cho FilterExec, còn DuckDB lọc ngay trong READ_PARQUET. Hai kế hoạch cùng bản chất quét–lọc–nhân–cộng; hồ sơ khoanh vùng thời gian chủ yếu vào đường đọc–giải mã–lọc. Không đủ bằng chứng tách riêng tác động của giải mã Parquet, xử lý véc-tơ, kiểu số thập phân hay bộ nhớ đệm để nói yếu tố nào quyết định.",
      evidence: "Bộ đo chính lấy trung bình ba lượt cuối: DataFusion 1,364 giây; DuckDB 2,776 giây. Trong lượt EXPLAIN ANALYZE riêng để kiểm tra kế hoạch, DataFusion ParquetExec báo output_rows=59.986.052, row_groups_pruned=0, pushdown_rows_filtered=0, page_index_rows_filtered=0; FilterExec xuất 1.139.264 dòng. DuckDB READ_PARQUET tích hợp Filters, xuất 1.139.264 dòng và báo 3,08/3,09 giây của lượt hồ sơ. Các số liệu của lượt hồ sơ không thay thế trung bình ba lượt benchmark. Trong bài báo gốc, tác giả xem Q6 là gần tương đương, không tuyên bố DataFusion luôn thắng."
    },
    q18: {
      name: "Q18: tìm đơn hàng có số lượng hàng lớn",
      purpose: "Tìm các đơn hàng có tổng số lượng lớn hơn 300, nối với khách hàng và dòng hàng, tính lại tổng theo đơn rồi sắp xếp theo giá trị và ngày đơn.",
      source: "Đọc ba bảng customer, orders và lineitem. Bảng lineitem được dùng hai lần: một lần tính tổng trong truy vấn con, một lần nối để trả kết quả.",
      parquet: {
        intro: "Parquet vẫn cho phép chỉ đọc các cột cần thiết, nhưng điều kiện SUM(l_quantity) > 300 chỉ biết được sau khi gom nhóm theo l_orderkey.",
        steps: [
          ["Footer", "Bộ đọc xem schema và metadata của customer, orders và lineitem trước khi mở các cột cần dùng."],
          ["Chọn cột", "Hai nhánh lineitem chủ yếu cần l_orderkey và l_quantity; orders và customer cũng chỉ lấy các cột có trong SELECT hoặc điều kiện nối."],
          ["Khó bỏ row group", "Mỗi dòng lineitem góp vào tổng của một đơn hàng. Vì chưa biết tổng trước khi đọc và gom nhóm, điều kiện HAVING thường không giúp bỏ toàn bộ row group ngay từ footer."],
          ["Sau khi đọc", "Hai hệ thống phải gom khoảng 15 triệu mã đơn, giữ 624 mã đạt điều kiện, rồi nối bán phần và tổng hợp lại."]
        ],
        why: "DuckDB nhanh hơn trong lần đo này: 7,142 giây so với 13,861 giây. Kế hoạch cho thấy cả hai đều đọc Parquet, gom nhóm và nối bán phần; chênh lệch không thể giải thích đơn giản là một bên dùng Parquet còn bên kia không. Số liệu DataFusion chỉ ra một nút nối bán phần nhận gần 60 triệu dòng và báo khoảng 7,57 GB bộ nhớ; đó là nơi cần điều tra, chưa đủ để kết luận nguyên nhân duy nhất."
      },
      sql: `select c_name, c_custkey, o_orderkey, o_orderdate,
       o_totalprice, sum(l_quantity)
from customer, orders, lineitem
where o_orderkey in (
    select l_orderkey
    from lineitem
    group by l_orderkey
    having sum(l_quantity) > 300
  )
  and c_custkey = o_custkey
  and o_orderkey = l_orderkey
group by c_name, c_custkey, o_orderkey,
         o_orderdate, o_totalprice
order by o_totalprice desc, o_orderdate;`,
      datafusion: { seconds: 13.861, winner: false },
      duckdb: { seconds: 7.142, winner: true },
      stages: [
        {
          label: "Đọc bảng và gom nhóm",
          df: "ParquetExec đọc lineitem; AggregateExec nhóm theo l_orderkey và tính SUM(l_quantity).",
          duck: "READ_PARQUET và HASH_GROUP_BY cũng nhóm lineitem theo mã đơn hàng.",
          explanation: "Cả hai phải đi qua gần 60 triệu dòng lineitem để tạo khoảng 15 triệu nhóm theo mã đơn. Đây là công việc khác hẳn phép cộng không phân nhóm của Q6."
        },
        {
          label: "Chọn đơn đủ điều kiện",
          df: "FilterExec giữ các nhóm có SUM(l_quantity) > 300.",
          duck: "FILTER sau HASH_GROUP_BY áp dụng cùng điều kiện HAVING.",
          explanation: "Kế hoạch DataFusion ghi nhận 624 mã đơn sau lọc. Truy vấn con không phải chạy lại một lần cho mỗi dòng: cả hai đều chuyển thành nhánh gom nhóm rồi nối."
        },
        {
          label: "Nối bảng",
          df: "HashJoinExec nối customer với orders, tiếp tục nối lineitem rồi LeftSemi Join với các mã đơn đã chọn.",
          duck: "HASH_JOIN nối các bảng, sau đó SEMI JOIN đối chiếu với tập mã đơn từ truy vấn con.",
          explanation: "Trong kế hoạch DataFusion, phép nối bán phần ghi build_input_rows=59.986.052 và build_mem_used=7.572.830.497 byte (khoảng 7,57 GB theo đơn vị thập phân). Đây là số đếm đầu vào và mức bộ nhớ do chính toán tử báo cáo, không phải thời gian hay tổng bộ nhớ toàn truy vấn. Chưa có chỉ số tương ứng của DuckDB để so sánh trực tiếp."
        },
        {
          label: "Tổng hợp và sắp xếp",
          df: "AggregateExec tính lại SUM(l_quantity) theo đơn; SortExec xếp theo giá và ngày.",
          duck: "HASH_GROUP_BY và ORDER_BY thực hiện hai việc tương ứng.",
          explanation: "Sau điều kiện, kết quả còn 624 đơn, nên sắp xếp đầu ra nhỏ không nhất thiết là nút gây chậm. Chênh lệch có thể nằm ở gom nhóm lớn và những phép nối phía trước, cần phép đo thành phần để xác định tỷ trọng."
        }
      ],
      interpretation: "DuckDB nhanh hơn trên máy này. DataFusion tạo khoảng 15 triệu nhóm và phép nối bán phần của nó ghi nhận gần 60 triệu dòng đầu vào cùng khoảng 7,57 GB bộ nhớ ở toán tử. DuckDB cũng đọc lineitem hai lần, gom nhóm và nối bán phần. Các con số chỉ ra những nút đáng điều tra; chưa đủ để khẳng định thứ tự nối, bộ nhớ hay bất kỳ nút đơn lẻ nào là nguyên nhân quyết định.",
      evidence: "Ba lượt cuối: DataFusion trung bình 13,861 giây; DuckDB 7,142 giây. EXPLAIN ANALYZE DataFusion: AggregateExec nhóm lineitem thành 15.000.000 nhóm, lọc còn 624; HashJoinExec loại LeftSemi ghi build_input_rows=59.986.052, build_mem_used=7.572.830.497 byte; kết quả cuối 624 dòng. DuckDB có READ_PARQUET, HASH_GROUP_BY, FILTER, HASH_JOIN/SEMI và ORDER_BY. Bài báo cũng nêu Q18 là trường hợp DataFusion chậm hơn rõ rệt trong môi trường tác giả."
    }
  };

  function init() {
    const root = document.getElementById("queryLab");
    if (!root) return;
    const get = id => document.getElementById(id);
    const buttons = [...root.querySelectorAll("[data-case]")];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let selected = "q6", step = 0, timer = null;
    const stop = () => { if (timer !== null) window.clearInterval(timer); timer = null; get("queryReplay").textContent = "Tự chạy"; };

    function lane(list, entries) {
      list.replaceChildren(...entries.map((entry, index) => {
        const item = document.createElement("li");
        item.className = "query-node";
        item.dataset.step = String(index);
        item.textContent = entry;
        return item;
      }));
    }

    function renderParquetGuide(data) {
      const guide = get("queryParquetGuide");
      guide.replaceChildren();
      const title = document.createElement("p");
      title.className = "query-guide-title";
      title.textContent = "Parquet lọc dữ liệu như thế nào?";
      const intro = document.createElement("p");
      intro.className = "query-guide-intro";
      intro.textContent = data.parquet.intro;
      const steps = document.createElement("ol");
      steps.className = "query-parquet-steps";
      data.parquet.steps.forEach(([label, text], index) => {
        const item = document.createElement("li");
        item.dataset.guideStep = String(index);
        const heading = document.createElement("strong");
        heading.textContent = (index + 1) + ". " + label;
        const detail = document.createElement("span");
        detail.textContent = text;
        item.append(heading, detail);
        steps.append(item);
      });
      const why = document.createElement("div");
      why.className = "query-guide-why";
      const whyTitle = document.createElement("strong");
      whyTitle.textContent = "Vì sao lần này một bên nhanh hơn?";
      const whyText = document.createElement("span");
      whyText.textContent = data.parquet.why;
      why.append(whyTitle, whyText);
      guide.append(title, intro, steps, why);
    }

    function showStep() {
      const data = cases[selected];
      const current = data.stages[step];
      get("queryStepStatus").textContent = `${step + 1}/${data.stages.length}: ${current.label}`;
      for (const list of [get("queryDfNodes"), get("queryDuckNodes")]) {
        [...list.children].forEach((node, index) => {
          node.classList.toggle("is-current", index === step);
          node.classList.toggle("is-done", index < step);
          if (index === step) node.setAttribute("aria-current", "step"); else node.removeAttribute("aria-current");
        });
      }
      [...get("queryParquetGuide").querySelectorAll("[data-guide-step]")].forEach((item, index) => {
        item.classList.toggle("is-current", index === step);
        item.classList.toggle("is-done", index < step);
      });
      get("queryExplanation").textContent = current.explanation;
      get("queryLab").style.setProperty("--query-progress", `${((step + 1) / data.stages.length) * 100}%`);
      get("queryPrev").disabled = step === 0;
      get("queryNext").disabled = step === data.stages.length - 1;
    }

    function render(key) {
      stop(); selected = key; step = 0;
      const data = cases[key];
      buttons.forEach(button => {
        const active = button.dataset.case === key;
        button.setAttribute("aria-pressed", String(active));
        button.classList.toggle("ghost", !active);
      });
      get("queryName").textContent = data.name;
      get("queryPurpose").textContent = data.purpose;
      get("querySqlLabel").textContent = `TPC-H ${key.toUpperCase()}, câu SQL trong queries.sql`;
      get("querySql").textContent = data.sql;
      get("querySource").textContent = data.source;
      renderParquetGuide(data);
      get("queryTimes").replaceChildren(...[
        ["DataFusion", data.datafusion, "df"],
        ["DuckDB", data.duckdb, "duck"]
      ].map(([name, result, kind]) => {
        const item = document.createElement("div");
        item.className = `query-time ${kind}${result.winner ? " is-winner" : ""}`;
        const title = document.createElement("span");
        title.textContent = name;
        const value = document.createElement("strong");
        value.textContent = `${result.seconds.toLocaleString("vi-VN", { minimumFractionDigits: 3 })} giây`;
        const note = document.createElement("small");
        note.textContent = result.winner ? "Nhanh hơn trong lần đo này" : "Cùng truy vấn và dữ liệu";
        item.append(title, value, note);
        return item;
      }));
      lane(get("queryDfNodes"), data.stages.map(s => s.df));
      lane(get("queryDuckNodes"), data.stages.map(s => s.duck));
      get("queryInterpretation").textContent = data.interpretation;
      get("queryEvidence").textContent = data.evidence;
      showStep();
    }

    buttons.forEach(button => button.addEventListener("click", () => render(button.dataset.case)));
    get("queryPrev").addEventListener("click", () => { if (step > 0) { stop(); step--; showStep(); } });
    get("queryNext").addEventListener("click", () => { if (step < cases[selected].stages.length - 1) { stop(); step++; showStep(); } });
    get("queryReplay").addEventListener("click", () => {
      if (timer !== null) { stop(); return; }
      if (reduce.matches) { step = cases[selected].stages.length - 1; showStep(); return; }
      step = 0; showStep();
      get("queryReplay").textContent = "Dừng";
      timer = window.setInterval(() => {
        if (step === cases[selected].stages.length - 1) { stop(); return; }
        step++; showStep();
      }, 2300);
    });
    document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
    reduce.addEventListener("change", () => { if (reduce.matches) stop(); });
    render("q6");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();

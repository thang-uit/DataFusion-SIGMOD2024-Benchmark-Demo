# Hướng dẫn tự code demo DataFusion

Tài liệu này **không có lời giải sẵn**. Nó cho bạn: demo cần chứng minh điều gì, làm theo bước nào, API nào hay vướng, chạy đúng thì sẽ thấy gì, và thầy có thể hỏi gì. Phần ráp code là của bạn — như vậy bạn hiểu từng dòng khi trình bày.

Mọi “kết quả mong đợi” bên dưới đã được kiểm chứng trên máy soạn (macOS Intel, Python 3.9, DataFusion 50.1.0, DuckDB 1.4.5). Số giây trên máy bạn sẽ khác; còn **cơ chế** (tên toán tử, số row group bị bỏ, kích thước batch…) thì giống nhau.

---

## 1. Demo cần chứng minh điều gì?

Bài báo không đề xuất thuật toán mới. Nó chứng minh một **luận điểm thiết kế**: *engine mở, mô-đun vẫn có thể nhanh ngang engine tích hợp chặt*. Demo của bạn chỉ cần thể hiện đúng tư duy đó qua 4 ý:

| Ý của bài báo | Mục | Demo thể hiện bằng |
|---|---|---|
| A. Kiến trúc chia tầng rõ ràng: front-end → LogicalPlan → ExecutionPlan → Stream | 5 | D1, D2 |
| B. Gom các kỹ thuật tối ưu tốt nhất đã biết | 5.5, 6 | D3, D4, D5, D6 |
| C. Mở rộng được, phần tự viết chạy như phần dựng sẵn | 7 | D7 |
| D. Hiệu năng cùng tầm với DuckDB | 8 | D8 |

**Vì sao dữ liệu nhỏ là đủ:** các cơ chế (pushdown, pruning, gom nhóm hai pha…) không phụ thuộc kích thước dữ liệu, và kết luận của mục 8 là so sánh **tương đối** giữa hai engine. Dữ liệu vài chục MB đến vài trăm MB là đủ để thấy rõ mọi thứ.

**Ưu tiên nếu ít thời gian:** làm **D1, D2, D4, D7, D8** (mỗi ý A–D có ít nhất một demo). D3, D5, D6 là điểm cộng.

---

## 2. Chuẩn bị môi trường

```bash
cd 04-demo
python3 -m venv .venv
source .venv/bin/activate              # Windows: .venv\Scripts\activate
pip install datafusion duckdb pyarrow pandas matplotlib jupyterlab
jupyter lab
```

Phiên bản đã kiểm chứng: `datafusion==50.1.0`, `duckdb==1.4.5`, `pyarrow==21.0.0`. Nên ghim đúng các phiên bản bạn dùng vào `requirements.txt`, và ghi chúng vào báo cáo, vì tên toán tử trong `EXPLAIN` đổi theo phiên bản (bài viết thời DataFusion 32 gọi `ParquetExec`, bản 50 gọi `DataSourceExec`).

**Cấu trúc gợi ý:**

```
04-demo/
├── README.md                 (tệp này)
├── requirements.txt          bạn tạo: ghim phiên bản
├── demo.ipynb                một notebook, mỗi demo là một mục; hoặc tách 2 notebook (cơ chế / benchmark)
├── data/                     dữ liệu sinh ra — đã có trong .gitignore, không commit
└── results/                  bảng CSV, hình PNG để đưa vào báo cáo
```

Mẹo trình bày notebook: mỗi demo theo khuôn **“Bài báo nói (mục, trang) → Ta làm → Kết quả → Giải thích”**. Thầy hỏi đến đâu, bạn chạy lại ô đó.

---

## 3. Dữ liệu nhỏ (tự tạo, không cần tải 14 GB)

### 3.1 Bảng tự sinh — dùng cho D1–D7

Tạo bảng `t(a, b, c)` khoảng **2 triệu dòng**, ghi ra Parquet với **10 row group × 200 000 dòng**:
- `a` = 0, 1, 2, … tăng dần; `b` = chữ cái A…G tăng theo `a` (ví dụ `"ABCDEFG"[a * 7 // N]`); `c` = 2·a.
- Ghi **hai bản**: `t_sorted.parquet` (giữ nguyên thứ tự) và `t_random.parquet` (xáo trộn các dòng trước khi ghi).

API cần biết:

```python
import pyarrow as pa, pyarrow.parquet as pq
pq.write_table(table, "data/t_sorted.parquet", row_group_size=200_000)

# Xem min/max của từng row group (zone map, mục 2.2):
meta = pq.ParquetFile("data/t_sorted.parquet").metadata
meta.row_group(i).column(0).statistics.min    # .max, .num_rows ...
```

Tự kiểm tra: in min/max cột `a` của 10 row group cho cả hai tệp. Tệp đã sắp có các khoảng “hẹp” liền nhau; tệp xáo trộn thì row group nào cũng có min ≈ 0, max ≈ 2 triệu. **Ghi nhớ bảng này — nó giải thích kết quả D4.**

### 3.2 TPC-H nhỏ — dùng cho D8

DuckDB tự sinh được TPC-H, không cần tải:

```python
import duckdb
con = duckdb.connect()
con.execute("INSTALL tpch; LOAD tpch; CALL dbgen(sf=0.1)")      # SF 0.1 ≈ 30 MB; SF 1 ≈ 300 MB
con.execute("COPY lineitem TO 'data/tpch/lineitem.parquet' (FORMAT parquet, ROW_GROUP_SIZE 1000000)")
# lặp cho 8 bảng: customer, orders, lineitem, part, partsupp, region, supplier, nation
queries = [q for (q,) in con.execute("SELECT query FROM tpch_queries() ORDER BY query_nr").fetchall()]
```

Lần đầu `INSTALL tpch` cần mạng. Row group 1 triệu dòng là để giống bài (mục 8). Đã kiểm chứng: **cả 22 truy vấn này chạy được trên DataFusion 50.1**, số dòng kết quả khớp DuckDB.

### 3.3 Tuỳ chọn: một tệp ClickBench thật (~120 MB)

`https://datasets.clickhouse.com/hits_compatible/athena_partitioned/hits_0.parquet` — một trong 100 tệp mà bài dùng. Tải bằng `curl` nhanh hơn bằng Python. Truy vấn và lệnh tạo view chính thức nằm trong repo ClickBench, thư mục `datafusion-partitioned/` và `duckdb-parquet-partitioned/` (tệp `create.sql`, `queries.sql`). Repo dùng giấy phép **CC BY-NC-SA 4.0**: dùng cho học tập được, ghi nguồn, đừng chép vào repo của bạn.

---

## 4. Các bài demo

### D1 — SQL và DataFrame cho cùng một kế hoạch · mục 5.3.3, tr. 5 · ý A

**Bài báo nói:** DataFrame API sinh ra *cùng một* LogicalPlan như SQL, được tối ưu và chạy y hệt.

**Bạn code:**
1. Tạo `SessionContext`, đăng ký `t_sorted.parquet` thành bảng `t`.
2. Viết một truy vấn bằng SQL, rồi viết lại bằng DataFrame API.
3. Lấy kế hoạch logic **sau tối ưu** của cả hai, in ra và so sánh bằng `==`.

```python
from datafusion import SessionContext, SessionConfig, col, lit
ctx = SessionContext(SessionConfig().with_target_partitions(4))
ctx.register_parquet("t", "data/t_sorted.parquet")
df1 = ctx.sql("SELECT a, b FROM t WHERE a > 1999997")
df2 = ctx.table("t").filter(col("a") > lit(1999997)).select(col("a"), col("b"))
df1.optimized_logical_plan().display_indent()   # dùng display_indent(), đừng dùng str()
```

**Kết quả mong đợi:** hai chuỗi giống hệt nhau: `Filter: t.a > Int64(1999997)` / `TableScan: t projection=[a, b], partial_filters=[...]`.

**Thầy có thể hỏi:** *“Vậy front-end có vai trò gì?”* → Front-end chỉ là cửa vào; từ LogicalPlan trở đi mọi thứ dùng chung. Vì vậy mục 7.5 nói có thể viết front-end riêng (PromQL, Spark) mà vẫn hưởng toàn bộ optimizer và engine.

---

### D2 — Vòng đời một truy vấn · mục 5.1, 6.1–6.3, tr. 4–6 · ý A + B

**Bài báo nói:** 6 bước: catalog → front-end tạo LogicalPlan → tối ưu logic → hạ xuống ExecutionPlan → tối ưu vật lý → Stream thực thi.

**Bạn code:**
1. Chọn một truy vấn có đủ lọc, gom nhóm, sắp xếp, LIMIT. Ví dụ: `SELECT b, sum(c) AS total FROM t WHERE a > 1000000 GROUP BY b ORDER BY total DESC LIMIT 3`.
2. Chạy `EXPLAIN VERBOSE` và lấy ra 3 giai đoạn: `initial_logical_plan`, `logical_plan`, `physical_plan`.
3. Viết bảng “thấy gì → nghĩa là gì → mục nào của bài”.

```python
batches = ctx.sql("EXPLAIN VERBOSE " + q).collect()
for b in batches:
    for kind, plan in zip(b.column(0).to_pylist(), b.column(1).to_pylist()):
        if kind in ("initial_logical_plan", "logical_plan", "physical_plan"):
            print("=====", kind); print(plan)
```

> ⚠️ `ctx.sql("EXPLAIN ...").show()` **báo lỗi** ở bản 50.1 (“Explain must be root of the plan”). Hãy dùng `.collect()` như trên, hoặc `ctx.sql(q).explain()`.

**Kết quả mong đợi — những dòng cần chỉ ra:**

| Thấy trong kế hoạch | Nghĩa là | Mục |
|---|---|---|
| `TableScan: t` trần ở `initial_logical_plan` | Dịch thẳng từ SQL, chưa tối ưu | 5.3.2 |
| `partial_filters=[...]` | Filter pushdown | 6.1, 6.8 |
| `projection=[...]` | Projection pushdown (bỏ cột thừa) | 6.1 |
| `Sort: ... fetch=3`, `SortExec: TopK(fetch=3)` | Limit pushdown, sort chuyên cho LIMIT | 6.1, 6.2 |
| `AggregateExec mode=Partial` → `RepartitionExec Hash` → `mode=FinalPartitioned` | Gom nhóm hai pha | 6.3 |
| `RepartitionExec` | Toán tử exchange kiểu Volcano | 5.5 |
| `CoalesceBatchesExec: target_batch_size=8192` | Batch 8192 dòng | 5.5.1 |
| `pruning_predicate=...` | Điều kiện để bỏ row group theo min/max | 6.8 |

Mẹo: thêm một cột không dùng đến (như `note`) vào bảng, sẽ thấy rõ projection pushdown bỏ nó đi.

**Thầy có thể hỏi:** *“LogicalPlan khác ExecutionPlan chỗ nào?”* → LogicalPlan nói **làm gì**; ExecutionPlan nói **làm thế nào**: thuật toán, số partition, thứ tự dữ liệu. *“Vì sao gom nhóm phải hai pha?”* → Mỗi partition tự gom cục bộ song song; chia lại theo hash để mọi bản ghi cùng khoá về một chỗ; rồi gộp lại.

---

### D3 — RecordBatch và partition · mục 5.5.1–5.5.2, tr. 5–6 · ý B (điểm cộng)

**Bài báo nói:** dữ liệu chảy theo RecordBatch mặc định 8192 dòng; số partition (số Stream song song) do planner quyết định.

**Bạn code:**
1. `ctx.sql("SELECT a FROM t").collect()` trả về danh sách batch → đếm số dòng của từng batch (`b.num_rows`).
2. In `physical_plan` của một truy vấn GROUP BY với `with_target_partitions(1)` và `(4)` — so sánh.
3. Tuỳ chọn: đo thời gian truy vấn đó với 1, 2, 4, 8 partition, vẽ đồ thị tăng tốc so với đường lý tưởng.

**Kết quả mong đợi:** 240 batch có 8192 dòng và 10 batch có 3392 dòng, vì mỗi row group 200 000 = 24 × 8192 + 3392. Với 1 partition: một `AggregateExec mode=Single`, không có `RepartitionExec`. Với 4 partition: hai pha + `RepartitionExec`. Trên máy 4 lõi, tăng tốc 1→4 partition khoảng 3,5×, lên 8 thì chững lại.

**Thầy có thể hỏi:** *“Sao 8 partition không nhanh gấp đôi 4?”* → Hết lõi vật lý (Hyper-Threading không gấp đôi sức tính), và phần việc mỗi partition ít đi nên chi phí phối hợp chiếm tỷ trọng lớn. Đây cũng là lý do bài thấy vài truy vấn chậm đi ở 64–192 lõi (mục 8.2).

---

### D4 — Pruning và late materialization · mục 6.8, tr. 7 · ý B (quan trọng nhất)

**Bài báo nói:** bộ đọc Parquet dùng vị từ để (1) bỏ cả row group theo min/max, (2) chỉ giải mã cột khác cho những dòng đã qua lọc (late materialization). Hiệu quả nhất khi cột vị từ được gom cụm. Ví dụ của bài là `A > 35 AND B = "F"`.

**Bạn code:**
1. Truy vấn tương tự ví dụ của bài: `SELECT b, count(*), max(c) FROM t WHERE a > 1500000 AND b = 'F' GROUP BY b`.
2. Chạy trên **4 cấu hình**: {tệp đã sắp, tệp xáo trộn} × {`pushdown_filters` tắt, bật}.
3. Với mỗi cấu hình, chạy `EXPLAIN ANALYZE`, tìm dòng chứa `DataSourceExec` và trích các chỉ số; đo thêm thời gian. Gom thành một bảng.

```python
cfg = (SessionConfig().with_target_partitions(1)
       .set("datafusion.execution.parquet.pushdown_filters", "true"))   # hoặc "false"
plan = ctx.sql("EXPLAIN ANALYZE " + q).collect()[0].column(1)[0].as_py()
# Chỉ số cần trích (dùng re.search(rf"{key}=([^,\]]+)", line)):
#   row_groups_pruned_statistics, row_groups_matched_statistics,
#   pushdown_rows_pruned, bytes_scanned, output_rows
```

**Kết quả mong đợi:**

| Tệp | pushdown_filters | row group bị bỏ | pushdown_rows_pruned | Ghi chú |
|---|---|---|---|---|
| đã sắp | tắt | **8/10** | 0 | chỉ đọc 2 row group |
| đã sắp | bật | 8/10 | ~185 000 | lọc thêm từng dòng lúc giải mã |
| xáo trộn | tắt | **0/10** | 0 | min/max quá rộng, không bỏ được gì |
| xáo trộn | bật | 0/10 | ~1,8 triệu | thường **chậm hơn** khi tắt |

Thêm vào đó, `pruning_predicate` mà engine tự sinh là `a_max > 1500000 AND b_min <= F AND F <= b_max` — chính là **phủ định** quy tắc bỏ row group trong bài (bỏ nếu A_max ≤ 35, hoặc B_max < "F", hoặc B_min > "F").

**Thầy có thể hỏi:**
- *“Vì sao tệp xáo trộn không bỏ được row group nào?”* → Chỉ ra bảng min/max ở mục 3.1 — đây là bằng chứng cho câu cuối mục 6.8.
- *“Late materialization tốt thế sao lại mặc định tắt?”* → Trên dữ liệu không gom cụm, nó tốn công đánh giá từng dòng mà không bỏ được gì; bảng của bạn cho thấy điều đó (đây là quan sát của bạn, bài báo không nói chuyện mặc định).

---

### D5 — Tận dụng thứ tự sắp · mục 6.1, 6.7, tr. 6–7 · ý B (điểm cộng)

**Bài báo nói:** optimizer bỏ sort thừa (6.1) và dùng toán tử streaming khi dữ liệu đã sắp (6.7) — nhóm “đóng” là xuất ngay, tiết kiệm bộ nhớ.

**Điểm mấu chốt:** DataFusion **không tự đoán** tệp đã sắp. Phải khai báo:

```python
ctx.sql("""CREATE EXTERNAL TABLE ts (a BIGINT, b VARCHAR, c BIGINT)
           STORED AS PARQUET LOCATION 'data/t_sorted.parquet'
           WITH ORDER (b ASC, a ASC)""").collect()
```

**Bạn code:**
1. `ORDER BY b, a` trên `ts` và trên bảng xáo trộn: kế hoạch vật lý có `SortExec` không?
2. `GROUP BY b, a` (2 triệu nhóm) trên hai bảng với `EXPLAIN ANALYZE`: xem `ordering_mode=Sorted` và chỉ số `peak_mem_used` của `AggregateExec`.

**Kết quả mong đợi:** trên `ts`: **không có SortExec**, AggregateExec có `ordering_mode=Sorted`, `peak_mem_used` khoảng 1 MB. Trên bảng xáo trộn: có SortExec, bảng băm giữ 2 triệu nhóm, `peak_mem_used` khoảng 126 MB — chênh hơn trăm lần.

**Thầy có thể hỏi:** *“Nếu khai báo sai thứ tự thì sao?”* → Kết quả có thể sai, vì engine tin lời khai báo. Đó là trách nhiệm của catalog/hệ thống bên trên — đúng tinh thần mục 5.2.1: catalog là việc của từng hệ.

---

### D6 — Giới hạn bộ nhớ và spill · mục 5.5.4, 7.4, tr. 5–6, 8 · ý B (điểm cộng)

**Bài báo nói:** toán tử báo `grow/shrink` cho MemoryPool; hết hạn mức thì tràn ra đĩa; DiskManager quản lý tệp spill; có GreedyPool và FairPool.

**Bạn code:** sort toàn bộ bảng xáo trộn (`ORDER BY c DESC, b`) với giới hạn bộ nhớ 20 MB, hai lần: có đĩa và tắt đĩa.

```python
from datafusion import RuntimeEnvBuilder
rt = RuntimeEnvBuilder().with_disk_manager_os().with_fair_spill_pool(20 * 1024 * 1024)
#      ↑ thay bằng .with_disk_manager_disabled() cho lần thứ hai
ctx = SessionContext(SessionConfig().with_target_partitions(1), rt)
```

**Kết quả mong đợi:** có đĩa: `SortExec` trong `EXPLAIN ANALYZE` có `spill_count` khoảng 13, `spilled_bytes` vài chục MB, truy vấn vẫn xong. Tắt đĩa: lỗi `ResourcesExhausted("Memory Exhausted while Sorting (DiskManager is disabled)")` — nhớ bọc `try/except` và in thông báo lỗi.

**Thầy có thể hỏi:** *“Greedy khác Fair thế nào?”* → Greedy: chỉ có trần chung, ai xin trước được trước. Fair: chia đều cho các toán tử có thể spill. Bạn có thể thử đổi sang `.with_greedy_memory_pool(...)` để so sánh.

---

### D7 — Hàm tự viết (UDF) · mục 7.1, tr. 7 · ý C

**Bài báo nói:** UDF nhận và trả cả một mảng Arrow (ColumnarValue), dùng cùng API với hàm dựng sẵn; engine không phân biệt.

**Bạn code:**
1. Viết UDF Python nhân đôi một cột, đăng ký vào context.
2. In `physical_plan` của `SELECT sum(double_it(a)) FROM t` — UDF nằm trong kế hoạch như biểu thức bình thường.
3. So kết quả với biểu thức dựng sẵn `sum(a * 2)`.
4. **Đếm số lần UDF được gọi** (dùng một biến đếm bên trong hàm) → chứng minh vector hoá.
5. So thời gian UDF với biểu thức dựng sẵn.

```python
import pyarrow as pa, pyarrow.compute as pc
from datafusion import udf
double_it = udf(lambda arr: pc.multiply(arr, 2), [pa.int64()], pa.int64(), "immutable", "double_it")
ctx.register_udf(double_it)
```

**Kết quả mong đợi:** kết quả trùng biểu thức dựng sẵn; UDF được gọi khoảng **250 lần cho 2 triệu dòng** (một lần mỗi batch, không phải mỗi dòng); UDF Python chậm hơn biểu thức dựng sẵn khoảng 1,5×.

**Thầy có thể hỏi:** *“UDF chậm hơn vậy sao bài nói nhanh như dựng sẵn?”* → Phần chậm là do mỗi batch phải đi qua trình thông dịch Python. Bài nói về UDF viết bằng Rust — cùng API, cùng định dạng Arrow, không có chi phí đó. Nêu rõ điểm này trong báo cáo để không hiểu sai luận điểm của bài.

---

### D8 — Mini benchmark với DuckDB · mục 8, tr. 8–11 · ý D

**Bài báo làm:** so DataFusion 32 với DuckDB 0.9.1 qua Python, trên tệp gốc, **một lõi**, ba bộ benchmark (ClickBench, TPC-H, H2O-G).

**Phương pháp đo của tác giả** (lấy từ script công khai `github.com/JayjeetAtGithub/datafusion-duckdb-benchmark`; repo không có giấy phép nên hãy **tự viết lại**, đừng chép):
- Một lõi: DataFusion `SessionConfig().with_target_partitions(1)`; DuckDB `con.execute("PRAGMA threads=1")`.
- Mỗi truy vấn chạy **5 lần, bỏ 2 lần đầu** (khởi động/cache), đo bằng `timeit.default_timer()` hoặc `time.perf_counter()` bao quanh `.collect()` (DataFusion) và `.fetchall()` (DuckDB). Bạn lấy trung vị của 3 lần còn lại.
- Cả hai engine đọc **cùng tệp Parquet**: DataFusion `ctx.register_parquet(...)`; DuckDB `CREATE VIEW lineitem AS SELECT * FROM read_parquet('...')`.

**Bạn code:**
1. Dữ liệu TPC-H SF 0,1 hoặc 1 (mục 3.2), 22 truy vấn từ `tpch_queries()`.
2. Một hàm đo theo phương pháp trên; chạy 22 truy vấn trên cả hai engine; bọc `try/except` để một truy vấn lỗi không làm dừng cả bộ.
3. Kết quả: bảng (query, DataFusion, DuckDB, tỷ lệ) + biểu đồ cột đôi giống Hình 5 (xanh = DuckDB, cam = DataFusion như bài).
4. Tóm tắt: số truy vấn mỗi bên nhanh hơn, **trung bình nhân** thời gian, tổng thời gian.
5. Đối chiếu với câu của bài: DataFusion nhanh ở Q4, Q9; ngang ở Q3, Q6, Q14; chậm hơn hơn 2× ở Q11, Q17, Q18, Q21.

**Kết quả mong đợi:** hai engine **cùng tầm**. Với phiên bản mới, nhiều truy vấn sẽ khác bài — ví dụ các truy vấn bài nói chậm vì thứ tự join có thể đã được cải thiện. Đó là **kết quả tốt** cho phần “phát triển từ bài báo”: bạn kiểm chứng dự đoán ở cuối mục 8.1 rằng cộng đồng sẽ cải thiện những chỗ còn kém.

**Tham khảo khi viết báo cáo:** từ chính Bảng 1 của bài, trung bình nhân của 37 truy vấn ClickBench là 4,50 s (DataFusion) và 4,41 s (DuckDB), chỉ chênh khoảng 2%; nhưng tổng thời gian thì DuckDB thấp hơn khoảng 25% do vài truy vấn rất dài. Hãy tóm tắt kết quả của bạn theo cả hai cách và giải thích vì sao trung bình nhân hợp lý hơn cho dữ liệu tỷ lệ.

**Mở rộng tuỳ chọn:**
- **H2O:** tự sinh tệp CSV nhỏ cùng cấu trúc: id1–id3 là chuỗi `id%03d` / `id%010d`, id4–id6 số nguyên, v1 trong 1–5, v2 trong 1–15, v3 số thực 0–100. Chạy 10 câu groupby chuẩn của H2O; đặc biệt câu dùng `corr` (Q9 trong Hình 6).
- **ClickBench:** dùng 1 tệp ClickBench (mục 3.3).
- **Theo số lõi:** đo theo số lõi 1, 2, 4… để đối chiếu hình dạng đường cong với Hình 7.

**Thầy có thể hỏi:**
- *“Kết quả của em khác bài, vậy bài sai à?”* → Không. Khác phiên bản (2023 so với nay), máy, quy mô, và tác giả xoá cache Linux trước mỗi truy vấn (macOS không làm được). Kết luận của bài là về **thiết kế**: hai engine cùng tầm, khác biệt đến từ chi tiết hiện thực từng truy vấn.
- *“Sao không chạy 14 GB như bài?”* → Mục tiêu là kiểm chứng tư duy và cơ chế; các kết luận so sánh tương đối không phụ thuộc kích thước. Ghi rõ đây là giới hạn của thí nghiệm.

---

## 5. Những chỗ dễ vướng (DataFusion Python 50.1)

| Hiện tượng | Cách xử lý |
|---|---|
| `ctx.sql("EXPLAIN ...").show()` báo “Explain must be root of the plan” | Dùng `.collect()` rồi đọc cột thứ 2, hoặc `df.explain()` / `df.explain(analyze=True)` |
| `str(df.optimized_logical_plan())` in dạng debug rất dài | Dùng `.display_indent()` |
| `df.to_pandas()` lỗi “No module named pandas” | `pip install pandas` |
| Tệp đã sắp nhưng không thấy `ordering_mode=Sorted` | Phải khai báo `WITH ORDER` (D5) |
| `pushdown_rows_pruned = 0` dù có vị từ | `datafusion.execution.parquet.pushdown_filters` mặc định là `false` |
| `ModuleNotFoundError` trong Jupyter | Kernel của notebook không trỏ vào `.venv`; chọn đúng kernel |
| Tải tệp lớn bằng Python chậm | Dùng `curl` |
| Đọc ClickBench bị cột chuỗi thành nhị phân | Đặt `datafusion.execution.parquet.binary_as_string = true` (DataFusion) và `binary_as_string=True` (DuckDB `read_parquet`) |

---

## 6. Kịch bản trình bày (10–15 phút)

1. **(1 phút)** Luận điểm của bài trong một câu, kèm bảng 4 ý A–D ở mục 1.
2. **(3 phút)** D1 + D2: kiến trúc tầng, chỉ vào từng dòng của kế hoạch và mục tương ứng của bài.
3. **(4 phút)** D4: bảng 4 cấu hình — đây là phần “wow” nhất. Giải thích bằng bảng min/max.
4. **(2 phút)** D7: UDF được gọi ~250 lần cho 2 triệu dòng.
5. **(3 phút)** D8: biểu đồ so với DuckDB, trung bình nhân, đối chiếu câu của bài, nêu giới hạn.
6. **(1 phút)** Kết luận: demo xác nhận điều gì, khác bài ở đâu và vì sao.

---

## 7. Checklist trước khi nộp

- [ ] Ghi phiên bản thư viện, cấu hình máy, quy mô dữ liệu ngay đầu notebook và trong báo cáo.
- [ ] Mỗi demo có dòng “Bài báo nói (mục, trang)”.
- [ ] Chạy lại toàn bộ notebook từ đầu (`Restart Kernel and Run All`) không lỗi.
- [ ] Không commit `data/` (đã có trong `.gitignore`); commit `results/` nếu cần hình cho báo cáo.
- [ ] Không chép mã của repo benchmark của tác giả và truy vấn ClickBench vào repo; ghi nguồn bằng link.
- [ ] Nêu rõ giới hạn: phiên bản mới hơn, máy cá nhân, dữ liệu nhỏ, không xoá cache.
- [ ] Tự trả lời được các câu “Thầy có thể hỏi” ở trên mà không cần nhìn tài liệu.

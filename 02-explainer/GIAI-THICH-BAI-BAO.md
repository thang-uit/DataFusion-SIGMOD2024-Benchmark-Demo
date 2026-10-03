# Giải thích bài báo DataFusion: vấn đề, giải pháp, bằng chứng

> **Bài báo:** Andrew Lamb, Yijie Shen, Daniël Heres, Jayjeet Chakraborty, Mehmet Ozan Kabak, Liang-Chi Hsieh, Chao Sun. *Apache Arrow DataFusion: A Fast, Embeddable, Modular Analytic Query Engine.* SIGMOD-Companion ’24, Santiago, Chile. DOI: [10.1145/3626246.3653368](https://doi.org/10.1145/3626246.3653368)
>
> **Đọc kèm:** bài gốc `00-paper/Apache_Arrow_DataFusion.pdf` · bản đọc hiểu từng mục `01-reading-guide/DataFusion-ban-doc-hieu.pdf` · trang web tương tác `03-website/index.html`.
>
> Số trang ghi “tr. X” là trang PDF của bài gốc (1–13).

---

## 1. Bài báo này thuộc loại gì?

Bài nằm ở **SIGMOD-Companion** (phần industry/demo của SIGMOD), không phải phần research chính. Điều này quyết định cách đọc:

- **Không có thuật toán mới.** Mục 6 (tr. 6) nói thẳng: các kỹ thuật tối ưu “không mới”, đã được nghiên cứu và hiện thực nhiều lần.
- **Đóng góp nằm ở tầm hệ thống:** một engine mở, mô-đun, dùng được trong sản xuất, cộng với bằng chứng thực nghiệm rằng thiết kế đó không làm mất hiệu năng.

Khi viết báo cáo, đừng tìm “thuật toán X tốt hơn Y” — hãy trình bày theo hướng **kiến trúc + bằng chứng**.

---

## 2. Vấn đề (What)

### 2.1 Bối cảnh

Engine phân tích hiệu năng cao (Vertica, Spark, DuckDB) xưa nay là các hệ **tích hợp chặt**: một nhóm viết tất cả từ định dạng tệp, bố cục bộ nhớ đến bộ thực thi, để tối ưu tận gốc (tr. 2).

### 2.2 Hai vấn đề tác giả chỉ ra

1. **Quá đắt.** Xây một engine như vậy cần nguồn tiền thương mại hoặc nghiên cứu lớn (tr. 2).
2. **Viết lại liên tục.** Nhu cầu mới (cloud co giãn, pipeline AI/ML, CSDL chuỗi thời gian, streaming…) cứ đẻ ra hệ mới, và hệ nào cũng viết lại cùng các thứ: parser SQL, optimizer, hash join, bộ đọc Parquet. Mục 4 (tr. 3) đưa hai ví dụ lịch sử: pandas ban đầu thiếu tối ưu truy vấn và thực thi vector hoá; Hadoop/MapReduce viết lại các kỹ thuật phân tích cấp thấp. Lý do: tri thức CSDL bị “nhốt” trong các hệ đóng, không tồn tại dưới dạng linh kiện.

### 2.3 Câu hỏi nghiên cứu (ngầm)

> Có thể xây một engine OLAP **mở, mô-đun, mở rộng được** mà **không phải trả giá bằng hiệu năng** so với engine tích hợp chặt hay không?

---

## 3. Giải pháp (How)

### 3.1 Ý tưởng một câu

Một engine “dùng chung” — như LLVM cho trình biên dịch (mục 4.1, tr. 3–4) — chia sẵn các ranh giới mô-đun mà ngành đã hiểu rõ; mỗi phần đều **chạy ngay được** và đều **thay/cắm thêm được**.

### 3.2 Ba viên gạch nền (mục 2, tr. 2–3)

| Nền | Vai trò | Vì sao quan trọng |
|---|---|---|
| **Apache Arrow** | Bố cục cột chuẩn trong RAM | Mọi công cụ “nói” cùng một định dạng → trao dữ liệu không cần chuyển đổi (zero-copy) |
| **Apache Parquet** | Định dạng tệp cột chuẩn de-facto | Nén tốt; có min/max theo row group/page → cắt bỏ dữ liệu không cần đọc |
| **Rust** | Ngôn ngữ hiện thực | Nhanh như C, an toàn bộ nhớ, không runtime → dễ nhúng; Cargo: thêm DataFusion bằng một dòng |

### 3.3 Kiến trúc 6 bước (mục 5.1, Hình 2, tr. 4)

```
Catalog & Data Sources ──┐
                         ▼
SQL / DataFrame ──► LogicalPlan ──(tối ưu logic)──► ExecutionPlan ──(tối ưu vật lý)──► Streams ──► kết quả
   (front end)       "làm gì"                         "làm thế nào"                    (chạy song song)
```

1. **Catalog & Data Sources:** schema, vị trí, thống kê.
2. **Front end** (SQL qua `sqlparser-rs`, hoặc DataFrame) dựng `LogicalPlan`.
3. **Optimizer** viết lại LogicalPlan (pushdown, rút gọn biểu thức, làm phẳng subquery…).
4. **Hạ xuống** `ExecutionPlan`: chọn thuật toán, ghi thứ tự sắp của dữ liệu.
5. **Tối ưu vật lý** cho khớp phần cứng: thêm partition, bỏ sort thừa, chọn Hash/Merge join.
6. **Stream** thực thi, phát kết quả dần.

### 3.4 Mô hình thực thi (mục 5.5, tr. 5–6)

- **Streaming kiểu kéo (pull-based, Volcano):** toán tử cha gọi `next()` lên toán tử con; dữ liệu chảy theo **RecordBatch** Arrow (mặc định 8192 dòng). Đã kiểm chứng: `CoalesceBatchesExec: target_batch_size=8192` xuất hiện trong EXPLAIN thật.
- **Song song:** mỗi ExecutionPlan có N **partition** = N Stream chạy song song; `RepartitionExec` (toán tử exchange) chia lại dữ liệu giữa các partition (Hình 4).
- **Lập lịch:** Stream là hàm `async` của Rust chạy trên runtime **Tokio** (work-stealing). Hình 3 cho thấy một toán tử chỉ là vòng lặp `while let Some(batch) = stream.next().await`.
- **Bộ nhớ:** `MemoryPool` dùng chung; Stream tự báo `grow`/`shrink`; hết hạn mức thì **spill** ra đĩa. Có `GreedyPool` và `FairPool`.

### 3.5 Các kỹ thuật tối ưu được gom vào (mục 6, tr. 6–7)

| Kỹ thuật | Ý chính | Mục |
|---|---|---|
| Viết lại truy vấn | Đẩy xuống projection/filter/limit, CSE, làm phẳng subquery, outer→inner join; bỏ sort thừa, tăng song song | 6.1 |
| Sort | Tree of losers, khoá chuẩn hoá, spill, Top K | 6.2 |
| Gom nhóm | Băm phân vùng song song **hai pha** (Partial → Repartition Hash → Final), vector hoá, spill | 6.3 |
| Join | Tự nhận diện equi-join, sắp lại thứ tự join theo thống kê, vị từ bắc cầu; hash/merge/symmetric hash/nested loops/cross join | 6.4 |
| Window | Tái dùng thứ tự sẵn có, tính tăng dần | 6.5 |
| RowFormat | Mã hoá nhiều cột thành chuỗi byte so sánh bằng `memcmp` (số big-endian, lật bit dấu…) | 6.6 |
| Tận dụng thứ tự | Theo dõi nhiều thứ tự sắp, aggregate/join streaming khi dữ liệu đã sắp | 6.7 |
| Pushdown + late materialization | Bỏ row group/page theo min/max, Bloom filter; giải mã cột khác chỉ cho dòng đã qua lọc | 6.8 |

**Ví dụ 4 bước của mục 6.8** với `A > 35 AND B = "F"`:
1. Bỏ row group có `A_max ≤ 35` hoặc `B_max < "F"` hoặc `B_min > "F"` (chỉ đọc metadata).
2. Giải mã cột B, lọc `B = "F"` → RowSelection (ví dụ dòng 100–244).
3. Chỉ giải mã những page của A chứa các dòng đó (nhờ Page Index), lọc `A > 35` → thu hẹp (ví dụ 100–150).
4. Giải mã các cột còn lại (C…) chỉ cho dòng còn lại.

### 3.6 Bảy nhóm điểm mở rộng (mục 7, tr. 7–8)

| Mục | API | Ví dụ trong bài |
|---|---|---|
| 7.1 | `ScalarUDF`, `AggregateUDF`, `WindowUDF` | Đạo hàm theo cửa sổ, chia xô thời gian, mật mã riêng |
| 7.2 | `CatalogProvider` → `SchemaProvider` → `TableProvider` | Delta Lake Rust bỏ tệp theo vị từ |
| 7.3 | `TableProvider` | Bộ đệm Arrow, Arrow Flight, định dạng riêng |
| 7.4 | `MemoryPool`, `DiskManager`, `CacheManager` | Cache LIST trên object store |
| 7.5 | Viết lại AST / front-end riêng | PromQL, Vega |
| 7.6 | `OptimizerRule`, `PhysicalOptimizerRule` | Sắp lại đầu vào, mở rộng macro |
| 7.7 | `ExecutionPlan` | InfluxDB IOx: gap filling, pivot |

**Điểm mấu chốt lặp lại:** phần dựng sẵn được viết **bằng chính các API này** và mọi thứ trao đổi bằng Arrow, nên phần mở rộng **nhanh như phần dựng sẵn** và engine **không phân biệt** chúng khi tối ưu/thực thi. Ở engine khác, UDF/nguồn dữ liệu tự viết thường là “công dân hạng hai” (chậm, bị giới hạn, phải học biểu diễn nội bộ).

---

## 4. Vì sao tin được (Why)

### 4.1 Lý lẽ

- **Chuẩn mở** loại bỏ chi phí chuyển đổi và cho chia sẻ hệ sinh thái (mục 2).
- **Ranh giới mô-đun** đã được ngành hiểu rõ sau hàng chục năm (mục 1).
- **Hiệu năng phụ thuộc mức đầu tư, không phụ thuộc kiến trúc** (thảo luận cuối 8.1 và mục 10); engine dùng chung gom được đầu tư của nhiều bên. *Đây là lập luận/dự đoán, không phải điều bài chứng minh.*

### 4.2 Bằng chứng sử dụng thực tế (mục 3)

InfluxDB 3.0, Coralogix, Synnada, Arroyo, Comet/Blaze cho Spark, Seafowl, VegaFusion, dask-sql, SDF, Delta Lake/Iceberg/Lance bản Rust.

### 4.3 Bằng chứng thực nghiệm (mục 8, tr. 8–11)

**Thiết lập:** DataFusion 32.0.0 và DuckDB 0.9.1, qua Python, chạy thẳng trên tệp gốc.

| Benchmark | Dữ liệu | Kết quả chính |
|---|---|---|
| ClickBench (Bảng 1) | 14 GB, 100 tệp Parquet | Ngang nhau. DataFusion hơn khi vị từ rất chọn lọc (Q2, Q8, Q20) và khi chỉ có một nhóm (Q4, Q7, Q30); DuckDB hơn khi ≥ 10 triệu nhóm (Q18, Q19, Q36) |
| TPC-H SF10 (Hình 5) | 2,5 GB Parquet | DataFusion chậm > 2× ở Q11, Q17, Q18, Q21 do thứ tự join chưa tối ưu; ép tay thì ngang |
| H2O-G (Hình 6) | CSV 488 MB | DataFusion nhỉnh hơn đa số (parse CSV nhanh), kém ở Q9 (hàm `corr`) |
| Mở rộng 1–192 lõi (Hình 7) | ClickBench, máy 176 vCPU | Cả hai gần tuyến tính đến 32 lõi; trên 64 lõi lẫn lộn; hình dạng đường cong giống nhau |

**Số tóm tắt do người soạn tính từ Bảng 1** (bài không in, dùng để kiểm chứng câu “tương đương”):

| Chỉ số | DataFusion | DuckDB |
|---|---|---|
| Số truy vấn nhanh hơn (trên 37) | 19 | 18 |
| Trung bình nhân thời gian | 4,50 s | 4,41 s (chênh ~2%) |
| Tổng thời gian | 627,9 s | 472,5 s (DuckDB thấp hơn ~25%, do vài truy vấn rất dài Q19, Q29, Q33) |

→ Kết luận của bài đứng vững nếu tóm tắt bằng trung bình nhân (cách hợp lý cho dữ liệu tỷ lệ); nếu nhìn tổng thời gian thì DuckDB nhỉnh hơn rõ. Đây là một điểm hay để nêu trong phần đánh giá.

---

## 5. Tính SOTA — viết thế nào cho đúng

Đừng viết “bài đề xuất phương pháp SOTA”. Hãy viết tính SOTA ở ba lớp:

1. **Hiệu năng SOTA:** engine mở đạt mức của DuckDB — đại diện engine tích hợp chặt hàng đầu lúc đó — trên ba benchmark chuẩn, cả một lõi và nhiều lõi.
2. **Kiến trúc SOTA:** hiện thực đầy đủ, chạy trong sản xuất, của hướng “composable data management systems” (Pedreira et al., VLDB 2023 — tài liệu [61] của bài).
3. **Tập kỹ thuật SOTA:** gom vector hoá trên Arrow, pruning + late materialization trên Parquet, RowFormat, aggregate hai pha, sort kiểu Graefe, thực thi async.

**Diễn biến sau bài báo (nguồn ngoài, nên trích link):**
- 04/2024: tách khỏi Arrow, thành dự án cấp cao nhất “Apache DataFusion” ([Arrow blog](https://arrow.apache.org/blog/2024/05/07/datafusion-tlp/); [ASF](https://news.apache.org/foundation/entry/apache-software-foundation-announces-new-top-level-project-apache-datafusion)).
- 11/2024: DataFusion 43.0.0 đứng đầu ClickBench hạng mục truy vấn Parquet phân vùng ([DataFusion blog](https://datafusion.apache.org/blog/2024/11/18/datafusion-fastest-single-node-parquet-clickbench/)). Về sau engine khác vượt lại; blog bản 45 (02/2025) ghi nhận DataFusion vẫn ở nhóm đầu.

Các mốc này phần nào ủng hộ dự đoán “đầu tư cộng đồng → hiệu năng” ở mục 10.

---

## 6. Đánh giá phê phán (nên có trong báo cáo)

**Điểm mạnh**
- Lập luận rõ, có cả bằng chứng sử dụng thực tế lẫn benchmark; script benchmark công khai.
- Trung thực về điểm yếu (thứ tự join, aggregate số nhóm lớn, hàm `corr`) và có link issue cụ thể.
- Danh sách API mở rộng có giá trị như bản thiết kế mẫu cho engine khác.

**Hạn chế**
- Chỉ so với **một** đối thủ (DuckDB); không có Velox, ClickHouse, Spark.
- Chạy trên Parquet/CSV — **sân nhà** của DataFusion; DuckDB không được dùng định dạng riêng của nó (tác giả có giải thích lý do).
- Kết luận “tương đương” phụ thuộc cách tóm tắt (xem mục 4.3 ở trên).
- Luận điểm chính về **tiết kiệm công sức** chưa được đo — tác giả tự thừa nhận ở 9.1.
- Không đo trực tiếp “phần mở rộng có nhanh như phần dựng sẵn không” — chỉ lập luận.
- Vài lỗi nhỏ trong bài: tài liệu [64] trỏ nhầm link; mục 7.2 đánh số “1), 2), 2)”; Hình 3 gửi `batch` thay vì `output`.

---

## 7. Gợi ý khung báo cáo 5–7 trang

| Phần | Độ dài gợi ý | Nội dung |
|---|---|---|
| 1. Giới thiệu bài báo | ½ trang | Thông tin bài, bối cảnh, câu hỏi nghiên cứu |
| 2. Tính SOTA | 1 trang | Ba lớp SOTA (mục 5 ở trên) + diễn biến sau bài |
| 3. What – vấn đề | ½–1 trang | Mục 2 ở trên |
| 4. How – giải pháp | 1½–2 trang | Kiến trúc 6 bước, mô hình thực thi, 2–3 kỹ thuật tiêu biểu (pushdown/late materialization, aggregate hai pha, RowFormat), API mở rộng |
| 5. Why – bằng chứng & đánh giá | 1 trang | Benchmark + số tóm tắt + phê phán |
| 6. Cài đặt minh hoạ | 1–1½ trang | Demo ở `04-demo/` (ảnh chụp EXPLAIN, bảng đo), link GitHub |
| 7. Kết luận & hướng phát triển | ½ trang | Theo 9.1 của bài + kết quả demo |

---

## 8. Demo: bài có demo không, làm được không?

**Ngắn gọn:** bài **không có demo ứng dụng**, chỉ có thí nghiệm benchmark (script công khai: [JayjeetAtGithub/datafusion-duckdb-benchmark](https://github.com/JayjeetAtGithub/datafusion-duckdb-benchmark)). Nhưng DataFusion là phần mềm mã nguồn mở thật nên **mọi cơ chế trong bài đều chạy thật được, không cần giả lập** — chỉ cần thu nhỏ quy mô dữ liệu.

**Đã kiểm chứng trên máy này** (Python 3.9, macOS; `pip install datafusion duckdb pyarrow` → datafusion 50.1.0, duckdb 1.4.5):

| Cơ chế trong bài | Kiểm chứng được bằng | Kết quả quan sát |
|---|---|---|
| LogicalPlan → ExecutionPlan (5.1) | `df.explain()`, `EXPLAIN VERBOSE` | Thấy `initial_logical_plan`, các luật `push_down_filter`, `optimize_projections`, `physical_plan` |
| RecordBatch 8192 dòng (5.5.1) | EXPLAIN | `CoalesceBatchesExec: target_batch_size=8192` |
| Partition + RepartitionExec (5.5.2) | `SessionConfig().with_target_partitions(4)` | `RepartitionExec: partitioning=Hash([...], 4)`, `RoundRobinBatch(4)` |
| Aggregate hai pha (6.3) | EXPLAIN | `AggregateExec mode=Partial` → `RepartitionExec Hash` → `mode=FinalPartitioned` |
| Top K (6.2) | `ORDER BY … LIMIT 3` | `SortExec: TopK(fetch=3)` |
| Tận dụng thứ tự (6.7) | Tệp đã sắp | `ordering_mode=Sorted` |
| Pruning row group (6.8) | `EXPLAIN ANALYZE` trên Parquet 10 row group | `row_groups_pruned_statistics=8`, `matched=2`; `pruning_predicate` đúng quy tắc bước 1 |
| Late materialization (6.8) | `datafusion.execution.parquet.pushdown_filters=true` | `pushdown_rows_pruned=185715` (mặc định tắt ở bản 50.1) |
| UDF (7.1) | `udf(...)` + `register_udf` | Hàm Python vector hoá chạy trong SQL |
| DataFrame = SQL (5.3.3) | So hai kế hoạch | Cùng LogicalPlan |
| Benchmark (8) | DuckDB `CALL dbgen(sf=0.1)` → Parquet | Sinh TPC-H SF 0,1 trong ~4 s, DataFusion đọc được |

**Phần phải thu nhỏ hoặc không làm được nguyên vẹn:**
- Quy mô benchmark (14 GB, máy 176 lõi) → dùng TPC-H SF 0,1–1 và tập con ClickBench; số liệu sẽ khác bài.
- Viết `ExecutionPlan`, `OptimizerRule`, `TableProvider` đầy đủ cần **Rust** (Python binding chủ yếu lo SQL, DataFrame, UDF, cấu hình).

Hướng dẫn tự code demo (8 bài, dữ liệu nhỏ, kết quả mong đợi, câu hỏi phản biện): `04-demo/README.md`.

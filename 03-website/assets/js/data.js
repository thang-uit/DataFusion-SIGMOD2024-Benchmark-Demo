/* Content data for the interactive widgets.
   TABLE1 is copied from Table 1 of the paper (seconds, single core).
   Plan texts are real output of DataFusion 50.1.0 (Python) on generated data. */
"use strict";

window.DF = {};

// [query, DataFusion seconds, DuckDB seconds]
DF.TABLE1 = [
  [1, 1.22, 0.18], [2, 0.36, 0.81], [3, 1.11, 1.78], [4, 1.09, 1.5], [5, 20.74, 8.34],
  [6, 17.81, 11.98], [7, 0.3, 2.08], [8, 0.37, 0.83], [9, 27.91, 10.83], [10, 25.84, 14.11],
  [11, 4.29, 3.22], [12, 4.67, 8.69], [13, 11.38, 10.27], [14, 26.96, 14.61], [15, 12.7, 11.15],
  [16, 13.31, 9.12], [17, 29.6, 21.97], [18, 29.09, 21.23], [19, 92.31, 39.1], [20, 0.8, 1.33],
  [25, 6.01, 8.44], [26, 5.02, 6.11], [27, 6.59, 8.4], [28, 23.62, 23.85], [29, 107.41, 62.99],
  [30, 5.91, 69.08], [31, 12.59, 12.95], [32, 14.85, 15.93], [33, 92.17, 57.2], [36, 27.89, 11.48],
  [37, 0.67, 0.52], [38, 0.34, 0.38], [39, 0.34, 0.42], [40, 2.05, 0.83], [41, 0.2, 0.25],
  [42, 0.17, 0.24], [43, 0.19, 0.27]
];

// Query groups the paper itself comments on in Section 8.1.
DF.T1_CATS = {
  selective: { qs: [2, 8, 20], text: "Q2, Q8, Q20 có vị từ rất chọn lọc. Bài cho rằng DataFusion nhanh hơn nhờ đẩy vị từ vào scan Parquet để bỏ qua cả row group (mục 6.8)." },
  single: { qs: [4, 7, 30], text: "Q4, Q7, Q30 chỉ có một nhóm. Bài cho rằng DataFusion nhanh hơn nhờ cập nhật aggregate vector hoá. Q30 là chênh lớn nhất: 5,91 s so với 69,08 s." },
  similar: { qs: [15, 31, 32, 41, 42], text: "Q15, Q31, Q32, Q41, Q42: chọn lọc vừa, số nhóm vừa — hai engine tương đương. Lưu ý Q15 thực ra DataFusion chậm hơn 1,14×." },
  highcard: { qs: [18, 19, 36], text: "Q18, Q19, Q36 có từ 10 triệu nhóm trở lên. DuckDB nhanh hơn, bài cho là nhờ aggregate song song được tối ưu của DuckDB. Cộng đồng DataFusion có issue riêng cho việc này." }
};

DF.ARCH = {
  parquet: ["Parquet TableProvider", "5.2.2, 6.8", "Bộ đọc Parquet dựng sẵn, dùng bản Rust native của Arrow: predicate pushdown, cắt row group/page theo min/max, Bloom filter, late materialization, kiểu lồng. Viết bằng đúng API TableProvider mà người dùng dùng."],
  csv: ["CSV, JSON, Avro, Arrow IPC", "5.2.2", "Các định dạng dựng sẵn khác. CSV và JSON tự suy schema; JSON hỗ trợ đầy đủ kiểu lồng."],
  extCatalog: ["Catalog / bảng mở rộng", "7.2, 7.3", "Bạn hiện thực CatalogProvider → SchemaProvider → TableProvider để đưa catalog riêng (Hive metastore, Delta Lake…) và nguồn dữ liệu riêng (bộ đệm RAM, Arrow Flight, định dạng riêng) vào engine."],
  sql: ["SQL front end", "5.3.2", "sqlparser-rs parse câu SQL thành AST, rồi SQL planner của DataFusion dựng LogicalPlan. Hỗ trợ tập con lớn của SQL: window, GROUPING SETS, CTE đệ quy, mọi loại JOIN…"],
  dataframe: ["DataFrame API", "5.3.3", "API kiểu pandas: ctx.table('t').filter(...).select(...). Sinh ra cùng LogicalPlan với SQL, được tối ưu và chạy y hệt."],
  extFrontend: ["Front-end mở rộng", "7.5", "Thêm cú pháp bằng cách viết lại AST trước khi gọi planner, hoặc viết hẳn front-end cho ngôn ngữ khác (PromQL, Vega, InfluxQL, Spark) sinh ra LogicalPlan."],
  logical: ["LogicalPlan", "5.4", "Cây toán tử quan hệ + biểu thức (Expr): nói làm gì. Có thống kê, phân tích khoảng, ước lượng selectivity; tuần tự hoá được bằng Protobuf hoặc Substrait."],
  extLogical: ["OptimizerRule (mở rộng)", "6.1, 7.6", "Luật viết lại kế hoạch logic do bạn viết, cùng API với luật dựng sẵn (pushdown, rút gọn biểu thức, làm phẳng subquery…). Chọn được thứ tự áp dụng."],
  physical: ["ExecutionPlan", "5.1, 5.5", "Kế hoạch vật lý: thuật toán cụ thể, số partition, thứ tự sắp của dữ liệu trung gian. Mỗi nút tạo một Stream cho mỗi partition khi chạy."],
  extPhysical: ["PhysicalOptimizerRule (mở rộng)", "6.1, 7.6", "Luật viết lại kế hoạch vật lý: bỏ sort thừa, tăng song song, chọn Hash/Merge join… và luật riêng của bạn."],
  expr: ["Expression Eval", "5.4, 7.1", "Đánh giá PhysicalExpr trên cả RecordBatch (vector hoá). Hàm dựng sẵn và UDF dùng chung API, nhận/trả ColumnarValue."],
  hashagg: ["HashAggregate", "6.3", "Gom nhóm băm song song hai pha (Partial → Repartition → Final), vector hoá, spill ra đĩa, có bản streaming khi khoá nhóm đã sắp."],
  join: ["Join", "6.4", "Hash join (băm vector hoá kiểu MonetDB), merge join, symmetric hash join, nested loops, cross join; hỗ trợ Inner/Left/Right/Full/Semi/Anti."],
  sort: ["Sort", "6.2, 6.6", "Sort nhiều cột theo Graefe: tree of losers, RowFormat (so sánh bằng memcmp), spill ra tệp tạm, bản Top K cho LIMIT."],
  extStream: ["ExecutionPlan / Stream tự viết", "7.7", "Toán tử riêng (gap filling, pivot…) hiện thực trait ExecutionPlan. Engine không phân biệt với toán tử dựng sẵn khi tối ưu và chạy."]
};

DF.LIFECYCLE = [
  {
    text: "<b>Catalog &amp; nguồn dữ liệu</b> cho biết bảng <code>sales</code> có những cột nào, kiểu gì, nằm ở tệp nào. Ở đây ta đăng ký một tệp Parquet; catalog trong bộ nhớ ghi lại schema đọc từ footer của tệp.",
    title: "Python",
    code: "ctx = SessionContext(SessionConfig().with_target_partitions(4))\nctx.register_parquet(\"sales\", \"sales.parquet\")\n# schema lấy từ footer Parquet:\n#   region: Utf8, amount: Int64, note: Utf8"
  },
  {
    text: "<b>Front end</b>: sqlparser-rs parse câu SQL, SQL planner dựng <code>LogicalPlan</code> đúng theo câu chữ — đọc từ dưới lên: quét bảng, lọc, gom nhóm, chọn cột, sắp xếp, giới hạn. Chưa có tối ưu nào: TableScan còn đọc mọi cột.",
    title: "initial_logical_plan",
    code: "Limit: skip=0, fetch=3\n  Sort: total DESC NULLS FIRST\n    Projection: sales.region, sum(sales.amount) AS total\n      Aggregate: groupBy=[[sales.region]], aggr=[[sum(sales.amount)]]\n        Filter: sales.amount > Int64(100)\n          TableScan: sales"
  },
  {
    text: "<b>Tối ưu logic</b> (mục 6.1): luật <code>push_down_filter</code> đẩy điều kiện xuống TableScan (<code>partial_filters</code>), <code>optimize_projections</code> chỉ đọc 2 cột cần (cột <code>note</code> bị bỏ), LIMIT được nhập vào Sort thành <code>fetch=3</code>.",
    title: "logical_plan (sau tối ưu)",
    code: "Sort: total DESC NULLS FIRST, <h>fetch=3</h>\n  Projection: sales.region, sum(sales.amount) AS total\n    Aggregate: groupBy=[[sales.region]], aggr=[[sum(sales.amount)]]\n      Filter: sales.amount > Int64(100)\n        TableScan: sales <h>projection=[region, amount]</h>, <h>partial_filters=[sales.amount > Int64(100)]</h>"
  },
  {
    text: "<b>Hạ xuống ExecutionPlan</b>: mỗi nút logic thành nút vật lý với thuật toán cụ thể. Aggregate tách thành hai pha (<code>Partial</code> và <code>FinalPartitioned</code>, mục 6.3); Sort + LIMIT thành <code>TopK</code> (mục 6.2).",
    title: "initial_physical_plan",
    code: "SortExec: <h>TopK(fetch=3)</h>, expr=[total@1 DESC]\n  ProjectionExec: expr=[region@0 as region, sum(sales.amount)@1 as total]\n    AggregateExec: <h>mode=FinalPartitioned</h>, gby=[region@0 as region]\n      AggregateExec: <h>mode=Partial</h>, gby=[region@0 as region]\n        FilterExec: amount@1 > 100\n          DataSourceExec: file_groups={1 group: [...]}, projection=[region, amount], file_type=parquet"
  },
  {
    text: "<b>Tối ưu vật lý</b> cho khớp phần cứng: tệp nhỏ chỉ có 1 nhóm nên engine chèn <code>RepartitionExec RoundRobinBatch(4)</code> để dùng đủ 4 lõi, chèn <code>RepartitionExec Hash</code> giữa hai pha aggregate (toán tử exchange kiểu Volcano), gom batch về 8192 dòng, và trộn kết quả bằng <code>SortPreservingMergeExec</code>. Vị từ còn được đẩy vào bộ đọc Parquet thành <code>pruning_predicate</code>.",
    title: "physical_plan (cuối cùng)",
    code: "SortPreservingMergeExec: [total@1 DESC], fetch=3\n  SortExec: TopK(fetch=3), expr=[total@1 DESC], preserve_partitioning=[true]\n    ProjectionExec: expr=[region@0 as region, sum(sales.amount)@1 as total]\n      AggregateExec: mode=FinalPartitioned, gby=[region@0 as region]\n        CoalesceBatchesExec: <h>target_batch_size=8192</h>\n          RepartitionExec: <h>partitioning=Hash([region@0], 4)</h>, input_partitions=4\n            AggregateExec: mode=Partial, gby=[region@0 as region]\n              CoalesceBatchesExec: target_batch_size=8192\n                FilterExec: amount@1 > 100\n                  RepartitionExec: <h>partitioning=RoundRobinBatch(4)</h>, input_partitions=1\n                    DataSourceExec: ..., predicate=amount@1 > 100,\n                      <h>pruning_predicate=amount_null_count@1 != row_count@2 AND amount_max@0 > 100</h>"
  },
  {
    text: "<b>Stream chạy</b>: mỗi nút tạo một Stream cho mỗi partition; các Stream kéo RecordBatch của nhau bằng async/await trên Tokio (mục 5.5). Kết quả trả về dần.",
    title: "Kết quả",
    code: "+---------+---------+\n| region  | total   |\n+---------+---------+\n| Sai Gon | 4843723 |\n| Da Nang | 4825145 |\n| Hue     | 4814345 |\n+---------+---------+"
  }
];

DF.PUSH = {
  before: {
    title: "initial_logical_plan",
    code: "Limit: skip=0, fetch=3\n  Sort: total DESC NULLS FIRST\n    Projection: sales.region, sum(sales.amount) AS total\n      Aggregate: groupBy=[[sales.region]], aggr=[[sum(sales.amount)]]\n        Filter: sales.amount > Int64(100)\n          TableScan: sales",
    text: "TableScan đọc <b>cả 3 cột</b> và mọi dòng; bộ lọc chỉ áp dụng sau khi dữ liệu đã được đọc lên."
  },
  after: {
    title: "logical_plan (sau push_down_filter + optimize_projections)",
    code: "Sort: total DESC NULLS FIRST, <h>fetch=3</h>\n  Projection: sales.region, sum(sales.amount) AS total\n    Aggregate: groupBy=[[sales.region]], aggr=[[sum(sales.amount)]]\n      Filter: sales.amount > Int64(100)\n        TableScan: sales <h>projection=[region, amount]</h>, <h>partial_filters=[sales.amount > Int64(100)]</h>",
    text: "<b>Projection pushdown</b>: chỉ đọc 2/3 cột. <b>Filter pushdown</b>: điều kiện được giao cho nguồn dữ liệu (<i>partial</i> = nguồn có thể lọc một phần, Filter vẫn giữ lại để chắc chắn). <b>Limit pushdown</b>: Sort chỉ cần giữ 3 dòng."
  }
};

DF.FE = {
  sql: { title: "SQL", code: "ctx.sql(\"SELECT a, b FROM t WHERE a > 1999997\")" },
  df: { title: "DataFrame (Python)", code: "from datafusion import col, lit\nctx.table(\"t\").filter(col(\"a\") > lit(1999997)).select(col(\"a\"), col(\"b\"))" }
};

DF.EXT = [
  { key: "udf", name: "Hàm", api: "ScalarUDF · AggregateUDF · WindowUDF", sec: "7.1",
    what: "Viết hàm nhận và trả ColumnarValue (scalar hoặc Arrow Array). Ba loại: mỗi dòng → một (scalar), nhiều dòng → một (aggregate), mỗi dòng → một nhưng nhìn được khung cửa sổ (window).",
    example: "Đạo hàm theo cửa sổ, chia xô thời gian cho chuỗi thời gian, hàm mật mã riêng.",
    why: "Engine khác: UDF thường chậm hơn hàm dựng sẵn hoặc phải học biểu diễn dữ liệu nội bộ; ở DataFusion hàm dựng sẵn cũng viết bằng chính API này." },
  { key: "catalog", name: "Catalog", api: "CatalogProvider · SchemaProvider", sec: "7.2",
    what: "Cấp danh sách schema và bảng, có thể async (gọi catalog từ xa qua mạng). Dùng metadata min/max để bỏ tệp hoặc row group.",
    example: "Delta Lake bản Rust bỏ qua tệp Parquet theo vị từ; lấy schema từ Hive metastore.",
    why: "DataFusion cố tình chỉ kèm catalog đơn giản vì catalog là quyết định thiết kế riêng của từng hệ." },
  { key: "table", name: "Nguồn dữ liệu", api: "TableProvider", sec: "7.3",
    what: "Biến bất kỳ nguồn nào thành bảng: hỗ trợ phân vùng, pushdown projection/filter/limit, đọc song song, thứ tự có sẵn, thống kê, cập nhật.",
    example: "Bộ đệm Arrow trong RAM, stream từ server qua Arrow Flight, định dạng tệp riêng.",
    why: "Ở engine tích hợp chặt, nguồn tự viết phải xuất định dạng nội bộ, hiểu biểu diễn biểu thức để pushdown, làm I/O async — nên hiếm khi nhanh bằng định dạng dựng sẵn." },
  { key: "env", name: "Môi trường thực thi", api: "MemoryPool · DiskManager · CacheManager", sec: "7.4",
    what: "Chính sách bộ nhớ (Greedy/Fair hoặc tự viết), tệp spill, cache danh sách thư mục và metadata tệp.",
    example: "Cache kết quả LIST trên object store; giới hạn dung lượng tệp tạm; chính sách loại bỏ cache riêng.",
    why: "Môi trường khác nhau rất nhiều (NVMe hay không, nhiều truy vấn chung tài nguyên hay ngân sách cố định), không có một chính sách đúng cho tất cả." },
  { key: "frontend", name: "Front-end", api: "Viết lại AST · LogicalPlanBuilder", sec: "7.5",
    what: "Thêm cú pháp SQL bằng cách sửa AST trước khi lập kế hoạch, hoặc viết front-end cho ngôn ngữ khác sinh ra LogicalPlan.",
    example: "PromQL, Vega, InfluxQL; Comet nhận kế hoạch từ Spark.",
    why: "Tách ngôn ngữ khỏi engine như LLVM tách ngôn ngữ khỏi backend." },
  { key: "rules", name: "Luật tối ưu", api: "OptimizerRule · PhysicalOptimizerRule", sec: "7.6",
    what: "Viết lại cây LogicalPlan / ExecutionPlan; chọn thứ tự áp dụng cả luật dựng sẵn lẫn luật riêng.",
    example: "Sắp lại đầu vào theo hiểu biết lĩnh vực, mở rộng macro.",
    why: "Luật riêng chạy cùng khung với luật dựng sẵn, không phải fork engine." },
  { key: "ops", name: "Toán tử", api: "ExecutionPlan (+ nút logic mở rộng)", sec: "7.7",
    what: "Hiện thực trait ExecutionPlan như join, filter, group by. Engine không phân biệt nút tự viết với nút dựng sẵn.",
    example: "InfluxDB IOx: lấp khoảng trống chuỗi thời gian, xoay schema, phân giải thứ tự chèn.",
    why: "Hệ khác thường chỉ cho hàm bảng tự định nghĩa, bị giới hạn cú pháp/vị trí và chậm hơn toán tử dựng sẵn." }
];

DF.GLOSSARY = [
  ["Apache Arrow", "Chuẩn bố cục dữ liệu cột trong RAM, dùng chung giữa nhiều công cụ để trao đổi không cần chuyển đổi.", "s2-1"],
  ["Apache Parquet", "Định dạng tệp cột, nén tốt, có min/max theo row group và page.", "s2-2"],
  ["Row group", "Khối nhiều dòng trong tệp Parquet; mỗi cột trong đó là một column chunk gồm nhiều page.", "s2-2"],
  ["Zone map", "Lưu min/max cho từng vùng dữ liệu để bỏ qua vùng không thể thoả điều kiện.", "s2-2"],
  ["Bloom filter", "Cấu trúc xác suất trả lời “chắc chắn không có” hoặc “có thể có” một giá trị.", "s2-2"],
  ["Validity bitmap", "Dãy bit đánh dấu giá trị nào là NULL trong một cột Arrow.", "s2-1"],
  ["StringView", "Kiểu chuỗi Arrow 16 byte có sẵn 4 byte đầu chuỗi, so sánh nhanh.", "s2-1"],
  ["Zero-copy", "Dùng chung vùng nhớ thay vì sao chép hay chuyển đổi định dạng.", "s2-1"],
  ["Rust ownership", "Mỗi vùng nhớ có một chủ; trình biên dịch chặn lỗi bộ nhớ và data race.", "s2-3"],
  ["C ABI", "Quy ước gọi hàm nhị phân kiểu C để ngôn ngữ khác gọi được thư viện Rust.", "s2-3"],
  ["Query engine", "Phần lập kế hoạch, tối ưu và thực thi truy vấn của một hệ dữ liệu.", "abstract"],
  ["OLAP", "Xử lý phân tích: quét nhiều dòng, gom nhóm, tổng hợp.", "abstract"],
  ["Vectorized execution", "Xử lý cả lô hàng nghìn giá trị mỗi lần gọi toán tử.", "abstract"],
  ["Deconstructed database", "CSDL lắp từ linh kiện thay thế được: định dạng, catalog, engine, ngôn ngữ.", "s4"],
  ["LLVM", "Hạ tầng trình biên dịch mô-đun; bài dùng làm phép so sánh cho DataFusion.", "s4-1"],
  ["Catalog", "Siêu dữ liệu: bảng, cột, kiểu, vị trí, thống kê.", "s5-2"],
  ["TableProvider", "API biến một nguồn dữ liệu bất kỳ thành bảng truy vấn được.", "s7"],
  ["LogicalPlan", "Kế hoạch logic: nói làm gì, chưa nói làm thế nào.", "s5-1"],
  ["ExecutionPlan", "Kế hoạch vật lý: thuật toán, số partition, thứ tự sắp.", "s5-1"],
  ["Substrait", "Chuẩn mở để gửi kế hoạch truy vấn giữa các engine.", "s5-4"],
  ["Selectivity", "Tỷ lệ dòng qua được bộ lọc.", "s5-4"],
  ["Cardinality", "Số dòng, hoặc số giá trị/nhóm khác nhau.", "s5-4"],
  ["Interval analysis", "Suy luận miền giá trị của biểu thức từ min/max để loại dữ liệu sớm.", "s5-4"],
  ["RecordBatch", "Lô dữ liệu Arrow (mặc định 8192 dòng) chảy giữa các toán tử.", "s5-5"],
  ["Stream", "Một toán tử đang chạy trên một partition, phát dần RecordBatch.", "s5-5"],
  ["Pull-based / Volcano", "Toán tử cha gọi next() trên con để kéo dữ liệu.", "s5-5"],
  ["RepartitionExec", "Toán tử exchange chia lại dữ liệu giữa các partition (round-robin hoặc theo hash).", "s5-5"],
  ["Partitioning (phân vùng)", "Số Stream song song của một ExecutionPlan; mỗi partition là một phần dữ liệu chạy trên một luồng.", "s5-5"],
  ["Pipeline breaker", "Toán tử phải đọc hết đầu vào mới xuất được (sort, build hash).", "s5-5"],
  ["Spill", "Tràn dữ liệu trung gian ra đĩa khi thiếu RAM.", "s5-5"],
  ["Tokio", "Runtime async của Rust, bộ lập lịch work-stealing.", "s5-5"],
  ["Work-stealing", "Luồng rảnh lấy việc từ hàng đợi của luồng bận.", "s5-5"],
  ["NUMA", "Máy nhiều socket, RAM gần nhanh hơn RAM xa.", "s5-5"],
  ["Morsel-driven", "Song song hoá bằng các mẩu dữ liệu nhỏ, nhận biết NUMA (HyPer, DuckDB).", "s5-5"],
  ["MemoryPool", "Bộ quản lý hạn mức bộ nhớ; GreedyPool và FairPool dựng sẵn.", "s5-5"],
  ["Projection pushdown", "Chỉ đọc những cột truy vấn cần.", "s6-1"],
  ["Filter pushdown", "Đẩy điều kiện lọc xuống nguồn dữ liệu.", "s6-1"],
  ["Common subexpression elimination", "Tính một lần biểu thức xuất hiện nhiều lần.", "s6-1"],
  ["Tree of losers", "Cây trộn k dãy đã sắp, mỗi bước log₂k phép so sánh.", "s6-2"],
  ["Top K", "ORDER BY … LIMIT k chỉ cần giữ k phần tử.", "s6-2"],
  ["Two-phase aggregation", "Gom cục bộ từng partition, chia lại theo hash, gom cuối.", "s6-2"],
  ["Semi / Anti join", "Giữ dòng có khớp (EXISTS) / không khớp (NOT EXISTS).", "s6-2"],
  ["Sideways information passing", "Dùng thông tin một bên join để lọc bên kia ngay khi đọc.", "s6-2"],
  ["RowFormat", "Mã hoá nhiều cột thành chuỗi byte so sánh được bằng memcmp.", "s6-6"],
  ["Normalized key", "Khoá đã biến đổi để thứ tự byte trùng thứ tự giá trị.", "s6-6"],
  ["Big-endian", "Byte cao đứng trước; cần thiết để memcmp so số cho đúng.", "s6-6"],
  ["Late materialization", "Chỉ giải mã cột khác cho những dòng đã qua bộ lọc.", "s6-8"],
  ["RowSelection", "Danh sách khoảng dòng cần giữ, chuyển giữa các bước đọc cột.", "s6-8"],
  ["Page Index", "Min/max và vị trí từng page trong tệp Parquet.", "s6-8"],
  ["UDF / UDAF / UDWF", "Hàm scalar / aggregate / window do người dùng viết.", "s7"],
  ["OptimizerRule", "Luật viết lại LogicalPlan; PhysicalOptimizerRule cho ExecutionPlan.", "s7"],
  ["Object store", "Lưu trữ kiểu S3: rẻ, lớn, nhưng mỗi request chậm; LIST rất đắt.", "s7"],
  ["ClickBench", "Benchmark phân tích web của ClickHouse: một bảng lớn, lọc + tổng hợp.", "s8"],
  ["TPC-H", "Benchmark kho dữ liệu kinh điển: 22 truy vấn join nhiều bảng.", "s8"],
  ["H2O-G", "Nhóm truy vấn groupby của db-benchmark do H2O.ai duy trì.", "s8"],
  ["Scale up", "Tăng hiệu năng bằng thêm lõi trên một máy.", "s8-2"],
  ["Coordination overhead", "Chi phí chia việc, đồng bộ, gộp kết quả giữa các luồng.", "s8-2"]
];

DF.QUIZ = [
  { q: "Đóng góp chính của bài báo là gì?",
    opts: ["Một thuật toán join mới nhanh hơn DuckDB", "Một engine mở, mô-đun, gom các kỹ thuật đã biết và chứng minh nó nhanh ngang engine tích hợp chặt", "Một định dạng tệp thay thế Parquet", "Một ngôn ngữ truy vấn mới thay SQL"],
    a: 1, why: "Mục 6 nói rõ các kỹ thuật không mới; đóng góp là kiến trúc mở + bằng chứng hiệu năng (mục 1, 8)." },
  { q: "LogicalPlan khác ExecutionPlan ở điểm nào?",
    opts: ["LogicalPlan chạy trên GPU", "LogicalPlan nói làm gì; ExecutionPlan nói làm thế nào (thuật toán, partition, thứ tự)", "ExecutionPlan chỉ dùng cho SQL", "Không khác gì"],
    a: 1, why: "Mục 5.1 bước 2–5: LogicalPlan được hạ xuống ExecutionPlan kèm thứ tự sắp và lựa chọn thuật toán." },
  { q: "DataFusion song song hoá bằng cách nào?",
    opts: ["Morsel-driven như DuckDB", "Mỗi ExecutionPlan có nhiều Stream (partition) chạy trên Tokio, nối bằng RepartitionExec kiểu Volcano", "Chạy mỗi truy vấn trên một máy khác nhau", "Không hỗ trợ song song"],
    a: 1, why: "Mục 5.5, 5.5.2, 5.5.3 và Hình 4." },
  { q: "Trong ví dụ A > 35 AND B = \"F\", row group nào bị bỏ ở bước 1?",
    opts: ["Row group có A_min > 35", "Row group có A_max ≤ 35, hoặc B_max < \"F\", hoặc B_min > \"F\"", "Row group có nhiều NULL nhất", "Không row group nào bị bỏ ở bước 1"],
    a: 1, why: "Mục 6.8 bước 1: khoảng [min, max] không thể chứa giá trị thoả điều kiện thì bỏ cả row group." },
  { q: "Vì sao RowFormat mã hoá số nguyên theo big-endian?",
    opts: ["Để tệp nhỏ hơn", "Để so sánh hai dòng bằng memcmp từng byte cho ra đúng thứ tự số", "Vì CPU Intel là big-endian", "Để tương thích Java"],
    a: 1, why: "Mục 6.6: normalized key cho phép so sánh byte-wise bằng memcmp." },
  { q: "Bài giải thích chỗ DataFusion chậm hơn nhiều ở TPC-H (Q11, Q17, Q18, Q21) là do đâu?",
    opts: ["Rust chậm hơn C++", "Thứ tự join chưa tối ưu; ép tay thứ tự tốt hơn thì hai bên tương đương", "Parquet chậm hơn định dạng của DuckDB", "Thiếu RAM"],
    a: 1, why: "Mục 8.1, đoạn TPC-H." },
  { q: "Vì sao một số truy vấn ClickBench chậm đi khi tăng từ 64 lên 192 lõi?",
    opts: ["Máy bị quá nhiệt", "Mỗi lõi làm quá ít việc nên chi phí phối hợp giữa các lõi lấn át", "Do lỗi đo", "Do DuckDB chiếm tài nguyên"],
    a: 1, why: "Mục 8.2, đoạn về Q11, Q14, Q32." },
  { q: "Theo bài, DataFusion khác DuckDB về đối tượng người dùng thế nào?",
    opts: ["DuckDB cho người xây hệ thống, DataFusion cho người chạy SQL", "DuckDB nhắm người chạy SQL; DataFusion nhắm người xây hệ thống mới", "Cả hai giống hệt nhau", "DataFusion chỉ dành cho Spark"],
    a: 1, why: "Mục 9, đoạn so sánh với DuckDB." },
  { q: "Điều gì khiến phần mở rộng của DataFusion nhanh như phần dựng sẵn?",
    opts: ["Phần mở rộng được biên dịch thành GPU kernel", "Phần dựng sẵn dùng chính API mở rộng và mọi thứ trao đổi bằng Arrow", "Phần mở rộng chạy trên server riêng", "Bài không giải thích"],
    a: 1, why: "Mục 5.2.2, 5.4.3, 7 (ColumnarValue), 7.7 — điệp khúc “cùng API”." }
];

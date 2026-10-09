# Tự thực hành DataFusion bằng Jupyter Notebook

Tài liệu phục vụ học tập và nghiên cứu bài báo *Apache Arrow DataFusion: A Fast, Embeddable, Modular Analytic Query Engine* ([DOI](https://doi.org/10.1145/3626246.3653368)). Mục tiêu là hiểu cơ chế và tự viết phần thực nghiệm; không nhận ý tưởng hoặc kết quả của tác giả là đóng góp mới.

**Không có chương trình làm sẵn.** Tệp `DataFusion_TuThucHanh.ipynb` chỉ chứa hướng dẫn, câu hỏi và ô mã trống. Tự viết từng bước, chạy, kiểm tra rồi ghi lại cách hiểu. `requirements.txt` chỉ là danh sách thư viện; không phải lời giải.

## 1. Bài báo có mã thực nghiệm không?

**Có, nhưng cần phân biệt ba loại nội dung:**

| Nội dung | Nguồn | Bản chất |
| --- | --- | --- |
| Đoạn Rust ở Hình 3 | Mục 5.5.1, trang in 9, tức trang PDF 5 | Minh họa cách xử lý luồng; không phải chương trình Python hoàn chỉnh |
| Mã đo hiệu năng ClickBench, TPC-H, H2O | Mục 8, trang in 12–13, tức trang PDF 8–9; chú thích 3 | Thí nghiệm thật, tác giả dẫn đến kho mã công khai |
| D1–D8 trong hướng dẫn này | Lộ trình học xây dựng từ các mục của bài báo | Bài thực hành bổ trợ, không phải tám bài mẫu do tác giả cung cấp |

[Kho mã thí nghiệm của tác giả](https://github.com/JayjeetAtGithub/datafusion-duckdb-benchmark) ghi DataFusion 32.0.0 và DuckDB 0.9.1. Bài báo dùng TPC-H SF 10, tám tệp Parquet, tổng dung lượng khoảng 2,5 GB. Dữ liệu nhỏ trên máy cá nhân và thư viện mới hơn không tái lập toàn bộ thí nghiệm đó.

**Phần tự viết sẽ chạy thật hay giả lập?**

- Khi dùng thư viện DataFusion để đăng ký Parquet và thực thi truy vấn, chính DataFusion lập kế hoạch, tối ưu và xử lý dữ liệu. Đó là thực nghiệm thật.
- Dữ liệu tự sinh là dữ liệu kiểm thử; không có nghĩa bộ máy truy vấn bị giả lập.
- Các hoạt ảnh trên trang HTML của dự án là mô phỏng giải thích cơ chế, không trực tiếp thực thi DataFusion.
- Không tự dựng số giây, chỉ số bộ nhớ hoặc kết quả truy vấn để làm giống bài báo. Các số đo phải lấy từ lần chạy thực tế.

## 2. Môi trường trên máy hiện tại

Máy đã kiểm tra: **macOS 27.0.1, Apple Silicon (`arm64`), 16 GiB RAM, 12 lõi, Homebrew Python 3.13.15**. Python nằm tại `/opt/homebrew/bin/python3.13`.

Bộ thư viện thực hành được ghim: DataFusion 50.1.0, DuckDB 1.4.5, PyArrow 21.0.0 và NumPy 2.3.3. JupyterLab 4.6.4 cung cấp giao diện notebook; ipykernel 7.4.0 chạy mã Python trong môi trường riêng.

JupyterLab được thêm vì cần viết và chạy từng ô, quan sát kết quả ngay bên dưới. Nó không thay DataFusion thực thi SQL. Không cần pandas hoặc matplotlib ở các bước đầu; không cài thêm thư viện chỉ để tạo một hình trang trí.

### 2.1 Cài đặt lần đầu

Từ thư mục gốc của dự án, chạy các lệnh thiết lập sau. Đây chỉ là lệnh cài môi trường, không phải mã giải bài:

```bash
cd 04-demo
/opt/homebrew/bin/python3.13 --version
/opt/homebrew/bin/python3.13 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m ipykernel install --prefix .venv --name datafusion-py313 --display-name "DataFusion · Python 3.13.15"
.venv/bin/python -m pip check
```

Nếu `.venv` đã được tạo đúng bằng Python 3.13.15 thì không cần tạo lại; chỉ cài các thư viện còn thiếu. Không dùng `sudo pip`, không dùng `--break-system-packages`, không thay đổi Python hệ thống.

### 2.2 Mở notebook

Trong thư mục `04-demo`, chạy:

```bash
.venv/bin/python -m jupyterlab DataFusion_TuThucHanh.ipynb --ip=127.0.0.1
```

Trình duyệt sẽ mở giao diện JupyterLab. Nếu không tự mở, dùng liên kết cục bộ được Terminal in ra; liên kết có mã truy cập thì không chia sẻ công khai.

Chọn bộ thực thi **DataFusion · Python 3.13.15**. Chỉ viết vào các ô mã trống. Không cần chạy trang HTML để notebook hoạt động.

- **JupyterLab:** giao diện viết, mở và quản lý notebook.
- **Notebook:** tệp `.ipynb` chứa ô văn bản và ô mã.
- **Bộ thực thi:** tiến trình Python chạy các ô mã. Bộ thực thi phải dùng Python trong `.venv` của dự án.

### 2.3 Thao tác cơ bản

1. Ô văn bản chứa mục tiêu, gợi ý và điều kiện hoàn thành; đọc trước khi viết.
2. Nhập mã vào ô trống bên dưới.
3. Nhấn **Shift + Enter** để chạy ô và chuyển tiếp.
4. Đọc kết quả hoặc thông báo lỗi ngay dưới ô đó.
5. Chỉ tiếp tục khi kiểm tra đã đúng; không cần viết hết tám phần trong một lần.
6. Cuối buổi, lưu notebook. Khi đã hoàn thành một phần, khởi động lại bộ thực thi và chạy lại từ đầu để kiểm tra thứ tự phụ thuộc.

Biến được lưu trong bộ thực thi giữa các ô. Nếu chạy ô tạo bảng sau ô truy vấn hoặc khởi động lại bộ thực thi, biến cũ có thể không còn. Đây là điểm cần hiểu, không phải lỗi DataFusion.

**Bảo mật:** chỉ mở Jupyter trên máy cục bộ. Không mở cổng ra Internet, không tắt mã truy cập, không đưa đường dẫn cá nhân hoặc thông tin đăng nhập vào notebook. Trước khi đưa lên Git, kiểm tra và xóa đầu ra không cần thiết.

### 2.4 Cấu trúc thư mục

```text
04-demo/
├── README.md                      hướng dẫn này
├── requirements.txt               thư viện và phiên bản
├── DataFusion_TuThucHanh.ipynb     hướng dẫn + các ô mã trống
├── .venv/                         môi trường riêng, bỏ qua trong Git
├── data/                          dữ liệu do người học tự tạo, bỏ qua trong Git
└── results/                       kết quả do người học tự ghi, bỏ qua trong Git
```

Các thư mục dữ liệu và kết quả chỉ cần tạo khi đến bước tương ứng. Không có tệp `demo.py`, không có hàm lời giải sẵn và notebook không có đầu ra chạy sẵn.

## 3. Lộ trình tự viết

Bắt đầu với **20.000 dòng**, 2.000 dòng mỗi nhóm Parquet. Khi các phép kiểm tra đã đúng, mới tăng lên **2 triệu dòng**, 200.000 dòng mỗi nhóm. Quy mô nhỏ giúp sửa lỗi nhanh; D6 có thể cần bảng lớn hơn để phát sinh ghi tạm ra đĩa.

Bảng dùng chung gồm:

- `a`: số nguyên từ 0 đến N−1.
- `b`: chữ A đến G, chia miền `a` thành bảy khoảng liên tiếp gần bằng nhau.
- `c`: hai lần `a`.

Tạo hai bản có cùng các bộ giá trị: một bản giữ nguyên thứ tự, một bản xáo trộn **toàn bộ dòng**, không xáo từng cột độc lập. Đặt hạt giống cố định để có thể tạo lại dữ liệu.

| Phần | Nội dung cần tự làm | Nội dung bài báo |
| --- | --- | --- |
| Chuẩn bị | Kiểm tra Python; tạo dữ liệu; đọc min/max của nhóm dòng | Kiến thức nền cho các thí nghiệm |
| D1 | Cùng yêu cầu bằng SQL và DataFrame; so kế hoạch và kết quả | 5.3.3 |
| D2 | Đọc kế hoạch ban đầu, sau tối ưu và kế hoạch vật lý | 5.1, 6.1–6.3 |
| D3 | Đếm lô dữ liệu; so kế hoạch với một và bốn phân vùng | 5.5.1–5.5.2 |
| D4 | So bản đã sắp/xáo trộn, kết hợp tắt/bật bộ lọc Parquet | 6.8 |
| D5 | Khai báo thứ tự đúng; kiểm tra loại bỏ sắp xếp thừa | 6.1, 6.7 |
| D6 | So cho phép/tắt ghi tạm ra đĩa khi hạn chế bộ nhớ | 5.5.4, 6.2, 7.4 |
| D7 | Tự viết hàm nhận mảng Arrow; đối chiếu kết quả và số lần gọi | 7.1 |
| D8 | TPC-H nhỏ; kiểm tra đúng trước khi so thời gian với DuckDB | 8 |

Mỗi phần trong notebook có ô mã trống ngay sau yêu cầu. Không có câu SQL hoàn chỉnh để sao chép; tên API chỉ là gợi ý tra cứu.

### 3.1 Phần nên học trước

**Kiểm tra môi trường → Tạo dữ liệu → D1 → D2 → D4.**

Chưa cần viết phần đo thời gian, vẽ biểu đồ hoặc chạy đủ 22 câu TPC-H. Trước hết phải hiểu bảng, điều kiện lọc và bằng chứng trong kế hoạch.

### 3.2 Phần làm sau

- D3 giúp hiểu lô và mức song song.
- D5, D6 làm rõ thứ tự dữ liệu và quản lý bộ nhớ.
- D7 làm rõ khả năng mở rộng; hàm Python không chứng minh hiệu năng bằng hàm Rust.
- D8 nên làm sau khi đã biết đối chiếu toàn bộ kết quả. Bắt đầu bằng một truy vấn như Q6 và SF 0,01; tăng SF khi có lý do.

## 4. Những nguyên tắc phải hiểu khi trình bày

### 4.1 Kế hoạch và thực thi

Kế hoạch logic diễn đạt các phép toán cần thực hiện. Kế hoạch vật lý chọn cách thực hiện, thuật toán và cách phân phối công việc. Đọc tên toán tử chưa đủ; cần liên hệ từng toán tử với yêu cầu truy vấn.

Trong DataFusion 50.1.0, nguồn Parquet thường hiện bằng `DataSourceExec`. Tên có thể khác bản 32 trong bài báo; không sửa kế hoạch thật để giống hình của tác giả.

Khi xử lý `EXPLAIN`, lấy các lô kết quả bằng `collect` thay vì `show`: ở phiên bản này, việc thêm thao tác hiển thị có thể gây lỗi “Explain must be root of the plan”.

### 4.2 Bỏ nhóm dòng khác với lọc từng dòng

Min/max có thể chứng minh cả nhóm không có dòng phù hợp, từ đó bỏ cả nhóm. Nếu chưa bỏ được nhóm, bộ đọc vẫn có thể lọc từng dòng. Vì vậy, tệp xáo trộn có thể không bỏ được nhóm nào nhưng vẫn loại nhiều dòng.

Bật bộ lọc không bảo đảm nhanh hơn trong mọi trường hợp. Phải ghi số đo và giải thích bằng thống kê, không tự chọn kết quả theo kỳ vọng.

### 4.3 Lô và phân vùng

8.192 dòng là kích thước lô mặc định được bài báo nêu, không phải mọi lô đều đủ số dòng đó. Phân vùng là cách chia công việc; không bảo đảm một phân vùng luôn chiếm một lõi riêng hoặc tăng phân vùng thì tốc độ tăng cùng tỷ lệ.

### 4.4 Bộ nhớ và thứ tự

Chỉ khai báo thứ tự sắp xếp khi dữ liệu thực sự có thứ tự đó; khai báo sai có thể gây sai kết quả.

Hạn mức vùng nhớ quản lý của DataFusion không phải tổng RAM của Python. Thí nghiệm D6 không cần làm máy cạn bộ nhớ. Nếu dữ liệu vẫn vừa hạn mức thì chưa xuất hiện ghi tạm ra đĩa là bình thường.

### 4.5 Đúng trước, nhanh sau

Hai kết quả cùng số dòng chưa chắc cùng giá trị. Phải kiểm tra số cột, giá trị và số lần lặp; nêu quy tắc so số thực và cách xử lý thứ tự dòng.

Sau khi đúng, mới quy định khoảng đo, số lượt khởi động, số lượt lấy trung vị và cấu hình hai bộ máy. Không đặt trước bộ máy nào phải thắng. Dữ liệu nhỏ và phiên bản mới không đủ để khẳng định lại mọi kết luận của bài báo.

## 5. Ghi nhận kết quả của chính người học

Sau mỗi phần, tự ghi vào ô văn bản:

1. Yêu cầu và ý trong bài báo được minh họa.
2. Dữ liệu, phiên bản và cấu hình đã dùng.
3. Kết quả hoặc dòng kế hoạch làm bằng chứng.
4. Giải thích vì sao có kết quả đó.
5. Giới hạn: nội dung nào chưa được thí nghiệm chứng minh.

Chưa chạy thì chưa ghi số đo. Không chép kết quả thử của người soạn hoặc số liệu bài báo thành kết quả tự làm.

## 6. Nguồn tra cứu

- [Bài báo gốc](https://doi.org/10.1145/3626246.3653368): ý tưởng và thí nghiệm nguyên bản.
- [Mã thí nghiệm do tác giả công bố](https://github.com/JayjeetAtGithub/datafusion-duckdb-benchmark): chú thích 3 tại mục 8.
- [DataFusion Python](https://datafusion.apache.org/python/): API; tài liệu hiện hành có thể mô tả phiên bản mới hơn 50.1.0.
- [TPC-H trong DuckDB](https://duckdb.org/docs/stable/extensions/tpch): sinh dữ liệu và lấy truy vấn.
- [Làm việc với notebook trong JupyterLab](https://jupyterlab.readthedocs.io/en/stable/user/notebook.html).
- [Homebrew và Python](https://docs.brew.sh/Homebrew-and-Python).

Các số trang ở mục 1 đã phân biệt **trang in** và **trang trong tệp PDF**. Khi viết báo cáo, dùng nhất quán số trang in của bài báo, không lấy số thứ tự D1–D8 làm số mục của tác giả.

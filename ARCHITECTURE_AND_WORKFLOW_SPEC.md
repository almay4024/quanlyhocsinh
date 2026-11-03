# GITHUB SPEC KIT: ĐẶC TẢ KIẾN TRÚC & NGHIỆP VỤ TOÀN DIỆN (MASTER SPECIFICATION)

**Tên hệ thống:** Hệ thống Quản lý Lớp học & Học sinh Trung tâm Học thêm (v5.0 Spec)  
**Nền tảng:** Web Application (Vanilla ES Modules + HTML5 + CSS3) chạy trên **Google Firebase Hosting** & **Firebase Realtime Database**  
**Mục đích tài liệu:** Đây là tài liệu **Single Source of Truth (Đặc tả Gốc Bất biến)** dùng để chỉ đạo AI Agent (Google Antigravity) nâng cấp, sửa lỗi và tái cấu trúc mã nguồn. Mọi chỉnh sửa code bắt buộc phải tuân thủ tuyệt đối tài liệu này để không làm hỏng các tính năng đang chạy hoặc làm sai lệch quy trình thực tế của trung tâm.

---

## MỤC LỤC
1. [Chỉ dẫn Thực thi Bắt buộc cho AI Agent (Antigravity Guardrails)](#1-chỉ-dẫn-thực-thi-bắt-buộc-cho-ai-agent-antigravity-guardrails)
2. [Ma trận Phân quyền & Bảo mật Danh sách Học sinh (Strict RBAC & Privacy)](#2-ma-trận-phân-quyền--bảo-mật-danh-sách-học-sinh-strict-rbac--privacy)
3. [Kiến trúc Phản hồi Tức thì 0ms trên Sơ đồ lớp (Zero-Latency Optimistic UI)](#3-kiến-trúc-phản-hồi-tức-thì-0ms-trên-sơ-đồ-lớp-zero-latency-optimistic-ui)
4. [Đặc tả Nghiệp vụ Sơ đồ lớp, Thu BTVN & Điểm danh (`#seating-view`)](#4-đặc-tả-nghiệp-vụ-sơ-đồ-lớp-thu-btvn--điểm-danh-seating-view)
5. [Đặc tả Chế độ "Chép Sổ Giấy", Bộ lọc Excel & Quản lý Cột (`#students-view` & `#scores-view`)](#5-đặc-tả-chế-độ-chép-sổ-giấy-bộ-lọc-excel--quản-lý-cột-students-view--scores-view)
6. [Đặc tả Đồng bộ Google Sheets Đa Khóa (2K9, 2K10, 2K11...), Duyệt Bán Tự Động & Khớp Hồ Sơ](#6-đặc-tả-đồng-bộ-google-sheets-đa-khóa-2k9-2k10-2k11-duyệt-bán-tự-động--khớp-hồ-sơ)
7. [Kiến trúc Firebase Realtime Database Bảo mật cao, Mã hóa & Tiết kiệm Băng thông](#7-kiến-trúc-firebase-realtime-database-bảo-mật-cao-mã-hóa--tiết-kiệm-băng-thông)
8. [Đặc tả Tab Báo cáo Buổi học Trực quan (`#report-view`) & Xuất Đa Định Dạng](#8-đặc-tả-tab-báo-cáo-buổi-học-trực-quan-report-view--xuất-đa-định-dạng)
9. [Kế hoạch Triển khai Từng bước (Actionable Tasks theo từng File cho Antigravity)](#9-kế-hoạch-triển-khai-từng-bước-actionable-tasks-theo-từng-file-cho-antigravity)

---

## 1. CHỈ DẪN THỰC THI BẮT BUỘC CHO AI AGENT (ANTIGRAVITY GUARDRAILS)

Khi đọc và sửa mã nguồn của dự án này (`index.html`, `src/app.js`, `src/features.js`, `src/excel-import-export.js`, `src/student-search.js`, `src/styles.css`, `src/data/*`, `database.rules.json`), AI Agent phải tuân thủ 5 nguyên tắc cốt lõi:

1. **Không làm mất tính năng hiện có (Zero Regression):** Giữ nguyên toàn bộ dữ liệu đang lưu của người dùng và các module đã hoạt động ổn định (Quản lý phòng học & vạch ngăn cách bàn, Lớp bổ trợ & gia sư 1-1, Chấm công TA, Nhật ký Admin Log, Kế thừa chỗ ngồi buổi trước, Hoàn tác Ctrl+Z, Góc nhìn Giáo viên).
2. **Ưu tiên tốc độ phản hồi trên máy người dùng ($< 16\text{ ms}$):** Mọi thao tác chạm trên điện thoại/iPad/máy tính phải cập nhật giao diện ngay lập tức trên máy đang bấm (Optimistic UI), đẩy toàn bộ việc mã hóa, tính toán lịch sử và đồng bộ mạng xuống chạy ngầm (Async Background Queue).
3. **Tương thích mọi thiết bị (iPhone 6 / Android đời cũ / iPad / Laptop):**
   * Giữ polyfill cho trình duyệt cũ (`Array.prototype.at`, `Object.hasOwn`, `structuredClone`, `HTMLDialogElement.showModal`).
   * Mọi ô `input`, `select`, `textarea` bắt buộc có `font-size: 16px !important` để iOS Safari không tự động phóng to (auto-zoom) làm lệch màn hình khi gõ tìm kiếm.
   * Không sử dụng hiệu ứng CSS nặng (`backdrop-filter: blur`) khi đang kéo-thả hoặc trên thiết bị di động màn hình nhỏ.
4. **Bảo mật dữ liệu theo đúng vai trò (Strict Role Isolation):** Trợ giảng (`assistant`) tuyệt đối không được xem, tìm kiếm hoặc nhận gợi ý tự động từ danh sách học sinh của các lớp mà mình không phụ trách.
5. **Tiết kiệm băng thông Firebase tối đa:** Tuyệt đối không tải đi tải lại toàn bộ cơ sở dữ liệu trong các chu kỳ polling ngắn; chỉ tải và đẩy đúng nhánh dữ liệu (Delta Shard) vừa có thay đổi.

---

## 2. MA TRẬN PHÂN QUYỀN & BẢO MẬT DANH SÁCH HỌC SINH (STRICT RBAC & PRIVACY)

Hệ thống có 4 vai trò tài khoản: **Trợ giảng (`assistant`)**, **Giáo viên (`teacher`)**, **Văn phòng (`office`)**, và **Quản trị viên (`admin`)**.

### 2.1. Bảng Phân Quyền Chi Tiết

| Tính năng / Phạm vi dữ liệu | Trợ giảng (`assistant`) | Giáo viên (`teacher`) | Văn phòng (`office`) | Admin (`admin`) |
| :--- | :---: | :---: | :---: | :---: |
| Xem & Vào ca các lớp được phân công (`assignedClasses`) | ✅ Có | ✅ Có | ✅ Xem toàn bộ lớp | ✅ Toàn quyền |
| Xem danh sách học sinh của **lớp khác** (không phụ trách) | ❌ **CẤM TUYỆT ĐỐI** | ❌ **CẤM TUYỆT ĐỐI** | ✅ Có | ✅ Có |
| Gợi ý tên học sinh từ lớp khác khi nhập **Học bù / Học mới** | ❌ **CẤM (Chỉ nhập tay)** | ❌ **CẤM (Chỉ nhập tay)** | ✅ Có | ✅ Có |
| Khớp (Merge) HS mới / Học bù do TA nhập vào Hồ sơ gốc & Mã HS | ❌ Không hiển thị | ❌ Không hiển thị | ✅ **Thực hiện chính** | ✅ Toàn quyền |
| Đồng bộ Google Sheets đa khóa (2K9, 2K10, 2K11...) & Duyệt chuyển lớp | ❌ Không hiển thị | ❌ Không hiển thị | ✅ **Thực hiện chính** | ✅ Toàn quyền |
| Nút `📋 Copy PH` (Copy nhanh báo cáo gửi Phụ huynh từng dòng) | ❌ Ẩn | ❌ Ẩn | ✅ Hiển thị cột riêng | ✅ Hiển thị |
| Quản lý Nhân sự & Cấp/Đổi mật khẩu (`#mgmt-panel-staff`) | ❌ Ẩn hoàn toàn | ❌ Ẩn hoàn toàn | ❌ Ẩn hoàn toàn | ✅ **Chỉ Admin** |
| Nhật ký Admin Log (`#mgmt-panel-admin-log` & `#session-admin-log-dialog`) | ❌ Ẩn hoàn toàn | ❌ Ẩn hoàn toàn | ❌ Ẩn hoàn toàn | ✅ **Chỉ Admin** |

### 2.2. Quy tắc Bảo mật Nghiêm ngặt khi Trợ giảng nhập Học sinh Mới / Học bù

* **Vấn đề trong code cũ cần xóa bỏ:** Trong `src/app.js` và `index.html` hiện đang có nút `#add-makeup-from-other-class-btn` ("+ Học bù từ lớp khác") và khối tìm kiếm `#identity-cross-makeup-search` / `#late-cross-makeup-search` cho phép tìm học sinh trong toàn bộ mảng `students` của các lớp khác. Nếu để tính năng này cho tài khoản Trợ giảng, trợ giảng sẽ gõ chữ cái và nhìn thấy toàn bộ học sinh của các lớp không do mình phụ trách.
* **Quy định bắt buộc trong Spec mới:**
  1. Đối với tài khoản `assistant` và `teacher`:
     * Ô tìm kiếm trong `#seat-dialog` (`#student-search`) và `#late-dialog` (`#late-search`) **CHỈ** tìm trong danh sách học sinh chính thức của đúng lớp đang mở (`classStudents()`) và các học sinh học bù đã được thêm vào đúng buổi học hôm đó (`sessionMakeupStudents()`).
     * Khi bấm nút **`+ Học sinh mới / Học bù`** (`#new-or-makeup-choice` hoặc `#late-new-or-makeup`), hệ thống **CHỈ hiển thị Form nhập liệu bằng tay** gồm:
       * Chọn phân loại: `[Học sinh mới]` hoặc `[Học bù]`
       * Ô nhập tay `Họ và tên` (bắt buộc)
       * Ô nhập tay `Trường học` (nếu là Học sinh mới) hoặc `Học bù từ lớp nào / Ghi chú` (nếu là Học bù)
       * Ô nhập tay `SĐT / Tên phụ huynh` (không bắt buộc)
     * **Tuyệt đối KHÔNG** hiển thị danh sách gợi ý học sinh từ các lớp khác cho Trợ giảng/Giáo viên.
  2. Bản ghi do Trợ giảng tạo trên lớp sẽ mang cờ tạm (`isTempEntry: true`, chưa có `studentCode` chuẩn hoặc là bản ghi `makeup` tạm trong buổi).
  3. Sau đó, tài khoản **Văn phòng (`office`)** hoặc **Admin (`admin`)** sẽ dùng công cụ **`🔗 Khớp dữ liệu HS mới / Học bù với DS tổng`** để ghép bản ghi tạm này vào đúng **Mã học sinh (`studentCode`)** và **Hồ sơ gốc** trên hệ thống / Google Sheets.

---

## 3. KIẾN TRÚC PHẢN HỒI TỨC THÌ 0ms TRÊN SƠ ĐỒ LỚP (ZERO-LATENCY OPTIMISTIC UI)

### 3.1. Nguyên nhân gây trễ 1–2 giây hiện tại trên máy đang thao tác
Trong `src/app.js`, mỗi lần bấm nút `+` thêm ghế, chọn học sinh hoặc bấm lưu BTVN, hàm `save()` và `render()` đang chạy tuần tự và đồng bộ (blocking) trên luồng chính:
1. Chạy `reconcileSessionAttendanceWithSeating()` quét toàn bộ học sinh.
2. Chạy `syncLiveSessionData()` đóng gói toàn bộ snapshot lịch sử ca học và ghi vào `lopvui.session-history.v2`.
3. Gọi `saveStudentRecords()` ghi toàn bộ mảng `lopvui.students.v9` vào `localStorage` (kích hoạt `_mergeGranularJsonValue` parse/stringify lại chuỗi JSON hàng trăm KB).
4. Chạy `render()` ghi đè lại toàn bộ `classroom.innerHTML`, rồi gọi tiếp `renderStudentList()`, `renderChecklist()`, `renderScoresView()` ngay cả khi các tab đó đang ẩn (`hidden`).

### 3.2. Kiến trúc 3 Tầng Cắt Đứt Độ Trễ (Bắt buộc áp dụng trong `src/app.js`)

#### Tầng 1: Cập nhật DOM Cục bộ Tức thì (Surgical DOM Update $< 16\text{ ms}$)
* **Khi bấm nút `+` trên bàn (`addAnonymousToDesk(deskId, index)`):**
  1. Cập nhật mảng `deskItems[deskId]` trong RAM.
  2. Tìm đúng phần tử `.desk[data-desk-id="${deskId}"] .desk-seats` trên DOM, xóa nhãn `.seat-empty-text` (nếu có) và chèn trực tiếp nút `<button class="seat occupied seat-token seat-anonymous">` mới bằng `appendChild` (kèm tính lại độ rộng dãy `--aisle-width` của đúng dãy đó).
  3. Cập nhật nhanh số đếm trên banner (`updateSeatingBannerCountersOnly()`).
  4. **Xong phần hiển thị trong $< 5\text{ ms}$!** Việc lưu trữ gọi qua `scheduleDeferredSave()`.
* **Khi chọn tên học sinh / Lưu BTVN trong `#seat-dialog` (`assignStudent` / `#save-homework`):**
  1. Cập nhật object `entry` và `person` trong RAM.
  2. Nếu bấm `#save-homework`, gọi `closeDialogSafely('#seat-dialog')` **ngay lập tức** để hộp thoại đóng lại mượt mà không chờ đợi.
  3. Chỉ render lại đúng thẻ bàn `.desk[data-desk-id="${activeSpot.deskId}"]` (hoặc đúng chiếc ghế đó) và cập nhật thanh đếm `#attendance-count`, `#homework-count`.
* **Khi bấm `Thu BTVN` cả dãy (`collectAisleHomework(aisleIndex)`):**
  1. Cập nhật trạng thái `homework.status = 'submitted'` trong RAM cho các ghế đang `uncollected` thuộc dãy đó.
  2. Chỉ cập nhật DOM của đúng cột `.desk-row` thuộc `aisleIndex` đó và thanh đếm BTVN.

#### Tầng 2: Chỉ Render Tab Đang Mở (Lazy Tab Rendering)
* Tạo một tập hợp đánh dấu các tab cần làm mới: `const dirtyViews = new Set();`.
* Khi người dùng đang ở tab **Sơ đồ lớp (`#seating-view`)**:
  * Không bao giờ gọi `renderStudentList()`, `renderScoresView()`, `renderChecklist()`, `renderReportCenter()` mỗi khi thay đổi ghế ngồi.
  * Chỉ đánh dấu `dirtyViews.add('students'); dirtyViews.add('scores'); dirtyViews.add('report');`.
* Khi người dùng bấm chuyển sang tab nào trong `setClassView(view)`, hàm mới kiểm tra và vẽ tab đó.

#### Tầng 3: Lưu trữ & Đồng bộ Chạy Ngầm (Debounced Background Persistence)
* Thay thế lệnh gọi `save()` trực tiếp gây nghẽn bằng cơ chế 2 pha:
  * **Pha Tức thì ($< 2\text{ ms}$):** Cập nhật biến trong RAM (`deskItems`, `lateQueue`, `students`) và ghi nhanh riêng key nhẹ `lopvui.desk-items.v7.${CURRENT_CLASS_ID}.${checklistDate}` vào `_memStorageMap`.
  * **Pha Chạy ngầm (`_flushDeferredSaveTimer` sau $250\text{ ms}$ bằng `requestIdleCallback` / `setTimeout`):** Thực thi `reconcileSessionAttendanceWithSeating()`, `syncLiveSessionData()`, `saveStudentRecords()` và đẩy gói tin Delta lên Firebase Cloud.
  * Đảm bảo nếu người dùng đóng tab đột ngột (`beforeunload` / `pagehide`), hàm `_flushDeferredSaveNow()` sẽ chạy ngay lập tức để không bao giờ mất dữ liệu.

---

## 4. ĐẶC TẢ NGHIỆP VỤ SƠ ĐỒ LỚP, THU BTVN & ĐIỂM DANH (`#seating-view`)

### 4.1. Loại bỏ hoàn toàn Khay kéo `#student-pool`
* **Yêu cầu giao diện:** Xóa/ẩn hoàn toàn khu vực `.student-pool-wrap` (`#student-pool` - khay *"Kéo biểu tượng học sinh mới vào bàn"*) khỏi màn hình Sơ đồ lớp để tiết kiệm diện tích chiều dọc, đặc biệt trên điện thoại.
* **Nút Kế thừa chỗ ngồi buổi trước (`#quick-carryover-seating-btn`):** Chuyển nút `↺ Xếp chỗ theo buổi trước` lên nằm gọn trên thanh công cụ `.layout-actions` (chỉ hiện khi mở ca mới chưa có học sinh ngồi).

### 4.2. Hai Chế độ Rõ ràng của Nút `Sửa sơ đồ` (`#toggle-seating-edit-btn`)

Trạng thái `isSeatingEditMode` điều khiển trực tiếp độ gọn gàng của Sơ đồ lớp:

1. **Khi `Sửa sơ đồ: BẬT` (`isSeatingEditMode = true`):**
   * **Hiển thị nút `+` (`.desk-add-compact-btn`)** ở cạnh phải của tất cả các bàn để trợ giảng bấm thêm biểu tượng học sinh vào bàn.
   * **Hiển thị nút `Thu BTVN` (`.row-collect-hw-btn`)** ở tiêu đề của từng dãy (`DÃY 1`, `DÃY 2`, `DÃY 3`...).
   * **Cho phép Kéo - Thả (Drag & Drop):** Trợ giảng có thể giữ và kéo bất kỳ biểu tượng học sinh nào (cả ghế chưa có tên lẫn học sinh đã điểm danh) sang bàn khác hoặc vị trí khác trong bàn; kéo học sinh từ khu vực `Cuối lớp` (`#late-area`) vào bàn.
   * *Tự động thông minh đầu giờ:* Khi một ca học mới vừa mở và trên sơ đồ chưa có học sinh nào (`occupants.length === 0`), hệ thống tự động đặt `isSeatingEditMode = true` để trợ giảng vào lớp bấm dấu `+` và `Thu BTVN` được ngay.

2. **Khi `Sửa sơ đồ: TẮT` (`isSeatingEditMode = false`):**
   * **Ẩn hoàn toàn nút `+` (`.desk-add-compact-btn`)** trên tất cả các bàn.
   * **Ẩn hoàn toàn nút `Thu BTVN` (`.row-collect-hw-btn`)** trên tiêu đề các dãy.
   * **Khóa Kéo - Thả các ghế trên bàn:** Tránh việc trợ giảng cầm điện thoại đi lại trong lớp vô tình chạm trượt làm bay học sinh sang bàn khác.
   * **Sơ đồ lớp cực kỳ gọn gàng:** Các thẻ học sinh mở rộng tối đa chiều ngang trong bàn. Trợ giảng chạm vào bất kỳ ghế nào vẫn mở **Menu Điểm danh & BTVN (`#seat-dialog`)** bình thường.
   * Khu vực `Cuối lớp` (`#late-area`) vẫn cho phép chạm vào học sinh đi muộn rồi chạm vào bàn để xếp chỗ (hoặc kéo vào bàn).

### 4.3. Quy trình Chuẩn Đầu Giờ của Trợ Giảng (20 phút trước giờ học)

1. **Mở ca & Checklist:**
   * Trợ giảng vào lớp trước 20 phút, mở lớp và tích các mục trong tab **Checklist** (lấy nước, lấy mic cho giáo viên, kê lại bàn ghế...). Mục đầu tiên được tích sẽ tự động ghi nhận giờ bắt đầu ca làm việc (`workStart`).
2. **Đi thu BTVN từ trên xuống từng dãy (khi `Sửa sơ đồ: BẬT`):**
   * Học sinh đến lớp ngồi tự do vào các bàn.
   * Trợ giảng đi từ đầu dãy xuống cuối dãy:
     * Bàn nào có bao nhiêu học sinh đang ngồi, trợ giảng bấm nút **`+`** ở bàn đó bấy nhiêu lần (bàn 1 có 1 người bấm `+` 1 lần, bàn 2 có 2 người bấm `+` 2 lần) $\rightarrow$ Tạo ngay các biểu tượng học sinh vô danh (`studentId: null`, trạng thái `homework.status = 'uncollected'`).
     * **Nếu gặp học sinh KHÔNG nộp BTVN:** Trợ giảng bấm ngay vào biểu tượng ở bàn đó $\rightarrow$ Mở `#seat-dialog` $\rightarrow$ Chọn tên học sinh $\rightarrow$ Bấm chọn **`Chưa nộp`** (kèm lý do: Chưa làm / Quên vở / Nghỉ buổi trước) $\rightarrow$ Lưu. Ghế đó lập tức hiện tên học sinh + dấu `×` màu đỏ (đã điểm danh có mặt + ghi nhận không nộp BTVN).
     * **Nếu học sinh CÓ nộp BTVN:** Trợ giảng chỉ cầm vở và bấm dấu `+` tạo biểu tượng trên bàn, **không dừng lại hỏi tên** để tiết kiệm thời gian.
     * Khi đi tới cuối dãy, trợ giảng bấm nút **`Thu BTVN`** của dãy đó $\rightarrow$ Toàn bộ các biểu tượng học sinh đang ở trạng thái `Chưa thu` (`uncollected`) trong dãy đó đồng loạt chuyển sang **`Đã nộp` (`✓` màu xanh lá)**! (Những bạn đã đánh dấu `Chưa nộp` `×` được giữ nguyên, tuyệt đối không bị ghi đè).
   * **Phát hiện học sinh mới vào lớp sau lượt thu:**
     * Một lúc sau trợ giảng quay lại thấy bàn 1 có 2 người ngồi (trong khi trên sơ đồ bàn 1 mới có 1 biểu tượng đã có dấu `✓`), trợ giảng bấm nút `+` thêm 1 biểu tượng thứ 2 vào bàn 1.
     * Biểu tượng thứ 2 này mang trạng thái mặc định `Chưa thu` (`·` / viền cảnh báo vàng) $\rightarrow$ Trợ giảng biết ngay học sinh này mới vào chưa nộp BTVN và đến hỏi thu bài!
3. **Điểm danh theo vị trí khi lớp đang học:**
   * Khi giáo viên bắt đầu giảng bài, trợ giảng có thể tắt `Sửa sơ đồ: TẮT` cho gọn màn hình, sau đó đi từng bàn bấm vào các biểu tượng vô danh (đã có sẵn dấu `✓` BTVN) để chọn tên học sinh tương ứng.
   * Ngay khi chọn tên học sinh, học sinh đó tự động kế thừa trạng thái `Đã nộp BTVN` (`✓`) của chiếc ghế đó và được tính `Có mặt đúng giờ`.
4. **Điểm danh muộn ở dưới lớp (`#late-dialog` & `#late-area`):**
   * Người canh ở dưới (hoặc trợ giảng) bấm nút **`Điểm danh muộn`** (`#late-button`).
   * Chọn tên học sinh (hoặc nhập tay nếu là HS mới/học bù) $\rightarrow$ Hệ thống tự động lấy `Giờ hiện tại - Giờ vào ca` để tính **Số phút đi muộn** (có thể sửa tay số phút muộn hoặc giờ đến) và chọn trạng thái BTVN.
   * Học sinh được lưu vào thanh **`CUỐI LỚP` (`#late-area`)** ở dưới sơ đồ. Khi học sinh lên lớp ngồi vào bàn nào, trợ giảng chạm vào thẻ tên ở `CUỐI LỚP` rồi chạm vào bàn đó (hoặc mở ghế trên bàn chọn tên bạn đó) $\rightarrow$ Toàn bộ số phút đi muộn, trạng thái BTVN và ghi chú tự động gắn vào bàn đó!

### 4.4. Quy tắc Ô Nhập Điểm BTVN trong Menu Điểm Danh (`#seat-dialog` & `#late-dialog`)
* Trong cả `#seat-dialog` và `#late-dialog`, phần **Trạng thái BTVN** gồm 3 nút lớn: `Chưa thu` | `Đã nộp` | `Chưa nộp`.
* **Quy tắc bắt buộc:** Ô nhập **`Ghi điểm BTVN (0 – 10)`** (`#homework-score` và `#late-homework-score`) **LUÔN HIỂN THỊ** khi trạng thái là `Đã nộp` **HOẶC** `Chưa nộp` (sửa hàm `toggleHomeworkFields` trong `src/app.js` để không ẩn `#grade-field` khi `status === 'not_submitted'`).
* *Lý do nghiệp vụ:* Học sinh đầu giờ không nộp BTVN (vẫn phải giữ trạng thái `Chưa nộp` để thống kê ý thức quên bài báo phụ huynh), nhưng trong giờ hoặc cuối giờ học sinh làm bù / gửi bù thì trợ giảng vẫn nhập điểm BTVN cho học sinh đó bình thường!

---

## 5. ĐẶC TẢ CHẾ ĐỘ "CHÉP SỔ GIẤY", BỘ LỌC EXCEL & QUẢN LÝ CỘT (`#students-view` & `#scores-view`)

### 5.1. Nút Bật/Tắt "📝 Chế độ Chép Sổ Giấy" (`Paper Roster Transcription Mode`)

Trong tab **Danh sách học sinh (`#students-view`)**, bổ sung nút công tắc nổi bật **`📝 Chế độ Chép Sổ Giấy`** trên thanh công cụ:

1. **Thứ tự học sinh giống hệt Sổ Giấy (Có thể chỉnh sửa thứ tự):**
   * Mặc định sắp xếp theo thứ tự bảng chữ cái Tên tiếng Việt (`A → Z`), nhưng mỗi học sinh trong lớp có thuộc tính `paperOrderIndex[classId]` (Số thứ tự trên sổ giấy: `1, 2, 3...`).
   * Khi bật nút **`✎ Sửa thứ tự sổ giấy`**, trợ giảng/văn phòng có thể gõ đổi số thứ tự `STT` hoặc bấm mũi tên `▲ / ▼` để khớp 100% với danh sách in trên tờ điểm danh giấy của trung tâm. Thứ tự này được lưu vĩnh viễn cho lớp đó.
   * Học sinh chính thức của lớp nằm ở bảng trên theo đúng `STT sổ giấy`; học sinh **Học bù / Học mới phát sinh** nằm tách biệt ở nhóm cuối bảng để chép vào phần cuối tờ giấy.
2. **Giao diện Bảng Gọn Gàng & Thanh Thước Kẻ Đánh Dấu Dòng Đang Chép:**
   * Ẩn các nút thao tác phụ rườm rà, hiển thị gọn gàng trên 1 dòng: `STT` | `Mã HS` | `Họ đệm` | `Tên` | `Điểm danh (✓ / Muộn Xp / VP / VKP)` | `BTVN (✓ / × Lý do)` | `Điểm BTVN` | `Điểm Test` | `Ghi chú`.
   * **Chạm vào dòng để đánh dấu đã chép (`Tap-to-Mark Ruler`):** Khi trợ giảng chạm vào một dòng học sinh trong chế độ Chép Sổ Giấy, dòng đó được tô sáng viền xanh đậm (thanh thước kẻ định vị mắt nhìn) và đánh dấu `✓ Đã ghi giấy`, giúp trợ giảng vừa nhìn màn hình điện thoại vừa chép vào giấy không bao giờ bị nhầm dòng.

### 5.2. Bộ Lọc Kiểu Excel & Đổi Vị Trí / Ẩn Hiện Cột Trực Tiếp

Áp dụng cho cả bảng **Danh sách học sinh trong ca (`#students-view`)**, **Bảng Nhập điểm (`#scores-view`)**, và **Danh bạ Học sinh toàn trung tâm (`#mgmt-panel-students`)**:

1. **Bộ lọc nhanh & Lọc trên Tiêu đề Cột (Excel-style Header Filter):**
   * Thanh Chip lọc nhanh có đếm số lượng: `Tất cả`, `✓ Có mặt`, `⏰ Đi muộn`, `× Vắng mặt`, `❗ Chưa nộp BTVN`, `🌟 Học mới & Học bù`, `⚠ Cảnh báo Mức 1-4`.
   * Trên tiêu đề mỗi cột (`<th>`), ngoài nút sắp xếp `▲/▼`, có biểu tượng phễu lọc `⏷` cho phép lọc nhanh theo giá trị của cột đó (ví dụ: lọc theo Trường, lọc theo Trạng thái điểm danh, lọc theo Trạng thái BTVN, lọc theo khoảng Điểm).
2. **Đổi vị trí cột (Drag & Drop) và Ẩn/Hiện cột như Excel (`#column-order-dialog` & Thanh tùy chỉnh nhanh):**
   * Trong hộp thoại `⚙ Tùy chỉnh cột` (và thanh cấu hình cột nhanh):
     * Mỗi cột có **Checkbox tích chọn `☑ Hiển thị / ☐ Ẩn cột`** (cho phép ẩn bất kỳ cột nào chưa cần nhìn để bảng trên điện thoại cực kỳ gọn).
     * Hỗ trợ **Kéo - Thả (Drag & Drop)** trực tiếp từng thẻ cột để đổi vị trí cột (bên cạnh nút Lên/Xuống).
     * Có sẵn 3 nút Preset 1-chạm:
       * `📝 Chuẩn Chép Sổ Giấy` (STT, Mã HS, Họ đệm, Tên, Điểm danh, BTVN, Điểm)
       * `⚡ Nhập Điểm Nhanh (Đặt Điểm sát cạnh Tên)`
       * `🔄 Khôi phục mặc định`

---

## 6. ĐẶC TẢ ĐỒNG BỘ GOOGLE SHEETS ĐA KHÓA (2K9, 2K10, 2K11...), DUYỆT BÁN TỰ ĐỘNG & KHỚP HỒ SƠ

### 6.1. Cấu trúc Quản lý Nhiều Bảng Tổng theo Khóa Học Sinh (`2K9`, `2K10`, `2K11`, `2K12`...)

Thực tế tại trung tâm: Văn phòng quản lý học sinh trên Google Sheets chia theo **nhiều bảng tổng của từng khóa học sinh (`2K9`, `2K10`, `2K11`, `2K12`, `2K13`...)**.
* Trong hộp thoại **Trung tâm Đồng bộ Google Sheets (`#google-sheets-sync-dialog`)**, thay vì chỉ lưu 1 link đơn lẻ, hệ thống hỗ trợ **Danh sách Bảng Google Sheets theo từng Khóa (`cohortSheets`)**:
  * Cho phép Văn phòng thêm và lưu nhiều cấu hình Khóa, ví dụ:
    * **Khóa 2K9 (2009):** `Link Google Sheets / Spreadsheet ID` + `Tên Tab (Sheet Name) hoặc GID` (VD: tab `2K9` hoặc file riêng của 2K9).
    * **Khóa 2K10 (2010):** `Link Google Sheets / Spreadsheet ID` + `Tên Tab hoặc GID`.
    * **Khóa 2K11 (2011):** `Link Google Sheets / Spreadsheet ID` + `Tên Tab hoặc GID`.
    * *(Tương tự cho 2K12, 2K13, 2K14...)*
  * Hỗ trợ cả 2 cách tổ chức của Văn phòng:
    1. Nhiều Tab (`2K9`, `2K10`, `2K11`...) nằm chung trong 1 file Google Sheets tổng.
    2. Nhiều file Google Sheets riêng biệt cho từng khóa.
  * Khi bấm **`🔍 Quét tất cả các Khóa (hoặc Quét Khóa đang chọn)`**, hệ thống lần lượt đọc dữ liệu từ các Sheet của từng khóa, tự động gắn năm sinh (`birthYear`: `2009`, `2010`, `2011`...) tương ứng với khóa đó.

### 6.2. Phát hiện Thay đổi Bán Tự Động & Thông báo Duyệt cho Văn phòng / Admin

Khi một học sinh (ví dụ Học sinh A) nhắn cho trung tâm xin chuyển lớp (hoặc mới đăng ký học), Văn phòng sửa cột **Mã lớp** của Học sinh A trên Google Sheets (ví dụ đổi từ `2K9.T5` sang `2K9.T3`):

1. **Tự động kiểm tra ngầm & Phát hiện thay đổi (`Auto-Check Sheet Diff`):**
   * Khi tài khoản **Văn phòng (`office`)** hoặc **Admin (`admin`)** mở phần mềm (hoặc theo chu kỳ kiểm tra nền / bấm nút Quét), hệ thống tự động đọc dữ liệu từ các bảng Google Sheets đã cấu hình và so sánh với dữ liệu hiện tại theo **`Mã HS` (`studentCode`)**.
   * Nếu phát hiện có bất kỳ thay đổi nào gồm:
     * **⇄ Học sinh đổi Mã lớp trên Sheet** (khác với lớp gốc đang lưu trên web).
     * **🆕 Học sinh mới có Mã HS trên Sheet** nhưng chưa có trên web.
     * **🆔 Học sinh do TA nhập tay trên lớp trùng Họ tên/Trường** với dòng có Mã HS trên Sheet.
2. **Thông báo Bán Tự Động cho Văn phòng / Admin:**
   * Hệ thống **KHÔNG tự ý ghi đè âm thầm**, mà lập tức đẩy một **Thông báo nổi bật** vào Quả chuông (`#notification-panel`) và hiển thị **Badge đếm số lượng chờ duyệt** trên nút `🔄 Đồng bộ Google Sheets (Có X thay đổi chờ duyệt)` dành riêng cho tài khoản Văn phòng và Admin:
     > *"🔔 Phát hiện 3 thay đổi từ Google Sheets (Khóa 2K9, 2K10): 2 học sinh đổi mã lớp, 1 học sinh mới. Bấm để kiểm tra và xác nhận duyệt!"*
3. **Văn phòng / Admin Bấm Xác nhận Duyệt (1-Click Semi-Automatic Approval):**
   * Văn phòng mở bảng chờ duyệt (`#sheets-approval-section`), kiểm tra các dòng thay đổi:
     * Với học sinh chuyển lớp (`2K9.T5 ➔ 2K9.T3`): Mặc định chọn chế độ **`⇄ Chuyển sang lớp mới & Bảo lưu 100% lịch sử lớp cũ`** (hoặc đổi sang `➕ Học song song` nếu học 2 lớp).
     * Có nút tích chọn gắn/bỏ tag **`Mới`** cho từng học sinh hoặc tất cả.
   * Khi Văn phòng bấm **`✓ Xác nhận Duyệt`**, hệ thống:
     1. Cập nhật lớp mới (`classIds = ['2K9.T3']`), đưa lớp cũ vào `previousClassIds = ['2K9.T5']`, lưu lịch sử chuyển lớp vào `classTransferHistory`.
     2. **Giữ nguyên 100% lịch sử điểm danh, số phút đi muộn, điểm BTVN, điểm Test và ghi chú ở lớp cũ** (hiển thị trong tab `Lớp cũ đã học` của hồ sơ học sinh).
     3. Gửi thông báo vào Nhật ký hoạt động của cả lớp cũ và lớp mới để Giáo viên/Trợ giảng hai lớp nắm được thông tin.

### 6.3. Văn phòng / Admin Khớp Hồ Sơ Học Sinh Mới / Học Bù do TA Nhập Tay

* Trong buổi học, khi có học sinh mới đi học buổi đầu hoặc học sinh lớp khác sang học bù, Trợ giảng đã nhập tay tên học sinh đó vào sơ đồ lớp (do Trợ giảng không được xem danh sách toàn trung tâm).
* Cuối buổi (hoặc trong buổi), Văn phòng/Admin mở lớp đó (hoặc mở Trung tâm Đồng bộ) sẽ thấy thanh công cụ **`🔗 Khớp dữ liệu HS mới / Học bù với DS tổng (X học sinh)`**:
  * Hệ thống tự động gợi ý các hồ sơ có sẵn trong Danh sách tổng của Trung tâm (hoặc vừa quét từ Google Sheets các khóa `2K9`, `2K10`, `2K11`...) có tên gần giống nhất.
  * Khi Văn phòng bấm **`🔗 Khớp & Lưu dữ liệu`**:
    * Toàn bộ dữ liệu buổi học hôm đó (Vị trí bàn ngồi, Giờ đến / Phút đi muộn, Trạng thái BTVN, Điểm BTVN, Điểm Test, Ghi chú buổi học) của bản ghi tạm do TA nhập sẽ được **gộp (merge) nguyên vẹn vào đúng Hồ sơ gốc có Mã HS chuẩn**.
    * Nếu là Học sinh mới chuyển lớp, hệ thống hỏi Văn phòng xác nhận chuyển lớp sang lớp hiện tại và xóa bản ghi tạm trùng lặp.

---

## 7. KIẾN TRÚC FIREBASE REALTIME DATABASE BẢO MẬT CAO, MÃ HÓA & TIẾT KIỆM BĂNG THÔNG

Để thỏa mãn đồng thời 3 yêu cầu: **(1) Bảo mật cao không cho phép đọc/ghi trái phép**, **(2) Mã hóa kỹ dữ liệu**, và **(3) Không liên tục tải cả database về gây ngốn dung lượng Realtime Database**, hệ thống áp dụng kiến trúc **Sharded Encrypted Delta-Sync**:

### 7.1. Nguyên lý Tách Nhánh (Sharding) để Không Bao Giờ Phải Tải Cả Database

Thay vì lưu tất cả học sinh và lịch sử vào 1–2 key khổng lồ hoặc tải cả nhánh gốc `/lopvui_cloud_v3.json`, dữ liệu trên Firebase được phân mảnh (shard) theo đơn vị nhỏ:

1. **Nhánh Chỉ mục Thời gian Siêu Nhẹ (`/lopvui_cloud_v3/meta` — Chỉ $\sim 1\text{–}2\text{ KB}$):**
   * Lưu `lastUpdatedAt`, `lastClientId` và bảng `keyTimestamps/{safeKey}: timestamp`.
   * Thiết bị lắng nghe duy nhất nhánh `/meta` qua luồng `EventSource` (SSE). Khi không có ai thao tác, băng thông tải xuống bằng **$0\text{ bytes}$**.
2. **Tách riêng Dữ liệu từng Ca học và từng Khóa/Lớp (`/lopvui_cloud_v3/kv/{safeKey}`):**
   * Mỗi ca học (`desk-items`, `late-queue`, `checklist`, `attendance-notes`) là một `safeKey` độc lập (dung lượng chỉ $\sim 1\text{–}3\text{ KB}$).
   * Khi Trợ giảng A chấm bài ở lớp `TOAN8A`, chỉ có `safeKey` của ca học `TOAN8A` ngày hôm đó thay đổi timestamp. Các máy khác khi nhận tín hiệu SSE từ `/meta` sẽ so sánh `remoteKeyTsMap[safeK] > _seenSafeKeyTimestamps[safeK]` và **CHỈ tải đúng 1 key `safeK` vừa thay đổi ($\sim 2\text{ KB}$)**, tuyệt đối không tải lại các key khác!
3. **Chống đẩy lặp các Key Lưu trữ Lớn (`students.v9`, `session-history.v2`):**
   * Khi thao tác liên tục trong ca học (bấm `+`, xếp chỗ, thu BTVN), chỉ đẩy ngay các key nhẹ của ca học hiện tại (`desk-items`, `late-queue`, `checklist` sau $300\text{ ms}$).
   * Các key tổng hợp nặng (`students.v9`, `session-history.v2`) được gom nhóm (coalesce debounce $8\text{–}10\text{ giây}$ hoặc đẩy khi đóng hộp thoại / chuyển tab / Kết ca), giúp **giảm $90\%$ dung lượng Upload & Download trên Firebase Realtime Database**.
   * Lưu bảng `_seenSafeKeyTimestamps` vào `sessionStorage` / `localStorage` để khi người dùng bấm F5 (Refresh trang), trình duyệt đối chiếu ngay với bản đã có trong `IndexedDB` / `localStorage` và **chỉ tải những key thực sự có thay đổi mới trên Cloud**, không bao giờ tải lại toàn bộ Database khi F5!

### 7.2. Cơ chế Mã hóa & Bảo mật Phân Quyền (`database.rules.json` & Client Vault)

1. **Mã hóa Payload thông minh (Non-Blocking Vault Encryption):**
   * Trên bộ nhớ máy người dùng (`_memStorageMap` và `localStorage`), dữ liệu được giữ ở dạng JSON phẳng đã giải mã để thao tác đọc/ghi trên UI đạt tốc độ **$0\text{ ms}$**.
   * Quá trình mã hóa `encryptVaultPayload(plainStr, key)` (`lvenc_v38$`) **CHỈ chạy bất đồng bộ ngay tại thời điểm đẩy gói tin Delta lên Firebase Cloud** (`_scheduleFirebaseCloudPush`) và giải mã khi nhận gói tin mới từ Cloud về. Nhờ vậy, dữ liệu trên Firebase Cloud được mã hóa 100% (người lạ nhìn vào Firebase Console chỉ thấy chuỗi mã hóa `lvenc_v38$...`), trong khi điện thoại của trợ giảng không tốn 1 mili-giây CPU nào khi bấm nút!
2. **Bảo mật tầng Database (`database.rules.json`) và Chữ ký Phiên (`authSig`):**
   * Khóa chặt quyền `.read: false, .write: false` ở gốc Database.
   * Mọi gói tin ghi lên `lopvui_cloud_v3/kv/$safeKey` bắt buộc phải kèm cấu trúc hợp lệ (`updatedAt`, `clientId`, `encKey`, `value` bắt đầu bằng tiền tố mã hóa `lvenc_v38$` và giới hạn kích thước chống tấn công làm tràn dung lượng).
   * Ở tầng ứng dụng, mọi phiên đăng nhập đều kiểm tra chữ ký xác thực `verifySessionAuthSignature(account, emp)` gắn chặt với `employeeId + role + authVersion + passwordHash`. Nếu bất kỳ ai cố tình sửa `role` trong `localStorage` thành `admin` hoặc `office`, chữ ký sẽ sai lệch và hệ thống lập tức đăng xuất cưỡng bức (`handleLogout`).

---

## 8. ĐẶC TẢ TAB BÁO CÁO BUỔI HỌC TRỰC QUAN (`#report-view`) & XUẤT ĐA ĐỊNH DẠNG

### 8.1. Chuyển Báo cáo từ Pop-up thành Tab Chính thứ 6 trong Ca học

* **Thay đổi trên thanh điều hướng Ca học (`.class-view-tabs` trong `index.html`):**
  * Gồm 6 Tab chính:
    1. `Chat & Nhật ký` (`#chat-view-tab`)
    2. `Sơ đồ lớp` (`#seating-view-tab`)
    3. `Nhập điểm` (`#scores-view-tab`)
    4. `Checklist` (`#checklist-view-tab`)
    5. `Danh sách học sinh` (`#students-view-tab`)
    6. **`📊 Báo cáo buổi học` (`#report-view-tab`)** *(Mới - Thay thế hoàn toàn việc mở pop-up `#attendance-export-dialog`)*
* Khi bấm vào tab **`📊 Báo cáo buổi học`** (hoặc bấm nút `Trung tâm báo cáo & Xuất file`), hệ thống chuyển thẳng sang màn hình `#report-view` rộng rãi, dễ nhìn ngay bên trong trang lớp học.

### 8.2. Thiết kế Màn hình `#report-view` Khoa học, Làm nổi bật ngay các Nhóm Cần Chú Ý

Màn hình `#report-view` được bố cục thành 4 khối trực quan:

1. **Khối 1 — Thanh Công Cụ Xuất Dữ Liệu & Copy 1-Chạm (Sticky Export Bar ở đầu trang):**
   * **`📋 Copy Báo cáo gửi Giáo viên (Zalo)`:** Mở khung xem trước (Live Preview) ngay bên dưới và copy 1 chạm toàn bộ báo cáo tổng hợp buổi học.
   * **`📊 Xuất Excel (.xlsx) Chuẩn In A4`:** Tải ngay file `.xlsx` định dạng bảng biểu chuẩn đẹp.
   * **`📄 Xuất Google Docs / Word (.doc)`:** Tải file biên bản buổi học định dạng `.doc` (HTML-to-Word OpenXML chuẩn A4) có sẵn Quốc hiệu/Tiêu đề trung tâm, thông tin ca học, 5 bảng tổng hợp và ô chữ ký Giáo viên - Trợ giảng (tải lên Google Docs hoặc mở bằng Word giữ nguyên 100% khung bảng).
   * **`🔄 Đẩy lên Google Sheets / Copy dán Sheet`:** Đẩy trực tiếp kết quả điểm danh & điểm buổi học lên Google Sheets hoặc copy định dạng TSV để `Ctrl+V` thẳng vào Google Sheets.
   * **`🖨 In / Lưu PDF A4`** & **`📸 Xuất Ảnh Sơ đồ lớp (PNG)`**.

2. **Khối 2 — Dashboard 5 Bảng Cảnh Báo Trực Quan (Visual Warning Cards):**
   Hiển thị ngay trên cùng một màn hình (không cần chuyển qua lại các tab nhỏ):
   * 🔴 **Bảng 1: Học sinh VẮNG MẶT** (Phân loại rõ *Vắng có phép* / *Vắng không phép*, Lý do vắng, SĐT Phụ huynh, nút `📋 Copy báo PH` từng em).
   * 🟠 **Bảng 2: Học sinh ĐI MUỘN** (Giờ đến thực tế, Số phút muộn, Ghi chú, nút `📋 Copy báo PH`).
   * 🚨 **Bảng 3: Học sinh NỢ / CHƯA NỘP BTVN** (Lý do chưa nộp: Chưa làm / Quên vở / Nghỉ buổi trước, Điểm làm bù nếu có, nút `📋 Copy báo PH`).
   * 🟡 **Bảng 4: Học sinh ĐIỂM THẤP DƯỚI MỐC** (Có thanh chọn nhanh mốc điểm thấp: `< 5`, `< 6`, `< 7` hoặc tự nhập số bất kỳ; hiển thị rõ Điểm BTVN, Điểm Test và Ghi chú).
   * 🟣 **Bảng 5: Học sinh HỌC BÙ & HỌC SINH MỚI trong buổi** (Học bù từ lớp nào / Học mới, Trạng thái điểm danh, Điểm BTVN/Test).

3. **Khối 3 — Khung Xem Trước & Chỉnh Sửa Nhanh Tin Nhắn Zalo (Live Zalo Preview Box):**
   * Hiển thị sẵn nội dung văn bản báo cáo gửi Giáo viên (và mẫu tin nhắn gửi Phụ huynh) trong một khung văn bản trực quan.
   * Trợ giảng/Văn phòng có thể nhìn kiểm tra ngay nội dung, sửa thêm vài chữ nếu muốn rồi bấm **`📋 Copy gửi Zalo`** chỉ với 1 chạm.

4. **Khối 4 — Bảng Điểm Danh Toàn Lớp Chuẩn A4 & Bàn Giao Bài Kiểm Tra:**
   * Hiển thị bảng tổng hợp toàn bộ học sinh của ca học (kèm thông tin người cầm bài kiểm tra về chấm nếu ca đó có Test) để đối chiếu tổng thể hoặc in ấn.

---

## 9. KẾ HOẠCH TRIỂN KHAI TỪNG BƯỚC (ACTIONABLE TASKS THEO TỪNG FILE CHO ANTIGRAVITY)

Khi thực thi nâng cấp dự án, AI Agent hãy thực hiện tuần tự 6 Task dưới đây:

### TASK 1: Tối ưu Tốc độ Phản hồi 0ms trên Sơ đồ lớp & Lưu trữ Chạy Ngầm (`src/app.js`)
* **Mục tiêu:** Xóa bỏ hoàn toàn độ trễ 1–2 giây khi bấm trên sơ đồ lớp.
* **Các hàm cần sửa trong `src/app.js`:**
  1. Tách hàm `save()` thành `saveImmediateSeatState()` (chỉ cập nhật RAM và `_memStorageMap` trong $< 2\text{ ms}$) và `scheduleDeferredSave()` (debounce $250\text{ ms}$ để chạy `reconcileSessionAttendanceWithSeating()`, `syncLiveSessionData()` và `saveStudentRecords()`).
  2. Viết hàm `patchSingleDeskDOM(deskId)` và `updateSeatingBannerCountersOnly()`: Khi bấm nút `+` (`addAnonymousToDesk`), khi chọn tên học sinh (`assignStudent`), hoặc khi bấm lưu trong `#seat-dialog` (`#save-homework`), chỉ cập nhật DOM của đúng bàn đó và đóng `#seat-dialog` ngay lập tức, không vẽ lại các tab đang ẩn (`#students-view`, `#scores-view`, `#checklist-view`).
  3. Lưu `_seenSafeKeyTimestamps` vào `localStorage` (`lopvui.seen-cloud-key-ts.v1`) để khi tải lại trang (F5), hàm `pullFromFirebaseCloudNow` chỉ tải các key có timestamp trên Cloud mới hơn bản đã lưu trong máy.

### TASK 2: Tinh gọn Sơ đồ lớp theo chế độ `Sửa sơ đồ: BẬT / TẮT` & Mở ô điểm BTVN (`index.html`, `src/styles.css`, `src/app.js`)
* **Các thay đổi cụ thể:**
  1. Trong `index.html` và `src/styles.css`: Ẩn hoàn toàn khay kéo `.student-pool-wrap` (`#student-pool`). Đưa nút `#quick-carryover-seating-btn` (`↺ Xếp chỗ theo buổi trước`) lên thanh `.layout-actions`.
  2. Trong `src/styles.css` và `render()` (`src/app.js`):
     * Khi `.classroom-wrap` **KHÔNG** có class `.seating-edit-mode-on` (`isSeatingEditMode === false`): Ẩn cả nút `.desk-add-compact-btn` (`+`) VÀ nút `.row-collect-hw-btn` (`Thu BTVN` ở đầu mỗi dãy); khóa thao tác kéo-thả ghế trên bàn.
     * Khi `.classroom-wrap` **CÓ** class `.seating-edit-mode-on` (`isSeatingEditMode === true`): Hiển thị rõ nút `+` ở mỗi bàn, hiển thị nút `Thu BTVN` ở đầu mỗi dãy, và cho phép kéo-thả học sinh sang bất kỳ vị trí/bàn nào.
     * Tự động bật `isSeatingEditMode = true` khi mở một ca học mới chưa có học sinh nào trên sơ đồ (`allEntries().length === 0`).
  3. Trong hàm `toggleHomeworkFields(status, prefix)` (`src/app.js`): Cho phép hiển thị ô nhập điểm BTVN (`#grade-field` và `#late-grade-field`) khi `status === 'submitted'` **HOẶC** `status === 'not_submitted'` (chỉ ẩn khi `status === 'uncollected'` nếu cần, hoặc luôn hiện để nhập điểm trực tiếp).

### TASK 3: Khóa Bảo mật Tuyệt đối Danh sách Học sinh đối với Trợ giảng (`src/app.js`, `src/features.js`)
* **Các thay đổi cụ thể:**
  1. Trong `showIdentityForm` và `showLateIdentityForm` (`src/app.js`): Kiểm tra `const canAccessAllClasses = (selectedRole() === 'admin' || selectedRole() === 'office');`. Nếu `canAccessAllClasses === false` (tức là Trợ giảng hoặc Giáo viên), **tuyệt đối KHÔNG render** khối tìm kiếm học sinh lớp khác (`#identity-cross-makeup-search`, `#late-cross-makeup-search`) — chỉ hiển thị form nhập tay Họ tên, Trường / Lớp gốc và Phân loại.
  2. Ẩn nút `#add-makeup-from-other-class-btn` trong `#students-view` đối với tài khoản `assistant` và `teacher` (chỉ hiển thị cho `office` và `admin`).
  3. Ẩn tab `#mgmt-tab-students` ("Danh bạ Học sinh toàn trung tâm") đối với tài khoản `assistant` để trợ giảng chỉ làm việc trong phạm vi các lớp mình phụ trách.

### TASK 4: Bổ sung "📝 Chế độ Chép Sổ Giấy", Bộ lọc Cột Excel & Ẩn/Hiện Cột (`index.html`, `src/app.js`, `src/features.js`, `src/styles.css`)
* **Các thay đổi cụ thể:**
  1. Thêm nút công tắc **`📝 Chế độ Chép Sổ Giấy`** (`#toggle-paper-roster-mode-btn`) trên thanh công cụ của `#students-view`.
  2. Khi bật Chế độ Chép Sổ Giấy:
     * Sắp xếp danh sách học sinh cố định theo `student.paperOrderIndex?.[CURRENT_CLASS_ID]` (mặc định theo Tên A–Z) và cho phép bấm nút `▲ / ▼` hoặc sửa số STT để khớp 100% với tờ điểm danh giấy.
     * Hiển thị bảng gọn gàng, hỗ trợ chạm vào dòng để bật highlight thước kẻ (`.paper-transcribe-active-row` & `.paper-transcribe-done-row`) giúp chép ra giấy không bị lệch dòng.
  3. Nâng cấp `#column-order-dialog` (`src/features.js`): Thêm checkbox `☑ Hiện / Ẩn cột` cho từng cột và hỗ trợ kéo-thả (Drag & Drop) đổi thứ tự cột như Excel.
  4. Bổ sung bộ lọc nhanh trên tiêu đề cột (lọc theo Trường, Trạng thái điểm danh, Trạng thái BTVN, Điểm số) trong `#students-view` và `#scores-view`.

### TASK 5: Nâng cấp Đồng bộ Google Sheets Đa Khóa (`2K9`, `2K10`, `2K11`...) & Duyệt Bán Tự Động (`index.html`, `src/excel-import-export.js`, `src/features.js`)
* **Các thay đổi cụ thể:**
  1. Trong `src/excel-import-export.js` và `#google-sheets-sync-dialog` (`index.html`, `src/features.js`):
     * Mở rộng cấu hình `loadGoogleSheetsConfig` để lưu danh sách **Bảng Google Sheets theo từng Khóa (`cohortSheets`: `2K9`, `2K10`, `2K11`, `2K12`, `2K13`...)**, mỗi khóa gồm `{ cohortName, birthYear, sheetUrl, spreadsheetId, sheetName, gid }`.
     * Hỗ trợ quét đồng bộ 1 khóa hoặc quét gộp tất cả các khóa cùng lúc.
  2. **Cơ chế Phát hiện Bán Tự Động & Thông báo cho Văn phòng / Admin:**
     * Khi tài khoản `office` hoặc `admin` đăng nhập (hoặc bấm làm mới), chạy hàm kiểm tra ngầm `checkGoogleSheetsChangesForApproval()` ở chế độ nền.
     * Nếu phát hiện học sinh trên Sheet đổi Mã lớp hoặc có học sinh mới, tạo thông báo trong `#notification-panel` và hiện badge đỏ trên nút `🔄 Đồng bộ Google Sheets` để Văn phòng/Admin vào bấm **`✓ Duyệt & Cập nhật`**.

### TASK 6: Chuyển Báo cáo Buổi học thành Tab Chính (`#report-view`) & Xuất Google Docs / Sheets / Excel (`index.html`, `src/features.js`, `src/app.js`, `src/styles.css`)
* **Các thay đổi cụ thể:**
  1. Thêm nút tab thứ 6 **`📊 Báo cáo buổi học`** (`#report-view-tab`) vào `.class-view-tabs` và tạo section `<section id="report-view" class="report-view" hidden>` ngay bên trong `#class-workspace` (`index.html`).
  2. Chuyển toàn bộ giao diện báo cáo từ pop-up `#attendance-export-dialog` sang hiển thị trực tiếp trong `#report-view` (khi bấm nút `#export-attendance-button` ở tab Danh sách học sinh cũng chuyển thẳng sang tab `#report-view` này).
  3. Hiển thị trực quan ngay trên 1 màn hình: 4 thẻ KPI tổng quan + Khung xem trước và copy 1 chạm báo cáo Zalo gửi Giáo viên / Phụ huynh + 5 bảng làm nổi bật (HS Vắng mặt, Đi muộn, Nợ BTVN, Điểm thấp dưới mốc `<5, <6, <7`, Học bù/Học mới).
  4. Bổ sung hàm `exportSessionReportToGoogleDocs()` tạo file `.doc` chuẩn in A4 (tương thích Google Docs & MS Word) bên cạnh nút Xuất Excel (`.xlsx`), Đẩy lên Google Sheets và In PDF A4.
```

# Lớp học vui · Web App Quản Lý Lớp Học & Học Sinh Trung Tâm Học Thêm

Web App quản lý lớp học thời gian thực (real-time) và ngoại tuyến (offline persistence), tối ưu hóa quy trình điểm danh, thu BTVN, kiểm tra cuối giờ và theo dõi tình hình học sinh cho Trợ giảng (TA), Giáo viên và Văn phòng theo Bản mô tả yêu cầu dự án (PRD).

---

## 🚀 Cách chạy ứng dụng

1. Đảm bảo máy đã cài đặt Node.js (phiên bản 18 hoặc 20+).
2. Mở Terminal / PowerShell tại thư mục dự án.
3. Chạy lệnh:
   ```bash
   npm start
   # hoặc:
   node server.mjs
   ```
4. Truy cập địa chỉ `http://localhost:4173` trên trình duyệt.

---

## 🌟 Các tính năng cốt lõi đã hoàn thiện theo PRD

### 1. Đăng nhập & Đăng xuất (Login & Logout) - Không cần mật khẩu
- **Màn hình Đăng nhập (Login Screen)**: Khi chưa đăng nhập hoặc sau khi đăng xuất, hệ thống hiển thị màn hình đăng nhập trực quan, thân thiện (phù hợp cả iPad và Desktop).
- **Đăng nhập 1 chạm nhanh chóng**:
  - Lọc theo nhóm vai trò: *Tất cả*, *Trợ giảng (TA)*, *Giáo viên*, *Văn phòng*, *Admin*.
  - Nhấp trực tiếp vào thẻ nhân sự của mình (hoặc chọn từ danh sách thả xuống) để đăng nhập tức thì mà không cần gõ mật khẩu.
  - Tự động ghi nhớ phiên đăng nhập vào trình duyệt (`localStorage`).
- **Nút Đăng xuất (Logout)**:
  - Có sẵn nút "⎋ Đăng xuất" ở thanh tiêu đề (Topbar), ở góc dưới Sidebar và bên trong hộp thoại Đổi tài khoản.
  - Khi đăng xuất: xóa phiên làm việc hiện tại, đóng các cửa sổ đang mở và đưa người dùng về lại màn hình Đăng nhập.

### 2. Quản lý Nhân sự dành riêng cho Admin (Personnel Management)
- **Thống kê tổng quan nhân sự (KPIs)**: Hiển thị số lượng nhân sự tổng thể, phân bổ theo *Trợ giảng (TA)*, *Giáo viên (GV)*, và *Văn phòng/Quản lý*.
- **Tìm kiếm & Bộ lọc đa năng**:
  - Tìm kiếm nhanh theo Họ tên, Mã nhân viên (TA001, GV001...), Số điện thoại hoặc Email.
  - Lọc nhanh theo vai trò: *Tất cả*, *Trợ giảng*, *Giáo viên*, *Văn phòng*, *Admin*.
- **Bảng quản lý nhân sự chuyên nghiệp**:
  - Hiển thị danh sách cán bộ nhân viên kèm Avatar, Mã NV, Vai trò (badge màu chuẩn), Số điện thoại, Email.
  - **Tự động liên kết các lớp đang phụ trách**: Hiển thị trực quan nhân viên này đang dạy hoặc trợ giảng những lớp nào trong trung tâm.
- **Thêm mới & Chỉnh sửa nhân sự**:
  - Form thêm nhân viên với gợi ý tự động mã nhân viên mới.
  - Chỉnh sửa thông tin liên hệ, vai trò, chuyên môn giảng dạy.
- **Xóa nhân sự an toàn (Data Integrity Check)**:
  - Kiểm tra nếu nhân viên đang được phân công dạy các lớp trong trung tâm, hệ thống sẽ cảnh báo chi tiết các lớp đang phụ trách và yêu cầu gỡ phân công trước khi xóa, tránh làm mất dữ liệu lớp học.
- **Xuất danh sách nhân sự (CSV / Excel)**:
  - Hỗ trợ xuất toàn bộ danh bạ cán bộ, giáo viên, trợ giảng ra file CSV chuẩn UTF-8 BOM để mở bằng Excel không bị lỗi font.

### 3. Phân quyền & Chuyển đổi Tài khoản (Roles & Account Switcher)
- Hỗ trợ đầy đủ 4 nhóm vai trò: **Trợ giảng (TA)**, **Văn phòng**, **Giáo viên**, và **Quản trị viên (Admin)**.
- Cho phép chuyển đổi tài khoản tức thì bằng cách nhấp vào thông tin cá nhân ở thanh tiêu đề (Topbar) hoặc nút "⇄ Đổi vai trò" ở màn hình chính.
- Giao diện và quyền hạn tự động cập nhật tương ứng theo từng vai trò (TA tập trung vào ca làm và lớp phụ trách; Văn phòng/Admin quản lý dữ liệu gốc, templates, nhân viên và toàn bộ lớp học).

### 2. Sơ đồ lớp & Điểm danh - Thu bài 3 bước (Class Layout & Attendance)
- **Quy trình chuẩn**:
  1. *Bước 1*: Thả biểu tượng học sinh vào các bàn đang có người ngồi.
  2. *Bước 2 (Thu bài)*: Tìm kiếm học sinh **KHÔNG nộp** BTVN trước -> gắn vào chỗ ngồi -> bắt buộc chọn lý do (Chưa làm, Quên, Nghỉ buổi trước) -> hiển thị cảnh báo đỏ trên sơ đồ.
  3. *Bước 3 (Điểm danh)*: Tìm kiếm học sinh **ĐÃ nộp** gắn vào các chỗ còn lại.
- **Kéo - Thả (Drag & Drop)**: Dễ dàng đổi chỗ học sinh, sắp xếp lại bàn học có vạch chỉ điểm rơi (drop marker) mượt mà trên cả Mobile/Touch và Desktop.
- **Cảnh báo trực quan trên sơ đồ**:
  - `⚠ Vàng`: Học sinh đã ngồi vào bàn nhưng Trợ giảng chưa tick thu BTVN buổi này.
  - `! Đỏ`: Học sinh có lịch sử nợ BTVN từ buổi trước.
- **Điểm danh muộn & Tự động tính số phút đi muộn**:
  - Hộp thoại điểm danh muộn tự động so sánh giờ đến thực tế với giờ bắt đầu ca học để tính số phút đi muộn (ví dụ: *Ca 15:30, đến lúc 15:48 → Đi muộn 18 phút*).
  - Học sinh muộn được đưa vào khu vực chờ cuối lớp để kéo vào bàn khi sẵn sàng.
- **Chốt sĩ số ca học (Finalize Attendance)**:
  - Bấm sau 15 phút đầu giờ. Hiển thị tỷ lệ `Đã có mặt / Tổng sĩ số lớp gốc`.
  - Hệ thống tự động quét học sinh trong danh sách lớp gốc chưa có mặt -> mở hộp thoại xác nhận vắng mặt.
  - Cho phép phân loại **Vắng có phép** / **Vắng không phép** và ghi chú lý do.
  - Tự động ghi nhật ký ca học và gửi thông báo real-time về Văn phòng.

### 3. Thư viện Mẫu Sơ đồ phòng học (Room Layout Templates)
- Khu vực quản lý mẫu phòng học dành cho Văn phòng (`src/data/room-template-repository.js`).
- Cho phép tạo sẵn các mẫu phòng (Phòng Tiêu chuẩn 3 dãy, Phòng Lớn Tầng 1, Phòng VIP kèm nhóm, Phòng Hội trường...).
- Khi cấu hình lớp hoặc điều chỉnh layout, chỉ cần 1 nhấp chuột để áp dụng mẫu phòng vào sơ đồ lớp học.
- Hỗ trợ lưu layout hiện tại thành một mẫu mới trong thư viện.

### 4. Quản lý Danh sách lớp gốc & Nhập dữ liệu tự động (Class Rosters & Import)
- Quản lý danh sách học sinh cố định của từng lớp học.
- Thêm mới học sinh thủ công hoặc xóa học sinh khỏi lớp gốc.
- **Nhập từ Excel / Google Sheets**:
  - Hỗ trợ tải file `.csv` hoặc dán trực tiếp dữ liệu copy từ bảng tính (Ctrl + V).
  - Tự động phân tích cột: Họ và tên, Trường, SĐT phụ huynh, Tên phụ huynh, Mã học sinh.
  - Xem trước dữ liệu (Table Preview) trước khi xác nhận nhập vào hệ thống.

### 5. Module Lớp Bổ trợ & Học bù (Tutoring Classes)
- Menu riêng biệt dành cho các ca kèm 1-1 hoặc nhóm nhỏ (`src/data/tutoring-repository.js`).
- Thống kê tổng quan: Tổng số ca, Học bù, Đã hoàn thành phiếu BTVN.
- Tìm kiếm học sinh và bộ lọc phân loại: `Học bù`, `Bổ trợ`, `Học mới`.
- Form ghi nhận chi tiết: Trợ giảng phụ trách, Học sinh, Phân loại, Lớp chính, Nội dung bài dạy, Trạng thái phiếu BTVN, Đánh giá học sinh và Điểm số.

### 6. Trang cá nhân Trợ giảng & Đối chiếu Chấm công (TA Portal)
- Dành riêng cho Trợ giảng tự theo dõi và đối chiếu số ca làm việc thành công trong tháng.
- Dựa trên log xác nhận ở Checklist đầu ca và nút "Tôi có đi làm ca này hôm nay".
- Bộ chọn tháng đối chiếu linh hoạt.
- Thống kê KPI: Số ca làm việc thành công, Tổng số giờ làm, Tỷ lệ hoàn thành checklist.
- Bảng chi tiết từng ca làm việc để đối chiếu với máy chấm công của trung tâm.
- Hỗ trợ in bảng chấm công chuẩn A4 hoặc xuất file CSV.

### 7. Trung tâm Báo cáo Buổi học & Xuất dữ liệu đa dạng
- Hộp thoại Báo cáo phiên học với 5 tab chuyên biệt:
  1. **Bảng điểm danh A4**: Template chuẩn in ấn (A4 landscape) có kẻ ô, thông tin lớp, sĩ số, giờ đến, BTVN, điểm test và phần chữ ký của TA & Giáo viên.
  2. **DS Chưa nộp BTVN**: Tự động lọc học sinh chưa nộp kèm lý do và số điện thoại phụ huynh.
  3. **DS Đi muộn**: Danh sách giờ đến và số phút đi muộn.
  4. **DS Vắng mặt**: Phân loại có phép / không phép để trung tâm gọi điện chăm sóc.
  5. **Bài kiểm tra cuối giờ & Bàn giao bài chấm**: Danh sách nộp bài test và biên bản xác nhận người mang bài đi chấm.
- Xuất file Excel (.csv) hỗ trợ tiếng Việt có dấu chuẩn UTF-8 BOM.
- **Kiến trúc đồng bộ Google Sheets API**: Sẵn sàng cấu hình Spreadsheet ID và thực hiện đồng bộ trực tuyến dữ liệu ca học.

### 8. Chat nội bộ & Nhật ký hoạt động (General Chat & Activity Logs)
- Khung trao đổi tin nhắn giữa các nhân sự trong ca.
- Bot tự động ghi nhận mọi mốc thời gian: giờ bắt đầu ca, điểm danh, thu BTVN, chốt sĩ số, thu bài test và bàn giao bài chấm.
- Hệ thống thông báo (Notification Panel) nổi bật ở thanh tiêu đề.

---

## 📂 Cấu trúc thư mục mã nguồn

```
.
├── index.html                           # Giao diện chính (HTML5 Semantic, Responsive, Dialogs)
├── package.json                         # Cấu hình gói và script chạy dự án
├── server.mjs                           # Máy chủ Node.js phục vụ tệp tĩnh không cache
├── README.md                            # Tài liệu hướng dẫn và mô tả tính năng
└── src/
    ├── app.js                           # Logic điều phối chính và tương tác giao diện
    ├── features.js                      # Module tính năng mở rộng (Roles, Tutoring, Roster, Reports...)
    ├── student-search.js                # Công cụ tìm kiếm fuzzy tiếng Việt không dấu & theo #tag
    ├── excel-import-export.js           # Bộ xử lý nhập/xuất Excel/CSV và đồng bộ Google Sheets
    ├── styles.css                       # Toàn bộ mã định dạng CSS (DM Sans, Manrope, Responsive)
    └── data/
        ├── class-catalog-repository.js  # Lưu trữ danh mục lớp học & nhân sự
        ├── class-communication-repository.js # Lưu trữ chat & nhật ký ca học
        ├── student-repository.js        # Lưu trữ hồ sơ học sinh & lịch sử 4 tuần
        ├── room-template-repository.js  # Lưu trữ thư viện mẫu sơ đồ phòng học
        └── tutoring-repository.js       # Lưu trữ danh sách ca bổ trợ & học bù
```

---

## 🆕 Cập nhật Tính năng & UX/UI Nâng cao (Phiên bản mới nhất)

### 1. Góc nhìn Giáo viên (Teacher's View Inversion)
- **Đảo chiều hoàn toàn theo không gian thực tế:**
  - **Trên - Dưới:** Bục giảng và Bảng viết chuyển xuống **phía dưới**, khu vực cuối lớp chuyển lên **phía trên**. Các bàn trong dãy được đảo ngược (bàn cuối ở trên xa bục giảng, bàn đầu ở dưới sát bục giảng).
  - **Trái - Phải:** Các dãy và các vị trí ghế ngồi trong bàn được lật ngược trái - phải, tương ứng chính xác với góc nhìn của Giáo viên đứng từ bục giảng nhìn thẳng xuống học sinh (Dãy bên tay phải/tay trái của giáo viên).
  - Giúp Giáo viên gọi tên học sinh trong lớp chuẩn xác tức thì mà không cần phải tự đảo ngược trong đầu.

### 2. Nút Bật/Tắt Chế độ Sửa Sơ Đồ Lớp (Seating Edit Mode)
- **Nút điều khiển:** `#toggle-seating-edit-btn` trên thanh công cụ sơ đồ lớp.
- **Khi BẬT (`isSeatingEditMode = true`):**
  - Mọi bàn đều hiển thị nút dấu cộng (`＋`) để thêm học sinh.
  - Cho phép kéo thả học sinh tự do giữa các bàn và từ hàng đợi học sinh mới.
- **Khi TẮT / KHÓA (`isSeatingEditMode = false`):**
  - Ẩn toàn bộ nút dấu cộng (`＋`).
  - Vô hiệu hóa tính năng kéo thả (chống chạm/kéo nhầm khi cầm điện thoại hoặc iPad đi lại trong lớp).
  - **Lưu ý:** Dù bật hay tắt chế độ sửa, Trợ giảng/Giáo viên vẫn có thể nhấp vào học sinh bất kỳ để điểm danh và thu BTVN bình thường.

### 3. Chuẩn hóa Bảng Danh Sách Học Sinh & Phân biệt Cột
- **Danh sách tổng (Danh bạ toàn trung tâm):**
  - Giữ nguyên các cột thông tin hành chính: STT, Học sinh (ảnh chân dung + tên), Mã HS, Họ đệm, Tên, Trường học, Phụ huynh & SĐT, Các lớp theo học, Nút xem hồ sơ.
  - Hỗ trợ checkbox chọn từng bạn và chọn tất cả để thao tác hàng loạt (thêm/xóa tag, đổi lớp, xóa HS).
- **Danh sách học sinh của lớp:**
  - Ẩn các cột: Mã HS, Phụ huynh & SĐT, Các lớp theo học.
  - Thay bằng các cột đặc thù theo ca học: **Tình trạng điểm danh** (Có mặt / Đi muộn / Vắng), **Tình trạng BTVN** (Đã nộp / Chưa nộp + lý do / Chưa thu), **Điểm số** (BTVN / Test), **Ghi chú chung buổi học**.
  - Có checkbox chọn nhiều bạn để thực hiện thao tác hàng loạt (thêm/xóa tag, chuyển lớp, bỏ khỏi lớp).

### 4. Sắp xếp bảng theo từng cột (Sortable Table Headers)
- Bấm trực tiếp vào tiêu đề cột (`<th>`) trên cả 2 bảng để sắp xếp dữ liệu tăng dần / giảm dần.
- Có biểu tượng mũi tên chỉ báo trực quan: `▲` (tăng dần), `▼` (giảm dần), `⇅` (chưa sắp xếp).
- Hỗ trợ sắp xếp tên học sinh chuẩn bảng chữ cái tiếng Việt (so sánh theo Tên trước, Họ đệm sau).

---

## 🏷 Phiên bản v0.8 (Cập nhật giao diện & Trải nghiệm kéo thả)

### 1. Phóng to biểu tượng kéo thả học sinh (`.pool-token`)
- Biểu tượng học sinh trong khay kéo thả (`#student-pool`) được phóng to lên kích thước **44px × 44px** (biểu tượng SVG 22px), có hiệu ứng nổi bóng và viền rõ nét, giúp Trợ giảng dễ dàng chạm và kéo thả trên iPad / màn hình cảm ứng.

### 2. Nút thêm học sinh hình vuông nhỏ gọn (`.desk-add-compact-btn`)
- Nút thêm học sinh dấu cộng (`＋`) tại mỗi bàn được thu gọn thành một ô hình vuông nhỏ nhắn **22px × 22px**, viền nét đứt màu xanh lá, tách biệt hoàn toàn khỏi khu vực ghế ngồi (`.desk-seats`).
- Giúp các thẻ tên học sinh giữ nguyên 100% diện tích rộng rãi, **hoàn toàn không bị chen lấn, chèn ép hay thu hẹp không gian** khi bật chế độ sửa sơ đồ.

### 3. Căn giữa chuẩn xác cho Sơ đồ lớp ở Góc nhìn Giáo viên
- Tách biệt hoàn toàn ô thông báo bục giảng màu vàng ra khỏi khung chứa các dãy bàn ghế (`#classroom`).
- Giúp toàn bộ sơ đồ lớp học luôn được **căn giữa 100%** cả ở góc nhìn Giáo viên lẫn góc nhìn Trợ giảng, không bao giờ bị lệch sang phải.


---

## ⚡ Phiên bản v0.9 (Đồng bộ Dữ liệu Real-time Liên tục & Ổn định Hệ thống)

### 1. Bộ máy Đồng bộ Thời gian thực Đa chiều (`src/data/realtime-sync.js` & `server.mjs`)
- **Tự động bắt sự kiện lưu trữ (`Storage Interceptor`)**: Mọi thao tác thay đổi dữ liệu trên sơ đồ lớp, điểm danh, BTVN, checklist, ghi chú, danh sách học sinh, lớp bổ trợ hay cấu hình lớp đều được tự động phát tín hiệu đồng bộ ngay lập tức.
- **Đồng bộ đa tab/cửa sổ (`BroadcastChannel` + `StorageEvent`)**: Khi mở nhiều tab (ví dụ Tab Trợ giảng điểm danh và Tab Giáo viên/Văn phòng theo dõi), giao diện ở tất cả các tab tự động cập nhật tức thì mà không cần tải lại trang.
- **Đồng bộ đa thiết bị qua mạng nội bộ (`SSE /api/events` & `REST /api/sync`)**: Máy tính và iPad/điện thoại cùng truy cập server sẽ nhận luồng sự kiện Server-Sent Events thời gian thực.

### 2. Đồng bộ Liên tục Ca học Đang diễn ra (`syncLiveSessionData`)
- Cập nhật tức thì trạng thái điểm danh, điểm BTVN, vị trí ngồi và ghi chú của học sinh vào lịch sử ca học (`sessionHistory`) và hồ sơ học sinh (`attendanceHistory`, `sessionNotes`, `scores`, `seatingHistory`) ngay khi thao tác trên sơ đồ lớp mà không cần đợi đến lúc bấm Kết ca.
- Tự động cách ly trạng thái điểm danh/BTVN tạm thời theo đúng từng `(Mã lớp, Ngày học)`, ngăn chặn triệt để hiện tượng rò rỉ trạng thái của học sinh học nhiều lớp.

### 3. Khắc phục Triệt để các Lỗi Dữ liệu & Nâng cấp Bảng Học sinh trong Ca
- Sửa lỗi `ReferenceError` khi tải danh sách học sinh học bù (`makeupStudents`), khi mở bảng danh sách lớp ở trang Quản lý chung và khi bấm **Chốt sĩ số ca học**.
- Sửa lỗi khóa lưu trữ động (`getChecklistKey`, `getAttendanceNotesKey`) giúp lưu đúng checklist và ghi chú khi chuyển đổi qua lại giữa các lớp học khác nhau.
- Nâng cấp tab **Danh sách học sinh** trong ca học thành bảng dữ liệu tương tác thời gian thực có ô tích chọn hàng loạt (thêm/xóa tag, thêm/chuyển/bỏ lớp), bấm tiêu đề cột để sắp xếp và nhập ghi chú trực tiếp.


---

## 🚀 Phiên bản v1.0 (Khắc phục Xung đột Cache Module & Ổn định Thao tác Giao diện)

### 1. Chống Cache Lệch Phiên bản ES Modules (`?v=1.0` & `firebase.json` Headers)
- Gắn tham số định danh phiên bản `?v=1.0` đồng bộ trên toàn bộ `<script>`, `<link>` và tất cả câu lệnh `import` ES Module (`app.js`, `features.js`, `realtime-sync.js`, `session-history-repository.js`, `student-repository.js`, `class-catalog-repository.js`,...).
- Cấu hình `Cache-Control: no-cache, no-store, must-revalidate` trong `firebase.json` để trình duyệt luôn tải mã nguồn mới nhất ngay sau khi `firebase deploy`, ngăn chặn triệt để lỗi `SyntaxError: module does not provide an export` làm treo các nút bấm trên web.

### 2. Khắc phục Lỗi Đổi Tài khoản, Chuyển Tab & Đăng xuất
- Loại bỏ sự kiện làm mới DOM đồng bộ khi `window.focus` trong `realtime-sync.js` (tránh việc DOM bị vẽ lại ngay giữa lúc người dùng đang nhấn chuột làm mất sự kiện `click`).
- Tách biệt khóa phiên đăng nhập (`lopvui.signed-in-account.v1`) khỏi luồng ghi đè từ xa để mỗi tab/thiết bị giữ nguyên tài khoản đang đăng nhập.
- Đồng bộ trạng thái ẩn/hiện (`hidden` và `style.display`) của `#main-menu-view`, `#class-workspace`, `#class-general-view` và `#login-screen` khi chuyển tab, đổi vai trò hoặc đăng xuất/đăng nhập lại.


---

## 🛡️ Phiên bản v2.2 (Tích hợp Bộ đồng bộ Real-time Nội tuyến & Bảo toàn Dữ liệu Local)

### 1. Tích hợp Trực tiếp Bộ máy Real-time vào `src/app.js` (Zero-External-Dependency)
- Nhúng trực tiếp bộ đồng bộ thời gian thực (`initRealtimeSync`, `forceSyncNow`) và hàm đồng bộ ca học (`syncActiveClassSessionRecord`) ngay bên trong `src/app.js`, loại bỏ hoàn toàn sự phụ thuộc vào file rời bên ngoài để tránh lỗi `Failed to load module script` trên Firebase Hosting.
- Không bao giờ ghi đè dữ liệu `localStorage` sẵn có trên máy người dùng khi khởi động trang; toàn bộ dữ liệu học sinh, lớp học, nhân sự và lịch sử ca làm trên trình duyệt của bạn được giữ nguyên 100%.

# UNIVERSAL GITHUB SPEC KIT: ĐẶC TẢ KIẾN TRÚC, GIAO DIỆN, ĐỒNG BỘ & NGHIỆP VỤ TOÀN DIỆN (`class_mgr` / `edu_center` v6.3)

* **Mã dự án (Project Namespace):** `edu_center` / `class_mgr`
* **Loại tài liệu:** Universal System Architecture & Product Specification (chuẩn GitHub Spec Kit dành cho mọi AI Coding Agent: Cursor, Claude Code, Windsurf, GitHub Copilot Workspace, Google Antigravity, Devin...)
* **Kiến trúc kỹ thuật:** Modular Vanilla ES6+ Web Application (Zero-Framework-Overhead, Lean Modern Web APIs) + Offline-First Storage (RAM + IndexedDB + LocalStorage) + Google Firebase Hosting & Firebase Realtime Database
* **Phong cách thiết kế giao diện:** Chuyên nghiệp, Khoa học, Tối giản (Enterprise Clean UI) — **Tuyệt đối không dùng Emoji**, chỉ dùng nhãn chữ rõ ràng kết hợp ký hiệu chuẩn (`✓`, `×`, `+`, `—`, `/`, `•`) hoặc icon SVG nét mảnh đơn sắc (`currentColor`) ở những vị trí thực sự cần thiết.
* **Phạm vi tương thích thiết bị & trình duyệt:**
  * Hỗ trợ mượt mà trên điện thoại thông minh, máy tính bảng (iPad/Android Tablet) và máy tính (Mac/Windows) trên các trình duyệt Safari, Chrome, Edge, Firefox.
  * Ưu tiên giải pháp CSS/JS gọn nhẹ, chuẩn hiện đại; chỉ áp dụng các fallback đơn giản (như CSS `100vh`/`100dvh`, tắt hiệu ứng làm mờ nặng trên di động), không nhúng các thư viện polyfill cồng kềnh.

---

## MỤC LỤC

1. [Mục tiêu Cốt lõi & Nguyên tắc Thực thi cho AI Agent](#1-mục-tiêu-cốt-lõi--nguyên-tắc-thực-thi-cho-ai-agent)
2. [Kiến trúc Thư mục Module hóa & Quy chuẩn Đặt tên (`class_mgr` / `edu_center`)](#2-kiến-trúc-thư-mục-module-hóa--quy-chuẩn-đặt-tên-class_mgr--edu_center)
3. [Quy chuẩn Không Emoji, Icon Đơn sắc, Font chữ, Trợ năng (WCAG AA) & Chống Đè Nút](#3-quy-chuẩn-không-emoji-icon-đơn-sắc-font-chữ-trợ-năng-wcag-aa--chống-đè-nút)
4. [Mô hình Dữ liệu Chuẩn (Canonical Data Schemas)](#4-mô-hình-dữ-liệu-chuẩn-canonical-data-schemas)
5. [Ma trận Phân quyền Bảo mật (Strict RBAC) & Cô lập Dữ liệu Học sinh](#5-ma-trận-phân-quyền-bảo-mật-strict-rbac--cô-lập-dữ-liệu-học-sinh)
6. [Kiến trúc Phản hồi 0ms (Optimistic UI), Hàng đợi Offline/Online & Đồng bộ Firebase](#6-kiến-trúc-phản-hồi-0ms-optimistic-ui-hàng-đợi-offlineonline--đồng-bộ-firebase)
7. [Đặc tả Nghiệp vụ Sơ đồ Lớp, Thu BTVN, Điểm danh & Chế độ Giáo viên (`#seating-view`)](#7-đặc-tả-nghiệp-vụ-sơ-đồ-lớp-thu-btvn-điểm-danh--chế-độ-giáo-viên-seating-view)
8. [Đặc tả Chế độ "Chép Sổ Giấy", Bộ lọc Excel, Ẩn/Hiện Cột & Nhập điểm (`#students-view` & `#scores-view`)](#8-đặc-tả-chế-độ-chép-sổ-giấy-bộ-lọc-excel-ẩnhiện-cột--nhập-điểm-students-view--scores-view)
9. [Đặc tả Hộp việc Văn phòng (Office Action Inbox), Đồng bộ Google Sheets Đa Khóa & Khớp Hồ sơ](#9-đặc-tả-hộp-việc-văn-phòng-office-action-inbox-đồng-bộ-google-sheets-đa-khóa--khớp-hồ-sơ)
10. [Đặc tả Tab Báo cáo Buổi học Trực quan (`#report-view`) & Xuất Google Docs / Sheets / Excel / Zalo](#10-đặc-tả-tab-báo-cáo-buổi-học-trực-quan-report-view--xuất-google-docs--sheets--excel--zalo)
11. [Đặc tả Cơ chế "Đóng Ca Học" (Vẫn Cho Phép Chỉnh Sửa 100%), Lớp Bổ trợ, Chấm công & Nhật ký Admin](#11-đặc-tả-cơ-chế-đóng-ca-học-vẫn-cho-phép-chỉnh-sửa-100-lớp-bổ-trợ-chấm-công--nhật-ký-admin)
12. [Lộ trình Triển khai & Bộ Tiêu chí Nghiệm thu Toàn diện (Implementation Roadmap & Comprehensive DoD)](#12-lộ-trình-triển-khai--bộ-tiêu-chí-nghiệm-thu-toàn-diện-implementation-roadmap--comprehensive-dod)

---

## 1. MỤC TIÊU CỐT LÕI & NGUYÊN TẮC THỰC THI CHO AI AGENT

Khi bất kỳ AI Agent nào đọc tài liệu này để khởi tạo dự án mới hoặc nâng cấp dự án hiện tại, phải tuân thủ tuyệt đối **7 nguyên tắc bất biến** sau:

1. **Phản hồi Cục bộ Tức thì ($< 16\text{ ms}$ Optimistic UI):** Mọi thao tác chạm của Trợ giảng trên Sơ đồ lớp (bấm `+` thêm học sinh vào bàn, mở Menu Điểm danh, chọn tên học sinh, bấm `Thu BTVN` cả dãy, nhập điểm) phải cập nhật ngay vào RAM và chỉ render lại đúng phần tử DOM vừa thay đổi. Tuyệt đối không bắt giao diện chờ mã hóa dữ liệu hay chờ mạng phản hồi. Các máy khác nhận đồng bộ sau $1\text{–}2\text{ giây}$ qua mạng là bình thường.
2. **Nghiêm cấm Emoji & Tối giản Icon Đơn sắc (Zero-Emoji Policy):** Tuyệt đối không sử dụng bất kỳ ký tự Emoji màu nào trong HTML, CSS, JavaScript, thông báo Toast, nhãn nút bấm, tiêu đề bảng hay báo cáo xuất ra. Chỉ dùng chữ thuần túy rõ nghĩa; nếu thật sự cần icon (như nút Xóa, Tìm kiếm, Đóng) thì dùng SVG đơn sắc nét mảnh (`stroke="currentColor"`, `fill="none"`) hoặc ký hiệu văn bản thuần túy (`+`, `×`, `✓`, `—`, `/`, `•`).
3. **Chạm (Tap) Luôn Mở Menu Điểm Danh & Kéo-Thả (Drag & Drop) Để Đổi Chỗ:** Bấm/chạm vào bất kỳ ghế học sinh nào trên sơ đồ lớp **luôn luôn mở ngay Menu Điểm danh (`#seat-dialog`)** — kể cả khi đang bật hay tắt `Sửa sơ đồ`. Việc di chuyển học sinh giữa các bàn sử dụng thao tác **Kéo - Thả (Drag & Drop)** (nhấn giữ và di chuyển $\ge 6\text{ px}$), tuyệt đối không dùng chế độ "Tap-to-Move" trên ghế học sinh để tránh làm mất thao tác mở nhanh Menu Điểm danh.
4. **Đóng Ca Học Không Khóa Dữ Liệu (Always-Editable Sessions):** Nút **"Đóng ca học"** chỉ mang ý nghĩa đánh dấu hoàn tất công việc trong ca (`status: 'closed'`). Sau khi đóng ca (hoặc khi mở lại ca học cũ từ lịch sử $1\text{–}2\text{ ngày}$ sau), Trợ giảng / Giáo viên / Văn phòng **vẫn có toàn quyền chỉnh sửa mọi dữ liệu như bình thường** (nhập bổ sung điểm BTVN/Test sau khi chấm xong, sửa checklist, thêm tên bài học, cập nhật điểm danh/ghi chú).
5. **Không Chồng Chéo Nút & Chuẩn Trợ Năng (Zero-Overlap & Accessible UI):** Mọi nút bấm, nhãn trạng thái, thanh công cụ và hộp thoại phải được bố cục bằng CSS Grid / Flexbox an toàn, không bao giờ để nút này đè lên nút kia hoặc tràn chữ ra ngoài khung.
6. **Cô lập Dữ liệu Theo Phân Quyền (Strict Data Privacy):** Trợ giảng và Giáo viên chỉ được nhìn thấy và tìm kiếm học sinh thuộc các lớp mình được phân công. Khi Trợ giảng thêm Học sinh mới hoặc Học bù trên lớp, hệ thống chỉ mở form nhập tay, tuyệt đối không gợi ý danh sách học sinh của các lớp khác.
7. **Khớp Tuyệt Đối Quy Trình Sổ Giấy & Google Sheets Thực Tế:** Hỗ trợ chế độ **Chép Sổ Giấy** (khóa cố định thứ tự STT theo sổ điểm danh giấy, tách riêng Học sinh mới/Học bù ở cuối bảng, hiển thị ký hiệu viết tắt chuẩn) và đồng bộ **Google Sheets đa khóa (`2K9`, `2K10`, `2K11`...)** với cơ chế duyệt bán tự động cho Văn phòng.

---

## 2. KIẾN TRÚC THƯ MỤC MODULE HÓA & QUY CHUẨN ĐẶT TÊN (`class_mgr` / `edu_center`)

### 2.1. Cấu trúc Thư mục Chuẩn (Modular Directory Structure)

```text
edu-center-class-manager/
├── index.html                              # Khung HTML5 ngữ nghĩa, Topbar, Sidebar, Views & Dialogs
├── firebase.json                           # Cấu hình Firebase Hosting & Cache-Control
├── database.rules.json                     # Quy tắc bảo mật Firebase Realtime Database (RBAC & Validation)
├── package.json                            # Scripts khởi chạy & deploy
├── server.mjs                              # Local HTTP + SSE Server hỗ trợ đồng bộ mạng LAN nội bộ
└── src/
    ├── main.js                             # Điểm khởi chạy ứng dụng (Bootstrap, Router)
    ├── styles/
    │   ├── tokens.css                      # Biến màu sắc, Typography, Spacing, Z-index chuẩn
    │   ├── base.css                        # Reset, Accessibility focus, Lightweight CSS fallbacks
    │   ├── layout.css                      # App Shell, Sidebar, Topbar, Responsive Grid không đè nút
    │   ├── seating-map.css                 # Sơ đồ lớp, Bàn ghế, Vạch ngăn, Chế độ Giáo viên
    │   └── tables-and-views.css            # Bảng dữ liệu, Chế độ Chép Sổ Giấy, Tab Báo cáo, Dialogs
    ├── core/
    │   ├── storage-engine.js               # Hybrid RAM + IndexedDB + LocalStorage (`class_mgr.*`)
    │   ├── crypto-vault.js                 # Mã hóa Payload Cloud (`cm_enc_v1$`), Hash mật khẩu & Chữ ký phiên
    │   ├── realtime-sync-engine.js         # Đồng bộ Delta Firebase (`edu_center_db/v1`), Offline Queue & CRDT Merge
    │   ├── auth-guard.js                   # Quản lý phiên đăng nhập, Phân quyền RBAC & Cô lập dữ liệu lớp
    │   └── router.js                       # Điều hướng SPA giữa các View & Ca học
    ├── repositories/
    │   ├── master-catalog-repo.js          # Quản lý Môn học, Tài khoản Nhân sự & Danh mục Lớp học
    │   ├── room-template-repo.js           # Quản lý Phòng học, Sơ đồ mẫu & Vạch ngăn từng dãy
    │   ├── student-repo.js                 # Quản lý Hồ sơ Học sinh, Lịch sử chuyển lớp & Ảnh Google Drive
    │   ├── session-repo.js                 # Quản lý Ca học, Sơ đồ bàn trong ca, Điểm danh, BTVN, Checklist
    │   ├── audit-log-repo.js               # Nhật ký thao tác Admin (Admin Audit Log) theo từng lớp & ca
    │   └── tutoring-repo.js                # Quản lý Ca Bổ trợ, Học bù riêng & Gia sư 1-kèm-1
    ├── modules/
    │   ├── seating-controller.js           # Logic Sơ đồ lớp Optimistic UI 0ms, Drag & Drop, Thu BTVN, Điểm danh
    │   ├── paper-transcription-controller.js # Chế độ Chép Sổ Giấy, Khóa STT cố định & Ký hiệu viết tắt
    │   ├── scores-controller.js            # Bảng Nhập điểm & Xem lịch sử điểm 4 buổi gần nhất
    │   ├── checklist-controller.js         # Checklist đầu giờ/cuối giờ, Chấm công TA & Bàn giao bài Test
    │   ├── report-dashboard-controller.js  # Tab Báo cáo trực quan, Preview Zalo 1 chạm, Xuất Docs/Sheets/Excel
    │   ├── office-inbox-controller.js      # Hộp việc Cần xử lý của Văn phòng, Khớp HS mới/Học bù vào DS tổng
    │   └── sheets-sync-controller.js       # Đồng bộ Google Sheets đa khóa (2K9, 2K10, 2K11...) & Duyệt chuyển lớp
    └── utils/
        ├── monochrome-icons.js             # Thư viện nhỏ chứa các SVG nét mảnh đơn sắc (chỉ dùng khi cần)
        ├── vietnamese-search.js            # Tìm kiếm tiếng Việt không dấu, chữ cái đầu (mdp -> Mạc Duy Phú) & #tag
        ├── spreadsheet-io.js               # Đọc/Ghi file .xlsx, .csv, .doc sử dụng Web APIs hiện đại gọn nhẹ
        └── time-and-format.js              # Định dạng ngày DD/MM/YYYY, điểm số dấu phẩy VN (8,5), tính phút muộn
```

### 2.2. Quy chuẩn Đặt tên Khóa Lưu trữ Cục bộ (`class_mgr.*`) & Tự động Tương thích Ngược

Toàn bộ khóa lưu trữ trong `localStorage` và `IndexedDB` sử dụng tiền tố chuẩn **`class_mgr.`** (kèm bộ chuyển đổi tự động đọc dữ liệu từ khóa cũ `lopvui.*` nếu có để không mất dữ liệu hiện hành):

| Tên Khóa Chuẩn (`class_mgr.*`) | Khóa Tương Thích Cũ (`lopvui.*`) | Mô tả Nội dung Lưu trữ |
| :--- | :--- | :--- |
| `class_mgr.auth.session.v1` | `lopvui.signed-in-account.v1` | Phiên đăng nhập hiện tại kèm chữ ký bảo mật `authSig` |
| `class_mgr.catalog.master.v1` | `lopvui.master-data.v1` | Danh mục môn học và danh sách tài khoản nhân sự (đã băm mật khẩu) |
| `class_mgr.catalog.classes.v1` | `lopvui.class-catalog.v1` | Danh sách cấu hình các lớp học (`TOAN8A`, `2K9.H4`...) |
| `class_mgr.catalog.rooms.v1` | `lopvui.room-templates.v1` | Thư viện phòng học và cấu hình số dãy/số bàn/vạch ngăn |
| `class_mgr.students.master.v1` | `lopvui.students.v9` | Hồ sơ học sinh toàn trung tâm (lịch sử điểm danh, điểm, lớp học) |
| `class_mgr.students.makeup.v1` | `lopvui.makeup-students.v1` | Danh sách học sinh học bù tạm thời do TA nhập trong ca |
| `class_mgr.sessions.history.v1` | `lopvui.session-history.v2` | Lịch sử tổng hợp các ca học đã mở / đã đóng |
| `class_mgr.session.layout.{classId}.{date}` | `lopvui.layout.v5.{classId}.{date}` | Sơ đồ bàn ghế của lớp trong ngày học cụ thể |
| `class_mgr.session.desks.{classId}.{date}` | `lopvui.desk-items.v7.{classId}.{date}` | Trạng thái từng ghế ngồi, điểm danh, BTVN trên sơ đồ |
| `class_mgr.session.late_queue.{classId}.{date}` | `lopvui.late-queue.v6.{classId}.{date}` | Hàng đợi học sinh đến muộn ở cuối lớp chờ xếp vào bàn |
| `class_mgr.session.checklist.{classId}.{date}` | `lopvui.checklist.v1.{classId}.{date}` | Trạng thái Checklist đầu/cuối ca, bài học, điểm Test, bàn giao |
| `class_mgr.session.notes.{classId}.{date}` | `lopvui.attendance-notes.v1.{classId}.{date}` | Ghi chú buổi học của từng học sinh trong ca |
| `class_mgr.sheets.cohorts.v1` | `lopvui.google-sheets-config.v1` | Cấu hình các bảng Google Sheets theo từng khóa (`2K9`, `2K10`...) |
| `class_mgr.sync.offline_queue.v1` | *(Mới)* | Hàng đợi các thay đổi chưa đẩy lên Cloud khi thiết bị mất mạng |

### 2.3. Quy chuẩn Cấu trúc Nhánh Firebase Realtime Database (`edu_center_db/v1`)

Trên Firebase Realtime Database, dữ liệu được phân tách theo từng phân khu (`shards`) để chỉ tải và cập nhật đúng phần dữ liệu có thay đổi:

```json
{
  "edu_center_db": {
    "v1": {
      "meta": {
        "lastUpdatedAt": 1730640000000,
        "lastClientId": "client-m3k9a",
        "shardTimestamps": {
          "catalog_master": 1730630000000,
          "catalog_classes": 1730630500000,
          "students_master": 1730639000000,
          "session_TOAN8A_2026-11-03": 1730640000000
        }
      },
      "shards": {
        "catalog_master": { "updatedAt": 1730630000000, "clientId": "...", "payload": "cm_enc_v1$..." },
        "catalog_classes": { "updatedAt": 1730630500000, "clientId": "...", "payload": "cm_enc_v1$..." },
        "students_master": { "updatedAt": 1730639000000, "clientId": "...", "payload": "cm_enc_v1$..." },
        "session_TOAN8A_2026-11-03": { "updatedAt": 1730640000000, "clientId": "...", "payload": "cm_enc_v1$..." }
      },
      "deletedIds": {
        "stu-old-123": 1730635000000
      }
    }
  }
}
```

---

## 3. QUY CHUẨN KHÔNG EMOJI, ICON ĐƠN SẮC, FONT CHỮ, TRỢ NĂNG (WCAG AA) & CHỐNG ĐÈ NÚT

### 3.1. Quy chuẩn Thiết kế Nghiêm cấm Emoji & Sử dụng Icon Đơn sắc Tối giản (Zero-Emoji & Minimal Monochrome Icon Policy)

Để giao diện mang tính chuyên nghiệp, nghiêm túc và đồng nhất trên mọi hệ điều hành (tránh việc emoji hiển thị khác nhau và lòe loẹt trên iOS, Android, Windows, macOS):

1. **Nghiêm cấm 100% Emoji trên toàn hệ thống:**
   * Không sử dụng bất kỳ ký tự Emoji Unicode màu nào ở mọi nơi trong mã nguồn: từ thanh điều hướng, nút bấm, tiêu đề bảng, nhãn trạng thái (badges/pills), thông báo Toast cho tới nội dung báo cáo xuất ra.
   * Quét sạch toàn bộ emoji đang có trong `index.html`, `src/app.js`, `src/features.js` và thay bằng văn bản thuần túy hoặc icon SVG đơn sắc khi thật sự cần thiết.
2. **Nguyên tắc "Chữ Rõ Nghĩa Trước — Icon Đơn Sắc Sau":**
   * **Không dùng icon nếu chữ đã đủ rõ nghĩa:** Các tab điều hướng (`Sơ đồ lớp`, `Nhập điểm`, `Checklist`, `Danh sách học sinh`, `Báo cáo buổi học`), các nút nghiệp vụ (`Thu BTVN`, `Điểm danh muộn`, `Sửa sơ đồ: TẮT`, `Chế độ Giáo viên`, `Chép sổ giấy`, `Đồng bộ Google Sheets`, `Xuất Excel`) chỉ hiển thị văn bản thuần túy, gọn gàng, không gắn icon trang trí thừa thãi.
   * **Chỉ dùng Icon SVG Đơn Sắc ở các nút công cụ nhỏ cần tiết kiệm diện tích:**
     * Ví dụ: Nút Chuông thông báo trên Topbar, nút Xóa học sinh khỏi ghế (hình thùng rác vuông ở góc trái footer `#seat-dialog`), biểu tượng Học sinh vô danh trên ghế chưa điểm danh, nút Đóng hộp thoại (`×`), nút Xóa nhanh ô tìm kiếm (`×`).
     * Mọi icon SVG bắt buộc dùng nét mảnh đơn sắc: `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="1.8"`, `stroke-linecap="round"`, `stroke-linejoin="round"`. Màu của icon luôn tự động kế thừa `color` của văn bản đi kèm (`currentColor`), tuyệt đối không dùng icon nhiều màu.
3. **Bảng Ký hiệu Văn bản Chuẩn Mực (Standard Typographic Symbols):**
   * Chỉ sử dụng bộ ký hiệu toán học / văn bản đơn sắc chuẩn sau đây để biểu thị trạng thái ngắn gọn:
     * `✓` : Có mặt / Đã nộp BTVN / Hoàn thành
     * `×` : Vắng mặt / Không nộp BTVN / Đóng / Xóa
     * `+` : Thêm mới (thêm học sinh vào bàn, thêm lớp, thêm việc)
     * `—` : Trống / Chưa ghi nhận
     * `/` : Chưa có điểm (trong chuỗi điểm 4 buổi gần nhất, ví dụ: `8,5; 9; /; 7,5`)
     * `•` : Chấm tròn chỉ báo trạng thái trực tuyến hoặc gạch đầu dòng

### 3.2. Nguyên tắc Tương thích Gọn Nhẹ (Lean Cross-Device Compatibility)

1. **Dùng các Fallback CSS Đơn Giản, Không Nặng Nề:**
   * Khai báo chiều cao kép `height: 100vh; height: 100dvh;` cho các khung toàn màn hình.
   * Tắt `backdrop-filter: blur(...)` và bóng đổ phức tạp trên thiết bị màn hình nhỏ ($\le 768\text{ px}$) hoặc trong lúc đang kéo-thả (`.is-dragging`) để giữ tốc độ khung hình $60\text{ fps}$ ổn định.
2. **Giữ Mã Nguồn JS Tinh Gọn Hiện Đại:**
   * Sử dụng trực tiếp các API chuẩn của trình duyệt hiện đại (`DecompressionStream`, `structuredClone`, `<dialog>`). Chỉ giữ lại vài dòng fallback nhỏ gọn nếu thật sự cần thiết, **bỏ qua các đoạn code giải nén/polyfill dài dòng** cho những trình duyệt quá cũ không còn thực tế.

### 3.3. Hệ thống Font Chữ (Typography) & Chuẩn Trợ Năng (Accessibility)

1. **Font chữ & Chữ số Thẳng cột (`tabular-nums`):**
   * Sử dụng bộ font hỗ trợ tiếng Việt rõ nét: `'Be Vietnam Pro', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`.
   * Bật `font-variant-numeric: tabular-nums;` trên toàn bộ bảng điểm danh, cột STT, Mã HS, Điểm số và đồng hồ đếm phút muộn để các con số luôn thẳng hàng tuyệt đối từ trên xuống dưới.
2. **Chống Tự Động Phóng To (Anti-Auto-Zoom) trên Điện thoại:**
   * Toàn bộ thẻ `input`, `select`, `textarea` bắt buộc có `font-size: 16px !important;` và `touch-action: manipulation;` để iOS Safari / Android Chrome không tự động phóng to làm lệch khung nhìn khi bấm vào ô tìm kiếm hoặc ô nhập điểm.
3. **Chuẩn Trợ Năng (WCAG 2.1 AA):**
   * **Vùng chạm tối thiểu:** Mọi nút bấm có chiều cao tối thiểu $40\text{ px}\text{–}44\text{ px}$, khoảng cách giữa 2 nút tối thiểu $8\text{ px}$.
   * **Đa tín hiệu nhận diện (Màu sắc + Ký hiệu + Chữ):** Không bao giờ chỉ dùng màu sắc để phân biệt trạng thái. Luôn hiển thị kèm ký hiệu chữ đơn sắc rõ ràng: `✓` (Có mặt / Đã nộp), `×` (Vắng / Chưa nộp), `M15` (Muộn 15 phút), `BÙ` (Học bù), `Mức 1–4` (Cảnh báo sớm).
   * **Hỗ trợ Bàn phím & ARIA:** Đầy đủ `aria-label`, `role`, điều hướng bằng phím `Tab`, `Enter` (chọn học sinh đầu tiên / nhảy xuống ô điểm dưới), `ArrowUp`/`ArrowDown` (di chuyển giữa các dòng điểm) và `Escape` (đóng hộp thoại).

### 3.4. Quy tắc Bố cục Chống Chồng Chéo Nút (Zero-Overlap CSS Architecture)

1. **Nghiêm cấm dùng `position: absolute` cho các nút hành động trong Bàn học, Thẻ lớp và Header Hộp thoại:**
   * **Header của mọi Dialog (`.dialog-header`):** Dùng CSS Grid 2 cột `grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: start;`. Tiêu đề nằm bên trái, nút đóng `×` ($38\times 38\text{ px}$) nằm ở cột riêng bên phải.
   * **Thanh điều khiển trên Sơ đồ lớp (`.classroom-top-bar`):** Đặt nút `Sửa sơ đồ: BẬT/TẮT` trong một hàng Flexbox riêng nằm phía trên thanh `BẢNG · ĐẦU LỚP`, tuyệt đối không đè lên chữ Bảng lớp.
   * **Cấu trúc mỗi Bàn học (`.desk`):**
     * Khi `Sửa sơ đồ: BẬT`: `.desk` dùng Grid 2 cột `grid-template-columns: minmax(0, 1fr) 34px; gap: 6px; align-items: stretch;`. Các ghế học sinh (`.desk-seats`) nằm bên trái, nút `+` (`.desk-add-compact-btn`) nằm ở cột phải `34px` riêng biệt.
     * Khi `Sửa sơ đồ: TẮT`: Ẩn hoàn toàn nút `+`, `.desk-seats` tự động mở rộng 100% chiều ngang bàn.
2. **Tất cả Ghế trong Cùng Một Bàn Luôn Nằm Trên 1 Hàng Ngang:**
   * `.desk-seats` dùng `display: flex; flex-direction: row; flex-wrap: nowrap; gap: 6px;`. Mỗi thẻ ghế có chiều rộng chuẩn cố định (`min-width: 112px`), dãy bàn tự động mở rộng theo bàn đông nhất và khung `.classroom` hỗ trợ cuộn ngang mượt mà khi có nhiều dãy.

---

## 4. MÔ HÌNH DỮ LIỆU CHUẨN (CANONICAL DATA SCHEMAS)

### 4.1. Hồ sơ Học sinh (`StudentRecord`) — Hỗ trợ Khóa Thứ Tự Sổ Giấy & Bảo Lưu Lịch Sử Lớp Cũ

```json
{
  "id": "stu-1730560000-k9a",
  "studentCode": "K09.1832",
  "familyName": "Phạm Chí",
  "givenName": "Kiên",
  "name": "Phạm Chí Kiên",
  "school": "THPT Trần Phú",
  "cohort": "2K9",
  "classIds": ["class-2k9-h4"],
  "previousClassIds": ["class-2k9-h2"],
  "classTransferHistory": [
    {
      "fromClassId": "class-2k9-h2",
      "toClassId": "class-2k9-h4",
      "date": "2026-10-25",
      "timestamp": 1729850000000,
      "approvedBy": "VP001",
      "source": "google-sheets-sync"
    }
  ],
  "paperOrderIndex": {
    "class-2k9-h4": 5
  },
  "paperOrderLocked": {
    "class-2k9-h4": true
  },
  "enrollmentStatus": "Học",
  "parentContact": {
    "name": "Chị Hương",
    "phone": "0912345678"
  },
  "tags": ["Mới"],
  "isNew": true,
  "studentType": "regular",
  "warningConfig": {
    "mode": "auto",
    "manualLevel": null,
    "customNoteTag": ""
  },
  "learningNotes": "Nắm chắc đại số, cần rèn thêm hình không gian",
  "classLearningNotes": {
    "class-2k9-h4": "Cần rèn thêm hình không gian"
  },
  "officeNotes": "Đã hoàn thành học phí tháng 11",
  "attendanceHistory": [],
  "seatingHistory": [],
  "scores": [],
  "sessionNotes": [],
  "makeupSessions": [],
  "updatedAt": 1730640000000,
  "revision": 3
}
```

### 4.2. Bản ghi Ca học (`SessionRecord`)

```json
{
  "id": "session-class-2k9-h4-2026-11-03",
  "classId": "class-2k9-h4",
  "classCode": "2K9.H4.GIANGNH",
  "className": "Toán 2K9 H4",
  "date": "2026-11-03",
  "status": "closed",
  "lessonTitle": "Phương trình lượng giác cơ bản",
  "homeworkAssignment": "Làm phiếu BT số 5 (Bài 1 đến Bài 8)",
  "homeworkLink": "https://drive.google.com/...",
  "notebookLink": "https://drive.google.com/...",
  "parentGeneralNote": "Phụ huynh nhắc con hoàn thành phiếu số 5 trước thứ Sáu.",
  "sessionNote": "Lớp học nghiêm túc, 2 bạn bàn cuối cần chú ý hơn.",
  "hasBtvn": true,
  "hasTest": true,
  "testHandover": {
    "person": "Anh Linh (TA001)",
    "at": 1730638800000
  },
  "layout": [],
  "deskItems": {},
  "studentsSnapshot": [],
  "stats": {
    "total": 25,
    "present": 23,
    "late": 1,
    "absent": 1,
    "homeworkDone": 22,
    "testsCollected": 24
  },
  "updatedAt": "2026-11-03T19:05:00.000Z",
  "revision": 12
}
```

---

## 5. MA TRẬN PHÂN QUYỀN BẢO MẬT (STRICT RBAC) & CÔ LẬP DỮ LIỆU HỌC SINH

1. **Tài khoản Trợ giảng (`assistant`) & Giáo viên (`teacher`):**
   * Chỉ nhìn thấy và truy cập các lớp mà mình được phân công phụ trách (`assignedClassIds`).
   * Trong hộp thoại Điểm danh (`#seat-dialog`), Điểm danh muộn (`#late-dialog`) và Danh sách học sinh của lớp (`#students-view`), bộ máy tìm kiếm **chỉ truy vấn danh sách học sinh thuộc biên chế lớp đang mở**.
   * Khi bấm nút **`+ Học sinh mới / Học bù`**, hệ thống **chỉ hiển thị Form nhập tay** (`Họ và tên`, `Trường học` hoặc `Học bù từ lớp nào`, `SĐT Phụ huynh`). **Nghiêm cấm** tự động gợi ý hay hiển thị danh sách học sinh của các lớp khác trong trung tâm.
   * Ẩn hoàn toàn menu `Danh bạ Học sinh toàn trung tâm`, `Hộp việc Văn phòng`, `Đồng bộ Google Sheets`, `Quản lý Nhân sự` và `Nhật ký Admin Log`.
2. **Tài khoản Văn phòng (`office`):**
   * Truy cập toàn bộ các lớp học, Danh bạ Học sinh toàn trung tâm, Phòng học & Sơ đồ mẫu.
   * Có quyền sử dụng **Hộp việc Cần xử lý của Văn phòng (`#office-inbox-panel`)**, công cụ **Khớp dữ liệu HS mới / Học bù với DS tổng**, công cụ **Đồng bộ Google Sheets đa khóa (`2K9`, `2K10`, `2K11`...)** và nút **Copy 1 chạm báo cáo gửi Phụ huynh (`Copy báo PH`)** trên từng dòng học sinh.
   * Không được truy cập mục Quản lý Nhân sự / Mật khẩu và Nhật ký Admin Log.
3. **Tài khoản Quản trị viên (`admin`):**
   * Toàn quyền trên toàn hệ thống, bao gồm Quản lý Nhân sự & Cấp/Đổi/Xem mật khẩu (`#mgmt-panel-staff`), khóa tài khoản nhân viên (tự động thu hồi phiên đăng nhập trên mọi thiết bị nhờ `authVersion`) và xem/xuất **Nhật ký Admin Log (`#mgmt-panel-admin-log`)**.

---

## 6. KIẾN TRÚC PHẢN HỒI 0ms (OPTIMISTIC UI), HÀNG ĐỢI OFFLINE/ONLINE & ĐỒNG BỘ FIREBASE

### 6.1. Cơ chế Phản hồi Tức thì $< 16\text{ ms}$ trên Máy Đang Thao Tác (Zero-Lag Optimistic UI)

Để loại bỏ hoàn toàn hiện tượng bấm vào ghế hoặc chọn tên học sinh phải đợi $1\text{–}2\text{ giây}$ mới hiện trên màn hình:

1. **Cập nhật Trực tiếp DOM Của Đúng Bàn Vừa Chạm (`patchDeskDOMImmediate(deskId)`):**
   * Ngay khi người dùng bấm nút `+` trên bàn, chọn tên học sinh, nhập điểm BTVN trong `#seat-dialog`, hoặc bấm `Điểm danh & Lưu BTVN`:
     1. Ghi ngay thay đổi vào đối tượng `deskItems[deskId]` trong RAM.
     2. Đóng ngay lập tức hộp thoại `#seat-dialog` / `#late-dialog` trong cùng 1 frame (`requestAnimationFrame`).
     3. Chỉ render lại HTML của đúng phần tử `.desk[data-desk-id="${deskId}"]` và cập nhật số đếm trên thanh `.attendance-banner`.
     4. Tuyệt đối không chạy vòng lặp đồng bộ toàn bộ mảng lịch sử học sinh hay render lại các tab đang ẩn (`#students-view`, `#scores-view`, `#report-view`) trong luồng sự kiện `click`.
2. **Lưu Trữ & Đồng Bộ Ngầm Bất Đồng Bộ (`scheduleBackgroundPersist()`):**
   * Sau khi giao diện đã cập nhật xong ($0\text{ ms}$), một tiến trình ngầm (debounce $250\text{ ms}$) mới thực hiện việc cập nhật `attendanceHistory`, `sessionNotes`, ghi vào `IndexedDB`/`LocalStorage` và đẩy bản tin Delta lên Firebase.

### 6.2. Thanh Trạng Thái Offline / Online & Hàng Đợi Đồng Bộ (`#sync-status-badge`)

Trên thanh Topbar của ứng dụng, hiển thị rõ ràng trạng thái kết nối và hàng đợi dữ liệu theo thời gian thực (sử dụng chấm tròn CSS `.rt-dot` và chữ thuần túy, không dùng emoji):

* **Trạng thái 1 — Trực tuyến & Đã đồng bộ (`state === 'synced'`):**
  * Chấm tròn xanh lá `#16a34a` + Nhãn: **`• Đã đồng bộ · 18:05:12`**.
* **Trạng thái 2 — Đang đẩy dữ liệu (`state === 'syncing'`):**
  * Chấm tròn xanh dương nhấp nháy `#2563eb` + Nhãn: **`• Đang đồng bộ (2)...`**.
* **Trạng thái 3 — Mất mạng / Ngoại tuyến (`state === 'offline'`):**
  * Viền cam nổi bật `#f59e0b`, nền vàng nhạt `#fffbeb`, chữ cam đậm `#92400e` + Nhãn: **`• Ngoại tuyến · Lưu tạm X thay đổi`**.
  * Mọi thao tác điểm danh, thu BTVN, nhập điểm khi rớt mạng đều được ghi vào `class_mgr.sync.offline_queue.v1` (trong cả `LocalStorage` và `IndexedDB`).
  * Ngay khi có mạng trở lại (sự kiện `window.ononline` hoặc kết nối lại Wi-Fi/4G), hệ thống tự động hợp nhất theo thuật toán **CRDT Timestamp/Revision Merge** (không ghi đè mất dữ liệu của máy khác) và đẩy toàn bộ hàng đợi lên Firebase, sau đó chuyển lại sang trạng thái **`• Đã đồng bộ`**.

---

## 7. ĐẶC TẢ NGHIỆP VỤ SƠ ĐỒ LỚP, THU BTVN, ĐIỂM DANH & CHẾ ĐỘ GIÁO VIÊN (`#seating-view`)

### 7.1. Quy tắc Hiển thị Sơ đồ Lớp & Phân Tách Rõ Chạm (Tap) vs. Kéo-Thả (Drag & Drop)

1. **Loại bỏ hoàn toàn khay kéo `#student-pool` ở trên sơ đồ.**
2. **Quy tắc Vàng về Thao tác Chạm (Tap) và Kéo-Thả (Drag & Drop) trên Sơ đồ lớp:**
   * **Thao tác Chạm / Nhấp chuột (Tap / Click với độ dịch chuyển $< 6\text{ px}$):**
     * Bấm vào bất kỳ ghế học sinh nào trên bàn (dù là ghế vô danh hay ghế đã có tên học sinh) **luôn luôn mở ngay Menu Điểm danh & BTVN (`#seat-dialog`)** — **hoạt động giống hệt nhau cả khi `Sửa sơ đồ: BẬT` lẫn khi `Sửa sơ đồ: TẮT`**.
     * Tuyệt đối **KHÔNG** dùng cơ chế "Tap-to-Move" trên các ghế ngồi trong bàn để không bao giờ cản trở việc bấm mở Menu Điểm danh.
   * **Hai trạng thái của nút công tắc `Sửa sơ đồ: BẬT / TẮT` (`#toggle-seating-edit-btn`):**
     * **Khi `Sửa sơ đồ: BẬT` (`isSeatingEditMode = true`):**
       * Hiển thị nút **`+`** (`.desk-add-compact-btn`) ở cột bên phải của mỗi bàn để bấm thêm biểu tượng học sinh vào bàn đó.
       * Hiển thị nút **`Thu BTVN`** (`.row-collect-hw-btn`) ở đầu mỗi dãy bàn (`DÃY 1`, `DÃY 2`, `DÃY 3`...).
       * Cho phép **Kéo - Thả (Drag & Drop)** (nhấn giữ và kéo $\ge 6\text{ px}$) để di chuyển ghế học sinh sang vị trí khác hoặc bàn khác, trong khi **bấm chạm (Tap $< 6\text{ px}$)** vào ghế vẫn mở ngay Menu Điểm danh (`#seat-dialog`).
     * **Khi `Sửa sơ đồ: TẮT` (`isSeatingEditMode = false`):**
       * **Ẩn hoàn toàn nút `+` ở tất cả các bàn** và **ẩn hoàn toàn nút `Thu BTVN` ở đầu các dãy**.
       * **Khóa kéo-thả các ghế đã có tên trên bàn** để chống trượt tay làm xô lệch sơ đồ khi đi lại trong lớp (nhưng vẫn cho phép kéo học sinh từ khu vực chờ Đi muộn `#late-area` ở cuối lớp vào bàn).
       * Chỉ hiển thị sơ đồ bàn ghế gọn gàng, sạch sẽ. Chạm vào ghế học sinh mở ngay Menu Điểm danh & BTVN (`#seat-dialog`).

### 7.2. Quy trình Chuẩn Đầu Giờ: Thu BTVN, Điểm Danh & Nhập Điểm Ngay Trên Sơ Đồ Lớp

1. **Bấm `+` tạo biểu tượng học sinh theo thực tế ngồi:**
   * Bàn 1 có 1 học sinh ngồi $\rightarrow$ bấm `+` 1 lần. Bàn 2 có 2 học sinh ngồi $\rightarrow$ bấm `+` 2 lần. Mỗi biểu tượng mới tạo hiển thị icon SVG người học sinh đơn sắc nét mảnh và có trạng thái mặc định là `Chưa thu BTVN` (`uncollected`).
2. **Đi thu BTVN từ đầu dãy xuống cuối dãy:**
   * Học sinh **KHÔNG có BTVN**: Bấm vào biểu tượng tại bàn đó $\rightarrow$ Mở `#seat-dialog` $\rightarrow$ Chọn tên học sinh $\rightarrow$ Chọn **`Chưa nộp`** + Lý do (`Chưa làm`, `Quên vở`, `Nghỉ buổi trước`) $\rightarrow$ Lưu. Học sinh được điểm danh `Có mặt` và gắn ký hiệu **`×`** màu đỏ.
   * Học sinh **CÓ nộp BTVN**: Chỉ cầm vở và để nguyên biểu tượng vô danh trên bàn, đi thu một mạch xuống cuối dãy rồi bấm nút **`Thu BTVN`** của dãy đó $\rightarrow$ Tất cả các biểu tượng đang ở trạng thái `Chưa thu` trong dãy lập tức chuyển sang **`Đã nộp` (`✓` màu xanh lá)**.
   * **Phát hiện học sinh mới vào sau:** Nếu lát sau quay lại bàn 1 thấy có thêm người thứ 2 ngồi vào, trợ giảng bấm `+` thêm 1 biểu tượng mới. Biểu tượng mới này mang trạng thái **`Chưa thu`** (viền vàng dấu `!`), giúp trợ giảng biết ngay bạn này mới vào chưa nộp BTVN.
3. **Điểm danh gán tên & Nhập điểm BTVN trực tiếp trong `#seat-dialog`:**
   * Trợ giảng đi từng bàn chạm vào các biểu tượng để gán tên học sinh (hoặc chạm vào từng học sinh trên sơ đồ lớp để nhập điểm BTVN ngay trên sơ đồ).
   * Trong hộp thoại `#seat-dialog` và `#late-dialog`, **ô nhập `Điểm BTVN (0 – 10)` luôn hiển thị ở cả trạng thái `Đã nộp` lẫn `Chưa nộp`** để học sinh không nộp đầu giờ vẫn có thể làm bù/gửi bù và được nhập điểm bình thường.

### 7.3. Chế độ Giáo viên Tập Trung (`Chế độ Giáo viên - Focused Teacher View`)

Khi Giáo viên đứng trên bục giảng và bấm nút **`Góc nhìn Giáo viên`** (`#teacher-view-button`):

1. **Đảo ngược Không gian 180 độ Chuẩn Bục Giảng:**
   * Thanh `BẢNG · ĐẦU LỚP` chuyển xuống **cạnh dưới màn hình**; khu vực `CUỐI LỚP` chuyển lên **cạnh trên màn hình**.
   * Thứ tự các dãy bàn (Trái $\leftrightarrow$ Phải) và thứ tự các bàn trong từng dãy (Trên $\leftrightarrow$ Dưới), kể cả thứ tự ghế trong từng bàn, đều được lật ngược 180 độ khớp chính xác với mắt nhìn của Giáo viên từ bục giảng nhìn xuống lớp.
2. **Thanh Lọc Nổi Bật "Học sinh Cần Gọi Bảng / Nhắc Nhở" (`Teacher Call-On Bar`):**
   * Ngay phía trên sơ đồ ở Chế độ Giáo viên, hiển thị thanh công cụ nhanh bằng các nút chữ thuần túy, rõ ràng (không dùng emoji):
     * `[Tất cả học sinh]`
     * `[Chưa nộp BTVN hôm nay (X)]` — Bấm vào sẽ làm sáng viền các ghế học sinh quên/chưa làm BTVN hôm nay.
     * `[Điểm thấp / Nợ bài buổi trước (Y)]` — Làm sáng các ghế học sinh có điểm $< 6,0$ hoặc nợ bài buổi trước.
     * `[Cảnh báo Mức 1–4 (Z)]` — Làm sáng các học sinh đang nằm trong diện cần kèm sát để Giáo viên ưu tiên gọi lên bảng hoặc kiểm tra vở tại chỗ.

---

## 8. ĐẶC TẢ CHẾ ĐỘ "CHÉP SỔ GIẤY", BỘ LỌC EXCEL, ẨN/HIỆN CỘT & NHẬP ĐIỂM (`#students-view` & `#scores-view`)

### 8.1. Chế độ "Chép Sổ Giấy" (`Paper Transcription Mode`) Trong Tab Danh Sách Học Sinh

Để giúp trợ giảng chép dữ liệu điểm danh và điểm số từ máy sang cuốn sổ điểm danh giấy của trung tâm nhanh và không bao giờ lệch dòng:

1. **Cấu trúc Bảng Tách Biệt 2 Phần Rõ Ràng (Khớp 100% Sổ Giấy):**
   * **Phần 1 (Ở trên) — Danh sách Học sinh Cố định của Lớp (`Fixed Class Roster`):**
     * Sắp xếp nghiêm ngặt theo chỉ số thứ tự sổ giấy `student.paperOrderIndex[classId]` (từ STT `1` đến hết danh sách in sẵn trên sổ giấy).
     * Bất kỳ thao tác điểm danh nào trên sơ đồ cũng **không làm thay đổi vị trí dòng** của học sinh trong danh sách này.
   * **Phần 2 (Ở cuối bảng, ngăn cách bằng thanh tiêu đề phụ) — Nhóm Học sinh Mới phát sinh & Học bù (`New & Make-up Students`):**
     * Tự động gom toàn bộ học sinh mới chưa có trong sổ in sẵn và học sinh học bù trong buổi hôm đó xuống phần cuối bảng, tương ứng đúng với phần ghi bổ sung bằng tay ở cuối trang sổ giấy.
2. **Hệ thống Ký hiệu Ngắn Gọn Chuẩn Sổ Điểm Danh Giấy (`Compact Paper Symbols`):**
   * Cột **Điểm danh (Sổ giấy)**:
     * Có mặt đúng giờ: **`✓`** (màu xanh lá đậm `#15803d`).
     * Đi muộn $X$ phút (ví dụ 15 phút): **`M15`** (màu cam đậm `#b45309`).
     * Vắng có phép: **`VP`** (màu xanh dương `#1d4ed8`).
     * Vắng không phép: **`KP`** (màu đỏ đậm `#b91c1c`).
     * Chưa điểm danh: **`—`** (màu xám `#94a3b8`).
   * Cột **BTVN & Điểm**:
     * Đã nộp (chưa chấm điểm): **`✓`**.
     * Không nộp BTVN: **`×`** (kèm ký hiệu nhỏ lý do: `× (Quên)`, `× (Chưa làm)`).
     * Có điểm BTVN: Hiển thị thẳng con số điểm định dạng dấu phẩy (ví dụ: **`8,5`**; nếu làm bù từ trạng thái không nộp thì hiện **`8,5 (Bù)`**).
   * Cột **Điểm Test**: Hiển thị con số chuẩn (ví dụ: **`9,0`**).
3. **Tính năng Khóa & Chỉnh sửa Vị trí STT Cố định theo Sổ Giấy (`Khóa STT / Sửa STT Sổ Giấy`):**
   * Khi bấm nút **`Sửa STT Sổ Giấy`**, cột STT cho phép nhập trực tiếp số thứ tự (`1, 2, 3...`) hoặc bấm nút `▲ / ▼` để di chuyển học sinh lên/xuống cho khớp tuyệt đối với quyển sổ giấy thực tế của lớp đó.
   * Khi bấm **`Khóa STT Sổ Giấy`**, vị trí từng học sinh được khóa cứng vào `paperOrderIndex[classId]` và đồng bộ lên Firebase cho mọi thiết bị cùng dùng.

### 8.2. Quản lý Cột Thông Minh (Đổi Vị Trí & Ẩn/Hiện Cột Như Excel) + Bộ Lọc Bảng

1. **Hộp thoại & Thanh Tùy chỉnh Cột (`#column-order-dialog`):**
   * Cho phép **Tích chọn Ẩn / Hiện** từng cột bằng checkbox chuẩn và **Kéo - Thả (hoặc bấm `Lên / Xuống`)** để đổi thứ tự cột.
   * Các Preset 1 chạm (nhãn chữ thuần túy, không dùng emoji):
     * `Chế độ Chép Sổ Giấy (Gọn nhất)`: Chỉ hiện `STT Sổ` | `Họ đệm` | `Tên` | `Điểm danh (✓/M15/VP/KP)` | `BTVN / Điểm` | `Điểm Test`.
     * `Đặt cột Điểm & BTVN sát cạnh Tên`: Đưa cột `Điểm BTVN` và `Điểm Test` nằm ngay sát cạnh cột `Tên`.
     * `Đầy đủ thông tin`: Hiện toàn bộ các cột (`Mã HS`, `Họ đệm`, `Tên`, `Trường`, `Vị trí ngồi`, `Điểm danh`, `BTVN`, `Điểm`, `Ghi chú`).

---

## 9. ĐẶC TẢ HỘP VIỆC VĂN PHÒNG (OFFICE ACTION INBOX), ĐỒNG BỘ GOOGLE SHEETS ĐA KHÓA & KHỚP HỒ SƠ

### 9.1. Hộp Việc Cần Xử Lý Của Văn Phòng (`Office Action Inbox`)

Dành riêng cho tài khoản **Văn phòng (`office`)** và **Admin (`admin`)**, hiển thị ngay tại trang Quản lý và có nút truy cập nhanh kèm Badge số đếm đơn giản trên thanh Topbar:

1. **Tab 1 — Học sinh Mới & Học bù Chờ Khớp Mã HS (`Pending TA Entries`):**
   * Tự động gom toàn bộ các học sinh Mới (nhãn `[Mới]`) và Học bù (nhãn `[Học bù]`) do Trợ giảng nhập tay ở tất cả các ca học mà chưa được gắn với `Mã HS` trong danh sách tổng.
   * Hiển thị đối chiếu trực quan:
     * **Bên trái:** Thông tin do Trợ giảng ghi nhận tại lớp (Họ tên, Lớp tham gia, Ngày học, Vị trí ghế, Điểm danh/Phút muộn, Trạng thái BTVN, Điểm BTVN/Test, Ghi chú).
     * **Bên phải:** Danh sách gợi ý thông minh các học sinh trong Danh bạ tổng / Google Sheets có tên, trường hoặc SĐT gần giống nhất.
   * Khi Văn phòng bấm **`Khớp & Gộp vào Hồ sơ gốc`**:
     * Nếu là **Học sinh mới** mà hồ sơ gốc trên Google Sheets đang ở lớp khác, hệ thống hỏi Văn phòng: `Chuyển sang lớp mới này (Bảo lưu lịch sử lớp cũ)` hay `Học song song cả 2 lớp`.
     * Toàn bộ dữ liệu buổi học do Trợ giảng nhập được đính chính xác vào hồ sơ gốc có `Mã HS` chuẩn, đồng thời xóa bản ghi tạm để không bao giờ bị trùng tên.
2. **Tab 2 — Thay đổi Lớp học & Học sinh Mới Phát hiện từ Google Sheets (`Pending Sheet Changes`):**
   * Gom toàn bộ các học sinh được hệ thống phát hiện có sự thay đổi cột `Mã lớp` trên Google Sheets (ví dụ học sinh xin chuyển từ lớp Thứ 5 sang lớp Thứ 3 trên Sheet) hoặc học sinh mới đăng ký trên Sheet chờ Văn phòng bấm **Duyệt**.

### 9.2. Đồng bộ Google Sheets Đa Khóa (`2K9`, `2K10`, `2K11`, `2K12`...) Bán Tự Động

1. **Quản lý Danh sách Nhiều Bảng Tổng Theo Từng Khóa (`Multi-Cohort Sheets Manager`):**
   * Cho phép cấu hình nhiều bảng Google Sheets tương ứng với từng khóa học sinh (`Khóa 2K9`, `Khóa 2K10`, `Khóa 2K11`, `Khóa 2K12`...). Mỗi khóa có thể là một link Spreadsheet riêng hoặc một `sheetName` / `gid` riêng.
   * Hỗ trợ nút **`Quét Tất Cả Các Khóa`** (hoặc quét từng khóa / dán nhanh `Ctrl+V` vùng dữ liệu từ Sheet).
2. **Quy tắc Duyệt Bán Tự Động & Bảo Toàn 100% Lịch Sử Học Sinh:**
   * Khi phát hiện học sinh đổi lớp trên Google Sheets, hệ thống hiển thị rõ trên Bảng Duyệt: **`Lớp gốc hiện tại (VD: TOAN9A) -> Lớp mới trên Sheet (VD: TOAN9B)`** kèm thông báo cho tài khoản Văn phòng / Admin.
   * Mặc định gắn tag **`Mới`** ở lớp chuyển đến (Văn phòng có thể tích/bỏ tích tag `Mới` ngay trên bảng duyệt trước khi bấm xác nhận).
   * Khi bấm **`✓ Duyệt & Cập nhật`**, hệ thống chuyển lớp cho học sinh, lưu lớp cũ vào `previousClassIds` & `classTransferHistory`, **giữ nguyên 100% dữ liệu điểm danh, điểm số, nhận xét ở lớp cũ** và tạo thông báo vào Nhật ký lớp học.

---

## 10. ĐẶC TẢ TAB BÁO CÁO BUỔI HỌC TRỰC QUAN (`#report-view`) & XUẤT GOOGLE DOCS / SHEETS / EXCEL / ZALO

### 10.1. Giao Diện Tab Chính `#report-view` (Không Dùng Cửa Sổ Pop-up, Không Dùng Emoji)

Tab **`Báo cáo buổi học`** nằm trực tiếp trên thanh điều hướng chính của ca học (`.class-view-tabs`), trình bày thành một Dashboard rộng rãi, nghiêm túc, dễ nhìn trên mọi màn hình:

1. **Khu vực 1 — Thanh Công Cụ Xuất Dữ Liệu & Khung Xem Trước Tin Nhắn Zalo:**
   * **Khung xem trước báo cáo gửi Giáo viên / Phụ huynh (`Zalo Live Preview`):** Hiển thị sẵn nội dung báo cáo buổi học được định dạng bằng gạch đầu dòng chuẩn (`•`, `-`), hoàn toàn không chứa emoji, cho phép sửa nhanh văn bản nếu cần và bấm **`Sao chép báo cáo gửi Giáo viên`** chỉ với 1 chạm.
   * **Nhóm nút Xuất File Chuẩn (Nhãn chữ rõ ràng, không dùng emoji):**
     * **`Xuất Excel (.xlsx) Chuẩn A4`**: Xuất file `.xlsx` theo đúng thứ tự cột đã chọn.
     * **`Xuất Google Docs / Word (.doc)`**: Tạo file tài liệu `.doc` chuẩn in A4 (có tiêu đề trung tâm, bảng thống kê, 5 bảng danh sách chi tiết và ô chữ ký Giáo viên / Trợ giảng) mở trực tiếp được trên cả Google Docs và Microsoft Word.
     * **`Đẩy lên Google Sheets / Sao chép Bảng Sheet`**: Đồng bộ ngược điểm danh & điểm số lên Google Sheets theo Mã HS hoặc copy TSV để dán thẳng vào Google Sheets.
     * **`In / Lưu PDF A4`** & **`Xuất Ảnh PNG Sơ đồ lớp`**.
2. **Khu vực 2 — Bảng Trực Quan Làm Nổi Bật 5 Nhóm Học Sinh Cần Chú Ý:**
   * Hiển thị ngay trên cùng một màn hình với tiêu đề rõ ràng và đường viền màu phân biệt nhẹ nhàng, chuyên nghiệp:
     1. **1. Học sinh VẮNG MẶT** (Phân loại Vắng có phép / Không phép, Lý do, SĐT Phụ huynh, nút `Sao chép báo PH`).
     2. **2. Học sinh ĐI MUỘN** (Giờ đến thực tế, Số phút đi muộn, Ghi chú, nút `Sao chép báo PH`).
     3. **3. Học sinh CHƯA NỘP BTVN** (Lý do chưa nộp, Điểm làm bù nếu có, nút `Sao chép báo PH`).
     4. **4. Học sinh ĐIỂM THẤP DƯỚI MỐC** (Có nút chọn nhanh mốc `< 5`, `< 6`, `< 7` hoặc tự gõ mốc điểm; hiển thị Điểm BTVN, Điểm Test và Nhận xét).
     5. **5. Học sinh HỌC BÙ & HỌC SINH MỚI** trong buổi học.
3. **Khu vực 3 — Bảng Điểm Danh Tổng Hợp Toàn Lớp & Biên Bản Bàn Giao Bài Kiểm Tra:**
   * Hiển thị bảng tổng hợp toàn bộ học sinh trong ca (theo đúng thứ tự Sổ Giấy hoặc A–Z) kèm thông tin người cầm bài kiểm tra về chấm.

---

## 11. ĐẶC TẢ CƠ CHẾ "ĐÓNG CA HỌC" (VẪN CHO PHÉP CHỈNH SỬA 100%), LỚP BỔ TRỢ, CHẤM CÔNG & NHẬT KÝ ADMIN

### 11.1. Cơ Chế "Đóng Ca Học" & Xem Lại Ca Học Trong Lịch Sử (Always-Editable Closed Sessions)

1. **Ý nghĩa của nút "Kết ca học & Lưu lịch sử" (`status === 'closed'`):**
   * Việc bấm **Đóng ca học** chỉ là bước xác nhận Trợ giảng đã hoàn thành các đầu việc tại lớp và chốt trạng thái ca học thành `✓ Đã đóng ca`.
   * **Tuyệt đối KHÔNG khóa giao diện ở chế độ "Chỉ đọc (Read-only)" sau khi đóng ca!**
2. **Toàn quyền chỉnh sửa sau khi đóng ca ($1\text{–}2\text{ ngày}$ sau hoặc bất kỳ lúc nào):**
   * Khi Trợ giảng / Giáo viên / Văn phòng mở lại một ca học đã đóng từ trang Tổng quan lớp (`#class-general-view`), mọi tính năng trong ca học đó vẫn hoạt động bình thường 100% giống hệt như khi ca đang mở:
     * Có thể mở Menu Điểm danh trên sơ đồ lớp hoặc vào tab **Nhập điểm (`#scores-view`)** để nhập/sửa điểm BTVN và điểm bài Test (sau khi trợ giảng mang bài về nhà chấm xong).
     * Có thể tích bổ sung hoặc sửa các mục trong tab **Checklist**, sửa **Tên bài học**, **Nội dung BTVN giao về nhà**, **Link tài liệu** hoặc **Ghi chú buổi học**.
     * Mọi chỉnh sửa trên ca đã đóng đều tự động lưu và cập nhật đồng bộ ngay lập tức vào cả bản ghi lịch sử ca học (`SessionRecord`) lẫn hồ sơ học tập của từng học sinh (`StudentRecord`) mà không cần phải bấm "Mở lại ca".

### 11.2. Tổng Quan Lớp, Lớp Bổ Trợ 1-1, Chấm Công TA & Nhật Ký Admin

1. **Màn hình Tổng quan Lớp (`#class-general-view`):**
   * **Tab Lịch sử các ca học:** Xem danh sách toàn bộ các buổi học của lớp, bấm vào bất kỳ buổi nào để xem/sửa trực tiếp sơ đồ, điểm danh, điểm số, checklist, hoặc thêm bổ sung ca học trong quá khứ.
   * **Tab Danh sách học sinh & Điểm 4 buổi gần nhất:** Hiển thị bảng tiến độ 4 buổi gần nhất (`Ngày | BTVN | TEST`) kèm hệ thống **Tag Cảnh báo sớm 4 mức (`Mức 1` đến `Mức 4`)** tự động đếm tổng số lỗi (Vắng, Đi muộn, Không nộp BTVN, Điểm $< 5$) trong 4 buổi gần nhất.
2. **Module Lớp Bổ trợ & Gia sư 1-kèm-1 (`#tutoring-menu-panel`):**
   * Ghi nhận các buổi học kèm bổ trợ, học bù riêng hoặc gia sư 1-1 và tự động đồng bộ vào hồ sơ học sinh.
3. **Module Chấm công Trợ giảng (`#portal-menu-panel`):**
   * Thống kê số ca làm việc hợp lệ, tổng số giờ làm và tỷ lệ hoàn thành checklist đầu giờ theo từng tháng (`Tháng MM/YYYY`), hỗ trợ xuất file `.xlsx` / in A4.
4. **Module Nhật ký Admin (`#mgmt-panel-admin-log` & `#session-admin-log-dialog`):**
   * Chỉ hiển thị với tài khoản `admin`. Ghi nhận đầy đủ thời gian chính xác tới giây, tên tài khoản, mã nhân viên, vai trò và chi tiết dữ liệu thay đổi của mọi thao tác (kể cả các chỉnh sửa thực hiện sau khi ca đã đóng), chia theo từng lớp và từng ca học.

---

## 12. LỘ TRÌNH TRIỂN KHAI & BỘ TIÊU CHÍ NGHIỆM THU TOÀN DIỆN (IMPLEMENTATION ROADMAP & COMPREHENSIVE DoD)

### 12.1. Thứ tự Thực thi Chuẩn cho AI Coding Agent

* **Phase 1 — Chuẩn hóa Core Storage, Naming Convention (`class_mgr.*`), Xóa Toàn Bộ Emoji & CSS Chống Đè Nút:**
  * Thiết lập bộ lưu trữ Hybrid RAM + IndexedDB + LocalStorage với tiền tố `class_mgr.*` (tự động migrate dữ liệu từ `lopvui.*`).
  * Xóa toàn bộ ký tự Emoji trong `index.html`, `src/app.js`, `src/features.js`; chỉ giữ văn bản thuần túy hoặc icon SVG nét mảnh đơn sắc (`currentColor`) ở những nút thực sự cần thiết.
  * Cập nhật CSS biến chuẩn, `tabular-nums`, `font-size: 16px` cho toàn bộ input, loại bỏ mọi `position: absolute` gây đè nút trên bàn học và hộp thoại.
* **Phase 2 — Tối ưu Sơ đồ Lớp Optimistic UI ($0\text{ ms}$), Bỏ `#student-pool`, Giữ Chạm Mở Điểm Danh & Kéo-Thả Đổi Chỗ:**
  * Xóa khay kéo `#student-pool`; cài đặt chế độ `Sửa sơ đồ: BẬT/TẮT` (khi BẬT: hiện nút `+`, hiện nút `Thu BTVN` cả dãy, cho phép Kéo-Thả đổi chỗ; khi TẮT: ẩn nút `+` và `Thu BTVN` dãy).
  * Đảm bảo **bấm chạm (Tap $< 6\text{ px}$) vào ghế luôn mở ngay `#seat-dialog`** ở cả 2 chế độ BẬT và TẮT `Sửa sơ đồ`.
  * Áp dụng `patchDeskDOMImmediate()` để mọi thao tác trên sơ đồ phản hồi tức thì $< 16\text{ ms}$.
  * Hoàn thiện `Chế độ Giáo viên` lật ngược 180 độ kèm thanh lọc nhanh học sinh nợ BTVN / điểm thấp / cảnh báo.
* **Phase 3 — Cho Phép Chỉnh Sửa 100% Khi Ca Đã Đóng, Xây dựng Chế độ "Chép Sổ Giấy" & Quản lý Cột Ẩn/Hiện:**
  * Gỡ bỏ mọi khóa "Chỉ đọc (Read-only)" trên các ca học đã đóng (`status: 'closed'`), cho phép sửa điểm, checklist, bài học, điểm danh bất kỳ lúc nào.
  * Thêm công tắc `Chế độ Chép Sổ Giấy` tách cố định Danh sách lớp ở trên (theo `paperOrderIndex` có thể khóa/sửa STT) và Học sinh mới/Học bù ở dưới, hiển thị ký hiệu chuẩn (`✓`, `M15`, `VP`, `KP`).
  * Nâng cấp `#column-order-dialog` cho phép tích ẩn/hiện cột và đổi vị trí cột như Excel.
* **Phase 4 — Khóa Bảo mật RBAC, Xây dựng Hộp việc Văn phòng & Đồng bộ Google Sheets Đa Khóa:**
  * Chặn hoàn toàn việc lộ danh sách học sinh lớp khác đối với tài khoản Trợ giảng/Giáo viên khi nhập Học sinh mới/Học bù.
  * Xây dựng **Hộp việc Cần xử lý của Văn phòng (`Office Action Inbox`)**, luồng khớp học sinh mới/học bù vào hồ sơ gốc và bộ đồng bộ Google Sheets đa khóa (`2K9`, `2K10`, `2K11`...) bán tự động.
* **Phase 5 — Chuyển Báo cáo thành Tab Chính (`#report-view`) & Thanh Trạng thái Offline/Online Queue:**
  * Đưa `Báo cáo buổi học` thành Tab chính trong màn hình ca học với 5 bảng cảnh báo trực quan, khung xem trước Zalo 1 chạm và xuất file `.doc` (Google Docs), `.xlsx`, Google Sheets.
  * Hiển thị thanh trạng thái Offline/Online kèm số thay đổi đang lưu trong hàng đợi trên Topbar.

---

### 12.2. Bộ Danh Sách Kiểm Tra Nghiệm Thu Toàn Diện (Comprehensive QA & Acceptance Criteria Checklist)

AI Coding Agent bắt buộc phải kiểm tra và đảm bảo vượt qua **toàn bộ 8 nhóm tiêu chí nghiệm thu** dưới đây trước khi bàn giao mã nguồn:

#### Nhóm 1: Giao diện, Font chữ, Trợ năng (WCAG AA), Không Emoji & Chống Chồng Chéo Nút (UI/UX & Layout)
- [ ] **1.1. Không Emoji 100% (Zero-Emoji):** Quét toàn bộ HTML, CSS, JavaScript, thông báo Toast và mẫu xuất báo cáo; đảm bảo không còn bất kỳ ký tự Emoji màu nào. Chỉ sử dụng chữ thuần túy kết hợp bộ ký hiệu chuẩn (`✓`, `×`, `+`, `—`, `/`, `•`) hoặc icon SVG nét mảnh đơn sắc (`stroke="currentColor"`, `fill="none"`) ở những nút công cụ nhỏ thực sự cần thiết.
- [ ] **1.2. Font chữ Tiếng Việt & Số thẳng cột (`tabular-nums`):** Tất cả chữ tiếng Việt có dấu hiển thị rõ nét, không lỗi dấu; toàn bộ cột STT, Mã HS, Điểm số, Sĩ số, Thời gian và Số phút muộn đều áp dụng `font-variant-numeric: tabular-nums` thẳng hàng từ trên xuống dưới.
- [ ] **1.3. Không tự động phóng to trên iOS/Android:** Tất cả các ô `input`, `select`, `textarea` có `font-size: 16px` và `touch-action: manipulation`, đảm bảo khi bấm vào ô tìm kiếm học sinh hoặc ô nhập điểm trên iPhone/Android màn hình không bị tự động zoom phông.
- [ ] **1.4. Không có nút nào đè lên nhau (Zero-Overlap):** Kiểm tra trên các kích thước màn hình `320px` (iPhone SE/6), `375px` (iPhone chuẩn), `768px` (iPad dọc), `1024px` (iPad ngang) và `1440px` (Laptop):
  - Nút `Sửa sơ đồ: BẬT/TẮT` nằm trên thanh ngang riêng, không đè lên thanh `BẢNG · ĐẦU LỚP`.
  - Nút `+` trên mỗi bàn nằm ở cột Grid riêng bên phải bàn, không bao giờ đè lên thẻ tên học sinh.
  - Nút đóng `×` của mọi hộp thoại nằm ở cột Grid riêng bên phải header, không đè lên tiêu đề hộp thoại.
  - Các ghế trong cùng một bàn luôn nằm trên **1 hàng ngang duy nhất** (`flex-wrap: nowrap`), không bị rớt dòng dọc.
- [ ] **1.5. Trợ năng & Điều hướng Bàn phím (Accessibility):** Mọi nút tương tác có kích thước chạm tối thiểu $40\text{ px}\times 40\text{ px}$ và đầy đủ `aria-label`; nhấn `Enter` trong ô tìm kiếm chọn ngay học sinh đầu tiên; nhấn `Enter` hoặc `ArrowDown`/`ArrowUp` trong bảng điểm di chuyển mượt giữa các dòng; nhấn `Escape` đóng hộp thoại; nhấn `Ctrl+Z` (hoặc nút `Hoàn tác`) khôi phục thao tác sơ đồ lớp vừa thực hiện.

#### Nhóm 2: Hiệu năng Phản hồi Tức thì ($< 16\text{ ms}$), Lưu trữ & Đồng bộ Thời gian thực / Ngoại tuyến
- [ ] **2.1. Phản hồi $0\text{ ms}$ trên máy đang thao tác (Optimistic UI):** Khi Trợ giảng bấm liên tiếp vào dấu `+` trên bàn, chọn học sinh trong `#seat-dialog`, bấm `Thu BTVN` cả dãy hoặc nhập điểm BTVN: hộp thoại đóng ngay lập tức và thẻ bàn (`.desk`) cập nhật giao diện trong $< 16\text{ ms}$ mà không phải chờ mã hóa toàn bộ danh sách hay chờ mạng phản hồi.
- [ ] **2.2. Không mất con trỏ khi đang gõ:** Khi thiết bị A đang gõ ghi chú hoặc nhập điểm trong bảng mà nhận được gói tin đồng bộ từ thiết bị B, giá trị của các học sinh khác tự động cập nhật nhưng ô `input`/`textarea` đang `focus` trên thiết bị A tuyệt đối không bị mất con trỏ hay xóa chữ đang gõ dở.
- [ ] **2.3. Hợp nhất Đa thiết bị Không Ghi Đè (CRDT & Tombstone Merge):** Khi 2 trợ giảng trên 2 máy cùng điểm danh 2 bàn khác nhau hoặc cùng sửa dữ liệu trong 1 ca học, hệ thống gộp chính xác theo từng `entryId`/`studentId` và `_updatedAt`. Khi một ghế hoặc học sinh bị xóa khỏi sơ đồ trên máy A, cơ chế `tombstones` đảm bảo ghế đó không bao giờ bị hồi sinh ngược từ bản lưu cũ của máy B.
- [ ] **2.4. Hoạt động Ngoại tuyến (Offline-First) & Vượt trần 5MB Safari:** Khi ngắt mạng Wi-Fi/4G, thanh trạng thái trên Topbar chuyển sang `• Ngoại tuyến · Lưu tạm X thay đổi`; mọi thao tác điểm danh, BTVN, nhập điểm vẫn lưu an toàn vào RAM + IndexedDB + LocalStorage. Ngay khi bật mạng lại, hệ thống tự động đẩy toàn bộ hàng đợi lên Firebase và báo `• Đã đồng bộ`.

#### Nhóm 3: Nghiệp vụ Sơ đồ Lớp, Thu BTVN Đầu Giờ, Điểm Danh & Đi Muộn (`#seating-view`)
- [ ] **3.1. Chế độ `Sửa sơ đồ: BẬT` và `Sửa sơ đồ: TẮT`:**
  - Đã loại bỏ hoàn toàn khay kéo `#student-pool` cũ ở phía trên sơ đồ.
  - Khi **`Sửa sơ đồ: BẬT`**: Hiện nút `+` ở mỗi bàn, hiện nút `Thu BTVN` ở đầu mỗi dãy bàn, cho phép **Kéo - Thả (Drag & Drop $\ge 6\text{ px}$)** để di chuyển ghế học sinh sang vị trí khác hoặc bàn khác.
  - Khi **`Sửa sơ đồ: TẮT`**: Ẩn toàn bộ nút `+` và nút `Thu BTVN` dãy, khóa kéo-thả ghế đã có tên trên bàn (nhưng vẫn cho phép kéo học sinh từ khu vực chờ Đi muộn `#late-area` vào bàn).
- [ ] **3.2. Chạm (Tap $< 6\text{ px}$) Luôn Mở Menu Điểm Danh (`#seat-dialog`):** Bấm chạm vào bất kỳ ghế nào trên bàn luôn mở ngay hộp thoại `#seat-dialog` **cả khi đang BẬT lẫn khi đang TẮT `Sửa sơ đồ`**.
- [ ] **3.3. Quy trình Đi thu BTVN từ trên xuống:**
  - Bấm `+` tạo biểu tượng học sinh vô danh (trạng thái mặc định `Chưa thu`).
  - Với học sinh **không nộp BTVN**: Bấm vào biểu tượng $\rightarrow$ chọn tên học sinh $\rightarrow$ chọn `Chưa nộp` + Lý do (`Chưa làm`, `Quên vở`, `Nghỉ buổi trước`) $\rightarrow$ Lưu; ghế hiển thị tên học sinh (đã điểm danh `Có mặt`) kèm ký hiệu `×` đỏ.
  - Với học sinh **có nộp BTVN**: Đi thu xuống cuối dãy bấm nút `Thu BTVN` của dãy $\rightarrow$ toàn bộ ghế đang `Chưa thu` trong dãy (kể cả ghế vô danh chưa gắn tên) chuyển sang `Đã nộp` (`✓` xanh), tuyệt đối không làm thay đổi các ghế đã đánh dấu `Chưa nộp`.
  - Với học sinh **mới vào lớp sau khi đã thu**: Bấm `+` thêm biểu tượng mới vào bàn $\rightarrow$ biểu tượng mới giữ trạng thái `Chưa thu` (hiện cảnh báo `!` vàng) để trợ giảng biết ngay học sinh này chưa nộp BTVN.
  - Khi gán tên học sinh vào ghế vô danh đã được đánh dấu `Đã nộp` trước đó, học sinh tự động nhận luôn trạng thái `Đã nộp BTVN` của ghế đó.
- [ ] **3.4. Nhập điểm BTVN ở cả trạng thái `Đã nộp` và `Chưa nộp`:** Trong cả `#seat-dialog` và `#late-dialog`, khi chọn trạng thái `Chưa nộp`, ô nhập `Điểm BTVN (0 – 10)` vẫn hiển thị đầy đủ để trợ giảng nhập điểm khi học sinh làm bù/gửi bù (tự động ghi nhận điểm nhưng vẫn giữ lịch sử quên bài đầu giờ).
- [ ] **3.5. Điểm danh muộn & Tự động tính số phút muộn (`#late-dialog` & `#late-area`):**
  - Tự động tính số phút đi muộn = `Giờ đến thực tế` trừ `Giờ bắt đầu ca học` (nếu đến trước hoặc đúng giờ thì số phút muộn = `0`, ghi nhận `Đúng giờ · Chờ xếp chỗ`). Cho phép sửa trực tiếp số phút muộn hoặc giờ đến bất kỳ lúc nào.
  - Học sinh sau khi lưu ở `#late-dialog` sẽ hiển thị ở khu vực `CUỐI LỚP` (`#late-area`) kèm nhãn phút muộn, trạng thái BTVN và nút sửa nhanh. Khi kéo học sinh từ `CUỐI LỚP` vào bàn, toàn bộ trạng thái điểm danh, số phút muộn, BTVN, điểm số và ghi chú đi theo vào đúng ghế đó.
- [ ] **3.6. Vạch ngăn cách bàn & Kế thừa chỗ ngồi buổi trước:**
  - Hiển thị đúng vạch phân cách ngang giữa 2 bàn trên-dưới theo cấu hình riêng của từng dãy.
  - Nút `Xếp chỗ theo buổi trước` tự động đặt học sinh vào đúng vị trí bàn của buổi học liền trước (với trạng thái `Có mặt · Chưa thu BTVN`).
- [ ] **3.7. Chế độ Giáo viên (`Góc nhìn Giáo viên`):** Lật ngược 180 độ toàn bộ sơ đồ lớp (Bảng ở dưới, Cuối lớp ở trên, đảo chiều các dãy Trái-Phải và ghế Trái-Phải) kèm thanh lọc làm nổi bật nhanh các học sinh `Chưa nộp BTVN hôm nay`, `Điểm thấp / Nợ bài buổi trước` và `Cảnh báo Mức 1–4`.

#### Nhóm 4: Bảo mật Phân quyền (Strict RBAC) & Luồng Học sinh Mới / Học bù
- [ ] **4.1. Bảo mật Đăng nhập & Thu hồi Phiên tức thì:** Đăng nhập bằng Mã nhân viên và Mật khẩu; không hiển thị danh sách tài khoản trên màn hình đăng nhập. Khi Admin đổi mật khẩu, đổi vai trò hoặc khóa tài khoản (`Tạm khóa`), mọi thiết bị đang đăng nhập tài khoản đó tự động bị thu hồi phiên và đưa về màn hình đăng nhập.
- [ ] **4.2. Cô lập Dữ liệu theo Lớp Phụ Trách:** Tài khoản Trợ giảng (`assistant`) và Giáo viên (`teacher`) chỉ nhìn thấy các lớp mình được phân công và chỉ tìm kiếm được học sinh thuộc đúng lớp đang mở. Không thể xem Danh bạ Học sinh toàn trung tâm hay học sinh của các lớp khác.
- [ ] **4.3. Form Nhập tay Học sinh Mới / Học bù (Không lộ dữ liệu trung tâm):** Khi Trợ giảng bấm `+ Học sinh mới / Học bù` trong `#seat-dialog` hoặc `#late-dialog`, chỉ hiển thị form nhập tay (`Họ và tên`, `Trường học` / `Lớp gốc`, `Tên/SĐT Phụ huynh`). Tự động gắn tag `Mới` và ghi chú buổi học `Học sinh mới` cho học sinh mới tạo.
- [ ] **4.4. Xóa học sinh khỏi ghế (`#clear-seat`) & Đồng bộ Bất biến Sơ đồ $\leftrightarrow$ Điểm danh:**
  - Khi bấm nút thùng rác xóa học sinh khỏi ghế, hiển thị hộp thoại xác nhận rõ ràng.
  - Nếu là học sinh chính thức của lớp: xóa khỏi ghế và tự động đưa trạng thái buổi hôm đó về `Chưa điểm danh` (nhưng giữ nguyên 100% lịch sử các buổi trước).
  - Nếu học sinh không có trên sơ đồ nhưng đã được Văn phòng đánh dấu `Vắng có phép` hoặc `Vắng không phép`: giữ nguyên trạng thái Vắng đó.
  - Nếu là bản ghi tạm (Học sinh mới / Học bù do Trợ giảng vừa tạo trong buổi): xóa khỏi sơ đồ và xóa sạch bản ghi tạm khỏi cơ sở dữ liệu.

#### Nhóm 5: Chế độ "Chép Sổ Giấy", Bộ lọc Bảng, Ẩn/Hiện Cột & Bảng Nhập điểm (`#students-view` & `#scores-view`)
- [ ] **5.1. Chế độ "Chép Sổ Giấy" (`Paper Transcription Mode`):**
  - Tự động tách bảng thành **2 phần cố định**: Phần trên là Danh sách học sinh cố định của lớp xếp đúng theo thứ tự `paperOrderIndex` của sổ giấy (tuyệt đối không nhảy dòng khi điểm danh hay nhập điểm); Phần dưới cùng là nhóm Học sinh Mới phát sinh & Học bù trong buổi.
  - Cho phép mở khóa chỉnh sửa STT Sổ Giấy (`1, 2, 3...` hoặc đẩy Lên/Xuống) và bấm `Khóa STT Sổ Giấy` để lưu cố định cho lớp đó.
  - Hiển thị đúng ký hiệu ngắn gọn chuẩn sổ giấy: `✓` (Có mặt), `M15` (Đi muộn 15 phút), `VP` (Vắng có phép), `KP` (Vắng không phép), `—` (Chưa điểm danh), `×` (Không nộp BTVN), điểm số định dạng dấu phẩy (`8,5`).
- [ ] **5.2. Đổi vị trí cột & Ẩn/Hiện cột như Excel (`#column-order-dialog`):** Cho phép tích checkbox Ẩn/Hiện từng cột và đổi thứ tự cột linh hoạt (có nút đặt nhanh cột `Điểm & BTVN` sát cạnh cột `Tên`). Thứ tự cột được áp dụng đồng bộ cho cả bảng trên màn hình lẫn khi xuất file Excel (`.xlsx`).
- [ ] **5.3. Bảng Nhập điểm (`#scores-view`) & Nhập điểm Excel theo Mã HS:**
  - Sắp xếp thông minh hoặc theo thứ tự sổ giấy; hỗ trợ bật/tắt cột `Điểm Test` (đồng bộ với mục `Ca này có test` bên tab Checklist).
  - Bấm vào ô `Điểm 4 bài gần nhất` mở ngay hộp thoại chi tiết lịch sử điểm, trạng thái đi học và tên bài học từng buổi trước của học sinh đó.
  - Hỗ trợ xuất file mẫu Excel và nhập điểm hàng loạt bằng file `.xlsx` hoặc dán `Ctrl+V` 2 cột `Mã HS + Điểm` (tự động chuyển trạng thái BTVN từ `Chưa thu` sang `Đã nộp` khi có điểm).

#### Nhóm 6: Đóng Ca Học Không Khóa Dữ Liệu (Always-Editable Sessions), Checklist & Chấm công TA
- [ ] **6.1. Checklist Buổi học & Chấm công Cá nhân Trợ giảng:**
  - Tích hoàn thành mục đầu tiên trong Checklist đầu giờ (hoặc bấm nút xác nhận đi làm) tự động ghi nhận giờ bắt đầu ca và cộng ca làm việc vào bảng **Chấm công của tôi (`#portal-menu-panel`)**.
  - Tự động lưu khi gõ: `Tên bài học hôm nay`, `Ghi chú buổi học (nội bộ)`, `Ghi chú chung gửi phụ huynh`, `Nội dung BTVN giao về nhà`, `Link vở ghi`, `Link phiếu BTVN` và `Tên trợ giảng cầm bài về chấm`.
  - Tự động nhận diện `Buổi này không có BTVN` nếu buổi liền trước không giao BTVN (và cho phép bật/tắt thủ công).
- [ ] **6.2. Ca Đã Đóng Vẫn Chỉnh Sửa Được 100% (Always-Editable Closed Sessions):**
  - Khi bấm `Kết ca học & Lưu lịch sử`, hệ thống kiểm tra và liệt kê các mục còn sót (như ghế vô danh chưa gắn tên, học sinh chưa tích BTVN, chưa nhập tên bài học) để trợ giảng rà soát trước khi xác nhận đóng ca.
  - Sau khi ca đã chuyển sang trạng thái `✓ Đã đóng ca` (hoặc khi mở lại ca học cũ từ lịch sử $1\text{–}2\text{ ngày}$ sau), Trợ giảng / Giáo viên / Văn phòng **vẫn sửa được 100% mọi thông tin** (nhập bổ sung điểm Test/BTVN sau khi chấm xong, sửa điểm danh, sửa checklist, sửa tên bài học, thêm ghi chú) mà không bị khóa Read-only. Mọi chỉnh sửa tự động cập nhật vào cả lịch sử ca học lẫn hồ sơ học sinh.
- [ ] **6.3. Quản lý Ca học Quá khứ & Xóa Ca học:** Cho phép thêm bổ sung ca học trong quá khứ, sửa thông tin/ngày học của ca cũ, hoặc xóa ca học (xóa sạch dữ liệu buổi học đó khỏi hồ sơ học sinh nhưng vẫn lưu vết thao tác trong Nhật ký Admin Log).

#### Nhóm 7: Hộp việc Văn phòng (Office Action Inbox), Đồng bộ Google Sheets Đa Khóa & Chuyển Lớp
- [ ] **7.1. Hộp việc Cần xử lý của Văn phòng (`Office Action Inbox`) & Khớp Hồ sơ:**
  - Tự động gom toàn bộ Học sinh mới & Học bù do Trợ giảng nhập tay trong các ca học để Văn phòng kiểm tra và bấm `Khớp & Lưu dữ liệu` vào đúng học sinh trong Danh sách tổng (tự động đẩy các hồ sơ trùng tên / SĐT phụ huynh / trường lên đầu danh sách gợi ý).
  - Sau khi bấm khớp: toàn bộ vị trí ngồi, trạng thái điểm danh, phút muộn, BTVN, điểm BTVN/Test và ghi chú của buổi học đó được gộp nguyên vẹn vào hồ sơ gốc có `Mã HS` chuẩn, đồng thời xóa bản ghi tạm do Trợ giảng tạo.
  - Nếu là Học sinh mới mà hồ sơ gốc đang ở lớp khác, hiển thị hộp thoại hỏi Văn phòng: `Chuyển lớp sang lớp mới này (Bảo lưu dữ liệu lớp cũ)`, `Thêm học song song cả 2 lớp`, hoặc `Chỉ đính dữ liệu buổi học`.
- [ ] **7.2. Đồng bộ Google Sheets Đa Khóa (`2K9`, `2K10`, `2K11`, `2K12`...) Bán Tự Động:**
  - Hỗ trợ cấu hình và quét dữ liệu từ nhiều bảng Google Sheets theo từng khóa (qua Link Google Sheets công khai, qua Google Apps Script Web App URL, qua tải file `.xlsx`/`.csv`, hoặc dán trực tiếp `Ctrl+V`).
  - Tự động đối chiếu theo `Mã HS` (và tên + SĐT) để phát hiện 3 nhóm cần duyệt: `Học sinh mới`, `Khác lớp gốc (Chuyển lớp)` và `Cập nhật Mã HS / Thông tin`.
  - Trên bảng duyệt của Văn phòng: mặc định gắn tag `Mới` cho học sinh mới và học sinh chuyển lớp, nhưng có nút tích chọn/bỏ chọn tag `Mới` cho từng em hoặc tất cả trước khi bấm `✓ Duyệt & Cập nhật`.
- [ ] **7.3. Bảo toàn 100% Dữ liệu Học sinh khi Chuyển lớp:** Khi học sinh chuyển từ lớp A sang lớp B (qua duyệt Google Sheets hoặc qua nút `Chuyển lớp`), mã lớp A được chuyển vào `previousClassIds` & `classTransferHistory`. Khi mở Hồ sơ học sinh theo lớp (`#student-class-profile-dialog`), vẫn hiển thị tab `Lớp cũ` để xem lại đầy đủ 100% lịch sử điểm danh, điểm BTVN/Test và nhận xét tại lớp A.

#### Nhóm 8: Tab Báo cáo Buổi học Trực quan (`#report-view`), Xuất Dữ liệu & Nhật ký Admin (`Admin Audit Log`)
- [ ] **8.1. Tab Báo cáo Chính Trực quan (`#report-view` — Không dùng Pop-up):**
  - Nằm trực tiếp trên thanh tab chính của ca học, hiển thị rõ 5 bảng cảnh báo trực quan: `1. Học sinh Vắng mặt`, `2. Học sinh Đi muộn`, `3. Học sinh Chưa nộp BTVN`, `4. Học sinh Điểm thấp dưới mốc` (cho phép chọn nhanh mốc `< 5`, `< 6`, `< 7` hoặc nhập mốc bất kỳ) và `5. Học sinh Học bù & Học sinh mới`.
- [ ] **8.2. Copy Báo cáo Zalo 1 Chạm (Gửi Giáo viên & Gửi Phụ huynh):**
  - Nút `Sao chép báo cáo gửi Giáo viên` tạo bản tổng hợp đầy đủ (thông tin lớp, bài học, link BTVN/vở ghi, sĩ số, 5 danh sách chi tiết kèm lý do và ghi chú) bằng văn bản thuần túy, sạch đẹp, không chứa emoji.
  - Nút `Copy báo PH` (trên từng dòng học sinh ở bảng danh sách lớp của tài khoản Văn phòng, trong hồ sơ buổi học và trong tab Báo cáo) tạo đúng mẫu tin nhắn gửi Phụ huynh của riêng học sinh đó (tự động ẩn các dòng trống, đính kèm ghi chú chung gửi phụ huynh ở cuối tin nhắn).
- [ ] **8.3. Xuất Đa Định Dạng Chuẩn A4:**
  - Xuất file Excel (`.xlsx`) chuẩn OpenXML mở trực tiếp trên Microsoft Excel / Google Sheets không lỗi font tiếng Việt.
  - Xuất file Google Docs / Word (`.doc`) và chế độ In / Lưu PDF chuẩn trang A4 ngang có đầy đủ bảng điểm danh và ô chữ ký Trợ giảng / Giáo viên.
  - Xuất ảnh PNG Sơ đồ lớp (`#seating-snapshot-dialog`) tự động căn vừa khít 1 khung hình (không cần cuộn), hiển thị rõ tên, tag `#Mới`, phút đi muộn (`Muộn 15p`), điểm/trạng thái BTVN, nhãn `[BÙ]` và chú thích ký hiệu bên dưới.
- [ ] **8.4. Nhật ký Admin Log (`#mgmt-panel-admin-log` & `#session-admin-log-dialog`):**
  - Chỉ hiển thị duy nhất cho tài khoản có vai trò `admin` (ẩn tuyệt đối với `office`, `teacher`, `assistant`).
  - Ghi nhận đầy đủ mọi thao tác tác động lên dữ liệu (điểm danh, thu BTVN, nhập/sửa điểm, đổi chỗ, sửa checklist, mở/đóng/sửa/xóa ca học, chuyển lớp, duyệt Google Sheets) kèm thời gian chính xác tới giây (`DD/MM/YYYY HH:mm:ss`), Tên tài khoản, Mã nhân viên và Vai trò.
  - Phân nhóm khoa học theo từng Lớp học và từng Ca học trong lớp, hỗ trợ lọc theo Lớp, Ca học, Tài khoản, từ khóa và xuất ra file `.txt` / `.xlsx`.
# UNIVERSAL GITHUB SPEC KIT: ĐẶC TẢ KIẾN TRÚC, GIAO DIỆN, ĐỒNG BỘ & NGHIỆP VỤ TOÀN DIỆN (`class_mgr` / `edu_center` v5.7)

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
13. [Phần Bổ Sung Đặc Tả Chi Tiết (Cập Nhật Mới Nhất & Toàn Diện v6.4)](#phần-bổ-sung-đặc-tả-chi-tiết-cập-nhật-mới-nhất)
    - 13.1. [Cơ chế Tự động Nhận diện & Đồng bộ Trạng thái "Nghỉ" từ Google Sheets](#1-cơ-chế-tự-động-nhận-diện--đồng-bộ-trạng-thái-nghỉ-từ-google-sheets)
    - 13.2. [Đồng bộ 2 Chiều Cột Tag Phân Loại với Google Sheets](#2-đồng-bộ-2-chiều-cột-tag-phân-loại-với-google-sheets)
    - 13.3. [Bảng Danh Bạ Toàn Trung Tâm: Bộ Lọc Đa Cột & Thao Tác Hàng Loạt Nâng Cao](#3-bảng-danh-bạ-toàn-trung-tâm-bộ-lọc-đa-cột--thao-tác-hàng-loạt-nâng-cao)
    - 13.4. [Đặc Tả Lớp Bổ Trợ & Gia Sư 1-1](#4-đặc-tả-lớp-bổ-trợ--gia-sư-1-1-hiển-thị-dạng-ca-học-bù-ẩn-khỏi-danh-bạ-tổng)
    - 13.5. [Mở Hồ Sơ Học Sinh Trong Buổi Học Từ Danh Sách Học Sinh & Nhập Điểm](#5-mở-hồ-sơ-học-sinh-trong-buổi-học-session-profile-từ-danh-sách-học-sinh--nhập-điểm)
    - 13.6. [Quy Trình Đóng Ca & Mở Lại Ca Học, Nút Header & Đồng Bộ Tức Thì](#6-quy-trình-đóng-ca--mở-lại-ca-học-nút-header--đồng-bộ-tức-thì)
    - 13.7. [Điều Hướng Thẻ Lớp Tại Tab "Đi Làm": Mở Trang Quản Lý Chung](#7-điều-hướng-thẻ-lớp-tại-tab-đi-làm-mở-trang-quản-lý-chung-general-view)
    - 13.8. [Quy Ước Đồng Bộ & Lọc Trạng Thái Học Sinh (Trạng Thái Trống = 'Nghỉ')](#8-quy-ước-đồng-bộ--lọc-trạng-thái-học-sinh-trạng-thái-trống--nghỉ-mặc-định-chỉ-hiện-học)
    - 13.9. [Cơ Chế Đồng Bộ & Cập Nhật 2 Chiều với Google Sheets](#9-cơ-chế-đồng-bộ--cập-nhật-2-chiều-với-google-sheets-two-way-sync--in-place-editing)
    - 13.10. [Khắc Phục Lỗi Quản Lý Tài Khoản, Dropdown Nhân Sự & Hiển Thị Lớp Phân Quyền](#10-khắc-phục-lỗi-quản-lý-tài-khoản-dropdown-nhân-sự--hiển-thị-lớp-học-theo-phân-quyền)
    - 13.11. [Màn Hình Trung Tâm Đồng Bộ Google Sheets Chuyên Biệt (`#mgmt-panel-sheets`)](#11-màn-hình-trung-tâm-đồng-bộ-google-sheets-chuyên-biệt-dedicated-google-sheets-hub-mgmt-panel-sheets-thay-vì-cửa-sổ-pop-up)
    - 13.12. [Hộp Thoại Hỏi Xác Nhận Đồng Bộ Ngược Lên Sheet Khi Có Chỉnh Sửa Trên Web](#12-hộp-thoại-hỏi-xác-nhận-đồng-bộ-ngược-lên-google-sheet-khi-có-chỉnh-sửa-trên-web-confirm-reverse-sheets-sync-dialog)
    - 13.13. [Nút & Cơ Chế Đẩy Dữ Liệu Buổi Học Lên Google Sheet (Điểm Danh Kèm Link Web, BTVN, Test, Ghi Chú)](#13-nút--cơ-chế-đẩy-dữ-liệu-buổi-học-lên-google-sheet-điểm-danh-có-link-web-btvn-có-cú-pháp-cụ-thể-điểm-test-ghi-chú)
    - 13.14. [Phân Quyền Nghiêm Ngặt & Cơ Chế Đồng Bộ Bán Tự Động (Strict RBAC & Semi-Auto Sync)](#14-phân-quyền-nghiêm-ngặt--cơ-chế-đồng-bộ-bán-tự-động-semi-automatic-access-control)

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
    "name": "Chị Hương"
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
    "person": "Nguyễn Thành Công (CONGNT)",
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
   * Khi bấm nút **`+ Học sinh mới / Học bù`**, hệ thống **chỉ hiển thị Form nhập tay** (`Họ và tên`, `Trường học` hoặc `Học bù từ lớp nào`, `Tên Phụ huynh`). **Nghiêm cấm** tự động gợi ý hay hiển thị danh sách học sinh của các lớp khác trong trung tâm.
   * **Danh bạ Học sinh (`#mgmt-tab-students`):** Ẩn hoàn toàn đối với Trợ giảng (`assistant`); cho phép Giáo viên (`teacher`) truy cập nhưng **chỉ hiển thị các học sinh thuộc các lớp Giáo viên đó phụ trách**.
   * Ẩn hoàn toàn `Hộp việc Văn phòng`, `Đồng bộ Google Sheets`, `Quản lý Nhân sự` và `Nhật ký Admin Log`.
2. **Tài khoản Văn phòng (`office`):**
   * Truy cập toàn bộ các lớp học, Danh bạ Học sinh toàn trung tâm, Phòng học & Sơ đồ mẫu.
   * Có quyền sử dụng **Hộp việc Cần xử lý của Văn phòng (`#office-inbox-panel`)**, công cụ **Khớp dữ liệu HS mới / Học bù với DS tổng**, công cụ **Đồng bộ Google Sheets đa khóa (`2K9`, `2K10`, `2K11`...)** và nút **Copy 1 chạm báo cáo gửi Phụ huynh (`Copy báo PH`)** trên từng dòng học sinh.
   * Không được truy cập mục Quản lý Nhân sự / Mật khẩu và Nhật ký Admin Log.
3. **Tài khoản Quản trị viên (`admin`):**
   * Toàn quyền trên toàn hệ thống, bao gồm Quản lý Nhân sự & Cấp/Đổi/Xem mật khẩu (`#mgmt-panel-staff`), khóa tài khoản nhân viên (tự động thu hồi phiên đăng nhập trên mọi thiết bị nhờ `authVersion`) và xem/xuất **Nhật ký Admin Log (`#mgmt-panel-admin-log`)**.

### 5.2. Cơ chế Xác thực Nâng cao Firebase Authentication Server-Side & Khóa Database Rules

Để bảo vệ tuyệt đối cơ sở dữ liệu trên Firebase Realtime Database và ngăn chặn hoàn toàn việc rò rỉ dữ liệu hoặc can thiệp trái phép:

1. **Khóa Chặt Quy tắc Bảo mật Realtime Database (`auth != null`):**
   * Chuyển đổi toàn bộ quy tắc database từ chế độ truy cập mở (`.read: true, .write: true`) sang yêu cầu xác thực nghiêm ngặt:
     ```json
     {
       "rules": {
         "lopvui_cloud_v3": {
           ".read": "auth != null",
           ".write": "auth != null"
         }
       }
     }
     ```
   * Mọi yêu cầu REST hoặc WebSocket chưa đăng nhập đều bị máy chủ Firebase từ chối ngay lập tức với mã lỗi `401 Unauthorized / Permission denied`.
2. **Cơ chế Ánh xạ Email Định danh Nội bộ (`.tct@gmail.com`):**
   * Người dùng không cần nhớ hay nhập địa chỉ email dài dòng. Trên giao diện Đăng nhập, nhân sự chỉ cần nhập **Mã nhân viên (Username)** (ví dụ: `AD001`, `CONGNT`, `GIANGNH`) và **Mật khẩu**.
   * Hệ thống tự động chuyển đổi ngầm thông qua hàm chuẩn hóa `codeToAuthEmail(rawCode)` trong `src/data/firebase-auth.js`:
     $$\text{Email Firebase} = \text{lowercase}(\text{staffCode}) + \text{".tct@gmail.com"}$$
     *(Ví dụ: mã `CONGNT` $\rightarrow$ email `congnt.tct@gmail.com`, mã `AD001` $\rightarrow$ email `ad001.tct@gmail.com`)*.
3. **Tự động Cấp Tài khoản Firebase Authentication khi Tạo Nhân sự Mới:**
   * Trong module Quản lý Nhân sự, khi Quản trị viên (`admin`) thêm một nhân viên mới, hệ thống tự động gọi `createStaffAuthAccount(code, password)` để khởi tạo đồng thời tài khoản trên Firebase Authentication, đảm bảo nhân sự mới có thể đăng nhập ngay mà không cần thao tác thủ công trên Firebase Console.
4. **Cơ chế Đổi Mật Khẩu Tự Phục Vụ Trực Tiếp Trên Web (`updateSelfPassword`):**
   * Nhân viên có thể tự đổi mật khẩu cá nhân trực tiếp trên giao diện web. Hệ thống đồng bộ 2 chiều:
     1. Cập nhật mật khẩu mã hóa trên Firebase Authentication thông qua `updatePassword(auth.currentUser, newPassword)`.
     2. Băm mật khẩu bằng PBKDF2/SHA-256 (`hashStaffPassword`) và lưu vào danh mục nhân sự `masterData.employees` trên đám mây, đảm bảo tính nhất quán giữa cơ sở dữ liệu và hệ thống xác thực máy chủ.

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

### 6.3. Chuyển Đổi Sang Firebase Realtime Database Web SDK Chính Thức (Thay Thế REST EventSource)

Để giải quyết bài toán cốt tử về thời gian sống của token xác thực và sự ổn định của kết nối thời gian thực:

1. **Vấn đề của REST EventSource Cũ (Token Expiration sau 1 giờ):**
   * Trong phương án REST EventSource truyền thống, Firebase ID Token được đính kèm vào URL (`?auth=<token>`). Token này bắt buộc hết hạn sau đúng 60 phút. Khi đó, kết nối EventSource tự động ngắt và khi kết nối lại sẽ bị từ chối với lỗi `401 Unauthorized` / `403 Forbidden`.
2. **Giải pháp Realtime Database Web SDK v10 Modular (`src/data/firebase-auth.js`):**
   * Ứng dụng nạp trực tiếp SDK chính thức từ Google CDN (`https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js`), sử dụng giao thức WebSocket 2 chiều có kiểm soát:
     * `onValue(ref, callback)`: Lắng nghe thay đổi biến động đám mây qua WebSocket thời gian thực.
     * `update(ref, data)` & `get(ref)`: Thực hiện các lệnh đẩy hoặc tải dữ liệu an toàn.
   * **Tự động làm mới Token ngầm (Automatic Token Refresh):** SDK tự động xử lý việc làm mới Firebase ID Token trong nền mà không làm gián đoạn kết nối WebSocket và không yêu cầu ứng dụng phải tự quản lý việc ngắt/mở lại kết nối.
3. **Ổn Định Hóa Bộ Thăm Dò Ngầm (Adaptive Cloud Polling Fix):**
   * Độc lập hóa việc đánh giá trạng thái kết nối (`_isSseHealthy`): Khi hàm unsubscribe của SDK đang hoạt động, hệ thống không coi kết nối là lỗi chỉ vì sau 60 giây không có ai sửa dữ liệu trên đám mây, loại bỏ hoàn toàn tình trạng tái kết nối lặp đi lặp lại mỗi 2.5 giây gây gián đoạn giao diện.

### 6.4. Tối Ưu Hóa Khử Giật Lag / Trễ Khi Gõ Phím Trên Toàn Bộ Ô Nhập Liệu (Zero-Latency Typing)

Nhằm loại bỏ hoàn toàn độ trễ (delay nhẹ khi gõ từ bàn phím) trên tất cả các ô nhập liệu, danh sách và ô ghi chú:

1. **Tách Rời Sự Kiện Phím (`keydown`) Khỏi Luồng Thăm Dò Hoạt Động (`_markUserActive`):**
   * Trước đây, sự kiện `keydown` trên toàn cửa sổ gọi `_markUserActive`, dẫn đến việc mỗi khi người dùng bấm phím hệ thống lại kiểm tra kết nối và có thể kích hoạt kéo dữ liệu từ đám mây (`pullFromFirebaseCloudNow`), gây giật khung hình.
   * Danh sách lắng nghe được rút gọn chỉ còn `['pointerdown', 'touchstart']` (tương tác chuột/chạm). Việc gõ phím của người dùng hoàn toàn không kích hoạt thăm dò đám mây.
2. **Cơ chế Debounce Toàn Diện Trên Mọi Trường Dữ Liệu:**
   * **Các trường Checklist & Ghi chú (`[data-checklist-field]`, `#session-note`, `#handover-person`):** Áp dụng debounce $220\text{–}250\text{ ms}$. Chỉ ghi vào LocalStorage và cập nhật trạng thái khi người dùng ngừng gõ hoặc khi rời khỏi ô (`blur`).
   * **Các ô Tìm kiếm (`#student-search`, `#late-search`, `#match-master-search-input`, `#cross-makeup-search-input`, `#scores-tab-search`, `#master-student-search`, `#staff-search-input`):** Áp dụng debounce $75\text{–}90\text{ ms}$, ngăn chặn việc duyệt regex và vẽ lại toàn bộ cây DOM sau từng ký tự đơn lẻ.
   * **Ô Ghi chú Hồ sơ Buổi học (`#student-session-profile-content`):** Áp dụng debounce $220\text{ ms}$ và loại bỏ lệnh gọi `render()` vẽ lại toàn bộ sơ đồ lớp khi đang chỉnh sửa văn bản ghi chú hoặc điểm số.
3. **Chống Tràn Tính Toán Bố Cục Trong Ô Textarea Co Giãn (`autoResizeNoteTextareas`):**
   * Trước đây, hàm resize đặt `ta.style.height = 'auto'` rồi mới đọc `ta.scrollHeight`, buộc trình duyệt phải tính toán lại bố cục (forced reflow/layout thrashing) 2 lần trên mỗi ký tự.
   * Giải pháp mới: Điều chỉnh chiều cao thông qua `window.requestAnimationFrame`, chỉ cập nhật `style.height` khi chiều cao thực tế thay đổi vượt quá $3\text{ px}$, giữ cho thao tác gõ văn bản đạt tốc độ phản hồi $60\text{ fps}$ mượt mà.

### 6.5. Đồng Bộ Thời Gian Thực Ca Học Mới Mở Giữa Các Thiết Bị (Instant Active Session Propagation)

Để giải quyết triệt để vấn đề ca học mới mở trên máy A không tự động xuất hiện trên máy B:

1. **Chuẩn Hóa Đóng Dấu Thời Gian & Phiên Bản Khi Mở / Mở Lại Ca Học (`openClassSession`):**
   * Khi ca học được mở (hoặc mở lại), hàm `openClassSession` tự động đính kèm `updatedAt = now` (ISO string) và tăng lũy tiến `revision = revision + 1`.
   * Nhờ đó, thuật toán hợp nhất `_mergeGranularJsonValue` trên máy nhận (Machine B) luôn nhận diện được trạng thái `active` của ca học là mới hơn bản ghi cũ, không bao giờ bị loại bỏ hay bị ghi đè ngược bởi trạng thái đóng cũ.
2. **Đẩy Nhanh Lịch Sử Ca Học Lên Đám Mây (`session-history.v2` Fast-Push):**
   * Giảm thời gian chờ đẩy hàng đợi của `lopvui.session-history.v2` xuống $800\text{ ms}$ (thay vì $8500\text{ ms}$), đồng thời kích hoạt `window.__forceSyncSessionHistoryNow()` đẩy tức thì ngay khi người dùng bấm mở ca hoặc vào ca học trực tiếp.
3. **Hiển Thị Minh Bạch Ca Đang Mở Trên Bảng Điều Khiển Chính (`#main-menu-view` & `#class-general-view`):**
   * **Menu chính (`#ongoing-shift-list`):** Tự động quét `sessionHistory` hôm nay để đưa các ca học đang mở vào danh sách ca làm, bất kể hôm đó có phải ngày học theo lịch cố định của lớp hay không.
   * **Thẻ ca học (`scheduleCard`):** Khi ca học đang ở trạng thái `status === 'active'`, thẻ hiển thị badge xanh lá `• Đang mở ca`, trạng thái `Đang mở (Trực tiếp)`. Khi bấm vào thẻ hoặc nút **`Xem lớp`**, hệ thống luôn mở trang Quản lý chung của lớp (`#class-general-view` theo Mục 13.7), nơi người dùng có thể chủ động bấm vào ca trực.
   * **Trang Tổng quan Lớp (`renderClassGeneralView`):** Nút hành động chính `#general-enter-live-btn` tự động đổi nội dung thành **`● Vào ca đang mở (Live)`** với màu xanh nổi bật ngay khi ca học được mở trên bất kỳ thiết bị nào.

### 6.6. Căn Giữa Chuẩn Xác 100% Cho Toàn Bộ Nút & Icon Đóng Menu (Pixel-Perfect Icon Centering)

Nhằm khắc phục tình trạng các icon và nút đóng dấu "x" bị lệch xuống dưới do chênh lệch độ cao đường cơ sở font chữ (font baseline metrics):

1. **Sử Dụng Icon Vector SVG Chuẩn Hóa:** Toàn bộ nút đóng menu/hộp thoại (`.close-button`) trên tất cả 31 dialog của hệ thống được chuyển đổi sang thẻ `<svg width="18" height="18" viewBox="0 0 24 24">` với hai đường chéo giao nhau chính xác tại tọa độ hình học tâm `(12, 12)`, loại bỏ 100% sự phụ thuộc vào metrics của font chữ hệ điều hành.
2. **Chuẩn Hóa CSS Flexbox & Line-Height = 0:**
   * Áp dụng `display: inline-flex !important; align-items: center !important; justify-content: center !important; padding: 0 !important; margin: 0 !important; line-height: 0 !important;` trên tất cả các lớp `.close-button`, `.card-more-toggle-btn`, và `.desk-add-compact-btn`.
   * Đối với trường hợp nút đóng chứa ký tự thuần túy `×`, áp dụng bù trừ quang học `padding-bottom: 2px !important;` để nâng tâm chữ lên trùng khớp với tâm hình tròn 38px của nút.

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
2. **Bộ Lọc Nhanh Học Sinh Chưa Nhập Điểm Tại Tab Nhập Điểm (`#scores-view`):**
   * Tích hợp thanh nút lọc nhanh (Filter Pills) và dropdown bộ lọc:
     * `Tất cả`: Xem toàn bộ học sinh lớp và học bù, phân chia theo 3 nhóm ưu tiên.
     * `Chưa nhập điểm`: Lọc nhanh các học sinh chưa có điểm BTVN (hoặc chưa có điểm Test nếu ca học có test) để trợ giảng / giáo viên tập trung chấm bài và nhập điểm thần tốc mà không phải cuộn tìm kiếm. Kèm huy hiệu số lượng học sinh còn thiếu điểm trong thời gian thực.
     * `Chưa có điểm BTVN`: Lọc riêng các học sinh chưa có điểm bài tập về nhà.
     * `Chưa có điểm Test`: Chỉ hiển thị khi ca học có bài Test, lọc nhanh các bạn chưa vào điểm kiểm tra.
     * `Đã nhập điểm`: Xem danh sách các bạn đã hoàn tất nhập đủ điểm.
   * Khi tất cả học sinh đã có điểm, hệ thống hiển thị thông báo trạng thái tích cực: `✓ Tuyệt vời! Tất cả học sinh đều đã được nhập điểm đầy đủ.`

---

## 9. ĐẶC TẢ HỘP VIỆC VĂN PHÒNG (OFFICE ACTION INBOX), ĐỒNG BỘ GOOGLE SHEETS ĐA KHÓA & KHỚP HỒ SƠ

### 9.1. Hộp Việc Cần Xử Lý Của Văn Phòng (`Office Action Inbox`) & Quy Chuẩn Ghi Rõ Lớp Gốc

Dành riêng cho tài khoản **Văn phòng (`office`)** và **Admin (`admin`)**, hiển thị ngay tại trang Quản lý và có nút truy cập nhanh kèm Badge số đếm đơn giản trên thanh Topbar:

1. **Quy chuẩn Ghi Rõ Nguồn Lớp Gốc Khi Khớp Học Sinh Mới / Học Bù:**
   * Khi Trợ giảng ghi nhận học sinh tại bất kỳ ca học nào, hệ thống **bắt buộc ghi nhận và hiển thị rõ ràng thông tin nguồn gốc lớp học**:
     * Thẻ ứng viên trong Hộp việc Văn phòng hiển thị nhãn nổi bật: **`Khớp từ: Học sinh mới của lớp 2K9.H3.GIANGNH`** hoặc **`Khớp từ: Học sinh học bù của lớp 2K9.H3.GIANGNH`**.
     * Badge phân loại đi kèm: `[Mới (2K9.H3.GIANGNH)]` hoặc `[Học bù (2K9.H3.GIANGNH)]`.
     * Trong hộp thoại Khớp dữ liệu (`#match-student-master-dialog`), danh sách lựa chọn học sinh tạm hiển thị rõ tiền tố lớp: `[HS mới của lớp 2K9.H3.GIANGNH] Nguyễn Văn A — THPT Kim Liên`.
     * Trong hộp thoại xác nhận và thông báo Toast sau khi khớp: hiển thị rõ câu thông báo chuẩn: `✓ Đã khớp học sinh mới của lớp 2K9.H3.GIANGNH ("Nguyễn Văn A") vào hồ sơ gốc "Nguyễn Văn A" (K09.1234)`.
2. **Tab 1 — Học sinh Mới & Học bù Chờ Khớp Mã HS (`Pending TA Entries`):**
   * **Nguyên tắc cốt lõi về Khớp danh sách:**
     * Quy trình khớp danh sách (bao gồm hộp thoại `#match-student-master-dialog`, Hộp việc Văn phòng `#office-inbox-panel` tab `Pending TA Entries`, nút `Khớp DS tổng` trên thanh công cụ và trên từng dòng bảng học sinh) **chỉ dành riêng cho những học sinh mới hoặc học sinh học bù CHƯA CÓ MÃ HỌC SINH** (chưa được đính vào hồ sơ học sinh chính thức).
     * **Trường hợp học sinh đã có mã học sinh (`studentCode`):** Mọi dữ liệu buổi học (chỗ ngồi, điểm danh, phút muộn, điểm BTVN, điểm kiểm tra, ghi chú) đã tự động được lưu và liên kết trực tiếp vào hồ sơ học sinh mang mã đó -> **Hệ thống xác định dữ liệu đã được khớp hoàn tất vào học sinh đó, không cần và không cho phép khớp lại**.
     * Học sinh đã có mã HS sẽ tự động được loại trừ khỏi: danh sách chờ khớp (`getUnmatchedSessionStudents`, `getGlobalPendingTACandidates`), huy hiệu số đếm thông báo/inbox (`unmatchedCount`, `taCount`), nút "Khớp DS tổng" trên từng dòng bảng học sinh (`showMatchBtn`), và không tạo thông báo việc cần xử lý.
   * Tự động gom toàn bộ các học sinh Mới (nhãn `[Mới]`) và Học bù (nhãn `[Học bù]`) do Trợ giảng nhập tay ở tất cả các ca học mà chưa được gắn với `Mã HS` trong danh sách tổng.
   * Hiển thị đối chiếu trực quan:
     * **Bên trái:** Thông tin do Trợ giảng ghi nhận tại lớp (Họ tên, Lớp ghi nhận buổi học, Ngày học, Vị trí ghế, Điểm danh/Phút muộn, Trạng thái BTVN, Điểm BTVN/Test, Ghi chú).
     * **Bên phải:** Danh sách gợi ý thông minh các học sinh trong Danh bạ tổng / Google Sheets có tên, trường hoặc Tên Phụ huynh gần giống nhất.
   * Khi Văn phòng bấm **`Khớp & Gộp vào Hồ sơ gốc`**:
     * Nếu là **Học sinh mới** mà hồ sơ gốc trên Google Sheets đang ở lớp khác, hệ thống hỏi Văn phòng: `Chuyển sang lớp mới này (Bảo lưu lịch sử lớp cũ)` hay `Học song song cả 2 lớp`.
     * Toàn bộ dữ liệu buổi học do Trợ giảng nhập được đính chính xác vào hồ sơ gốc có `Mã HS` chuẩn, đồng thời xóa bản ghi tạm để không bao giờ bị trùng tên.
3. **Tab 2 — Thay đổi Lớp học & Học sinh Mới Phát hiện từ Google Sheets (`Pending Sheet Changes`):**
   * Gom toàn bộ các học sinh được hệ thống phát hiện có sự thay đổi cột `Mã lớp` trên Google Sheets (ví dụ học sinh xin chuyển từ lớp Thứ 5 sang lớp Thứ 3 trên Sheet) hoặc học sinh mới đăng ký trên Sheet chờ Văn phòng bấm **Duyệt**.

### 9.2. Đồng bộ Google Sheets Đa Khóa Bán Tự Động & Giải Pháp Google Apps Script API Bridge

1. **Quản lý Danh Sách Nhiều Trang Tính / Sheet Đồng Bộ (`Multi-Sheet Manager`):**
   * Cung cấp bảng quản lý danh sách nhiều trang tính trực tiếp trong menu Cấu hình (`#sheets-multi-cohort-details`), cho phép thêm, sửa, xóa, và gán link/GID riêng cho từng khóa:
     * Khóa `2K9` (Sheet Name / GID: `2K9`, `0`)
     * Khóa `2K10` (Sheet Name / GID: `2K10`, `0`)
     * Khóa `2K11` (Sheet Name / GID: `2K11`, `0`)
     * Khóa `2K12`, `2K13` và các sheet bổ sung (Sheet Tuyển sinh, Sheet Lớp Chuyên đề...).
   * Hỗ trợ nút **`Quét tất cả các khóa (2K9 - 2K13)`** hoặc nút **`Quét riêng sheet này`** cho từng dòng trong bảng quản lý.
2. **Giải Pháp Vượt Rào Cản Quyền Riêng Tư Bằng Google Apps Script Web App (API Bridge):**
   * **Nguyên nhân sự cố quyền truy cập:** Khi Google Sheet thuộc tài khoản cơ quan/tổ chức (như `@hust.edu.vn`) có chế độ bảo mật nội bộ chỉ cho phép một số tài khoản truy cập, các yêu cầu đọc trực tiếp từ trình duyệt của máy khác sẽ bị trả về lỗi `401 Unauthorized` hoặc `403 Forbidden`.
   * **Giải pháp Google Apps Script Web App:**
     * Triển khai một script nhỏ (`Code.gs`) chạy dưới dạng Web App với cấu hình:
       * *Thực thi dưới dạng (Execute as):* **Tôi (Me / email chủ sở hữu có quyền xem sheet)**
       * *Ai có quyền truy cập (Who has access):* **Bất kỳ ai (Anyone)**
     * Apps Script hoạt động như một REST API trung gian: nhận yêu cầu từ ứng dụng web, dùng quyền hạn nội bộ của tài khoản để đọc/ghi dữ liệu trên Google Sheets (hỗ trợ `readAllSheets`, `readSheetByCode`, `syncStudentsByCode`) và trả về JSON chuẩn cho ứng dụng mà không yêu cầu máy tính phòng học phải đăng nhập Google.
   * **Hỗ trợ Trực quan Trong Giao diện Ứng dụng:**
     * Tích hợp tab **"Hướng dẫn chi tiết: Dùng Google Apps Script khi Sheet bị giới hạn quyền truy cập"** ngay trong hộp thoại cấu hình.
     * Cung cấp nút **`Sao chép mã Google Apps Script mẫu`** (1-click copy toàn bộ template `Code.gs` chuẩn).
     * Cung cấp nút **`Kiểm tra kết nối Apps Script ngay`** để kiểm tra tính khả dụng của Web App URL trong thời gian thực.
3. **Quy tắc Duyệt Bán Tự Động & Bảo Toàn 100% Lịch Sử Học Sinh:**
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
     1. **1. Học sinh VẮNG MẶT** (Phân loại Vắng có phép / Không phép, Lý do, Tên Phụ huynh, nút `Sao chép báo PH`).
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
  * [x] Hỗ trợ song song khóa chuẩn `class_mgr.*` và tương thích ngược với các khóa `lopvui.*` hiện có.
  * [x] Xóa toàn bộ ký tự Emoji màu trong `index.html`, `src/app.js`, `src/features.js`; chỉ sử dụng chữ thuần túy và ký hiệu đơn sắc chuẩn.
  * [x] Cập nhật font fallback, `tabular-nums`, `font-size: 16px` cho input; bố cục sơ đồ bằng Grid và đưa nút sửa ra hàng riêng.
* **Phase 2 — Tối ưu Sơ đồ Lớp Optimistic UI ($0\text{ ms}$), Bỏ `#student-pool`, Giữ Chạm Mở Điểm Danh & Kéo-Thả Đổi Chỗ:**
  * [x] Xóa khay kéo `#student-pool`; chế độ `Sửa sơ đồ: BẬT/TẮT` bật/tắt nút `+`, nút `Thu BTVN` dãy và kéo-thả đổi chỗ.
  * [x] Đảm bảo **bấm chạm (Tap $< 6\text{ px}$) vào ghế luôn mở ngay `#seat-dialog`** ở cả 2 chế độ BẬT và TẮT `Sửa sơ đồ`; bỏ tap-to-move.
  * [x] Áp dụng `patchDeskDOMImmediate()` đảm bảo mọi thao tác trên sơ đồ phản hồi tức thì $< 16\text{ ms}$.
  * [x] Thêm thanh lọc nhanh học sinh nợ BTVN / điểm thấp / cảnh báo trong Chế độ Giáo viên; lật sơ đồ sẵn có được giữ nguyên.
* **Phase 3 — Cho Phép Chỉnh Sửa 100% Khi Ca Đã Đóng, Xây dựng Chế độ "Chép Sổ Giấy" & Quản lý Cột Ẩn/Hiện:**
  * [x] Gỡ khóa giao diện lịch sử đã đóng để cho phép sửa 100% qua cùng luồng ca học.
  * [x] Thêm công tắc `Chế độ Chép Sổ Giấy` tách cố định Danh sách lớp ở trên (theo `paperOrderIndex` có thể khóa/sửa STT) và Học sinh mới/Học bù ở dưới, hiển thị ký hiệu chuẩn (`✓`, `M15`, `VP`, `KP`).
  * [x] Nâng cấp `#column-order-dialog` cho phép tích ẩn/hiện cột và đổi vị trí cột như Excel.
* **Phase 4 — Khóa Bảo mật RBAC, Xây dựng Hộp việc Văn phòng & Đồng bộ Google Sheets Đa Khóa:**
  * [x] Chặn hoàn toàn việc lộ danh sách học sinh lớp khác đối với tài khoản Trợ giảng/Giáo viên khi nhập Học sinh mới/Học bù.
  * [x] Xây dựng **Hộp việc Cần xử lý của Văn phòng (`Office Action Inbox`)**, luồng khớp học sinh mới/học bù ghi rõ nguồn gốc lớp (`2K9.H3.GIANGNH`...) vào hồ sơ gốc.
  * [x] Bộ đồng bộ Google Sheets đa khóa / đa trang tính (`Multi-Cohort Sheets`), hỗ trợ Google Apps Script API Bridge vượt rào cản phân quyền tài khoản tổ chức.
  * [x] Bảo mật Firebase Authentication server-side (`.tct@gmail.com`), Database Rules `auth != null`, Realtime Database Web SDK WebSocket và tự động cấp tài khoản khi thêm nhân sự mới.
  * [x] Kiến trúc Zero-Latency Typing khử giật lag / layout reflow trên toàn bộ ô nhập liệu, danh sách và textarea.
* **Phase 5 — Chuyển Báo cáo thành Tab Chính (`#report-view`) & Thanh Trạng thái Offline/Online Queue:**
  * Đưa `Báo cáo buổi học` thành Tab chính trong màn hình ca học với 5 bảng cảnh báo trực quan, khung xem trước Zalo 1 chạm và xuất file `.doc` (Google Docs), `.xlsx`, Google Sheets.
  * Hiển thị thanh trạng thái Offline/Online kèm số thay đổi đang lưu trong hàng đợi trên Topbar.

---

### 12.2. Bộ Danh Sách Kiểm Tra Nghiệm Thu Toàn Diện (Comprehensive QA & Acceptance Criteria Checklist)

AI Coding Agent bắt buộc phải kiểm tra và đảm bảo vượt qua **toàn bộ 8 nhóm tiêu chí nghiệm thu** dưới đây trước khi bàn giao mã nguồn:

#### Nhóm 1: Giao diện, Font chữ, Trợ năng (WCAG AA), Không Emoji & Chống Chồng Chéo Nút (UI/UX & Layout)
- [x] **1.1. Không Emoji 100% (Zero-Emoji):** Quét toàn bộ HTML, CSS, JavaScript, thông báo Toast và mẫu xuất báo cáo; đảm bảo không còn bất kỳ ký tự Emoji màu nào. Chỉ sử dụng chữ thuần túy kết hợp bộ ký hiệu chuẩn (`✓`, `×`, `+`, `—`, `/`, `•`) hoặc icon SVG nét mảnh đơn sắc (`stroke="currentColor"`, `fill="none"`) ở những nút công cụ nhỏ thực sự cần thiết.
- [x] **1.2. Font chữ Tiếng Việt & Số thẳng cột (`tabular-nums`):** Tất cả chữ tiếng Việt có dấu hiển thị rõ nét, không lỗi dấu; toàn bộ cột STT, Mã HS, Điểm số, Sĩ số, Thời gian và Số phút muộn đều áp dụng `font-variant-numeric: tabular-nums` thẳng hàng từ trên xuống dưới.
- [x] **1.3. Không tự động phóng to trên iOS/Android:** Tất cả các ô `input`, `select`, `textarea` có `font-size: 16px` và `touch-action: manipulation`, đảm bảo khi bấm vào ô tìm kiếm học sinh hoặc ô nhập điểm trên iPhone/Android màn hình không bị tự động zoom phông.
- [x] **1.4. Không có nút nào đè lên nhau (Zero-Overlap) & Căn giữa Icon / Nút đóng Chuẩn xác 100%:**
  - Toàn bộ nút đóng `×` của mọi hộp thoại chuyển sang SVG vector nét mảnh đơn sắc với tâm tọa độ hình học `(12, 12)` kết hợp `display: inline-flex; align-items: center; justify-content: center; line-height: 0;`, loại bỏ triệt để hiện tượng icon bị lệch xuống dưới do chênh lệch đường cơ sở font chữ.
  - Nút `Sửa sơ đồ: BẬT/TẮT` nằm trên thanh ngang riêng, không đè lên thanh `BẢNG · ĐẦU LỚP`.
  - Nút `+` trên mỗi bàn nằm ở cột Grid riêng bên phải bàn, không bao giờ đè lên thẻ tên học sinh.
  - Nút đóng của mọi hộp thoại nằm ở góc trên bên phải header, không đè lên tiêu đề hộp thoại.
  - Các ghế trong cùng một bàn luôn nằm trên **1 hàng ngang duy nhất** (`flex-wrap: nowrap`), không bị rớt dòng dọc.
- [x] **1.5. Trợ năng & Điều hướng Bàn phím (Accessibility):** Mọi nút tương tác có kích thước chạm tối thiểu $40\text{ px}\times 40\text{ px}$ và đầy đủ `aria-label`; nhấn `Enter` trong ô tìm kiếm chọn ngay học sinh đầu tiên; nhấn `Enter` hoặc `ArrowDown`/`ArrowUp` trong bảng điểm di chuyển mượt giữa các dòng; nhấn `Escape` đóng hộp thoại; nhấn `Ctrl+Z` (hoặc nút `Hoàn tác`) khôi phục thao tác sơ đồ lớp vừa thực hiện.

#### Nhóm 2: Hiệu năng Phản hồi Tức thì ($< 16\text{ ms}$), Lưu trữ & Đồng bộ Thời gian thực / Ngoại tuyến
- [x] **2.1. Phản hồi $0\text{ ms}$ trên máy đang thao tác (Optimistic UI) & Zero-Latency Typing:** Ngắt hoàn toàn sự kiện gõ phím (`keydown`) khỏi chu kỳ thăm dò đám mây `pullFromFirebaseCloudNow`, debounce tối ưu các ô tìm kiếm ($75\text{–}90\text{ ms}$) và trường checklist ($220\text{–}250\text{ ms}$), loại bỏ triệt để hiện tượng layout thrashing (`ta.style.height = 'auto'`) trong `autoResizeNoteTextareas`, chuyển sang `requestAnimationFrame` và chỉ cập nhật DOM khi chênh lệch $\ge 3\text{ px}$.
- [x] **2.2. Không mất con trỏ khi đang gõ:** Khi thiết bị A đang gõ ghi chú hoặc nhập điểm trong bảng mà nhận được gói tin đồng bộ từ thiết bị B, giá trị của các học sinh khác tự động cập nhật nhưng ô `input`/`textarea` đang `focus` trên thiết bị A tuyệt đối không bị mất con trỏ hay xóa chữ đang gõ dở.
- [x] **2.3. Hợp nhất Đa thiết bị Không Ghi Đè (CRDT & Active Session Propagation):** Khi 2 trợ giảng trên 2 máy cùng điểm danh 2 bàn khác nhau hoặc cùng sửa dữ liệu trong 1 ca học, hệ thống gộp chính xác theo từng `entryId`/`studentId` và `_updatedAt`. Khi một thiết bị mở ca học, đính kèm `updatedAt` / `revision` và đẩy tức thì lên đám mây, các thiết bị khác nhận gói tin và tự động hiển thị ca đang mở trên menu chính (`● Đang mở ca`) và trang tổng quan lớp (`● Vào ca đang mở (Live)`).
- [x] **2.4. Hoạt động Ngoại tuyến (Offline-First) & Vượt trần 5MB Safari:** Khi ngắt mạng Wi-Fi/4G, thanh trạng thái trên Topbar chuyển sang `• Ngoại tuyến · Lưu tạm X thay đổi`; mọi thao tác điểm danh, BTVN, nhập điểm vẫn lưu an toàn vào RAM + IndexedDB + LocalStorage. Ngay khi bật mạng lại, hệ thống tự động đẩy toàn bộ hàng đợi lên Firebase và báo `• Đã đồng bộ`.

#### Nhóm 3: Nghiệp vụ Sơ đồ Lớp, Thu BTVN Đầu Giờ, Điểm Danh & Đi Muộn (`#seating-view`)
- [x] **3.1. Chế độ `Sửa sơ đồ: BẬT` và `Sửa sơ đồ: TẮT`:**
  - Đã loại bỏ hoàn toàn khay kéo `#student-pool` cũ ở phía trên sơ đồ.
  - Khi **`Sửa sơ đồ: BẬT`**: Hiện nút `+` ở mỗi bàn, hiện nút `Thu BTVN` ở đầu mỗi dãy bàn, cho phép **Kéo - Thả (Drag & Drop $\ge 6\text{ px}$)** để di chuyển ghế học sinh sang vị trí khác hoặc bàn khác.
  - Khi **`Sửa sơ đồ: TẮT`**: Ẩn toàn bộ nút `+` và nút `Thu BTVN` dãy, khóa kéo-thả ghế đã có tên trên bàn (nhưng vẫn cho phép kéo học sinh từ khu vực chờ Đi muộn `#late-area` vào bàn).
- [x] **3.2. Chạm (Tap $< 6\text{ px}$) Luôn Mở Menu Điểm Danh (`#seat-dialog`):** Bấm chạm vào bất kỳ ghế nào trên bàn luôn mở ngay hộp thoại `#seat-dialog` **cả khi đang BẬT lẫn khi đang TẮT `Sửa sơ đồ`**.
- [x] **3.3. Quy trình Đi thu BTVN từ trên xuống:**
  - Bấm `+` tạo biểu tượng học sinh vô danh (trạng thái mặc định `Chưa thu`).
  - Với học sinh **không nộp BTVN**: Bấm vào biểu tượng $\rightarrow$ chọn tên học sinh $\rightarrow$ chọn `Chưa nộp` + Lý do (`Chưa làm`, `Quên vở`, `Nghỉ buổi trước`) $\rightarrow$ Lưu; ghế hiển thị tên học sinh (đã điểm danh `Có mặt`) kèm ký hiệu `×` đỏ.
  - Với học sinh **có nộp BTVN**: Đi thu xuống cuối dãy bấm nút `Thu BTVN` của dãy $\rightarrow$ toàn bộ ghế đang `Chưa thu` trong dãy (kể cả ghế vô danh chưa gắn tên) chuyển sang `Đã nộp` (`✓` xanh), tuyệt đối không làm thay đổi các ghế đã đánh dấu `Chưa nộp`.
  - Với học sinh **mới vào lớp sau khi đã thu**: Bấm `+` thêm biểu tượng mới vào bàn $\rightarrow$ biểu tượng mới giữ trạng thái `Chưa thu` (hiện cảnh báo `!` vàng) để trợ giảng biết ngay học sinh này chưa nộp BTVN.
  - Khi gán tên học sinh vào ghế vô danh đã được đánh dấu `Đã nộp` trước đó, học sinh tự động nhận luôn trạng thái `Đã nộp BTVN` của ghế đó.
- [x] **3.4. Nhập điểm BTVN ở cả trạng thái `Đã nộp` và `Chưa nộp`:** Trong cả `#seat-dialog` và `#late-dialog`, khi chọn trạng thái `Chưa nộp`, ô nhập `Điểm BTVN (0 – 10)` vẫn hiển thị đầy đủ để trợ giảng nhập điểm khi học sinh làm bù/gửi bù (tự động ghi nhận điểm nhưng vẫn giữ lịch sử quên bài đầu giờ).
- [x] **3.5. Điểm danh muộn & Tự động tính số phút muộn (`#late-dialog` & `#late-area`):**
  - Tự động tính số phút đi muộn = `Giờ đến thực tế` trừ `Giờ bắt đầu ca học` (nếu đến trước hoặc đúng giờ thì số phút muộn = `0`, ghi nhận `Đúng giờ · Chờ xếp chỗ`). Cho phép sửa trực tiếp số phút muộn hoặc giờ đến bất kỳ lúc nào.
  - Học sinh sau khi lưu ở `#late-dialog` sẽ hiển thị ở khu vực `CUỐI LỚP` (`#late-area`) kèm nhãn phút muộn, trạng thái BTVN và nút sửa nhanh. Khi kéo học sinh từ `CUỐI LỚP` vào bàn, toàn bộ trạng thái điểm danh, số phút muộn, BTVN, điểm số và ghi chú đi theo vào đúng ghế đó.
- [x] **3.6. Vạch ngăn cách bàn & Kế thừa chỗ ngồi buổi trước:**
  - Hiển thị đúng vạch phân cách ngang giữa 2 bàn trên-dưới theo cấu hình riêng của từng dãy.
  - Nút `Xếp chỗ theo buổi trước` tự động đặt học sinh vào đúng vị trí bàn của buổi học liền trước (với trạng thái `Có mặt · Chưa thu BTVN`).
- [x] **3.7. Chế độ Giáo viên (`Góc nhìn Giáo viên`):** Lật ngược 180 độ toàn bộ sơ đồ lớp (Bảng ở dưới, Cuối lớp ở trên, đảo chiều các dãy Trái-Phải và ghế Trái-Phải) kèm thanh lọc làm nổi bật nhanh các học sinh `Chưa nộp BTVN hôm nay`, `Điểm thấp / Nợ bài buổi trước` và `Cảnh báo Mức 1–4`.

#### Nhóm 4: Bảo mật Phân quyền (Strict RBAC) & Luồng Học sinh Mới / Học bù
- [x] **4.1. Bảo mật Đăng nhập Firebase Authentication & Thu hồi Phiên tức thì:** Đăng nhập an toàn kết nối Firebase Auth server-side (`[username].tct@gmail.com`), Realtime Database Rules khóa truy cập ở mức `"auth != null"`, Realtime Database Web SDK duy trì kết nối WebSocket bền vững, tự động cấp tài khoản Auth khi thêm nhân viên mới và hỗ trợ đổi mật khẩu an toàn ngay trên giao diện web.
- [x] **4.2. Cô lập Dữ liệu theo Lớp Phụ Trách:** Tài khoản Trợ giảng (`assistant`) và Giáo viên (`teacher`) chỉ nhìn thấy các lớp mình được phân công và chỉ tìm kiếm được học sinh thuộc đúng lớp đang mở trong ca học. Trợ giảng bị ẩn hoàn toàn tab Danh bạ tổng; Giáo viên khi vào tab Danh bạ tổng chỉ nhìn thấy học sinh thuộc các lớp mình được phân công phụ trách.
- [x] **4.3. Form Nhập tay Học sinh Mới / Học bù (Không lộ dữ liệu trung tâm):** Khi Trợ giảng bấm `+ Học sinh mới / Học bù` trong `#seat-dialog` hoặc `#late-dialog`, chỉ hiển thị form nhập tay (`Họ và tên`, `Trường học` / `Lớp gốc`, `Tên Phụ huynh`). Tự động gắn tag `Mới` và ghi chú buổi học `Học sinh mới` cho học sinh mới tạo.
- [x] **4.4. Xóa học sinh khỏi ghế (`#clear-seat`) & Đồng bộ Bất biến Sơ đồ $\leftrightarrow$ Điểm danh:**
  - Khi bấm nút thùng rác xóa học sinh khỏi ghế, hiển thị hộp thoại xác nhận rõ ràng.
  - Nếu là học sinh chính thức của lớp: xóa khỏi ghế và tự động đưa trạng thái buổi hôm đó về `Chưa điểm danh` (nhưng giữ nguyên 100% lịch sử các buổi trước).
  - Nếu học sinh không có trên sơ đồ nhưng đã được Văn phòng đánh dấu `Vắng có phép` hoặc `Vắng không phép`: giữ nguyên trạng thái Vắng đó.
  - Nếu là bản ghi tạm (Học sinh mới / Học bù do Trợ giảng vừa tạo trong buổi): xóa khỏi sơ đồ và xóa sạch bản ghi tạm khỏi cơ sở dữ liệu.

#### Nhóm 5: Chế độ "Chép Sổ Giấy", Bộ lọc Bảng, Ẩn/Hiện Cột & Bảng Nhập điểm (`#students-view` & `#scores-view`)
- [x] **5.1. Chế độ "Chép Sổ Giấy" (`Paper Transcription Mode`):**
  - Tự động tách bảng thành **2 phần cố định**: Phần trên là Danh sách học sinh cố định của lớp xếp đúng theo thứ tự `paperOrderIndex` của sổ giấy (tuyệt đối không nhảy dòng khi điểm danh hay nhập điểm); Phần dưới cùng là nhóm Học sinh Mới phát sinh & Học bù trong buổi.
  - Cho phép mở khóa chỉnh sửa STT Sổ Giấy (`1, 2, 3...` hoặc đẩy Lên/Xuống) và bấm `Khóa STT Sổ Giấy` để lưu cố định cho lớp đó.
  - Hiển thị đúng ký hiệu ngắn gọn chuẩn sổ giấy: `✓` (Có mặt), `M15` (Đi muộn 15 phút), `VP` (Vắng có phép), `KP` (Vắng không phép), `—` (Chưa điểm danh), `×` (Không nộp BTVN), điểm số định dạng dấu phẩy (`8,5`).
- [x] **5.2. Đổi vị trí cột & Ẩn/Hiện cột như Excel (`#column-order-dialog`):** Cho phép tích checkbox Ẩn/Hiện từng cột và đổi thứ tự cột linh hoạt (có nút đặt nhanh cột `Điểm & BTVN` sát cạnh cột `Tên`). Thứ tự cột được áp dụng đồng bộ cho cả bảng trên màn hình lẫn khi xuất file Excel (`.xlsx`).
- [x] **5.3. Bảng Nhập điểm (`#scores-view`) & Nhập điểm Excel theo Mã HS:**
  - Sắp xếp thông minh hoặc theo thứ tự sổ giấy; hỗ trợ bật/tắt cột `Điểm Test` (đồng bộ với mục `Ca này có test` bên tab Checklist).
  - Tích hợp thanh nút lọc nhanh (Filter Pills) và dropdown: `Tất cả`, `Chưa nhập điểm`, `Chưa có điểm BTVN`, `Chưa có điểm Test`, `Đã nhập điểm` kèm số đếm động thời gian thực, giúp lọc nhanh các bạn chưa có điểm để nhập bài không sót học sinh nào.
  - Bấm vào ô `Điểm 4 bài gần nhất` mở ngay hộp thoại chi tiết lịch sử điểm, trạng thái đi học và tên bài học từng buổi trước của học sinh đó.
  - Hỗ trợ xuất file mẫu Excel và nhập điểm hàng loạt bằng file `.xlsx` hoặc dán `Ctrl+V` 2 cột `Mã HS + Điểm` (tự động chuyển trạng thái BTVN từ `Chưa thu` sang `Đã nộp` khi có điểm).

#### Nhóm 6: Đóng Ca Học Không Khóa Dữ Liệu (Always-Editable Sessions), Checklist & Chấm công TA
- [x] **6.1. Checklist Buổi học & Chấm công Cá nhân Trợ giảng:**
  - Tích hoàn thành mục đầu tiên trong Checklist đầu giờ (hoặc bấm nút xác nhận đi làm) tự động ghi nhận giờ bắt đầu ca và cộng ca làm việc vào bảng **Chấm công của tôi (`#portal-menu-panel`)**.
  - Tự động lưu khi gõ: `Tên bài học hôm nay`, `Ghi chú buổi học (nội bộ)`, `Ghi chú chung gửi phụ huynh`, `Nội dung BTVN giao về nhà`, `Link vở ghi`, `Link phiếu BTVN` và `Tên trợ giảng cầm bài về chấm`.
  - Tự động nhận diện `Buổi này không có BTVN` nếu buổi liền trước không giao BTVN (và cho phép bật/tắt thủ công).
- [x] **6.2. Ca Đã Đóng Vẫn Chỉnh Sửa Được 100% (Always-Editable Closed Sessions):**
  - Khi bấm `Kết ca học & Lưu lịch sử`, hệ thống kiểm tra và liệt kê các mục còn sót (như ghế vô danh chưa gắn tên, học sinh chưa tích BTVN, chưa nhập tên bài học) để trợ giảng rà soát trước khi xác nhận đóng ca.
  - Sau khi ca đã chuyển sang trạng thái `✓ Đã đóng ca` (hoặc khi mở lại ca học cũ từ lịch sử $1\text{–}2\text{ ngày}$ sau), Trợ giảng / Giáo viên / Văn phòng **vẫn sửa được 100% mọi thông tin** (nhập bổ sung điểm Test/BTVN sau khi chấm xong, sửa điểm danh, sửa checklist, sửa tên bài học, thêm ghi chú) mà không bị khóa Read-only. Mọi chỉnh sửa tự động cập nhật vào cả lịch sử ca học lẫn hồ sơ học sinh.
- [x] **6.3. Quản lý Ca học Quá khứ & Xóa Ca học:** Cho phép thêm bổ sung ca học trong quá khứ, sửa thông tin/ngày học của ca cũ, hoặc xóa ca học (xóa sạch dữ liệu buổi học đó khỏi hồ sơ học sinh nhưng vẫn lưu vết thao tác trong Nhật ký Admin Log).

#### Nhóm 7: Hộp việc Văn phòng (Office Action Inbox), Đồng bộ Google Sheets Đa Khóa & Chuyển Lớp
- [x] **7.1. Hộp việc Cần xử lý của Văn phòng (`Office Action Inbox`) & Khớp Hồ sơ Ghi Rõ Nguồn Gốc Lớp:**
  - Tự động gom toàn bộ Học sinh mới & Học bù do Trợ giảng nhập tay trong các ca học để Văn phòng kiểm tra và bấm `Khớp & Lưu dữ liệu` vào đúng học sinh trong Danh sách tổng (tự động đẩy các hồ sơ trùng tên / tên phụ huynh / trường lên đầu danh sách gợi ý).
  - Ghi nhận và hiển thị minh bạch nguồn gốc lớp khi khớp: ví dụ `Học sinh mới của lớp 2K9.H3.GIANGNH` hoặc `Học sinh học bù của lớp 2K9.H3.GIANGNH` trên danh sách, thanh công cụ, badge, dropdown và thông báo toast.
  - Sau khi bấm khớp: toàn bộ vị trí ngồi, trạng thái điểm danh, phút muộn, BTVN, điểm BTVN/Test và ghi chú của buổi học đó được gộp nguyên vẹn vào hồ sơ gốc có `Mã HS` chuẩn, đồng thời xóa bản ghi tạm do Trợ giảng tạo.
  - Nếu là Học sinh mới mà hồ sơ gốc đang ở lớp khác, hiển thị hộp thoại hỏi Văn phòng: `Chuyển lớp sang lớp mới này (Bảo lưu dữ liệu lớp cũ)`, `Thêm học song song cả 2 lớp`, hoặc `Chỉ đính dữ liệu buổi học`.
- [x] **7.2. Đồng bộ Google Sheets Đa Khóa (`2K9`, `2K10`, `2K11`, `2K12`...) & Cầu Nối Google Apps Script API Bridge:**
  - Hỗ trợ cấu hình và quét dữ liệu từ nhiều trang tính (`Multi-Cohort Sheets`) theo từng khóa trong bảng tính.
  - Cung cấp mã nguồn Google Apps Script Web App và hướng dẫn 6 bước tích hợp trực quan trong menu để vượt qua 100% rào cản phân quyền cho tài khoản tổ chức/trường học.
  - Tự động đối chiếu theo `Mã HS` (và tên + Tên Phụ huynh) để phát hiện 3 nhóm cần duyệt: `Học sinh mới`, `Khác lớp gốc (Chuyển lớp)` và `Cập nhật Mã HS / Thông tin`.
  - Trên bảng duyệt của Văn phòng: mặc định gắn tag `Mới` cho học sinh mới và học sinh chuyển lớp, nhưng có nút tích chọn/bỏ chọn tag `Mới` cho từng em hoặc tất cả trước khi bấm `✓ Duyệt & Cập nhật`.
- [x] **7.3. Bảo toàn 100% Dữ liệu Học sinh khi Chuyển lớp:** Khi học sinh chuyển từ lớp A sang lớp B (qua duyệt Google Sheets hoặc qua nút `Chuyển lớp`), mã lớp A được chuyển vào `previousClassIds` & `classTransferHistory`. Khi mở Hồ sơ học sinh theo lớp (`#student-class-profile-dialog`), vẫn hiển thị tab `Lớp cũ` để xem lại đầy đủ 100% lịch sử điểm danh, điểm BTVN/Test và nhận xét tại lớp A.

#### Nhóm 8: Tab Báo cáo Buổi học Trực quan (`#report-view`), Xuất Dữ liệu & Nhật ký Admin (`Admin Audit Log`)
- [x] **8.1. Tab Báo cáo Chính Trực quan (`#report-view` — Không dùng Pop-up):**
  - Nằm trực tiếp trên thanh tab chính của ca học, hiển thị rõ 5 bảng cảnh báo trực quan: `1. Học sinh Vắng mặt`, `2. Học sinh Đi muộn`, `3. Học sinh Chưa nộp BTVN`, `4. Học sinh Điểm thấp dưới mốc` (cho phép chọn nhanh mốc `< 5`, `< 6`, `< 7` hoặc nhập mốc bất kỳ) và `5. Học sinh Học bù & Học sinh mới`.
- [x] **8.2. Copy Báo cáo Zalo 1 Chạm (Gửi Giáo viên & Gửi Phụ huynh):**
  - Nút `Sao chép báo cáo gửi Giáo viên` tạo bản tổng hợp đầy đủ (thông tin lớp, bài học, link BTVN/vở ghi, sĩ số, 5 danh sách chi tiết kèm lý do và ghi chú) bằng văn bản thuần túy, sạch đẹp, không chứa emoji.
  - Nút `Copy báo PH` (trên từng dòng học sinh ở bảng danh sách lớp của tài khoản Văn phòng, trong hồ sơ buổi học và trong tab Báo cáo) tạo đúng mẫu tin nhắn gửi Phụ huynh của riêng học sinh đó (tự động ẩn các dòng trống, đính kèm ghi chú chung gửi phụ huynh ở cuối tin nhắn).
- [x] **8.3. Xuất Đa Định Dạng Chuẩn A4:**
  - Xuất file Excel (`.xlsx`) chuẩn OpenXML mở trực tiếp trên Microsoft Excel / Google Sheets không lỗi font tiếng Việt.
  - Xuất file Google Docs / Word (`.doc`) và chế độ In / Lưu PDF chuẩn trang A4 ngang có đầy đủ bảng điểm danh và ô chữ ký Trợ giảng / Giáo viên.
  - Xuất ảnh PNG Sơ đồ lớp (`#seating-snapshot-dialog`) tự động căn vừa khít 1 khung hình (không cần cuộn), hiển thị rõ tên, tag `#Mới`, phút đi muộn (`Muộn 15p`), điểm/trạng thái BTVN, nhãn `[BÙ]` và chú thích ký hiệu bên dưới.
- [x] **8.4. Nhật ký Admin Log (`#mgmt-panel-admin-log` & `#session-admin-log-dialog`):**
  - Chỉ hiển thị duy nhất cho tài khoản có vai trò `admin` (ẩn tuyệt đối với `office`, `teacher`, `assistant`).
  - Ghi nhận đầy đủ mọi thao tác tác động lên dữ liệu (điểm danh, thu BTVN, nhập/sửa điểm, đổi chỗ, sửa checklist, mở/đóng/sửa/xóa ca học, chuyển lớp, duyệt Google Sheets) kèm thời gian chính xác tới giây (`DD/MM/YYYY HH:mm:ss`), Tên tài khoản, Mã nhân viên và Vai trò.
  - Phân nhóm khoa học theo từng Lớp học và từng Ca học trong lớp, hỗ trợ lọc theo Lớp, Ca học, Tài khoản, từ khóa và xuất ra file `.txt` / `.xlsx`.

---

### PHẦN BỔ SUNG ĐẶC TẢ CHI TIẾT (CẬP NHẬT MỚI NHẤT)

#### 1. Cơ chế Tự động Nhận diện & Đồng bộ Trạng thái "Nghỉ" từ Google Sheets
- **Phát hiện khác biệt trạng thái 2 chiều:** Thuật toán quét và so sánh Google Sheets (`scanIncomingSheetsRowsForApproval`) thực hiện đối chiếu trường trạng thái `enrollmentStatus` của từng dòng trong Sheet với trạng thái hiện tại của học sinh trong hệ thống.
- **Tự động bắt trạng thái "Nghỉ":** Khi một học sinh trên Google Sheet được đổi trạng thái thành `Nghỉ`, `Nghỉ học`, `Đã nghỉ`, `Tạm nghỉ`, hoặc `Chưa nhập học`, hệ thống tự động:
  1. Đưa học sinh vào danh sách chờ duyệt với phân loại `Cập nhật Mã HS / Thông tin`.
  2. Hiển thị badge màu đỏ trực quan: `Trạng thái: [Trạng thái cũ] ➡ [Trạng thái mới]` ngay trên bảng duyệt của Văn phòng.
  3. Khi bấm `✓ Duyệt & Áp dụng` (hoặc qua cơ chế đồng bộ nền), hệ thống lập tức cập nhật `stu.enrollmentStatus = item.enrollmentStatus`, tăng `revision`, gán `updatedAt = Date.now()` và kích hoạt đồng bộ Firebase Realtime Database để mọi thiết bị khác lập tức thấy học sinh đã chuyển sang trạng thái Nghỉ.

#### 2. Đồng bộ 2 Chiều Cột Tag Phân Loại với Google Sheets
- **Tự động phát hiện cột Tag:** Thuật toán `autoDetectGridColumnRoles` tự động nhận diện các cột có tiêu đề `Tag`, `Tags`, `Thẻ`, `Phân loại`, `Nhãn`. Hộp thoại cấu hình Google Sheets cũng hỗ trợ ô chỉ định thủ công `Cột Tag / Phân loại` (`#sheets-col-tag`).
- **Phân tách & So khớp Tag:** Chuỗi tag trên Google Sheet (ngăn cách bởi dấu phẩy hoặc chấm phẩy) được bóc tách thành mảng các tag riêng biệt, so sánh với mảng `stu.tags` hiện tại để phát hiện tag mới và hiển thị badge `Tag Sheet: [tag1, tag2...]` trên bảng duyệt.
- **Đồng bộ ngược lại Google Sheet:**
  - Khi thực hiện đẩy dữ liệu lên Google Sheets (`syncSessionToGoogleSheets`), xuất TSV (`#copy-sheets-tsv-btn`), hoặc xuất file Excel đồng bộ (`#export-sheets-xlsx-btn`), hệ thống bổ sung cột `Tag` chuẩn hóa để bảo toàn 100% nhãn phân loại học sinh giữa hai nền tảng.
  - File Excel xuất tổng (`exportAllStudentsCsv`) cũng tích hợp sẵn cột Tag theo cấu hình cột người dùng.

#### 3. Bảng Danh Bạ Toàn Trung Tâm: Bộ Lọc Đa Cột & Thao Tác Hàng Loạt Nâng Cao
- **Hàng bộ lọc đa cột trực tiếp trên bảng (`#master-filter-row`):**
  - Đặt ngay bên dưới hàng tiêu đề, hỗ trợ lọc độc lập trên từng cột:
    * `Mã HS`: Tìm kiếm nhanh theo mã học sinh.
    * `Họ đệm` & `Tên`: Tìm kiếm theo họ hoặc tên học sinh.
    * `Trường học`: Lọc theo trường cấp 2, cấp 3.
    * `Phụ huynh`: Lọc theo số điện thoại hoặc tên phụ huynh.
    * `Trạng thái`: Dropdown chọn lọc `Học`, `Tạm nghỉ`, `Nghỉ`, `Chưa nhập học`.
    * `Các lớp theo học`: Dropdown chọn xem học sinh theo từng lớp học.
    * `Tag`: Tìm kiếm học sinh theo các thẻ phân loại (`Mới`, `VIP`, `Cần chú ý`, v.v.).
  - Ô nhập liệu bộ lọc được debounce tối ưu, chống gián đoạn thao tác gõ bàn phím và tự động bảo lưu focus/vị trí con trỏ khi dữ liệu bảng cập nhật.
  - Tích hợp nút `✕` xóa nhanh tại đầu hàng lọc và nút `× Xóa tất cả bộ lọc` trên thanh công cụ khi có bất kỳ bộ lọc nào đang hoạt động.
- **Thanh thao tác hàng loạt (`#master-bulk-bar`):**
  - `Đổi trạng thái`: Hộp thoại modal giao diện trực quan cho phép chọn nhanh trạng thái mới (`● Học`, `⏸ Tạm nghỉ`, `✕ Nghỉ`, `○ Chưa nhập học`) để áp dụng đồng loạt cho toàn bộ học sinh được tích chọn, tự động ghi nhật ký Admin Log và đẩy dữ liệu lên Cloud.
  - `Thêm tag` / `Xóa tag`: Thêm hoặc gỡ tag cho hàng loạt học sinh.
  - `Thêm vào lớp` / `Chuyển lớp`: Thêm học sinh vào lớp học mới hoặc chuyển lớp có bảo lưu 100% lịch sử học tập tại lớp cũ.
  - `Xóa HS`: Xóa học sinh khỏi danh bạ tổng (chỉ khả dụng với tài khoản Admin và Văn phòng).

#### 4. Quy Tắc Hiển Thị Ca Bổ Trợ & Gia Sư 1-1
- **Ứng xử như ca học bù:** Lớp bổ trợ (`TUTORING_CLASS_ID = 'class-tutoring'` / mã `BOTRO` / môn `Bổ trợ & Gia sư 1-1`) được quản lý theo mô hình ca chuyên biệt tương tự như ca học bù.
- **Ẩn tên lớp bổ trợ trên Danh bạ tổng:** Tuyệt đối không hiển thị tên lớp bổ trợ/gia sư trong cột "Các lớp theo học" của Bảng danh bạ học sinh toàn trung tâm để tránh gây nhiễu danh sách các lớp học chính thức.
- **Đếm chính xác KPI số lớp:** Các chỉ số KPI `Học 1 lớp` và `Học nhiều lớp` chỉ tính trên các lớp học chính khóa, không tính lớp bổ trợ.
- **Truy xuất chi tiết trong Hồ sơ:** Toàn bộ lịch sử các ca bổ trợ và gia sư 1 kèm 1 được lưu vết đầy đủ trong hồ sơ học sinh (mục `Học bù & Bổ trợ`) và trong phân hệ quản lý ca bổ trợ.

#### 5. Mở Hồ Sơ Học Sinh Trong Buổi Học (Session Profile) Từ Danh Sách Học Sinh & Nhập Điểm
- **Phạm vi áp dụng:** Cả hai tab Danh sách học sinh (`#students-view`) và Danh sách nhập điểm (`#scores-view`).
- **Tương tác trực quan:** 
  - Người dùng bấm trực tiếp vào tên học sinh hoặc cột họ đệm (cả nút bấm và toàn bộ ô `<td>` bao quanh đều mang thuộc tính `data-open-student-profile` cùng hiệu ứng `cursor: pointer`).
  - Hộp thoại Hồ sơ học sinh trong buổi học (`#student-session-profile-dialog`) lập tức mở ra ở chế độ modal an toàn.
  - Hỗ trợ đầy đủ việc tra cứu học sinh thông qua chuỗi fallback mở rộng: tìm trong bộ nhớ lớp hiện tại, tìm trong danh sách học bù, tìm trong danh sách học sinh toàn trung tâm (`window.__featuresApp.getStudents()`) và tra cứu dữ liệu gốc từ `loadStudentRecords()`.
  - Bảo vệ điều hướng an toàn trước các trường hợp đối tượng cấu hình checklist chưa khởi tạo hoặc bài test rỗng (`checklist?.testScores?.[student.id]`).

#### 6. Quy Trình Đóng Ca & Mở Lại Ca Học, Nút Header & Đồng Bộ Tức Thì
- **Nút điều khiển trực tiếp trên thanh Header:**
  - Nút `Đóng ca học` (`#close-session-btn`) luôn hiển thị ngay trên thanh công cụ header ca làm việc khi ca đang diễn ra (`status !== 'closed'`).
  - Nút `Mở lại ca` (`#open-session-btn`) tự động xuất hiện thay thế khi ca học đã đóng (`status === 'closed'`).
  - Đồng thời ở cuối tab Checklist, nút `Kết ca học & Lưu lịch sử` (`#checklist-close-session-btn`) tiếp tục duy trì hoạt động song song.
- **Hộp thoại tổng kết ca & cảnh báo thông minh (`#close-session-dialog`):**
  - Rà soát tự động các tiêu chí điểm danh, học sinh vắng chưa phân loại, học sinh chưa thu BTVN, tên bài học và bàn giao bài test.
  - Khi người dùng bấm `✓ Xác nhận Đóng ca học & Lưu lịch sử`, hệ thống:
    1. Chuyển trạng thái ca sang `closed` với đầy đủ thống kê sĩ số, BTVN, bài test và nhân sự đóng ca.
    2. Cập nhật giao diện badge sang `✓ Đã đóng ca` và làm mới trạng thái nút header.
    3. Tức thì kích hoạt `window.__forceSyncSessionHistoryNow()` để đẩy dữ liệu lên Firebase Realtime Database, đảm bảo tất cả các máy khác cập nhật ngay lập tức mà không bị trễ token hay delay.
    4. Tự động chuyển màn hình sang tab `Báo cáo buổi học` (`#report-view`).

#### 7. Điều Hướng Thẻ Lớp Tại Tab "Đi Làm": Mở Trang Quản Lý Chung (General View)
- **Quy tắc điều hướng nhất quán:**
  - Khi bấm vào nút "Xem lớp" hoặc bấm vào bất kỳ vị trí nào trên thẻ ca làm / thẻ lớp học trong tab chính "Đi làm" (`#ongoing-shift-list`, `#upcoming-shift-list`, `#all-classes-quick-list`), hệ thống **luôn luôn mở trang Quản lý chung của lớp** (`#class-general-view` / `class/[classCode]/general`).
  - Tuyệt đối không tự động nhảy vào giao diện sơ đồ ca trực (Live session) bất kể ca học của ngày hôm đó đang mở hay không.
  - Từ trang Quản lý chung, người dùng có thể tự chủ chọn bấm `Vào ca trực (Live)` hoặc `Xem lại ca học` theo nhu cầu thực tế.

#### 8. Quy Ước Đồng Bộ & Lọc Trạng Thái Học Sinh (Trạng Thái Trống = 'Nghỉ' Khi Có Cột Trạng Thái, Mặc Định Chỉ Hiện 'Học')
- **Chuẩn hóa trạng thái từ Google Sheets (`normalizeEnrollmentStatus`):**
  - Nếu Sheet **có cột Trạng thái** mà ô trạng thái của học sinh để trống hoặc không có nội dung, hệ thống mặc định ghi nhận và lưu trên web là `Nghỉ`.
  - Nếu Sheet **không có cột Trạng thái**, hệ thống giữ nguyên trạng thái hiện có trên Web (hoặc mặc định là `Học` đối với học sinh mới) để tránh báo nghỉ hàng loạt (xem thêm Mục 19.4).
  - Các giá trị trạng thái hợp lệ khác được chuẩn hóa tương ứng (`Học`, `Tạm nghỉ`, `Chưa nhập học`, `Trùng`).
- **Mặc định ẩn các học sinh không còn theo học:**
  - Tại Bảng danh bạ học sinh toàn trung tâm (`#master-student-directory`): Bộ lọc cột Trạng thái mặc định được đặt là `Học` (chỉ hiển thị các bạn đang học). Người dùng có thể chọn `-- Tất cả trạng thái --`, `Nghỉ`, hoặc `Tạm nghỉ` từ dropdown của cột Trạng thái để xem lại danh sách bất kỳ lúc nào.
  - Tại Danh sách học sinh của lớp (`#students-view`): Mặc định chỉ hiển thị danh sách các học sinh có trạng thái `Học`. Các học sinh chuyển sang trạng thái `Nghỉ`, `Tạm nghỉ` sẽ được tự động ẩn khỏi danh sách lớp để tránh chiếm chỗ, nhưng có thể xem lại ngay bằng cách chọn bộ lọc `Học sinh đã nghỉ / tạm nghỉ` (`status_stopped`) hoặc `Tất cả (Gồm cả học sinh nghỉ)` (`all_with_stopped`).

#### 9. Cơ Chế Đồng Bộ & Cập Nhật 2 Chiều với Google Sheets (Two-Way Sync & In-Place Editing)
- **Tổng quan luồng 2 chiều (Bidirectional Synchronization):**
  - **Chiều thuận (Google Sheets ➡ Web App):** Hệ thống quét các trang tính trên Google Sheet (hỗ trợ cả quét đơn sheet theo GID/Tên sheet và quét đa khóa học sinh 2K9 – 2K13), tự động đối chiếu theo Mã HS để phát hiện học sinh mới, học sinh đổi lớp gốc, học sinh đổi trạng thái sang "Nghỉ" (hoặc ô trạng thái để trống) và tag mới để đưa vào Bảng duyệt của Văn phòng. Cho phép người dùng tùy chỉnh cấu hình từng cột riêng biệt (Mã HS, Họ đệm, Tên, Họ và tên, Lớp học, Trường học, Tên Phụ huynh, Trạng thái, Tag).
  - **Chiều ngược (Web App ➡ Google Sheets - Quy tắc an toàn dữ liệu bất biến):**
    > [!IMPORTANT]
    > **QUY TẮC BẤT BIẾN CỦA ĐỒNG BỘ 2 CHIỀU:**
    > Đồng bộ 2 chiều (Web ➡ Google Sheets) **CHỈ diễn ra ở các cột Tag và các cột thông tin buổi học** (Điểm danh, BTVN, Điểm BTVN, Điểm Test, Ghi chú buổi học, Ghi chú học lực).
    > Hệ thống **TUYỆT ĐỐI KHÔNG đồng bộ / không ghi đè vào các cột thông tin chung của học sinh trên Google Sheet** (Họ và tên, Mã học sinh, Trường học, Tên Phụ huynh, Lớp học, Trạng thái học sinh). Điều này bảo vệ toàn vẹn 100% dữ liệu gốc của học sinh trên Google Sheets của trung tâm, tránh mọi rủi ro làm xáo trộn hoặc ghi đè sai thông tin nhân khẩu học.

- **Thuật toán In-Place Cell Update trên Google Apps Script Bridge:**
  - **Giao thức gọi API:** Web app gửi yêu cầu POST đến Google Apps Script Web App URL với cấu hình payload:
    ```json
    {
      "action": "updateStudentsTwoWay",
      "mode": "inplace",
      "appendNew": false,
      "spreadsheetId": "<ID>",
      "sheetName": "<Tên Sheet>",
      "gid": "<GID>",
      "students": [
        {
          "studentCode": "2K9.001",
          "fullName": "Nguyễn Văn A",
          "tag": "Mới, Cần kèm thêm",
          "tags": ["Mới", "Cần kèm thêm"],
          "attendance": "Có mặt",
          "homeworkStatus": "Đủ",
          "btvnScore": 9.5,
          "testScore": 8.0,
          "sessionNote": "Hăng hái phát biểu",
          "learningNotes": "Nắm vững lý thuyết phương trình"
        }
      ]
    }
    ```
  - **Nhận diện cột động (Dynamic Column Discovery):** Apps Script phân tích dòng tiêu đề đầu tiên (Row 1) của trang tính để tự động tìm kiếm chỉ mục các cột:
    * `codeCol`: Cột Mã HS (`Mã HS`, `Mã học sinh`, `Ma HS`, `Code`, `ID`).
    * `nameCol`: Cột Họ và tên (`Họ và tên`, `Họ tên`, `Tên học sinh`, `Full Name`).
    * `tagCol`: Cột Tag (`Tag`, `Tags`, `Thẻ`, `Phân loại`, `Nhãn`).
    * `attCol`: Cột Điểm danh (`Điểm danh`, `Attendance`, `Chuyên cần`).
    * `hwCol`: Cột BTVN (`BTVN`, `Bài tập về nhà`, `Homework`, `Tình trạng BTVN`).
    * `btvnScoreCol`: Cột Điểm BTVN (`Điểm BTVN`, `BTVN Score`, `Điểm bài tập`).
    * `testScoreCol`: Cột Điểm Test (`Điểm Test`, `Test Score`, `Điểm kiểm tra`).
    * `noteCol`: Cột Ghi chú buổi học (`Ghi chú buổi học`, `Ghi chú`, `Nhận xét buổi học`, `Session Note`).
    * `learningNotesCol`: Cột Ghi chú học lực (`Ghi chú học lực`, `Học lực`, `Learning Notes`).
    * `parentCol`: Cột Tên Phụ huynh (`Phụ huynh`, `Tên phụ huynh`, `PH`, `Parent`, `Parent Name`) — Dùng khi quét từ Sheet vào Web hoặc thêm dòng mới, không ghi đè 2 chiều.
    * `classCol`, `schoolCol`, `statusCol`: Các cột thông tin chung — Dùng khi đọc từ Sheet vào Web, tuyệt đối không bị ghi đè khi đồng bộ 2 chiều.
  - **Định vị & Ghi đè chính xác từng ô (In-place cell writing):**
    * Lập bản đồ chỉ mục dòng theo `Mã HS` (ưu tiên tuyệt đối) và `Họ và tên` (dự phòng khi học sinh chưa có mã).
    * Với mỗi học sinh: xác định chính xác số thứ tự hàng `targetRow` trên Sheet. Sử dụng phương thức `syncSheet.getRange(targetRow, colIdx + 1).setValue(...)` để cập nhật riêng rẽ từng ô dữ liệu tương ứng:
      + Ghi chuỗi tag mới (dạng nối dấu phẩy) vào cột Tag (`tagCol`).
      + Ghi nhận xét/thông tin buổi học vào các cột `attCol`, `hwCol`, `btvnScoreCol`, `testScoreCol`, `noteCol`, `learningNotesCol`.
      + **Tuyệt đối KHÔNG ghi đè** vào `codeCol`, `nameCol`, `classCol`, `schoolCol`, `parentCol`, `statusCol`.
    * Tuyệt đối không gọi `clearContents()` khi đang ở chế độ 2 chiều `inplace`, bảo toàn 100% định dạng, màu sắc, phông chữ và các công thức tính toán có sẵn trên Sheet.
  - **Tự động thêm mới (Append Mode):** Mặc định tắt (`appendNew: false`) để đảm bảo an toàn tuyệt đối cho trang tính. Chỉ khi người dùng chủ động cho phép thêm dòng mới, hệ thống mới thêm dòng mới với các cột thông tin tương ứng.

- **Giải pháp bảo mật & Quyền truy cập (Restricted Google Drive Bypass):**
  - Khi Google Sheet bị giới hạn quyền truy cập (chỉ cho phép một số tài khoản Google cụ thể), nhân viên trung tâm hoặc trợ giảng dùng tài khoản khác vẫn có thể đọc và chỉnh sửa 2 chiều thông qua Google Apps Script Web App được triển khai ở chế độ:
    * `Execute as`: **Tôi (Me / email chủ sở hữu Sheet)**
    * `Who has access`: **Bất kỳ ai (Anyone)**
  - Nhờ cơ chế này, mọi thao tác đọc/ghi từ Web app đều thực thi dưới quyền của chủ sở hữu Sheet, loại bỏ hoàn toàn lỗi "Permission Denied" (Lỗi 403) trên Google Drive.

- **Các phương thức dự phòng khi không kết nối trực tiếp Apps Script:**
  - **Copy TSV chuẩn hóa 2 chiều (`#copy-sheets-tsv-btn`):** Sao chép toàn bộ bảng dữ liệu ra clipboard với đúng định dạng cột phân cách bằng tab (`\t`) để người dùng có thể dán trực tiếp (Ctrl + V) đè lên vùng dữ liệu tương ứng trên Google Sheets.
  - **Xuất file Excel chuẩn (`#export-sheets-xlsx-btn`):** Xuất toàn bộ danh sách ra tệp `.xlsx` có sẵn đầy đủ các cột Mã HS, Họ đệm, Tên, Trường, Phụ huynh, Trạng thái, Tag, Mã lớp để nhập liệu thủ công.



#### 10. Khắc Phục Lỗi Quản Lý Tài Khoản, Dropdown Nhân Sự & Hiển Thị Lớp Học Theo Phân Quyền
- **Nguyên nhân gốc rễ (Root Cause Analysis):**
  - Trước đây, dữ liệu nhân sự mặc định trong `masterDefaults.employees` chỉ có duy nhất 1 tài khoản quản trị (`AD001`). Khi người dùng tạo nhân viên mới hoặc đăng nhập bằng các tài khoản giáo viên/trợ giảng được bàn giao (ví dụ `CONGNT`, `GIANGNH`, `LINHBMP`), các hàm dựng dropdown trong Quản lý lớp (`renderEmployeeOptions`, `renderStaffSearchPicker`) bị lọc theo `role === 'teacher'` hoặc `role === 'assistant'`, dẫn đến dropdown nhân sự bị rỗng.
  - Hàm kiểm tra phân quyền hiển thị lớp `isClassAssignedToCurrentAccount` trước đây chỉ so khớp `currentEmployeeId` dạng UUID/ID nội bộ với mảng ID trong lớp, không so khớp với mã nhân viên (`code` như `CONGNT`, `TA001`, `GV001`) hoặc tên đăng nhập (`username`), dẫn đến khi đăng nhập tài khoản nhân viên thì màn hình "Đi làm" và "Quản lý lớp" không hiển thị bất kỳ lớp học nào.
- **Giải pháp khắc phục toàn diện:**
  1. **Nhân sự hoàn toàn do Admin tự đặt (Custom Credentials & RBAC Source of Truth):** Toàn bộ Mã nhân viên, Vai trò, Họ tên và Mật khẩu đều do Quản trị viên tự thiết lập và chỉnh sửa trong Tab Quản lý nhân sự (`#mgmt-panel-staff`). Hệ thống lấy dữ liệu nhân sự đã cấu hình làm Nguồn chân lý duy nhất (Single Source of Truth), tuyệt đối không gán cứng hay ghi đè. Tự động loại bỏ 100% đại từ nhân xưng (`Thầy`, `Cô`, `Anh`, `Chị`, `Em`, `GV`, `TA`, `Trợ giảng`, `Giáo viên`) khỏi tên nhân sự. Cung cấp sẵn danh sách khởi tạo ban đầu chuẩn hóa: `AD001` (Quản trị hệ thống), `LINHBMP` (Bùi Minh Phương Linh - Văn phòng), `SANGHN` (Hoàng Ngọc Sáng - Văn phòng), `CONGNT` (Nguyễn Thành Công - Trợ giảng), `GIANGNH` (Nguyễn Thị Hương Giang - Giáo viên).




  2. **Cơ chế tự động hợp nhất nhân sự (Auto-merge Defaults):** Trong `loadMasterData()`, hệ thống luôn đối chiếu và tự động hợp nhất các nhân sự mặc định còn thiếu vào `saved.employees`. Đảm bảo ngay cả khi trình duyệt đã có dữ liệu `localStorage` cũ, danh sách nhân viên vẫn luôn đầy đủ và không bị mất tài khoản.
  3. **Khôi phục danh mục lớp mẫu phân công đầy đủ (`seedClasses`):** Tạo sẵn các lớp học chuẩn (`TOAN8A`, `ANH7B`, `TOAN9C`) với phân công Giáo viên (`CONGNT`, `GV001`) và Trợ giảng (`TA001`), khởi tạo tự động khi danh mục lớp rỗng.
  4. **So khớp lớp linh hoạt đa tiêu chí (`isClassAssignedToCurrentAccount`):**
     * So khớp linh hoạt theo ID nội bộ, Mã nhân sự (`code` viết hoa/thường), Tên hiển thị (`displayName`) và Username.
     * Kiểm tra trên tất cả các nguồn phân công: `teacherIds`, `teacherName`, `assistantIds`, `assistantName` và các thay đổi ca linh hoạt (`sessionChanges`).
     * Nhờ đó, khi đăng nhập bất kỳ tài khoản nhân viên nào (`CONGNT`, `TA001`, `GV001`), hệ thống lập tức hiển thị chính xác toàn bộ các lớp mà nhân sự đó phụ trách.
  5. **Đảm bảo Dropdown & Search Pickers luôn hiển thị:** Hàm `renderEmployeeOptions` và `renderStaffSearchPicker` cho phép tài khoản Admin và Office thấy toàn bộ nhân sự phù hợp theo vai trò, không bao giờ bị rơi vào trạng thái rỗng hoặc thiếu nhân viên.

#### 11. Màn Hình Trung Tâm Đồng Bộ Google Sheets Chuyên Biệt (Dedicated Google Sheets Hub `#mgmt-panel-sheets`) Thay Vì Cửa Sổ Pop-up
- **Mục tiêu tái cấu trúc UX:**
  - Chuyển toàn bộ luồng nghiệp vụ đồng bộ Google Sheets từ cửa sổ pop-up dạng modal (`#google-sheets-sync-dialog`) sang một **màn hình độc lập chuyên biệt (Dedicated Screen / Tab)** đặt tại `#mgmt-panel-sheets` trong Phân hệ Quản trị (`#management-view`).
  - Mọi thao tác bấm nút `Đồng bộ Google Sheets` từ Menu Tổng, Danh bạ học sinh toàn trung tâm hay Hộp việc văn phòng đều chuyển hướng mượt mà vào Màn hình Quản lý Sheets Hub thay vì bật cửa sổ pop-up che khuất màn hình làm việc.
- **Cấu trúc 4 Tiểu phân hệ (Subpanels) với Tabs Sub-pills trực quan:**
  1. **Subpanel 1 - Đẩy Dữ Liệu Buổi Học (`#sheets-subpanel-session`):**
     * Chọn lớp học cần đồng bộ từ danh mục lớp trung tâm.
     * Chọn ngày buổi học (`<input type="date">`), mặc định ngày hôm nay hoặc ngày buổi học hiện tại.
     * Cấu hình tên Sheet Tab đích (tự động gợi ý theo mã lớp / mã khóa).
     * Các tùy chọn linh hoạt: Có BTVN hay không, Có Test hay không, Ghi kèm link web hay không.
     * Xem trước URL truy cập web trực tiếp sẽ được ghi vào đầu cột.
     * Bảng xem trước (Preview Table) đầy đủ học sinh của buổi học với trạng thái Điểm danh, Điểm BTVN, Điểm Test, Ghi chú trước khi đẩy lên Sheet.
     * Nút `✓ Đẩy Dữ liệu Buổi học Lên Google Sheet` (`#panel-session-upload-btn`).
  2. **Subpanel 2 - Đồng Bộ Danh Bạ Học Sinh 2 Chiều (`#sheets-subpanel-students`):**
     * Các nút hành động chính: Quét Google Sheet đơn, Quét tất cả các khóa (2K9 - 2K13), Đồng bộ 2 chiều (cập nhật ngược lại Sheet), Copy bảng dán vào Sheet (TSV), Xuất file `.xlsx`.
     * Vùng dán trực tiếp dữ liệu từ Google Sheets (Ctrl + V) hoặc tải tệp `.xlsx`, `.csv`.
     * Bảng duyệt học sinh phát hiện từ Google Sheets với bộ lọc phân loại (`HS Mới`, `Chuyển lớp`, `Cập nhật Mã HS`) và nút `✓ Duyệt & Áp dụng`.
  3. **Subpanel 3 - Cấu Hình Kết Nối & Đa Khóa (`#sheets-subpanel-config`):**
     * Nhập link Google Sheets hoặc Spreadsheet ID (tự động bóc tách ID và GID).
     * Nhập URL Google Apps Script Web App (Đọc/Ghi 2 chiều).
     * Bật/tắt chế độ đồng bộ 2 chiều (`twoWayMode`), tự động gắn tag "Mới" (`defaultNewTag`), quy tắc xử lý khi học sinh khác lớp gốc (`classDiffMode`: chuyển lớp hoặc thêm lớp song song).
     * Bảng quản lý cấu hình các khóa học sinh (2K9, 2K10, 2K11, 2K12, 2K13): Hỗ trợ thêm mới khóa, cấu hình Tên tab riêng, GID riêng, link Sheet riêng và quét riêng từng khóa.
  4. **Subpanel 4 - Hướng Dẫn & Mã Mẫu Google Apps Script (`#sheets-subpanel-script`):**
     * Trình bày hướng dẫn 4 bước triển khai Apps Script Web App để vượt rào giới hạn quyền (Bypass 403 Google Drive).
     * Khung xem trước mã nguồn JavaScript chuẩn (`GoogleAppsScriptBridge`) kèm nút `Sao chép Toàn bộ Mã Script mẫu` (`#panel-copy-apps-script-btn`).
     * Nút `Kiểm tra kết nối Apps Script ngay` (`#panel-test-apps-script-btn`) với phản hồi trạng thái tức thời.

#### 12. Hộp Thoại Hỏi Xác Nhận Đồng Bộ Ngược Lên Google Sheet Khi Có Chỉnh Sửa Trên Web (`#confirm-reverse-sheets-sync-dialog`)
- **Nguyên lý kích hoạt (Triggering Condition):**
  - Bất cứ khi nào tài khoản có quyền (Admin hoặc Văn phòng) thực hiện chỉnh sửa hồ sơ học sinh trên Web qua hộp thoại `#student-profile-dialog` (hoặc qua các thao tác cập nhật hàng loạt):
    * Sửa Họ và tên, Mã học sinh, Trường học, Tên Phụ huynh.
    * Đổi lớp học hoặc chuyển lớp.
    * Đổi trạng thái học tập (sang `Nghỉ`, `Tạm nghỉ` hoặc `Học`).
    * Thêm/bớt Tag phân loại học sinh.
  - Sau khi dữ liệu đã được lưu thành công vào cơ sở dữ liệu nội bộ và Firebase, hệ thống tự động kiểm tra nếu chế độ Đồng bộ 2 chiều đang được bật (`cfg.twoWayMode !== false`) và có cấu hình Google Apps Script URL.
- **Giao diện & Trải nghiệm Hộp thoại Xác nhận (`#confirm-reverse-sheets-sync-dialog`):**
  - **Tiêu đề & Nhãn nhận diện:** `ĐỒNG BỘ 2 CHIỀU GOOGLE SHEETS` - `Đồng bộ ngược lên Google Sheet?`
  - **Khung xem trước dữ liệu (Data Diff Preview):** Hiển thị trực quan tóm tắt thông tin học sinh vừa được chỉnh sửa:
    * Họ và tên: Tên học sinh.
    * Mã học sinh: Mã hiện tại (hoặc "Chưa có").
    * Trạng thái học: Màu xanh nếu `Học`, màu đỏ nếu `Nghỉ` / `Tạm nghỉ`.
    * Lớp đang theo học: Mã các lớp học sinh trực thuộc.
    * Trường học & Tên Phụ huynh.
    * Tags phân loại.
  - **Hai lựa chọn quyết định:**
    1. **Nút `Chỉ lưu trên Web` (`#cancel-reverse-sheets-sync-btn`):** Đóng hộp thoại, giữ nguyên dữ liệu trên Web mà không tác động lên Google Sheet.
    2. **Nút `✓ Đồng bộ ngược lên Sheet` (`#agree-reverse-sheets-sync-btn`):** Lập tức gửi yêu cầu POST đến Apps Script Bridge (`syncSingleStudentToGoogleSheets`), định vị đúng dòng của học sinh trên Sheet theo Mã HS (hoặc Họ tên) và **chỉ cập nhật cột Tag phân loại** (tuân thủ tuyệt đối Quy tắc bất biến Mục 13.9: không ghi đè Họ tên, Mã HS, Trường học, Phụ huynh, Lớp học hay Trạng thái lên Google Sheet).
  - Ghi nhận đầy đủ thao tác vào Nhật ký Admin Log (`sheets_sync_reverse`) để truy vết kiểm toán.

#### 13. Nút & Cơ Chế Đẩy Dữ Liệu Buổi Học Lên Google Sheet (Điểm Danh Có Link Web, BTVN Có Cú Pháp Cụ Thể, Điểm Test, Ghi Chú)
- **Điểm truy cập tính năng (Access Points):**
  1. **Nút chuyên dụng tại Màn hình Quản lý Sheets Hub:** Nút `✓ Đẩy Dữ liệu Buổi học Lên Google Sheet` (`#panel-session-upload-btn`) đặt trong Subpanel 1. Cho phép Văn phòng/Admin chọn bất kỳ lớp nào và bất kỳ ngày học nào để đẩy dữ liệu.
  2. **Nút đẩy nhanh tại Tab Báo cáo Buổi học (`#report-view`):** Nút `Đẩy lên Google Sheets` (`#inline-sync-sheets-btn`) trên thanh công cụ Báo cáo. Mở hộp thoại modal `#upload-session-sheets-dialog` để đẩy tức thời dữ liệu ca học hiện tại lên Google Sheet.
- **Đặc tả 4 Cột Dữ Liệu Buổi Học Được Đẩy Lên Google Sheet:**
  - **Cột 1: Điểm danh (Kèm Link Web truy cập trực tiếp):**
    * **Tiêu đề cột (Header):** Ghi rõ ngày học và link trực tiếp vào ca học trên web.
      - Cú pháp chuẩn: `Điểm danh DD/MM/YYYY (Link: https://[domain]/#class/[classCode]/history/YYYY-MM-DD/map)`
      - Giúp phụ huynh hoặc quản lý khi xem Google Sheet chỉ cần nhấp vào link ở đầu cột là mở thẳng sơ đồ lớp và báo cáo chi tiết của buổi học đó trên Web.
    * **Nội dung từng dòng học sinh:**
      - Học sinh đi đúng giờ: Ghi `Có mặt`.
      - Học sinh đi muộn: Ghi `Đi muộn` (hoặc `Đi muộn (15p)`).
      - Học sinh nghỉ có phép: Ghi `Vắng có phép`.
      - Học sinh nghỉ không phép: Ghi `Vắng không phép`.
      - Chưa có thông tin điểm danh: Ghi `Chưa điểm danh`.
  - **Cột 2: Điểm BTVN (Bài Tập Về Nhà):**
    * **Trường hợp buổi học không có BTVN:**
      - Nếu buổi học được cấu hình không giao BTVN (hoặc bỏ chọn ô "Buổi này có BTVN"): ghi thống nhất theo cú pháp chuẩn: `Không BTVN`.
    * **Trường hợp buổi học có BTVN:**
      - Học sinh đã nộp và có điểm: Ghi số điểm chuẩn hóa (ví dụ: `8`, `9.5`).
      - Học sinh không nộp BTVN: Ghi rõ `Không nộp` (kèm lý do nếu có: `Không nộp (Quên vở)`).
      - Học sinh nộp nhưng chưa chấm: Ghi `Đã nộp`.
  - **Cột 3: Điểm Test (Kiểm Tra Trong Buổi):**
    * **Trường hợp buổi học không có kiểm tra:**
      - Nếu buổi học không có bài test (hoặc bỏ chọn ô "Buổi này có Test"): ghi thống nhất theo cú pháp chuẩn: `Không Test`.
    * **Trường hợp buổi học có kiểm tra:**
      - Học sinh đã có điểm: Ghi điểm số kiểm tra (ví dụ: `7.5`, `10`).
      - Học sinh vắng hoặc chưa kiểm tra: Để trống hoặc ghi theo điểm số ghi nhận được.
  - **Cột 4: Ghi chú Buổi học:**
    * Ghi nhận xét của Trợ giảng / Giáo viên về ý thức, mức độ hiểu bài hoặc lời nhắn gửi phụ huynh của buổi học đó cho từng học sinh.
- **Cơ chế ghi thông minh trên Apps Script Bridge (`uploadSessionData` action):**
  - Apps Script quét dòng tiêu đề để kiểm tra xem các cột của ngày hôm đó đã tồn tại hay chưa.
  - Nếu đã có cột của ngày học: cập nhật đè nội dung mới vào đúng các cột đó.
  - Nếu chưa có: tự động chèn thêm 4 cột mới vào bên phải của bảng tính với đúng định dạng tiêu đề và độ rộng phù hợp.
  - Định vị dòng từng học sinh theo `Mã HS` (hoặc `Họ và tên`), chỉ cập nhật ô tương ứng mà không làm lệch các dòng khác.

#### 14. Phân Quyền Nghiêm Ngặt & Cơ Chế Đồng Bộ Bán Tự Động (Semi-Automatic Access Control)
- **Bản chất của Cơ chế Bán Tự Động (Semi-Automatic Sync):**
  - Mọi hoạt động đồng bộ với Google Sheets (cả đọc về và đẩy lên) đều **phải có sự kích hoạt và phê duyệt chủ động từ nhân sự có thẩm quyền** thông qua bảng xem trước hoặc hộp thoại xác nhận.
  - Tuyệt đối không tự động ghi ngầm (silent push) lên Google Sheets khi Trợ giảng đang thao tác chấm bài hay điểm danh trong lớp để tránh lỗi ghi đè dữ liệu, tắc nghẽn mạng hay xung đột phiên làm việc.
- **Ma trận Phân quyền Bảo mật Tuyệt đối (Strict Security RBAC Matrix):**
  - **Quản trị viên (`admin`) & Nhân viên Văn phòng (`office`):**
    * Được quyền toàn diện truy cập Phân hệ Quản lý Sheets Hub (`#mgmt-tab-sheets` / `#mgmt-panel-sheets`).
    * Được quyền xem và chỉnh sửa link Google Sheet, Spreadsheet ID, Sheet GID, Apps Script Web App URL.
    * Được quyền bấm nút quét danh bạ, xem bảng duyệt và áp dụng đồng bộ học sinh.
    * Được quyền bấm nút đẩy dữ liệu buổi học (Điểm danh kèm link, BTVN, Test, Ghi chú) lên Google Sheet.
    * Được xem và bấm xác nhận hộp thoại đồng bộ ngược khi chỉnh sửa học sinh.
  - **Trợ giảng (`assistant`) & Giáo viên (`teacher`):**
    * **CẤM TUYỆT ĐỐI XEM LINK GOOGLE SHEET:** Trên tất cả các màn hình, form cấu hình, báo cáo hay thông tin ca học của Trợ giảng và Giáo viên, đường link Google Sheet, Spreadsheet ID và Google Apps Script URL bị ẩn hoàn toàn (không render ra DOM).
    * **CẤM TUYỆT ĐỐI VÀO MENU GOOGLE SHEETS:** Tab `#mgmt-tab-sheets` và toàn bộ panel `#mgmt-panel-sheets` bị ẩn hoàn toàn đối với vai trò Trợ giảng và Giáo viên.
    * Nút đồng bộ từ Báo cáo buổi học (`#inline-sync-sheets-btn`) bị ẩn khỏi thanh công cụ của Trợ giảng/Giáo viên.
    * Nếu tài khoản Trợ giảng/Giáo viên cố tình gọi hàm đồng bộ hoặc mở URL trực tiếp, hệ thống sẽ lập tức chặn lại bằng lớp kiểm tra phân quyền bảo mật tầng logic (`canAccessCrossClass()` / vai trò kiểm tra) và hiển thị thông báo lỗi từ chối truy cập.

---

## 16. ĐẶC TẢ CHI TIẾT NÂNG CẤP HỆ THỐNG PHIÊN BẢN 5.0 (v5.0 RELEASE SPECIFICATION)

### 16.1. Xóa Bỏ Triệt Để Dữ Liệu Mẫu (Clean Slate & Mock Data Elimination)
- **Mục tiêu:** Loại bỏ hoàn toàn các tài khoản nhân sự mẫu (mock employees) và lớp học mẫu (mock classes) khỏi toàn bộ hệ sinh thái ứng dụng (Local Storage, Firebase Realtime Database, Master Defaults, Fallbacks giao diện và Interceptor).
- **Danh sách nhân sự mẫu bị thanh lọc hoàn toàn:**
  - `TA001` (Anh Linh - Trợ giảng mẫu)
  - `TA002` (Mai Anh - Trợ giảng mẫu)
  - `TA003` (Minh Khoa - Trợ giảng mẫu)
  - `GV001` (Cô Minh Anh - Giáo viên mẫu)
  - `GV002` (Thầy Quang - Giáo viên mẫu)
  - `GV003` (Cô Hương - Giáo viên mẫu)
  - `VP001` (Lan Phương - Văn phòng mẫu)
  - `VP002` (Hoàng Nam - Văn phòng mẫu)
- **Tài khoản quản trị bảo toàn:**
  - `AD001` (`ad001.tct@gmail.com` / `admin`) - Tài khoản quản trị cấp cao khởi tạo hệ thống được bảo toàn để luôn đảm bảo quyền đăng nhập và cấu hình ban đầu.
  - Toàn bộ tài khoản người dùng thực tế tự tạo qua giao diện Quản lý tài khoản (ví dụ `congnt`,...) được giữ nguyên vẹn 100%.
- **Cơ chế thanh lọc dữ liệu tự động (`isMockEmployee` & `loadMasterData` sanitize filter):**
  - Tầng `class-catalog-repository.js`:
    * Biến `seedClasses` được thiết lập rỗng (`[]`).
    * Hàm `isMockEmployee(emp)` kiểm tra theo cả `code` chuẩn hóa và `name` không dấu.
    * Khi `loadMasterData()` và `loadClassCatalog()` chạy, hệ thống tự động lọc sạch các mock record còn lưu trong cache/storage trước đây và ghi đè lại dữ liệu sạch.
  - Tầng `app.js` (Vault Remote Sync Interceptor):
    * Khi kéo dữ liệu từ Firebase về (`_installStorageVaultInterceptor`), bộ lọc `addOrMergeEmp` lập tức loại bỏ bất kỳ tài khoản mock nào còn sót lại trên Firebase Cloud, đảm bảo không bao giờ bị merge ngược lại vào danh sách người dùng hiển thị.
  - Tầng giao diện `features.js`:
    * Xóa bỏ các fallback cứng "Anh Linh" / "TA001" khi tài khoản đăng nhập chưa kịp tải tên; sử dụng fallback an toàn `account?.displayName || 'Nhân sự'`.

---

### 16.2. Phân Khối Học Sinh Động Dựa Trên Tiền Tố Trong Mã Học Sinh (Cohort Prefix Partitioning)
- **Nguyên lý kiến trúc:**
  - Mã học sinh tại trung tâm tuân theo quy chuẩn tiền tố khối: `K9.XXXX`, `K10.XXXX`, `K11.XXXX`, `K12.XXXX`, `K8.XXXX`, `K7.XXXX`, `K6.XXXX` (hoặc `2K9.XXXX`, `2K10.XXXX`...).
  - Hệ thống bổ sung module trích xuất tiền tố khối chuẩn hóa:
    * `extractCohortFromStudentCode(code)`: Sử dụng regex nhận diện tiền tố khối (`K6` đến `K12`, chuẩn hóa các định dạng `2K9 -> K9`, `2009 -> K9`).
    * `formatCohortDisplayName(cohortPrefix)`: Trả về tên hiển thị đầy đủ, ví dụ `Khối K9 (Lớp 9)`, `Khối K10 (Lớp 10)`, `Khối K11 (Lớp 11)`, `Khối K12 (Lớp 12)`.
    * `isStudentInCohort(student, targetCohort)`: Kiểm tra một hồ sơ học sinh có thuộc khối chỉ định hay không (dựa trên `studentCode` hoặc thông tin lớp học liên kết).
- **Áp dụng trực tiếp trên Danh bạ Toàn trung tâm (`#mgmt-tab-students`):**
  - Bộ lọc Khối `#master-grade-filter`: Thay thế danh sách năm sinh cố định bằng danh sách Khối động được trích xuất trực tiếp từ toàn bộ mã học sinh thực tế trong hệ thống (`K12`, `K11`, `K10`, `K9`,...). Khi chọn một khối, bảng chỉ hiển thị đúng các học sinh thuộc khối đó.
  - Nhãn khối (Cohort Badge): Cạnh cột Mã HS trong bảng danh bạ tổng, mỗi học sinh có mã khối hợp lệ sẽ được gắn một badge nhận diện màu tím chàm tinh tế (`background: #e0e7ff; color: #3730a3; font-weight: 800; border-radius: 4px;`) ghi rõ tiền tố khối (ví dụ `K9`, `K10`, `K11`), kèm tooltip hiển thị tên khối chi tiết khi rê chuột.

---

### 16.3. Quy Trình Nhận Diện & Đánh Dấu Xử Lý Học Sinh Thiếu Mã HS Khi Đồng Bộ Google Sheets
- **Nguyên nhân nghiệp vụ:**
  - Trên các trang tính Google Sheet của lớp học, một số học sinh mới nhập học hoặc học sinh thử nghiệm chưa được văn phòng cấp mã học sinh chính thức (cột Mã HS bị trống), hoặc học sinh đã nghỉ học nhưng vẫn còn tên trên sheet.
- **Cơ chế phát hiện và gắn cờ cảnh báo (`category = 'missing_code'`):**
  - Khi quét dữ liệu từ Google Sheet (qua Apps Script hoặc File Excel/CSV): Nếu một dòng có tên học sinh nhưng không có mã học sinh (`!codeNorm`), hệ thống tự động phân loại vào nhóm `missing_code`.
  - Mặc định trạng thái duyệt của dòng này được đặt là `approved = false` để buộc Văn phòng/Admin phải chủ động kiểm tra và đưa ra quyết định xử lý, tránh tự động thêm dữ liệu rác hoặc ghi đè sai lệch.
- **Giao diện bảng duyệt phê duyệt đa năng:**
  - Badge trạng thái nổi bật: Hiển thị nhãn hổ phách `⚠ Thiếu Mã HS`.
  - Nút lọc nhanh riêng biệt: Thêm nút lọc `⚠ Thiếu Mã HS` (`data-sheets-approve-filter="missing_code"` và `data-panel-approve-filter="missing_code"`) trên thanh công cụ lọc của bảng duyệt (cả modal popup lẫn màn hình riêng `#mgmt-panel-sheets`) kèm bộ đếm số lượng trực quan.
  - Ô nhập Mã HS trực tiếp: Cho phép Văn phòng gõ cấp ngay mã học sinh mới cho học sinh đó (ví dụ gõ `K9.8888`).
  - Dropdown chọn Trạng thái học vụ: Cung cấp menu chọn nhanh trạng thái ngay trên dòng học sinh:
    * `Học`: Xác nhận học sinh đang học bình thường, cấp mã và đưa vào danh sách lớp.
    * `Nghỉ`: Đánh dấu học sinh đã nghỉ học; hệ thống lưu trữ với trạng thái Nghỉ để theo dõi lịch sử.
    * `Tạm nghỉ`: Ghi nhận học sinh bảo lưu hoặc tạm nghỉ học.
  - Phân bổ Lớp học: Cho phép chỉ định lớp mục tiêu từ sheet hoặc chuyển sang lớp khác trong hệ thống.
- **Xử lý khi bấm nút "Áp dụng đồng bộ":**
  - Nhánh xử lý `item.category === 'missing_code'` trong `applyApprovedSheetsSyncItems`:
    * Nếu đối chiếu thấy đã có học sinh trên hệ thống (theo Tên + Tên Phụ huynh/Trường): Cập nhật mã mới (nếu được cấp), cập nhật trạng thái học vụ và phân lớp.
    * Nếu là học sinh mới hoàn toàn: Tạo hồ sơ học sinh mới với mã được cấp (hoặc để trống nếu chưa cấp), gắn đúng trạng thái đã chọn (`Học` / `Nghỉ` / `Tạm nghỉ`), lưu vết thời gian và tăng `revision` chuẩn hóa.

---

### 16.4. Cơ Chế Đồng Bộ Chuẩn Real-Time Nút Bấm "Đồng Bộ Chuẩn Real-time" (Flush Outbound -> Pull Inbound -> Clean Reload)
- **Vấn đề kỹ thuật:**
  - Trong môi trường phân tán nhiều thiết bị (máy văn phòng, máy giáo viên, điện thoại trợ giảng), có những trường hợp dữ liệu ca trực mới mở, phân lớp mới hoặc học sinh mới chưa kịp tải về do cache trình duyệt hoặc delay kết nối WebSocket.
- **Quy trình 3 bước đảm bảo dữ liệu chuẩn 100%:**
  1. **Bước 1 - Phản hồi trực quan (Visual Feedback):**
     * Khi người dùng bấm vào huy hiệu `#realtime-sync-badge` trên thanh tiêu đề, badge lập tức chuyển sang trạng thái chờ: `Đang đồng bộ chuẩn...`, vô hiệu hóa tạm thời để tránh bấm đúp liên tục.
  2. **Bước 2 - Đồng bộ hai chiều (Upload Flush & Download Snapshot):**
     * **Upload Flush (`_flushFirebaseCloudPush(false, true)`):** Đẩy ngay lập tức toàn bộ các thay đổi cục bộ còn nằm trong hàng đợi outbound queue lên Firebase Cloud Realtime Database, đảm bảo không bị thất thoát bất kỳ thao tác nào người dùng vừa thực hiện.
     * **Download Snapshot (`pullFromFirebaseCloudNow('manual-reload')`):** Kéo toàn bộ bản chụp snapshot dữ liệu mới nhất từ Firebase Cloud về ghi đè vào hệ thống lưu trữ chuẩn của trình duyệt.
     * Tự động re-hydrate lại toàn bộ các kho dữ liệu bộ nhớ (`loadMasterData()`, `loadClassCatalog()`, `loadSessionHistory()`,...).
  3. **Bước 3 - Tải lại trang sạch (`window.location.reload()`):**
     * Hiển thị thông báo Toast `✓ Đã cập nhật dữ liệu chuẩn! Đang làm mới trang...`.
     * Sau 450ms, thực hiện `window.location.reload()` để khởi động lại toàn bộ UI component, bảng biểu, danh bạ, ca trực với dữ liệu chuẩn xác 100% từ đám mây.

---

### 16.5. Đánh Dấu Phiên Bản v5.0 Toàn Hệ Thống
- Phiên bản ứng dụng chính thức được nâng lên `v5.0`.
- Thẻ thương hiệu góc trái thanh điều hướng chính: `<span class="brand-version-badge" title="Phiên bản hệ thống">v5.0</span>`.
- Màn hình đăng nhập hệ thống: `<span class="brand-version-badge" title="Phiên bản hệ thống">v5.0</span>`.
- Tiêu đề trang (Page `<title>`): `Quản lý học sinh · Hệ thống quản lý lớp học trung tâm (v5.0)`.
- Tài liệu kiến trúc và đặc tả GitHub Spec Kit: Cập nhật lên phiên bản chuẩn `v5.0`.

---

### 16.6. Tinh Chỉnh Giao Diện Khớp Dữ Liệu, Sửa Lỗi Bảng Duyệt Google Sheet, Nâng Cấp Tab Chấm Công & Bảo Toàn Bo Góc Dialog Popup

#### 16.6.1. Sửa Lỗi Hiển Thị Bảng Duyệt Học Sinh Đồng Bộ Google Sheet
- **Nguyên nhân kỹ thuật:** Khối mã lắng nghe sự kiện bảng duyệt (`renderSheetsApprovalTable`) tham chiếu biến cục bộ `tbody` chưa được định nghĩa thay vì danh sách `tbodies`, gây lỗi `ReferenceError` làm gián đoạn quá trình gán nội dung `innerHTML` vào bảng.
- **Giải pháp:**
  - Chuẩn hóa quy trình: gán nội dung HTML dòng duyệt đồng thời cho cả modal dialog (`#sheets-approval-tbody`) và trang phân hệ riêng (`#panel-sheets-approval-tbody`).
  - Gắn sự kiện lắng nghe tương tác (`[data-approve-status-select]`, `[data-approve-item-cb]`, `[data-approve-code-input]`, `[data-approve-target-class]`, `[data-approve-class-action]`, `[data-approve-new-tag-cb]`) xuyên suốt toàn bộ DOM cây bảng duyệt.
  - Bảng duyệt lập tức hiển thị đầy đủ, mượt mà danh sách học sinh mới, học sinh đổi lớp, cập nhật mã HS và cảnh báo `⚠ Thiếu Mã HS`.

#### 16.6.2. Nâng Cấp Toàn Diện Tab Chấm Công TA & Lớp Bổ Trợ
- **Tab Chấm công (`renderTAPortal`):**
  - Bổ sung bộ chọn Nhân sự linh hoạt (`#portal-employee-select`) trên thanh công cụ: cho phép Quản trị viên (`admin`) và Văn phòng (`office`) tra cứu nhanh bảng chấm công của từng nhân sự hoặc xem "Tất cả nhân sự" toàn trung tâm.
  - Quét dữ liệu ca trực thực tế trực tiếp từ kho lưu trữ lịch sử buổi học (`loadSessionHistory`): tổng hợp chính xác các ca đã kết thúc, ca đã điểm danh, đối chiếu giờ dạy thực tế, thời điểm chốt ca và tên người xác nhận thay vì chỉ tính toán trên lịch cố định trong tuần.
  - Tính toán tự động tổng số ca, tổng số giờ làm việc thực tế và tỷ lệ tuân thủ quy trình đầu giờ.
- **Tab Lớp Bổ trợ & Học bù (`renderTutoringModule`):**
  - Tích hợp đa nguồn: kết hợp các ca bổ trợ / gia sư 1-kèm-1 trực tiếp (`loadTutoringSessions`) cùng danh sách học sinh đăng ký học bù (`getMakeupStudents`) và lịch sử học sinh học bù ghi nhận từ các buổi học đã diễn ra (`sess.makeupStudents`).
  - Tự động hiển thị thẻ ca học bù / ca bổ trợ với đầy đủ thông tin: lớp học, trợ giảng phụ trách, nội dung bài giảng, trạng thái phiếu bài tập và đánh giá học tập.

#### 16.6.3. Tối Ưu Nút Xác Nhận Chuyển Lớp Trong Menu Khớp Dữ Liệu
- **Khắc phục lỗi hiển thị:** Thay thế bố cục nút dạng inline chật hẹp bằng dạng danh thiếp tương tác toàn chiều rộng (`display: flex; width: 100%`).
- **Nội dung trực quan:**
  - Nút 1: `⇄ Có, chuyển lớp sang [Mã lớp] (Khuyên dùng)` - Chuyển học sinh sang lớp mới và bảo lưu đầy đủ lịch sử lớp cũ.
  - Nút 2: `+ Thêm học song song cả [Mã lớp]` - Giữ nguyên lớp cũ và bổ sung lớp mới vào hồ sơ.
  - Nút 3: `Không chuyển lớp (Chỉ đính dữ liệu buổi học vào hồ sơ)` - Giữ nguyên lớp hiện tại trong danh sách tổng, chỉ lưu vết dữ liệu buổi học.
- Đảm bảo độ tương phản cao, phông chữ to rõ, đường viền mềm mại và phản hồi rê chuột (hover) sắc nét.

#### 16.6.4. Nâng Cấp Nút Đóng Menu Khớp Dữ Liệu
- Thay thế hoàn toàn ký tự `×` đơn sơ bằng nút bấm tròn đóng chuẩn hệ thống (`class="close-button"`) với biểu tượng SVG nét thanh đơn sắc (`currentColor`, stroke 2.5px).
- Bố trí góc trên bên phải tiêu đề đối thoại (`.dialog-header`), có khoảng đệm an toàn, viền tròn bo cong thanh thoát (`border-radius: 50%`) và hiệu ứng chuyển màu đỏ nhạt (`#fee2e2`) khi rê chuột.

#### 16.6.5. Tinh Chỉnh Thanh Cuộn Popup Triệt Tiêu Lỗi Vuông 2 Góc Phải
- **Nguyên nhân:** Thanh cuộn mặc định của trình duyệt Windows là khối chữ nhật góc vuông 90 độ, khi hiển thị trên các thẻ `<dialog>` có bo góc (`border-radius: 16px`) sẽ đè lên đường viền cong ở góc trên-phải và góc dưới-phải, làm méo mó thẩm mỹ giao diện.
- **Giải pháp CSS chuyên sâu:**
  - Áp dụng chuẩn `scrollbar-width: thin; scrollbar-color: rgba(148, 163, 184, 0.45) transparent;` trên tất cả dialog popup.
  - Thêm quy tắc `margin: 16px 0 !important;` trên `::-webkit-scrollbar-track` cho tất cả các phần tử dialog, modal, dialog-body và bảng biểu popup: giữ cho vệt cuộn và con trượt luôn cách mép trên và mép dưới tối thiểu 16px.
  - Kết quả: Giữ trọn vẹn 100% đường cong bo tròn tinh tế của cả 4 góc popup, không bao giờ bị thanh cuộn cắt góc vuông.


---

### 16.7. Quy Trình Tự Động Ghép Hồ Sơ Khi 2 Học Sinh Chung Một Mã Học Sinh (Student Code Unification & Profile Merging)
- **Yêu cầu nghiệp vụ:**
  - Khi hai học sinh có chung một mã học sinh (`studentCode`), hệ thống sẽ ghép 2 bộ hồ sơ đó làm một (gộp toàn bộ dữ liệu của cả hai học sinh vào nhau mà không làm thất thoát bất kỳ thông tin nào).
- **Quy tắc gộp dữ liệu (`mergeTwoStudentProfiles(primary, secondary)`):**
  1. **Lớp học (`classIds` & `previousClassIds`):** Gộp hợp nhất mảng lớp học (`classIds = [...new Set([...s1.classIds, ...s2.classIds])]`). Toàn bộ lớp cũ trước đó (`previousClassIds`) và lịch sử chuyển lớp (`classTransferHistory`) từ cả 2 hồ sơ được giữ nguyên vẹn.
  2. **Lịch sử điểm danh (`attendanceHistory`):** Ghép nối theo cặp khóa duy nhất `classId_date`. Nếu có bản ghi trạng thái có mặt thực tế, ưu tiên bản ghi có dữ liệu chi tiết hơn.
  3. **Lịch sử vị trí ngồi (`seatingHistory`):** Ghép nối toàn bộ dữ liệu vị trí ngồi theo từng buổi học.
  4. **Điểm số (`scores`):** Ghép nối toàn diện theo bộ ba `classId_date_type` (BTVN, Test, Thi giữa kỳ, Thi cuối kỳ...).
  5. **Ghi chú buổi học (`sessionNotes`):** Ghép nối theo `classId_date`. Nếu cả hai hồ sơ đều có ghi chú trong cùng buổi, hệ thống tự động nối chuỗi bằng ký tự ngăn cách ` | ` để không làm mất nhận xét của giáo viên/trợ giảng.
  6. **Ghi chú học lực dài hạn (`learningNotes`):** Nối ghi chú của cả hai học sinh nếu nội dung không trùng lặp (`${note1}; ${note2}`).
  7. **Tag chuyên môn (`tags`):** Gộp toàn bộ tag phân loại học sinh từ cả hai bộ hồ sơ, đồng thời tự động loại bỏ triệt để các tag năm sinh/khóa bằng `cleanStudentTags`.
  8. **Thông tin liên hệ & trường học:** Giữ lại thông tin trường học (`school`) và tên phụ huynh (`parentContact.name`) từ hồ sơ đầy đủ nhất.
  9. **Tái trỏ ghế ngồi và danh sách đi muộn trong ca:**
     - Các bàn ghế trên sơ đồ lớp học (`deskItems`) đang trỏ đến ID học sinh bị gộp sẽ được tự động đổi sang ID học sinh còn lại, loại bỏ ghế trùng nếu có.
     - Danh sách học sinh đi muộn (`lateQueue`) và điểm trong ca (`checklist.hwScores`, `checklist.testScores`) được tự động cập nhật sang ID hồ sơ sống.
  10. **Bảo toàn thời gian và phiên bản:** Thời gian tạo hồ sơ (`createdAt`) lấy mốc thời gian sớm nhất; thời gian cập nhật (`updatedAt`) lấy mốc mới nhất; số phiên bản (`revision`) được cộng dồn để kích hoạt đồng bộ chuẩn xác.
- **Phạm vi tự động thực thi:**
  - **Khi nạp dữ liệu (`loadStudentRecords`):** Tự động phát hiện và gộp mọi hồ sơ trùng mã HS có trong bộ nhớ.
  - **Khi lưu dữ liệu (`saveStudentRecords`):** Đảm bảo danh sách học sinh luôn được deduplicate và gộp dữ liệu trước khi ghi xuống `localStorage` hoặc đồng bộ Firebase.
  - **Khi chỉnh sửa hồ sơ (`#save-student-profile`):** Nếu người dùng nhập mã HS trùng với một học sinh khác, hệ thống tự động gộp 2 hồ sơ làm một và thông báo: *"✓ Đã ghép 2 bộ hồ sơ có chung mã HS '[Mã HS]' làm một."*
  - **Khi duyệt Google Sheets (`applyApprovedSheetRows`):** Nếu học sinh mới duyệt có mã trùng với học sinh đã tồn tại, dữ liệu lớp học, tag và ghi chú sẽ được gộp trực tiếp vào hồ sơ hiện có.
  - **Khi nhập file Excel/CSV (`importStudents`):** Tự động hợp nhất dữ liệu vào hồ sơ đã có nếu trùng mã học sinh.


---

### 16.8. Quy Chuẩn Thống Kê Sĩ Số & Điểm Danh Tại Đầu Tab Danh Sách Học Sinh
- **Nguyên lý tính Sĩ số lớp (Active Headcount):**
  - Trong thẻ tỉ lệ `#list-roster-attendance-count` (`Đã điểm danh / Sĩ số lớp`) và nhãn tổng `#session-student-total`:
    * Sĩ số lớp (`activeCount`) **chỉ tính trên tổng số học sinh đang theo học** (học sinh có trạng thái `enrollmentStatus === 'Học'` hoặc chưa có trạng thái).
    * Tuyệt đối không tính các học sinh đã nghỉ học, tạm nghỉ (`Nghỉ`, `Tạm nghỉ`, `Chưa nhập học`, `Trùng`) vào sĩ số lớp của ca học.
- **Tổng số học sinh Vắng mặt bao gồm cả Chưa điểm danh:**
  - Tại thẻ đếm `#list-absent-count` (`Vắng mặt`) và bộ lọc vắng mặt `filter === 'absent'`:
    * Hệ thống đếm toàn bộ các học sinh trong danh sách lớp đang theo học mà chưa có mặt và chưa đi muộn trong buổi học:
      - Học sinh có trạng thái vắng mặt cụ thể (`absent`, `absent_excused`, `absent_unexcused`).
      - Học sinh có trạng thái chưa điểm danh (`unrecorded`, `unmarked`, hoặc chưa có trạng thái điểm danh).
    * Công thức tổng quát: `Vắng mặt = Sĩ số đang học - (Có mặt + Đi muộn trong DS lớp)`.
    * Giúp giáo viên và trợ giảng nắm bắt ngay tức thì số lượng học sinh chưa đến lớp / không đi học mà không cần chờ thao tác chốt ca thủ công.

---

## 17. ĐẶC TẢ CHI TIẾT NÂNG CẤP HỆ THỐNG PHIÊN BẢN 5.1 (v5.1 RELEASE SPECIFICATION)

### 17.1. Chuẩn Hóa Bảo Toàn Vai Trò Tài Khoản Văn Phòng (`office`) & Truy Cập Lớp Cho Tài Khoản Nhân Viên
- **Nguyên nhân cốt lõi đã xử lý:**
  - Cơ chế `resolveVerifiedSignedInAccount` trước đây khi tài khoản chưa được nạp tức thời vào `masterData.employees` trên thiết bị client sẽ trả về `null`, dẫn đến phiên đăng nhập bị rơi về mặc định vai trò `assistant` với `currentEmployeeId = null`.
  - Tầng `normalizeEmployeeAccount` trước đây thiếu quy tắc bảo toàn vai trò nhận diện từ mã tài khoản (`VP...`, `OFFICE...`, `VANPHONG...`), dẫn đến việc tài khoản Văn phòng bị hạ cấp thành Trợ giảng khi đối soát.
  - Khi đăng nhập thành công qua Firebase Auth, hệ thống lưu `signedInAccount` trước khi `masterData` được đồng bộ và cập nhật, gây ra xung đột rỗng danh sách lớp phụ trách đối với các tài khoản không phải Admin (`assistant`, `teacher`).
- **Quy chuẩn kiến trúc bảo mật v5.1:**
  1. **Tự động nhận diện và bảo toàn vai trò Văn phòng (`office`):** Mọi mã tài khoản bắt đầu bằng `VP`, `OFFICE`, `VANPHONG` hoặc có vai trò được chỉ định là `office` sẽ được bảo toàn tuyệt đối là `role: 'office'`. Không bao giờ bị ép chuyển hoặc hạ cấp thành `assistant`.
  2. **Tự động hydrate hồ sơ nhân sự vào `masterData`:** Khi người dùng đăng nhập hợp lệ nhưng dữ liệu máy trạm chưa kịp tải xong từ Cloud, `resolveVerifiedSignedInAccount` tự động khởi tạo và lưu tài khoản vào danh mục `masterData.employees` với đầy đủ `id`, `code`, `name`, `role`, giúp `currentEmployeeId` và `signedInAccount` luôn hợp lệ 100%.
  3. **Đồng bộ Cloud tức thì sau xác thực:** Ngay khi `loginWithStaffCode` thành công, hệ thống gọi `pullFromFirebaseCloudNow('auth-login')` để nạp dữ liệu nhân sự và danh mục lớp mới nhất từ Firebase Realtime Database trước khi hoàn tất phiên làm việc.
  4. **Quyền truy cập lớp học chuẩn xác:**
     - Vai trò `admin` và `office` luôn xem được toàn bộ danh sách lớp học và dữ liệu xuyên lớp (`canAccessCrossClassData() === true`).
     - Vai trò `assistant` và `teacher` được hiển thị đầy đủ, chính xác các lớp mà mình được phân công theo `teacherIds`, `assistantIds`, `teacherId`, `assistantId`, hoặc tên hiển thị trong danh mục lớp (`isClassAssignedToCurrentAccount`).

### 17.2. Quy Chuẩn Cập Nhật Số Phiên Bản Toàn Diện (Universal Version Bump Standard)
- Mỗi khi thực hiện bất kỳ sửa đổi, bổ sung tính năng hoặc sửa lỗi nào trên toàn bộ mã nguồn:
  - Cập nhật số phiên bản đồng bộ tại:
    * Tiêu đề tài liệu và mục đặc tả trong `ARCHITECTURE_AND_WORKFLOW_SPEC.md` (`v5.1`).
    * Tiêu đề ứng dụng `<title>` trong `index.html` (`v5.1`).
    * Huy hiệu phiên bản thanh điều hướng `.brand-version-badge` trong `index.html` (`v5.1`).
    * Chuỗi tham số chống cache (cache buster) cho CSS và các script module ES6 (`/src/styles.css?v=5.1.0`, `/src/app.js?v=5.1.0`, và các import liên module `?v=5.1.0`).
    * Hằng số `APP_VERSION = "5.1.0"` trong `src/app.js`.
    * Thông báo trợ giúp hệ thống `#system-help-btn` trong `src/features.js`.

### 17.3. Phạm Vi Dữ Liệu Tab Ca Bổ Trợ & Gia Sư (Strict Tutoring & Makeup Module Scoping)
- **Quy chuẩn lọc danh sách ca học bù trong Tab Lớp bổ trợ & Học bù:**
  - Tab "Lớp bổ trợ & Gia sư" (`#tutoring-view` / `#tutoring-session-list`) chỉ hiển thị:
    * Các ca bổ trợ, gia sư 1-kèm-1 và ca học bù được tạo trực tiếp qua module Bổ trợ (`loadTutoringSessions()`).
    * Các buổi học chuyên biệt do Trợ giảng phụ trách (buổi học có `classId === 'class-tutoring'`, hoặc `isTutoring === true`, hoặc mã lớp `BOTRO`).
    * Các yêu cầu học bù chỉ định cụ thể cho ca bổ trợ do Trợ giảng kèm (`isTutoringSession === true` hoặc `classId === 'class-tutoring'`).
  - **Loại trừ tuyệt đối học sinh học bù ở lớp khác:** Nếu học sinh nghỉ học ở lớp này và được xếp đi học bù ghép vào một lớp chính khóa thông thường khác (ví dụ: học sinh lớp 8A sang học bù tại lớp 8B), buổi học đó thuộc về lớp chính khóa của Giáo viên, **hoàn toàn không được hiển thị** trong Tab Ca bổ trợ & Gia sư.

### 17.4. Đổi Nút "Quét Google Sheet" Thành Nút "Kiểm Tra Đồng Bộ" Đa Khóa
- **Tên nút giao diện:** Đổi từ *"Quét Google Sheet: Tìm HS mới & HS khác lớp gốc"* thành **"Kiểm tra đồng bộ"** (`#panel-pull-sheets-sync-btn` và `#pull-sheets-sync-btn`).
- **Phạm vi quét:** Tự động quét toàn bộ các khóa học sinh được cấu hình trong hệ thống (2K9, 2K10, 2K11, 2K12, 2K13) qua hàm `pullStudentsFromGoogleSheetsMultiCohort(cfg)`.
- **Nguyên tắc hiển thị bảng duyệt lọc sạch (Clean Approval Scoping):**
  - **Chỉ hiển thị các trường hợp cần xử lý:**
    1. **Học sinh mới (`new_student`):** Học sinh có trên Google Sheet nhưng chưa từng có trong cơ sở dữ liệu học sinh của trung tâm.
    2. **Chuyển lớp / Khác lớp gốc (`class_change`):** Học sinh đã có trên hệ thống nhưng thông tin lớp học trên Sheet khác với lớp gốc đang theo học.
    3. **Thông tin chưa khớp (`code_update` / `info_mismatch`):** Học sinh cùng lớp nhưng có thay đổi/lệch về Mã học sinh, Trường học, Tên phụ huynh, Trạng thái học tập hoặc có Tag mới.
    4. **Thiếu mã học sinh (`missing_code`):** Các dòng trên Sheet chưa được điền Mã học sinh để Văn phòng rà soát.
  - **Bỏ qua 100% các học sinh đã khớp hoàn toàn:** Những học sinh có thông tin trùng khớp hoàn toàn giữa Sheet và Web sẽ được tự động bỏ qua (`unchangedCount++`), không hiển thị vào bảng duyệt để tránh làm rối mắt và tiết kiệm thao tác cho nhân sự Văn phòng.
  - Nếu tất cả học sinh đã khớp hoàn toàn (không có trường hợp nào phát hiện lệch), hệ thống sẽ thông báo: *"✓ Đã kiểm tra đồng bộ: Tất cả học sinh, Mã HS và Lớp học đều đã khớp 100% với danh sách hiện tại."*

---

## 18. ĐẶC TẢ CHI TIẾT NÂNG CẤP HỆ THỐNG PHIÊN BẢN 5.2 (v5.2 RELEASE SPECIFICATION)

### 18.1. Khắc Phục Triệt Để Lỗi Hoán Đổi Vai Trò & Bảo Toàn Vai Trò Tuyệt Đối
- **Nguyên nhân cốt lõi đã xử lý:**
  1. Trong hàm `updateCurrentUserDisplay()` (`src/features.js`), việc tìm kiếm tài khoản nhân sự chỉ dựa vào so khớp chính xác `e.id === account?.employeeId`. Khi tài khoản đăng nhập trên máy mới chưa kịp tải xong `masterData.employees` từ Firebase Realtime Database hoặc ID có sự sai lệch nhỏ, hàm đã rơi vào giá trị dự phòng cứng `{ role: 'assistant', name: 'Chưa đăng nhập' }`, dẫn đến việc tài khoản Văn phòng (`VP...`) và Giáo viên (`GV...`) bị ghi đè thành nhãn **"Trợ giảng"** ở góc trên màn hình.
  2. Trong hàm `normalizeEmployeeAccount()` và tầng suy đoán vai trò, tiền tố `c.includes('GV')` đã vô tình biến các tài khoản Trợ giảng có chứa ký tự `GV` thành Giáo viên, trong khi cơ chế đối soát tài khoản của Giáo viên lại thiếu nhận diện đầy đủ tiền tố dẫn đến việc suy đoán ngược thành Trợ giảng.
  3. Bộ lọc dọn dẹp tài khoản mẫu (`MOCK_DEFAULT_CODES = ['TA001', 'GV001', 'VP001'...]`) trước đây tự động xóa bỏ các mã nhân sự chuẩn của trung tâm khi tải dữ liệu từ LocalStorage hoặc đồng bộ Cloud, khiến hồ sơ nhân viên thực sự bị xóa mất trên client và buộc hệ thống phải tự sinh lại tài khoản tạm không trùng khớp.
- **Quy chuẩn kiến trúc bảo mật v5.2:**
  - **Tôn trọng 100% vai trò chuẩn xác thực:** Trong `normalizeEmployeeAccount()`, nếu trường `role` đã được chọn rõ ràng là `admin`, `office`, `teacher`, hoặc `assistant`, hệ thống bảo toàn tuyệt đối vai trò đó. Không bao giờ hoán đổi hay tự ý hạ cấp/nâng cấp vai trò giữa Giáo viên và Trợ giảng.
  - **Hiển thị vai trò kiên cố trên thanh tiêu đề (`updateCurrentUserDisplay`):** So khớp nhân viên linh hoạt theo cả `e.id` lẫn `e.code`. Trong mọi tình huống kể cả khi danh mục Cloud chưa kịp nạp, hệ thống ưu tiên đọc trực tiếp `account.role`, `account.name`, `account.code` từ phiên đăng nhập hợp lệ. Tài khoản Văn phòng luôn hiển thị chuẩn *"Văn phòng"*, Giáo viên hiển thị *"Giáo viên"*, Trợ giảng hiển thị *"Trợ giảng"*.
  - **Bỏ hoàn toàn việc xóa tài khoản theo mã:** Loại bỏ danh sách `MOCK_DEFAULT_CODES`. Chỉ những bản ghi có tiền tố ID rõ ràng là `mock-` hoặc `employee-mock-` mới được coi là dữ liệu mẫu cũ.

### 18.2. Khôi Phục Quyền Hiển Thị Lớp Học Toàn Diện Cho Toàn Bộ Tài Khoản Nhân Viên
- **Văn phòng (`office`):**
  - Hàm `getVisibleClassesForAccount()` trả về toàn bộ danh mục lớp (`classCatalog`) cho tài khoản Văn phòng tương tự Admin, đáp ứng trọn vẹn nghiệp vụ quản lý, giám sát và điều phối lớp của khối Văn phòng.
- **Giáo viên (`teacher`) & Trợ giảng (`assistant`):**
  - Thuật toán kiểm tra phân công `isClassAssignedToCurrentAccount()` được nâng cấp so khớp đa tầng:
    1. So khớp ID (`targetIds.has(id)`).
    2. So khớp Mã nhân viên (`targetCodes.has(normId)`).
    3. So khớp Mã nhân viên chịu lỗi số 0 (`normalizeLeadingZerosToken`: mã `GV01` khớp `GV001`, `TA01` khớp `TA001`).
    4. So khớp Họ tên có gập dấu tiếng Việt (`foldAccountIdentifier`) và tự động bóc tách chuỗi nhiều nhân sự ngăn cách bởi dấu phẩy hoặc chấm phẩy (ví dụ: `"Nguyễn Thị Hương Giang, Nguyễn Thành Công"`).
    5. So khớp cả các buổi học có sự phân công thay đổi ca / dạy thay trong `sessionChanges`.
  - Mọi Giáo viên và Trợ giảng khi đăng nhập đều nhìn thấy đầy đủ 100% các lớp mình phụ trách tại:
    * Thẻ ca hôm nay (`#ongoing-shift-list`)
    * Danh sách lớp phụ trách (`#upcoming-shift-list`)
    * Danh mục quản lý lớp (`#all-classes-quick-list` & `#managed-class-list`)

### 18.3. Quy Chuẩn Đồng Bộ Phiên Bản v5.2
- Hệ thống được nâng cấp đồng bộ lên phiên bản **v5.2** (`v5.2.0`) trên toàn bộ các tệp cấu hình, giao diện và mã nguồn (`index.html`, `src/app.js`, `src/features.js`, `src/data/class-catalog-repository.js`, `ARCHITECTURE_AND_WORKFLOW_SPEC.md`).
- Tuân thủ tuyệt đối quy tắc Zero-Emoji (chỉ dùng chữ và ký hiệu đơn sắc chuẩn), hiệu năng tức thì (0ms) và bảo mật dữ liệu cao nhất.

---

## 19. ĐẶC TẢ KIẾN TRÚC ĐỒNG BỘ GOOGLE SHEETS & DUYỆT THÔNG TIN PHIÊN BẢN 5.3 (v5.3 RELEASE SPECIFICATION)

### 19.1. Quy Tắc Phân Loại Học Sinh Mới (`new_student`)
- **Điều kiện hiển thị:** Chỉ những học sinh có Mã học sinh hợp lệ trên Google Sheet và Mã học sinh này **chưa từng tồn tại trong cơ sở dữ liệu** (`!existingStuByCode`) mới được xếp vào nhóm "Học sinh mới".
- **Không tự động coi là mới nếu thiếu mã:** Nếu dòng dữ liệu trên Sheet thiếu Mã học sinh, hệ thống chuyển sang nhóm "Thiếu Mã HS" (`missing_code`) để Văn phòng rà soát, không tự động đưa vào "Học sinh mới" tránh tạo trùng lặp hồ sơ.
- **Bảo toàn dữ liệu đã có:** Nếu Mã học sinh đã có trong database, học sinh đó **tuyệt đối không bao giờ** xuất hiện trong nhóm "Học sinh mới".

### 19.2. Quy Tắc Khác Lớp Gốc / Chuyển Lớp (`class_change`)
- **Điều kiện hiển thị:** Chỉ kích hoạt khi lớp học của học sinh trên Sheet **thực sự khác với lớp gốc** đã được phân công trong cơ sở dữ liệu (`hasSheetClassInfo && hasNewClass`).
- **Nghiệp vụ lớp gốc:**
  - Nếu học sinh trong database đang học lớp T5, và trên Sheet cũng ghi lớp T5 -> Cùng lớp gốc -> **Không xem là chuyển lớp** (`isClassDifferent = false`).
  - Nếu học sinh trong database học 2 lớp [T2, T5], và trên Sheet ghi lớp T5 -> Lớp T5 đã nằm trong danh sách lớp gốc của học sinh -> **Không xem là chuyển lớp**.
  - Nếu học sinh trong database học lớp T2, nhưng trên Sheet ghi lớp T5 -> Lớp T5 chưa có trong lớp gốc -> **Xác định là Chuyển lớp / Khác lớp gốc** (`class_change`).
  - Nếu dòng trên Sheet không có cột lớp hoặc để trống thông tin lớp -> Giữ nguyên lớp gốc trong database, không báo chuyển lớp.

### 19.3. Chuyển Đổi "Cập Nhật Mã HS" Thành "Cập Nhật Thông Tin" (`code_update`)
- **Đổi tên toàn diện trên UI & Mã:** Toàn bộ nút lọc, tab duyệt, badge phân loại và thông báo tóm tắt được đổi từ *"Cập nhật Mã HS"* thành **"Cập nhật thông tin"**.
- **Chỉ hiển thị khi có thông tin khác biệt:** Hệ thống đối soát từng trường dữ liệu giữa Google Sheet và Database:
  1. **Mã học sinh:** Khác mã hoặc gán mã mới cho học sinh chưa có mã.
  2. **Họ và tên:** Tên trên Sheet khác với tên trong database.
  3. **Trạng thái học:** Sheet có trạng thái học khác với database (chỉ so sánh khi Sheet có cung cấp trạng thái thực tế).
  4. **Tags:** Sheet có các tag mới chưa có trong database.
  5. **Trường học & Phụ huynh:** Khác tên trường hoặc khác tên phụ huynh.
  6. **Điểm số & Buổi học:** Có cập nhật điểm BTVN, điểm Test hoặc ghi chú buổi học.
- **Tự động bỏ qua 100% học sinh đã khớp:** Nếu một học sinh cùng lớp gốc và tất cả thông tin trên Sheet trùng khớp 100% với database, hệ thống tự động bỏ qua (`unchangedCount++`), hoàn toàn không đưa vào bảng duyệt.

### 19.4. Quy Tắc Mặc Định Trạng Thái Học (`enrollmentStatus`) Khi Quét Google Sheet / Excel
- **Có cột Trạng thái trên Sheet (`hasStatusCol = true`):** Nếu ô trạng thái của dòng học sinh bị bỏ trống, hệ thống mặc định gán là `'Nghỉ'` (vẫn nhập thông tin vào hệ thống với trạng thái Nghỉ theo Mục 13.8).
- **Không có cột Trạng thái trên Sheet (`hasStatusCol = false`):** Biến phân tích mặc định là chuỗi rỗng `''` khi đồng bộ Google Sheets (giữ nguyên trạng thái hiện tại trên Web hoặc gán `'Học'` cho học sinh mới), hoặc `'Học'` khi nhập từ file Excel, giúp loại bỏ hoàn toàn hiện tượng 100% học sinh bị báo sai lệch trạng thái sang `'Nghỉ'`.

---

## 20. ĐẶC TẢ PHẦN "CÁC LỚP ĐÃ HỌC & LỊCH SỬ HỌC TẬP" TRONG HỒ SƠ THÔNG TIN CHUNG (v5.4 RELEASE SPECIFICATION)

### 20.1. Mục Tiêu & Vị Trí Giao Diện
- **Vị trí tích hợp:** Ngay bên dưới trường *"Các lớp đang theo học"* trong hộp thoại Hồ sơ thông tin chung học sinh (`#student-profile-dialog` - hàm `openStudentProfile()` trong [`src/app.js`](file:///d:/OneDrive%20-%20Hanoi%20University%20of%20Science%20and%20Technology/Documents/t-i-bi-t-m-i-2/src/app.js)).
- **Mục tiêu:** Cung cấp cho Ban giám đốc, Giáo viên và Nhân sự văn phòng cái nhìn toàn diện 360 độ về lộ trình học tập của học sinh tại trung tâm từ trước đến nay, bao gồm:
  1. Các lớp cũ từng theo học (lớp đã chuyển hoặc hoàn thành).
  2. Các ca bổ trợ & gia sư (1 kèm 1 hoặc nhóm nhỏ).
  3. Các ca học bù tại lớp khác.

### 20.2. Cấu Trúc Dữ Liệu & Nguồn Tổng Hợp
- **Nhóm 1: Lớp cũ từng theo học (`old_class`):**
  - Nguồn tổng hợp: `student.previousClassIds`, `student.classTransferHistory`, `student.attendanceHistory`, `student.scores`. Loại trừ tất cả các lớp học sinh đang trực tiếp theo học (`enrolledClassIds`) và lớp bổ trợ ảo.
  - Thông tin hiển thị: Mã lớp, Tên lớp, Khối/Năm sinh, Ngày chuyển lớp (nếu có lịch sử chuyển lớp).
  - Tương tác nhanh: Nút liên kết `↗` cho phép mở thẳng sang Hồ sơ học sinh theo lớp chuyên sâu (`openStudentClassProfile`) để tra cứu lịch sử bảng điểm và điểm danh chi tiết của lớp cũ.
- **Nhóm 2: Ca bổ trợ & Gia sư (`tutoring`):**
  - Nguồn tổng hợp: Kho ca bổ trợ trung tâm `loadTutoringSessions()`, đối soát tự động theo ID học sinh, Mã học sinh hoặc Họ tên.
  - Thông tin hiển thị: Ngày học, Khung giờ / Thời lượng ca học, Nhân sự phụ trách (Trợ giảng / Gia sư), Nội dung kiến thức bổ trợ / ghi chú học tập.
- **Nhóm 3: Học bù lớp khác (`makeup`):**
  - Nguồn tổng hợp: Danh sách ca học bù của học sinh (`student.makeupSessions`), danh sách học sinh học bù của ca làm (`makeupStudents`), và lịch sử điểm danh ghi nhận diện học bù (`attendanceHistory.status === 'makeup'`).
  - Thông tin hiển thị: Lớp học bù (Mã lớp & Tên lớp), Ngày học bù, Lớp gốc của học sinh, Ghi chú lý do học bù.

### 20.3. Cơ Chế Cập Nhật Tự Động & Trạng Thái Rỗng
- **Đồng bộ khi chỉnh sửa lớp:** Khi Văn phòng gỡ một lớp khỏi mục *"Các lớp đang theo học"* trong chế độ chỉnh sửa, lớp đó sẽ tự động được ghi nhận vào `student.previousClassIds` và chuyển sang danh mục *"Lớp cũ từng học"*.
- **Trạng thái rỗng:** Nếu học sinh là học sinh mới chưa từng có lịch sử lớp cũ, bổ trợ hay học bù, hệ thống hiển thị dòng thông báo tinh tế: *"Chưa ghi nhận lớp cũ từng học, ca bổ trợ hay ca học bù nào."*

---

## 21. ĐẶC TẢ SỬA LỖI PHÂN QUYỀN VAI TRÒ NHÂN SỰ & HIỂN THỊ LỚP HỌC (v5.5 RELEASE SPECIFICATION)

### 21.1. Khắc Phục Lỗi Sai Vai Trò Nhân Sự (Role Misclassification & Inversion)
- **Nguyên nhân gốc rễ:**
  - Logic suy đoán vai trò cũ căn cứ theo tiền tố mã nhân viên (`VP...` cho Văn phòng, `GV...` cho Giáo viên, `TA...` cho Trợ giảng). Các tài khoản viết tắt tên thực tế (`LINHBMP`, `SANGHN`, `GIANGNH`) không có các tiền tố này nên đều bị rơi vào fallback mặc định là `assistant` (Trợ giảng).
  - Tài khoản trợ giảng `CONGNT` bị gán nhầm mã cứng `role: 'teacher'` trong `features.js`, dẫn đến việc Trợ giảng biến thành Giáo viên.
  - Các bản ghi bị lỗi được lưu vào `localStorage` (`lopvui.signed-in-account.v1`, `lopvui.master-data.v3`) và Firebase mà không có cơ chế tự phục hồi (Self-Healing).
- **Quy chuẩn vai trò chuẩn hóa trung tâm:**
  - `LINHBMP`: Văn phòng (`office`) - Tên hiển thị: **Bùi Minh Phương Linh**
  - `SANGHN`: Văn phòng (`office`) - Tên hiển thị: **Hoàng Ngọc Sáng**
  - `CONGNT`: Trợ giảng (`assistant`) - Tên hiển thị: **Nguyễn Thành Công**
  - `GIANGNH`: Giáo viên (`teacher`) - Tên hiển thị: **Nguyễn Thị Hương Giang**
  - `AD001` / `ADMIN`: Quản trị viên (`admin`) - Tên hiển thị: **Quản trị hệ thống**
- **Cơ chế tự phục hồi (Self-Healing):**
  - Trong `normalizeEmployeeAccount` (`src/data/class-catalog-repository.js`), hệ thống lấy vai trò và họ tên trực tiếp từ Tab Quản lý nhân sự (`masterData.employees`) làm nguồn chân lý duy nhất, tự động lọc sạch các đại từ nhân xưng.
  - Trong `resolveVerifiedSignedInAccount` (`src/app.js`), khi người dùng đăng nhập hoặc tải lại trang, bản ghi lưu trữ phiên làm việc cũ bị hỏng sẽ được tự động sửa và ghi đè lại vào `localStorage`.
  - Trong `handleLoginByCredentials` (`src/features.js`), loại bỏ hoàn toàn đoạn gán nhầm `CONGNT` là giáo viên, tự động nạp vai trò đúng khi xác thực thành công.

### 21.2. Khắc Phục Triệt Để Lỗi Không Thấy Lớp Học Cho Tài Khoản Không Phải Admin
- **Nguyên nhân gốc rễ:**
  - Tài khoản Văn phòng (`LINHBMP`, `SANGHN`) bị gán nhầm `assistant`. Theo phân quyền, trợ giảng chỉ xem lớp mình được phân công dạy kèm. Do văn phòng không đứng lớp, hệ thống lọc ra 0 lớp học.
  - Tài khoản Giáo viên (`GIANGNH`) bị gán nhầm `assistant`, trong khi các lớp học phân công `GIANGNH` ở vị trí Giáo viên.
  - Hàm kiểm tra phân công `isClassAssignedToCurrentAccount()` chỉ kiểm tra ID nhân sự trong mảng `teacherIds`/`assistantIds` mà **hoàn toàn không kiểm tra Mã lớp, Tên lớp** (như `2K9.H4.GIANGNH`, `2K9.H3.GIANGNH`).
  - Hàm so khớp tên `matchesStaff()` trước đây so sánh chuỗi chặt chẽ, chưa tự động bóc tách các tiền tố xưng hô nếu người dùng lỡ gõ thừa.
- **Giải pháp xử lý:**
  1. **Quyền hạn Văn phòng (`office`):** Có toàn quyền xem và quản lý tất cả các lớp học như Admin (`selectedRole() === 'admin' || selectedRole() === 'office' => return true`).
  2. **So khớp trực tiếp theo Mã/Tên/ID lớp:** Tách các token trong `item.code`, `item.name`, `item.id`. Nếu chứa mã nhân viên (VD: `2K9.H4.GIANGNH` chứa `GIANGNH`), lớp đó lập tức được xác định là thuộc về nhân sự đó.
  3. **Làm sạch danh xưng tiếng Việt:** Tự động loại bỏ các từ xưng hô (`thầy`, `cô`, `gv`, `ta`, `tro giang`, `giao vien`, `anh`, `chi`, `em`, `bac`, `vp`) trước khi so khớp tên hoặc tiền tố mã nhân sự.
  4. **Nạp lại dữ liệu lớp khi đăng nhập:** Trong `setSignedInAccount()`, gọi lại `loadClassCatalog()` sau khi đã tải `masterData` chuẩn hóa, giúp danh sách lớp lập tức xuất hiện ngay trên giao diện Đi làm và Quản lý.

### 21.3. Nâng Cấp Phiên Bản v5.5 (Cache-Busting)
- Cập nhật toàn bộ phiên bản hệ thống lên **v5.5** (`v5.5.0`) trên `index.html`, `src/app.js`, `src/features.js` và `src/data/class-catalog-repository.js` để trình duyệt người dùng tự động xóa bộ nhớ đệm và nhận mã nguồn mới nhất.

---

## 22. ĐẶC TẢ XỬ LÝ LỚP HỌC KHÔNG TỒN TẠI KHI ĐỒNG BỘ GOOGLE SHEETS (v5.6 RELEASE SPECIFICATION)

### 22.1. Yêu cầu & Nguyên tắc Thiết kế
1. **Tuyệt đối KHÔNG tự tạo lớp mới khi mã lớp không tồn tại trong database:**
   - Xóa bỏ hoàn toàn cơ chế tự sinh lớp `ensureCustomClassCreated` và tùy chọn `create_new:<Mã lớp>`.
   - Khi Google Sheet có mã lớp không khớp với bất kỳ lớp nào trong danh mục lớp học (`classCatalog`), hệ thống không được phép thêm lớp mới vào cơ sở dữ liệu.
2. **Báo lỗi lớp không tồn tại rõ ràng trong bảng preview để duyệt:**
   - Cột Phân loại hiển thị badge lỗi: `Lớp không tồn tại`.
   - Cột Lớp hiển thị khối cảnh báo nền đỏ nổi bật: `Lỗi: Mã lớp [...] không tồn tại trong hệ thống! Không tự tạo lớp mới · Đã chuyển trạng thái về: Nghỉ`.
   - Cột Thông tin học sinh hiển thị thông báo chi tiết: `Lỗi: Lớp [...] không tồn tại trong HT → Tự động chuyển về Nghỉ`.
   - Cho phép người duyệt lựa chọn gán học sinh vào một lớp có sẵn trong database hoặc giữ nguyên không gán lớp.
3. **Tự động chuyển trạng thái học sinh về "Nghỉ":**
   - Trong bảng preview, trường trạng thái của học sinh có lớp không tồn tại mặc định chuyển sang `Trạng thái: Nghỉ` (chữ đỏ `#b91c1c`).
   - Tag "Mới" tự động bỏ tích để không đánh dấu học sinh đã nghỉ là học sinh mới.
   - Thêm bộ lọc nhanh `Lớp không tồn tại` trên thanh công cụ duyệt của Văn phòng để dễ dàng lọc riêng các trường hợp này.
4. **Áp dụng khi duyệt (Approval Execution):**
   - Học sinh mới có mã lớp không tồn tại sẽ được tạo hồ sơ với `enrollmentStatus: 'Nghỉ'` và `classIds: []` (không sinh lớp mới).
   - Học sinh cũ sẽ được cập nhật trạng thái `enrollmentStatus: 'Nghỉ'` mà không làm thay đổi hay gán vào lớp rác.
   - Thông báo kết quả và nhật ký admin ghi nhận rõ ràng số lượng học sinh chuyển về Nghỉ do lớp không tồn tại.

---

## 23. ĐẶC TẢ XỬ LÝ LỖI & HIỂN THỊ THÔNG BÁO KHI KIỂM TRA ĐỒNG BỘ GOOGLE SHEETS (v5.7 RELEASE SPECIFICATION)

### 23.1. Khắc phục Sự cố Treo Trạng thái "Đang kiểm tra đồng bộ..."
1. **Nguyên nhân cốt lõi:**
   - Trong hàm `scanIncomingSheetsRowsForApproval` (`src/features.js`), các biến `normalizeLeadingZerosToken` (chưa import) và `catalog` (chưa khai báo qua `getClassCatalog()`) gây ra ngoại lệ thời gian chạy `ReferenceError: normalizeLeadingZerosToken is not defined` và `ReferenceError: catalog is not defined`.
   - Do thiếu khối `try...catch` bao bọc, ngoại lệ làm đứt gãy luồng thực thi bất đồng bộ, khiến hàm `renderSheetsApprovalTable()` không được gọi và banner trạng thái bị treo vĩnh viễn ở thông điệp `"Đang kiểm tra đồng bộ..."`.
2. **Giải pháp thực thi:**
   - Đã bổ sung import `normalizeLeadingZerosToken` từ `./data/class-catalog-repository.js` vào đầu tệp `src/features.js`.
   - Đã bổ sung khai báo `const catalog = getClassCatalog();` vào ngay đầu hàm `scanIncomingSheetsRowsForApproval`.
   - Bọc toàn bộ logic của `scanIncomingSheetsRowsForApproval` và các trình xử lý sự kiện nút bấm (`#pull-sheets-sync-btn`, `#pull-multi-cohort-sheets-btn`, `[data-scan-single-cohort]`, `#apply-sheets-paste-sync-btn`, `#panel-apply-sheets-paste-sync-btn`) trong khối `try...catch` toàn diện.

### 23.2. Hiển thị Lỗi Minh bạch & Tự động Mở Khung Dán Dữ liệu Dự phòng
1. **Bắt và hiển thị mọi lỗi phát sinh:**
   - Khi xảy ra lỗi mạng, lỗi phân quyền Google Sheet (trang tính riêng tư), lỗi 404 tên tab hoặc lỗi cấu trúc dữ liệu, hệ thống cập nhật banner trạng thái với định dạng lỗi màu đỏ (`#991b1b` trên nền `#fef2f2`), kèm thông báo toast trực quan cho người dùng.
   - Phát hiện trang tính riêng tư (`<!DOCTYPE html` hoặc trang đăng nhập Google Accounts) để hướng dẫn chi tiết người dùng: *"Google Sheet đang ở chế độ RIÊNG TƯ (cần đăng nhập Google). Vui lòng mở Google Sheet -> Bấm nút 'Chia sẻ' -> Chuyển quyền thành 'Bất kỳ ai có đường liên kết đều có thể xem (Người xem)'..."*.
2. **Kích hoạt Fallback dán dữ liệu tự động:**
   - Khi fetch link Google Sheets thất bại, các vùng chi tiết dán dữ liệu dự phòng (`#sheets-paste-fallback-details` và `#panel-sheets-paste-fallback-details`) tự động mở (`open = true`) để người dùng có thể ngay lập tức dán (Ctrl+V) dữ liệu từ trang tính mà không bị gián đoạn công việc.
3. **Cơ chế Timeout chống đóng băng mạng:**
   - Tích hợp `createFetchTimeoutSignal` với thời gian chờ giới hạn (7 - 12 giây) cho các yêu cầu fetch CSV và Apps Script, ngăn chặn tình trạng trình duyệt treo vô hạn khi mạng chập chờn.

### 23.3. Quy chuẩn Nâng cấp Phiên bản v5.7
- Hệ thống được nâng cấp đồng bộ lên phiên bản **v5.7** (`v5.7.0`) trên toàn bộ các tệp cấu hình, giao diện và mã nguồn (`index.html`, `src/app.js`, `src/features.js`, `src/excel-import-export.js`, `ARCHITECTURE_AND_WORKFLOW_SPEC.md`).

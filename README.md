# 📸 AI Screenshot Manager — Trợ lý Quản lý & Phân loại Ảnh chụp màn hình Thông minh

<p align="center">
  <b>Phần mềm Desktop thông minh ứng dụng AI Vision giúp tự động theo dõi, nhận diện nội dung, đặt tên chuẩn hóa và phân loại ảnh chụp màn hình một cách khoa học trên Windows.</b>
</p>

---

## 🌟 Giới thiệu tổng quan

Trong công việc hàng ngày, người dùng thường chụp rất nhiều ảnh màn hình (phục vụ viết báo cáo, nghiên cứu, tra cứu tài liệu, debug code, lưu biên lai hóa đơn,...). Các ảnh này thường có tên mặc định vô nghĩa như `Screenshot_2024-01-01_1.png` và bị lưu lộn xộn trong thư mục `Pictures` hoặc `Desktop`, khiến việc tìm kiếm lại mất nhiều thời gian.

**AI Screenshot Manager** được phát triển nhằm giải quyết triệt để vấn đề trên. Ứng dụng hoạt động ngầm (hỗ trợ System Tray), tự động nhận diện ảnh chụp màn hình mới (cả từ thư mục và từ Clipboard), dùng trí tuệ nhân tạo (AI Vision / OCR) phân tích nội dung hình ảnh, gợi ý tên file có ý nghĩa chuẩn hóa và tự động sắp xếp vào đúng các thư mục chuyên môn.

---

## ✨ Các tính năng nổi bật

### 1. 🤖 Đa dạng mô hình AI & Hỗ trợ Chạy Offline 100%
Phần mềm tích hợp linh hoạt 5 lựa chọn AI mạnh mẽ nhất hiện nay:
- **Tesseract OCR (Local / Offline 100%)**: Nhận diện văn bản tiếng Việt & tiếng Anh trực tiếp trên máy không cần kết nối mạng hay API Key, bảo mật tuyệt đối.
- **Ollama Vision (Local AI)**: Kết nối với máy chủ Ollama chạy trên card đồ họa/CPU của bạn, hỗ trợ các mô hình thị giác thịnh hành:
  - `moondream` (nhỏ gọn, siêu nhanh).
  - `minicpm-v` (độ chi tiết cao, hiểu bảng biểu & code).
  - `llama3.2-vision` (mô hình thị giác đa nhiệm của Meta).
- **Google Gemini API**: Phân tích hình ảnh tốc độ cao với các phiên bản `Gemini 2.5 Flash` và `Gemini 2.5 Pro`.
- **OpenAI Vision**: Hỗ trợ đầy đủ các mô hình `GPT-4o Mini`, `GPT-4o`, `GPT-4.1`.
- **Claude / Claude Code CLI**: Hỗ trợ gọi trực tiếp CLI `claude.exe` có sẵn trên máy hoặc dùng Anthropic API.

### 2. ⚡ Tự động giám sát & Popup xác nhận tức thì (Quick-Confirm)
- **Watcher thời gian thực**: Lắng nghe thư mục chụp ảnh màn hình của Windows (`Chokidar`) và theo dõi khay nhớ tạm (`Clipboard watcher`).
- **Cửa sổ nổi góc màn hình**: Khi bạn bấm phím chụp màn hình (PrintScreen / Win+Shift+S), một popup nhỏ gọn sẽ lập tức xuất hiện ở góc dưới bên phải màn hình để hiển thị tên file AI gợi ý. Bạn có thể sửa nhanh và bấm **Đổi tên** ngay mà không cần mở toàn bộ ứng dụng.

### 3. 📁 Quản lý thư mục thực tế & Giữ nguyên cấu trúc ổ đĩa
- **Khớp trực tiếp thư mục trên máy**: Quét và hiển thị đúng các thư mục thực tế đang có sẵn trong máy tính (hỗ trợ đầy đủ Tiếng Việt có dấu, khoảng trắng như `Tuần 1`, `Hóa đơn 2026`).
- **Không tự sinh folder rác**: Lưu trực tiếp vào thư mục bạn chọn, không tự ý biến đổi tên thư mục thành dạng gạch nối hay tạo trùng lặp.
- **2 chế độ lưu trữ linh hoạt**:
  - *Chế độ phân loại thư mục*: Tự động chuyển file vào thư mục con phù hợp.
  - *Chế độ đổi tên tại chỗ*: Giữ nguyên vị trí file ban đầu và chỉ đổi tên file chuẩn hóa.

### 4. 🔍 Thư viện quản lý & Tìm kiếm toàn diện
- **Chống trùng lặp thông minh (SHA-256)**: Phát hiện các ảnh chụp có nội dung trùng nhau để không tốn quota AI và cảnh báo người dùng.
- **Tìm kiếm đa năng**: Tìm kiếm ảnh tức thì theo từ khóa tên file, danh mục, nội dung mô tả tiếng Việt do AI tóm tắt hoặc nhãn thẻ (Tags).
- **Xem trước ảnh & Phóng to (Zoom)**: Trình xem ảnh sắc nét hỗ trợ zoom, xoay và mở trực tiếp vị trí file trong Windows File Explorer.

### 5. 🛡️ Bảo mật & Tiết kiệm tài nguyên
- **Mã hóa an toàn**: API Key được mã hóa bằng cơ chế `safeStorage` của hệ điều hành Windows.
- **Chạy nền nhẹ nhàng**: Thu nhỏ xuống System Tray, chiếm cực ít RAM và CPU khi ở chế độ chờ.

---

## 🛠️ Công nghệ sử dụng

- **Khung ứng dụng**: [Electron](https://www.electronjs.org/) + [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build tool**: [electron-vite](https://electron-vite.org/) + [electron-builder](https://www.electron.build/)
- **Giao diện**: [Tailwind CSS](https://tailwindcss.com/) + [Lucide Icons](https://lucide.dev/)
- **Cơ sở dữ liệu**: [SQLite](https://sqlite.org/) (nhúng trực tiếp)
- **Xử lý hình ảnh**: [Sharp](https://sharp.pixelplumbing.com/)
- **Giám sát tệp tin**: [Chokidar](https://github.com/paulmillr/chokidar)

---

## 🚀 Hướng dẫn cài đặt & Sử dụng

### Dành cho người dùng (Cài đặt từ file .exe)
1. Tải bộ cài đặt: `ai-screenshot-manager-1.0.0-setup.exe` trong thư mục `dist/`.
2. Chạy file cài đặt, phần mềm sẽ tự tạo shortcut trên Desktop và khởi động cùng biểu tượng dưới khay hệ thống (System Tray).
3. Vào trang **Cài đặt (Settings)**:
   - Chọn thư mục bạn muốn theo dõi (mặc định là thư mục `Pictures\Screenshots` của Windows).
   - Chọn nhà cung cấp AI muốn sử dụng (ví dụ: Tesseract OCR cho máy offline, hoặc nhập API Key cho Gemini/OpenAI).
4. Nhấn phím chụp màn hình như bình thường (`Win + Shift + S` hoặc `PrtScn`) và trải nghiệm tính năng đổi tên tự động!

### Dành cho lập trình viên (Chạy từ mã nguồn)
```bash
# 1. Cài đặt các thư viện phụ thuộc
npm install

# 2. Khởi chạy môi trường phát triển (Dev)
npm run dev

# 3. Kiểm tra lỗi Typescript & Chạy Test
npm run typecheck
npm test

# 4. Đóng gói thành file cài đặt Windows (.exe)
npm run build:installer
```

---

## 📄 Bản quyền

Phát triển bởi **AI Screenshot Manager Team**. Phát hành theo giấy phép bản quyền MIT.

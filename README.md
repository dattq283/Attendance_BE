# Attendance System — Backend

Backend cho ứng dụng chấm công, xây dựng bằng **NestJS + GraphQL + Prisma + MySQL**, áp dụng phân quyền theo **CASL** (field-level authorization) kết hợp **PoliciesGuard** cho các trường hợp phân quyền phức tạp. Bổ sung thông báo **real-time qua WebSocket** cho các thao tác duyệt/từ chối đơn, và **export báo cáo chấm công tháng** ra Excel.

## Mục lục

- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Kiến trúc tổng quan](#kiến-trúc-tổng-quan)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Schema Database](#schema-database)
- [Cài đặt & Chạy dự án](#cài-đặt--chạy-dự-án)
- [Xác thực & Phân quyền](#xác-thực--phân-quyền)
- [Danh sách API](#danh-sách-api)
- [Luồng nghiệp vụ chính](#luồng-nghiệp-vụ-chính)
- [Thông báo Real-time (WebSocket)](#thông-báo-real-time-websocket)
- [Export Báo cáo Tháng](#export-báo-cáo-tháng)
- [Trạng thái hoàn thành](#trạng-thái-hoàn-thành)

---

## Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| Framework | NestJS |
| API | GraphQL (Apollo Server, code-first) |
| ORM | Prisma 6 |
| Database | MySQL |
| Xác thực | JWT (Passport) |
| Phân quyền | CASL (`@casl/ability`, `@casl/prisma`) + `PoliciesGuard` |
| Real-time | Socket.io (NestJS Gateway) |
| Validate | class-validator |
| Hash password | bcrypt |
| Job Queue | BullMQ + Redis |
| Scheduled Jobs | @nestjs/schedule |
| Report Export | ExcelJS (XLSX) |

## Kiến trúc tổng quan

**Luồng xử lý 1 request GraphQL:**

1. Client gửi GraphQL query/mutation qua `POST /graphql`
2. `GqlAuthGuard` — xác thực JWT, gắn thông tin user vào request
3. `PoliciesGuard` (CASL, qua `@CheckPolicies(...)`) — kiểm tra quyền truy cập trên những API yêu cầu phân quyền
4. `Resolver` — nhận request, gọi xuống Service tương ứng
5. `Service` — xử lý logic nghiệp vụ, gọi Prisma
6. `PrismaService` — thực thi truy vấn xuống MySQL
7. (Với `approveRequest`/`rejectRequest`) Service gọi thêm `NotificationGateway` để bắn sự kiện real-time cho đúng user liên quan

Ứng dụng tổ chức theo **feature-based module** (mỗi tính năng 1 thư mục riêng, tự chứa entity/service/resolver), không gộp theo layer kỹ thuật — giúp dễ mở rộng và dễ tra cứu khi dự án lớn dần.

## Cấu trúc thư mục

- `src/`
  - `auth/` — Đăng ký, đăng nhập, JWT
    - `auth.module.ts`
    - `auth.service.ts`
    - `auth.resolver.ts`
    - `jwt.strategy.ts`
    - `gql-auth.guard.ts`
    - `gql-throttle.guard.ts`
    - `current-user.decorator.ts`
    - `login-rate-limit.service.ts`
  - `casl/` — Phân quyền field-level dùng chung nhiều module (module **global**)
    - `casl.module.ts`
    - `casl-ability.factory.ts`
    - `policy.guard.ts`
    - `check-policy.decorator.ts`
  - `prisma/` — Kết nối database dùng chung
    - `prisma.module.ts`
    - `prisma.service.ts`
  - `notification/` — Gateway WebSocket, bắn sự kiện real-time
    - `notification.module.ts`
    - `notification.gateway.ts`
  - `user/`
  - `attendance/` — Chấm công, xem lịch sử
    - `attendance.module.ts`
    - `attendance.service.ts`
    - `attendance.resolver.ts`
    - `attendance.entity.ts`
  - `attendance-request/` — Đơn xin chấm công ngoài
    - `attendance-request.module.ts`
    - `attendance-request.service.ts`
    - `attendance-request.resolver.ts`
    - `attendance-request.input.ts`
    - `attendance-request.entity.ts`
  - `export/` — Export báo cáo chấm công tháng
    - `export.service.ts` (queueing)
    - `export.processor.ts` (BullMQ job worker)
    - `export-cron.service.ts` (scheduled task tự động)
    - `export.resolver.ts`
    - `export.module.ts`
  - `utils/` — Các hàm bổ trợ
    - `date.util.ts` (biên ngày/tháng theo múi giờ `Asia/Ho_Chi_Minh`)
  - `app.module.ts`
  - `main.ts`

## Schema Database

Hệ thống có 3 bảng chính:

**User** — tài khoản, có `role` (`ADMIN` / `EMPLOYEE`), password được hash bằng bcrypt.

**Attendance** — lịch sử chấm công thực tế.
- `type: NORMAL` — chấm công qua API `checkin` bình thường
- `type: MANUAL` — sinh ra tự động khi một đơn xin chấm công ngoài được duyệt

**AttendanceRequest** — đơn xin chấm công ngoài.
- `status: PENDING | APPROVED | REJECTED`
- Khi `APPROVED`, hệ thống tự tạo **2 bản ghi `Attendance`** có `type = MANUAL`:
  - bản 1 có `checkTime = startTime`
  - bản 2 có `checkTime = endTime`
- Điều này đảm bảo API xem lịch sử chỉ cần truy vấn đúng 1 bảng `Attendance`.

Xem chi tiết đầy đủ tại `prisma/schema.prisma`.

## Cài đặt & Chạy dự án

### Yêu cầu
- Node.js
- MySQL đang chạy (local hoặc Docker)
- Redis đang chạy (cho BullMQ export)

### Các bước

```bash
# Cài dependency
npm install

# Tạo file .env (xem biến môi trường bên dưới)

# Chạy migration
npx prisma migrate dev

# Generate Prisma Client
npx prisma generate

# (Tuỳ chọn) Tạo tài khoản ADMIN qua seed
npx prisma db seed

# Chạy ứng dụng (dev mode)
npm run start:dev
```

Ứng dụng chạy tại `http://localhost:3000/graphql` (Apollo Sandbox). Kết nối WebSocket qua cùng port `3000`.

### Biến môi trường (.env)

```env
DATABASE_URL="mysql://<user>:<password>@localhost:3306/attendance_db"
JWT_SECRET="<chuỗi bí mật ngẫu nhiên>"

# Dùng cho prisma seed tạo ADMIN ban đầu
ADMIN_EMAIL="admin@gmail.com"
ADMIN_PASSWORD="admin123"

# Redis (nếu không dùng default localhost:6379)
REDIS_URL="redis://localhost:6379"
```

> Redis **bắt buộc** để chạy export job queue (BullMQ).

### Tạo tài khoản ADMIN

Cách khuyến nghị: điền `ADMIN_EMAIL` / `ADMIN_PASSWORD` trong `.env`, rồi chạy:

```bash
npx prisma db seed
```

Seed sẽ tạo (upsert) một admin với `role = ADMIN` nếu chưa tồn tại, dùng bcrypt để hash password. *(Không cần tự sửa `role` qua Prisma Studio như phiên bản trước.)*

## Xác thực & Phân quyền

### Xác thực (Authentication)

Dùng JWT — sau khi `login`/`register` thành công, client nhận `accessToken`, gửi kèm mọi request cần đăng nhập qua header:

```
Authorization: Bearer <accessToken>
```

`GqlAuthGuard` chịu trách nhiệm xác thực token và gắn thông tin user (`userId`, `role`) vào request. Cùng một `accessToken` này cũng được dùng để xác thực kết nối WebSocket (xem phần [Thông báo Real-time](#thông-báo-real-time-websocket)).

### Phân quyền (Authorization)

- **`PoliciesGuard` + CASL (`@CheckPolicies(...)`)** — dùng cho các API cần lọc dữ liệu theo điều kiện field-level (ví dụ: EMPLOYEE chỉ được xem lịch sử / đơn của chính mình, ADMIN xem được toàn bộ). CASL rule được định nghĩa tập trung tại `casl-ability.factory.ts`, tự động chuyển thành điều kiện Prisma `where` qua `accessibleBy()`.
- `CaslModule` là module **global** — cung cấp `CaslAbilityFactory` và `PoliciesGuard` cho toàn hệ thống, không cần khai báo lại tại từng module.

Thêm role mới trong tương lai chỉ cần chỉnh sửa `casl-ability.factory.ts`, không cần sửa Guard.

## Danh sách API

Toàn bộ API là GraphQL Query/Mutation qua endpoint `/graphql`.

| API | Loại | Yêu cầu | Guard |
|---|---|---|---|
| `register(input)` | Mutation | Không cần đăng nhập | — |
| `login(input)` | Mutation | Không cần đăng nhập | — |
| `checkin` | Mutation | Đăng nhập | `GqlAuthGuard` |
| `attendanceHistory(from?, to?)` | Query | Xem lịch sử chấm công (EMPLOYEE chỉ xem của mình, ADMIN xem toàn bộ) | `GqlAuthGuard`, `PoliciesGuard` |
| `createRequest(input)` | Mutation | Tạo đơn xin chấm công ngoài | `GqlAuthGuard` |
| `attendanceRequests(status?)` | Query | Xem đơn xin chấm công ngoài (EMPLOYEE chỉ của mình, ADMIN toàn bộ) | `GqlAuthGuard`, `PoliciesGuard` |
| `approveRequest(requestId)` | Mutation | Phê duyệt đơn xin chấm công (quyền `update`) | `GqlAuthGuard`, `PoliciesGuard` |
| `rejectRequest(requestId, note?)` | Mutation | Từ chối đơn xin chấm công | `GqlAuthGuard`, `PoliciesGuard` |
| `trgMonthlyExport(input)` | Mutation | Trigger export báo cáo chấm công theo tháng (quyền `create`) | `GqlAuthGuard`, `PoliciesGuard` |
| `getExportReport(exportId)` | Query | Xem trạng thái / thông tin của một export | `GqlAuthGuard`, `PoliciesGuard` |

## Luồng nghiệp vụ chính

### Chấm công thông thường

User đăng nhập → `checkin()` → tạo `Attendance` `type = NORMAL` (`checkTime = now`).

**Giới hạn khi chấm công (`checkin`):**
- Tối đa **4 lần / ngày** cho cùng một user (tính theo ngày làm việc trong múi giờ nghiệp vụ).
- Giữa 2 lần chấm liên tiếp phải cách nhau ít nhất **5 phút** (so với bản ghi gần nhất).
- Giới hạn này chỉ áp cho `checkin` tay (`checkTime = now`). Các bản ghi `MANUAL` sinh ra từ approve không bị áp dụng giới hạn này.

### Xin chấm công ngoài

User → `createRequest(input)` với `startTime`, `endTime`, `reason`

→ Tạo `AttendanceRequest` với `status = PENDING`

Validate đầu vào:
- Bắt buộc `startTime < endTime`
- Cùng ngày (theo múi giờ nghiệp vụ)
- Toàn bộ `endTime` phải ở trong quá khứ  (không được xin bù cho tương lai)
- **Chặn chồng lấn:** không được tạo đơn nếu trùng thời gian với một đơn `PENDING` hoặc `APPROVED` khác của cùng một user.

User → `attendanceRequests(status: null)`
→ Xem các đơn của chính mình (CASL tự lọc)
→ Theo dõi trạng thái `PENDING / APPROVED / REJECTED`

Admin → `attendanceRequests(status: PENDING)`
→ Xem danh sách các đơn đang chờ duyệt

Admin → `approveRequest(requestId)` (trong transaction)
1. Kiểm tra đơn tồn tại và đang ở trạng thái `PENDING`
2. Xác nhận admin không duyệt chính đơn của mình
3. `updateMany` đơn → `APPROVED`, gán `reviewBy` / `reviewAt`
4. **Chặn chồng lấn khi duyệt:** kiểm tra không có đơn **đã APPROVED** khác của cùng user trùng thời gian với đơn này (tránh tạo trùng bản ghi)
5. Tạo 2 bản ghi `Attendance`:
   - `type = MANUAL`, `checkTime = startTime`
   - `type = MANUAL`, `checkTime = endTime`
6. Transaction commit thành công
7. Bắn WebSocket event `requestApproved` tới đúng user

> Lưu ý: Một bản ghi chấm công `NORMAL` đã tồn tại trong khoảng thời gian của đơn **không** bị coi là xung đột — người dùng có thể đã chấm vào và xin bù giờ ra (như vậy trong ngày có 3 bản ghi, được chấp nhận).

**— hoặc —**

Admin → `rejectRequest(requestId, note?)` (trong transaction)
1. Kiểm tra đơn tồn tại và đang ở trạng thái `PENDING`
2. `updateMany` đơn → `REJECTED`, gán `reviewBy` / `reviewAt`, và `note` (nếu có)
3. Không tạo bản ghi `Attendance`
4. Transaction commit thành công
5. Bắn WebSocket event `requestRejected` tới đúng user

---

## Thông báo Real-time (WebSocket)

Khi đơn xin chấm công ngoài được duyệt / từ chối, user liên quan (nếu đang giữ kết nối WebSocket mở) nhận thông báo ngay lập tức, không cần chủ động gọi lại API.

### Xác thực kết nối

Kết nối WebSocket được xác thực bằng JWT ngay lúc handshake, gửi qua `auth.token`:

```javascript
const socket = io('http://localhost:3000', {
  auth: { token: '<accessToken>' },
});
```

Server tự giải mã token, lấy `userId` và tự động join client vào room riêng (`user_<userId>`) — client **không tự chọn** room, tránh giả mạo danh tính người khác.

### Sự kiện phát ra

| Sự kiện | Khi nào bắn | Payload |
|---|---|---|
| `requestApproved` | Sau khi `approveRequest` transaction thành công | `{ requestId, status, message }` |
| `requestRejected` | Sau khi `rejectRequest` thành công | `{ requestId, status, message }` |

Ngoài ra, luồng export (xem phần dưới) cũng bắn các sự kiện `exportCompleted` / `exportFailed` tới user trigger (hoặc admin nếu là cron).

### Trạng thái

- [x] Gateway xác thực JWT khi connect, tự động join room theo `userId`
- [x] Tích hợp bắn sự kiện trong `approveRequest` / `rejectRequest`
- [x] Test end-to-end đầy đủ qua Postman Socket.IO client

---

## Export Báo cáo Tháng

Hệ thống cho phép export lịch sử chấm công tháng thành file Excel (.xlsx) để báo cáo / lưu trữ.

### Cách dùng

**Trigger export thủ công (Admin):**
```graphql
mutation {
  trgMonthlyExport(input: { month: 8, year: 2026 })
}
```

Response: `exportId` (ví dụ `EXP-a1b2c3d4-e5f6...`)

**Tự động export tháng trước:**
- Mỗi tháng (ngày 1 lúc 00:00), cron job tự động trigger export cho tháng trước
- File được lưu tại: `exports/<month>-<year>/<exportId>.xlsx`
- Ví dụ: `exports/7-2026/EXP-a1b2c3d4.xlsx` (báo cáo tháng 7 năm 2026)

### Chi tiết flow

1. **Resolver** nhận request `trgMonthlyExport(input)` (quyền `create`, có throttle riêng)
2. **Service** tạo bản ghi `ExportJob` (`status = QUEUED`) và thêm job vào queue BullMQ (kèm `exportId`)
3. **Processor** (BullMQ Worker) xử lý job:
   - Truy vấn tất cả `Attendance` trong tháng tương ứng theo **múi giờ nghiệp vụ `Asia/Ho_Chi_Minh`** (dùng `monthStart` / `nextMonthStart` trong `utils/date.util.ts`)
   - Gom dữ liệu theo `userId + ngày làm việc` → xuất báo cáo **3 cột**: `User ID`, `Date`, `Check-in Count`
   - Tạo workbook Excel, ghi file vào folder `exports/<month>-<year>/`
4. Cập nhật `ExportJob` → `DONE` (`path`, `completedTime`) hoặc `FAILED` (kèm `reason`)
5. Bắn notification `exportCompleted` / `exportFailed` tới người trigger (hoặc admin nếu cron)
6. Job retry tối đa 3 lần nếu fail (backoff delay 5 giây)
7. Client xem trạng thái / thông tin qua `getExportReport(exportId)`

### Yêu cầu cấu hình

**Redis phải chạy** (để BullMQ lưu trữ job queue):

```bash
# Cục bộ
redis-server

# Hoặc dùng Docker
docker run -d -p 6379:6379 redis:latest
```

**Biến môi trường (nếu cần):**
```env
REDIS_URL=redis://localhost:6379
```

---

# Trạng thái hoàn thành

- [x] Đăng ký / Đăng nhập (JWT)
- [x] Chấm công (giới hạn 4 lần/ngày, 5 phút giữa các lần)
- [x] Xem lịch sử chấm công (filter theo thời gian, phân quyền theo role)
- [x] Tạo đơn xin chấm công ngoài (chặn chồng lấn với đơn khác)
- [x] Xem đơn xin chấm công ngoài (với CASL filtering)
- [x] Admin xem danh sách đơn (filter theo trạng thái)
- [x] Admin duyệt / từ chối đơn (chặn chồng lấn khi duyệt)
- [x] Bắn sự kiện WebSocket khi duyệt / từ chối đơn
- [x] Test end-to-end tính năng real-time
- [x] Export báo cáo chấm công tháng (manual + auto cron, múi UTC+7, cột User / Date / Check-in Count)
- [x] Seed tạo tài khoản ADMIN từ biến môi trường
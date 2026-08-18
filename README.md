# Attendance System — Backend

Backend cho ứng dụng chấm công, xây dựng bằng **NestJS + GraphQL + Prisma + MySQL**, áp dụng phân quyền theo **CASL** (field-level authorization) kết hợp **Role-based Guard** cho các trường hợp đơn giản. Đang bổ sung thông báo **real-time qua WebSocket** cho các thao tác duyệt/từ chối đơn.

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
| Phân quyền | CASL (`@casl/ability`, `@casl/prisma`) + Role-based Guard |
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
3. `PoliciesGuard` (CASL)  — kiểm tra quyền truy cập (tùy từng API)
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
    - `current-user.decorator.ts`
    - `dto/`, `entities/`
  - `casl/` — Phân quyền field-level dùng chung nhiều module
    - `casl.module.ts`
    - `casl-ability.factory.ts`
    - `policies.guard.ts`
    - `check-policies.decorator.ts`
  - `prisma/` — Kết nối database dùng chung
    - `prisma.module.ts`
    - `prisma.service.ts`
  - `notification/` — Gateway WebSocket, bắn sự kiện real-time
    - `notification.module.ts`
    - `notification.gateway.ts`
  - `user/`
  - `attendance/` — Chấm công, xem lịch sử
    - `attendance.entity.ts`
    - `attendance.service.ts`
    - `attendance.resolver.ts`
  - `attendance-request/` — Đơn xin chấm công ngoài
    - `attendance-request.entity.ts`
    - `attendance-request.input.ts`
    - `attendance-request.service.ts`
    - `attendance-request.resolver.ts`
  - `export/` — Export báo cáo chấm công tháng
    - `export.service.ts` (queueing)
    - `export.processor.ts` (BullMQ job worker)
    - `export-cron.service.ts` (scheduled task tự động)
    - `export.resolver.ts`
    - `export.module.ts`
  - `app.module.ts`
  - `main.ts`

## Schema Database

3 bảng chính:

**User** — tài khoản, có `role` (`ADMIN` / `EMPLOYEE`).

**Attendance** — lịch sử chấm công thực tế.
- `type: NORMAL` — chấm công qua API bình thường
- `type: MANUAL` — sinh ra tự động khi 1 đơn xin chấm công ngoài được duyệt

**AttendanceRequest** — đơn xin chấm công ngoài.
- `status: PENDING | APPROVED | REJECTED`
- Khi `APPROVED`, hệ thống tự tạo 2 bản ghi `Attendance` tương ứng (liên kết qua `attendanceId`), đảm bảo API xem lịch sử chỉ cần truy vấn đúng 1 bảng.

Xem chi tiết đầy đủ tại `prisma/schema.prisma`.

## Cài đặt & Chạy dự án

### Yêu cầu
- Node.js
- MySQL đang chạy (local hoặc Docker)

### Các bước

```bash
# Cài dependency
npm install

# Tạo file .env
DATABASE_URL="mysql://<user>:<password>@localhost:3306/attendance_db"
JWT_SECRET="<chuỗi bí mật ngẫu nhiên>"

# Chạy migration
npx prisma migrate dev

# Generate Prisma Client
npx prisma generate

# Chạy ứng dụng (dev mode)
npm run start:dev
```

Ứng dụng chạy tại `http://localhost:3000/graphql` (Apollo Sandbox). Kết nối WebSocket qua cùng port `3000`.

### Tạo tài khoản ADMIN

Đăng ký 1 tài khoản qua mutation `register`, sau đó sửa `role` thành `ADMIN` trực tiếp qua Prisma Studio:

```bash
npx prisma studio
```

## Xác thực & Phân quyền

### Xác thực (Authentication)

Dùng JWT — sau khi `login`/`register` thành công, client nhận `accessToken`, gửi kèm mọi request cần đăng nhập qua header:

Authorization: Bearer <accessToken>


`GqlAuthGuard` chịu trách nhiệm xác thực token và gắn thông tin user (`userId`, `role`) vào request. Cùng 1 `accessToken` này cũng được dùng để xác thực kết nối WebSocket (xem phần [Thông báo Real-time](#thông-báo-real-time-websocket)).

### Phân quyền (Authorization)

- **`PoliciesGuard` + CASL (`@CheckPolicies(...)`)** — dùng cho các API cần lọc dữ liệu theo điều kiện field-level (ví dụ: EMPLOYEE chỉ được xem lịch sử/đơn của chính mình, ADMIN xem được toàn bộ). CASL rule được định nghĩa tập trung tại `casl-ability.factory.ts`, tự động chuyển thành điều kiện Prisma `where` qua `accessibleBy()`.

Thêm role mới trong tương lai chỉ cần chỉnh sửa `casl-ability.factory.ts`, không cần sửa Guard.

## Danh sách API

Toàn bộ API là GraphQL Query/Mutation qua endpoint `/graphql`.

| API | Loại | Yêu cầu | Guard |
|---|---|---|---|
| `register` | Mutation | Không cần đăng nhập | — |
| `login` | Mutation | Không cần đăng nhập | — |
| `checkin` | Mutation | Đăng nhập | `GqlAuthGuard` |
| `attendanceHistory(from?, to?)` | Query | Xem lịch sử chấm công (EMPLOYEE chỉ xem của mình, ADMIN xem toàn bộ) | `GqlAuthGuard`, `PoliciesGuard` |
| `createRequest(input)` | Mutation | Tạo đơn xin chấm công ngoài | `GqlAuthGuard` |
| `attendanceRequests(status?)` | Query | Xem đơn xin chấm công ngoài (EMPLOYEE chỉ xem của mình, ADMIN xem toàn bộ) | `GqlAuthGuard`, `PoliciesGuard` |
| `approveRequest(requestId)` | Mutation | Phê duyệt đơn xin chấm công (chỉ ADMIN) | `GqlAuthGuard`, `PoliciesGuard` |
| `rejectRequest(requestId, note?)` | Mutation | Từ chối đơn xin chấm công ngoài (chỉ ADMIN) | `GqlAuthGuard`, `PoliciesGuard` |
| `trgMonthlyExport(month, year)` | Mutation | Trigger export báo cáo chấm công theo tháng (chỉ ADMIN có thể export thủ công) | `GqlAuthGuard`, `PoliciesGuard` |

## Luồng nghiệp vụ chính

### Chấm công thông thường

User đăng nhập → checkin() → Attendance (type: NORMAL) được tạo


### Xin chấm công ngoài

User → `createRequest(requestTime, reason)`
→ Tạo `AttendanceRequest` với `status = PENDING`
→ Validate `requestTime` phải là thời điểm trong quá khứ

User → `attendanceRequests(status: null)`
→ Xem các đơn xin chấm công của chính mình (với CASL filter tự động)
→ Theo dõi trạng thái `PENDING / APPROVED / REJECTED`

Admin → `attendanceRequests(status: PENDING)`
→ Xem danh sách các đơn đang chờ duyệt

Admin → `approveRequest(requestId)`
→ Transaction:
1. Kiểm tra đơn tồn tại và đang ở trạng thái `PENDING`
2. Tạo `Attendance` mới:
   - `type = MANUAL`
   - `checkTime = requestTime` của đơn
3. Update `AttendanceRequest`:
   - `status = APPROVED`
   - `reviewBy`
   - `reviewAt`
   - `attendanceId`
→ Transaction commit thành công
→ Bắn WebSocket event `requestApproved` tới đúng user

User → `attendanceHistory()`
→ Thấy 2 bản ghi `Attendance` mới với `type = MANUAL`
→ Nếu đang kết nối WebSocket, nhận notification `requestApproved` ngay lập tức mà không cần gọi lại API

--- hoặc ---

Admin → `rejectRequest(requestId)`
→ Transaction:
1. Kiểm tra đơn tồn tại và đang ở trạng thái `PENDING`
2. Update `AttendanceRequest`:
   - `status = REJECTED`
   - `reviewBy`
   - `reviewAt`
   - `note` (nếu có)
3. Không tạo `Attendance`
→ Transaction commit thành công
→ Bắn WebSocket event `requestRejected` tới đúng user

User → Nếu đang kết nối WebSocket
→ Nhận notification `requestRejected` ngay lập tức


---

## Thông báo Real-time (WebSocket)

Khi đơn xin chấm công ngoài được duyệt/từ chối, user liên quan (nếu đang giữ kết nối WebSocket mở) nhận thông báo ngay lập tức, không cần chủ động gọi lại API.

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

### Trạng thái

- [x] Gateway xác thực JWT khi connect, tự động join room theo `userId`
- [x] Tích hợp bắn sự kiện trong `approveRequest`/`rejectRequest`
- [x] Test end-to-end đầy đủ qua Postman Socket.IO client

---

## Export Báo cáo Tháng

Hệ thống cho phép export lịch sử chấm công tháng thành file Excel (.xlsx) để báo cáo / lưu trữ.

### Cách dùng

**Trigger export thủ công (Admin):**
```graphql
mutation {
  trgMonthlyExport(month: 8, year: 2026)
}
```

Respons: `exportId` (ví dụ `EXP-a1b2c3d4-e5f6...`)

**Tự động export tháng trước:**
- Mỗi tháng (ngày 1 lúc 00:00), cron job tự động trigger export cho tháng trước
- File được lưu tại: `exports/<month>-<year>/<exportId>.xlsx`
- Ví dụ: `exports/7-2026/EXP-a1b2c3d4.xlsx` (báo cáo tháng 7 năm 2026)

### Chi tiết flow

1. **Resolver** nhận request `trgMonthlyExport(month, year)`
2. **Service** thêm job vào queue BullMQ (kèm `exportId`)
3. **Processor** (BullMQ Worker) xử lý job:
   - Truy vấn tất cả `Attendance` trong tháng tương ứng
   - Tạo workbook Excel, thêm headers & rows
   - Ghi file vào folder `exports/<month>-<year>/`
4. Job retry tối đa 3 lần nếu fail (delay 5 giây)
5. Response trả về `exportId` để client theo dõi hoặc download

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
- [x] Chấm công
- [x] Xem lịch sử chấm công (filter theo thời gian, phân quyền theo role)
- [x] Tạo đơn xin chấm công ngoài
- [x] Xem đơn xin chấm công ngoài (với CASL filtering)
- [x] Admin xem danh sách đơn (filter theo trạng thái)
- [x] Admin duyệt / từ chối đơn
- [x] Bắn sự kiện WebSocket khi duyệt/từ chối đơn
- [x] Test end-to-end đầy đủ tính năng real-time
- [x] Export báo cáo chấm công tháng (manual + auto cron)
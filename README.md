# Attendance App (Attendance_BE)

Hệ thống chấm công (check-in) cho nhân viên — backend **NestJS + GraphQL (code-first) + Prisma/MySQL + BullMQ/Redis**, phân quyền **JWT + CASL**, thông báo **WebSocket** real-time và **export báo cáo Excel** theo tháng.

---

## Mục lục

- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Kiến trúc tổng quan](#kiến-trúc-tổng-quan)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Yêu cầu & Cài đặt](#yêu-cầu--cài-đặt)
- [Chạy dự án](#chạy-dự-án)
- [Biến môi trường (.env)](#biến-môi-trường-env)
- [Xác thực & Phân quyền](#xác-thực--phân-quyền)
- [GraphQL API](#graphql-api)
- [Nghiệp vụ chính](#nghiệp-vụ-chính)
- [Thông báo Real-time (WebSocket)](#thông-báo-real-time-websocket)
- [Export báo cáo tháng](#export-báo-cáo-tháng)
- [Schema Database](#schema-database)
- [Testing](#testing)
- [Lưu ý](#lưu-ý)

---

## Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| Framework | NestJS 11 |
| API | GraphQL code-first (Apollo Server, `autoSchemaFile: true`, schema tự sinh tại `schema.gql`) |
| ORM / DB | Prisma 6 + MySQL |
| Xác thực | Passport JWT, bcrypt |
| Phân quyền | CASL (`@casl/ability`, `@casl/prisma`) + `PoliciesGuard` |
| Redis | ioredis (queue, lock check-in, rate-limit login, Socket.IO adapter) |
| Job Queue | BullMQ |
| Cron | @nestjs/schedule (TZ `Asia/Ho_Chi_Minh`) |
| Real-time | Socket.IO (NestJS Gateway + Redis adapter) |
| Report | ExcelJS (XLSX) |
| Validate | class-validator + ValidationPipe (whitelist, forbidNonWhitelisted) |
| Rate limit | @nestjs/throttler (`GqlThrottlerGuard`) |
| Test | Jest (ts-jest, unit test) |

---

## Kiến trúc tổng quan
**Luồng xử lý 1 request GraphQL:**

1. Client gửi query/mutation qua `POST /graphql` (header `Authorization: Bearer <token>` nếu cần đăng nhập)
2. `GqlAuthGuard` — xác thực JWT, kiểm tra user còn **active** (`deletedAt` null), gắn user vào request
3. `PoliciesGuard` (CASL, qua `@CheckPolicies(...)`) — kiểm tra quyền truy cập
4. `Resolver` → `Service` (logic nghiệp vụ) → `PrismaService` (MySQL)
5. Với luồng export: Service enqueue job vào BullMQ, `ExportProcessor` xử lý bất đồng bộ
6. `NotificationGateway` bắn sự kiện WebSocket (duyệt/từ chối đơn, export xong/fail)

**Tổ chức theo feature-based module** — mỗi tính năng 1 thư mục chứa entity/service/resolver riêng.

---

## Cấu trúc thư mục

```
src/
├── app.module.ts          # Root module: GraphQL, Throttler, BullMQ, Prisma, Redis...
├── main.ts                # Bootstrap: static assets /exports, ValidationPipe, trust proxy
├── auth/                  # login, JWT strategy, GqlAuthGuard, gql-throttle.guard, login rate-limit, createUser
├── casl/                  # CASL ability factory, PoliciesGuard, CheckPolicies decorator (global)
├── prisma/                # PrismaService + PrismaModule (global)
├── user/                  # User entity, softDeleteUser, reactiveUser
├── attendance/            # checkIn, showHistory
├── attendance-request/    # createRequest, showRequestList, approveRequest, rejectRequest
├── export/                # trgMonthlyExport, getExportReport, ExportProcessor (BullMQ), ExportCronService
├── notification/          # NotificationGateway (Socket.IO)
├── redis/                 # RedisService (@Global), RedisModule, RedisIoAdapter (Socket.IO)
└── utils/                 # date.util (múi giờ Asia/Ho_Chi_Minh, dùng Intl — không dayjs)
```

---

## Yêu cầu & Cài đặt

**Yêu cầu:** Node.js ≥ 20, MySQL, Redis (bắt buộc — dùng cho queue export, lock check-in, rate-limit login, Socket.IO adapter).

```bash
# 1. Cài dependencies
npm install

# 2. Tạo .env từ mẫu có sẵn (.env.example)
cp .env.example .env          # hoặc PowerShell: Copy-Item .env.example .env

# 3. Migration + (tùy chọn) seed admin
npx prisma migrate dev
npx prisma db seed

# 4. Chạy dev
npm run start:dev
```

Ứng dụng chạy tại `http://localhost:3000/graphql` (Apollo Sandbox). WebSocket cùng port `3000`.

---

## Chạy dự án

| Lệnh | Mô tả |
|---|---|
| `npm run start:dev` | Development (watch mode — tự build khi sửa file) |
| `npm run build` | Build ra `dist/` (bắt buộc trước khi chạy prod) |
| `npm run start:prod` | `node dist/main` — chạy bản đã build |
| `npm test` | Chạy unit test (jest) |
| `npm run lint` / `format` | ESLint (tự sửa) / Prettier |

> ⚠️ `start:prod` chạy `node dist/main` — nếu **chưa `npm run build`** sẽ lỗi `Cannot find module 'dist/main'`.

---

## Biến môi trường (.env)

Tham khảo đầy đủ tại `.env.example`:

| Biến | Mô tả | Mặc định |
|---|---|---|
| `DATABASE_URL` | Chuỗi kết nối MySQL: `mysql://user:pass@host:3306/db` | **bắt buộc** |
| `JWT_SECRET` | Khóa ký JWT | **bắt buộc** |
| `ALLOWED_ORIGINS` | Danh sách origin được phép CORS / WebSocket (cách nhau dấu phẩy) | rỗng |
| `NODE_ENV` | `development` / `production` | — |
| `BCRYPT_SALT_ROUNDS` | Số vòng salt bcrypt cho mật khẩu | `12` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Tài khoản admin mặc định (dùng trong seed) | — |
| `REDIS_HOST` | Host Redis — **mọi consumer đọc qua env này** | `localhost` |
| `REDIS_PORT` | Port Redis | `6379` |
| `PORT` | Port HTTP server | `3000` |

> ⚠️ Code **chỉ đọc** `REDIS_HOST` / `REDIS_PORT` (dùng `||` fallback `localhost`/`6379` khi env rỗng hoặc không đặt). **Không có biến `REDIS_URL`.**

**Seed admin:**

```bash
npx prisma db seed
```

Seed tạo (upsert) một admin `role = ADMIN` từ `ADMIN_EMAIL`/`ADMIN_PASSWORD` nếu chưa tồn tại, mật khẩu hash bằng bcrypt — không cần sửa DB tay.

---

## Xác thực & Phân quyền

### Authentication

- Sau khi `login` thành công, client nhận `accessToken`; gửi qua header:
  ```
  Authorization: Bearer <accessToken>
  ```
- `GqlAuthGuard` (passport-jwt) xác thực token + **kiểm tra `deletedAt`** (user bị soft-delete sẽ bị từ chối 401) + gắn `{ userId, username, role }` vào request.
- Cùng token dùng để xác thực WebSocket handshake.

### Authorization (CASL)

- `PoliciesGuard` + `@CheckPolicies(ability => ability.can(action, subject))` đọc rule từ `casl-ability.factory.ts`.
- **ADMIN** → `can('manage', 'all')`.
- **EMPLOYEE** → `create`/`read` giới hạn theo `{ userId: user.userId }` (dữ liệu của chính mình).
- Điều kiện rule được chuyển thành **filter dòng (row-level)** qua `accessibleBy()` của `@casl/prisma` — ví dụ EMPLOYEE chỉ thấy attendance/request của mình khi query. *(Không phải field-level authorization — đây là lọc theo bản ghi/dòng.)*
- `CaslModule` global — `CaslAbilityFactory` + `PoliciesGuard` dùng chung toàn hệ thống.
- Thêm role mới chỉ cần sửa `casl-ability.factory.ts`, không cần đổi Guard.

### Rate limit

| Vùng | Giới hạn |
|---|---|
| Global (`GqlThrottlerGuard`) | 10 request/phút |
| `login` (Redis `login_attempts:<email>|<ip>`) | 5 lần/phút theo email + IP |
| `createRequest` | 5 lần/phút |
| `trgMonthlyExport` | 2 lần/5 phút |

- Login rate limiter và lock check-in **fail-open**: Redis lỗi → cho qua (log cảnh báo), không chặn người dùng.
- `main.ts` set `trust proxy = 'loopback'` — `req.ip` lấy đúng IP client khi đứng sau reverse proxy cùng máy.

---

## GraphQL API

Endpoint: `POST /graphql` (dev có Apollo Sandbox). Schema đầy đủ: `schema.gql`.

### Mutation

| Mutation | Tham số | Guard / Policy | Mô tả |
|---|---|---|---|
| `login` | `input: LoginInput!` | công khai | Đăng nhập → `accessToken` + user |
| `createUser` | `input: CreateUserInput!` | JWT + create User | Tạo user mới |
| `checkIn` | — | JWT | Check-in lần này (max 4/ngày, cách ≥ 5 phút, lock Redis fail-open) |
| `createRequest` | `input: AttendanceRequestInput!` | JWT (+ throttle) | Tạo đơn xin chấm công bù |
| `approveRequest` | `requestId: Int!` | JWT + update AttendanceRequest | Duyệt đơn (chỉ ADMIN) |
| `rejectRequest` | `requestId: Int!, note: String` | JWT + update AttendanceRequest | Từ chối đơn (chỉ ADMIN) |
| `softDeleteUser` | `userId: Int!` | JWT + delete User | Xóa mềm user (chỉ ADMIN) |
| `reactiveUser` | `userId: Int!` | JWT + update User | Kích hoạt lại user |
| `trgMonthlyExport` | `input: ExportMonthlyInput!` | JWT + create AttendanceReport (ADMIN, throttle) | Tạo job export tháng |

### Query

| Query | Tham số | Guard / Policy | Mô tả |
|---|---|---|---|
| `showHistory` | `from: DateTime, to: DateTime` (tùy chọn) | JWT + read Attendance | Lịch sử chấm công (EMPLOYEE: của mình; ADMIN: tất cả) |
| `showRequestList` | `status: RequestStatus` (tùy chọn) | JWT + read AttendanceRequest | Danh sách đơn (EMPLOYEE: của mình; ADMIN: tất cả / lọc theo trạng thái) |
| `getExportReport` | `exportId: String!` | JWT + read AttendanceReport | Trạng thái + path của job export |


### Ví dụ

```graphql
# Login
mutation {
  login(input: { email: "admin@example.com", password: "secret" }) {
    accessToken
    user { id email fullName role }
  }
}

# Check-in
mutation { checkIn { id checkTime type } }

# Tạo đơn chấm công bù
mutation {
  createRequest(input: {
    startTime: "2026-08-20T08:00:00.000Z"
    endTime: "2026-08-20T10:00:00.000Z"
    reason: "Quên quẹt thẻ"
  }) { id status }
}

# Duyệt đơn (ADMIN)
mutation { approveRequest(requestId: 1) { id status } }

# Export tháng 7/2026 (ADMIN)
mutation { trgMonthlyExport(input: { month: 7, year: 2026 }) }

# Xem lịch sử chấm công (kèm token)
query { showHistory { id checkTime type } }
```

---

## Nghiệp vụ chính

### Check-in (`checkIn`)

- Tạo `Attendance` `type = NORMAL`, `checkTime = now`.
- **Tối đa 4 lần/ngày** cho cùng user (tính theo ngày làm việc — múi giờ `Asia/Ho_Chi_Minh`).
- **≥ 5 phút** giữa 2 lần check-in liên tiếp (so với bản ghi gần nhất).
- Giới hạn này **chỉ áp cho `checkIn` tay** — record `MANUAL` sinh từ approve không bị áp dụng.
- **Lock Redis** (`SET NX EX 3s` theo `checkin_lock:<userId>`) chống 2 request trùng nhau (double-click/retry) ghi 2 bản ghi cùng lúc. **Fail-open**: Redis lỗi → bỏ qua lock (có log), check-in vẫn chạy — nhất quán với rate limiter.

### Đơn chấm công bù (`createRequest`)

- Request `startTime < endTime`, cùng ngày, toàn bộ trong **quá khứ** (không xin bù tương lai).
- **Chặn chồng lấn**: không tạo đơn nếu trùng thời gian với đơn **của chính user** đang `PENDING` hoặc `APPROVED`.

### Duyệt / từ chối (`approveRequest` / `rejectRequest`)

- Chỉ ADMIN; không duyệt chính đơn của mình; chỉ duyệt đơn đang `PENDING`.
- **approve** (trong `$transaction`):
  1. `updateMany` `PENDING → APPROVED` (kèm `reviewBy`/`reviewAt`) — check count để tránh duyệt trùng.
  2. **Chặn chồng lấn khi duyệt**: không được có đơn **đã APPROVED** khác của cùng user trùng thời gian.
  3. Tạo **2 record `Attendance` `MANUAL`**: `checkTime = startTime` và `checkTime = endTime`.
  4. Bắn WebSocket `requestApproved` tới đúng user (trong try/catch — lỗi notify không làm fail transaction).
- **reject**: đổi `PENDING → REJECTED` (+ `note`), **không** tạo attendance, bắn `requestRejected`.
- Record `NORMAL` có sẵn trong khoảng của đơn **không bị coi là xung đột** (user có thể check-in rồi xin bù giờ ra).

### Quản lý user (`softDeleteUser` / `reactiveUser`)

- `softDeleteUser` — soft-delete qua `deletedAt`:
  - **Không xóa được chính mình** (`userId === currentUserId` → Forbidden).
  - **Không xóa admin cuối cùng** (count admin active ≤ 1 → BadRequest).
  - Không xóa user không tồn tại / đã xóa → NotFound.
- `reactiveUser` — đặt `deletedAt = null`.

---

## Thông báo Real-time (WebSocket)

**Kết nối** (xác thực JWT lúc handshake, server tự join room `user_<userId>` — client không tự chọn room):

```javascript
const socket = io('http://localhost:3000', {
  auth: { token: '<accessToken>' },
});
```

| Sự kiện | Khi nào | Payload |
|---|---|---|
| `requestApproved` | Sau khi duyệt đơn thành công | `{ requestId, status, message }` |
| `requestRejected` | Sau khi từ chối đơn thành công | `{ requestId, status, message }` |
| `exportCompleted` | Export xong | `{ exportId, month, year, message }` |
| `exportFailed` | Export hết lượt retry vẫn fail | `{ exportId, month, year, reason }` |

---

## Export báo cáo tháng

**Trigger:**
- Thủ công (ADMIN): `trgMonthlyExport(input: { month, year })` → trả `exportId`.
- Cron: mỗi **ngày 1 đầu tháng lúc 00:00** (TZ `Asia/Ho_Chi_Minh`) tự export **tháng trước**.

**Flow:**
1. Service tạo `ExportJob` (`QUEUED`, `exportId = EXP-<uuid>`) + enqueue queue `export`.
2. `ExportProcessor` — `PROCESSING` → truy vấn `Attendance` trong tháng (`monthStart ≤ t < nextMonthStart`, múi giờ nghiệp vụ) kèm `user.fullName` → gom theo `userId|ngày`.
3. Tạo Excel, cột **`User ID | Full Name | Date | Check-in Count`**, ghi vào `exports/<month>-<year>/<exportId>.xlsx`.
4. Cập nhật `DONE` + `path` (`/exports/<month>-<year>/<exportId>.xlsx`), bắn `exportCompleted`.
5. **Lỗi:** BullMQ retry (3 lần, backoff) — chỉ set `FAILED` + notify `exportFailed` ở **lần thử cuối**; lỗi phụ trong khối notify không nuốt lỗi gốc.
6. Client tra trạng thái qua `getExportReport(exportId)`.

File được phục vụ tĩnh qua `app.useStaticAssets('./exports', { prefix: '/exports/' })` (main.ts).

> Redis **bắt buộc** — BullMQ cần Redis lưu job queue.

---

## Schema Database

Xem chi tiết tại `prisma/schema.prisma`:

| Model | Ghi chú |
|---|---|
| `User` | `role` (ADMIN/EMPLOYEE), `deletedAt` (soft-delete), `email` unique, bcrypt hash |
| `Attendance` | `checkTime`, `type` (NORMAL/MANUAL), optional `attendanceRequestId`; index `[userId, checkTime]` |
| `AttendanceRequest` | `startTime`/`endTime`, `reason`, `status` (PENDING/APPROVED/REJECTED), `reviewBy`/`reviewAt`/`note`; index `[status]`, `[userId, status]` |
| `ExportJob` | `exportId` unique, `exportMonth`/`exportYear`, `exportedBy?`, `status` (QUEUED/PROCESSING/DONE/FAILED), `path`, `completedTime`, `reason` |

---

## Testing

```bash
npm test                                   # toàn bộ unit test
npm run test:cov                           # coverage
TZ=UTC npx jest src/utils/date.util.spec.ts
TZ=America/New_York npx jest src/utils/date.util.spec.ts
```

> `date.util.spec.ts` chạy lại dưới nhiều TZ để đảm bảo code datetime **không phụ thuộc TZ máy host**.

---

## Lưu ý

1. **Export file phục vụ công khai**: static `/exports/*` là Express middleware **ngoài hệ thống guard** (không qua JWT/CASL). `exportId` là UUID khó đoán nhưng không nên dựa vào đó — trước khi deploy production nên thay bằng endpoint xác thực (JWT + kiểm quyền) trước khi stream file.
2. **`connectToRedis`** (Socket.IO adapter) tạo client ioredis và trả Promise ngay, không chờ Redis sẵn sàng — WebSocket vẫn khởi động khi Redis tắt (nhưng không dùng Redis adapter). Lock check-in + login rate-limit đã **fail-open** nên app không sập khi Redis down.
3. **`dotenv`** được dùng trong `prisma.config.ts`/`prisma/seed.ts` nhưng không khai trực tiếp trong `package.json` (đến qua `@nestjs/config`); nếu gặp lỗi khi `npm ci` sạch → thêm `dotenv` vào devDependencies.
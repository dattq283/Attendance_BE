# Attendance System — Backend

Backend cho ứng dụng chấm công, xây dựng bằng **NestJS + GraphQL + Prisma + MySQL**, áp dụng phân quyền theo **CASL** (field-level authorization) kết hợp **Role-based Guard** cho các trường hợp đơn giản.

## Mục lục

- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Kiến trúc tổng quan](#kiến-trúc-tổng-quan)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Schema Database](#schema-database)
- [Cài đặt & Chạy dự án](#cài-đặt--chạy-dự-án)
- [Xác thực & Phân quyền](#xác-thực--phân-quyền)
- [Danh sách API](#danh-sách-api)
- [Luồng nghiệp vụ chính](#luồng-nghiệp-vụ-chính)

---

## Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| Framework | NestJS |
| API | GraphQL (Apollo Server, code-first) |
| ORM | Prisma 6 |
| Database | MySQL |
| Xác thực | JWT (Passport) |
| Phân quyền | CASL (`@casl/ability`, `@casl/prisma`) |
| Validate | class-validator |
| Hash password | bcrypt |

## Kiến trúc tổng quan

**Luồng xử lý 1 request:**

1. Client gửi GraphQL query/mutation qua `POST /graphql`
2. `GqlAuthGuard` — xác thực JWT, gắn thông tin user vào request
3. `PoliciesGuard` / `RolesGuard` — kiểm tra quyền truy cập (tùy từng API)
4. `Resolver` — nhận request, gọi xuống Service tương ứng
5. `Service` — xử lý logic nghiệp vụ, gọi Prisma
6. `PrismaService` — thực thi truy vấn xuống MySQL


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
    - `roles.decorator.ts`, `roles.guard.ts`
    - `dto/`, `entities/`
  - `casl/` — Phân quyền field-level dùng chung nhiều module
    - `casl.module.ts`
    - `casl-ability.factory.ts`
    - `policies.guard.ts`
    - `check-policies.decorator.ts`
  - `prisma/` — Kết nối database dùng chung
    - `prisma.module.ts`
    - `prisma.service.ts`
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
- Khi `APPROVED`, hệ thống tự tạo 1 bản ghi `Attendance` tương ứng (liên kết qua `attendanceId`), đảm bảo API xem lịch sử chỉ cần truy vấn đúng 1 bảng.

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

Ứng dụng chạy tại `http://localhost:3000/graphql` (Apollo Sandbox).

### Tạo tài khoản ADMIN

Đăng ký 1 tài khoản qua mutation `register`, sau đó sửa `role` thành `ADMIN` trực tiếp qua Prisma Studio:

```bash
npx prisma studio
```

## Xác thực & Phân quyền

### Xác thực (Authentication)

Dùng JWT — sau khi `login`/`register` thành công, client nhận `accessToken`, gửi kèm mọi request cần đăng nhập qua header:

Authorization: Bearer <accessToken>


`GqlAuthGuard` chịu trách nhiệm xác thực token và gắn thông tin user (`userId`, `role`) vào request.

### Phân quyền (Authorization)

Sử dụng cơ chế CASL
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
| `attendanceRequests(status?)` | Query | Xem đơn xin chấm công ngoài (EMPLOYEE chỉ xem của mình, ADMIN xem toàn bộ)  | `GqlAuthGuard`, `PoliciesGuard` |
| `approveRequest(requestId)` | Mutation | Phê duyệt đơn xin chấm công (ADMIN) | `GqlAuthGuard` |
| `rejectRequest(requestId)` | Mutation | Từ chối đơn xin chấm công ngoài (ADMIN) | `GqlAuthGuard` |

## Luồng nghiệp vụ chính

### Chấm công thông thường

User đăng nhập → checkin() → Attendance (type: NORMAL) được tạo


### Xin chấm công ngoài

User → createRequest(requestTime, reason)
→ AttendanceRequest (status: PENDING) được tạo
→ validate: requestTime phải là quá khứ

Admin → attendanceRequests(status: PENDING) → xem danh sách chờ duyệt

Admin → approveRequest(requestId)
→ Transaction:
1. Kiểm tra đơn đang ở trạng thái PENDING
2. Tạo Attendance mới (type: MANUAL, checkTime = requestTime của đơn)
3. Update AttendanceRequest: status = APPROVED, reviewBy, reviewAt, attendanceId

User → attendanceHistory() → thấy bản ghi MANUAL mới xuất hiện

--- hoặc ---

Admin → rejectRequest(requestId)
→ Update AttendanceRequest: status = REJECTED, reviewBy, reviewAt
→ Không tạo Attendance nào (đơn không được công nhận)


---

## Trạng thái hoàn thành

- [x] Đăng ký / Đăng nhập (JWT)
- [x] Chấm công
- [x] Xem lịch sử chấm công (filter theo thời gian, phân quyền theo role)
- [x] Tạo đơn xin chấm công ngoài
- [x] Admin xem danh sách đơn (filter theo trạng thái)
- [x] Admin duyệt / từ chối đơn

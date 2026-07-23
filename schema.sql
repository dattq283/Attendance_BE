# ------------------------------------------------------
# THIS FILE WAS AUTOMATICALLY GENERATED (DO NOT MODIFY)
# ------------------------------------------------------

type Attendance {
  checkTime: DateTime!
  createdAt: DateTime!
  id: ID!
  type: AttendanceType!
  userId: ID!
}

enum AttendanceType {
  MANUAL
  NORMAL
}

type AuthResponse {
  accessToken: String!
  user: User!
}

"""
A date-time string at UTC, such as 2019-12-03T09:54:33Z, compliant with the date-time format.
"""
scalar DateTime

input LoginInput {
  email: String!
  password: String!
}

type Mutation {
  checkIn: Attendance!
  login(input: LoginInput!): AuthResponse!
  register(input: RegisterInput!): AuthResponse!
}

type Query {
  adminOnly: String!
  checkAttendancePermission: String!
}

input RegisterInput {
  email: String!
  fullName: String!
  password: String!
}

type User {
  createdAt: DateTime!
  email: String!
  fullName: String!
  id: ID!
  role: String!
  updatedAt: DateTime
}
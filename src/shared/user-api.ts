/**
 * User auth API types shared between client and server.
 * No runtime code — types only.
 */

export type { UserRegistrationField } from '../types/user'

export type RegisterInput = {
  email: string
  password: string
  prename?: string
  lastname?: string
  phone?: string
  newsletter?: boolean
  captchaToken?: string
}

export type RegisterResult = {
  redirectUrl: string
}

export type LoginInput = {
  email: string
  password: string
}

export type ExposedUser = {
  id: string
  email: string | undefined
  lastSignIn: string | undefined
}

export type LoginResult = {
  user: ExposedUser
}

export type LogoutResult = Record<string, never>

export type ConfirmInput = {
  token: string
}

export type ConfirmResult = {
  user: ExposedUser
  redirectUrl: string
}

export type RecoverInput = {
  email: string
  captchaToken?: string
}

export type RecoverResult = {
  redirectUrl: string
}

export type ResetInput = {
  token: string
  password: string
  type?: string
}

export type ResetResult = {
  redirectUrl: string
}

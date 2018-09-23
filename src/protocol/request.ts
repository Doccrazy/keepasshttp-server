export const PROTOCOL_VERSION = '1.8.4.2'

export enum Type {
  GET_LOGINS = 'get-logins',
  GET_LOGINS_COUNT = 'get-logins-count',
  GET_ALL_LOGINS = 'get-all-logins',
  SET_LOGIN = 'set-login',
  ASSOCIATE = 'associate',
  TEST_ASSOCIATE = 'test-associate',
  GENERATE_PASSWORD = 'generate-password'
}

export interface Base {
  readonly RequestType: Type
  readonly TriggerUnlock?: boolean
  readonly Id?: string
  readonly Nonce?: string
  readonly Verifier?: string
}

export interface TestAssociate extends Base {
  readonly RequestType: Type.TEST_ASSOCIATE
}

export interface Associate extends Base {
  readonly RequestType: Type.ASSOCIATE
  readonly Key: string
}

export interface GetLogins extends Base {
  readonly RequestType: Type.GET_LOGINS
  readonly Url: string
  readonly SubmitUrl: string
  readonly SortSelection: string
  readonly Realm: string
}

export interface GetLoginsCount extends Base {
  readonly RequestType: Type.GET_LOGINS_COUNT
  readonly Url: string
  readonly SubmitUrl: string
  readonly Realm: string
}

export interface GetAllLogins extends Base {
  readonly RequestType: Type.GET_ALL_LOGINS
}

export interface SetLogin extends Base {
  readonly RequestType: Type.SET_LOGIN
  readonly Url: string
  readonly SubmitUrl?: string
  readonly Login: string
  readonly Password: string
  readonly Uuid?: string
  readonly Realm?: string
}

export interface GeneratePassword extends Base {
  readonly RequestType: Type.GENERATE_PASSWORD
}

export type ValidRequest =
  TestAssociate
  | Associate
  | GetLogins
  | GetLoginsCount
  | GetAllLogins
  | SetLogin
  | GeneratePassword

export function isValid(req: any): req is ValidRequest {
  return !!req && Object.values(Type).includes(req.RequestType)
}

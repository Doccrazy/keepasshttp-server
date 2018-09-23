import * as Request from './request'
import { createNonce, createVerifier, encrypt } from './crypto'

export const PROTOCOL_ERROR = { Success: false }

export interface VerifiedRequest extends Request.Base {
  Id: string
  Nonce: string
  encryptionKey: Buffer
}

export class Response {
  private readonly requestType: Request.Type
  protected error?: string
  protected success: boolean = false

  protected constructor(request: Request.Base) {
    this.requestType = request.RequestType
  }

  static error(request: Request.Base, message?: string) {
    const res = new Response(request)
    res.error = message
    return res
  }

  toJSON() {
    return {
      RequestType: this.requestType,
      Error: this.error,
      Success: this.success,
      Version: Request.PROTOCOL_VERSION
    }
  }
}

export class AuthenticatedResponse extends Response {
  private readonly id: string
  protected readonly databaseHash: string
  protected readonly nonce: Buffer
  protected readonly encryptionKey: Buffer

  constructor(request: VerifiedRequest, databaseHash: string) {
    super(request)
    this.success = true
    this.databaseHash = databaseHash
    this.id = request.Id
    this.nonce = createNonce()
    this.encryptionKey = request.encryptionKey
  }

  toJSON() {
    const verifier = createVerifier(this.encryptionKey, this.nonce)

    const crypt = { Nonce: this.nonce.toString('base64'), Verifier: verifier.toString('base64') }

    return {
      ...super.toJSON(),
      Id: this.id,
      Hash: this.databaseHash,
      ...crypt
    }
  }

  protected encryptString(data: string) {
    return data ? encrypt(this.encryptionKey, this.nonce, data).toString('base64') : null
  }
}

export class GetLoginsCountResponse extends AuthenticatedResponse {
  constructor(request: VerifiedRequest, databaseHash: string, private readonly count: number) {
    super(request, databaseHash)
  }

  toJSON() {
    return {
      ...super.toJSON(),
      Count: this.count
    }
  }
}

export class GetLoginsResponse extends AuthenticatedResponse {
  private readonly entries: LoginEntry[]

  constructor(request: VerifiedRequest, databaseHash: string, entries: LoginEntry[]) {
    super(request, databaseHash)
    this.entries = entries
  }

  toJSON() {
    return {
      ...super.toJSON(),
      Count: this.entries.length,
      Entries: this.entries.map(entry => ({
        Login: this.encryptString(entry.login),
        Password: this.encryptString(entry.password),
        Uuid: this.encryptString(entry.uuid),
        Name: this.encryptString(entry.name),
        StringFields: entry.stringFields.map(field => ({
          Key: this.encryptString(field.key),
          Value: this.encryptString(field.value)
        }))
      }))
    }
  }
}

export class LoginEntry {
  constructor(
    readonly name: string,
    readonly login: string,
    readonly password: string,
    readonly uuid: string,
    readonly stringFields: LoginStringField[] = []) {
  }
}

export class LoginStringField {
  constructor(
    readonly key: string,
    readonly value: string) {
  }
}

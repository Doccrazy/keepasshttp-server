import KeyStore from '../api/KeyStore'
import * as Request from './request'
import {
  AuthenticatedResponse,
  GetLoginsCountResponse,
  GetLoginsResponse,
  PROTOCOL_ERROR,
  Response, LoginEntry,
  VerifiedRequest, LoginStringField
} from './response'
import { createVerifier, decrypt, validCipherParams } from './crypto'
import Protocol from '../server/Protocol'
import PasswordGenerator from '../api/PasswordGenerator'
import DatabaseAccessor, { DatabaseEntry } from '../api/DatabaseAccessor'

export default class KeePassHttpProtocol implements Protocol {
  constructor(
    private readonly keyStore: KeyStore,
    private readonly passwordGenerator: PasswordGenerator,
    private readonly databaseAccessor: DatabaseAccessor) {
  }

  get name() {
    return 'keepasshttp'
  }

  get version() {
    return Request.PROTOCOL_VERSION
  }

  get defaultPort() {
    return 19455
  }

  async handle(request: any): Promise<any> {
    if (Request.isValid(request)) {
      switch (request.RequestType) {
        case Request.Type.TEST_ASSOCIATE:
          return this.verified(request, this.handleNoop.bind(this))
        case Request.Type.ASSOCIATE:
          return this.verified(request, this.handleNoop.bind(this), this.idFromAssociateRequest.bind(this))
        case Request.Type.GET_LOGINS:
          return this.verified(request, this.handleGetLogins.bind(this))
        case Request.Type.GET_LOGINS_COUNT:
          return this.verified(request, this.handleGetLoginsCount.bind(this))
        case Request.Type.GET_ALL_LOGINS:
          return this.verified(request, this.handleGetAllLogins.bind(this))
        case Request.Type.SET_LOGIN:
          return this.verified(request, this.handleSetLogin.bind(this))
        case Request.Type.GENERATE_PASSWORD:
          return this.verified(request, this.handleGeneratePassword.bind(this))
      }
    }
    return PROTOCOL_ERROR
  }

  private handleNoop(request: VerifiedRequest): Response {
    return new AuthenticatedResponse(request, this.databaseAccessor.getHash())
  }

  private async idFromAssociateRequest(request: Request.Associate): Promise<string> {
    if (!request.Key) {
      throw new Error('Missing Key attribute')
    }
    const key = Buffer.from(request.Key, 'base64')
    try {
      return await this.keyStore.associate(key)
    } catch (e) {
      throw new Error('Associate request has been rejected')
    }
  }

  private handleGetLogins(request: Request.GetLogins & VerifiedRequest) {
    const entries = this.performSearch(request)
    return new GetLoginsResponse(request, this.databaseAccessor.getHash(), entries)
  }

  private handleGetLoginsCount(request: Request.GetLoginsCount & VerifiedRequest) {
    const entries = this.performSearch(request)
    return new GetLoginsCountResponse(request, this.databaseAccessor.getHash(), entries.length)
  }

  private performSearch(request: (Request.GetLogins | Request.GetLoginsCount) & VerifiedRequest): LoginEntry[] {
    const url = this.decryptString(request, request.Url)
    const submitUrl = this.decryptString(request, request.SubmitUrl)
    const realm = this.decryptString(request, request.Realm)

    return this.mapResult(this.databaseAccessor.search({ url, submitUrl, realm }))
  }

  private mapResult(searchResult: DatabaseEntry[]): LoginEntry[] {
    return searchResult.map(dbEntry => new LoginEntry(dbEntry.name, dbEntry.login, dbEntry.password, dbEntry.uuid,
      Object.keys(dbEntry.stringFields || {}).map(key => new LoginStringField(key, (dbEntry.stringFields || {})[key]))))
  }

  private handleGetAllLogins(request: Request.GetAllLogins & VerifiedRequest) {
    const allEntries = this.mapResult(this.databaseAccessor.search({}))
    return new GetLoginsResponse(request, this.databaseAccessor.getHash(), allEntries)
  }

  private handleSetLogin(request: Request.SetLogin & VerifiedRequest) {
    const url = this.decryptString(request, request.Url)
    const submitUrl = this.decryptString(request, request.SubmitUrl)
    const login = this.decryptString(request, request.Login)
    const password = this.decryptString(request, request.Password)
    const uuid = this.decryptString(request, request.Uuid)
    const realm = this.decryptString(request, request.Realm)

    if (!url || !login || !password) {
      return Response.error(request)
    }

    if (uuid) {
      this.databaseAccessor.update(uuid, login, password)
    } else {
      this.databaseAccessor.create(url, login, password, submitUrl, realm)
    }

    return new AuthenticatedResponse(request, this.databaseAccessor.getHash())
  }

  private handleGeneratePassword(request: Request.GeneratePassword & VerifiedRequest) {
    const password = this.passwordGenerator.generate()
    const qualityBits = this.passwordGenerator.estimateQualityBits(password)
    return new GetLoginsResponse(request, this.databaseAccessor.getHash(), [
      new LoginEntry(Request.Type.GENERATE_PASSWORD, String(qualityBits), password, Request.Type.GENERATE_PASSWORD)
    ])
  }

  private async verified<R extends Request.Base>(request: R, handler: (request: R & VerifiedRequest) => Response | Promise<Response>, idProvider?: (request: R) => Promise<string>) {
    let clientId
    try {
      clientId = idProvider ? await idProvider(request) : request.Id
    } catch (e) {
      return Response.error(request, e.message)
    }
    try {
      return handler(this.verifyRequest(request, clientId))
    } catch (e) {
      return Response.error(request, e.message)
    }
  }

  private verifyRequest<R extends Request.Base>(request: R, clientId?: string): R & VerifiedRequest {
    if (!request.Nonce || !request.Verifier || !clientId) {
      throw new Error('Missing required attributes')
    }
    const key = this.keyStore.retrieve(clientId)
    const nonce = Buffer.from(request.Nonce, 'base64')
    const verifier = Buffer.from(request.Verifier, 'base64')
    if (!key || !nonce || !validCipherParams(key, nonce)) {
      throw new Error('Request failed verification')
    }

    const testVerifier = createVerifier(key, nonce)

    if (testVerifier.equals(verifier)) {
      return Object.assign({}, request, { Id: clientId, Nonce: request.Nonce, encryptionKey: key })
    }
    throw new Error('Request failed verification')
  }

  private decryptString(request: VerifiedRequest, dataBase64?: string): string | null {
    if (!dataBase64) {
      return null
    }
    return decrypt(request.encryptionKey, Buffer.from(request.Nonce, 'base64'), Buffer.from(dataBase64, 'base64'))
  }
}

import { KeePassHttpProtocol } from '../../src/protocol/KeePassHttpProtocol'
import { PasswordGenerator } from '../../src/api/PasswordGenerator'
import { DatabaseAccessor } from '../../src/api/DatabaseAccessor'
import { KeyStore } from '../../src/api/KeyStore'
import * as Request from '../../src/protocol/request'
import { createNonce, createVerifier, decrypt } from '../../src/protocol/crypto'
import { randomBytes } from 'crypto'
import { Complete } from 'keepasshttp-client/model/response'

const ID = 'Test'
const NONCE = createNonce()
const KEY = randomBytes(32)

let mockStore: jest.Mocked<KeyStore>
let mockGenerator: jest.Mocked<PasswordGenerator>
let mockDatabase: jest.Mocked<DatabaseAccessor>
let protocol: KeePassHttpProtocol
beforeEach(() => {
  mockStore = {
    retrieve: jest.fn(),
    associate: jest.fn()
  }
  mockGenerator = {
    generate: jest.fn(),
    estimateQualityBits: jest.fn()
  }
  mockDatabase = {
    getHash: jest.fn(),
    search: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  }
  protocol = new KeePassHttpProtocol(mockStore, mockGenerator, mockDatabase)
})

test('port', () => {
  expect(protocol.defaultPort).toBeGreaterThan(0)
})

test('bad request', async () => {
  const r = await protocol.handle('Foo')
  expect(r.Success).toBeFalsy()
})

test('invalid associate requests', async () => {
  const a = await send(protocol, { RequestType: Request.Type.ASSOCIATE })
  expect(a.Success).toBeFalsy()
  expect(a.Error).toContain('attribute')

  mockStore.associate.mockResolvedValue(ID)
  mockStore.retrieve.mockReturnValue(KEY)
  const b = await send(protocol, { RequestType: Request.Type.ASSOCIATE, Key: KEY.toString('base64'), Nonce: NONCE.toString('base64'), Verifier: Buffer.from('invalidVerifier').toString('base64') })
  expect(b.Success).toBeFalsy()
  expect(b.Error).toContain('verif')

  mockStore.associate.mockReset()
  mockStore.associate.mockRejectedValue('cancel')
  const c = await send(protocol, { RequestType: Request.Type.ASSOCIATE, Key: KEY.toString('base64'), Nonce: NONCE.toString('base64'), Verifier: createVerifier(KEY, NONCE) })
  expect(c.Success).toBeFalsy()
  expect(c.Error).toContain('reject')
})

describe('requests not supported by keepasshttp-client', () => {
  beforeEach(() => {
    mockStore.retrieve.mockReturnValue(KEY)
  })

  test('generatePassword', async () => {
    mockGenerator.generate.mockReturnValue('password')
    mockGenerator.estimateQualityBits.mockReturnValue(42)

    const pw = await send(protocol, { RequestType: Request.Type.GENERATE_PASSWORD })

    expect(pw.Count).toBe(1)
    expect(pw.Entries).toHaveLength(1)
    expect(dec(pw, pw.Entries[0].Name)).toBe(Request.Type.GENERATE_PASSWORD)
    expect(dec(pw, pw.Entries[0].Uuid)).toBe(Request.Type.GENERATE_PASSWORD)
    expect(dec(pw, pw.Entries[0].Login)).toBe('42')
    expect(dec(pw, pw.Entries[0].Password)).toBe('password')
  })

  test('getAllLogins', async () => {
    mockDatabase.search.mockReturnValue([])
    const all: Complete = await send(protocol, { RequestType: Request.Type.GET_ALL_LOGINS })
    expect(all.Count).toBe(0)
    expect(all.Entries).toHaveLength(0)
  })
})

async function send(protocol: KeePassHttpProtocol, body?: any) {
  const result = await protocol.handle({
    Id: ID,
    Verifier: createVerifier(KEY, NONCE).toString('base64'),
    Nonce: NONCE.toString('base64'),
    ...(body || {})
  })
  return (result && result.toJSON) ? result.toJSON() : result
}

function dec(res: any, value: string) {
  return decrypt(KEY, Buffer.from(res.Nonce, 'base64'), Buffer.from(value, 'base64'))
}

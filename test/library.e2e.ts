import createServer from '../src'
import KeyStore from '../src/api/KeyStore'
import PasswordGenerator from '../src/api/PasswordGenerator'
import DatabaseAccessor, { DatabaseEntry } from '../src/api/DatabaseAccessor'
import { KeePassHttpClient } from 'keepasshttp-client'
import { PROTOCOL_VERSION } from '../src/protocol/request'
import { logRequests, sendTo } from './utils'
import RestServer from '../src/server/RestServer'

class MockStore implements KeyStore {
  private key?: Buffer
  private static readonly ID = 'Test'

  retrieve(id: string): Buffer | null | undefined {
    if (id === MockStore.ID) {
      return this.key
    }
    return undefined
  }

  async associate(key: Buffer): Promise<string> {
    this.key = key
    return MockStore.ID
  }
}

const ID = 'Test'
const HASH = 'd8312a59523d3c37d6a5401d3cfddd077e194680'

let server: RestServer
let client: KeePassHttpClient
let mockStore: MockStore
let mockGenerator: jest.Mocked<PasswordGenerator>
let mockDatabase: jest.Mocked<DatabaseAccessor>
beforeEach(async () => {
  mockStore = new MockStore()
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

  mockDatabase.getHash.mockReturnValue(HASH)
  mockDatabase.search.mockImplementation(query => {
    if (query.url === 'http://domain.com') {
      const entry1: DatabaseEntry = {
        name: 'domain.com',
        login: 'user1',
        password: 'password1',
        uuid: '1',
        stringFields: {
          field1: 'value1'
        }
      }
      const entry2: DatabaseEntry = {
        name: 'domain.com',
        login: 'user2',
        password: 'password2',
        uuid: '2'
      }
      return [entry1, entry2]
    } else {
      return []
    }
  })

  server = createServer(mockStore, mockGenerator, mockDatabase)
  server.server.on('after', logRequests)

  await server.listen(0)

  client = new KeePassHttpClient({ url: `http://localhost:${server.port}` })
})

afterEach(async () => {
  await server.close()
})

describe('associate tests against keepasshttp-client implementation', () => {
  test('invalid testAssociate requests', async () => {
    const invalidClient = new KeePassHttpClient({ url: `http://localhost:${server.port}`, keyId: { key: '5f9WZ7t+9vExvJoV0TNewgvCMrhUospVyPvBllXjutE=', id: 'Invalid' } })
    await expect(invalidClient.testAssociate()).rejects.toBeDefined()

    const client = new KeePassHttpClient({ url: `http://localhost:${server.port}` })
    await expect(client.testAssociate()).rejects.toBeDefined()
  })

  test('valid associte requests', async () => {
    await client.associate()
    expect(client.key).toBeDefined()
    expect(client.id).toBe('Test')

    const testAss2 = await client.testAssociate()
    expect(testAss2.Success).toBeTruthy()
    expect(testAss2.Version).toBe(PROTOCOL_VERSION)
  })
})
describe('fully authenticated tests against keepasshttp-client implementation', () => {
  beforeEach(async () => {
    await client.associate()
  })

  test('getLogins', async () => {
    const records = await client.getLogins({ url: 'http://domain.com' })
    expect(records.Id).toBe(ID)
    expect(records.Hash).toBe(HASH)
    expect(records.Count).toBe(2)
    if (!records.Entries) {
      throw new Error()
    }
    expect(records.Entries).toHaveLength(2)
    expect(records.Entries[0].Login).toBe('user1')
    expect(records.Entries[0].Password).toBe('password1')
    expect(records.Entries[0].Name).toBe('domain.com')
    expect(records.Entries[0].Uuid).toBe('1')
    // @ts-ignore
    expect(records.Entries[0].StringFields[0].Key).toBe('field1')
    // @ts-ignore
    expect(records.Entries[0].StringFields[0].Value).toBe('value1')
    expect(records.Entries[1].Login).toBe('user2')

    const records2 = await client.getLogins({ url: 'http://example.com' })
    expect(records2.Count).toBe(0)
    expect(records2.Entries).toHaveLength(0)
  })

  test('getLoginsCount', async () => {
    const count = await client.getLoginsCount({ url: 'http://domain.com' })
    expect(count.Count).toBe(2)
    expect(count.Entries).toBeFalsy()

    const count2 = await client.getLoginsCount({ url: 'http://example.com' })
    expect(count2.Count).toBe(0)
    expect(count2.Entries).toBeFalsy()
  })

  test('createLogin', async () => {
    expect(client.createLogin({ url: '', login: '', password: '' })).rejects.toBeDefined()

    await client.createLogin({ url: 'http://example.com', login: 'exampleUser', password: 'examplePass', submitUrl: 'http://example.com/submit' })
    expect(mockDatabase.create).toBeCalledWith('http://example.com', 'exampleUser', 'examplePass', 'http://example.com/submit', null)
  })

  test('updateLogin', async () => {
    await client.updateLogin({ uuid: 'uuid', url: 'http://example.com', login: 'exampleUser', password: 'examplePass' })
    expect(mockDatabase.update).toBeCalledWith('uuid', 'exampleUser', 'examplePass')
  })
})

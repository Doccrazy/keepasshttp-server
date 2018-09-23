import createServer from '../src'
import KeyStore from '../src/api/KeyStore'
import PasswordGenerator from '../src/api/PasswordGenerator'
import DatabaseAccessor, { DatabaseEntry } from '../src/api/DatabaseAccessor'
import { KeePassHttpClient } from 'keepasshttp-client'
import { PROTOCOL_VERSION } from '../src/protocol/request'

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

it('handles requests from keepasshttp-client implementation', async () => {
  const mockStore = new MockStore()
  const mockGenerator: jest.Mocked<PasswordGenerator> = {
    generate: jest.fn(),
    estimateQualityBits: jest.fn()
  }
  const mockDatabase: jest.Mocked<DatabaseAccessor> = {
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

  const server = createServer(mockStore, mockGenerator, mockDatabase)
  try {
    await server.listen(0)

    const client = new KeePassHttpClient({ url: `http://localhost:${server.port}` })

    await expect(client.testAssociate()).rejects.toBeDefined()

    await client.associate()
    expect(client.key).toBeDefined()
    expect(client.id).toBe('Test')

    const testAss2 = await client.testAssociate()
    expect(testAss2.Success).toBeTruthy()
    expect(testAss2.Version).toBe(PROTOCOL_VERSION)

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

    const count = await client.getLoginsCount({ url: 'http://domain.com' })
    expect(count.Count).toBe(2)
    expect(count.Entries).toBeFalsy()

    const count2 = await client.getLoginsCount({ url: 'http://example.com' })
    expect(count2.Count).toBe(0)
    expect(count2.Entries).toBeFalsy()

    await client.createLogin({ url: 'http://example.com', login: 'exampleUser', password: 'examplePass' })
    expect(mockDatabase.create).toBeCalledWith('http://example.com', 'exampleUser', 'examplePass', null, null)
    await client.updateLogin({ uuid: 'uuid', url: 'http://example.com', login: 'exampleUser', password: 'examplePass' })
    expect(mockDatabase.update).toBeCalledWith('uuid', 'exampleUser', 'examplePass')
  } finally {
    await server.close()
  }
})

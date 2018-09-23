import KeyStore from '../src/api/KeyStore'
import PasswordGenerator from '../src/api/PasswordGenerator'
import DatabaseAccessor, { DatabaseEntry, SearchQuery } from '../src/api/DatabaseAccessor'
import createServer from '../src'

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

class MockGenerator implements PasswordGenerator {
  generate(): string {
    return 'foobar'
  }

  estimateQualityBits(password: string): number {
    return 94
  }
}

class MockDatabase implements DatabaseAccessor {
  getHash() {
    return 'd8312a59523d3c37d6a5401d3cfddd077e194680'
  }

  search(query: SearchQuery): DatabaseEntry[] {
    console.log(JSON.stringify(query))
    return []
  }

  create(url: string, login: string, password: string, submitUrl?: string | null, realm?: string | null): void {
    console.log(`Create: ${url} ${login} ${password} ${submitUrl} ${realm}`)
  }

  update(uuid: string, login: string, password: string): void {
    console.log(`Update: ${uuid} ${login} ${password}`)
  }
}

createServer(new MockStore(), new MockGenerator(), new MockDatabase()).listen().then(() => {
  console.log('Example app listening!')
}, e => console.log(e))

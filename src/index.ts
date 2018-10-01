import { RestServer } from './server/RestServer'
import { KeyStore } from './api/KeyStore'
import { KeePassHttpProtocol } from './protocol/KeePassHttpProtocol'
import { PasswordGenerator } from './api/PasswordGenerator'
import { DatabaseAccessor } from './api/DatabaseAccessor'

export function createServer(keyStore: KeyStore, passwordGenerator: PasswordGenerator, databaseAccessor: DatabaseAccessor) {
  return new RestServer(new KeePassHttpProtocol(keyStore, passwordGenerator, databaseAccessor))
}

/**
 * Interface to the secret database (find or update login secrets)
 */
export interface DatabaseAccessor {
  /**
   * Get a hex hash uniquely identifying the opened database.
   * In KeePass, this is composed of RootGroup UUid and RecycleBin UUid.
   */
  getHash(): string

  /**
   * Search for entries matching the passed query
   * @param query Search query for login entries. All fields may be empty, in which case all applicable
   *              login entries should be returned
   */
  search(query: SearchQuery): DatabaseEntry[]

  create(url: string, login: string, password: string, submitUrl?: string | null, realm?: string | null): void

  /**
   * Update login/password of an existing entry
   * @param uuid Unique identifier of the entry to update (as returned from search)
   * @param login
   * @param password
   */
  update(uuid: string, login: string, password: string): void
}

/**
 * Search query against secret database
 */
export interface SearchQuery {
  url?: string | null
  submitUrl?: string | null
  realm?: string | null
}

/**
 * Single result of database search
 */
export interface DatabaseEntry {
  name: string
  login: string
  password: string
  uuid: string
  stringFields?: {[key: string]: string}
}

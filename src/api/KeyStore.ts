/**
 * Handles persistent storage and retrieval of network encryption keys
 */
export default interface KeyStore {
  /**
   * Retrieve key stored for client id
   */
  retrieve(id: string): Buffer | null | undefined

  /**
   * Create an id for a new client (possibly requesting it from the user), store it, then resolve with the new id
   */
  associate(key: Buffer): Promise<string>
}

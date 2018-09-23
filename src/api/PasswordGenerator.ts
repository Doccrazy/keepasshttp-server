/**
 * Interface to secure password generator
 */
export default interface PasswordGenerator {
  /**
   * Generate a password with the selected default profile
   */
  generate(): string

  /**
   * Calculate a quality estimation of the passed password
   */
  estimateQualityBits(password: string): number
}

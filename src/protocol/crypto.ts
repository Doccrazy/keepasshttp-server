import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-cbc'
const KEY_SIZE = 32
const IV_SIZE = 16

export function validCipherParams(key: Buffer, iv: Buffer) {
  return key.length === KEY_SIZE && iv.length === IV_SIZE
}

export function createNonce() {
  return randomBytes(IV_SIZE)
}

export function createVerifier(key: Buffer, iv: Buffer) {
  return encrypt(key, iv, iv.toString('base64'))
}

export function encrypt(key: Buffer, iv: Buffer, data: string) {
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const buf = cipher.update(data, 'utf8')
  return Buffer.concat([buf, cipher.final()])
}

export function decrypt(key: Buffer, iv: Buffer, data: Buffer) {
  const cipher = createDecipheriv(ALGORITHM, key, iv)
  const buf = cipher.update(data)
  return Buffer.concat([buf, cipher.final()]).toString('utf8')
}

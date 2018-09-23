import * as http from 'http'
import RestServer from '../../src/server/RestServer'
import Protocol from '../../src/server/Protocol'
import { AddressInfo } from 'net'

let mockProtocol: Protocol & { handle: jest.MockInstance<Protocol['handle']> }
beforeEach(() => {
  mockProtocol = {
    defaultPort: 12345,
    name: 'Test',
    version: '1.2.3',

    handle: jest.fn()
  }
})

describe('RestServer test', () => {
  it('starts and stops listening correctly', async () => {
    const server = new RestServer(mockProtocol)
    expect(server.listening).toBeFalsy()
    await server.listen(0)

    try {
      expect(server.listening).toBeTruthy()
      expect(server.port).toBeGreaterThan(0)
      await server.close()
      expect(server.listening).toBeFalsy()
      await server.listen(0)
      expect(server.listening).toBeTruthy()
      expect(mockProtocol.handle).toHaveBeenCalledTimes(0)
    } finally {
      await server.close()
    }
  })

  it('retries failed listen attempts', async () => {
    const srv2 = await new Promise<http.Server>(resolve => {
      const s = new http.Server()
      s.listen({ host: '127.0.0.1', port: 0, exclusive: true }, () => resolve(s))
    })
    const server = new RestServer(mockProtocol)
    try {
      setTimeout(() => srv2.close(), 500)
      await server.listen((srv2.address() as AddressInfo).port, '127.0.0.1')
    } finally {
      server.close()
      srv2.close()
    }
  })

  it('aborts pending listen attempts', async () => {
    const srv2 = await new Promise<http.Server>(resolve => {
      const s = new http.Server()
      s.listen({ host: '127.0.0.1', port: 0, exclusive: true }, () => resolve(s))
    })
    const server = new RestServer(mockProtocol)
    try {
      const listenPromise = server.listen((srv2.address() as AddressInfo).port, '127.0.0.1')
      await new Promise<void>(resolve => setTimeout(resolve, 500))
      await server.close()
      await expect(listenPromise).rejects.toBeUndefined()
    } finally {
      server.close()
      srv2.close()
    }
  })

  it('fails on invalid host', async () => {
    const server = new RestServer(mockProtocol)
    await expect(server.listen(0, '99.99.99.99')).rejects.toBeUndefined()
  })

  it('forwards requests to the protocol', async () => {
    mockProtocol.handle.mockReturnValue(Promise.resolve('Ho'))

    const server = new RestServer(mockProtocol)
    await server.listen(0)
    try {
      const response = await sendTo(server, 'Hi')
      expect(mockProtocol.handle).toHaveBeenCalledWith('Hi')
      expect(response).toBe('Ho')
    } finally {
      await server.close()
    }
  })
})

async function sendTo(server: RestServer, data: any) {
  return new Promise<string>((resolve, reject) => {
    let body = ''
    const request = http.request({ host: 'localhost', port: server.port, method: 'POST', headers: { 'Content-Type': 'application/json' }, timeout: 2000 }, res => {
      res.setEncoding('utf8')
      res.on('data', chunk => {
        body += chunk
      })
      res.on('close', () => {
        return resolve(body ? JSON.parse(body) : '')
      })
    })
    request.on('error', reject)
    request.end(data ? JSON.stringify(data) : '')
  })
}

import * as restify from 'restify'
import Protocol from './Protocol'

const DEFAULT_HOST = '127.0.0.1'

/**
 * Exposes a Protocol on a TCP port
 */
export default class RestServer {
  private readonly server: restify.Server
  private retryTimer?: NodeJS.Timer
  private retryReject?: (reason?: any) => void

  /**
   * Create a new RestServer for the passed protocol. The server will initially be stopped!
   * @param protocol Protocol implementation to handle all requests
   */
  constructor(private readonly protocol: Protocol) {
    this.server = restify.createServer({
      name: protocol.name,
      version: protocol.version
    })
    this.server.setMaxListeners(0)

    this.server.use(restify.plugins.acceptParser(this.server.acceptable))
    this.server.use(restify.plugins.queryParser())
    this.server.use(restify.plugins.bodyParser())

    this.server.post('/', (req, res, next) => {
      console.log('<- ' + JSON.stringify(req.body, null, '  '))
      return this.protocol.handle(req.body).then(response => {
        console.log('-> ' + JSON.stringify(response, null, '  '))
        res.send(response)
        return next()
      }, next)
    })
  }

  /**
   * Start listening for incoming requests.
   * If the port is unavailable, the listen call will be retried every second
   * until the socket is opened successfully or close() is called.
   * @param port TCP port to listen on; omit to use the protocol's default port
   * @param host hostname/IP to bind to; omit for localhost
   * @return a promise that resolves once the server is up and running
   */
  listen(port?: number, host?: string): Promise<void> {
    const listenPort = typeof port === 'undefined' ? this.protocol.defaultPort : port
    const listenHost = host || DEFAULT_HOST
    return new Promise<void>((resolve, reject) => {
      const error = (e: any) => {
        this.server.removeListener('error', error)
        if (e.code === 'EADDRINUSE') {
          this.retryReject = reject
          this.retryTimer = setTimeout(() => {
            this.retryTimer = undefined
            this.server.close()
            this.server.on('error', error)
            this.server.listen(listenPort, listenHost, success)
          }, 1000)
        } else {
          reject()
        }
      }
      const success = () => {
        this.server.removeListener('error', error)
        resolve()
      }

      this.server.on('error', error)
      this.server.listen(listenPort, listenHost, success)
    })
  }

  /**
   * Close the server and stop accepting connections. Call listen() to start the server again.
   */
  close(): Promise<void> {
    if (this.retryTimer && this.retryReject) {
      clearTimeout(this.retryTimer)
      this.retryReject()
      this.retryTimer = undefined
      this.retryReject = undefined
    }
    if (!this.listening) {
      return Promise.resolve()
    }
    return new Promise<void>(resolve => {
      this.server.close(resolve)
    })
  }

  /**
   * returns true if the server is active and accepting connections.
   */
  get listening() {
    return this.server.server.listening
  }

  get port() {
    return this.server.address().port
  }
}

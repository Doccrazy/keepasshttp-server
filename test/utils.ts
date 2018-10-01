import * as restify from 'restify'
import { RestServer } from '../src/server/RestServer'
import * as http from 'http'

export function logRequests(req: restify.Request, resp: restify.Response) {
  console.log('<- ' + JSON.stringify(req.body, null, '  ') + '\n'
    + '-> ' + JSON.stringify((resp as any)._body, null, '  '))
}

export async function sendTo(server: RestServer, data: any) {
  return new Promise<any>((resolve, reject) => {
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

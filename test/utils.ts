import * as restify from 'restify'

export function logRequests(req: restify.Request, resp: restify.Response) {
  console.log('<- ' + JSON.stringify(req.body, null, '  ') + '\n'
    + '-> ' + JSON.stringify((resp as any)._body, null, '  '))
}

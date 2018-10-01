/**
 * Protocol handler that responds to incoming REST requests
 */
export interface Protocol {
  readonly name: string

  readonly version: string

  readonly defaultPort: number

  handle(request: any): Promise<any>
}

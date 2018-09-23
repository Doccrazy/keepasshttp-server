# keepasshttp-server

A server component for the [KeePassHttp](https://github.com/pfn/keepasshttp) protocol for NodeJS. Secret storage agnostic (not limited to KeePass), minimal dependencies. Requires Node 8+.

### Usage

:warning: This library is targeted to developers of password managers. It does not provide any functionality on its own.

Install the package:
```bash
npm i keepasshttp-server
```
Use in your custom secret storage:
```js
import createServer from 'keepasshttp-server'

// implement keyStore, passwordGenerator and databaseAccessor against your backend

createServer(keyStore, passwordGenerator, databaseAccessor).listen();
```

### Features
- Bring-your-own-backend. This component only implements the network protocol and the REST server. It does not depend on or implement any KeePass specifics.
- Minimal dependencies. Only `restify` is used as a REST server library.
- Simple callback API
- Connect any custom secret storage to a [KeePassHttp](https://github.com/pfn/keepasshttp)-compatible browser plugin. Tested against [chromeIPass for Google Chrome](https://chrome.google.com/webstore/detail/chromeipass/ompiailgknfdndiefoaoiligalphfdae?hl=en) and [KeePassHttp-Connector for Mozilla Firefox](https://addons.mozilla.org/de/firefox/addon/keepasshttp-connector/).
- AES-256 encrypted communication protocol to protect your secrets.

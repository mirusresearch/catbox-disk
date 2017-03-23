catbox-disk
=============

Disk storage adapter for [catbox](https://github.com/hapijs/catbox).

Lead Maintainer - [Andrew Hughes](https://github.com/EyePulp)

Code liberally cribbed from various other adapter examples, primarily [catbox-memory](https://github.com/hapijs/catbox-memory) and [catbox-s3](https://github.com/fhemberger/catbox-s3)

### Options
An example invocation:
```javascript
const client = new Catbox.Client(Disk, { cachePath: '/some/existing/dir', cleanEvery: 100000 });
```
    - `cachePath` : `string` required - a pre-existing path you want to store your cache files in
    - `cleanEvery` : `integer` optional - number of milliseconds between each time we look for expired ttl's in files and drop them. Defaults to 1 hour.

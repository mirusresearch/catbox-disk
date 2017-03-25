catbox-disk [![Build Status](https://travis-ci.org/EyePulp/catbox-disk.svg?branch=master)](https://travis-ci.org/EyePulp/catbox-disk)
=============

Disk storage adapter for [catbox](https://github.com/hapijs/catbox).

Lead Maintainer - [Andrew Hughes](https://github.com/EyePulp)

Code liberally cribbed from various other adapter examples, primarily
  - [catbox-memory](https://github.com/hapijs/catbox-memory)
  - [catbox-s3](https://github.com/fhemberger/catbox-s3)

### Options
An example invocation:
```javascript
const client = new Catbox.Client(Disk, { cachePath: '/some/existing/dir', cleanEvery: 3600000, ignorePatterns:[/\.stfolder/] });
```
  - `cachePath`      : `string` **required** - a pre-existing path you want to store your cache files in
  - `cleanEvery`     : `integer <default 1 hour>` **optional** - number of milliseconds between each cache cleanup for disk space recovery. Set to 0 to deactivate entirely.
  - `ignorePatterns` : `array <default empty []>` **optional** - an array of regex patterns to ignore when the cache cleaner runs e.g. `[/^ignoreme/,/\.keep$/]`

### Notes
  - This cache doesn't currently set any sort of upper limit on its growth.  Plan accordingly, and monitor your free drive space if you're not certain about behavior.
  - If you access an expired file (ttl exceeded) we unlink (delete) the file right then
  - If you never access an old cached file, it will take up drivespace until deleted, which is why we have the `cleanEvery` option and default it to activated.  Be careful when deactivating it.


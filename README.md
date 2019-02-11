catbox-disk [![Build Status](https://travis-ci.org/mirusresearch/catbox-disk.svg?branch=master)](https://travis-ci.org/mirusresearch/catbox-disk)
=============

Disk storage adapter for [catbox](https://github.com/hapijs/catbox).

Lead Maintainer - [Andrew Hughes](https://github.com/EyePulp)

Code liberally cribbed from various other adapter examples, primarily
  - [catbox-memory](https://github.com/hapijs/catbox-memory)
  - [catbox-s3](https://github.com/fhemberger/catbox-s3)

### Version Note:
**Users of Hapi less than v17 should use the 2.x.x version of this plugin.  For Hapi v17 and above use version 3.x.x or greater.**

### Example invocations:
#### >= Hapi v17.0.0:
```javascript
const Hapi = require('hapi');
const Disk = require('catbox-disk');

const server = new Hapi.Server({
    cache : [{
            name      : 'diskCache',
            engine    : new Disk({
              cachePath: '/some/existing/dir',
              cleanEvery: 3600000,
              partition : 'cache'
            }),
    }]
});
```
#### < Hapi v17.0.0:
```javascript
const Hapi = require('hapi');
const Disk = require('catbox-disk');

const server = new Hapi.Server({
    cache : [{
            name      : 'diskCache',
            engine    : Disk,
            cachePath: '/some/existing/dir',
            cleanEvery: 3600000,
            partition : 'cache'
    }]
});
```

### Opttions:

  - `cachePath`      : `string` **required** - a pre-existing path you want to store your cache files in
  - `cleanEvery`     : `integer <default 1 hour>` **optional** - number of milliseconds between each cache cleanup for disk space recovery. Set to 0 to deactivate entirely.

### Notes:
  - This cache backend stores everything in flat `.json` files with MD5 hashed filenames based off the keys to avoid encoding issues & length limits at the filesystem level.
  - Initial hash character prefixes are used to split file storage into multiple sub directories to avoid excessive file counts in any one directory, e.g. `ABCD1234DEADBEEF.json` is stored in `.../AB/CD/ABCD1234DEADBEEF.json`
  - **This cache doesn't set an upper limit on disk usage.**  Plan accordingly, and monitor your free drive space if you're not certain about behavior.
  - Old, un-accessed files are automatically purged via the `cleanEvery` interval option, which is active by default. If you never access an old cached file, it will take up drivespace until deleted, which is why this option is important.  **Be mindful if you deactivate it**.



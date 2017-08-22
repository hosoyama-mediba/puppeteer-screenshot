# puppeteer-screenshot

## usage

```sh
  Usage: screenshot [options...] <url>


  Options:

    -V, --version           output the version number
    -e, --emulate <device>  emulate device. defualts to "iPhone 6"
    -o, --output <path>     path to output directory. defualts to "files"
    -r, --retry <count>     retry count defaults to "0"
    -s, --show              show browser window for debug
    -h, --help              output usage information
```

### example

```sh
$ node screenshot.js https://example.com/
$ node screenshot.js -e 'Nexus 6P' -r 2 https://example.com/
```

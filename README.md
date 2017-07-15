[![Build Status][ci-img]][ci-url]
[![Code Climate][clim-img]][clim-url]
[![Greenkeeper badge][gk-img]][gk-url]
[![NPM][npm-img]][npm-url]
<!-- requires URL update [![Windows Build Status][ci-win-img]][ci-win-url] -->
<!-- doesn't work in haraka plugins... yet. [![Code Coverage][cov-img]][cov-url]-->

# haraka-plugin-elasticsearch

Ship Haraka log info directly to Elasticsearch

## Enable Travis-CI testing

- [ ] visit your [Travis-CI profile page](https://travis-ci.org/profile) and enable Continuous Integration testing on the repo
- [ ] enable Code Climate. Click the _code climate_ badge and import your repo.


# Add your content here

## INSTALL

```sh
cd /path/to/local/haraka
npm install haraka-plugin-elasticsearch
echo "elasticsearch" >> config/plugins
service haraka restart
```

### Configuration

If the default configuration is not sufficient, copy the config file from the distribution into your haraka config dir and then modify it:

```sh
cp node_modules/haraka-plugin-elasticsearch/config/elasticsearch.ini
config/elasticsearch.ini
$EDITOR config/elasticsearch.ini
```

## USAGE


<!-- leave these buried at the bottom of the document -->
[ci-img]: https://travis-ci.org/haraka/haraka-plugin-elasticsearch.svg
[ci-url]: https://travis-ci.org/haraka/haraka-plugin-elasticsearch
[ci-win-img]: https://ci.appveyor.com/api/projects/status/CHANGETHIS?svg=true
[ci-win-url]: https://ci.appveyor.com/project/haraka/haraka-CHANGETHIS
[cov-img]: https://codecov.io/github/haraka/haraka-plugin-elasticsearch/coverage.svg
[cov-url]: https://codecov.io/github/haraka/haraka-plugin-elasticsearch
[clim-img]: https://codeclimate.com/github/haraka/haraka-plugin-elasticsearch/badges/gpa.svg
[clim-url]: https://codeclimate.com/github/haraka/haraka-plugin-elasticsearch
[gk-img]: https://badges.greenkeeper.io/haraka/haraka-plugin-elasticsearch.svg
[gk-url]: https://greenkeeper.io/
[npm-img]: https://nodei.co/npm/haraka-plugin-elasticsearch.png
[npm-url]: https://www.npmjs.com/package/haraka-plugin-elasticsearch

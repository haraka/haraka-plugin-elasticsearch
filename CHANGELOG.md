# Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/).

### Unreleased

### [8.1.5] - 2025-10-07

- fix: update templates path, so included in module
- fix: log_delivery, log_bounce and log_delay when disabled #66

### [8.1.4] - 2025-03-12

- fix: update the path to log settings #64
- replace self-made UUID with utils.uuid(), #64
- codeclimate: update config for eslint 9

### [8.1.3] - 2025-03-10

- doc(README): improve formatting
- Log bounce, deferred and delivery (#62)
  - index.interval = auto will strip dates from the index name

### [8.1.2] - 2025-02-06

- FEATURE: support for Cloud ID and the "@timestamp" field #60
- moved ./index-templates into ./templates/index
  - tmpl/i/v8: order plugins alphabetically
- added ./templates/component/
- test: update syntax for putTemplate
- prune redundant and low-value data before insertion
  - p0f: remove most numeric fields
  - rspamd: remove is_skipped
  - plugin: remove {local,remote,reset}, they already exist on conn property
  - delete p.tls.peerCertificate, too noisy, has 46 keys

### [8.1.1] - 2025-02-03

- fix: connection.remote_host -> connection.remote.host

### [8.1.0] - 2025-02-03

- FEATURE: the index name can now be specified in the config
- style(es6): replace plugin with 'this'

### [8.0.4] - 2025-02-03

- dep(eslint): upgraded to v9
- style(prettier): moved config into package.json

### [8.0.3] - 2024-08-23

- Create index-template-map_es8.json for ES 8 (#54)
- move index templates into directory
- chore: prettier automated code formatting
- dep: eslint-plugin-haraka -> @haraka/eslint-config
- update 'lint' script in package.json
- populate [files] in package.json. Delete .npmignore.
- ci: only publish when package.json modified
- doc(CONTRIBUTORS): added

### [8.0.2] - 2023-12-03

- Update auth example for ES 8.x (#51)
- Update tls connection options for ES 8 (#49)

### [8.0.0] - 2023-06-09

- dep(elastic): bump dep version to 8.8
- update @elastic syntax to promise API

### [7.0.0] - 2023-06-08

- chore: update ci & packaging
- dep(elastic): bump dep version to 7.17
- bump major version to match ES major version

### [1.1.0] - 2023-06-08

- dep(elastic): dump dep version to 8.8

### [1.0.8] - 2022-06-06

- ci: add .npmignore
- ci: publish needs es started up too

### [1.0.7] - 2022-06-06

- ci: use shared GHA workflows
- ci: add submodule .release
- es7: update index map template

### 1.0.6 - 2020-07-21

- add URI for connection settings
- add options to specify user & ssl connection settings
- bump elasticsearch client to version 7.8

### 1.0.5 - 2020-04-29

- update to upstream @elastic/elasticsearch@6
- convert test runner to mocha
- use GitHub actions instead of Travis & AppVeyor
- package.json: depend on latest eslint

### 1.0.4 - 2019-09-22

- update index template for ES 6

### 1.0.3 - 2017-08-22

- fix txr variable scope
- add tests for get_es_hosts

### 1.0.2 - 2017-07-29

- also prune null values because typeof null === object
- add test storing doc against index template
- get ES testing working on AppVeyor (windows)

### 1.0.1 - 2017-07-29

- qualify the path to plugin.\*.msg to avoid collision

### 1.0.0 - 2017-07-14

- initial release

[1.0.6]: https://github.com/haraka/haraka-plugin-elasticsearch/releases/tag/1.0.6
[1.0.7]: https://github.com/haraka/haraka-plugin-elasticsearch/releases/tag/1.0.7
[1.0.8]: https://github.com/haraka/haraka-plugin-elasticsearch/releases/tag/1.0.8
[1.1.0]: https://github.com/haraka/haraka-plugin-elasticsearch/releases/tag/1.1.0
[7.0.0]: https://github.com/haraka/haraka-plugin-elasticsearch/releases/tag/v7.0.0
[8.0.0]: https://github.com/haraka/haraka-plugin-elasticsearch/releases/tag/v8.0.0
[8.0.2]: https://github.com/haraka/haraka-plugin-elasticsearch/releases/tag/v8.0.2
[8.0.3]: https://github.com/haraka/haraka-plugin-elasticsearch/releases/tag/v8.0.3
[8.0.4]: https://github.com/haraka/haraka-plugin-elasticsearch/releases/tag/v8.0.4
[8.1.0]: https://github.com/haraka/haraka-plugin-elasticsearch/releases/tag/v8.1.0
[8.1.1]: https://github.com/haraka/haraka-plugin-elasticsearch/releases/tag/v8.1.1
[8.1.2]: https://github.com/haraka/haraka-plugin-elasticsearch/releases/tag/v8.1.2
[8.1.3]: https://github.com/haraka/haraka-plugin-elasticsearch/releases/tag/v8.1.3
[8.1.4]: https://github.com/haraka/haraka-plugin-elasticsearch/releases/tag/v8.1.4
[8.1.5]: https://github.com/haraka/haraka-plugin-elasticsearch/releases/tag/v8.1.5

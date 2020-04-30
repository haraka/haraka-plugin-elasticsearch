
## 1.0.5 - 2020-04-29

- update to upstream @elastic/elasticsearch@6
- convert test runner to mocha
- use GitHub actions instead of Travis & AppVeyor
- package.json: depend on latest eslint


## 1.0.4 - 2019-09-22

- update index template for ES 6


## 1.0.3 - 2017-08-22

- fix txr variable scope
- add tests for get_es_hosts


## 1.0.2 - 2017-07-29

- also prune null values because typeof null === object
- add test storing doc against index template
- get ES testing working on AppVeyor (windows)


## 1.0.1 - 2017-07-29

- qualify the path to plugin.\*.msg to avoid collision


## 1.0.0 - 2017-07-14

- initial release

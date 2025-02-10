'use strict'

const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const fixtures = require('haraka-test-fixtures')
const utils = require('haraka-utils')

function setup(done) {
  try {
    this.plugin = new fixtures.plugin('../index')
  } catch (e) {
    console.error(`unable to load elasticsearch plugin: ${e}`)
    return done('failed to load elasticsearch')
  }

  this.connection = fixtures.connection.createConnection()
  this.plugin.config.root_path = path.resolve(__dirname, '..', '..', 'config')

  done()
}

describe('templates', function () {
  beforeEach(setup)

  it('saves component templates to ES', function (done) {
    this.timeout(8000)

    const plugin = this.plugin
    plugin.load_es_ini()

    const filePath = path.resolve('templates', 'component')
    const files = fs.readdirSync(filePath)

    plugin.es_connect((err) => {
      assert.ifError(err)

      for (const f of files) {
        if (path.extname(f) !== '.json') continue
        console.log(`\t${f}`)

        const data = fs.readFileSync(path.join(filePath, f))
        const template = JSON.parse(data).component_templates[0].component_template.template

        plugin.es.cluster.putComponentTemplate({
          name: `haraka-${f}`,
          template,
        })
        .then((result) => {
          console.log(result)
        })
        .catch((err2) => {
          console.error(err2)
        })
      }

      done()
    })
  })

  it('saves a legacy index template to Elasticsearch', function (done) {
    this.timeout(4000)

    const plugin = this.plugin
    const filePath = path.resolve('templates', 'index', 'v8.json')

    plugin.load_es_ini()

    plugin.es_connect((err) => {
      assert.ifError(err)

      if (err) return done()

      fs.readFile(filePath, 'utf8', (err2, data) => {
        if (err2) {
          console.error(err2)
          return done()
        }

        plugin.es.indices
          .putTemplate({
            name: 'haraka-results',
            index_patterns: 'smtp-*',
            mappings: JSON.parse(data),
          })
          .then((result) => {
            console.log(result)
          })
          .catch((err3) => {
            if (err3.status !== 404) {
              console.error(err3)
            }
            // other tests are running, so currently
            // stored mapping may conflict
          })
          .finally(done)
      })
    })
  })
})

describe('log_connection', function () {
  beforeEach(setup)

  it('saves results to Elasticsearch', function (done) {
    const plugin = this.plugin

    plugin.load_es_ini()
    plugin.es_connect(function (err) {
      assert.ifError(err)

      console.log('giving ES a few secs to start up')

      const connection = fixtures.connection.createConnection()
      connection.local.ip = '127.0.0.1'
      connection.remote.ip = '172.1.1.1'
      connection.uuid = utils.uuid()
      connection.count = { msg: { accepted: 1 } }
      connection.results.add({ name: 'rspamd' }, { msg: 'test' })

      // console.log(util.inspect(connection, { depth: null }));
      plugin.log_connection(function () {
        // assert.ok(1);
        done()
      }, connection)
    })
  })
})

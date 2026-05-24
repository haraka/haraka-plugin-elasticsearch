'use strict'

const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const { describe, it, beforeEach } = require('node:test')

const fixtures = require('haraka-test-fixtures')
const utils = require('haraka-utils')

function setup() {
  let plugin
  try {
    plugin = new fixtures.plugin('../index')
  } catch (e) {
    console.error(`unable to load elasticsearch plugin: ${e}`)
    throw new Error('failed to load elasticsearch')
  }

  plugin.config.root_path = path.resolve(__dirname, '..', '..', 'config')
  return { plugin }
}

describe('templates', () => {
  let plugin
  beforeEach(() => {
    ;({ plugin } = setup())
  })

  it('saves component templates to ES', { timeout: 8000 }, async () => {
    plugin.load_es_ini()

    const filePath = path.resolve('templates', 'component')
    const files = fs.readdirSync(filePath)

    await new Promise((resolve, reject) => {
      plugin.es_connect((err) => {
        if (err) return reject(err)

        for (const f of files) {
          if (path.extname(f) !== '.json') continue

          const data = fs.readFileSync(path.join(filePath, f))

          plugin.es.cluster
            .putComponentTemplate({
              name: `haraka-${f}`,
              ...JSON.parse(data),
            })
            .then((result) => {
              console.log(`${f}: ${result}`)
            })
            .catch((err2) => {
              console.error(err2)
            })
        }

        resolve()
      })
    })
  })

  // this only works AFTER all the component templates are stored
  it.skip(
    'saves a composable index template to ES',
    { timeout: 4000 },
    (t, done) => {
      const filePath = path.resolve('templates', 'index', 'composable.json')
      const template = JSON.parse(fs.readFileSync(filePath))

      plugin.load_es_ini()

      plugin.es_connect((err) => {
        assert.ifError(err)

        plugin.es.indices
          .putIndexTemplate({
            name: `haraka-results`,
            ...template,
          })
          .then((result) => {
            console.log(`${filePath}: ${result}`)
          })
          .catch((err2) => {
            console.error(err2)
          })
          .finally(done)
      })
    },
  )

  it(
    'saves a legacy index template to Elasticsearch',
    { timeout: 4000 },
    (t, done) => {
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
    },
  )
})

describe('log_connection', () => {
  let plugin
  beforeEach(() => {
    ;({ plugin } = setup())
  })

  it('saves results to Elasticsearch', { timeout: 4000 }, (t, done) => {
    plugin.load_es_ini()
    plugin.es_connect((err) => {
      assert.ifError(err)

      const connection = fixtures.connection.createConnection()
      connection.local.ip = '127.0.0.1'
      connection.remote.ip = '172.1.1.1'
      connection.uuid = utils.uuid()
      connection.count = { msg: { accepted: 1 } }
      connection.results.add({ name: 'rspamd' }, { msg: 'test' })

      // console.log(util.inspect(connection, { depth: null }));
      plugin.log_connection(() => {
        // assert.ok(1);
        done()
      }, connection)
    })
  })
})

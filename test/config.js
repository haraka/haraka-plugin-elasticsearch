const assert = require('node:assert')
const path = require('node:path')

const fixtures = require('haraka-test-fixtures')

function set_up() {
  try {
    this.plugin = new fixtures.plugin('../index')
  } catch (e) {
    console.error(`unable to load elasticsearch plugin: ${e}`)
    throw new Error('failed to load elasticsearch')
  }

  process.env.WITHOUT_CONFIG_CACHE = '1'
  this.connection = fixtures.connection.createConnection()
  this.plugin.config.root_path = path.resolve('test', 'fixtures')
}

describe('load_es_ini', function () {
  beforeEach(set_up)

  it('can load elasticsearch.ini', function () {
    this.plugin.load_es_ini()
    // console.log(this.plugin.cfg);
    assert.deepEqual(this.plugin.cfg.hosts, {
      '127.0.0.1': undefined,
      '172.16.10.1': 'https://user:password@172.16.10.1:9200',
    })
    assert.ok(this.plugin.cfg)
    assert.ok(this.plugin.cfg.index)
  })
})

describe('get_es_hosts', function () {
  beforeEach(set_up)

  it('converts bare host to hosts format', function () {
    this.plugin.cfg = { hosts: { localhost: undefined } }
    this.plugin.get_es_hosts()
    assert.deepStrictEqual('http://localhost:9200', this.plugin.cfg.es_hosts[0])
  })

  it('passes through a URL string', function () {
    this.plugin.cfg = { hosts: { '1.1.1.1': 'https://test:pass@1.1.1.1' } }
    this.plugin.get_es_hosts()
    assert.deepStrictEqual(
      'https://test:pass@1.1.1.1',
      this.plugin.cfg.es_hosts[0],
    )
  })

  it('applies auth & tls config to client config', function () {
    this.plugin.config.root_path = path.resolve('test', 'fixtures')
    this.plugin.load_es_ini()
    assert.deepEqual(this.plugin.clientArgs, {
      auth: {
        username: 'haraka',
        password: 'nice-long-pass-phrase',
      },
      nodes: [
        'https://user:password@172.16.10.1:9200',
        'http://127.0.0.1:9200',
      ],
      tls: {
        rejectUnauthorized: false,
      },
    })
  })
})

const assert = require('node:assert')
const path = require('node:path')

const { describe, it, beforeEach } = require('node:test')

const { makeConnection, makePlugin } = require('haraka-test-fixtures')

function set_up() {
  let plugin
  try {
    plugin = makePlugin('../index', { register: false })
  } catch (e) {
    console.error(`unable to load elasticsearch plugin: ${e}`)
    throw new Error('failed to load elasticsearch', { cause: e })
  }

  process.env.WITHOUT_CONFIG_CACHE = '1'
  const connection = makeConnection()
  plugin.config.root_path = path.resolve('test', 'fixtures')
  return { plugin, connection }
}

describe('load_es_ini', () => {
  let plugin
  beforeEach(() => {
    ;({ plugin } = set_up())
  })

  it('can load elasticsearch.ini', () => {
    plugin.load_es_ini()
    // console.log(plugin.cfg);
    assert.deepEqual(plugin.cfg.hosts, {
      '127.0.0.1': undefined,
      '172.16.10.1': 'https://user:password@172.16.10.1:9200',
    })
    assert.ok(plugin.cfg)
    assert.ok(plugin.cfg.index)
  })
})

describe('get_es_hosts', () => {
  let plugin
  beforeEach(() => {
    ;({ plugin } = set_up())
  })

  it('converts bare host to hosts format', () => {
    plugin.cfg = { hosts: { localhost: undefined } }
    plugin.get_es_hosts()
    assert.deepStrictEqual('http://localhost:9200', plugin.cfg.es_hosts[0])
  })

  it('passes through a URL string', () => {
    plugin.cfg = { hosts: { '1.1.1.1': 'https://test:pass@1.1.1.1' } }
    plugin.get_es_hosts()
    assert.deepStrictEqual('https://test:pass@1.1.1.1', plugin.cfg.es_hosts[0])
  })

  it('applies auth & tls config to client config', () => {
    plugin.config.root_path = path.resolve('test', 'fixtures')
    plugin.load_es_ini()
    assert.deepEqual(plugin.clientArgs, {
      maxRetries: 5,
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

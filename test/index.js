'use strict'

const assert = require('node:assert')
const path = require('node:path')

const { describe, it, beforeEach } = require('node:test')

const fixtures = require('haraka-test-fixtures')

function setup() {
  let plugin
  try {
    plugin = new fixtures.plugin('../index')
    // plugin.config = plugin.config.module_config(path.resolve('test'))
  } catch (e) {
    console.error(`unable to load elasticsearch plugin: ${e}`)
    throw new Error('failed to load elasticsearch')
  }

  const connection = fixtures.connection.createConnection()
  plugin.config.root_path = path.resolve(__dirname, '..', '..', 'config')
  return { plugin, connection }
}

describe('register', () => {
  let plugin
  beforeEach(() => {
    ;({ plugin } = setup())
  })

  it('has a register function', () => {
    assert.ok(plugin)
    assert.equal('function', typeof plugin.register)
  })

  it('can run register function', () => {
    // this tests requires a living ES server
    plugin.register()
    // hasn't thrown an exception, success!
    assert.ok(1)
  })
})

describe('objToArray', () => {
  let plugin
  beforeEach(() => {
    plugin = new fixtures.plugin('../index')
  })

  it('converts an object to an array of key vals', () => {
    assert.deepEqual(
      [{ k: 'foo', v: 'bar' }],
      plugin.objToArray({ foo: 'bar' }),
    )
    assert.deepEqual(
      [
        { k: 'foo', v: 'bar' },
        { k: 'baz', v: 'wuz' },
      ],
      plugin.objToArray({ foo: 'bar', baz: 'wuz' }),
    )
  })
})

describe('getIndexName', () => {
  let plugin
  beforeEach(() => {
    plugin = new fixtures.plugin('../index')
  })

  it('gets index name for cxn or txn', () => {
    plugin.cfg = { index: {} }
    assert.ok(/smtp-connection-/.test(plugin.getIndexName('connection')))
    assert.ok(/smtp-transaction-/.test(plugin.getIndexName('transaction')))

    plugin.cfg.index.connection = 'cxn'
    plugin.cfg.index.transaction = 'txn'
    assert.ok(/cxn-/.test(plugin.getIndexName('connection')))
    assert.ok(/txn-/.test(plugin.getIndexName('transaction')))
  })
})

describe('populate_conn_properties', () => {
  let plugin, connection
  beforeEach(() => {
    ;({ plugin, connection } = setup())
  })

  it('adds conn.local', () => {
    connection.local.ip = '127.0.0.3'
    connection.local.port = '25'
    const result = {}
    const expected = { ip: '127.0.0.3', port: '25' }
    plugin.load_es_ini()
    plugin.populate_conn_properties(connection, result)
    delete result.local.host
    assert.deepEqual(expected, result.local)
  })

  it('adds conn.remote', () => {
    connection.remote.ip = '127.0.0.4'
    connection.remote.port = '2525'
    const result = {}
    const expected = { ip: '127.0.0.4', port: '2525' }
    plugin.load_es_ini()
    plugin.populate_conn_properties(connection, result)
    delete result.remote.host
    assert.deepEqual(expected, result.remote)
  })

  it('adds conn.helo', () => {
    connection.hello.host = 'testimerson'
    connection.hello.verb = 'EHLO'
    const result = {}
    const expected = { host: 'testimerson', verb: 'EHLO' }
    plugin.load_es_ini()
    plugin.populate_conn_properties(connection, result)
    delete result.remote.host
    assert.deepEqual(expected, result.hello)
  })

  it('adds conn.count', () => {
    connection.errors = 1
    connection.tran_count = 2
    connection.msg_count = { accept: 0 }
    connection.rcpt_count = { reject: 1 }
    const result = {}
    const expected = {
      errors: 1,
      trans: 2,
      msg: { accept: 0 },
      rcpt: { reject: 1 },
    }
    plugin.load_es_ini()
    plugin.populate_conn_properties(connection, result)
    delete result.remote.host
    assert.deepEqual(expected, result.count)
  })
})

describe('get_plugin_results', () => {
  let plugin, connection
  beforeEach(() => {
    ;({ plugin, connection } = setup())
  })

  it('adds plugin results to results object', () => {
    plugin.load_es_ini()
    connection.start_time = Date.now() - 1000
    connection.remote = { ip: '127.0.0.3', host: 'localmail' }
    connection.results.add(plugin, { pass: 'test' })
    connection.results.add({ name: 'queue' }, { pass: 'delivered' })
    const expected_result = {
      '../index': { pass: ['test'] },
      queue: { pass: ['delivered'] },
    }
    delete plugin.cfg.top_level_names
    const result = plugin.get_plugin_results(connection)
    assert.deepEqual(expected_result, result)
  })
})

describe('trim_plugin_name', () => {
  let plugin
  beforeEach(() => {
    plugin = new fixtures.plugin('../index')
  })

  const testObj = {
    'data.headers': {},
    'connect.geoip': {},
    'connect.asn': {},
    'helo.checks': {},
    'rcpt_to.qmail_deliverable': {},
    'mail_from.is_resolvable': {},
  }

  it(`trims connection phase prefix: data`, () => {
    plugin.trim_plugin_name(testObj, 'data.headers')
    assert.deepEqual(testObj.headers, {})
  })

  it(`trims connection phase prefix: connect`, () => {
    plugin.trim_plugin_name(testObj, 'connect.geoip')
    assert.deepEqual(testObj.geoip, {})

    plugin.trim_plugin_name(testObj, 'connect.asn')
    assert.deepEqual(testObj.asn, {})
  })

  it(`trims connection phase prefix: rcpt_to`, () => {
    plugin.trim_plugin_name(testObj, 'rcpt_to.qmail_deliverable')
    assert.deepEqual(testObj.qmail_deliverable, {})
  })

  it(`trims connection phase prefix: mail_from`, () => {
    plugin.trim_plugin_name(testObj, 'mail_from.is_resolvable')
    assert.deepEqual(testObj.is_resolvable, {})
  })

  it(`trims connection phase prefix: helo`, () => {
    plugin.trim_plugin_name(testObj, 'helo.checks')
    assert.deepEqual(testObj.helo, {})
  })
})

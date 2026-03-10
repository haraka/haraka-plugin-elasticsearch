'use strict'

const assert = require('assert')
const path = require('path')

const fixtures = require('haraka-test-fixtures')

function setup() {
  try {
    this.plugin = new fixtures.plugin('../index')
  } catch (e) {
    console.error(`unable to load elasticsearch plugin: ${e}`)
    throw new Error('failed to load elasticsearch')
  }

  this.connection = fixtures.connection.createConnection()
  this.plugin.config.root_path = path.resolve(__dirname, '..', '..', 'config')
}

describe('register', function () {
  beforeEach(setup)

  it('has a register function', function () {
    assert.ok(this.plugin)
    assert.equal('function', typeof this.plugin.register)
  })

  it('can run register function', function () {
    // this tests requires a living ES server
    this.plugin.register()
    // hasn't thrown an exception, success!
    assert.ok(1)
  })
})

describe('objToArray', function () {
  beforeEach(function () {
    this.plugin = new fixtures.plugin('../index')
  })

  it('converts an object to an array of key vals', function () {
    assert.deepEqual(
      [{ k: 'foo', v: 'bar' }],
      this.plugin.objToArray({ foo: 'bar' }),
    )
    assert.deepEqual(
      [
        { k: 'foo', v: 'bar' },
        { k: 'baz', v: 'wuz' },
      ],
      this.plugin.objToArray({ foo: 'bar', baz: 'wuz' }),
    )
  })
})

describe('getIndexName', function () {
  beforeEach(function () {
    this.plugin = new fixtures.plugin('../index')
  })

  it('gets index name for cxn or txn', function () {
    this.plugin.cfg = { index: {} }
    assert.ok(/smtp-connection-/.test(this.plugin.getIndexName('connection')))
    assert.ok(/smtp-transaction-/.test(this.plugin.getIndexName('transaction')))

    this.plugin.cfg.index.connection = 'cxn'
    this.plugin.cfg.index.transaction = 'txn'
    assert.ok(/cxn-/.test(this.plugin.getIndexName('connection')))
    assert.ok(/txn-/.test(this.plugin.getIndexName('transaction')))
  })
})

describe('populate_conn_properties', function () {
  beforeEach(setup)

  it('adds conn.local', function () {
    this.connection.local.ip = '127.0.0.3'
    this.connection.local.port = '25'
    const result = {}
    const expected = { ip: '127.0.0.3', port: '25' }
    this.plugin.load_es_ini()
    this.plugin.populate_conn_properties(this.connection, result)
    delete result.local.host
    assert.deepEqual(expected, result.local)
  })

  it('adds conn.remote', function () {
    this.connection.remote.ip = '127.0.0.4'
    this.connection.remote.port = '2525'
    const result = {}
    const expected = { ip: '127.0.0.4', port: '2525' }
    this.plugin.load_es_ini()
    this.plugin.populate_conn_properties(this.connection, result)
    delete result.remote.host
    assert.deepEqual(expected, result.remote)
  })

  it('adds conn.helo', function () {
    this.connection.hello.host = 'testimerson'
    this.connection.hello.verb = 'EHLO'
    const result = {}
    const expected = { host: 'testimerson', verb: 'EHLO' }
    this.plugin.load_es_ini()
    this.plugin.populate_conn_properties(this.connection, result)
    delete result.remote.host
    assert.deepEqual(expected, result.hello)
  })

  it('adds conn.count', function () {
    this.connection.errors = 1
    this.connection.tran_count = 2
    this.connection.msg_count = { accept: 0 }
    this.connection.rcpt_count = { reject: 1 }
    const result = {}
    const expected = {
      errors: 1,
      trans: 2,
      msg: { accept: 0 },
      rcpt: { reject: 1 },
    }
    this.plugin.load_es_ini()
    this.plugin.populate_conn_properties(this.connection, result)
    delete result.remote.host
    assert.deepEqual(expected, result.count)
  })
})

describe('get_plugin_results', function () {
  beforeEach(setup)

  it('adds plugin results to results object', function () {
    this.plugin.load_es_ini()
    this.connection.start_time = Date.now() - 1000
    this.connection.remote = { ip: '127.0.0.3', host: 'localmail' }
    this.connection.results.add(this.plugin, { pass: 'test' })
    this.connection.results.add({ name: 'queue' }, { pass: 'delivered' })
    const expected_result = {
      '../index': { pass: ['test'] },
      queue: { pass: ['delivered'] },
    }
    delete this.plugin.cfg.top_level_names
    const result = this.plugin.get_plugin_results(this.connection)
    assert.deepEqual(expected_result, result)
  })
})

describe('trim_plugin_name', function () {
  beforeEach(function () {
    this.plugin = new fixtures.plugin('../index')
  })

  const testObj = {
    'data.headers': {},
    'connect.geoip': {},
    'connect.asn': {},
    'helo.checks': {},
    'rcpt_to.qmail_deliverable': {},
    'mail_from.is_resolvable': {},
  }

  it(`trims connection phase prefix: data`, function () {
    this.plugin.trim_plugin_name(testObj, 'data.headers')
    assert.deepEqual(testObj.headers, {})
  })

  it(`trims connection phase prefix: connect`, function () {
    this.plugin.trim_plugin_name(testObj, 'connect.geoip')
    assert.deepEqual(testObj.geoip, {})

    this.plugin.trim_plugin_name(testObj, 'connect.asn')
    assert.deepEqual(testObj.asn, {})
  })

  it(`trims connection phase prefix: rcpt_to`, function () {
    this.plugin.trim_plugin_name(testObj, 'rcpt_to.qmail_deliverable')
    assert.deepEqual(testObj.qmail_deliverable, {})
  })

  it(`trims connection phase prefix: mail_from`, function () {
    this.plugin.trim_plugin_name(testObj, 'mail_from.is_resolvable')
    assert.deepEqual(testObj.is_resolvable, {})
  })

  it(`trims connection phase prefix: helo`, function () {
    this.plugin.trim_plugin_name(testObj, 'helo.checks')
    assert.deepEqual(testObj.helo, {})
  })
})

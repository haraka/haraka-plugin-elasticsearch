'use strict';

const assert   = require('assert')
const fs       = require('fs')
const path     = require('path')

const fixtures = require('haraka-test-fixtures')
const utils    = require('haraka-utils')

function setup (done) {

    try {
        this.plugin = new fixtures.plugin('../index');
    }
    catch (e) {
        console.error(`unable to load elasticsearch plugin: ${e}`);
        return done('failed to load elasticsearch');
    }

    this.connection = fixtures.connection.createConnection();
    this.plugin.config.root_path = path.resolve(__dirname, '..', '..', 'config');

    done()
}

describe('register', function () {

    beforeEach(setup)

    it('has a register function', function (done) {
        assert.ok(this.plugin);
        assert.equal('function', typeof this.plugin.register);
        done()
    })

    it('can run register function', function (done) {
        // this tests requires a living ES server
        this.plugin.register();
        // hasn't thrown an exception, success!
        assert.ok(1);
        done()
    })
})

describe('objToArray', function () {
    beforeEach(function (done) {
        this.plugin = new fixtures.plugin('../index');
        done()
    })

    it('converts an object to an array of key vals', function (done) {
        assert.deepEqual([{k: 'foo', v: 'bar'}],
            this.plugin.objToArray({ foo: 'bar' }));
        assert.deepEqual([{k: 'foo', v: 'bar'}, {k: 'baz', v: 'wuz'}],
            this.plugin.objToArray({ foo: 'bar', baz: 'wuz' }));
        done()
    })
})

describe('getIndexName', function () {
    beforeEach(function (done) {
        this.plugin = new fixtures.plugin('../index');
        done()
    })

    it('gets index name for cxn or txn', function (done) {
        this.plugin.cfg = { index: {} };
        assert.ok( /smtp-connection-/.test(this.plugin.getIndexName('connection')));
        assert.ok( /smtp-transaction-/.test(this.plugin.getIndexName('transaction')));

        this.plugin.cfg.index.connection = 'cxn';
        this.plugin.cfg.index.transaction = 'txn';
        assert.ok( /cxn-/.test(this.plugin.getIndexName('connection')));
        assert.ok( /txn-/.test(this.plugin.getIndexName('transaction')));
        done()
    })
})

describe('populate_conn_properties', function () {
    beforeEach(setup)

    it('adds conn.local', function (done) {
        this.connection.local.ip= '127.0.0.3';
        this.connection.local.port= '25';
        const result = {};
        const expected = { ip: '127.0.0.3', port: '25' };
        this.plugin.load_es_ini();
        this.plugin.populate_conn_properties(this.connection, result);
        delete result.local.host;
        assert.deepEqual(expected, result.local);
        done()
    })

    it('adds conn.remote', function (done) {
        this.connection.remote.ip='127.0.0.4';
        this.connection.remote.port='2525';
        const result = {};
        const expected = { ip: '127.0.0.4', port: '2525' };
        this.plugin.load_es_ini();
        this.plugin.populate_conn_properties(this.connection, result);
        delete result.remote.host;
        assert.deepEqual(expected, result.remote);
        done()
    })

    it('adds conn.helo', function (done) {
        this.connection.hello.host='testimerson';
        this.connection.hello.verb='EHLO';
        const result = {};
        const expected = { host: 'testimerson', verb: 'EHLO' };
        this.plugin.load_es_ini();
        this.plugin.populate_conn_properties(this.connection, result);
        delete result.remote.host;
        assert.deepEqual(expected, result.hello);
        done()
    })

    it('adds conn.count', function (done) {
        this.connection.errors=1;
        this.connection.tran_count=2;
        this.connection.msg_count= { accept: 0 };
        this.connection.rcpt_count= { reject: 1 };
        const result = {};
        const expected = {errors: 1, trans: 2,
            msg: { accept: 0 }, rcpt: { reject: 1 }
        };
        this.plugin.load_es_ini();
        this.plugin.populate_conn_properties(this.connection, result);
        delete result.remote.host;
        assert.deepEqual(expected, result.count);
        done()
    })
})

describe('get_plugin_results', function () {
    beforeEach(setup)

    it('adds plugin results to results object', function (done) {
        this.plugin.load_es_ini();
        this.connection.start_time = Date.now() - 1000;
        this.connection.results.add(this.plugin, { pass: 'test' });
        this.connection.results.add({name: 'queue'}, { pass: 'delivered' });
        const expected_result = {
            '../index': { pass: [ 'test' ] },
            'queue': { pass: [ 'delivered' ] },
        };
        delete this.plugin.cfg.top_level_names;
        const result = this.plugin.get_plugin_results(this.connection);
        assert.deepEqual(expected_result, result);
        done()
    })
})

describe('trim_plugin_name', function () {
    beforeEach(function (done) {
        this.plugin = new fixtures.plugin('../index');
        done()
    })

    const testObj = {
        'data.headers': {},
        'connect.geoip': {},
        'connect.asn': {},
        'helo.checks': {},
        'rcpt_to.qmail_deliverable': {},
        'mail_from.is_resolvable': {},
    };

    it(`trims connection phase prefix: data`, function (done) {
        this.plugin.trim_plugin_name(testObj, 'data.headers');
        assert.deepEqual(testObj.headers, {});
        done()
    })

    it(`trims connection phase prefix: connect`, function (done) {
        this.plugin.trim_plugin_name(testObj, 'connect.geoip');
        assert.deepEqual(testObj.geoip, {});

        this.plugin.trim_plugin_name(testObj, 'connect.asn');
        assert.deepEqual(testObj.asn, {});
        done()
    })

    it(`trims connection phase prefix: rcpt_to`, function (done) {
        this.plugin.trim_plugin_name(testObj, 'rcpt_to.qmail_deliverable');
        assert.deepEqual(testObj.qmail_deliverable, {});
        done()
    })

    it(`trims connection phase prefix: mail_from`, function (done) {
        this.plugin.trim_plugin_name(testObj, 'mail_from.is_resolvable');
        assert.deepEqual(testObj.is_resolvable, {});
        done()
    })

    it(`trims connection phase prefix: helo`, function (done) {
        this.plugin.trim_plugin_name(testObj, 'helo.checks');
        assert.deepEqual(testObj.helo, {});
        done()
    })
})

describe('storesIndexMapTemplate', function () {
    beforeEach(setup)

    it('saves an index map template to Elasticsearch', function (done) {

        const plugin = this.plugin;
        const filePath = path.resolve('index-map-template.json');
        let indexMap;

        plugin.load_es_ini();

        plugin.es_connect((err) => {
            assert.ifError(err);

            if (err) {
                done()
                return;
            }

            fs.readFile(filePath, (err2, data) => {
                if (err2) {
                    console.error(err2);
                    done()
                }

                indexMap = JSON.parse(data);

                plugin.es.indices.putTemplate({
                    name: 'smtp-*',
                    body: JSON.stringify(indexMap),
                },
                function (err3, result) {
                    if (err3) {
                        if (err3.status !== 404) {
                            console.error(err3);
                        }
                        // other tests are running, so currently
                        // stored mapping may conflict
                        done()
                        return;
                    }
                    console.log(result);
                    done()
                })
            })
        })
    })
})

describe('log_connection', function () {
    beforeEach(setup)

    it('saves results to Elasticsearch', function (done) {

        const plugin = this.plugin;

        plugin.load_es_ini();
        plugin.es_connect(function (err) {
            assert.ifError(err);

            console.log('giving ES a few secs to start up');

            const connection = fixtures.connection.createConnection();
            connection.local.ip = '127.0.0.1';
            connection.remote.ip = '172.1.1.1';
            connection.uuid = utils.uuid();
            connection.count = { msg: { accepted: 1 } };
            connection.results.add({name: 'rspamd'}, { msg: 'test' });

            // console.log(util.inspect(connection, { depth: null }));
            plugin.log_connection(function () {
                // assert.ok(1);
                done()
            },
            connection);
        })
    })
})

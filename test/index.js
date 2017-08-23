'use strict';

const fs       = require('fs');
const path     = require('path');
const util     = require('util');

const fixtures = require('haraka-test-fixtures');
const utils    = require('haraka-utils');

function _set_up (done) {

    try {
        this.plugin = new fixtures.plugin('../index');
    }
    catch (e) {
        console.error('unable to load elasticsearch plugin');
        return done('failed to load elasticsearch');
    }

    this.connection = fixtures.connection.createConnection();
    this.plugin.config.root_path = path.resolve(__dirname, '..', '..', 'config');

    done();
}

exports.register = {
    setUp : _set_up,
    'has a register function' : function (test) {
        test.expect(2);
        test.ok(this.plugin);
        test.equal('function', typeof this.plugin.register);
        test.done();
    },
    'can run register function' : function (test) {
        // this tests requires a living ES server
        test.expect(1);
        this.plugin.register();
        // hasn't thrown an exception, success!
        test.ok(1);
        test.done();
    },
};

exports.objToArray = {
    setUp : _set_up,
    'converts an object to an array of key vals' : function (test) {
        test.expect(2);
        test.deepEqual([{k: 'foo', v: 'bar'}],
            this.plugin.objToArray({ foo: 'bar' }));
        test.deepEqual([{k: 'foo', v: 'bar'}, {k: 'baz', v: 'wuz'}],
            this.plugin.objToArray({ foo: 'bar', baz: 'wuz' }));
        test.done();
    },
};

exports.getIndexName = {
    setUp : _set_up,
    'gets index name for cxn or txn' : function (test) {
        test.expect(4);
        this.plugin.cfg = { index: {} };
        test.ok( /smtp-connection-/.test(this.plugin.getIndexName('connection')));
        test.ok( /smtp-transaction-/.test(this.plugin.getIndexName('transaction')));

        this.plugin.cfg.index.connection = 'cxn';
        this.plugin.cfg.index.transaction = 'txn';
        test.ok( /cxn-/.test(this.plugin.getIndexName('connection')));
        test.ok( /txn-/.test(this.plugin.getIndexName('transaction')));
        test.done();
    }
};

exports.populate_conn_properties = {
    setUp : _set_up,
    'adds conn.local' : function (test) {
        test.expect(1);
        this.connection.local.ip= '127.0.0.3';
        this.connection.local.port= '25';
        var result = {};
        var expected = { ip: '127.0.0.3', port: '25' };
        this.plugin.load_es_ini();
        this.plugin.populate_conn_properties(this.connection, result);
        delete result.local.host;
        test.deepEqual(expected, result.local);
        test.done();
    },
    'adds conn.remote' : function (test) {
        test.expect(1);
        this.connection.remote.ip='127.0.0.4';
        this.connection.remote.port='2525';
        var result = {};
        var expected = { ip: '127.0.0.4', port: '2525' };
        this.plugin.load_es_ini();
        this.plugin.populate_conn_properties(this.connection, result);
        delete result.remote.host;
        test.deepEqual(expected, result.remote);
        test.done();
    },
    'adds conn.helo' : function (test) {
        test.expect(1);
        this.connection.hello.host='testimerson';
        this.connection.hello.verb='EHLO';
        var result = {};
        var expected = { host: 'testimerson', verb: 'EHLO' };
        this.plugin.load_es_ini();
        this.plugin.populate_conn_properties(this.connection, result);
        delete result.remote.host;
        test.deepEqual(expected, result.hello);
        test.done();
    },
    'adds conn.count' : function (test) {
        test.expect(1);
        this.connection.errors=1;
        this.connection.tran_count=2;
        this.connection.msg_count= { accept: 0 };
        this.connection.rcpt_count= { reject: 1 };
        var result = {};
        var expected = {errors: 1, trans: 2,
            msg: { accept: 0 }, rcpt: { reject: 1 }
        };
        this.plugin.load_es_ini();
        this.plugin.populate_conn_properties(this.connection, result);
        delete result.remote.host;
        test.deepEqual(expected, result.count);
        test.done();
    },
};

exports.get_plugin_results = {
    setUp : _set_up,
    'adds plugin results to results object' : function (test) {
        test.expect(1);
        this.plugin.load_es_ini();
        this.connection.start_time = Date.now() - 1000;
        this.connection.results.add(this.plugin, { pass: 'test' });
        this.connection.results.add({name: 'queue'}, { pass: 'delivered' });
        var expected_result = {
            '../index': { pass: [ 'test' ] },
            'queue': { pass: [ 'delivered' ] },
        };
        delete this.plugin.cfg.top_level_names;
        var result = this.plugin.get_plugin_results(this.connection);
        test.deepEqual(expected_result, result);
        test.done();
    },
};

exports.trimPluginName = {
    setUp : _set_up,
    'trims off connection phase prefixes' : function (test) {
        test.expect(6);
        test.equal('headers', this.plugin.trimPluginName('data.headers'));
        test.equal('geoip', this.plugin.trimPluginName('connect.geoip'));
        test.equal('asn', this.plugin.trimPluginName('connect.asn'));
        test.equal('helo', this.plugin.trimPluginName('helo.checks'));
        test.equal('qmail_deliverable',
            this.plugin.trimPluginName('rcpt_to.qmail_deliverable'));
        test.equal('is_resolvable',
            this.plugin.trimPluginName('mail_from.is_resolvable'));
        test.done();
    },
};

exports.storesIndexMapTemplate = {
    setUp : _set_up,
    'saves an index map template to Elasticsearch' : function (test) {

        let plugin = this.plugin;
        let filePath = path.resolve('index-map-template.json');
        let indexMap;

        plugin.load_es_ini();

        plugin.es_connect(function (err) {
            test.ifError(err);

            if (err) {
                test.done();
                return;
            }

            fs.readFile(filePath, function (err2, data) {
                if (err2) {
                    console.error(err2);
                    test.done();
                }

                indexMap = JSON.parse(data);

                plugin.es.indices.putTemplate({
                    name: indexMap.template,
                    body: JSON.stringify(indexMap),
                },
                function (err3, result) {
                    if (err3) {
                        if (err3.status !== 404) {
                            console.error(err3);
                        }
                        // other tests are running, so currently
                        // stored mapping may conflict
                        test.done();
                        return;
                    }
                    console.log(result);
                    test.done();
                })
            })
        })
    }
}

exports.log_connection = {
    setUp : _set_up,
    'saves results to Elasticsearch' : function (test) {

        let plugin = this.plugin;

        plugin.load_es_ini();
        plugin.es_connect(function (err) {
            test.ifError(err);

            console.log('giving ES a few secs to start up');

            let connection = fixtures.connection.createConnection();
            connection.local.ip = '127.0.0.1';
            connection.remote.ip = '172.1.1.1';
            connection.uuid = utils.uuid();
            connection.count = { msg: { accepted: 1 } };
            connection.results.add({name: 'rspamd'}, { msg: 'test' });

            // console.log(util.inspect(connection, { depth: null }));
            plugin.log_connection(function () {
                test.expect(1);
                // test.ok(1);
                test.done();
            },
            connection);
        })
    }
}

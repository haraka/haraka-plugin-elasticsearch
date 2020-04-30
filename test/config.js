
const assert   = require('assert')
const path     = require('path')

const fixtures = require('haraka-test-fixtures');

function set_up (done) {
    try {
        this.plugin = new fixtures.plugin('../index');
    }
    catch (e) {
        console.error(`unable to load elasticsearch plugin: ${e}`);
        return done('failed to load elasticsearch');
    }

    this.connection = fixtures.connection.createConnection();
    this.plugin.config.root_path = path.resolve(__dirname, '..', '..', 'config');

    done();
}

describe('load_es_ini', function () {
    beforeEach(set_up)

    it('can load elasticsearch.ini', function (done) {
        this.plugin.load_es_ini();
        // console.log(this.plugin.cfg);
        assert.deepEqual(this.plugin.cfg.hosts, { '127.0.0.1': undefined });
        assert.ok(this.plugin.cfg);
        assert.ok(this.plugin.cfg.index);
        done();
    })
})

describe('get_es_hosts', function () {
    beforeEach(set_up)

    it('converts bare host to hosts format', function (done) {
        this.plugin.cfg = { hosts: { 'localhost': undefined } };
        this.plugin.get_es_hosts();
        assert.deepEqual(["http://localhost:9200"], this.plugin.cfg.es_hosts);
        done();
    })
})

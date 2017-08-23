
const path     = require('path');

const fixtures = require('haraka-test-fixtures');

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

exports.load_es_ini = {
    setUp : _set_up,
    'can load elasticsearch.ini' : function (test) {
        test.expect(3);
        this.plugin.load_es_ini();
        // console.log(this.plugin.cfg);
        test.deepEqual(this.plugin.cfg.hosts, { '127.0.0.1': undefined });
        test.ok(this.plugin.cfg);
        test.ok(this.plugin.cfg.index);
        test.done();
    },
};

exports.get_es_hosts = {
    setUp : _set_up,
    'converts bare host to hosts format': function (test) {
        test.expect(1);
        this.plugin.cfg = { hosts: { 'localhost': undefined } };
        this.plugin.get_es_hosts();
        test.deepEqual([{host: 'localhost'}], this.plugin.cfg.es_hosts);
        test.done();
    },
    'converts host:$options to hosts format': function (test) {
        test.expect(1);
        this.plugin.cfg = { hosts: {
            'localhost': 'port:9200,protocol:https',
            '172.16.15.27': 'protocol:https'
        }};
        let expected = [
            { host: 'localhost', port: '9200', protocol: 'https' },
            { host: '172.16.15.27', protocol: 'https' }
        ];
        this.plugin.get_es_hosts();
        test.deepEqual(expected, this.plugin.cfg.es_hosts);
        test.done();
    }
}

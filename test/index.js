
// node.js built-in modules
var assert   = require('assert');

// npm modules
var fixtures = require('haraka-test-fixtures');

// start of tests
//    assert: https://nodejs.org/api/assert.html
//    mocha: http://mochajs.org

beforeEach(function (done) {
    this.plugin = new fixtures.plugin('haraka-plugin-elasticsearch');
    done();  // if a test hangs, assure you called done()
});

describe('haraka-plugin-elasticsearch', function () {
    it('loads', function (done) {
        assert.ok(this.plugin);
        done();
    });
});

describe('load_elasticsearch_ini', function () {
    it('loads elasticsearch.ini from config/elasticsearch.ini', function (done) {
        this.plugin.load_elasticsearch_ini();
        assert.ok(this.plugin.cfg);
        done();
    });

    it('initializes enabled boolean', function (done) {
        this.plugin.load_elasticsearch_ini();
        assert.equal(this.plugin.cfg.main.enabled, true, this.plugin.cfg);
        done();
    });
});

'use strict';
// log to Elasticsearch

const util          = require('util');
const utils         = require('haraka-utils');
const Elasticsearch = require('@elastic/elasticsearch');

exports.register = function () {

    this.load_es_ini();

    this.es_connect(err => {
        if (err) return;
        this.register_hook('reset_transaction', 'log_transaction');
        this.register_hook('disconnect',        'log_connection');
    })
}

exports.load_es_ini = function () {

    this.cfg = this.config.get('elasticsearch.ini', {
        booleans: [
            '+main.log_connections',
        ]
    },
    function () {
        this.load_es_ini();
    })

    this.get_es_hosts();

    if (this.cfg.ignore_hosts) {
        // convert bare entries (w/undef values) to true
        Object.keys(this.cfg.ignore_hosts).forEach(key => {
            if (this.cfg.ignore_hosts[key]) return;
            this.cfg.ignore_hosts[key]=true;
        });
    }

    this.cfg.headers = this.cfg.headers ? Object.keys(this.cfg.headers) : ['From', 'To', 'Subject'];

    this.cfg.conn_props = this.cfg.connection_properties ||
        {   relaying:undefined,
            totalbytes:undefined,
            pipelining:undefined,
            early_talker:undefined,
        };
}

exports.get_es_hosts = function () {
    const plugin = this;
    plugin.cfg.es_hosts = []; // default: http://localhost:9200

    if (!plugin.cfg.hosts) return;   // no [hosts] config

    Object.keys(plugin.cfg.hosts).forEach(host => {
        if (!plugin.cfg.hosts[host]) {  // no options
            plugin.cfg.es_hosts.push(`http://${host}:9200`);
            return;
        }

        const opts = { host };
        plugin.cfg.hosts[host].trim().split(',').forEach(opt => {
            const o=opt.trim().split(':');
            opts[o[0]] = o[1];
        });

        plugin.cfg.es_hosts.push(opts);
    });
}

exports.es_connect = function (done) {
    const plugin = this;

    plugin.es = new Elasticsearch.Client({
        nodes: plugin.cfg.es_hosts,
    });

    plugin.es.ping({}, function (error) {
        if (error) {
            plugin.logerror('cluster is down!');
            plugin.logerror(util.inspect(error, {depth: null}));
        }
        else {
            plugin.lognotice('connected');
        }
        if (done) done(error);
    });
}

exports.log_transaction = function (next, connection) {
    const plugin = this;

    if (plugin.cfg.ignore_hosts) {
        if (plugin.cfg.ignore_hosts[connection.remote_host]) return next();
    }

    const res = plugin.get_plugin_results(connection);
    if (plugin.cfg.top_level_names && plugin.cfg.top_level_names.message) {
        res[plugin.cfg.top_level_names.message] = res.message;
        delete res.message;
    }
    res.timestamp = new Date().toISOString();

    plugin.populate_conn_properties(connection, res);
    plugin.es.create({
        index: plugin.getIndexName('transaction'),
        type: 'haraka',
        id: connection.transaction.uuid,
        body: JSON.stringify(res),
    }, function (error, response) {
        if (error) {
            connection.logerror(plugin, error.message);
        }
        // connection.loginfo(plugin, response);
    });

    // hook reset_transaction doesn't seem to wait for next(). If I
    // wait until after I get a response back from ES, Haraka throws
    // "Error: We are already running hooks!". So, record that we've sent
    // to ES (so connection isn't saved) and hope for the best.
    connection.notes.elasticsearch=connection.tran_count;
    next();
}

exports.log_connection = function (next, connection) {
    const plugin = this;
    if (!plugin.cfg.main.log_connections) return next();

    if (plugin.cfg.ignore_hosts) {
        if (plugin.cfg.ignore_hosts[connection.remote_host]) return next();
    }

    if (connection.notes.elasticsearch &&
        connection.notes.elasticsearch === connection.tran_count) {
        connection.logdebug(plugin, 'skipping already logged txn');
        return next();
    }

    const res = plugin.get_plugin_results(connection);
    res.timestamp = new Date().toISOString();

    plugin.populate_conn_properties(connection, res);

    // connection.lognotice(plugin, JSON.stringify(res));
    plugin.es.create({
        index: plugin.getIndexName('connection'),
        type: 'haraka',
        id: connection.uuid,
        body: JSON.stringify(res),
    }, function (error, response) {
        if (error) {
            connection.logerror(plugin, error.message);
        }
        // connection.loginfo(plugin, response);
    });
    next();
}

exports.objToArray = function (obj) {
    const arr = [];
    if (!obj || typeof obj !== 'object') return arr;
    Object.keys(obj).forEach(k => {
        arr.push({ k, v: obj[k] });
    });
    return arr;
}

exports.getIndexName = function (section) {
    const plugin = this;

    // Elasticsearch indexes named like: smtp-connection-2017-05-05
    //                                   smtp-transaction-2017-05-05
    let name = `smtp-${section}`;
    if (plugin.cfg.index && plugin.cfg.index[section]) {
        name = plugin.cfg.index[section];
    }
    const date = new Date();
    const d = date.getUTCDate().toString().padStart(2, '0');
    const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    return `${name}-${date.getUTCFullYear()}-${m}-${d}`;
}

exports.populate_conn_properties = function (conn, res) {
    const plugin = this;
    let conn_res = res;

    if (plugin.cfg.top_level_names && plugin.cfg.top_level_names.connection) {
        if (!res[plugin.cfg.top_level_names.connection]) {
            res[plugin.cfg.top_level_names.connection] = {};
        }
        conn_res = res[plugin.cfg.top_level_names.connection];
    }

    conn_res.local = {
        ip:   conn.local.ip,
        port: conn.local.port,
        host: plugin.cfg.hostname || require('os').hostname(),
    };
    conn_res.remote = {
        ip:   conn.remote.ip,
        host: conn.remote.host,
        port: conn.remote.port,
    };
    conn_res.hello = {
        host: conn.hello.host,
        verb: conn.hello.verb,
    };
    conn_res.tls = {
        enabled: conn.tls.enabled,
    };

    if (!conn_res.auth) {
        conn_res.auth = {};
        if (plugin.cfg.top_level_names && plugin.cfg.top_level_names.plugin) {
            const pia = plugin.cfg.top_level_names.plugin;
            if (res[pia] && res[pia].auth) {
                conn_res.auth = res[pia].auth;
                delete res[pia].auth;
            }
        }
        else {
            if (res.auth) {
                conn_res.auth = res.auth;
                delete res.auth;
            }
        }
    }

    conn_res.count = {
        errors: conn.errors,
        msg: conn.msg_count,
        rcpt: conn.rcpt_count,
        trans: conn.tran_count,
    };

    Object.keys(plugin.cfg.conn_props).forEach(f => {
        if (conn[f] === undefined) return;
        if (conn[f] === 0) return;
        if (plugin.cfg.conn_props[f]) {  // alias specified
            conn_res[plugin.cfg.conn_props[f]] = conn[f];
        }
        else {
            conn_res[f] = conn[f];
        }
    });

    conn_res.duration = (Date.now() - conn.start_time)/1000;
}

exports.get_plugin_results = function (connection) {
    const plugin = this;

    let name;
    // note that we make a copy of the result store, so subsequent changes
    // here don't alter the original (by reference)
    const pir = JSON.parse(JSON.stringify(connection.results.get_all()));
    for (name in pir) { plugin.trim_plugin_names(pir, name); }
    for (name in pir) {
        plugin.prune_noisy(pir, name);
        plugin.prune_empty(pir[name]);
        plugin.prune_zero(pir, name);
        plugin.prune_redundant_cxn(pir, name);
    }

    if (!connection.transaction) return plugin.nest_plugin_results(pir);

    let txr;
    try {
        txr = JSON.parse(JSON.stringify(connection.transaction.results.get_all()));
    }
    catch (e) {
        connection.transaction.results.add(plugin, {err: e.message });
        return plugin.nest_plugin_results(pir);
    }

    for (name in txr) { plugin.trim_plugin_names(txr, name); }
    for (name in txr) {
        plugin.prune_noisy(txr, name);
        plugin.prune_empty(txr[name]);
        plugin.prune_zero(txr, name);
        plugin.prune_redundant_txn(txr, name);
    }

    // merge transaction results into connection results
    for (name in txr) {
        if (!pir[name]) {
            pir[name] = txr[name];
        }
        else {
            utils.extend(pir[name], txr[name]);
        }
        delete txr[name];
    }

    plugin.populate_message(pir, connection);
    return plugin.nest_plugin_results(pir);
}

exports.populate_message = function (pir, connection) {
    const plugin = this;
    pir.message = {
        bytes: connection.transaction.data_bytes,
        envelope: {
            sender: '',
            recipient: [],
        },
        header: {},
        body: {
            attachment: [],
        },
        queue: {},
    };

    if (pir.mail_from && pir.mail_from.address) {
        pir.message.envelope.sender = pir.mail_from.address.toLowerCase();
        delete pir.mail_from.address;
    }

    if (pir.rcpt_to && pir.rcpt_to.recipient) {
        for (const key in pir.rcpt_to.recipient) {
            pir.rcpt_to.recipient[key].address=pir.rcpt_to.recipient[key].address.toLowerCase();
        }
        pir.message.envelope.recipient = pir.rcpt_to.recipient;
        delete pir.rcpt_to;
    }

    if (pir.attachment && pir.attachment.attach) {
        pir.message.body.attachment = pir.attachment.attach;
        delete pir.attachment;
    }
    if (pir.queue) {
        pir.message.queue = pir.queue;
        delete pir.queue;
    }

    plugin.cfg.headers.forEach(function (h) {
        const r = connection.transaction.header.get_decoded(h);
        if (!r) return;
        pir.message.header[h] = r;
    });
}

exports.nest_plugin_results = function (res) {
    const plugin = this;
    if (!plugin.cfg.top_level_names) return res;
    if (!plugin.cfg.top_level_names.plugin) return res;

    const new_res = {};
    if (res.message) {
        new_res.message = res.message;
        delete res.message;
    }
    new_res[plugin.cfg.top_level_names.plugin] = res;
    return new_res;
}

exports.trimPluginName = function (name) {

    // for plugins named like: data.headers or connect.geoip, strip off the
    // phase prefix and return `headers` or `geoip`
    const parts = name.split('.');
    if (parts.length < 2) return name;

    switch (parts[0]) {
        case 'helo':
            return 'helo';
        case 'connect':
        case 'mail_from':
        case 'rcpt_to':
        case 'data':
            return parts.slice(1).join('.');
    }
    return name;
}

exports.trim_plugin_names = function (res, name) {
    const trimmed = this.trimPluginName(name);
    if (trimmed === name) return;

    res[trimmed] = res[name];
    delete res[name];
    name = trimmed;
}

exports.prune_empty = function (pi) {

    // remove undefined keys and empty strings, arrays, or objects
    for (const e in pi) {
        const val = pi[e];
        if (val === undefined || val === null) {
            delete pi[e];
            continue;
        }

        if (typeof val === 'string') {
            if (val === '') {
                delete pi[e];
                continue;
            }
        }
        else if (Array.isArray(val)) {
            if (val.length === 0) {
                delete pi[e];
                continue;
            }
        }
        else if (typeof val === 'object') {
            if (Object.keys(val).length === 0) {
                delete pi[e];
                continue;
            }
        }
    }
}

exports.prune_noisy = function (res, pi) {
    const plugin = this;

    if (res[pi].human) { delete res[pi].human; }
    if (res[pi].human_html) { delete res[pi].human_html; }
    if (res[pi]._watch_saw) { delete res[pi]._watch_saw; }

    switch (pi) {
        case 'karma':
            delete res.karma.todo;
            delete res.karma.pass;
            delete res.karma.skip;
            break;
        case 'access':
            delete res.access.pass;
            break;
        case 'uribl':
            delete res.uribl.skip;
            delete res.uribl.pass;
            break;
        case 'dnsbl':
            delete res.dnsbl.pass;
            break;
        case 'fcrdns':
            res.fcrdns.ptr_name_to_ip =
                plugin.objToArray(res.fcrdns.ptr_name_to_ip);
            break;
        case 'geoip':
            delete res.geoip.ll;
            break;
        case 'max_unrecognized_commands':
            res.unrecognized_commands = res.max_unrecognized_commands.count;
            delete res.max_unrecognized_commands;
            break;
        case 'spamassassin':
            delete res.spamassassin.line0;
            if (res.spamassassin.headers) {
                delete res.spamassassin.headers.Tests;
                delete res.spamassassin.headers.Level;
            }
    }
}

exports.prune_zero = function (res, name) {
    for (const e in res[name]) {
        if (res[name][e] !== 0) continue;
        delete res[name][e];
    }
}

exports.prune_redundant_cxn = function (res, name) {
    switch (name) {
        case 'helo':
            if (res.helo && res.helo.helo_host) {
                delete res.helo.helo_host;
            }
            break;
        case 'p0f':
            if (res.p0f && res.p0f.query) {
                delete res.p0f.query;
            }
            break;
    }
}

exports.prune_redundant_txn = function (res, name) {
    switch (name) {
        case 'spamassassin':
            if (!res.spamassassin) break;
            delete res.spamassassin.hits;
            if (!res.spamassassin.headers) break;
            if (!res.spamassassin.headers.Flag) break;
            delete res.spamassassin.headers.Flag;
            break;
    }
}

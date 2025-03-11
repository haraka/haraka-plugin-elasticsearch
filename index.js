'use strict'
// log to Elasticsearch

const util = require('util')
const utils = require('haraka-utils')
const Elasticsearch = require('@elastic/elasticsearch')

exports.register = function () {
  this.load_es_ini()

  this.es_connect((err) => {
    if (err) return
    this.register_hook('reset_transaction', 'log_transaction')
    this.register_hook('disconnect', 'log_connection')
    this.register_hook('delivered', 'log_delivery')
    this.register_hook('deferred', 'log_delay')
    this.register_hook('bounce', 'log_bounce')
  })
}

exports.load_es_ini = function () {
  this.cfg = this.config.get(
    'elasticsearch.ini',
    {
      booleans: [
        '*.rejectUnauthorized',
        '+log.connections',
        '+log.delay',
        '+log.delivery',
        '+log.bounce',
      ],
    },
    () => {
      this.load_es_ini()
    },
  )

  this.get_es_hosts()

  if (this.cfg.ignore_hosts) {
    // convert bare entries (w/undef values) to true
    for (const h in this.cfg.ignore_hosts) {
      if (!this.cfg.ignore_hosts[h]) this.cfg.ignore_hosts[h] = true
    }
  }

  this.cfg.headers = this.cfg.headers
    ? Object.keys(this.cfg.headers)
    : ['From', 'To', 'Subject']

  this.cfg.conn_props = this.cfg.connection_properties || {
    relaying: undefined,
    totalbytes: undefined,
    pipelining: undefined,
    early_talker: undefined,
  }

  if (!this.cfg.index.timestamp) this.cfg.index.timestamp = 'timestamp'

  // Cloud ID overrides hosts
  this.clientArgs = { maxRetries: 5 }
  if (this.cfg.cloud?.id) {
    this.loginfo('Using Cloud ID')
    this.clientArgs.cloud = { id: this.cfg.cloud.id }
  } else {
    this.loginfo('Using nodes')
    this.clientArgs = { nodes: this.cfg.es_hosts }
  }
  if (Object.keys(this.cfg.auth).length > 0)
    this.clientArgs.auth = this.cfg.auth
  if (Object.keys(this.cfg.tls).length > 0) this.clientArgs.tls = this.cfg.tls

  // Handling legacy setting for log.connections
  if (this.cfg.main.log_connections == 'false') this.cfg.log.connections = false
}

exports.get_es_hosts = function () {
  this.cfg.es_hosts = [] // default: http://localhost:9200

  if (!this.cfg.hosts) return // no [hosts] config

  for (const host in this.cfg.hosts) {
    if (this.cfg.hosts[host]) {
      this.cfg.es_hosts.push(this.cfg.hosts[host])
    } else {
      this.cfg.es_hosts.push(`http://${host}:9200`)
    }
  }
}

exports.es_connect = function (done) {
  this.es = new Elasticsearch.Client(this.clientArgs)

  this.es
    .ping()
    .then(() => {
      this.lognotice('connected')
    })
    .catch((error) => {
      this.logerror('cluster is down!')
      this.logerror(util.inspect(error, { depth: null }))
    })
    .finally(() => {
      if (done) done()
    })
}

exports.log_transaction = function (next, connection) {
  if (this.cfg.ignore_hosts) {
    if (this.cfg.ignore_hosts[connection.remote.host]) return next()
  }

  const res = this.get_plugin_results(connection)
  if (this.cfg.top_level_names && this.cfg.top_level_names.message) {
    res[this.cfg.top_level_names.message] = res.message
    delete res.message
  }
  // Timestamp
  res[this.cfg.index.timestamp] = new Date().toISOString()

  this.populate_conn_properties(connection, res)
  this.es
    .create({
      index: this.getIndexName('transaction'),
      id: connection.transaction.uuid,
      document: res,
    })
    .then((response) => {
      // connection.loginfo(this, response);
    })
    .catch((error) => {
      connection.logerror(this, error.message)
    })

  // hook reset_transaction doesn't seem to wait for next(). If I
  // wait until after I get a response back from ES, Haraka throws
  // "Error: We are already running hooks!". So, record that we've sent
  // to ES (so connection isn't saved) and hope for the best.
  connection.notes.elasticsearch = connection.tran_count
  next()
}

exports.log_connection = function (next, connection) {
  if (!this.cfg.log.connections) return next()

  if (this.cfg.ignore_hosts) {
    if (this.cfg.ignore_hosts[connection.remote.host]) return next()
  }

  if (
    connection.notes.elasticsearch &&
    connection.notes.elasticsearch === connection.tran_count
  ) {
    connection.logdebug(this, 'skipping already logged txn')
    return next()
  }

  const res = this.get_plugin_results(connection)
  // Timestamp
  res[this.cfg.index.timestamp] = new Date().toISOString()

  this.populate_conn_properties(connection, res)

  // connection.lognotice(this, JSON.stringify(res));
  this.es
    .create({
      index: this.getIndexName('connection'),
      id: connection.uuid,
      document: res,
    })
    .then((response) => {
      // connection.loginfo(this, response);
    })
    .catch((error) => {
      connection.logerror(this, error.message)
    })

  next()
}

// Hook for logging delivered messages
exports.log_delivery = function (next, hmail, params) {
  if (!this.cfg.main?.log_delivery) next() // main.log_delivery = false
  const doc = this.populate_from_hmail(hmail)
  const [host, ip, response, delay, port, mode, ok_recips, secured] = params
  if (!doc.remote) doc.remote = {}
  doc.remote.host = host
  ;(doc.remote.ip = ip), (doc.remote.port = port)

  if (!doc.outbound) doc.outbound = {}
  doc.outbound.response = response
  doc.outbound.delay = delay
  doc.outbound.secured = secured
  doc.outbound.result = 'Delivered'
  // Timestamp
  doc[this.cfg.index.timestamp] = new Date().toISOString()

  this.es
    .create({
      index: this.getIndexName('transaction'),
      id: utils.uuid(),
      document: doc,
    })
    .then((response) => {
      // connection.loginfo(this, response);
    })
    .catch((error) => {
      this.logerror(this, error.message)
    })

  next()
}

// Hook for logging a delayed message
exports.log_delay = function (next, hmail, errorObj) {
  if (!this.cfg.main?.log_delay) next()

  const doc = this.populate_from_hmail(hmail)
  if (!doc.outbound) doc.outbound = {}
  doc.outbound.result = 'Delayed'
  doc.outbound.response = errorObj.err
  doc.outbound.delay = errorObj.delay

  // Timestamp
  doc[this.cfg.index.timestamp] = new Date().toISOString()
  this.es
    .create({
      index: this.getIndexName('transaction'),
      id: this.generateUUID(),
      document: doc,
    })
    .then((response) => {
      // connection.loginfo(this, response);
    })
    .catch((error) => {
      this.logerror(this, error.message)
    })

  next()
}

// Hook for logging a bounced message
exports.log_bounce = function (next, hmail, errorObj) {
  if (!this.cfg.main?.log_bounce) next()

  const doc = this.populate_from_hmail(hmail)
  if (!doc.outbound) doc.outbound = {}
  doc.outbound.result = 'Bounced'
  doc.outbound.response =
    errorObj.mx + ' says: Could not deliver to ' + errorObj.bounced_rcpt

  // Timestamp
  doc[this.cfg.index.timestamp] = new Date().toISOString()
  this.es
    .create({
      index: this.getIndexName('transaction'),
      id: utils.uuid(),
      document: doc,
    })
    .then((response) => {
      // connection.loginfo(this, response);
    })
    .catch((error) => {
      this.logerror(this, error.message)
    })

  next()
}

// Extracts transaction and message info from the hmail.todo object
exports.populate_from_hmail = function (hmail) {
  // Parse the hmail.todo object
  const res = {}
  res.message = {}
  res.transaction = {
    uuid: hmail.todo.uuid,
  }
  // Handles multiple recipients
  const toArr = []
  for (const rcpt in hmail.todo.rcpt_to) {
    if (hmail.todo.rcpt_to[rcpt]) {
      toArr.push(hmail.todo.rcpt_to[rcpt].address())
    } else {
      toArr.push(rcpt.address())
    }
  }
  res.message.header = {
    To: toArr.join(', '),
    From: hmail.todo.mail_from.address(),
  }
  res.outbound = {
    domain: hmail.todo.domain,
  }

  return res
}

exports.objToArray = function (obj) {
  const arr = []
  if (!obj || typeof obj !== 'object') return arr
  for (const k in obj) {
    arr.push({ k, v: obj[k] })
  }
  return arr
}

exports.getIndexName = function (section) {
  // Elasticsearch indexes named like: smtp-connection-yyyy-mm-dd
  //                                   smtp-transaction-yyyy-mm-dd
  let name = `smtp-${section}`
  if (this.cfg.index && this.cfg.index[section]) {
    name = this.cfg.index[section]
  }

  const date = new Date()

  const d = date.getUTCDate().toString().padStart(2, '0')
  const m = (date.getUTCMonth() + 1).toString().padStart(2, '0')
  const y = date.getUTCFullYear()

  switch (this.cfg.index.interval) {
    case 'year':
      return `${name}-${y}`
    case 'month':
      return `${name}-${y}-${m}`
    case 'auto':
      return `${name}`
    default: // day
      return `${name}-${y}-${m}-${d}`
  }
}

exports.populate_conn_properties = function (conn, res) {
  let conn_res = res

  if (this.cfg.top_level_names?.connection) {
    if (!res[this.cfg.top_level_names.connection]) {
      res[this.cfg.top_level_names.connection] = {}
    }
    conn_res = res[this.cfg.top_level_names.connection]
  }
  if (conn.transaction?.uuid) {
    conn_res.transaction = {
      uuid: conn.transaction.uuid,
    }
  }

  conn_res.local = {
    ip: conn.local.ip,
    port: conn.local.port,
    host: this.cfg.hostname || require('os').hostname(),
  }
  conn_res.remote = {
    ip: conn.remote.ip,
    host: conn.remote.host,
    port: conn.remote.port,
  }
  conn_res.hello = {
    host: conn.hello.host,
    verb: conn.hello.verb,
  }
  conn_res.tls = {
    enabled: conn.tls.enabled,
  }

  if (!conn_res.auth) {
    conn_res.auth = {}
    if (this.cfg.top_level_names && this.cfg.top_level_names.plugin) {
      const pia = this.cfg.top_level_names.plugin
      if (res[pia] && res[pia].auth) {
        conn_res.auth = res[pia].auth
        delete res[pia].auth
      }
    } else {
      if (res.auth) {
        conn_res.auth = res.auth
        delete res.auth
      }
    }
  }

  conn_res.count = {
    errors: conn.errors,
    msg: conn.msg_count,
    rcpt: conn.rcpt_count,
    trans: conn.tran_count,
  }

  for (const f in this.cfg.conn_props) {
    if (conn[f] === undefined) return
    if (conn[f] === 0) return
    if (this.cfg.conn_props[f]) {
      // alias specified
      conn_res[this.cfg.conn_props[f]] = conn[f]
    } else {
      conn_res[f] = conn[f]
    }
  }

  conn_res.duration = (Date.now() - conn.start_time) / 1000
}

exports.get_plugin_results = function (connection) {
  let name

  // make a copy of the result store, so subsequent changes don't alter the original (by reference)
  const pir = JSON.parse(JSON.stringify(connection.results.get_all()))
  for (name in pir) {
    this.trim_plugin_name(pir, name)
  }
  for (name in pir) {
    this.prune_noisy(pir, name)
    this.prune_empty(pir[name])
    this.prune_zero(pir, name)
    this.prune_redundant_cxn(pir, name)
  }

  if (!connection.transaction) return this.nest_plugin_results(pir)

  let txr
  try {
    txr = JSON.parse(JSON.stringify(connection.transaction.results.get_all()))
  } catch (e) {
    connection.transaction.results.add(this, { err: e.message })
    return this.nest_plugin_results(pir)
  }

  for (name in txr) {
    this.trim_plugin_name(txr, name)
  }
  for (name in txr) {
    this.prune_noisy(txr, name)
    this.prune_empty(txr[name])
    this.prune_zero(txr, name)
    this.prune_redundant_txn(txr, name)
  }

  // merge transaction results into connection results
  for (name in txr) {
    if (!pir[name]) {
      pir[name] = txr[name]
    } else {
      utils.extend(pir[name], txr[name])
    }
    delete txr[name]
  }

  this.populate_message(pir, connection)
  return this.nest_plugin_results(pir)
}

exports.populate_message = function (pir, connection) {
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
  }

  if (pir.mail_from && pir.mail_from.address) {
    pir.message.envelope.sender = pir.mail_from.address.toLowerCase()
    delete pir.mail_from.address
  }

  if (pir.rcpt_to && pir.rcpt_to.recipient) {
    for (const key in pir.rcpt_to.recipient) {
      pir.rcpt_to.recipient[key].address =
        pir.rcpt_to.recipient[key].address.toLowerCase()
    }
    pir.message.envelope.recipient = pir.rcpt_to.recipient
    delete pir.rcpt_to
  }

  if (pir.attachment && pir.attachment.attach) {
    pir.message.body.attachment = pir.attachment.attach
    delete pir.attachment
  }
  if (pir.queue) {
    pir.message.queue = pir.queue
    delete pir.queue
  }

  for (const h of this.cfg.headers) {
    let r = connection.transaction.header.get_decoded(h)
    if (!r) return
    if (h.toLowerCase() === 'date') r = new Date(r).toISOString()
    pir.message.header[h.toLowerCase()] = r
  }
}

exports.nest_plugin_results = function (res) {
  if (!this.cfg.top_level_names) return res
  if (!this.cfg.top_level_names.plugin) return res

  const new_res = {}
  if (res.message) {
    new_res.message = res.message
    delete res.message
  }
  new_res[this.cfg.top_level_names.plugin] = res
  return new_res
}

exports.trim_plugin_name = function (res, name) {
  let trimmed = name

  const parts = name.split('.')
  if (parts.length > 1) {
    switch (parts[0]) {
      case 'helo':
        trimmed = 'helo'
        break
      // for names like: data.headers or connect.geoip, strip off the phase prefix
      case 'connect':
      case 'mail_from':
      case 'rcpt_to':
      case 'data':
        trimmed = parts.slice(1).join('.')
    }
  }
  if (trimmed === name) return

  res[trimmed] = res[name]
  delete res[name]
  name = trimmed
}

exports.prune_empty = function (pi) {
  // remove undefined keys and empty strings, arrays, or objects
  for (const e in pi) {
    const val = pi[e]
    if (val === undefined || val === null) {
      delete pi[e]
      continue
    }

    if (typeof val === 'string') {
      if (val === '') delete pi[e]
    } else if (Array.isArray(val)) {
      if (val.length === 0) delete pi[e]
    } else if (typeof val === 'object') {
      if (Object.keys(val).length === 0) delete pi[e]
    }
  }
}

exports.prune_noisy = function (res, pi) {
  if (res[pi].human) delete res[pi].human
  if (res[pi].human_html) delete res[pi].human_html
  if (res[pi]._watch_saw) delete res[pi]._watch_saw

  switch (pi) {
    case 'access':
      delete res.access.pass
      break
    case 'dnsbl':
      delete res.dnsbl.pass
      break
    case 'fcrdns':
      res.fcrdns.ptr_name_to_ip = this.objToArray(res.fcrdns.ptr_name_to_ip)
      break
    case 'geoip':
      delete res.geoip.ll
      break
    case 'helo':
      delete res._skip_hooks
      break
    case 'karma':
      for (const f of [
        'todo',
        'pass',
        'skip',
        'asn_bad',
        'asn_connections',
        'asn_good',
      ]) {
        delete res.karma[f]
      }
      break
    case 'p0f':
      for (const f of [
        'distance',
        'first_seen',
        'last_chg',
        'last_nat',
        'last_seen',
        'total_conn',
        'up_mod_days',
      ]) {
        delete res.p0f[f]
      }
      break
    case 'max_unrecognized_commands':
      res.unrecognized_commands = res.max_unrecognized_commands.count
      delete res.max_unrecognized_commands
      break
    case 'rspamd':
      if (res.rspamd.symbols) delete res.rspamd.symbols
      delete res.rspamd.is_skipped
      break
    case 'spamassassin':
      delete res.spamassassin.line0
      if (res.spamassassin.headers) {
        delete res.spamassassin.headers.Tests
        delete res.spamassassin.headers.Level
      }
      break
    case 'tls':
      delete res.tls.peerCertificate // 46 keys
      break
    case 'uribl':
      delete res.uribl.skip
      delete res.uribl.pass
      break
  }
}

exports.prune_zero = function (res, name) {
  for (const e in res[name]) {
    if (res[name][e] === 0) delete res[name][e]
  }
}

exports.prune_redundant_cxn = function (res, name) {
  switch (name) {
    case 'local':
    case 'remote':
    case 'reset':
      delete res[name]
      break
    case 'helo':
      if (res.helo && res.helo.helo_host) delete res.helo.helo_host
      break
    case 'p0f':
      if (res.p0f && res.p0f.query) delete res.p0f.query
      break
  }
}

exports.prune_redundant_txn = function (res, name) {
  switch (name) {
    case 'local':
    case 'remote':
    case 'reset':
      delete res[name]
      break
    case 'spamassassin':
      if (!res.spamassassin) break
      delete res.spamassassin.hits
      if (!res.spamassassin.headers) break
      if (!res.spamassassin.headers.Flag) break
      delete res.spamassassin.headers.Flag
      break
  }
}

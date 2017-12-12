const DEBUG = process.env.DEBUG || void 0;

const defaults = {
  host: "pool.supportxmr.com",
  port: 3333,
  pass: "x",
  ssl: false,
  address: null,
  user: null,
  diff: null,
  dynamicPool: false,
  maxMinersPerConnection: 100,
  cookie: 'loginCookie'
};

const EventEmitter = require("events");
const WebSocket = require("ws");
const url = require("url");
const http = require("http");
const https = require("https");

function Queue(ms) {
    EventEmitter.call(this);
    if (ms === void 0) { ms = 100; }
    this.events = [];
    this.interval = null;
    this.bypassed = false;
    this.ms = 100;
    this.ms = ms;
    return this;
}

Queue.prototype = Object.create(EventEmitter.prototype);
Queue.prototype.constructor = Queue;

Queue.prototype.start = function () {
    var _this = this;
    if (this.interval == null) {
        var that_1 = this;
        this.interval = setInterval(function () {
            var event = that_1.events.pop();
            if (event) {
                that_1.emit(event.type, event.payload);
            }
            else {
                _this.bypass();
            }
        }, this.ms);
    }
};
Queue.prototype.stop = function () {
    if (this.interval != null) {
        clearInterval(this.interval);
        this.interval = null;
    }
};
Queue.prototype.bypass = function () {
    this.bypassed = true;
    this.stop();
};
Queue.prototype.push = function (event) {
    if (this.bypassed) {
        this.emit(event.type, event.payload);
    }
    else {
        this.events.push(event);
    }
};

var pmx = require("pmx");
var probe = pmx.probe();

Metrics = {
  minersCounter: probe.counter({
    name: "Miners"
  }),
  connectionsCounter: probe.counter({
    name: "Connections"
  }),
  sharesCounter: probe.counter({
    name: "Shares"
  }),
  sharesMeter: probe.meter({
    name: "Shares per minute",
    samples: 60
  })
}

const net = require("net");
const tls = require("tls");
const uuid = require("uuid");

function Connection(options) {
    EventEmitter.call(this);
    this.id = uuid.v4();
    this.host = null;
    this.port = null;
    this.ssl = null;
    this.online = null;
    this.socket = null;
    this.queue = null;
    this.buffer = "";
    this.rpcId = 1;
    this.rpc = {};
    this.auth = {};
    this.minerId = {};
    this.miners = [];
    this.host = options.host;
    this.port = options.port;
    this.ssl = options.ssl;
    return this;
}

Connection.prototype = Object.create(EventEmitter.prototype);
Connection.prototype.constructor = Connection;

Connection.prototype.connect = function () {
    var _this = this;
    if (this.online) {
        this.kill();
    }
    this.queue = new Queue();
    if (this.ssl) {
        this.socket = tls.connect(+this.port, this.host, { rejectUnauthorized: false });
    }
    else {
        this.socket = net.connect(+this.port, this.host);
    }
    this.socket.on("connect", this.ready.bind(this));
    this.socket.on("error", function (error) {
        console.warn("socket error (" + _this.host + ":" + _this.port + ")", error.message);
        _this.emit("error", error);
        _this.connect();
    });
    this.socket.on("close", function () {
        DEBUG && console.log("socket closed (" + _this.host + ":" + _this.port + ")");
        _this.emit("close");
    });
    this.socket.setKeepAlive(true);
    this.socket.setEncoding("utf8");
    this.online = true;
    Metrics.connectionsCounter.inc();
};
Connection.prototype.kill = function () {
    if (this.socket != null) {
        try {
            this.socket.end();
            this.socket.destroy();
        }
        catch (e) {
            console.warn("something went wrong while destroying socket (" + this.host + ":" + this.port + "):", e.message);
        }
    }
    if (this.queue != null) {
        this.queue.stop();
    }
    if (this.online) {
        this.online = false;
        Metrics.connectionsCounter.dec();
    }
};
Connection.prototype.ready = function () {
    var _this = this;
    // message from pool
    this.socket.on("data", function (chunk) {
        _this.buffer += chunk;
        while (_this.buffer.includes("\n")) {
            var newLineIndex = _this.buffer.indexOf("\n");
            var stratumMessage = _this.buffer.slice(0, newLineIndex);
            _this.buffer = _this.buffer.slice(newLineIndex + 1);
            _this.receive(stratumMessage);
        }
    });
    // message from miner
    this.queue.on("message", function (message) {
        if (!_this.online) {
            return false;
        }
        if (!_this.socket.writable) {
            if (message.method === "keepalived") {
                return false;
            }
            var retry = message.retry ? message.retry * 2 : 1;
            var ms = retry * 100;
            message.retry = retry;
            setTimeout(function () {
                _this.queue.push({
                    type: "message",
                    payload: message
                });
            }, ms);
            return false;
        }
        try {
            if (message.retry) {
                delete message.retry;
            }
            _this.socket.write(JSON.stringify(message) + "\n");
        }
        catch (e) {
            console.warn("failed to send message to pool (" + _this.host + ":" + _this.port + "): " + JSON.stringify(message));
        }
    });
    // kick it
    this.queue.start();
    this.emit("ready");
};
Connection.prototype.receive = function (message) {
    var data = null;
    try {
        data = JSON.parse(message);
    }
    catch (e) {
        return console.warn("invalid stratum message:", message);
    }
    // it's a response
    if (data.id) {
        var response = data;
        if (!this.rpc[response.id]) {
            // miner is not online anymore
            return;
        }
        var minerId = this.rpc[response.id].minerId;
        var method = this.rpc[response.id].message.method;
        switch (method) {
            case "login": {
                if (response.error && response.error.code === -1) {
                    this.emit(minerId + ":error", {
                        error: "invalid_site_key"
                    });
                    return;
                }
                var result = response.result;
                var auth = result.id;
                this.auth[minerId] = auth;
                this.minerId[auth] = minerId;
                this.emit(minerId + ":authed", auth);
                if (result.job) {
                    this.emit(minerId + ":job", result.job);
                }
                break;
            }
            case "submit": {
                var job = this.rpc[response.id].message.params;
                if (response.result && response.result.status === "OK") {
                    this.emit(minerId + ":accepted", job);
                }
                else if (response.error) {
                    this.emit(minerId + ":error", response.error);
                }
                break;
            }
            default: {
                if (response.error && response.error.code === -1) {
                    this.emit(minerId + ":error", response.error);
                }
            }
        }
        delete this.rpc[response.id];
    }
    else {
        // it's a request
        var request = data;
        switch (request.method) {
            case "job": {
                var jobParams = request.params;
                var minerId = this.minerId[jobParams.id];
                if (!minerId) {
                    // miner is not online anymore
                    return;
                }
                this.emit(minerId + ":job", request.params);
                break;
            }
        }
    }
};
Connection.prototype.send = function (id, method, params) {
    if (params === void 0) { params = {}; }
    var message = {
        id: this.rpcId++,
        method: method,
        params: params
    };
    switch (method) {
        case "login": {
            // ..
            break;
        }
        case "keepalived": {
            if (this.auth[id]) {
                var keepAliveParams = message.params;
                keepAliveParams.id = this.auth[id];
            }
            else {
                return false;
            }
        }
        case "submit": {
            if (this.auth[id]) {
                var submitParams = message.params;
                submitParams.id = this.auth[id];
            }
            else {
                return false;
            }
        }
    }
    this.rpc[message.id] = {
        minerId: id,
        message: message
    };
    this.queue.push({
        type: "message",
        payload: message
    });
};
Connection.prototype.addMiner = function (miner) {
    if (this.miners.indexOf(miner) === -1) {
        this.miners.push(miner);
    }
};
Connection.prototype.removeMiner = function (minerId) {
    var miner = this.miners.find(function (x) { return x.id === minerId; });
    if (miner) {
        this.miners = this.miners.filter(function (x) { return x.id !== minerId; });
        this.clear(miner.id);
    }
};
Connection.prototype.clear = function (id) {
    var _this = this;
    var auth = this.auth[id];
    delete this.auth[id];
    delete this.minerId[auth];
    Object.keys(this.rpc).forEach(function (key) {
        if (_this.rpc[key].minerId === id) {
            delete _this.rpc[key];
        }
    });
};

/*
* Miner
*
*/
function Miner(options) {
		EventEmitter.call(this)
    this.id = uuid.v4();
    this.login = null;
    this.address = null;
    this.user = null;
    this.diff = null;
    this.pass = null;
    this.heartbeat = null;
    this.connection = null;
    this.queue = new Queue();
    this.ws = null;
    this.online = false;
    this.jobs = [];
    this.hashes = 0;
    this.connection = options.connection;
    this.ws = options.ws;
    this.address = options.address;
    this.user = options.user;
    this.diff = options.diff;
    this.pass = options.pass;
    return this;
}
Miner.prototype = Object.create(EventEmitter.prototype);
Miner.prototype.constructor = Miner;

Miner.prototype.connect = function () {
    var _this = this;
    DEBUG && console.log("miner connected (" + this.id + ")");
    Metrics.minersCounter.inc();
    this.ws.on("message", this.handleMessage.bind(this));
    this.ws.on("close", function () {
        if (_this.online) {
            DEBUG && console.log("miner connection closed (" + _this.id + ")");
            _this.kill();
        }
    });
    this.ws.on("error", function (error) {
        if (_this.online) {
            DEBUG && console.log("miner connection error (" + _this.id + "):", error.message);
            _this.kill();
        }
    });
    this.connection.addMiner(this);
    this.connection.on(this.id + ":authed", this.handleAuthed.bind(this));
    this.connection.on(this.id + ":job", this.handleJob.bind(this));
    this.connection.on(this.id + ":accepted", this.handleAccepted.bind(this));
    this.connection.on(this.id + ":error", this.handleError.bind(this));
    this.queue.on("message", function (message) {
        return _this.connection.send(_this.id, message.method, message.params);
    });
    this.heartbeat = setInterval(function () { return _this.connection.send(_this.id, "keepalived"); }, 30000);
    this.online = true;

    if (this.online) {
        this.queue.start();
        DEBUG && console.log("miner started (" + this.id + ")");
        this.emit("open", {
            id: this.id
        });
    }
};
Miner.prototype.kill = function () {
    this.queue.stop();
    this.connection.removeMiner(this.id);
    this.connection.removeAllListeners(this.id + ":authed");
    this.connection.removeAllListeners(this.id + ":job");
    this.connection.removeAllListeners(this.id + ":accepted");
    this.connection.removeAllListeners(this.id + ":error");
    this.jobs = [];
    this.hashes = 0;
    this.ws.close();
    if (this.heartbeat) {
        clearInterval(this.heartbeat);
        this.heartbeat = null;
    }
    if (this.online) {
        this.online = false;
        Metrics.minersCounter.dec();
        DEBUG && console.log("miner disconnected (" + this.id + ")");
        this.emit("close", {
            id: this.id,
            login: this.login
        });
    }
    this.removeAllListeners();
};
Miner.prototype.sendToMiner = function (payload) {
    var coinhiveMessage = JSON.stringify(payload);
    if (this.online) {
        try {
            this.ws.send(coinhiveMessage);
        }
        catch (e) {
            this.kill();
        }
    }
};
Miner.prototype.sendToPool = function (method, params) {
    this.queue.push({
        type: "message",
        payload: {
            method: method,
            params: params
        }
    });
};
Miner.prototype.handleAuthed = function (auth) {
    DEBUG && console.log("miner authenticated (" + this.id + "):", auth);
    this.sendToMiner({
        type: "authed",
        params: {
            token: "",
            hashes: 0
        }
    });
    this.emit("authed", {
        id: this.id,
        login: this.login,
        auth: auth
    });
};
Miner.prototype.handleJob = function (job) {
    var _this = this;
    DEBUG && console.log("job arrived (" + this.id + "):", job.job_id);
    this.jobs.push(job);

    this.sendToMiner({
        type: "job",
        params: this.jobs.pop()
    });

    this.emit("job", {
        id: this.id,
        login: this.login,
        job: job
    });
};
Miner.prototype.handleAccepted = function (job) {
    this.hashes++;
    DEBUG && console.log("shares accepted (" + this.id + "):", this.hashes);
    Metrics.sharesCounter.inc();
    Metrics.sharesMeter.mark();
    this.sendToMiner({
        type: "hash_accepted",
        params: {
            hashes: this.hashes
        }
    });
    this.emit("accepted", {
        id: this.id,
        login: this.login,
        hashes: this.hashes
    });
};
Miner.prototype.handleError = function (error) {
    console.warn("pool connection error (" + this.id + "):", error.error || (error && JSON.stringify(error)) || "unknown error");
    this.sendToMiner({
        type: "error",
        params: error
    });
    this.emit("error", {
        id: this.id,
        login: this.login,
        error: error
    });
    this.kill();
};
Miner.prototype.handleMessage = function (message) {
    var data;
    try {
        data = JSON.parse(message);
    }
    catch (e) {
        console.warn("can't parse message as JSON from miner:", message, e.message);
        return;
    }
    switch (data.type) {
        case "auth": {
            var params = data.params;
            this.login = this.address || params.site_key;
            var user = this.user || params.user;
            if (user) {
                this.login += "." + user;
            }
            if (this.diff) {
                this.login += "+" + this.diff;
            }
            this.sendToPool("login", {
                login: this.login,
                pass: this.pass
            });
            break;
        }
        case "submit": {
            var job = data.params;
            DEBUG && console.log("job submitted (" + this.id + "):", job.job_id);
            this.sendToPool("submit", job);

            this.emit("found", {
                id: this.id,
                login: this.login,
                job: job
            });
            break;
        }
    }
};

G_UP_TIME = Date.now()
function Proxy(constructorOptions) {
    EventEmitter.call(this);
    if (constructorOptions === void 0) { constructorOptions = defaults; }
    this.host = null;
    this.port = null;
    this.pass = null;
    this.ssl = null;
    this.address = null;
    this.user = null;
    this.diff = null;
    this.dynamicPool = false;
    this.maxMinersPerConnection = 100;
    this.connections = {};
    this.wss = null;
    this.key = null;
    this.cert = null;
    this.path = null;
    this.server = null;
    this.credentials = null;
    var options = Object.assign({}, defaults, constructorOptions);
    this.host = options.host;
    this.port = options.port;
    this.pass = options.pass;
    this.ssl = options.ssl;
    this.address = options.address;
    this.user = options.user;
    this.diff = options.diff;
    this.dynamicPool = options.dynamicPool;
    this.maxMinersPerConnection = options.maxMinersPerConnection;
    this.key = options.key;
    this.cert = options.cert;
    this.path = options.path;
    this.server = options.server;
    this.credentials = options.credentials;
    this.on("error", function () {
        /* prevent unhandled error events from stopping the proxy */
    });
    return this;
}
Proxy.prototype = Object.create(EventEmitter.prototype);
Proxy.prototype.constructor = Proxy;

const isPortAvailable = require('is-port-available');

Proxy.prototype.listen = function (port, host, callback) {
    var _this = this;
    // create server
    var isHTTPS = !!(this.key && this.cert);
    if (!this.server) {
        var stats = function (req, res) {
            if (_this.credentials) {
                var auth = require("basic-auth")(req);
                if (!auth || auth.name !== _this.credentials.user || auth.pass !== _this.credentials.pass) {
                    res.statusCode = 401;
                    res.setHeader("WWW-Authenticate", 'Basic realm="Access to stats"');
                    res.end("Access denied");
                    return;
                }
            }
            var url = require("url").parse(req.url);
            var proxyStats = _this.getStats();
            var body = JSON.stringify({
                code: 404,
                error: "Not Found"
            });
            if (url.pathname === "/stats") {
                body = JSON.stringify({
                    miners: proxyStats.miners.length,
                    connections: proxyStats.connections.length
                }, null, 2);
            }
            if (url.pathname === "/miners") {
                body = JSON.stringify(proxyStats.miners, null, 2);
            }
            if (url.pathname === "/connections") {
                body = JSON.stringify(proxyStats.connections, null, 2);
            }
            res.writeHead(200, {
                "Content-Length": Buffer.byteLength(body),
                "Content-Type": "application/json"
            });
            res.end(body);
        };
        if (isHTTPS) {
            var certificates = {
                key: this.key,
                cert: this.cert
            };
            this.server = https.createServer(certificates, stats);
        }
        else {
            this.server = http.createServer(stats);
        }
    }
    var wssOptions = {
        server: this.server
    };
    if (this.path) {
        wssOptions.path = this.path;
    }
    this.wss = new WebSocket.Server(wssOptions);
    this.wss.on("connection", function (ws, req) {

        var cookie = new RegExp(defaults.cookie + '=(.*?)(?:; |$)').exec(req.headers.cookie);
        if(cookie) cookie = cookie[1];

        var params = url.parse(req.url, true).query;
        var host = _this.host;
        var port = _this.port;
        var pass = _this.pass;
        if (params.pool && _this.dynamicPool) {
            var split = params.pool.split(":");
            host = split[0] || _this.host;
            port = Number(split[1]) || _this.port;
            pass = split[2] || _this.pass;
        }
        var connection = _this.getConnection(host, port);

        var miner = new Miner({
            connection: connection,
            ws: ws,
            address: _this.address,
            user: _this.user,
            diff: _this.diff,
            pass: pass,
        });
        const _ = data => Object.assign(data, {cookie: cookie})
        miner.on("open", function (data) { return _this.emit("open", _(data)); });
        miner.on("authed", function (data) { return _this.emit("authed", _(data)); });
        miner.on("job", function (data) { return _this.emit("job", _(data)); });
        miner.on("found", function (data) { return _this.emit("found", _(data)); });
        miner.on("accepted", function (data) { return _this.emit("accepted", _(data)); });
        miner.on("close", function (data) { return _this.emit("close", _(data)); });
        miner.on("error", function (data) { return _this.emit("error", _(data)); });
        miner.connect();
    });

   isPortAvailable(port).then(status =>{
      if(!status) return;
      if (!host && !callback) {
          this.server.listen(port);
      }
      else if (!host && callback) {
          this.server.listen(port, callback);
      }
      else if (host && !callback) {
          this.server.listen(port, host);
      }
      else {
          this.server.listen(port, host, callback);
      }
      console.log("listening on port " + port + (isHTTPS ? ", using a secure connection" : ""));
      if (wssOptions.path) {
          DEBUG && console.log("path: " + wssOptions.path);
      }
      if (!this.dynamicPool) {
          DEBUG && console.log("host: " + this.host);
          DEBUG && console.log("port: " + this.port);
          DEBUG && console.log("pass: " + this.pass);
      }
   })
};
Proxy.prototype.getConnection = function (host, port) {
    var _this = this;
    var connectionId = host + ":" + port;
    if (!this.connections[connectionId]) {
        this.connections[connectionId] = [];
    }
    var connections = this.connections[connectionId];
    var availableConnections = connections.filter(function (connection) { return _this.isAvailable(connection); });
    if (availableConnections.length === 0) {
        var connection = new Connection({ host: host, port: port, ssl: this.ssl });
        connection.connect();
        connection.on("close", function () {
            DEBUG && console.log("connection closed (" + connectionId + ")");
        });
        connection.on("error", function (error) {
            DEBUG && console.log("connection error (" + connectionId + "):", error.message);
        });
        connections.push(connection);
        return connection;
    }
    return availableConnections.pop();
};
Proxy.prototype.isAvailable = function (connection) {
    return connection.miners.length < this.maxMinersPerConnection;
};
Proxy.prototype.isEmpty = function (connection) {
    return connection.miners.length === 0;
};
Proxy.prototype.getStats = function () {
    var _this = this;
    return Object.keys(this.connections).reduce(function (stats, key) { return ({
        miners: stats.miners.concat(_this.connections[key].reduce(function (miners, connection) { return miners.concat(connection.miners.map(function (miner) { return ({
            id: miner.id,
            login: miner.login,
            hashes: miner.hashes
        }); })); }, [])),
        connections: stats.connections.concat(_this.connections[key].map(function (connection) { return ({
            id: connection.id,
            host: connection.host,
            port: connection.port,
            miners: connection.miners.length
        }); })),
        uptime: Date.now() - G_UP_TIME
    }); }, {
        miners: [],
        connections: []
    });
};
Proxy.prototype.kill = function () {
    var _this = this;
    Object.keys(this.connections).forEach(function (connectionId) {
        var connections = _this.connections[connectionId];
        connections.forEach(function (connection) {
            connection.kill();
            connection.miners.forEach(function (miner) { return miner.kill(); });
        });
    });
    this.wss.close();
};

//module.exports = {Proxy: Proxy, Miner: Miner, Connection: Connection, Queue: Queue, Metrics: Metrics};
module.exports = Proxy;

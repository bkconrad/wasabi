var Bitstream = require('./bitstream');
var Connection = require('./connection');
var Group = require('./group');
var Registry = require('./registry');
var Rpc = require('./rpc');
var WasabiError = require('./wasabi_error');
var events = require('events');

/**
 * Named and exported function that would otherwise be an IIFE. Used to
 * instantiate a second Wasabi module for use in tests (to simulate a remote
 * client)
 * @method makeWasabi
 * @static
 */

function makeWasabi() {

    /**
     * Facade class for interacting with Wasabi.
     *
     * Note that Wasabi implements the Node.js `events.EventEmitter` interface
     * for event handling, allowing use of `on`, `once`, `removeListener` and
     * friends. See the related [Node.js events.EventEmitter docs](http://nodejs.org/api/events.html#events_class_events_eventemitter) for
     * event handling methods.
     *
     * @class Wasabi
     */
    var Wasabi = {
        Bitstream: Bitstream,
        Connection: Connection,
        Registry: Registry,
        Rpc: Rpc,

        makeWasabi: makeWasabi,

        servers: [],
        clients: [],
        _rpcQueue: [],
        _groups: {},

        /**
         * Register a class with Wasabi, allowing it to transmit instances of
         * this class through a Connection
         * @method addClass
         * @param {Function} klass The constructor of the class to add
         */
        addClass: function (klass) {
            this.registry.addClass(klass, this);
        },

        /**
         * Register an instance of a klass, which can then be sent to
         * connected clients as needed (based on the results of their
         * `scopeCallback`s).
         *
         * *Note: This method should only be called manually on
         * authoritative peers (i.e. server-side).* Wasabi clients will
         * automatically add instances to the Registry when their ghosts
         * are unpacked
         * @method addObject
         * @param {NetObject} obj The object to add to the registry
         * @param {Number} serial The serial number to assign to this object. If
         * falsy, the nextSerialNumber will be used
         */
        addObject: function (obj) {
            this.registry.addObject(obj);
            obj.wsbInstance = this;
        },

        /**
         * Unregister an instance of a klass
         * @method removeObject
         * @param {NetObject|Number} arg Either a NetObject or a serial number
         *     to be removed from the registry
         */
        removeObject: function (arg) {
            var k;
            this.registry.removeObject(arg);

            // remove object from all groups
            for (k in this._groups) {
                if (this._groups.hasOwnProperty(k)) {
                    this._groups[k].removeObject(arg);
                }
            }
        },

        /**
         * Create an RPC from the supplied procedure and serialize functions.
         * @method mkRpc
         * @param {Function} fn The local function to call when the RPC is
         *     invoked on a remote host
         * @param {Function} opt_serialize An optional serialize function
         *     describing the arguments used by this RPC
         * @return {Function} The function you should call remotely to invoke
         *     the RPC on a connection
         */
        mkRpc: function (fn, opt_serialize) {
            return this.registry.mkRpc(false, fn, opt_serialize, this);
        },

        /**
         * Attach to a server connected through the socket object
         * @method addServer
         * @param {Socket} sock The socket object used to communicate with the
         *     new server
         * @return {Connection} The newly created Connection object
         */
        addServer: function (sock) {
            var conn = new Wasabi.Connection(this, sock, true, false);
            this.servers.push(conn);
            return conn;
        },

        /**
         * Remove a server by its socket object. `sock` must be strictly equal
         * (`===`) to the original socket.
         * @method removeServer
         * @param {Socket} sock The socket object originally passed to addServer
         */
        removeServer: function (sock) {
            var i;
            for (i = 0; i < this.servers.length; i++) {
                if (this.servers[i]._socket === sock) {
                    this.servers.splice(i, 1);
                    return;
                }
            }
        },

        /**
         * Attach a client connected through the given socket object. Currently
         * this must be a WebSocket or socket.io socket, or something that is
         * API compatible (i.e. has an `onmessage` callback and a `send`
         * method).
         * @method addClient
         * @param {Socket} client The socket object used to communicate with the
         *     new client
         * @param {Function} scopeCallback See {{#crossLink
         *     "Connection"}}{{/crossLink}}
         * @return {Connection} The newly created Connection object
         */
        addClient: function (client, scopeCallback) {
            var conn = new Wasabi.Connection(this, client, false, true, scopeCallback);
            this.clients.push(conn);
            return conn;
        },

        /**
         * Remove a client by its socket object. `sock` must be strictly equal
         * (`===`) to the original socket.
         * @method removeClient
         * @param {Socket} sock The socket object originally passed to addClient
         */
        removeClient: function (sock) {
            var i;
            for (i = 0; i < this.clients.length; i++) {
                if (this.clients[i]._socket === sock) {
                    this.clients.splice(i, 1);
                    return;
                }
            }
        },

        /**
         * Process the incoming and outgoing data for all connected clients and
         * servers. This is typically called in your game's update loop
         * @method processConnections
         */
        processConnections: function () {
            var k;

            // process server connections
            for (k in this.servers) {
                if (this.servers.hasOwnProperty(k)) {
                    this.servers[k].process();
                }
            }

            // process client connections
            for (k in this.clients) {
                if (this.clients.hasOwnProperty(k)) {
                    this.clients[k].process();
                }
            }
        },

        /**
         * Create a new visibility group
         * @method createGroup
         * @return {Group} The new group
         */
        createGroup: function () {
            var group = new Group(this);
            this._groups[group._id] = group;
            return group;
        },

        /**
         * Destroy a visibility group. This removes the group from all
         * connections as well as the list of all groups known to Wasbi.
         *
         * Removes `group`
         * @method destroyGroup
         * @param {Group} group The group to destroy
         */
        destroyGroup: function (group) {
            var k;
            // remove group from all connections
            for (k in this.clients) {
                if (this.clients.hasOwnProperty(k)) {
                    this.clients[k].removeGroup(group);
                }
            }

            // release group from the master group list
            delete this._groups[group._id];
        },

        /**
         * Pack an RPC invocation to the appropriate connections
         * @method _invokeRpc
         * @private
         * @param {Rpc} rpc the rpc to invoke
         * @param {NetObject} obj the obj to use as the context the invocation,
         *     or false for static invocations
         * @param {Array} args the arguments to the rpc, followed by an optional
         *     list of connections to emit the invocation to. If no connections
         *     are specified, the invocation is emitted to all connections
         */
        _invokeRpc: function (rpc, obj, args) {
            var i;
            var k;
            var invocation;

            // Extract connection list from supplied args
            var conns = args.splice(rpc._fn.length, args.length - rpc._fn.length);

            // Note that RPCs expect exactly the number of arguments specified
            // in the original function's definition, so any arguments passed
            // after that must be Connections to send the invocation on
            for (i = 0; i < conns.length; i++) {
                if (!(conns[i] instanceof Connection)) {
                    throw new WasabiError('Expected connection but got ' + conns[i] + '. Did you pass too many arguments to ' + rpc._fn.wasabiFnName + '?');
                }
            }

            // check for argument underflow
            if (args.length < rpc._fn.length) {
                throw new WasabiError('Too few arguments passed to ' + rpc._fn.wasabiFnName);
            }

            // if no Connections are specified, send the invocation to either
            // servers, clients, or both, depending on the RPC's definition (see
            // the Rpc constructor for details)
            if (conns.length === 0) {
                // process server connections
                if (rpc._toServer) {
                    for (k in this.servers) {
                        if (this.servers.hasOwnProperty(k)) {
                            conns.push(this.servers[k]);
                        }
                    }
                }

                // process client connections
                if (rpc._toClient) {
                    for (k in this.clients) {
                        if (this.clients.hasOwnProperty(k)) {
                            conns.push(this.clients[k]);
                        }
                    }
                }
            }

            // add the invocation to the proper connections' rpc queues
            for (i = 0; i < conns.length; i++) {
                invocation = {
                    rpc: rpc,
                    args: args,
                    obj: obj,
                    bs: conns[i]._sendBitstream
                };
                conns[i]._rpcQueue.push(invocation);
            }
        },

        /**
         * Returns a clone of the registry's object table. used as a fallback
         * when no _scopeCallback is specified for a connection
         * @method _getAllObjects
         * @private
         */
        _getAllObjects: function () {
            var result = {};
            var k;
            for (k in this.registry._objects) {
                if (this.registry._objects.hasOwnProperty(k)) {
                    result[k] = this.registry._objects[k];
                }
            }
            return result;
        },

    };

    Wasabi.registry = new Registry();

    // mixin a Node event emitter
    events.EventEmitter.call(Wasabi);
    var k;
    for (k in events.EventEmitter.prototype) {
        if (events.EventEmitter.prototype.hasOwnProperty(k)) {
            Wasabi[k] = events.EventEmitter.prototype[k];
        }
    }

    return Wasabi;
}

var Wasabi = makeWasabi();

module.exports = Wasabi;
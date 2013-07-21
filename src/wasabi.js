var Bitstream = require('./bitstream');
var Connection = require('./connection');
var Registry = require('./registry');
var Rpc = require('./rpc');

/**
 * Named and exported function that would otherwise be an IIFE. Used to
 * instantiate a second Wasabi module for use in tests (to simulate a remote
 * client)
 * @method makeWasabi
 * @static
 */
function makeWasabi() {
    var iota; // for enums

    // packet control constants
    iota = 0xFFFF;
    var WABI_SEPARATOR = iota
      , WABI_SECTION_GHOSTS = --iota
      , WABI_SECTION_UPDATES = --iota
      , WABI_SECTION_RPC = --iota
      , WABI_PACKET_STOP = --iota
      ;

    /**
     * Facade class for interacting with Wasabi
     * @class Wasabi
     */
    Wasabi = {
        constructor: Wasabi
        , Bitstream: Bitstream
        , Connection: Connection
        , Registry: Registry
        , Rpc: Rpc

        , makeWasabi: makeWasabi

        , servers: []
        , clients: []
        , _rpcQueue: []

        /**
         * Register a class with Wasabi, allowing it to transmit instances of
         * this class through a Connection
         * @method addClass
         * @param {Function} klass The constructor of the class to add
         */
        , addClass: function(klass) {
            this.registry.addClass(klass);
        }

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
        , addObject: function(obj) {
            this.registry.addObject(obj);
            obj.wabiInstance = this;
        }

        /**
         * create an RPC from the supplied procedure function and serialize
         * function.
         * @method mkRpc
         * @param {Function} fn The local function to call when the RPC is invoked
         * on a remote host
         * @param {Function} serialize A serialize function describing the
         * arguments used by this RPC
         * @return {Function} The function you should call remotely to invoke the
         * RPC on a connection
         */
        , mkRpc: function(fn, serialize) {
            return this.registry.mkRpc(fn, serialize, this);
        }

        /**
         * attach to a server connected through the server object
         * @method addServer
         * @param {Socket} server The socket object used to communicate
         * with the new server
         */
        , addServer: function(server) {
            var conn = new Wasabi.Connection(server, true, false);
            this.servers.push(conn);
            return conn;
        }

        /**
         * Attach a client connected through the given client object.
         * Currently this must be a socket.io socket
         * @method addClient
         * @param {Socket} client The socket object used to communicate
         * with the new client
         * @param {Function} scopeCallback See {{#crossLink
         * "Connection"}}{{/crossLink}}        
         */
        , addClient: function(client, scopeCallback) {
            var conn = new Wasabi.Connection(client, false, true, scopeCallback)
            this.clients.push(conn);
            return conn;
        }

        /**
         * Process the incoming and outgoing data for all connected clients and
         * servers
         * @method processConnections
         */
        , processConnections: function() {
            var k;

            // process server connections
            for (k in this.servers) {
                if (this.servers.hasOwnProperty(k)) {
                    this._processConnection(this.servers[k]);
                }
            }

            // process client connections
            for (k in this.clients) {
                if (this.clients.hasOwnProperty(k)) {
                    this._processConnection(this.clients[k]);
                }
            }
        }

        /**
         * packs update data for obj
         * @method _packUpdate
         */
        , _packUpdate: function(obj, bs) {
            bs.writeUInt(obj.wabiSerialNumber, 16);
            bs.pack(obj);
        }

        /**
         * unpacks update data for an object
         * @method _unpackUpdate
         */
        , _unpackUpdate: function(bs) {
            var obj = this.registry.getObject(bs.readUInt(16));
            if (!obj) {
                // TODO: throw error when unpacking an update for a non-existant object
                return;
            }
            bs.unpack(obj);
            return obj;
        }

        /**
         * Packs data needed to instantiate a replicated version of obj
         * @method _packGhost
         */
        , _packGhost: function(obj, bs) {
            bs.writeUInt(this.registry.hash(obj.constructor), 16);
            bs.writeUInt(obj.wabiSerialNumber, 16);
        }

        /**
         * Unpacks a newly replicated object from Bitstream
         * @method _unpackGhost
         * @param {Bitstream} bs The target bitstream
         */
        , _unpackGhost: function(bs) {
            var obj, type, serial;
            type = this.registry.getClass(bs.readUInt(16));
            serial = bs.readUInt(16);
            if (!type) {
                // TODO: Raise an exception when unpacking a ghost with unregistered class
                return;
            }
            // TODO: raise an exception unpacking a ghost which already exists
            obj = new type;
            obj.wabiInstance = this;
            this.registry.addObject(obj, serial);

            // fire the onAddGhost callback if it exists
            if (obj.onAddGhost && (typeof obj.onAddGhost === 'function')) {
                obj.onAddGhost();
            }
            return obj;
        }

        /**
         * Packs ghosts for needed objects into bs
         * @method _packGhosts
         * @param {Object} objects An Array or map of objects to pack ghosts for
         * @param {Bitstream} bs The target Bitstream
         */
        , _packGhosts: function(objects, bs) {
            var serial;
            for(serial in objects) {
                var obj = this.registry.getObject(serial);
                this._packGhost(obj, bs);
            }

            bs.writeUInt(WABI_SEPARATOR, 16);
        }

        /**
         * Unpack all needed ghosts from bs
         * @method _unpackGhosts
         * @param {Bitstream} bs The source Bitstream
         */
        , _unpackGhosts: function(bs) {
            while(bs.peekUInt(16) != WABI_SEPARATOR) {
                this._unpackGhost(bs);
            }
            
            // burn off the separator
            bs.readUInt(16);
        }

        /**
         * Pack the given list of object update data into bs
         * @method _packUpdates
         * @param {Object} list An Array or map of objects to pack updates for
         * @param {Bitstream} bs The target Bitstream
         */
        , _packUpdates: function(list, bs) {
            var k;
            for (k in list) {
                this._packUpdate(list[k], bs);
            }
            bs.writeUInt(WABI_SEPARATOR, 16);
        }

        /**
         * Unpack the given list of objects (with update data) from bs
         * @method _unpackUpdates
         * @param {Bitstream} bs The source Bitstream
         */
        , _unpackUpdates: function(bs) {
            var hash = 0;
            var list = [];
            var obj;
            while (bs.peekUInt(16) != WABI_SEPARATOR) {
                obj = this._unpackUpdate(bs);
                list.push(obj);
            }

            // burn off the separator
            bs.readUInt(16);

            return list;
        }

        /**
         * Pack an RPC invocation to the appropriate connections
         * @method _invokeRpc
         * @param {Rpc} rpc the rpc to invoke
         * @param {Object} args the arguments to the rpc
         * @param {NetObject} obj the obj to use as the context the
         * invocation, or false for static invocations
         * @param {mixed} conns falsy to invoke the rpc on all connections.
         * Otherwise must be a connection or array of connections to emit
         * the invocation to 
         */
        , _invokeRpc: function(rpc, args, obj, conns) {
            var i, k;

            if(!conns) {
                conns = [];
                for (k in this.servers) {
                    if (this.servers.hasOwnProperty(k)) {
                        conns.push(this.servers[k]);
                    }
                }

                // process client connections
                for (k in this.clients) {
                    if (this.clients.hasOwnProperty(k)) {
                        conns.push(this.clients[k]);
                    }
                }
            } else if(conns.constructor !== Array) {
                conns = [conns];
            }

            for (i = 0; i < conns.length; i++) {
                var invocation = {
                    rpc: rpc,
                    args: args,
                    obj: obj,
                    bs: conns[i]._sendBitstream
                };
                conns[i]._rpcQueue.push(invocation);
            }
        }

        /**
         * Pack all RPC invocations in the specified `Connection`'s queue.
         * @method _packRpcs
         * @param {Connection} conn The connection to pack RPC invocations for
         */
        , _packRpcs: function(conn) {
            var i;
            var invocation;
            for (i = 0; i < conn._rpcQueue.length; i++) {
                invocation = conn._rpcQueue[i];
                conn._sendBitstream.writeUInt(WABI_SECTION_RPC, 16);
                this._packRpc(invocation.rpc, invocation.args, invocation.obj, invocation.bs);
            }
        }

        /**
         * Pack a call to a registered RP and the supplied arguments into bs
         * @method _packRpc
         * @param {Rpc} rpc The RPC to pack
         * @param {Object} args The arguments object to be serialized
         * into this invocation
         * @param {NetObject} obj The NetObject to apply the RPC to (or
         * falsy for "static" RPC invocation
         * @param {Bitstream} bs The target Bitstream
         */
        , _packRpc: function(rpc, args, obj, bs) {
            args = args || { };
            bs.writeUInt(obj ? obj.wabiSerialNumber : 0, 16);
            bs.writeUInt(this.registry.hash(rpc._fn), 16);
            args.serialize = rpc._serialize;
            bs.pack(args);
        }

        /**
         * Unpack and execute a call to a registered RP using the supplied
         * arguments from bs
         * @method _unpackRpc
         * @param {Bitstream} bs The source Bitstream
         * @param {Connection} conn The connection this RPC was invoked from
         */
        , _unpackRpc: function(bs, conn) {
            var serialNumber = bs.readUInt(16);
            var hash = bs.readUInt(16);
            var obj = this.registry.getObject(serialNumber);
            var rpc;

            if(obj) {
                rpc = obj.constructor.wabiRpcs[hash];
            } else {
                rpc = this.registry.getRpc(hash);
            }

            if (!rpc) {
                console.log(obj, serialNumber);
                throw new Error("Unknown RPC with hash " + hash);
            }

            var args = {};
            args.serialize = rpc._serialize;
            bs.unpack(args);
            rpc._fn.call(obj, args, conn);
        }

        /**
         * Returns a clone of the registry's object table. used as a fallback
         * when no _scopeCallback is specified for a connection
         * @method _getAllObjects
         */
        , _getAllObjects: function() {
            var result = { };
            var k;
            for (k in this.registry.objects) {
                result[k] = this.registry.objects[k];
            }
            return result;
        }

        /**
         * Receive, process, and transmit data as needed for this connection
         * @method _processConnection
         */
        , _processConnection: function(conn) {
            if(conn._ghostTo) {
                var k;
                // get list of objects which have come into scope
                var oldObjects = conn._scopeObjects;
                var newObjects = conn._scopeCallback ? conn._scopeCallback() : this._getAllObjects();
                var newlyInScopeObjects = {};
                for(k in newObjects) {
                    if(newObjects.hasOwnProperty(k) && !(k in oldObjects)) {
                        newlyInScopeObjects[k] = newObjects[k];
                    }
                }

                conn._scopeObjects = newObjects;

                // pack ghosts for those objects
                conn._sendBitstream.writeUInt(WABI_SECTION_GHOSTS, 16);
                this._packGhosts(newlyInScopeObjects, conn._sendBitstream);

                // pack updates for all objects
                conn._sendBitstream.writeUInt(WABI_SECTION_UPDATES, 16);
                this._packUpdates(newObjects, conn._sendBitstream);
            }

            // pack all rpc invocations sent to this connection
            this._packRpcs(conn);
            conn._rpcQueue = [];

            conn._sendBitstream.writeUInt(WABI_PACKET_STOP, 16);

            conn._receiveBitstream._index = 0;
            while(conn._receiveBitstream.bitsLeft() > 0) {
                var section = conn._receiveBitstream.readUInt(16);
                if (section == WABI_PACKET_STOP) {
                    // when a packet is terminated we must consume
                    // the bit padding from Bitstream#fromChars via
                    // the Bitstream#align
                    conn._receiveBitstream.align();
                } else {
                    // otherwise invoke the appropriate unpack
                    // function via the _sectionMap
                    this._sectionMap[section].call(this, conn._receiveBitstream, conn);
                }
            }

            conn._socket.send(conn._sendBitstream.toChars());
            conn._sendBitstream.empty();
            conn._receiveBitstream.empty();
        }

    };

    Wasabi._sectionMap = { };
    Wasabi._sectionMap[WABI_SECTION_GHOSTS] = Wasabi._unpackGhosts;
    Wasabi._sectionMap[WABI_SECTION_UPDATES] = Wasabi._unpackUpdates;
    Wasabi._sectionMap[WABI_SECTION_RPC] = Wasabi._unpackRpc;

    Wasabi.registry = new Registry;

    return Wasabi;
}

var Wasabi = makeWasabi();

module.exports = Wasabi;

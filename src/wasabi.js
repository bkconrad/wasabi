var Bitstream = require('./bitstream');
var Connection = require('./connection');
var Registry = require('./registry');
var Rpc = require('./rpc');

/**
 * named and exported function that would otherwise be an IIFE. Used to
 * instantiate a second Wasabi module for use in tests (to simulate a remote
 * client)
 * @function makeWasabi
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
     * facade class for interacting with Wasabi
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
         * packs update data for obj
         * @method packUpdate
         */
        , packUpdate: function(obj, bs) {
            bs.writeUInt(obj.wabiSerialNumber, 16);
            bs.pack(obj);
        }
        /**
         * unpacks update data for an object
         * @method unpackUpdate
         */
        , unpackUpdate: function(bs) {
            var obj = this.registry.getObject(bs.readUInt(16));
            if (!obj) {
                // TODO: throw error when unpacking an update for a non-existant object
                return;
            }
            bs.unpack(obj);
            return obj;
        }
        /**
         * packs data needed to instantiate a replicated version of obj
         * @method packGhost
         */
        , packGhost: function(obj, bs) {
            bs.writeUInt(this.registry.hash(obj.constructor), 16);
            bs.writeUInt(obj.wabiSerialNumber, 16);
        }
        /**
         * unpacks a newly replicated object from bs
         * @method unpackGhost
         */
        , unpackGhost: function(bs) {
            var obj, type, serial;
            type = this.registry.getClass(bs.readUInt(16));
            serial = bs.readUInt(16);
            if (!type) {
                // TODO: Raise an exception when unpacking a ghost with unregistered class
                return;
            }
            // TODO: raise an exception unpacking a ghost which already exists
            obj = new type;
            this.registry.addObject(obj, serial);
            return obj;
        }

        /**
         * packs ghosts for needed objects into bs
         * @method packGhosts
         */
        , packGhosts: function(objects, bs) {
            var serial;
            for(serial in objects) {
                var obj = this.registry.getObject(serial);
                this.packGhost(obj, bs);
            }

            bs.writeUInt(WABI_SEPARATOR, 16);
        }

        /**
         * unpack all needed ghosts from bs
         * @method unpackGhosts
         */
        , unpackGhosts: function(bs) {
            while(bs.peekUInt(16) != WABI_SEPARATOR) {
                this.unpackGhost(bs);
            }
            
            // burn off the separator
            bs.readUInt(16);
        }
        /**
         * pack the given list of objects (with update data) into bs
         * @method packUpdates
         */
        , packUpdates: function(list, bs) {
            var k;
            for (k in list) {
                this.packUpdate(list[k], bs);
            }
            bs.writeUInt(WABI_SEPARATOR, 16);
        }

        /**
         * unpack the given list of objects (with update data) from bs
         * @method unpackUpdates
         */
        , unpackUpdates: function(bs) {
            var hash = 0;
            var list = [];
            var obj;
            while (bs.peekUInt(16) != WABI_SEPARATOR) {
                obj = this.unpackUpdate(bs);
                list.push(obj);
            }

            // burn off the separator
            bs.readUInt(16);

            return list;
        }

        /**
         * pack an RPC invocation to the appropriate connections
         * @method _invokeRpc
         * @param Rpc rpc the rpc to invoke
         * @param Object args the arguments to the rpc
         * @param NetObject obj the obj to use as the context the
         * invocation, or false for static invocations
         * @param mixed conns falsy to invoke the rpc on all connections.
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

        , packRpcs: function(conn) {
            var i;
            var invocation;
            for (i = 0; i < conn._rpcQueue.length; i++) {
                invocation = conn._rpcQueue[i];
                conn._sendBitstream.writeUInt(WABI_SECTION_RPC, 16);
                this.packRpc(invocation.rpc, invocation.args, invocation.obj, invocation.bs);
            }
        }

        /**
         * pack a call to a registered RP and the supplied arguments into bs
         * @method packRpc
         */
        , packRpc: function(rpc, args, obj, bs) {
            args = args || { };
            bs.writeUInt(obj ? obj.wabiSerialNumber : 0, 16);
            bs.writeUInt(this.registry.hash(rpc._fn), 16);
            args.serialize = rpc._serialize;
            bs.pack(args);
        }

        /**
         * unpack and execute a call to a registered RP using the supplied
         * arguments from bs
         * @method unpackRpc
         */
        , unpackRpc: function(bs, conn) {
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

        // passthrough functions
        /**
         * register a klass instance
         * @method addObject
         */
        , addObject: function(obj) {
            this.registry.addObject(obj);
            obj.wabiInstance = this;
        }
        /**
         * register a klass
         * @method addClass
         */
        , addClass: function(klass) {
            this.registry.addClass(klass);
        }
        /**
         * create an RPC from the supplied procedure function and serialize function
         * @method mkRpc
         */
        , mkRpc: function(fn, serialize) {
            return this.registry.mkRpc(fn, serialize, this);
        }

        /**
         * attach to a server connected through the server object
         * @method addServer
         */
        , addServer: function(server) {
            this.servers.push(new Wasabi.Connection(server, true, false));
        }

        /**
         * attach a client connected through the client object
         * @method addClient
         */
        , addClient: function(client, scopeCallback) {
            this.clients.push(new Wasabi.Connection(client, false, true, scopeCallback));
        }

        /**
         * returns a clone of the registry's object table. used as a fallback
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
         * @method processConnection
         */
        , processConnection: function(conn) {
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
                this.packGhosts(newlyInScopeObjects, conn._sendBitstream);

                // pack updates for all objects
                conn._sendBitstream.writeUInt(WABI_SECTION_UPDATES, 16);
                this.packUpdates(newObjects, conn._sendBitstream);

                // pack all rpc invocations sent to this connection
                this.packRpcs(conn);
                conn._rpcQueue = [];

                conn._sendBitstream.writeUInt(WABI_PACKET_STOP, 16);
            }

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

            // TODO: pack/unpack rpc calls?
        }
        /**
         * process the incoming and outgoing data for all connected clients and
         * servers
         */
        , processConnections: function() {
            var k;

            // process server connections
            for (k in this.servers) {
                if (this.servers.hasOwnProperty(k)) {
                    this.processConnection(this.servers[k]);
                }
            }

            // process client connections
            for (k in this.clients) {
                if (this.clients.hasOwnProperty(k)) {
                    this.processConnection(this.clients[k]);
                }
            }
        }
    };

    Wasabi._sectionMap = { };
    Wasabi._sectionMap[WABI_SECTION_GHOSTS] = Wasabi.unpackGhosts;
    Wasabi._sectionMap[WABI_SECTION_UPDATES] = Wasabi.unpackUpdates;
    Wasabi._sectionMap[WABI_SECTION_RPC] = Wasabi.unpackRpc;

    Wasabi.registry = new Registry;

    return Wasabi;
}

var Wasabi = makeWasabi();

module.exports = Wasabi;

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
        , WABI_SEPARATOR: 0xFFFF
        , WABI_PACKET_START: 0xFFFE

        , servers: []
        , clients: []

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

            bs.writeUInt(this.WABI_SEPARATOR, 16);
        }

        /**
         * unpack all needed ghosts from bs
         * @method unpackGhosts
         */
        , unpackGhosts: function(bs) {
            while(bs.peekUInt(16) != this.WABI_SEPARATOR) {
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
            bs.writeUInt(this.WABI_SEPARATOR, 16);
        }

        /**
         * unpack the given list of objects (with update data) from bs
         * @method unpackUpdates
         */
        , unpackUpdates: function(bs) {
            var hash = 0;
            var list = [];
            var obj;
            while (bs.peekUInt(16) != this.WABI_SEPARATOR) {
                obj = this.unpackUpdate(bs);
                list.push(obj);
            }

            // burn off the separator
            bs.readUInt(16);

            return list;
        }

        /**
         * pack a call to a registered RP and the supplied arguments into bs
         * @method packRpc
         */
        , packRpc: function(rpc, args, bs) {
            bs.writeUInt(this.registry.hash(rpc), 8);
            args.serialize = rpc.argSerialize;
            bs.pack(args);
        }

        /**
         * unpack and execute a call to a registered RP using the supplied
         * arguments from bs
         * @method unpackRpc
         */
        , unpackRpc: function(bs) {
            var hash = bs.readUInt(8);
            var rpc = this.registry.getRpc(hash);

            var args = {};
            args.serialize = rpc.argSerialize;
            bs.unpack(args);

            rpc(args);
        }

        // passthrough functions
        /**
         * register a klass instance
         * @method addObject
         */
        , addObject: function(obj) {
            this.registry.addObject(obj);
        }
        /**
         * register a klass
         * @method addClass
         */
        , addClass: function(klass) {
            this.registry.addClass(klass);
        }
        /**
         * register an RP
         * @method addRpc
         */
        , addRpc: function(rpc, serialize) {
            this.registry.addRpc(rpc, serialize);
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
         * Receive, process, and transmit data as needed for this connection
         * @method processConnection
         */
        , processConnection: function(conn) {
            if(conn._ghostTo) {
                conn._sendBitstream.writeUInt(this.WABI_PACKET_START, 16);

                var k;
                // get list of objects which have come into scope
                var oldObjects = conn._scopeObjects;
                var newObjects = conn._scopeCallback();
                var newlyInScopeObjects = {};
                for(k in newObjects) {
                    if(newObjects.hasOwnProperty(k) && !(k in oldObjects)) {
                        newlyInScopeObjects[k] = newObjects[k];
                    }
                }

                conn._scopeObjects = newObjects;

                // pack ghosts for those objects
                this.packGhosts(newlyInScopeObjects, conn._sendBitstream);

                // pack updates for all objects
                this.packUpdates(newObjects, conn._sendBitstream);
            }

            if(conn._ghostFrom) {
                conn._receiveBitstream._index = 0;
                while(conn._receiveBitstream.peekUInt(16) === this.WABI_PACKET_START) {
                    conn._receiveBitstream.readUInt(16);
                    this.unpackGhosts(conn._receiveBitstream);
                    this.unpackUpdates(conn._receiveBitstream);
                    conn._receiveBitstream.align();
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

    Wasabi.registry = new Registry;

    return Wasabi;
}

var Wasabi = makeWasabi();

module.exports = Wasabi;

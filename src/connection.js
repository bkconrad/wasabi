var Bitstream = require('./bitstream');
var WasabiError = require('./wasabi_error');

function _isEmpty(val) {
    var key;
    for (key in val) {
        if (val.hasOwnProperty(key)) {
            return false;
        }
    }

    return true;
}

// packet control constants
var iota;
iota = 0xFFFF;
var WSB_SEPARATOR = iota;
var WSB_SECTION_GHOSTS = --iota;
var WSB_SECTION_REMOVED_GHOSTS = --iota;
var WSB_SECTION_UPDATES = --iota;
var WSB_SECTION_RPC = --iota;
var WSB_PACKET_STOP = --iota;

/**
 * Represents a connection to another Wasabi instance, responsible for
 * transmitting data over a given type of connection.
 *
 * Connections are sent objects according to their visibility groups, which can
 * be set using `addGroup` and `removeGroup`, and created with
 * `Wasabi.createGroup`. Connections start with no visibility groups. A
 * connection with zero visibility groups will be sent **all** objects known to
 * its Wasabi instance. If you want to send **no** objects to a connection, add
 * an empty group to it.
 *
 * @class Connection
 *
 * @constructor
 * @param {Wasabi} instance A backreference to the Wasabi instance which owns
 *     this connection. Used for storing and retreiving objects
 * @param {Socket} socket The socket.io socket used to communicate with the
 *     remote host
 * @param {Boolean} ghostFrom Accept ghosted NetObject from this client
 * @param {Boolean} ghostTo Ghost NetObjects to this client
 * @private
 */

function Connection(instance, socket, ghostFrom, ghostTo, scopeCallback) {
    var receiveBitstream = new Bitstream();

    this._instance = instance;

    this._sendBitstream = new Bitstream();
    this._receiveBitstream = receiveBitstream;
    this._socket = socket;
    this._rpcQueue = [];

    this._ghostFrom = ghostFrom || false;
    this._ghostTo = ghostTo || false;

    this._scopeCallback = scopeCallback;
    this._groups = false;
    this._visibleObjects = {};

    this._updateHashes = {};

    // configure socket to dump received data into the receive bitstream
    // currently assumes that it receives a socket.io socket
    socket.onmessage = function (data) {
        receiveBitstream.appendChars(data.data || data);
    };
}

Connection.prototype = {};

/**
 * Add a group to this connection
 * @method addGroup
 * @param {Group} group The group to add
 */
Connection.prototype.addGroup = function (group) {
    this._groups = this._groups || {};
    this._groups[group._id] = group;
};

/**
 * Remove a group from this connection
 * @method removeGroup
 * @param {Group|Number} arg The group or ID to remove
 */
Connection.prototype.removeGroup = function (arg) {
    if (!this._groups) {
        return;
    }

    if (typeof arg === 'number') {
        delete this._groups[arg];
    } else {
        delete this._groups[arg._id];
    }
};

/**
 * Get a collection of all objects in the connection's groups
 * @method getObjectsInGroups
 * @return {Object} A hash of serial numbers -> objects
 */
Connection.prototype.getObjectsInGroups = function () {
    var id;
    var group;
    var serial;
    var obj;
    var result = {};

    // for each group on this connection
    for (id in this._groups) {
        if (this._groups.hasOwnProperty(id)) {
            group = this._groups[id];

            // for each object in that group
            for (serial in group._objects) {
                if (group._objects.hasOwnProperty(serial)) {
                    obj = group._objects[serial];

                    // add the object to the result
                    result[obj.wsbSerialNumber] = obj;
                }
            }
        }
    }
    return result;
};

/**
 * Packs ghosts for needed objects into `bs`
 * @method _packGhosts
 * @private
 * @param {Array} objects An Array or map of objects to pack ghosts for
 * @param {Bitstream} bs The target Bitstream
 */
Connection.prototype._packGhosts = function (objects, bs) {
    var i;
    var obj;
    for (i in objects) {
        if (objects.hasOwnProperty(i)) {
            obj = objects[i];
            this._packGhost(obj, bs);
        }
    }

    bs.writeUInt(WSB_SEPARATOR, 16);
};


/**
 * Unpack all needed ghosts from `bs`
 * @method _unpackGhosts
 * @private
 * @param {Bitstream} bs The source Bitstream
 */
Connection.prototype._unpackGhosts = function (bs) {
    while (bs.peekUInt(16) !== WSB_SEPARATOR) {
        this._unpackGhost(bs);
    }

    // burn off the separator
    bs.readUInt(16);
};

/**
 * Packs data needed to instantiate a replicated version of obj
 * @method _packGhost
 * @param {Object} obj The object to pack
 * @param {BitStream} bs The bitstream to pack into
 * @private
 */
Connection.prototype._packGhost = function (obj, bs) {
    bs.writeUInt(this._instance.registry.hash(obj.constructor), 16);
    bs.writeUInt(obj.wsbSerialNumber, 16);
};

/**
 * Unpacks a newly replicated object from Bitstream
 * @method _unpackGhost
 * @param {Bitstream} bs The target bitstream
 * @private
 */
Connection.prototype._unpackGhost = function (bs) {
    var hash = bs.readUInt(16);
    var T = this._instance.registry.getClass(hash);
    var serial = bs.readUInt(16);
    var obj;
    if (!T) {
        throw new WasabiError('Received ghost for unknown class with hash ' + hash);
    }

    obj = new T();
    obj.wsbInstance = this._instance;
    obj.wsbIsGhost = true;
    obj.wsbJustGhosted = true;
    this._instance.registry.addObject(obj, serial);
    return obj;
};


/**
 * Pack the given list of object update data into bs
 * @method _packUpdates
 * @private
 * @param {Object} list An Array or map of objects to pack updates for
 * @param {Bitstream} bs The target Bitstream
 * @param {Object} discoveredObjects A hash of serial numbers ->
 *     subobject references to update when a subobject is discovered
 */
Connection.prototype._packUpdates = function (list, bs, discoveredObjects) {
    var k;
    for (k in list) {
        if (list.hasOwnProperty(k)) {
            this._packUpdate(list[k], bs, discoveredObjects);
        }
    }

    // because _packUpdates can be called multiple times, no separator
    // is written in the function. It must instead be written during the
    // processConnections call
};

/**
 * Unpack the given list of objects (with update data) from bs
 * @method _unpackUpdates
 * @private
 * @param {Bitstream} bs The source Bitstream
 */
Connection.prototype._unpackUpdates = function (bs) {
    var list = [];
    var obj;
    while (bs.peekUInt(16) !== WSB_SEPARATOR) {
        obj = this._unpackUpdate(bs);
        list.push(obj);
    }

    // burn off the separator
    bs.readUInt(16);

    return list;
};

/**
 * Packs update data for `obj` into `bs`
 * @method _packUpdate
 * @param {Object} obj The object to pack
 * @param {BitStream} bs The bitstream to pack into
 * @param {Object} discoveredObjects A hash of serial numbers ->
 *     subobject references to update when a subobject is discovered
 * @private
 */
Connection.prototype._packUpdate = function (obj, bs, discoveredObjects) {
    var startPos = bs.getPos();
    var hash;

    bs.writeUInt(obj.wsbSerialNumber, 16);
    bs.pack(obj, undefined, discoveredObjects);

    hash = bs.hashBits(startPos);

    if(hash === this._updateHashes[obj.wsbSerialNumber]) {
        // no change in data, so we'll roll back the bit stream to where we began
        bs.rollback(startPos);
    } else {
        // otherwise, save the new hash
        this._updateHashes[obj.wsbSerialNumber] = hash;
    }
};

/**
 * Unpacks update data from `bs`
 * @method _unpackUpdate
 * @param {BitStream} bs The bitstream to unpack from
 * @private
 */
Connection.prototype._unpackUpdate = function (bs) {
    var serial = bs.readUInt(16);
    var obj = this._instance.registry.getObject(serial);
    if (!obj) {
        throw new WasabiError('Received update for unknown object ' + serial);
    }
    bs.unpack(obj, undefined, this._instance);

    /**
     * Fired client-side when a ghost (the remote counterpart) of an
     * object is created. This occurs when the scope callback for this
     * client (on the server) returns an object when it did not
     * previously.
     *
     * The `obj` will be a newly created instance of the class every
     * time this event is emitted, even when subsequent emissions refer
     * to the same server-side instance. That is, Wasabi created a brand
     * new object every time it creates a ghost.
     *
     * This event is emitted only after the data has received its
     * initial data.
     *
     * Note that this event can be emitted multiple times per object, if
     * object comes in and out of scope.
     *
     * @event clientGhostCreate
     * @param {Object} obj The newly created ghost
     */
    if (obj.wsbJustGhosted) {
        this._instance.emit('clientGhostCreate', obj);
        delete obj.wsbJustGhosted;
    }
    return obj;
};

/**
 * Pack all RPC invocations in the specified `Connection`'s queue.
 * @method _packRpcs
 * @private
 * @param {Connection} conn The connection to pack RPC invocations for
 * @param {Bitstream} bs The target Bitstream
 * @param {Object} discoveredObjects A hash of serial numbers ->
 *     subobject references to update when a subobject is discovered
 */
Connection.prototype._packRpcs = function (bs, discoveredObjects) {
    var i;
    var invocation;
    for (i = 0; i < this._rpcQueue.length; i++) {
        invocation = this._rpcQueue[i];
        this._packRpc(invocation.rpc, invocation.args, invocation.obj, bs, discoveredObjects);
    }

    // write a separator
    bs.writeUInt(WSB_SEPARATOR, 16);
};

/**
 * Unpack RPC invocations from bs
 * @method _unpackRpcs
 * @private
 * @param {Bitstream} bs The target Bitstream
 */
Connection.prototype._unpackRpcs = function (bs) {
    while (bs.peekUInt(16) !== WSB_SEPARATOR) {
        this._unpackRpc(bs);
    }

    // burn off the separator
    bs.readUInt(16);
};

/**
 * Pack a call to a registered RP and the supplied arguments into bs
 * @method _packRpc
 * @private
 * @param {Rpc} rpc The RPC to pack
 * @param {Array} args The arguments to be serialized into this
 *     invocation
 * @param {NetObject} obj The NetObject to apply the RPC to (or falsy
 *     for "static" RPC invocation
 * @param {Bitstream} bs The target Bitstream
 * @param {Object} discoveredObjects A hash of serial numbers ->
 *     subobject references to update when a subobject is discovered
 */
Connection.prototype._packRpc = function (rpc, args, obj, bs, discoveredObjects) {
    rpc._populateKeys(args);
    bs.writeUInt(obj ? obj.wsbSerialNumber : 0, 16);
    bs.writeUInt(this._instance.registry.hash(rpc._klass, rpc._fn), 16);
    args.serialize = rpc._serialize;
    bs.pack(args, undefined, discoveredObjects);
};

/**
 * Unpack and execute a call to a registered RP using the supplied
 * arguments from bs
 * @method _unpackRpc
 * @private
 * @param {Bitstream} bs The source Bitstream
 */
Connection.prototype._unpackRpc = function (bs) {
    var serialNumber = bs.readUInt(16);
    var hash = bs.readUInt(16);
    var obj = this._instance.registry.getObject(serialNumber);
    var rpc;
    var args;

    // look up the Rpc by the hash
    rpc = this._instance.registry.getRpc(hash);
    if (!rpc) {
        throw new WasabiError('Unknown RPC with hash ' + hash);
    }

    // unpack the arguments
    args = [];
    args.serialize = rpc._serialize;
    bs.unpack(args, undefined, this._instance);
    rpc._populateIndexes(args);

    // add the connection this invocation was received through to the
    // argument list
    args.push(this);

    if (serialNumber && !obj) {
        // a serial number was specified, but the object wasn't found
        // this can happen in normal operation if a server removes an
        // object in the same frame that a client calls an RPC on it
        return;
    }

    // invoke the real function
    rpc._fn.apply(obj, args);
};

/**
 * Packs removed ghosts for `objects` into `bs`
 * @method _packRemovedGhosts
 * @private
 * @param {Object} objects An Array or map of objects to remove
 * @param {Bitstream} bs The target Bitstream
 */
Connection.prototype._packRemovedGhosts = function (objects, bs) {
    var k;
    var obj;
    for (k in objects) {
        if (objects.hasOwnProperty(k)) {
            obj = objects[k];
            bs.writeUInt(obj.wsbSerialNumber, 16);
        }
    }

    bs.writeUInt(WSB_SEPARATOR, 16);
};

/**
 * Unpack all removed ghosts from bs. An object with its ghost unpacked
 * in this way will be removed from the local Wasabi's registry
 * @method _unpackRemovedGhosts
 * @private
 * @param {Bitstream} bs The source Bitstream
 */
Connection.prototype._unpackRemovedGhosts = function (bs) {
    var serial;
    var obj;
    while (bs.peekUInt(16) !== WSB_SEPARATOR) {
        serial = bs.readUInt(16);
        obj = this._instance.registry.getObject(serial);


        /**
         * Fired client-side when a ghost (the remote counterpart) of an
         * object is about to be destroyed. This occurs when the scope
         * callback for this client (on the server) does not return the
         * object after it did previously.
         *
         * Although Wasabi can not acutally "destroy" the object (since
         * JavaScript has no destructors), the particular instance will
         * never be referred to be Wasabi again.
         *
         * Note that this event can be emitted multiple times per
         * object, if object comes in and out of scope.
         *
         * @event clientGhostDestroy
         * @param {Object} obj The ghost which is about to be destroyed
         */
        this._instance.emit('clientGhostDestroy', obj);

        this._instance.removeObject(serial);
    }

    // burn off the separator
    bs.readUInt(16);
};

/**
 * Receive, process, and transmit data
 * @method process
 * @private
 */
Connection.prototype.process = function () {
    var k;
    var data;
    var newObjects;
    var newlyVisibleObjects;
    var newlyInvisibleObjects;
    var oldObjects;
    var discoveredObjects;
    var section;
    var updateStream;
    var rpcStream;
    var ghostStream;
    var ghostRemovalStream;
    var subobjects;

    // connections with ghostTo set (i.e. clients)
    if (this._ghostTo) {

        // get list of objects which are visible this frame
        if (this._groups) {
            // use visibility groups if there is a list of them
            newObjects = this.getObjectsInGroups();
        } else if (this._scopeCallback) {
            // otherwise look for a scope callback
            newObjects = this._scopeCallback();
        } else {
            // if neither is set, default to sending all objects
            newObjects = this._instance._getAllObjects();
        }

        /**
         * Because objects can contain references to other managed
         * objects, we must add these subobjects to the list of visible
         * objects to ensure that a ghost is available on the remote end
         * during unpacking.
         *
         * Additionally, RPC invocations can contain references, so they
         * must be traversed as well.
         *
         * Once we have an initial list of *discovered* objects, we must
         * descend in to that set, to see if it contains more
         * references. We repeat this process on each set of discovered
         * objects until no more objects are discovered.
         *
         * Cyclical references are handled by using newObjects as a
         * history of objects which already have ghosts packed.
         */

        ghostStream = new Bitstream();
        updateStream = new Bitstream();
        rpcStream = new Bitstream();
        ghostRemovalStream = new Bitstream();

        // pack RPC invocations, put discovered subobjects into the
        // newObjects list to ensure that a ghost is available
        this._packRpcs(rpcStream, newObjects);
        this._rpcQueue = [];

        discoveredObjects = newObjects;
        while (!_isEmpty(discoveredObjects)) {
            subobjects = {};
            // pack updates for all objects that were just discovered
            this._packUpdates(discoveredObjects, updateStream, subobjects);

            // ignore known objects and create ghosts for objects as needed
            for (k in subobjects) {
                if (subobjects.hasOwnProperty(k)) {
                    if (newObjects.hasOwnProperty(k)) {
                        // when k exists in both, the object has already
                        // been discovered previously
                        delete subobjects[k];
                    } else {
                        // otherwise, it was just discovered in the last
                        // pass, so it must be added to newObjects to
                        // ensure that a ghost exists on the remote end
                        newObjects[k] = subobjects[k];
                    }
                }
            }

            discoveredObjects = subobjects;
        }
        updateStream.writeUInt(WSB_SEPARATOR, 16);
        updateStream.trim();

        // list of objects which were visible last frame
        oldObjects = this._visibleObjects;

        // an object in newObjects, but not in oldObjects must be newly
        // visible this frame
        newlyVisibleObjects = {};
        for (k in newObjects) {
            if (newObjects.hasOwnProperty(k) && oldObjects[k] === undefined) {
                newlyVisibleObjects[k] = newObjects[k];
            }
        }
        // an object in oldObjects, but not in newObjects must be newly
        // invisible this frame
        newlyInvisibleObjects = {};
        for (k in oldObjects) {
            if (oldObjects.hasOwnProperty(k) && newObjects[k] === undefined) {
                newlyInvisibleObjects[k] = oldObjects[k];
            }
        }

        // pack ghosts for newly visible objects
        this._packGhosts(newlyVisibleObjects, ghostStream);

        // pack ghost removals for newly invisible objects
        this._packRemovedGhosts(newlyInvisibleObjects, ghostRemovalStream);

        this._sendBitstream.writeUInt(WSB_SECTION_GHOSTS, 16);
        this._sendBitstream.append(ghostStream);

        this._sendBitstream.writeUInt(WSB_SECTION_UPDATES, 16);
        this._sendBitstream.append(updateStream);

        this._sendBitstream.writeUInt(WSB_SECTION_RPC, 16);
        this._sendBitstream.append(rpcStream);

        this._sendBitstream.writeUInt(WSB_SECTION_REMOVED_GHOSTS, 16);
        this._sendBitstream.append(ghostRemovalStream);

        // set the connection's visible object collection
        this._visibleObjects = newObjects;

    } else {

        // pack just the RPC invocations if we don't ghost to this connection
        rpcStream = new Bitstream();
        this._packRpcs(rpcStream);

        this._sendBitstream.writeUInt(WSB_SECTION_RPC, 16);
        this._sendBitstream.append(rpcStream);

        this._rpcQueue = [];
    }


    // write a packet terminator
    this._sendBitstream.writeUInt(WSB_PACKET_STOP, 16);

    // now we'll process the incoming data on this connection
    this._receiveBitstream._index = 0;

    /**
     * Fired before Wasabi processes incoming data. Useful for
     * measuring data transmission statistics.
     *
     * Note that this event fires during `processConnections`, and is
     * not meant to replace the `onmessage` handler for typical
     * WebSockets or socket.io sockets.
     *
     * @event receive
     * @param {Connection} conn The connection being processed
     * @param {String} data The data being received over the connection
     */
    this._instance.emit('receive', this, this._receiveBitstream.toChars());
    while (this._receiveBitstream.bitsLeft() > 0) {
        section = this._receiveBitstream.readUInt(16);
        if (section !== WSB_PACKET_STOP) {
            // invoke the appropriate unpack function via the
            // _sectionMap
            this._receiveBitstream.align();
            Connection._sectionMap[section].call(this, this._receiveBitstream);
        }

        this._receiveBitstream.align();
    }

    /**
     * Fired before Wasabi sends data over a connection. Useful for
     * measuring data transmission statistics.
     *
     * @event send
     * @param {Connection} conn The connection being processed
     * @param {String} data The data being sent over the connection
     */
    data = this._sendBitstream.toChars();
    this._instance.emit('send', this, data);
    try {
        // send the actual data
        this._socket.send(data);
    } catch (e) {

        /**
         * Fired when Wasabi receives an error while sending data over a
         * connection. Note that Wasabi will remove the connection from
         * its list of clients and servers immediately after emitting
         * this event.
         *
         * An event is used in order to give user code a chance to react
         * to the error without interupting the processing of other
         * connections within the same `processConnections` call.
         *
         * @event sendError
         * @param {Connection} conn The connection which generated the
         *     error.
         * @param {Error} e The original error
         */
        this._instance.emit('sendError', this, e);
        this._instance.removeClient(this._socket);
        this._instance.removeServer(this._socket);
    }

    // clear the bit streams
    this._sendBitstream.empty();
    this._receiveBitstream.empty();
};


// a simple section marker -> method map
Connection._sectionMap = {};
Connection._sectionMap[WSB_SECTION_GHOSTS] = Connection.prototype._unpackGhosts;
Connection._sectionMap[WSB_SECTION_REMOVED_GHOSTS] = Connection.prototype._unpackRemovedGhosts;
Connection._sectionMap[WSB_SECTION_UPDATES] = Connection.prototype._unpackUpdates;
Connection._sectionMap[WSB_SECTION_RPC] = Connection.prototype._unpackRpcs;

module.exports = Connection;
var Bitstream = require('./bitstream');

/**
 * Represents a connection to another Wasabi instance.
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
 * @param {Socket} socket The socket.io socket used to communicate with the
 *     remote host
 * @param {Boolean} ghostFrom Accept ghosted NetObject from this client
 * @param {Boolean} ghostTo Ghost NetObjects to this client
 * @private
 */

function Connection(socket, ghostFrom, ghostTo, scopeCallback) {
    var receiveBitstream = new Bitstream();

    this._sendBitstream = new Bitstream();
    this._receiveBitstream = receiveBitstream;
    this._socket = socket;
    this._rpcQueue = [];

    this._ghostFrom = ghostFrom || false;
    this._ghostTo = ghostTo || false;

    this._scopeCallback = scopeCallback;
    this._groups = [];
    this._visibleObjects = {};

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
    this._groups.push(group);
};

/**
 * Remove a group from this connection
 * @method removeGroup
 * @param {Group|Number} group The group or index to remove
 */
Connection.prototype.removeGroup = function (group) {
    var i;
    for (i = this._groups.length - 1; i >= 0; i--) {
        if (group === i || this._groups[i] === group) {
            this._groups.splice(i, 1);
        }
    }
};

/**
 * Get a collection of all objects in the connection's groups
 * @method getObjectsInGroups
 * @return {Object} A hash of serial numbers -> objects
 */
Connection.prototype.getObjectsInGroups = function () {
    var i;
    var j;
    var obj;
    var result = {};
    for (i = 0; i < this._groups.length; i++) {
        for (j = 0; j < this._groups[i]._objects.length; j++) {
            obj = this._groups[i]._objects[j];
            result[obj.wsbSerialNumber] = obj;
        }
    }
    return result;
};

module.exports = Connection;
var Bitstream = require('./bitstream');

/**
 * Represents a connection to another Wasabi instance
 * @class Connection
 * @constructor
 * @param {Socket} socket The socket.io socket used to communicate with
 * the remote host
 * @param {Boolean} ghostFrom Accept ghosted NetObject from this client
 * @param {Boolean} ghostTo Ghost NetObjects to this client
 * @param {Function} scopeCallback The function to call in order
 * to determine which local objects are in scope for this client.
 * This function takes no parameters and should return an Array
 * of NetObjects in scope.
 */
function Connection(socket, ghostFrom, ghostTo, scopeCallback) {
    var receiveBitstream = new Bitstream();

    this._socket = socket;
    this._rpcQueue = [];
    this._sendBitstream = new Bitstream();
    this._receiveBitstream = receiveBitstream;
    this._scopeObjects = {};
    this._scopeCallback = scopeCallback || false;
    this._ghostFrom = ghostFrom || false;
    this._ghostTo = ghostTo || false;

    // configure socket to dump received data into the receive bitstream
    // currently assumes that it receives a socket.io socket
    socket.onmessage = function(data) {
        receiveBitstream.appendChars(data.data || data);
    };
}

Connection.prototype = {
};

module.exports = Connection;

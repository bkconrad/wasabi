var Bitstream = require('./bitstream');

function Connection(socket, ghostFrom, ghostTo, scopeCallback) {
    var receiveBitstream = new Bitstream();

    this._socket = socket;
    this._sendBitstream = new Bitstream();
    this._receiveBitstream = receiveBitstream;
    this._scopeObjects = {};
    this._scopeCallback = scopeCallback || function() {
        throw "You MUST define a scope callback function which takes no arguments and returns a map of serial numbers to objects in scope";
    };
    this._ghostFrom = ghostFrom || false;
    this._ghostTo = ghostTo || false;

    // configure socket to dump received data into the receive bitstream
    // currently assumes that it receives a socket.io socket
    socket.on('message', function(data) {
        receiveBitstream.appendChars(data);
    });
}

Connection.prototype = {
};

module.exports = Connection;

var Bitstream = require('./bitstream');
function Connection(socket) {
    var receiveBitstream = new Bitstream();

    this._socket = socket;
    this._sendBitstream = new Bitstream();
    this._receiveBitstream = receiveBitstream;

    // configure socket to dump received data into the receive bitstream
    // currently assumes that it receives a socket.io socket
    socket.on('message', function(data) {
        receiveBitstream.appendChars(data);
    });
}

Connection.prototype = {
};

module.exports = Connection;

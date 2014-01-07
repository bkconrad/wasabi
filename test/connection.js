var Wasabi = require('../src/wasabi'),
    assert = require('chai').assert,
    MockSocket = require('./mock_socket'),
    MockWasabi = require('./mock_wasabi');

describe("Connection", function () {
    // Create some mock sockets to attach the connections to
    var clientSocket = new MockSocket();
    var serverSocket = new MockSocket();
    var serverConn = new Wasabi.Connection(false, serverSocket, false, true);
    var clientConn = new Wasabi.Connection(false, clientSocket, true, false);

    // link the mock sockets to each other
    clientSocket.link(serverSocket);

    it("receives bytes to a buffer until they're ready to read", function () {
        serverConn._sendBitstream.writeUInt(1234, 16);
        serverConn._sendBitstream.writeUInt(4321, 16);

        // simulate socket transmission
        serverSocket.send(serverConn._sendBitstream.toChars());

        assert.ok(serverConn._sendBitstream.equals(clientConn._receiveBitstream));
    });

    it('tolerates removeGroup called before any groups have been assigned', function () {
        clientConn.removeGroup(1);
    });
});
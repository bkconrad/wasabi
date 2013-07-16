var Wasabi = require(__dirname + '/..' + (process.env.COVERAGE ? '/src-cov' : '/src') + '/wasabi')
  , assert = require('chai').assert
  , MockSocket = require('./mock_socket')
  , MockWasabi = require('./mock_wasabi')
  ;

describe("Connection", function() {
    // Create some mock sockets to attach the connections to
    var clientSocket = new MockSocket();
    var serverSocket = new MockSocket();
    // link the mock sockets to each other
    clientSocket.link(serverSocket);

    serverConn = new Wasabi.Connection(serverSocket, false, true);
    clientConn = new Wasabi.Connection(clientSocket, true, false);

    it("receives bytes to a buffer until they're ready to read", function() {
        var tempStream = new Wasabi.Bitstream();
        tempStream.writeUInt(1234, 16);
        tempStream.writeUInt(4321, 16);

        // simulate socket transmission
        serverSocket.send(tempStream.toChars());

        assert.ok(tempStream.equals(clientConn._receiveBitstream));
    });

    it("keeps a list of objects in scope (?)");

    it("has a receive and send bitstream");
    it("has a receive and send bitstream");
});

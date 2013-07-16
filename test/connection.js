var Wasabi = require(__dirname + '/..' + (process.env.COVERAGE ? '/src-cov' : '/src') + '/wasabi')
  , assert = require('chai').assert
  , MockSocket = require('./mock_socket')
  ;

describe("Connection", function() {
    var clientSocket = new MockSocket();
    var serverSocket = new MockSocket();
    clientSocket.link(serverSocket);

    serverConn = new Wasabi.Connection(serverSocket);
    clientConn = new Wasabi.Connection(clientSocket);

    it("receives bytes to a buffer until they're ready to read", function() {
        var tempStream = new Wasabi.Bitstream();
        tempStream.writeUInt(1234, 16);
        tempStream.writeUInt(4321, 16);

        // simulate socket transmission
        serverSocket.send(tempStream.toChars());

        assert.ok(tempStream.equals(clientConn._receiveBitstream));
    });

    it("keeps a list of objects in scope");
    it("has a receive and send bitstream");
    it("handles all communication in a process() method");
});

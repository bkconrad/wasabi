var MockWasabi = require('../test/mock_wasabi.js');
var MockSocket = require('../test/mock_socket.js');
var Benchmark = require('benchmark');
var suite = new Benchmark.Suite();

function makeBenchmark(numClients, numObjects) {

    var ws, wc, server, client;
    var clients = [];
    var i;
    ws = MockWasabi.make();

    for(i = 0; i < numClients; i++) {
        wc = MockWasabi.make();

        // link between server and client
        server = new MockSocket();
        client = new MockSocket();
        server.link(client);

        // attach connections
        ws.addClient(client);
        wc.addServer(server);

        clients.push(wc);
    }

    for(i = 0; i < numObjects; i++) {
        ws.addObject(new MockWasabi.Foo());
    }

    return function() {
        var i;
        ws.processConnections();
        for(i = 0; i < clients.length; i++) {
            clients[i].processConnections();
        }
    }
}

suite
.add('One connection, 1000 objects', makeBenchmark(1, 1000))
.add('Ten connections, 100 objects', makeBenchmark(10, 100))
.add('100 connections, ten objects', makeBenchmark(100, 10))
.add('Ten connections, ten objects', makeBenchmark(10, 10))

.on('cycle', function(event) {
  console.log(String(event.target));
})

.run();

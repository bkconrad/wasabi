var MockWasabi = require('../test/mock_wasabi.js')
  , WebSocket = require('ws')
  , Fiber = require('fibers')
  , pcap = require('pcap');
  ;

// config stuff
var benchPort = 31337
  , numClients = 1
  , numObjects = 100
  , numIterations = 1000
  ;

// script vars
var ws = MockWasabi.make()
  , wc
  , gOpenSockets = []
  , readyClients = 0
  , readyServers = 0
  , clients = []
  , tcp_tracker
  , pcap_session
  ;


try {
    tcp_tracker = new pcap.TCP_tracker(),
    pcap_session = pcap.createSession('lo', "ip proto \\tcp");
} catch(e) {
    console.log(e.toString());
    console.log('You probably need to run as root');
    process.exit(1);
}

tcp_tracker.on('start', function (session) {
    console.log("Start of TCP session between " + session.src_name + " and " + session.dst_name);
});

// convert an integer number of bytes into kB rounded to two decimal places
function kb(bytes) {
    return Math.floor(bytes / 10) / 100;
}

tcp_tracker.on('end', function (session) {
    console.log("End of TCP session between " + session.src_name + " and " + session.dst_name);
    var send_total = kb(session.send_bytes_ip + session.send_bytes_tcp + session.send_bytes_payload);
    var send_payload = kb(session.send_bytes_payload); 
    var send_rate = kb((session.send_bytes_ip + session.send_bytes_tcp + session.send_bytes_payload) / numIterations * 15);
    var recv_total = kb(session.recv_bytes_ip + session.recv_bytes_tcp + session.recv_bytes_payload);
    var recv_payload = kb(session.recv_bytes_payload); 
    var recv_rate = kb((session.recv_bytes_ip + session.recv_bytes_tcp + session.recv_bytes_payload) / numIterations * 15);
    console.log('client -> server: ' + send_payload + "kB (" + send_total + 'kB with transport)');
    console.log(send_rate + 'kB/s at 15hz');
    console.log('server -> client: ' + recv_payload + "kB (" + recv_total + 'kB with transport)');
    console.log(recv_rate + 'kB/s at 15hz');
    console.log();
    process.exit(0);
});

pcap_session.on('packet', function (raw_packet) {
    var packet = pcap.decode.packet(raw_packet);
    tcp_tracker.track_packet(packet);
});

var webSockServ = new WebSocket.Server({port:benchPort}, function() {
    var i;
    for(i = 0; i < numClients; i++) {
        wc = MockWasabi.make();
        var serverSock = new WebSocket('ws://localhost:' + benchPort);
        serverSock.onopen = function() {
            gOpenSockets.push(this);
            readyClients++;
            checkReady();
        };
        wc.addServer(serverSock);
        clients.push(wc);
    }

    for(i = 0; i < numObjects; i++) {
        ws.addObject(new MockWasabi.Foo());
    }

});

webSockServ.on('connection', function(clientSock) {
    ws.addClient(clientSock);
    readyServers++;
    gOpenSockets.push(clientSock);
    checkReady();
});

function checkReady() {
    if (readyClients < numClients || readyServers < numClients) {
        return;
    }

    console.log(numClients + ' clients with ' + numObjects + ' objects for ' + numIterations + ' iterations');

    // processConnections has to run in a polite fiber so that node can
    // poll the sockets after each cycle
    var fiber = Fiber(function() {
        var i, j;
        for(i = 0; i < numIterations; i++) {
            ws.processConnections();
            for(j = 0; j < clients.length; j++) {
                clients[j].processConnections();
            }
            setTimeout(function() { fiber.run(); }, 0);
            Fiber.yield();
        }

        for(i = 0; i < gOpenSockets.length; i++) {
            gOpenSockets[i].close();
            setTimeout(function() { fiber.run(); }, 0);
            Fiber.yield();
        }
    });
    fiber.run();
}

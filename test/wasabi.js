var Wasabi = require(__dirname + '/..' + (process.env.COVERAGE ? '/src-cov' : '/src') + '/wasabi')
  , assert = require('chai').assert
  , WebSocket = require('ws')
  , MockSocket = require('./mock_socket.js')
  , MockWasabi = require('./mock_wasabi.js')
  ;

describe('Wasabi', function () {
    var ws, wc1, wc2, server1, client1, server2, client2, bs, foo1;

    beforeEach(function() {

        // a simple bitstream
        bs = new Wasabi.Bitstream;

        // a server and two linked clients
        ws = MockWasabi.make();
        wc1 = MockWasabi.make();
        wc2 = MockWasabi.make();

        // link between server and first client
        server1 = new MockSocket();
        client1 = new MockSocket();
        server1.link(client1);

        // link between server and second client
        server2 = new MockSocket();
        client2 = new MockSocket();
        server2.link(client2);

        // attach connections
        ws.addClient(client1);
        ws.addClient(client2);
        wc1.addServer(server1);
        wc2.addServer(server2);

        // create some stock objects
        foo1 = new MockWasabi.Foo();
        foo2 = new MockWasabi.Foo();
    });

    it('packs and unpacks ghost data', function () {
        var objList = [foo1, foo2];
        var i;
        for (i = 0; i < objList.length; i++) {
            ws._packGhost(objList[i], bs);
        }
        bs.writeUInt(0, 16);
        bs._index = 0;

        var newList = [];
        var obj;
        while (bs.peekUInt(16) !== 0) {
            obj = wc1._unpackGhost(bs);
            newList.push(obj);
        }

        assert.notEqual(0, newList.length);
        for (var i = 0; i < newList.length; i++) {
            assert.equal(newList[i].constructor, objList[i].constructor);
            newList[i].check(objList[i]);
        }
    });

    it('orchestrates packing/unpacking data automatically in an update function', function() {
        var i, hash, bs = new Wasabi.Bitstream;

        var foo = new MockWasabi.Foo;
        ws.addObject(foo);

        ws._packGhost(foo, bs);
        ws._packUpdates([foo], bs);
        bs._index = 0;
        wc1._unpackGhost(bs);
        wc1._unpackUpdates(bs);
        assert.ok(wc1.registry.objects[foo.wabiSerialNumber]);
    });

    it('packs and unpacks properly to out-of-sync registries', function () {
        var i, hash, bs = new Wasabi.Bitstream;
        ws.registry.nextSerialNumber += 1;

        var foo = new MockWasabi.Foo;
        ws.addObject(foo);

        ws._packGhost(foo, bs);
        bs._index = 0;
        wc1._unpackGhost(bs);
        assert.ok(wc1.registry.objects[foo.wabiSerialNumber]);
    });

    it('calls RPCs on an associated netobject', function () {
        ws.addObject(foo1);
        foo1.rpcTest({val: 1337});

        ws.processConnections();
        wc1.processConnections();

        assert.ok(wc1.registry.objects[foo1.wabiSerialNumber]);
        assert.equal(wc1.registry.objects[foo1.wabiSerialNumber].testval, 1337);
    });

    it('passes a connection object to RPC invocations', function (done) {
        function ConnectionAsserter() {
        }

        ConnectionAsserter.prototype = {
            serialize: function () { }
          , constructor: ConnectionAsserter
          , rpcAssertConnection: function(args, conn) {
                assert.strictEqual(conn, wc1.servers[0]);
                done();
            }
          , rpcAssertConnectionArgs: function(desc) {
            }
        };

        ws.addClass(ConnectionAsserter);
        wc1.addClass(ConnectionAsserter);
        
        var obj = new ConnectionAsserter();

        ws.addObject(obj);

        ws.processConnections();
        wc1.processConnections();

        obj.rpcAssertConnection({});

        ws.processConnections();
        wc1.processConnections();

        assert.ok(wc1.registry.objects[obj.wabiSerialNumber]);
    });

    it('automatically manages ghosting and updates', function() {
        var sent = false
          , received = false;

        foo1.foobar = 1337;
        ws.addObject(foo1);

        ws.processConnections();
        wc1.processConnections();

        assert.ok(wc1.registry.objects[foo1.wabiSerialNumber]);
        assert.equal(foo1.foobar, wc1.registry.objects[foo1.wabiSerialNumber].foobar);
        assert.equal(ws.registry.objects.length, wc1.registry.objects.length);

        foo2.foobar = 1234;
        ws.addObject(foo2);

        ws.processConnections();
        wc1.processConnections();

        assert.ok(wc1.registry.objects[foo2.wabiSerialNumber]);
        assert.equal(foo2.foobar, wc1.registry.objects[foo2.wabiSerialNumber].foobar);
        assert.equal(ws.registry.objects.length, wc1.registry.objects.length);
    });

    it('can handle multiple foreign processConnection calls with a single local processConnection', function() {
        foo1.foobar = 1337;
        ws.addObject(foo1);
        ws.processConnections();

        foo2.foobar = 1234;
        ws.addObject(foo2);
        ws.processConnections();

        wc1.processConnections();

        assert.ok(wc1.registry.objects[foo1.wabiSerialNumber]);
        assert.equal(foo1.foobar, wc1.registry.objects[foo1.wabiSerialNumber].foobar);
        assert.equal(ws.registry.objects.length, wc1.registry.objects.length);

        assert.ok(wc1.registry.objects[foo2.wabiSerialNumber]);
        assert.equal(foo2.foobar, wc1.registry.objects[foo2.wabiSerialNumber].foobar);
        assert.equal(ws.registry.objects.length, wc1.registry.objects.length);
    });

    it('calls static RPCs without any associated object', function(done) {
        var fn = function(args, conn) {
            assert.equal(conn, wc1.servers[0]);
            done();
        }

        var rpcTest = ws.mkRpc(fn);
        wc1.mkRpc(fn);

        rpcTest();

        ws.processConnections();
        wc1.processConnections();
    });

    it('emits RPC invocations to a set of specified connections', function() {
        var count = 0;
        function TestClass() { }
        TestClass.prototype = {
            constructor: TestClass
          , rpcTest: function rpcTest(args, conn) {
                assert.equal(conn, wc1.servers[0]);
                count++;
            }
          , rpcTestArgs: function() { }
          , rpcTestTwo: function rpcTestTwo(args, conn) {
                throw new Error('Should never be called');
            }
          , rpcTestTwoArgs: function() { }
          , serialize: function() { }
        }

        ws.addClass(TestClass);
        wc1.addClass(TestClass);
        wc2.addClass(TestClass);

        var test = new TestClass();
        ws.addObject(test);
        test.rpcTest(false, ws.clients[0]);

        ws.processConnections();
        wc1.processConnections();
        wc2.processConnections();

        assert.equal(count, 1);
    });

    it('does not choke on an empty receive bitstream', function() {
        wc1.processConnections();
    });

    it('returns the new connection when adding a client', function() {
        var sock = new MockSocket();
        var result = ws.addClient(sock);
        assert.ok(result);
        assert.equal(result, ws.clients.pop());
    });

    it('returns the new connection when adding a server', function() {
        var sock = new MockSocket();
        var result = wc1.addServer(sock);
        assert.ok(result);
        assert.equal(result, wc1.servers.pop());
    });

    it('complains when receiving update data for an unknown object');
    it('complains when receiving ghost data for an unknown class');
    it('complains when receiving a call to an unknown RPC');
    it('complains when receiving invalid arguments a known RPC');
    it('complains when ghosting to a connection without a scope callback');
    it('queries a callback to determine which netobjects to ghost');
    it('triggers callbacks when ghosts are added', function() {
        var done = false;
        function GhostAddTest() {
        }

        GhostAddTest.prototype = {
              serialize: function() { }
            , onAddGhost: function() { done = true; }
        };

        ws.addClass(GhostAddTest);
        wc1.addClass(GhostAddTest);

        var obj = new GhostAddTest();
        ws.addObject(obj);

        ws.processConnections();
        wc1.processConnections();

        assert.ok(done);
    });
    it('triggers callbacks when ghosts are removed');
});

var Wasabi = require(__dirname + '/..' + (process.env.COVERAGE ? '/src-cov' : '/src') + '/wasabi')
  , assert = require('chai').assert
  , WebSocket = require('ws')
  , MockSocket = require('./mock_socket.js')
  , MockWasabi = require('./mock_wasabi.js')
  ;

describe('Wasabi', function () {
    var w = MockWasabi.make();
    var w2 = MockWasabi.make();
    var Foo = MockWasabi.Foo;
    var Bar = MockWasabi.Bar;

    var foo1 = new Foo, foo2 = new Foo, bar1 = new Bar, bar2 = new Bar;
    var objList = [foo1, bar1, foo2, bar2];

    for (var i = 0; i < objList.length; i++) {
        w.addObject(objList[i]);
    }

    it('packs and unpacks ghost data', function () {
        var bs = new Wasabi.Bitstream;
        var i;
        for (i = 0; i < objList.length; i++) {
            w.packGhost(objList[i], bs);
        }
        bs.writeUInt(0, 16);
        bs._index = 0;

        var newList = [];
        var obj;
        while (bs.peekUInt(16) !== 0) {
            obj = w2.unpackGhost(bs);
            newList.push(obj);
        }

        assert.notEqual(0, newList.length);
        for (var i = 0; i < newList.length; i++) {
            assert.equal(newList[i].constructor, objList[i].constructor);
            newList[i].check(objList[i]);
        }
    });

    it('packs and unpacks updates for lists of objects', function () {
        var bs = new Wasabi.Bitstream;
        w.packUpdates(objList, bs);
        bs._index = 0;
        var newList = w2.unpackUpdates(bs);

        assert.notEqual(0, newList.length);
        for (var i = 0; i < newList.length; i++) {
            assert.equal(newList[i].constructor, objList[i].constructor);
            newList[i].check(objList[i]);
        }
    });

    it('orchestrates packing/unpacking data automatically in an update function', function() {
        var i, hash, bs = new Wasabi.Bitstream;

        var foo = new Foo;
        w.addObject(foo);

        w.packGhost(foo, bs);
        w.packUpdates([foo], bs);
        bs._index = 0;
        w2.unpackGhost(bs);
        w2.unpackUpdates(bs);
        assert.ok(w2.registry.objects[foo.wabiSerialNumber]);
    });

    it('packs and unpacks properly to out-of-sync registries', function () {
        var i, hash, bs = new Wasabi.Bitstream;
        w.registry.nextSerialNumber += 1;

        var foo = new Foo;
        w.addObject(foo);

        w.packGhost(foo, bs);
        bs._index = 0;
        w2.unpackGhost(bs);
        assert.ok(w2.registry.objects[foo.wabiSerialNumber]);
    });

    it('calls RPCs on an associated netobject', function () {
        var w = MockWasabi.make();
        var w2 = MockWasabi.make();
        var server = new MockSocket();
        var client = new MockSocket();
        var foo = new Foo();
        server.link(client);

        w.addClient(client, function() {
            var result = { };
            var k;
            for (k in w.registry.objects) {
                result[k] = w.registry.objects[k];
            }
            return result;
        });

        w2.addServer(server);
        w.addObject(foo);

        w.processConnections();
        w2.processConnections();

        foo.rpcTest({val: 1337});

        w.processConnections();
        w2.processConnections();

        assert.ok(w2.registry.objects[foo.wabiSerialNumber]);
        assert.equal(w2.registry.objects[foo.wabiSerialNumber].testval, 1337);
    });

    it('passes a connection object to RPC invocations', function (done) {
        var w = MockWasabi.make();
        var w2 = MockWasabi.make();
        var server = new MockSocket();
        var client = new MockSocket();
        server.link(client);


        w2.addServer(server);
        w.addClient(client, function() {
            var result = { };
            var k;
            for (k in w.registry.objects) {
                result[k] = w.registry.objects[k];
            }
            return result;
        });

        function ConnectionAsserter() {
        }

        ConnectionAsserter.prototype = {
            serialize: function () { }
          , constructor: ConnectionAsserter
          , rpcAssertConnection: function(args, conn) {
                assert.strictEqual(conn, w2.servers[0]);
                done();
            }
          , rpcAssertConnectionArgs: function(desc) {
            }
        };

        w.addClass(ConnectionAsserter);
        w2.addClass(ConnectionAsserter);
        
        var obj = new ConnectionAsserter();

        w.addObject(obj);

        w.processConnections();
        w2.processConnections();

        obj.rpcAssertConnection({});

        w.processConnections();
        w2.processConnections();

        assert.ok(w2.registry.objects[obj.wabiSerialNumber]);
    });

    it('automatically manages ghosting and updates', function() {
        var sent = false
          , received = false;

        var w = MockWasabi.make();
        var w2 = MockWasabi.make();
        var server = new MockSocket();
        var client = new MockSocket();
        server.link(client);

        w.addClient(client, function() {
            var result = { };
            var k;
            for (k in w.registry.objects) {
                result[k] = w.registry.objects[k];
            }
            return result;
        });

        w2.addServer(server);

        foo1.foobar = 1337;
        w.addObject(foo1);

        w.processConnections();
        w2.processConnections();

        assert.ok(w2.registry.objects[foo1.wabiSerialNumber]);
        assert.equal(foo1.foobar, w2.registry.objects[foo1.wabiSerialNumber].foobar);
        assert.equal(w.registry.objects.length, w2.registry.objects.length);

        foo2.foobar = 1234;
        w.addObject(foo2);

        w.processConnections();
        w2.processConnections();

        assert.ok(w2.registry.objects[foo2.wabiSerialNumber]);
        assert.equal(foo2.foobar, w2.registry.objects[foo2.wabiSerialNumber].foobar);
        assert.equal(w.registry.objects.length, w2.registry.objects.length);
    });

    it('can handle multiple foreign processConnection calls with a single local processConnection', function() {
        var w = MockWasabi.make();
        var w2 = MockWasabi.make();
        var server = new MockSocket();
        var client = new MockSocket();
        server.link(client);

        w.addClient(client, function() {
            var result = { };
            var k;
            for (k in w.registry.objects) {
                result[k] = w.registry.objects[k];
            }
            return result;
        });

        w2.addServer(server);

        foo1.foobar = 1337;
        w.addObject(foo1);
        w.processConnections();

        foo2.foobar = 1234;
        w.addObject(foo2);
        w.processConnections();

        w2.processConnections();

        assert.ok(w2.registry.objects[foo1.wabiSerialNumber]);
        assert.equal(foo1.foobar, w2.registry.objects[foo1.wabiSerialNumber].foobar);
        assert.equal(w.registry.objects.length, w2.registry.objects.length);

        assert.ok(w2.registry.objects[foo2.wabiSerialNumber]);
        assert.equal(foo2.foobar, w2.registry.objects[foo2.wabiSerialNumber].foobar);
        assert.equal(w.registry.objects.length, w2.registry.objects.length);
    });

    it('calls static RPCs without any associated object', function(done) {
        var w = MockWasabi.make();
        var w2 = MockWasabi.make();
        var server = new MockSocket();
        var client = new MockSocket();
        server.link(client);

        w2.addServer(server);
        w.addClient(client, function() {
        });

        var fn = function(args, conn) {
            assert.equal(conn, w2.servers[0]);
            done();
        }

        var rpcTest = w.mkRpc(fn);
        w2.mkRpc(fn);

        rpcTest();

        w.processConnections();
        w2.processConnections();
    });

    it('emits RPC invocations to a set of specified connections', function() {
        var ws = MockWasabi.make();
        var wc1 = MockWasabi.make();
        var wc2 = MockWasabi.make();

        // link between server and first client
        var server1 = new MockSocket();
        var client1 = new MockSocket();
        server1.link(client1);

        // link between server and second client
        var server2 = new MockSocket();
        var client2 = new MockSocket();
        server2.link(client2);

        ws.addClient(client1);
        ws.addClient(client2);
        wc1.addServer(server1);
        wc2.addServer(server2);

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
        var w = MockWasabi.make();
        var w2 = MockWasabi.make();
        var server = new MockSocket();
        var client = new MockSocket();
        server.link(client);

        w.addClient(client, function() {
        });

        w2.addServer(server);
        w2.processConnections();
    });

    it('returns the new connection when adding a client', function() {
        var w = MockWasabi.make();
        var sock = new MockSocket();
        var result = w.addClient(sock);
        assert.strictEqual(result, w.clients[0]);
    });

    it('returns the new connection when adding a server', function() {
        var w = MockWasabi.make();
        var sock = new MockSocket();
        var result = w.addClient(sock);
        assert.strictEqual(result, w.clients[0]);
    });

    it('complains when receiving update data for an unknown object');
    it('complains when receiving ghost data for an unknown class');
    it('complains when receiving a call to an unknown RPC');
    it('complains when receiving invalid arguments a known RPC');
    it('complains when ghosting to a connection without a scope callback');
    it('queries a callback to determine which netobjects to ghost');
    it('triggers callbacks when ghosts are added', function() {
        var done = false;
        var w = MockWasabi.make();
        var w2 = MockWasabi.make();
        var server = new MockSocket();
        var client = new MockSocket();
        server.link(client);

        w2.addServer(server);
        w.addClient(client);

        function GhostAddTest() {
        }

        GhostAddTest.prototype = {
              serialize: function() { }
            , onAddGhost: function() { done = true; }
        };

        w.addClass(GhostAddTest);
        w2.addClass(GhostAddTest);

        var obj = new GhostAddTest();
        w.addObject(obj);

        w.processConnections();
        w2.processConnections();

        assert.ok(done);
    });
    it('triggers callbacks when ghosts are removed');
});

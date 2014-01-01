var Wasabi = require('../src/wasabi'),
    WasabiError = require('../src/wasabi_error'),
    assert = require('chai').assert,
    WebSocket = require('ws'),
    MockSocket = require('./mock_socket.js'),
    MockWasabi = require('./mock_wasabi.js');

describe('Wasabi', function () {
    var ws, wc1, wc2, server1, client1, server2, client2, bs, foo1, foo2;

    beforeEach(function () {

        // a simple bitstream
        bs = new Wasabi.Bitstream();

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
        for (i = 0; i < newList.length; i++) {
            assert.equal(newList[i].constructor, objList[i].constructor);
            newList[i].check(objList[i]);
        }
    });

    it('orchestrates packing/unpacking data automatically in an update function', function () {
        var foo = new MockWasabi.Foo();

        ws.addObject(foo);

        ws._packGhost(foo, bs);
        ws._packUpdates([foo], bs);
        bs._index = 0;
        wc1._unpackGhost(bs);
        wc1._unpackUpdates(bs);
        assert.ok(wc1.registry.objects[foo.wsbSerialNumber]);
    });

    it('packs and unpacks properly to out-of-sync registries', function () {
        var foo = new MockWasabi.Foo();

        ws.registry.nextSerialNumber += 1;
        ws.addObject(foo);

        ws._packGhost(foo, bs);
        bs._index = 0;
        wc1._unpackGhost(bs);
        assert.ok(wc1.registry.objects[foo.wsbSerialNumber]);
    });

    it('calls RPCs from servers to clients on an associated netobject', function () {
        ws.addObject(foo1);
        foo1.rpcTest(1337);

        ws.processConnections();
        wc1.processConnections();

        assert.ok(wc1.registry.objects[foo1.wsbSerialNumber]);
        assert.equal(wc1.registry.objects[foo1.wsbSerialNumber].testval, 1337);
    });

    it('supports calling RPCs and removing their subject in the same frame', function () {
        ws.addObject(foo1);

        ws.processConnections();
        wc1.processConnections();

        assert.ok(wc1.registry.objects[foo1.wsbSerialNumber]);

        foo1.rpcTest(1337);
        ws.removeObject(foo1);

        ws.processConnections();
        wc1.processConnections();
    });

    it('handles calling RPCs when adding and removing their subject in the same frame', function () {
        ws.addObject(foo1);
        foo1.rpcTest(1337);
        ws.removeObject(foo1);

        ws.processConnections();
        wc1.processConnections();
    });

    it('calls RPCs from clients to servers on an associated netobject', function () {
        ws.addObject(foo1);

        ws.processConnections();
        wc1.processConnections();

        wc1.registry.objects[foo1.wsbSerialNumber].rpcTest(1337);

        wc1.processConnections();
        ws.processConnections();
        assert.equal(foo1.testval, 1337);
    });

    it('passes a connection object to RPC invocations', function (done) {
        function ConnectionAsserter() {
            this._dummy = true;
        }

        ConnectionAsserter.prototype = {
            constructor: ConnectionAsserter,
            rpcAssertConnection: function rpcAssertConnection() {
                var conn = Array.prototype.slice.call(arguments)[0];
                assert.strictEqual(conn, wc1.servers[0]);
                done();
            }
        };

        ws.addClass(ConnectionAsserter);
        wc1.addClass(ConnectionAsserter);

        var obj = new ConnectionAsserter();

        ws.addObject(obj);

        ws.processConnections();
        wc1.processConnections();

        obj.rpcAssertConnection();

        ws.processConnections();
        wc1.processConnections();

        assert.ok(wc1.registry.objects[obj.wsbSerialNumber]);
    });

    it('automatically manages ghosting and updates', function () {
        foo1.uintfoo = 1337;
        ws.addObject(foo1);

        ws.processConnections();
        wc1.processConnections();

        var remoteFoo = wc1.registry.objects[foo1.wsbSerialNumber];
        assert.ok(remoteFoo.wsbIsGhost);
        assert.notOk(foo1.wsbIsGhost);
        assert.equal(foo1.uintfoo, remoteFoo.uintfoo);
        assert.equal(ws.registry.objects.length, wc1.registry.objects.length);

        foo2.uintfoo = 1234;
        ws.addObject(foo2);

        ws.processConnections();
        wc1.processConnections();

        assert.ok(wc1.registry.objects[foo2.wsbSerialNumber]);
        assert.equal(foo2.uintfoo, wc1.registry.objects[foo2.wsbSerialNumber].uintfoo);
        assert.equal(ws.registry.objects.length, wc1.registry.objects.length);
    });

    it('can handle multiple foreign processConnection calls with a single local processConnection', function () {
        foo1.uintfoo = 1337;
        ws.addObject(foo1);
        ws.processConnections();

        foo2.uintfoo = 1234;
        ws.addObject(foo2);
        ws.processConnections();

        wc1.processConnections();

        assert.ok(wc1.registry.objects[foo1.wsbSerialNumber]);
        assert.equal(foo1.uintfoo, wc1.registry.objects[foo1.wsbSerialNumber].uintfoo);
        assert.equal(ws.registry.objects.length, wc1.registry.objects.length);

        assert.ok(wc1.registry.objects[foo2.wsbSerialNumber]);
        assert.equal(foo2.uintfoo, wc1.registry.objects[foo2.wsbSerialNumber].uintfoo);
        assert.equal(ws.registry.objects.length, wc1.registry.objects.length);
    });

    it('calls static RPCs without any associated object', function (done) {
        var fn = function connectionTestRpc() {
            var conn = Array.prototype.slice.call(arguments)[0];
            assert.equal(conn, wc1.servers[0]);
            done();
        };

        var rpcTest = ws.mkRpc(fn);
        wc1.mkRpc(fn);

        rpcTest();

        ws.processConnections();
        wc1.processConnections();
    });

    it('emits RPC invocations to a set of specified connections', function () {
        var count = 0;

        function TestClass() {
            this._dummy = 1;
        }
        TestClass.prototype = {
            constructor: TestClass,
            rpcTest: function rpcTest() {
                var conn = Array.prototype.slice.call(arguments)[0];
                assert.equal(conn, wc1.servers[0]);
                count++;
            },
            rpcTestTwo: function rpcTestTwo() {
                throw new Error('Should never be called');
            }
        };

        ws.addClass(TestClass);
        wc1.addClass(TestClass);
        wc2.addClass(TestClass);

        var test = new TestClass();
        ws.addObject(test);
        test.rpcTest(ws.clients[0]);

        ws.processConnections();
        wc1.processConnections();
        wc2.processConnections();

        assert.equal(count, 1);
    });

    it('does not choke on an empty receive bitstream', function () {
        wc1.processConnections();
    });

    it('adds and removes clients with a socket object', function () {
        var w = MockWasabi.make();
        var sock = new MockSocket();
        var result = w.addClient(sock);
        assert.ok(result);
        assert.equal(result, w.clients[w.clients.length - 1]);

        w.removeClient('not a socket');
        assert.equal(w.clients.length, 1);
        w.removeClient(sock);
        assert.equal(w.clients.length, 0);
    });

    it('adds and removes servers with a socket object', function () {
        var w = MockWasabi.make();
        var sock = new MockSocket();
        var result = w.addServer(sock);
        assert.ok(result);
        assert.equal(result, w.servers[w.servers.length - 1]);

        w.removeServer('not a socket');
        assert.equal(w.servers.length, 1);
        w.removeServer(sock);
        assert.equal(w.servers.length, 0);
    });

    it('triggers callbacks when ghosts are added or removed', function () {
        var createDone = false,
            destroyDone = false;

        function GhostCallbackTest() {
            this._dummy = 1;
        }

        ws.addClass(GhostCallbackTest);
        wc1.addClass(GhostCallbackTest);

        var obj = new GhostCallbackTest();
        ws.addObject(obj);

        wc1.on('clientGhostCreate', function (remoteObj) {
            createDone = true;
            assert.equal(remoteObj.wsbSerialNumber, obj.wsbSerialNumber);
        });

        wc1.on('clientGhostDestroy', function (remoteObj) {
            destroyDone = true;
            assert.equal(remoteObj.wsbSerialNumber, obj.wsbSerialNumber);
        });

        ws.processConnections();
        wc1.processConnections();

        assert.ok(createDone);

        ws.removeObject(obj);

        ws.processConnections();
        wc1.processConnections();

        assert.ok(destroyDone);
    });

    it('queries a callback to determine which netobjects to ghost', function () {
        ws.addObject(foo1);
        ws.addObject(foo2);

        // set the scope callback to read from the local variable `scope`
        var scope = {};
        ws.clients[0]._scopeCallback = function () {
            return scope;
        };

        // foo1 in scope, foo2 is not
        scope[foo1.wsbSerialNumber] = foo1;
        ws.processConnections();
        wc1.processConnections();
        assert.ok(wc1.registry.objects[foo1.wsbSerialNumber]);
        assert.equal(wc1.registry.objects[foo2.wsbSerialNumber], undefined);

        // both foo1 and foo2 in scope
        scope = {};
        scope[foo1.wsbSerialNumber] = foo1;
        scope[foo2.wsbSerialNumber] = foo2;
        ws.processConnections();
        wc1.processConnections();
        assert.ok(wc1.registry.objects[foo1.wsbSerialNumber]);
        assert.ok(wc1.registry.objects[foo2.wsbSerialNumber]);

        // neither foo1 nor foo2 in scope
        scope = {};
        ws.processConnections();
        wc1.processConnections();
        assert.equal(wc1.registry.objects[foo1.wsbSerialNumber], undefined);
        assert.equal(wc1.registry.objects[foo2.wsbSerialNumber], undefined);
    });

    it('handles prototypal inheritance', function () {
        var bar = new MockWasabi.Bar();

        ws.addObject(bar);
        bar.uintfoo = 1234;
        bar.barbar = 4321;
        ws.processConnections();
        wc1.processConnections();
        var remoteBar = wc1.registry.getObject(bar.wsbSerialNumber);
        assert.ok(remoteBar);
        assert.equal(remoteBar.uintfoo, bar.uintfoo);
        assert.equal(remoteBar.barbar, bar.barbar);

        bar.rpcTest(1337);
        ws.processConnections();
        wc1.processConnections();
        assert.equal(remoteBar.testval, 1337);

        bar.rpcBarTest(7331);
        ws.processConnections();
        wc1.processConnections();
        assert.equal(remoteBar.barval, 7331);

    });

    it('complains when receiving ghost data for an unknown class', function () {
        function UnknownClass() {
            this._dummy = 1;
        }
        ws.addClass(UnknownClass);
        var obj = new UnknownClass();
        ws.addObject(obj);

        ws.processConnections();

        assert.throws(function () {
            wc1.processConnections();
        }, WasabiError);
    });

    it('uses a sane default when no serialize function is given to RPCs', function (done) {
        function ClassWithSimpleRpc() {
            this._dummy = 1;
        }
        ClassWithSimpleRpc.prototype.rpcOne = function rpcOne(a, b, c, d) {
            assert.equal(a, 1337);
            assert.closeTo(b, 0.123, 0.001);
            assert.equal(c, -100);
            assert.equal(d, 'test!');
            done();
        };

        ws.addClass(ClassWithSimpleRpc);
        wc1.addClass(ClassWithSimpleRpc);

        var obj = new ClassWithSimpleRpc();
        ws.addObject(obj);
        obj.rpcOne(1337, 0.123, -100, 'test!');

        ws.processConnections();
        wc1.processConnections();

    });

    it('complains when asked to serialize an RPC argument of an unsupported type', function () {
        var fn = ws.mkRpc(function testRpc(arg) {
            assert.ok(arg);
        });
        fn([]);

        assert.throws(function () {
            ws.processConnections();
        }, WasabiError);
    });

    it('complains when two RPC hashes collide', function () {
        ws.mkRpc(function foo() {
            this._dummy = 1;
        });
        assert.throws(function () {
            ws.mkRpc(function foo() {
                this._dummy = 1;
            });
        }, WasabiError);

        function RedefinedFoo() {
            this._dummy = 1;
        }
        ws.registry.mkRpc(RedefinedFoo, function foo() {
            this._dummy = 1;
        });
        assert.throws(function () {
            ws.registry.mkRpc(RedefinedFoo, function foo() {
                this._dummy = 1;
            });
        }, WasabiError);
    });

    it('complains when receiving update data for an unknown object', function () {
        // First, we'll send the ghost properly
        ws.addObject(foo1);
        ws.processConnections();
        wc1.processConnections();

        // Now we change the serial number, so the client will not recognize the
        // object anymore
        foo1.wsbSerialNumber = 1337;

        ws.processConnections();

        assert.throws(function () {
            wc1.processConnections();
        }, WasabiError);
    });

    it('complains when receiving a call to an unknown RPC', function () {
        var rpc = ws.mkRpc(function foo() {
            this._dummy = 1;
        });
        rpc();
        ws.processConnections();

        assert.throws(function () {
            wc1.processConnections();
        }, WasabiError);
    });

    it('removes objects properly regardless of order', function () {
        ws.addObject(foo1);
        ws.addObject(foo2);
        assert.ok(ws._getAllObjects()[foo1.wsbSerialNumber]);
        assert.ok(ws._getAllObjects()[foo2.wsbSerialNumber]);

        ws.removeObject(foo2);
        assert.ok(ws._getAllObjects()[foo1.wsbSerialNumber]);
        assert.notOk(ws._getAllObjects()[foo2.wsbSerialNumber]);

        ws.removeObject(foo1);
        assert.notOk(ws._getAllObjects()[foo1.wsbSerialNumber]);
        assert.notOk(ws._getAllObjects()[foo2.wsbSerialNumber]);
    });

    it('complains when defining an anonymous class', function () {
        var klass = function () {
            this.dummy = 1;
        };

        assert.throws(function () {
            ws.addClass(klass);
        }, WasabiError);
    });

    it('complains when defining an anonymous RPC method', function () {
        var Klass = function Klass() {
            this.dummy = 1;
        };
        Klass.prototype.rpcAnonymousMethod = function () {
            this.dummy = 1;
        };

        assert.throws(function () {
            ws.addClass(Klass);
        }, WasabiError);
    });

    it('complains when defining an anonymous static RPC', function () {
        assert.throws(function () {
            ws.mkRpc(function () {
                this.dummy = 1;
            });
        }, WasabiError);
    });

    it('complains when receiving too few arguments to a known RPC', function () {
        ws.addObject(foo1);

        assert.throws(function () {
            foo1.rpcDefault();
        }, WasabiError);
    });

    it('complains when receiving too many arguments to a known RPC', function () {
        ws.addObject(foo1);

        assert.throws(function () {
            foo1.rpcDefault(1, 2, 3);
        }, WasabiError);
    });

    it('supports unidirectional RPCs', function () {
        var remoteFoo;
        ws.addObject(foo1);

        ws.processConnections();
        wc1.processConnections();

        remoteFoo = wc1._getAllObjects()[foo1.wsbSerialNumber];

        foo1.s2cTest('test');
        remoteFoo.s2cTest('test');

        ws.processConnections();
        wc1.processConnections();

        assert.equal('test', remoteFoo.testval);
        assert.notEqual('test', foo1.testval);

        foo1.testval = undefined;
        remoteFoo.testval = undefined;

        foo1.c2sTest('test');
        remoteFoo.c2sTest('test');

        ws.processConnections();
        wc1.processConnections();
        ws.processConnections();
        wc1.processConnections();

        assert.notEqual('test', remoteFoo.testval);
        assert.equal('test', foo1.testval);

    });

    it('provides callbacks for handling send errors', function () {
        var done = false;
        ws.on('sendError', function (connection, err) {
            assert.strictEqual(ws.clients[0], connection);
            assert.ok(err instanceof Error);
            done = true;
        });

        wc1.servers[0]._socket.onmessage = function () {
            throw new WasabiError('Send error!');
        };

        ws.processConnections();

        assert.ok(done);
        assert.equal(ws.clients.length, 1);
    });

    it('provides callbacks for sending data', function () {
        var done = false;
        ws.removeClient(client2);
        ws.on('send', function (connection, data) {
            assert.strictEqual(ws.clients[0], connection);
            assert.ok(data.length);
            done = true;
        });

        ws.processConnections();

        assert.ok(done);
    });

    it('provides callbacks for receiving data', function () {
        var done = false;
        ws.removeClient(client2);
        wc1.on('receive', function (connection, data) {
            assert.strictEqual(wc1.servers[0], connection);

            assert.ok(data.length);
            done = true;
        });

        ws.processConnections();
        wc1.processConnections();

        assert.ok(done);
    });
});
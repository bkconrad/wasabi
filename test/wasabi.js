var Wasabi = require('../src/wasabi'),
    WasabiError = require('../src/wasabi_error'),
    assert = require('chai').assert,
    WebSocket = require('ws'),
    MockSocket = require('./mock_socket.js'),
    MockWasabi = require('./mock_wasabi.js');

describe('Wasabi', function () {
    var ws;
    var wc1;
    var wc2;
    var server1;
    var client1;
    var server2;
    var client2;
    var bs;
    var foo1;
    var foo2;
    var clientConn1;
    var clientConn2;

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
        clientConn1 = ws.addClient(client1);
        clientConn2 = ws.addClient(client2);
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

    it('encodes objects', function () {
        var obj;
        var remoteObj;
        var oldRemoteSubobject;

        ws.removeClient(client2);

        function ObjectEncodingTestClass() {
            this._dummy = true;
        }

        ObjectEncodingTestClass.prototype.init = function () {
            // encoded with a serialize callback
            this.structuredObj = {
                uintfoo: 1,
                sintfoo: -1,
                subobject: {
                    uintbar: 2,
                    sintbar: -2
                }
            };

            // same as above, but encoded with no callback
            this.unstructuredObj = {
                uintfoo: 1,
                sintfoo: -1,
                subobject: {
                    uintbar: 2,
                    sintbar: -2
                }
            };
        };

        ObjectEncodingTestClass.prototype.serialize = function (desc) {
            desc.object('structuredObj', function (desc1) {
                desc1.uint('uintfoo', 8);
                desc1.sint('sintfoo', 8);
                desc1.object('subobject', function (desc2) {
                    desc2.uint('uintbar', 8);
                    desc2.sint('sintbar', 8);
                });
            });

            desc.object('unstructuredObj');

            // never defined, but shouldn't throw an error
            desc.object('nonexistantObj');
        };

        ws.addClass(ObjectEncodingTestClass);
        wc1.addClass(ObjectEncodingTestClass);

        obj = new ObjectEncodingTestClass();
        obj.init();
        ws.addObject(obj);

        ws.processConnections();
        wc1.processConnections();

        remoteObj = wc1.registry.getObject(obj.wsbSerialNumber);

        // the objects should all be deep equal
        assert.deepEqual(obj.structuredObj, remoteObj.structuredObj);
        assert.deepEqual(obj.unstructuredObj, remoteObj.unstructuredObj);

        oldRemoteSubobject = remoteObj.unstructuredObj;

        // process again
        ws.processConnections();
        wc1.processConnections();

        remoteObj = wc1.registry.getObject(obj.wsbSerialNumber);

        // shouuld reuse the subobject
        assert.strictEqual(oldRemoteSubobject, remoteObj.unstructuredObj);

        // the undefined object gets created remotely but is empty
        assert.ok(remoteObj.nonexistantObj);
    });

    it('encodes objects in rpc arguments', function (done) {
        var sourceObj = {
            foo: 1,
            subobject: {
                bar: -2
            }
        };

        function rpcObjectTest(obj) {
            assert.deepEqual(sourceObj, obj);
            done();
        }

        var rpc = ws.mkRpc(rpcObjectTest);
        wc1.mkRpc(rpcObjectTest);

        rpc(sourceObj);

        ws.processConnections();
        wc1.processConnections();
    });

    it('orchestrates packing/unpacking data automatically in an update function', function () {
        var foo = new MockWasabi.Foo();

        ws.addObject(foo);

        ws._packGhost(foo, bs);
        ws._packUpdates([foo], bs);
        bs._index = 0;
        wc1._unpackGhost(bs);
        wc1._unpackUpdates(bs);
        assert.ok(wc1.registry._objects[foo.wsbSerialNumber]);
        wc1.registry._objects[foo.wsbSerialNumber].check(foo);
    });

    it('packs and unpacks properly to out-of-sync registries', function () {
        var foo = new MockWasabi.Foo();

        ws.registry.nextSerialNumber += 1;
        ws.addObject(foo);

        ws._packGhost(foo, bs);
        bs._index = 0;
        wc1._unpackGhost(bs);
        assert.ok(wc1.registry._objects[foo.wsbSerialNumber]);
    });

    it('calls RPCs from servers to clients on an associated netobject', function () {
        ws.addObject(foo1);
        foo1.rpcTest(1337);

        ws.processConnections();
        wc1.processConnections();

        assert.ok(wc1.registry._objects[foo1.wsbSerialNumber]);
        assert.equal(wc1.registry._objects[foo1.wsbSerialNumber].testval, 1337);
    });

    it('supports calling RPCs and removing their subject in the same frame', function () {
        ws.addObject(foo1);

        ws.processConnections();
        wc1.processConnections();

        assert.ok(wc1.registry._objects[foo1.wsbSerialNumber]);

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

        wc1.registry._objects[foo1.wsbSerialNumber].rpcTest(1337);

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

        assert.ok(wc1.registry._objects[obj.wsbSerialNumber]);
    });

    it('automatically manages ghosting and updates', function () {
        foo1.uintfoo = 1337;
        ws.addObject(foo1);

        ws.processConnections();
        wc1.processConnections();

        var remoteFoo = wc1.registry._objects[foo1.wsbSerialNumber];
        assert.ok(remoteFoo.wsbIsGhost);
        assert.notOk(foo1.wsbIsGhost);
        assert.equal(foo1.uintfoo, remoteFoo.uintfoo);
        assert.equal(ws.registry._objects.length, wc1.registry._objects.length);

        foo2.uintfoo = 1234;
        ws.addObject(foo2);

        ws.processConnections();
        wc1.processConnections();

        assert.ok(wc1.registry._objects[foo2.wsbSerialNumber]);
        assert.equal(foo2.uintfoo, wc1.registry._objects[foo2.wsbSerialNumber].uintfoo);
        assert.equal(ws.registry._objects.length, wc1.registry._objects.length);
    });

    it('can handle multiple foreign processConnection calls with a single local processConnection', function () {
        foo1.uintfoo = 1337;
        ws.addObject(foo1);
        ws.processConnections();

        foo2.uintfoo = 1234;
        ws.addObject(foo2);
        ws.processConnections();

        wc1.processConnections();

        assert.ok(wc1.registry._objects[foo1.wsbSerialNumber]);
        assert.equal(foo1.uintfoo, wc1.registry._objects[foo1.wsbSerialNumber].uintfoo);
        assert.equal(ws.registry._objects.length, wc1.registry._objects.length);

        assert.ok(wc1.registry._objects[foo2.wsbSerialNumber]);
        assert.equal(foo2.uintfoo, wc1.registry._objects[foo2.wsbSerialNumber].uintfoo);
        assert.equal(ws.registry._objects.length, wc1.registry._objects.length);
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
            this.val = 1;
        }

        GhostCallbackTest.prototype.serialize = function (desc) {
            desc.uint('val', 8);
        };

        ws.addClass(GhostCallbackTest);
        wc1.addClass(GhostCallbackTest);

        var obj = new GhostCallbackTest();
        ws.addObject(obj);
        obj.val = 100;

        wc1.on('clientGhostCreate', function (remoteObj) {
            createDone = true;
            assert.equal(remoteObj.wsbSerialNumber, obj.wsbSerialNumber);
            assert.equal(remoteObj.val, obj.val);
        });

        wc1.on('clientGhostDestroy', function (remoteObj) {
            destroyDone = true;
            assert.equal(remoteObj.wsbSerialNumber, obj.wsbSerialNumber);
        });

        ws.processConnections();
        wc1.processConnections();

        assert.ok(createDone);
        createDone = false;

        ws.processConnections();
        wc1.processConnections();

        // create should only be fired once, since the ghost is never removed
        assert.notOk(createDone);

        ws.removeObject(obj);

        ws.processConnections();
        wc1.processConnections();

        assert.ok(destroyDone);
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

    it('uses the key name for anonymous RPC methods', function () {
        var Klass = function Klass() {
            this.dummy = 1;
        };

        Klass.prototype.rpcAnonymousMethod = function () {
            this.dummy = 1;
        };

        ws.addClass(Klass);
        assert.ok(Klass.prototype.wsbReal_rpcAnonymousMethod.wsbFnName);
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

    it('sends objects in visible groups', function () {
        var group1 = ws.createGroup();
        var group2 = ws.createGroup();

        ws.addObject(foo1);
        ws.addObject(foo2);

        ws.processConnections();
        wc1.processConnections();
        wc2.processConnections();

        // all objects will be sent to all connections by default
        assert.ok(wc1.registry.getObject(foo1.wsbSerialNumber));
        assert.ok(wc2.registry.getObject(foo1.wsbSerialNumber));
        assert.ok(wc1.registry.getObject(foo2.wsbSerialNumber));
        assert.ok(wc2.registry.getObject(foo2.wsbSerialNumber));

        // setting a scope callback can be used to control visibility
        clientConn1._scopeCallback = function () {
            var result = {};
            result[foo1.wsbSerialNumber] = foo1;
            return result;
        };

        clientConn2._scopeCallback = function () {
            var result = {};
            result[foo2.wsbSerialNumber] = foo2;
            return result;
        };

        ws.processConnections();
        wc1.processConnections();
        wc2.processConnections();

        // foo1 goes to client1, foo2 goes to client2
        assert.ok(wc1.registry.getObject(foo1.wsbSerialNumber));
        assert.notOk(wc2.registry.getObject(foo1.wsbSerialNumber));
        assert.notOk(wc1.registry.getObject(foo2.wsbSerialNumber));
        assert.ok(wc2.registry.getObject(foo2.wsbSerialNumber));

        // add the first group to both clients
        // adding a group will override any scope callback
        clientConn1.addGroup(group1);
        clientConn2.addGroup(group1);

        // add foo1 to the group 
        group1.addObject(foo1);

        ws.processConnections();
        wc1.processConnections();
        wc2.processConnections();

        // foo1 will be sent to both connections
        assert.ok(wc1.registry.getObject(foo1.wsbSerialNumber));
        assert.ok(wc2.registry.getObject(foo1.wsbSerialNumber));

        // remove the scope callbacks
        delete clientConn1._scopeCallback;
        delete clientConn2._scopeCallback;

        // remove group2 from wc2
        clientConn2.removeGroup(group2);

        ws.processConnections();
        wc1.processConnections();
        wc2.processConnections();

        // foo2 will not be on either
        assert.notOk(wc1.registry.getObject(foo2.wsbSerialNumber));
        assert.notOk(wc2.registry.getObject(foo2.wsbSerialNumber));

        // add foo2 to group2, then group2 to wc2
        group2.addObject(foo2);
        clientConn2.addGroup(group2);

        ws.processConnections();
        wc1.processConnections();
        wc2.processConnections();

        // foo1 will still be there
        assert.ok(wc1.registry.getObject(foo1.wsbSerialNumber));
        assert.ok(wc2.registry.getObject(foo1.wsbSerialNumber));

        // foo2 will be on wc2 but not wc1
        assert.ok(wc2.registry.getObject(foo2.wsbSerialNumber));
        assert.notOk(wc1.registry.getObject(foo2.wsbSerialNumber));

        // remove foo1 from group1
        group1.removeObject(foo1);

        ws.processConnections();
        wc1.processConnections();
        wc2.processConnections();

        // foo1 will no longer be on either instance
        assert.notOk(wc1.registry.getObject(foo1.wsbSerialNumber));
        assert.notOk(wc2.registry.getObject(foo1.wsbSerialNumber));

        // remove group2 from wc2
        clientConn2.removeGroup(group2._id);
        assert.notOk(clientConn2._groups[group2._id]);

        ws.processConnections();
        wc1.processConnections();
        wc2.processConnections();

        // foo2 will not be on either
        assert.notOk(wc1.registry.getObject(foo2.wsbSerialNumber));
        assert.notOk(wc2.registry.getObject(foo2.wsbSerialNumber));
    });

    it('removes groups from all connections when destroyed', function () {
        var group = ws.createGroup();
        clientConn1.addGroup(group);
        clientConn2.addGroup(group);

        assert.ok(clientConn1._groups[group._id]);
        assert.ok(clientConn2._groups[group._id]);

        ws.destroyGroup(group);

        assert.notOk(clientConn1._groups[group._id]);
        assert.notOk(clientConn2._groups[group._id]);
    });

    it('implicitly adds an object to Wasabi when adding it to a group', function () {
        var group = ws.createGroup();
        group.addObject(foo1);
        assert.ok(group._objects[foo1.wsbSerialNumber]);
        assert.ok(ws.registry.getObject(foo1.wsbSerialNumber));
    });

    it('implicitly removes an object from all groups when removing it from Wasabi', function () {
        var group = ws.createGroup();
        ws.addObject(foo1);
        group.addObject(foo1);
        assert.ok(group._objects[foo1.wsbSerialNumber]);
        assert.ok(ws.registry.getObject(foo1.wsbSerialNumber));

        ws.removeObject(foo1);
        assert.notOk(ws.registry.getObject(foo1.wsbSerialNumber));
        assert.notOk(group._objects[foo1.wsbSerialNumber]);
    });
});
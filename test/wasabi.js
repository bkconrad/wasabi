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

    it('packs and unpacks rpcs', function() {
        var bs = new Wasabi.Bitstream;
        var done = false;
        function rpcFoo(args) { assert.equal(args.bar, 123); done = true; }
        w.addRpc(rpcFoo, function(desc) {
            desc.uint('bar', 8);
        });
        w2.addRpc(rpcFoo, function(desc) {
            desc.uint('bar', 8);
        });

        w.packRpc(rpcFoo, {bar: 123}, bs);
        bs._index = 0;
        w2.unpackRpc(bs);
        assert.ok(done);
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
        var i, hash, bs = new Wasabi.Bitstream;

        var foo = new Foo;
        w.addObject(foo);
        foo.rpcTest(1337);
        w.pack(bs);
        bs._index = 0;
        w2.unpack(bs);
        assert.ok(w2.registry.objects[foo.wabiSerialNumber]);
        assert.equal(w2.registry.objects[foo.wabiSerialNumber].foobar, 1337);
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

    it('complains when receiving update data for an unknown object');
    it('complains when receiving ghost data for an unknown class');
    it('complains when receiving a call to an unknown RPC');
    it('complains when receiving invalid arguments a known RPC');
    it('complains when ghosting to a connection without a scope callback');
    it('queries a callback to determine which netobjects to ghost');
    it('triggers callbacks when ghosts are added');
    it('triggers callbacks when ghosts are removed');
});

var Wasabi = require(__dirname + '/..' + (process.env.COVERAGE ? '/src-cov' : '/src') + '/wasabi')
  , assert = require('chai').assert
  , WebSocket = require('ws')
  ;

describe('Wasabi', function () {
    var w = Wasabi;
    var w2 = Wasabi.makeWasabi();

    function Foo () { this.foobar = 1; };
    Foo.prototype = {
        constructor: Foo
      , serialize: function(desc) {
          desc.uint('foobar', 8);
      }
      , check: function(that) {
          assert.equal(this.foobar, that.foobar);
      }
    };
    function Bar () { this.foobar = 2; this.barbaz = 3};
    Bar.prototype = {
        constructor: Bar
      , serialize: function(desc) {
          desc.uint('foobar', 8);
          desc.uint('barbaz', 8);
      }
      , check: function(that) {
          assert.equal(this.foobar, that.foobar);
          assert.equal(this.barbaz, that.barbaz);
      }
    };
    w.addClass(Foo);
    w.addClass(Bar);
    w2.addClass(Foo);
    w2.addClass(Bar);
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
        bs._index = 0;

        var newList = [];
        var obj;
        while (true) {
            obj = w2.unpackGhost(bs);
            if (!obj) {
                break;
            }

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
        w.packObjects(objList, bs);
        bs._index = 0;
        var newList = w2.unpackObjects(bs);

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

    it('orchestrates packing/unpacking data automatically in an update function');
    it('calls RPCs on an associated netobject');
    it('complains when receiving update data for an unknown object');
    it('complains when receiving ghost data for an unknown class');
    it('complains when receiving a call to an unknown RPC');
    it('complains when receiving invalid arguments a known RPC');
});

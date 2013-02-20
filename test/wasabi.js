var Wasabi = require(__dirname + '/..' + (process.env.COVERAGE ? '/src-cov' : '/src') + '/wasabi')
  , assert = require('chai').assert
  , WebSocket = require('ws')
  ;

describe('Wasabi', function () {
    it('sends rpcs through a bitstream', function(done) {
        var w = new Wasabi;
        var bs = new Wasabi.Bitstream;
        function rpcFoo() { assert.equal(arguments.bar, 123); done(); }
        w.registry.addRpc(rpcFoo, function(desc) {
            desc.uint('bar', 8);
        });

        w.packRpc(rpcFoo, {bar: 123}, bs);
        bs._index = 0;
        w.unpackRpc(bs);
    });
    it('sends lists of objects through a bitstream', function () {
        var w = new Wasabi;
        var bs = new Wasabi.Bitstream;

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
        w.registry.addClass(Foo);
        w.registry.addClass(Bar);
        var foo1 = new Foo, foo2 = new Foo, bar1 = new Bar, bar2 = new Bar;
        var objList = [foo1, bar1, foo2, bar2];

        w.packObjects(objList, bs);
        bs._index = 0;
        var newList = w.unpackObjects(bs);

        assert.notEqual(0, newList.length);
        for (var i = 0; i < newList.length; i++) {
            assert.equal(newList[i].constructor, objList[i].constructor);
            newList[i].check(objList[i]);
        }
    });
});

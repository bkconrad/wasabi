var Wasabi = require(__dirname + '/..' + (process.env.COVERAGE ? '/src-cov' : '/src') + '/wasabi')
  , assert = require('chai').assert
  , WebSocket = require('ws')
  ;
describe('Wasabi', function () {
    it('sends lists of objects through a bitstream', function () {
        var w = new Wasabi;
        var bs = new w.Bitstream;

        function Foo () {};
        Foo.prototype.constructor = Foo;
        function Bar () {};
        Bar.prototype.constructor = Bar;
        w.registry.register(Foo);
        w.registry.register(Bar);
        var foo1 = new Foo, foo2 = new Foo, bar1 = new Bar, bar2 = new Bar;
        var objList = [foo1, bar1, foo2, bar2];

        w.packObjects(objList, bs);
        bs._index = 0;
        var newList = w.unpackObjects(bs);

        assert.notEqual(0, newList.length);
        for (var i = 0; i < newList.length; i++) {
            assert.equal(newList[i].constructor, objList[i].constructor);
        }
    });
});

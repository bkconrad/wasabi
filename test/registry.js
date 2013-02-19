var Registry = require(__dirname + '/..' + (process.env.COVERAGE ? '/src-cov' : '/src') + '/registry')
  , assert = require('chai').assert
  , WebSocket = require('ws')
  ;

describe('Class registry', function () {
    it('hashes classes by name', function () {
        var r = new Registry();
        function Foo () {
        };
        function Bar () {
        };
        assert.notEqual(r.hash(Bar), r.hash(Foo));
    });
    it('registers classes uniquely by hash', function () {
        var r = new Registry();
        function Foo () {
        };
        function Bar () {
        };
        r.register(Foo);
        r.register(Bar);
        assert.notEqual(r.lookup(r.hash(Foo)), r.lookup(r.hash(Bar)));
    });
});

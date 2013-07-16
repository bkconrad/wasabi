var Wasabi = require(__dirname + '/..' + (process.env.COVERAGE ? '/src-cov' : '/src') + '/wasabi');
var assert = require('chai').assert;

module.exports = (function() {
    function Foo () { this.foobar = 1; };
    Foo.prototype = {
        constructor: Foo
      , serialize: function(desc) {
          desc.uint('foobar', 8);
      }
      , check: function(that) {
          assert.equal(this.foobar, that.foobar);
      }
      , rpcTest: function(args) {
        this.foobar = args.val;
      }
      , rpcTestArgs: function(desc) {
        desc.uint('val', 8);
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

    function make() {
        var w = Wasabi.makeWasabi();
        w.addClass(Foo);
        w.addClass(Bar);
        return w;
    }

    return {
        make: make,
        Foo: Foo,
        Bar: Bar
    };
})();

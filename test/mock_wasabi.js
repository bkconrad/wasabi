var Wasabi = require(__dirname + '/..' + (process.env.COVERAGE ? '/src-cov' : '/src') + '/wasabi');
var assert = require('chai').assert;

module.exports = (function() {
    function Foo () {
        this.foobar = 1;
        this.signedbar = -1;
        this.floatbar = 0.618;
    };
    Foo.prototype = {
        constructor: Foo
      , serialize: function(desc) {
          desc.uint('foobar', 16);
          desc.sint('signedbar', 16);
          desc.float('floatbar', 8);
      }
      , check: function(that) {
          assert.equal(this.foobar, that.foobar);
      }
      , rpcTest: function rpcTest(val) {
        this.testval = val;
      }
      , rpcTestArgs: function(desc) {
        desc.uint('val', 16);
      }
    };

    function Bar () { this.barbar = 3};
    Bar.prototype = new Foo;
    Bar.prototype.constructor = Bar;
    Bar.prototype.serialize =  function(desc) {
        desc.uint('barbar', 16);
    }
    Bar.prototype.rpcBarTest = function rpcBarTest(val) {
        this.barval = val;
    }
    Bar.prototype.rpcBarTestArgs = function (desc) {
        desc.uint('val', 16);
    }

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

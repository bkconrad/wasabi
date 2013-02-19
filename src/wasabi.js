var Bitstream = require('./bitstream');
var Registry = require('./registry');
var Wasabi = (function () {
    function Wasabi () {
        this.registry = new Registry;
    }

    Wasabi.prototype = {
        Bitstream: Bitstream
      , Registry: Registry
      , packObjects: function (list, bs) {
          var i;
          for (i = 0; i < list.length; i++) {
              bs.writeUInt(this.registry.hash(list[i].constructor), 16);
          }
          bs.writeUInt(0, 16);
      }

      , unpackObjects: function (bs) {
          var hash = 0;
          var list = [];
          var type = undefined;
          while (true) {
              type = this.registry.lookup(bs.readUInt(16));
              if (!type) {
                  break;
              }
              list.push(new type);
          }
          return list;
      }
    };

    return Wasabi;
})();

module.exports = Wasabi;

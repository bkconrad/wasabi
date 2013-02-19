/*
 * Copyright (c) 2013 Bryan Conrad
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

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

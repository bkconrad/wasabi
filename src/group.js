/**
 * Group of objects used to manage visibility at a per-connection level.
 * Connections can have zero or more visibility groups.
 *
 *     var group = Wasabi.createGroup();
 *     var conn1 = Wasabi.addClient(socket1);
 *     var conn2 = Wasabi.addClient(socket2);
 *
 *     conn1.addGroup(group);
 *     conn2.addGroup(group);
 *     // foo will be sent to both connections
 *     group.addObject(foo);
 *
 * @class Group
 * @constructor
 */
function Group() {
    /**
     * The objects contained in this group
     * @property _objects
     * @type Array
     * @private
     */
    this._objects = {};
}

/**
 * Add an object to this group
 * @method addObject
 * @param {NetObject} obj The NetObject to add to this group. `obj` will be sent
 *     over all connections which have this group.
 */
Group.prototype.addObject = function (obj) {
    this._objects[obj.wsbSerialNumber] = obj;
};

/**
 * Remove an object from this group
 * @method removeObject
 * @param {NetObject|Number} obj The NetObject or serial number to remove from
 *     this group. The object will be removed from any connection which no
 *     longer has it through any group.
 */
Group.prototype.removeObject = function (arg) {
    var k;
    if(typeof arg === 'number') {
        arg = arg.toString();
    }

    for(k in this._objects) {
        if(this._objects.hasOwnProperty(k) && (k === arg || this._objects[k] === arg)) {
            delete this._objects[k];
        }
    }
};

module.exports = Group;
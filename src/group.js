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
    this._objects = [];
}

/**
 * Add obj to this group
 * @method addObject
 * @param {NetObject} obj The NetObject to add to this group. `obj` will be sent
 *     over all connections which have this group.
 */
Group.prototype.addObject = function (obj) {
    this._objects.push(obj);
};

/**
 * Remove obj from this group
 * @method removeObject
 * @param {NetObject|Number} obj The NetObject or index to remove from this
 *     group. `obj` will be removed from any connection which no longer has it
 *     through any group.
 */
Group.prototype.removeObject = function (obj) {
    var i;
    for (i = this._objects.length - 1; i >= 0; i--) {
        if (i === obj || this._objects[i] === obj) {
            this._objects.splice(i, 1);
        }
    }
};

module.exports = Group;
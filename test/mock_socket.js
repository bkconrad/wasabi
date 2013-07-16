function MockSocket() {
}

MockSocket.prototype = {
    link: function(other) {
        this._target = other;
        other._target = this;
    },
    send: function(data) {
        this._target._callback(data);
    },
    on: function(ev, callback) {
        this._callback = callback;
    }
};

module.exports = MockSocket;

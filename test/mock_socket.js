function MockSocket() {
}

MockSocket.prototype = {
    link: function(other) {
        this._target = other;
        other._target = this;
    },
    send: function(data) {
        this._target.onmessage(data);
    },
};

module.exports = MockSocket;

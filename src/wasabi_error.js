function WasabiError(message) {
    var err = new Error(message);
    this.message = message || 'Wasabi Error';
    this.stack = err.stack;
}

WasabiError.prototype = new Error();

module.exports = WasabiError;
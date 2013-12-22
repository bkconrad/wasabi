function WasabiError(message) {
	this.name = 'WasabiError';
	this.message = message || 'Wasabi Error';
};

WasabiError.prototype = Error;
WasabiError.prototype.constructor = WasabiError;

module.exports = WasabiError;
[![Build Status](https://travis-ci.org/kaen/wasabi.png?branch=master)](https://travis-ci.org/kaen/wasabi)
[![NPM version](https://badge.fury.io/js/wasabi.png)](http://badge.fury.io/js/wasabi)

# Wasabi

A simple then powerful replication library using binary encoding over WebSockets. Released under the MIT License.

    npm install wasabi

The main advantages of using Wasabi are:

 - All data is tightly packed as binary rather than JSON, with user-specified
   precision.
 - You only need to write a single short function per class to start replicating
 - Replicated object lifetimes can be managed based on a "scope" callback which
   may be set for each client (or not at all)
 - Remote RPC invocation works exactly like local function calls
 - Prototypal inheritance is fully supported out-of-the-box
 - You can get started without much boilerplate, then define additional
   functions to increase performance when you become production-ready
 - Reliable construction: A well-rounded test suite with [100% branch coverage](http://kaen.github.io/wasabi/cov/lcov-report/)

# Usage

For further reading, make sure to look at the [Guide](http://kaen.github.io/wasabi/) or the [API Docs on GitHub](http://kaen.github.io/wasabi/doc/), or build your own locally with `jake doc`.

# Contact
If you have bug reports, feature requests, questions, or pull requests, drop by
the [github repo](https://github.com/kaen/wasabi). If you have lavish praise or
eloquent maledictions, email me at [bkconrad@gmail.com](mailto:bkconrad@gmail.com).

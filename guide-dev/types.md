---
title: Types
layout: guide
category: concepts
---

To encode data as efficiently as possible, Wasabi has a concept of types. Types are used in `serialize` and `*Args` functions to explicitly describe the stucture of the data to be encoded. Using explicit types allows Wasabi to know how to encode or decode data without deducing its type and structure, and without encoding the *type* of the data along with the data itself.

Wasabi supports most JavaScript types, including integers, floating point numbers, strings, and Objects. Wasabi also provides an `any` type, which causes Wasabi to deduce and encode the type of a particular attribute.

For information about supported types, see the public `[InDescription]({{ site.baseurl }}/doc/classes/InDescription.html)` methods, which are API compatible to the `OutDescription` methods.

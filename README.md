mongoose-plugin-modified
====================

[![Build Status](https://travis-ci.org/CentralPing/mongoose-plugin-modified.svg?branch=master)](https://travis-ci.org/CentralPing/mongoose-plugin-modified)
[![Code Climate for CentralPing/mongoose-plugin-modified](https://codeclimate.com/github/CentralPing/mongoose-plugin-modified/badges/gpa.svg)](https://codeclimate.com/github/CentralPing/mongoose-plugin-modified)
[![Dependency Status for CentralPing/mongoose-plugin-modified](https://david-dm.org/CentralPing/mongoose-plugin-modified.svg)](https://david-dm.org/CentralPing/mongoose-plugin-modified)

A [mongoose.js](https://github.com/Automattic/mongoose/) plugin to capture document updates with timestamp and optional user identifier.

*The modification date is updated pre-validation if a monitored field has been modified*

## Installation

`npm i --save mongoose-plugin-modified`

## API Reference
**Example**
```js
var modifiedPlugin = require('mongoose-plugin-modified');
var schema = Schema({...});
schema.plugin(modifiedPlugin[, OPTIONS]);
```
<a name="module_mongoose-plugin-modified..options"></a>

### mongoose-plugin-modified~options
**Kind**: inner property of <code>[mongoose-plugin-modified](#module_mongoose-plugin-modified)</code>

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [options] | <code>object</code> |  |  |
| options.optionKey | <code>string</code> | <code>&quot;modified&quot;</code> | the path options key to mark paths for inclusion in monitoring for modification. If no paths are tagged, document modification is monitored. |
| [options.date] | <code>object</code> |  | options for configuring the path for storing the date. |
| options.date.path | <code>string</code> | <code>&quot;modified.date&quot;</code> | the path for storing the modified date. |
| options.date.options | <code>object</code> |  | property options to set (`type` will always be `Date`). `(e.g. {select: false})` |
| [options.by] | <code>object</code> |  | options for configuring the path for storing the modifier. |
| options.by.path | <code>string</code> | <code>&quot;modified.by&quot;</code> | the path for storing the document modifier. |
| options.by.ref | <code>string</code> |  | the reference model to use `(e.g. {by: {ref: 'ModelRefName'}})` |
| options.by.options | <code>object</code> |  | property options to set (if not a reference the `type` will always be `String`). `(e.g. {select: false})` |


## Examples

### With Monitoring Entire Document
```js
var modifiedPlugin = require('mongoose-plugin-modified');
var schema = Schema({foo: String});
schema.plugin(modifiedPlugin);

var Foo = mongoose.model('Foo', schema);
var foo = Foo.findOne(); // foo.modified --> {}
foo.foo = 'My update'; // foo.modified --> {}
foo.save(); // foo.modified --> {date: 'Wed May 05 2015 12:05:50 GMT-0400 (EDT)'}
```

### With Monitoring Selected Fields
```js
var modifiedPlugin = require('mongoose-plugin-modified');
var schema = Schema({
  foo: {
    type: String,
    modified: true // indicates to monitor this field for modification
  },
  bar: {
    type: String
  }
});
schema.plugin(modifiedPlugin);

var Foo = mongoose.model('Foo', schema);
var foo = Foo.findOne(); // foo.modified --> {}
foo.foo = 'My update'; // foo.modified --> {}
foo.save(); // foo.modified --> {date: 'Wed May 05 2015 12:05:50 GMT-0400 (EDT)'}

foo.bar = 'My other update'; // foo.modified --> {date: 'Wed May 05 2015 12:05:50 GMT-0400 (EDT)'}
foo.save(); // foo.modified --> {date: 'Wed May 05 2015 12:05:50 GMT-0400 (EDT)'}
            // modified.date is not updated
```

# License

Apache 2.0

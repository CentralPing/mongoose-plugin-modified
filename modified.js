var _ = require('lodash-node/modern');
var mongoose = require('mongoose');

module.exports = function lastModifiedPlugin(schema, options) {
  /* jshint eqnull:true */
  options = _.merge({
    optionKey: 'modified',
    datePath: 'modified.date',
    byPath: 'modified.by',
    byRef: undefined,
    expires: undefined
  }, options || {});

  var paths = Object.keys(schema.paths).filter(function (path) {
    var schemaType = schema.path(path);

    return schemaType.options && schemaType.options[options.optionKey];
  });

  if (paths.length === 0) { paths.push(undefined); }

  schema.path(options.datePath, {
    type: Date,
    select: false
  });

  if (options.expires) {
    schema.path(options.datePath).expires(options.expires);
  }

  if (options.byRef != null && !schema.path(options.byPath)) {
    schema.path(options.byPath, {
      type: mongoose.Schema.Types.ObjectId,
      ref: options.byRef,
      required: true,
      select: false
    });
  }

  schema.pre('save', function lastModifiedSave(next) {
    if (!this.isNew && paths.some(this.isModified, this)) {
      this.set(options.datePath, Date.now());
    }

    return next();
  });
};

var _ = require('lodash-node/modern');
var mongoose = require('mongoose');

module.exports = function lastModifiedPlugin(schema, options) {
  /* jshint eqnull:true */
  options = _.merge({
    paths: [undefined],
    datePath: 'modified.date',
    byPath: 'modified.by',
    byRef: undefined,
    expires: undefined
  }, options || {});

  if (!_.isArray(options.paths)) {
    // if `paths` is undefined, update modified timestamp on any document modification
    // if `paths` is a string, convert to an array
    options.paths = [options.paths];
  }

  // TODO: possibly check paths array for invalid inputs

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
    if (!this.isNew && options.paths.some(this.isModified, this)) {
      this.set(options.datePath, Date.now());
    }

    return next();
  });
};

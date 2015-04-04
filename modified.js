var _ = require('lodash-node/modern');

module.exports = function lastModifiedPlugin(schema, options) {
  /* jshint eqnull:true */
  options = _.merge({
    optionKey: 'modified',
    date: {
      path: 'modified.date',
      options: {}
    },
    by: {
      path: 'modified.by',
      ref: undefined,
      options: {}
    }
  }, options || {});

  var paths = Object.keys(schema.paths).filter(function (path) {
    var schemaType = schema.path(path);

    return schemaType.options && schemaType.options[options.optionKey];
  });

  // If no fields are flagged with the optionKey, monitor all fields
  if (paths.length === 0) { paths.push(undefined); }

  schema.path(options.date.path, _.defaults({
    type: Date
  }, options.date.options));

  if (options.by.path) {
    if (options.by.options.required === true) {
      options.by.options.required = function requiredCheck(val) {
        return !this.isNew && this.isModified(options.date.path);
      };
    }

    schema.path(options.by.path, _.defaults(
      options.by.ref ?
        {type: schema.constructor.Types.ObjectId, ref: options.by.ref} :
        {type: String},
      options.by.options)
    );
  }

  schema.pre('validate', function lastModifiedSave(next) {
    // check if at least one indicated field has been modified
    if (!this.isNew && paths.some(this.isModified, this)) {
      if (options.by.options.required && !this.isModified(options.by.path)) {
        this.invalidate(options.by.path, '{PATH} must be updated for document modification');
      }
      else {
        this.set(options.date.path, Date.now());
      }
    }

    return next();
  });
};

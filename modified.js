var _ = require('lodash-node/modern');
var mongoose = require('mongoose');

module.exports = function lastModifiedPlugin(schema, options) {
  /* jshint eqnull:true */
  options = _.assign({
    optionKey: 'modified',
    datePath: 'modified.date',
    dateOptions: {},
    byPath: 'modified.by',
    byRef: undefined,
    byOptions: {}
  }, options || {});

  var paths = Object.keys(schema.paths).filter(function (path) {
    var schemaType = schema.path(path);

    return schemaType.options && schemaType.options[options.optionKey];
  });

  // If no fields are flagged with the optionKey, monitor all fields
  if (paths.length === 0) { paths.push(undefined); }

  schema.path(options.datePath, _.assign({
    type: Date
  }, options.dateOptions));

  if (options.expires) {
    schema.path(options.datePath).expires(options.expires);
  }

  if (options.byPath != null && options.byPath !== '') {
    schema.path(options.byPath, _.assign(
      options.byRef != null ?
        {type: mongoose.Schema.Types.ObjectId, ref: options.byRef} :
        {type: String},
      options.byOptions)
    );
  }

  schema.pre('save', function lastModifiedSave(next) {
    // check if at least one indicated field has been modified
    if (!this.isNew && paths.some(this.isModified, this)) {
      this.set(options.datePath, Date.now());
    }

    return next();
  });
};

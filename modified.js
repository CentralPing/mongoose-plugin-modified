var _ = require('lodash-node/modern');

module.exports = function lastModifiedPlugin(schema, paths, index) {
  var missingPaths;

  if (!_.isArray(paths)) {
    // if `paths` is undefined, update modified timestamp on any document modification
    // if `paths` is a string, convert to an array
    paths = [paths];
  }

  // TODO: possibly check paths array for invalid inputs

  schema.add({
    modified: {
      date: {
        type: Date,
        select: false
      }
    }
  });

  schema.pre('save', function lastModifiedSave(next) {
    if (!this.isNew && paths.some(this.isModified, this)) {
      this.modified.date = new Date();
    }

    return next();
  });

  if (index) {
    schema.path('modified.date').index(index);
  }
};

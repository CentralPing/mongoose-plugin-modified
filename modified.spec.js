var mongoose = require('mongoose');
var faker = require('faker');
var modified = require('./modified');
var Schema = mongoose.Schema;
var connection;

// Mongoose uses internal caching for models.
// While {cache: false} works with most models, models using references
// use the internal model cache for the reference.
// This removes the mongoose entirely from node's cache
delete require.cache.mongoose;

var userData = {
  username: faker.internet.userName(),
  password: faker.internet.password(),
  name: {first: faker.name.firstName(), last: faker.name.lastName()},
  emails: [faker.internet.email()]
};

beforeAll(function (done) {
  connection = mongoose.createConnection('mongodb://localhost/unit_test');
  connection.once('connected', function () {
    done();
  });
});

afterAll(function (done) {
  connection.db.dropDatabase(function (err, result) {
    connection.close(function () {
      done();
    });
  });
});

describe('Mongoose plugin: modified', function () {
  describe('with plugin declaration', function () {
    var schema;

    beforeEach(function () {
      schema = UserSchema();
    });

    it('should add `modified.date` and `modified.by` to the schema', function () {
      schema.plugin(modified);
      expect(schema.pathType('modified.date')).toBe('real');
      expect(schema.pathType('modified.by')).toBe('real');
      expect(schema.path('modified.by').instance).toBe('String');
    });

    it('should add `modified.date` and a reference for `modified.by` to the schema', function () {
      schema.plugin(modified, {byRef: 'User'});
      expect(schema.pathType('modified.date')).toBe('real');
      expect(schema.pathType('modified.by')).toBe('real');
      expect(schema.path('modified.by').instance).toBe('ObjectID');
    });

    it('should add `modifiedBy` and `modifiedDate` to the schema', function () {
      schema.plugin(modified, {byPath: 'modifiedBy', datePath: 'modifiedDate'});
      expect(schema.pathType('modifiedDate')).toBe('real');
      expect(schema.pathType('modifiedBy')).toBe('real');
    });

    it('should only add `modified.date` to the schema with `byPath` set to `null`', function () {
      schema.plugin(modified, {byPath: null});
      expect(schema.pathType('modified.date')).toBe('real');
      expect(schema.pathType('modified.by')).toBe('adhocOrUndefined');
    });

    it('should only add `modified.date` to the schema with `byPath` set to `undefined`', function () {
      schema.plugin(modified, {byPath: undefined});
      expect(schema.pathType('modified.date')).toBe('real');
      expect(schema.pathType('modified.by')).toBe('adhocOrUndefined');
    });

    it('should only add `modified.date` to the schema with `byPath` set to empty string', function () {
      schema.plugin(modified, {byPath: ''});
      expect(schema.pathType('modified.date')).toBe('real');
      expect(schema.pathType('modified.by')).toBe('adhocOrUndefined');
    });

    it('should make `modified.by` required with options', function () {
      schema.plugin(modified, {byOptions: {required: true}});
      expect(schema.path('modified.by').isRequired).toBe(true);
    });
  });

  describe('with initial document creation', function () {
    var user;

    it('should compile the model with the modified plugin', function () {
      var User;
      var schema = UserSchema();
      schema.plugin(modified);

      User = model(schema);
      expect(User).toEqual(jasmine.any(Function));

      user = new User(userData);
      expect(user instanceof User).toBe(true);
    });

    it('should not set `modified.date`', function () {
      expect(user.modified.date).toBeUndefined();
    });

    it('should not set `modified.date` on initial save', function (done) {
      user.save(function (err, user) {
        expect(user.modified.date).toBeUndefined();
        done();
      });
    });
  });

  describe('with document manipulations', function () {
    var User;

    it('should compile the model with the modified plugin', function () {
      var schema = UserSchema();
      schema.plugin(modified);

      User = model(schema);
      expect(User).toEqual(jasmine.any(Function));
    });

    it('should update `modified.date` on subsequent saves', function (done) {
      User(userData).save(function (err, user) {
        user.username = faker.internet.userName();

        user.save(function (err, user) {
          expect(user.modified.date).toBeDefined();
          expect(user.modified.date).toBeGreaterThan(user.created);
          done();
        });
      });
    });
  });

  describe('with specific paths', function () {
    var User;
    var user;

    it('should compile the model with the modified plugin', function () {
      var schema = UserSchema();
      schema.path('name.first').options.modified = true;
      schema.plugin(modified);

      User = model(schema);
      expect(User).toEqual(jasmine.any(Function));
    });

    it('should not update `modified.date` on saves without matched path modified', function (done) {
      User(userData).save(function (err, user) {
        user.username = faker.internet.userName();

        user.save(function (err, user) {
          expect(user.modified.date).toBeUndefined();
          done();
        });
      });
    });

    it('should not update `modified.date` on saves without matched path modified', function (done) {
      User(userData).save(function (err, user) {
        user.name.last = faker.name.lastName();

        user.save(function (err, user) {
          expect(user.modified.date).toBeUndefined();
          done();
        });
      });
    });

    it('should update `modified.date` on saves with matched path modified', function (done) {
      User(userData).save(function (err, user) {
        user.name.first = faker.name.firstName();

        user.save(function (err, user) {
          expect(user.modified.date).toBeDefined();
          expect(user.modified.date).toBeGreaterThan(user.created);
          done();
        });
      });
    });
  });
});

function model(name, schema) {
  if (arguments.length === 1) {
    schema = name;
    name = 'Model';
  }

  // Specifying a collection name allows the model to be overwritten in
  // Mongoose's model cache
  return connection.model(name, schema, name);
}

function UserSchema() {
  return Schema({
    username: String,
    password: String,
    name: {
      first: String,
      last: String
    },
    emails: [String],
    created: {type: Date, 'default': Date.now}
  });
}

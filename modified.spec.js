var mongoose = require('mongoose');
var modified = require('./modified');
var Schema = mongoose.Schema;
var connection;

// Mongoose uses internal caching for models.
// While {cache: false} works with most models, models using references
// use the internal model cache for the reference.
// This removes the mongoose entirely from node's cache
delete require.cache.mongoose;

var userData = {
  username: 'foo',
  password: 'password',
  name: {first: 'Foo', last: 'Bar'},
  emails: ['foo@example.com']
};

describe('Mongoose plugin: modified', function () {
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

  describe('with plugin declaration', function () {
    var schema;

    beforeEach(function () {
      schema = UserSchema();
    });

    it('should add `modified.date` to the schema for all paths', function () {
      expect(function () { schema.plugin(modified); }).not.toThrow();
      expect(schema.path('modified.date')).toBeDefined();
    });

    it('should add `modified.date` to the schema for single path', function () {
      expect(function () { schema.plugin(modified, 'name'); }).not.toThrow();
      expect(schema.path('modified.date')).toBeDefined();
    });

    it('should add `modified.date` to the schema for paths in array', function () {
      expect(function () { schema.plugin(modified, ['name.first', 'name.last']); }).not.toThrow();
      expect(schema.path('modified.date')).toBeDefined();
    });
  });

  describe('with initial document creation', function () {
    var user;

    it('should compile the model with the created plugin', function () {
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

    it('should compile the model with the created plugin', function () {
      var schema = UserSchema();
      schema.plugin(modified);

      User = model(schema);
      expect(User).toEqual(jasmine.any(Function));
    });

    it('should update `modified.date` on subsequent saves', function (done) {
      User(userData).save(function (err, user) {
        user.username = 'bar';

        user.save(function (err, user) {
          expect(user.modified.date).toBeDefined();
          expect(user.modified.date).toBeGreaterThan(user.created);
          done();
        });
      });
    });
  });

  describe('with a specific path', function () {
    var User;
    var user;

    it('should compile the model with the created plugin', function () {
      var schema = UserSchema();
      schema.plugin(modified, 'name');

      User = model(schema);
      expect(User).toEqual(jasmine.any(Function));
    });

    it('should not update `modified.date` on saves without matched path modified', function (done) {
      User(userData).save(function (err, user) {
        user.username = 'bar';

        user.save(function (err, user) {
          expect(user.modified.date).toBeUndefined();
          done();
        });
      });
    });

    it('should update `modified.date` on saves with matched path modified', function (done) {
      User(userData).save(function (err, user) {
        user.name.first = 'Fah';

        user.save(function (err, user) {
          expect(user.modified.date).toBeDefined();
          expect(user.modified.date).toBeGreaterThan(user.created);
          done();
        });
      });
    });

    it('should update `modified.date` on saves with matched subpath modified', function (done) {
      User(userData).save(function (err, user) {
        user.name.last = 'Bah';

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

    it('should compile the model with the created plugin', function () {
      var schema = UserSchema();
      schema.plugin(modified, ['name.first', 'name.last']);

      User = model(schema);
      expect(User).toEqual(jasmine.any(Function));
    });

    it('should not update `modified.date` on saves without matched path modified', function (done) {
      User(userData).save(function (err, user) {
        user.username = 'bar';

        user.save(function (err, user) {
          expect(user.modified.date).toBeUndefined();
          done();
        });
      });
    });

    it('should update `modified.date` on saves with matched path modified', function (done) {
      User(userData).save(function (err, user) {
        user.name.first = 'Fah';

        user.save(function (err, user) {
          expect(user.modified.date).toBeDefined();
          expect(user.modified.date).toBeGreaterThan(user.created);
          done();
        });
      });
    });

    it('should update `modified.date` on subsequent saves with matched path modified', function (done) {
      User(userData).save(function (err, user) {
        user.name.last = 'Bah';

        user.save(function (err, user) {
          var date = user.modified.date;

          expect(date).toBeDefined();
          expect(date).toBeGreaterThan(user.created);

          user.name.first = 'Fah';

          user.save(function (err, user) {
            expect(user.modified.date).toBeDefined();
            expect(user.modified.date).toBeGreaterThan(date);
            done();
          });
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

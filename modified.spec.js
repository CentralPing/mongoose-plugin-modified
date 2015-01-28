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

    it('should make `modified.by` required by default', function () {
      expect(function () { schema.plugin(modified, {byRef: 'User'}); }).not.toThrow();
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
        user.username = 'bar';

        user.save(function (err, user) {
          expect(user.modified.date).toBeDefined();
          expect(user.modified.date).toBeGreaterThan(user.created);
          done();
        });
      });
    });
  });

  describe('with document expirations', function () {
    var User;
    var originalTimeout;

    beforeAll(function () {
      // Need to extend the Jasmine timeout to allow for 60+ seconds
      // for MongoDB to purge the expired documents
      // http://docs.mongodb.org/manual/tutorial/expire-data/
      originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
      jasmine.DEFAULT_TIMEOUT_INTERVAL = 120000;
    });

    afterAll(function () {
      jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
    });

    it('should compile the model with the modified plugin', function () {
      var schema = UserSchema();
      schema.plugin(modified, {expires: 5});
      User = model(schema);

      expect(User).toEqual(jasmine.any(Function));
    });

    it('should not delete unmodified document after expiration', function (done) {
      User(userData).save(function (err, user) {
        setTimeout(function () {
          User.findById(user._id, function (err, user) {
            expect(err).toBe(null);
            expect(user).toEqual(jasmine.any(Object));
          });
        }, 2500);

        setTimeout(function () {
          User.findById(user._id, function (err, user) {
            expect(err).toBe(null);
            expect(user).toEqual(jasmine.any(Object));

            done();
          });
        }, 100000);
      });
    });

    it('should delete modified document after expiration', function (done) {
      User(userData).save(function (err, user) {
        setTimeout(function () {
          User.findById(user._id, function (err, user) {
            expect(err).toBe(null);
            expect(user).toEqual(jasmine.any(Object));

            // trigger modified date to be set
            user.username = 'bar';
            user.save();
          });
        }, 2500);

        setTimeout(function () {
          User.findById(user._id, function (err, user) {
            expect(err).toBe(null);
            expect(user).toEqual(jasmine.any(Object));

            done();
          });
        }, 100000);
      });
    });
  });

  describe('with a specific path', function () {
    var User;
    var user;

    it('should compile the model with the modified plugin', function () {
      var schema = UserSchema();
      schema.plugin(modified, {paths: 'name'});

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

    it('should compile the model with the modified plugin', function () {
      var schema = UserSchema();
      schema.plugin(modified, {paths: ['name.first', 'name.last']});

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

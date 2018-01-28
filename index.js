/*!
 * Bookshelf-Entity
 *
 * Copyright 2017-2018 Josh Swan
 * Released under the MIT license
 * https://github.com/joshswan/bookshelf-entity/blob/master/LICENSE
 */

const Entity = require('json-entity');
const extend = require('lodash/extend');
const has = require('lodash/has');
const isObject = require('lodash/isObject');

/**
 * Recursively auto-detect unloaded relations based on exposed properties on the provided entity.
 * Note: Depending on how your relationships are defined on the model, this may or may not work.
 * @param  {Entity} entity      Entity specified for representing the model instance
 * @param  {Model}  model       The model instance
 * @param  {String} [prefix=''] Relation nesting prefix for recursion
 * @return {Array}              Array of relations that should be loaded
 */
function detectRelationsToLoad(entity, model, prefix = '') {
  if (!entity) return [];

  return entity.properties.reduce((relations, property) => {
    const { key, using } = property;

    if (using) {
      if (!model || (!has(model.relations, key) && model[key])) {
        relations.push(`${prefix}${key}`);
      }

      relations.push(...detectRelationsToLoad(using, model && model.relations[key], `${prefix}${key}.`));
    }

    return relations;
  }, []).filter(Boolean);
}

/**
 * Recursively checks models for relations that are exposed on the provided entity without a
 * "using" option specified to control the exposed properties of the relation. This safety check
 * can be disabled by setting `model.prototype.entitySafeMode` to `false`
 * @param  {Entity} entity Entity specified for representing the model instance
 * @param  {Model}  model  The model instance
 * @throws {Error}
 */
function performSafetyCheck(entity, model) {
  Object.keys(model.relations || {}).forEach((relation) => {
    // Check for exposed properties matching relation
    entity.properties.forEach((property) => {
      // Throw an error if a "using" option isn't specified as this could lead to unintended
      // data leaks since the entire relation would be exposed!
      if (relation === property.key) {
        if (!property.using) {
          throw new Error(`Entity has an exposed relation "${relation}" that does not have a "using" option specified!`);
        }

        // Perform safety check on relations recursively
        performSafetyCheck(property.using, model.relations[relation]);
      }
    });
  });
}

module.exports = (bookshelf) => {
  const CollectionBase = bookshelf.Collection;
  const ModelBase = bookshelf.Model;

  /**
   * Make bookshelf.Entity available for extending. Create new Entities by extending this Entity or
   * use json-entity directly to create Entities.
   * @type {Entity}
   */
  bookshelf.Entity = new Entity();

  bookshelf.Model = ModelBase.extend({
    /**
     * Specify a defaultEntity on a model to use as a fallback if no entity is specified when
     * calling toJSON
     * NOTE: This entity is NOT used for relations! You must specify a `using` option for relation
     * properties on your entity or an error will be thrown. (I.e. if you have an address relation
     * on your user model, the defaultEntity of the address model will not be used. Instead your
     * user entity should specify address: { using: AddressEntity }).
     * @type {Entity}
     */
    defaultEntity: null,

    /**
     * Whether to perform relation checks and throw an error if a relation is exposed without a
     * "using" option to specify an Entity. This prevents unintentional data leaks since toJSON
     * returns the full relation representation and without an entity, the entire relation object
     * would be exposed! DISABLE AT YOUR OWN RISK!!!
     * @type {Boolean}
     */
    entitySafeMode: true,

    /**
     * Serialize model using entity specified in options object or this.defaultEntity. If no Entity
     * is specified, nothing will be exposed, thus providing more control over output than toJSON.
     * Note: This method returns a Promise and will automatically attempt to detect and load any
     * unloaded and exposed relations. Safe mode is also disabled by default so an error will be
     * thrown if the model is missing any attributes/relations that are supposed to be exposed.
     * @param  {Object}  [options={}] Options to be passed to Entities and their functions
     * @return {Promise}
     */
    present(options = {}) {
      // Ensure options is an object
      const opts = isObject(options) ? options : {};
      const entity = opts.entity || opts.with || opts.using || this.defaultEntity;

      if (!entity) return Promise.resolve(undefined);

      return Promise.resolve().then(() => {
        const relations = detectRelationsToLoad(entity, this);

        return relations ? this.load(relations) : this;
      }).then(() => this.represent(entity, extend({ safe: false }, opts)));
    },

    /**
     * Alias for present method
     * @param  {Object}  [options={}] Options to be passed to Entities and their functions
     * @return {Promise}
     */
    render(options = {}) {
      return this.present(options);
    },

    /**
     * Use specified entity to serialize model data. Only whitelisted/exposed properties specified
     * in the Entity will be exposed in the output. The options obect will be passed through to any
     * if/value functions and nested Entities.
     * @param  {Entity} entity  Entity to use for serialization
     * @param  {Object} options Options to pass to Entities and their functions
     * @return {Object}
     */
    represent(entity, options = {}) {
      // Output nothing if no entity specified
      if (!entity) return undefined;

      // Perform safety check on relations if entitySafeMode enabled
      if (this.entitySafeMode && !options.shallow) performSafetyCheck(entity, this);

      return entity.represent(ModelBase.prototype.toJSON.call(this, options), options);
    },
  });

  bookshelf.Collection = CollectionBase.extend({
    /**
     * Serialize collection using entity specified in options object or the model's defaultEntity.
     * If no Entity is specified, any empty array will be returned, thus providing more control
     * over output than toJSON. Note: This method returns a Promise and will automatically attempt
     * to detect and load any unloaded and exposed relations. Safe mode is also disabled by default
     * so an error will be thrown if any of the models are missing any attributes/relations that
     * are supposed to be exposed.
     * @param  {Object}  [options={}] Options to be passed to Entities and their functions
     * @return {Promise}
     */
    present(options = {}) {
      // Ensure options is an object
      const opts = isObject(options) ? options : {};
      const entity = opts.entity || opts.with || opts.using || this.model.prototype.defaultEntity;

      if (!entity || !this.size()) return Promise.resolve([]);

      return Promise.resolve().then(() => {
        const relations = detectRelationsToLoad(entity, this.first());

        return relations ? this.load(relations) : this;
      }).then(() => this.represent(entity, extend({ safe: false }, opts)));
    },

    /**
     * Alias for present method
     * @param  {Object}  [options={}] Options to be passed to Entities and their functions
     * @return {Promise}
     */
    render(options = {}) {
      return this.present(options);
    },

    /**
     * Use specified entity to serialize collection data. Only whitelisted/exposed properties
     * specified in the Entity will be exposed in the outputted objects. The options obect will be
     * passed through to any if/value functions and nested Entities.
     * @param  {Entity} entity  Entity to use for serialization
     * @param  {Object} options Options to pass to Entities and their functions
     * @return {Object}
     */
    represent(entity, options = {}) {
      // Output nothing if no entity specified
      if (!entity) return [];

      // Perform safety check on relations if entitySafeMode enabled
      if (this.model.prototype.entitySafeMode && !options.shallow) {
        // Loop through all models
        this.models.forEach(model => performSafetyCheck(entity, model));
      }

      return entity.represent(CollectionBase.prototype.toJSON.call(this, options), options);
    },
  });
};

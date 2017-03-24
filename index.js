/*!
 * Bookshelf-Entity
 *
 * Copyright 2017 Josh Swan
 * Released under the MIT license
 * https://github.com/joshswan/bookshelf-entity/blob/master/LICENSE
 */

const Entity = require('json-entity');
const isObject = require('lodash/isObject');

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
      if (this.entitySafeMode && !options.shallow) {
        // Loop through relations set on model
        Object.keys(this.relations).forEach((relation) => {
          // Check for exposed properties matching relation
          entity.properties.forEach((property) => {
            // Throw an error if a "using" option isn't specified as this could lead to unintended
            // data leaks since the entire relation would be exposed!
            if (relation === property.key && !property.using) {
              throw new Error(`Entity has an exposed relation "${relation}" that does not have a "using" option specified!`);
            }
          });
        });
      }

      return entity.represent(ModelBase.prototype.toJSON.call(this, options), options);
    },

    /**
     * Override standard toJSON method to use model.represent. The Entity to be used for
     * serialization can be specified in the options object, or it will use defaultEntity as a
     * fallback if it is set on the model. If no Entity is specified, nothing will be exposed for
     * security reasons. The options object will be passed directly to the Entity's represent
     * function, which will pass it along to any if/value functions and nested Entities.
     * @param  {Object} options Options to be passed to Entities and their functions
     * @return {Object}
     */
    toJSON(options = {}) {
      // Ensure options is an object
      const opts = isObject(options) ? options : {};

      // Check for root entity flag
      if (!opts.entityRoot) {
        // Set flag to avoid calling represent on relations (Bookshelf recursively calls toJSON on
        // nested relations leading to issues if represent is called at each level)
        opts.entityRoot = true;

        // Call represent using the specified entity or default entity
        return this.represent(opts.entity || this.defaultEntity, opts);
      }

      // Return all attributes for nested relations (represent will be recursively applied from
      // the root model anyway)
      return ModelBase.prototype.toJSON.call(this, opts);
    },
  });

  bookshelf.Collection = CollectionBase.extend({
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
        this.models.forEach((model) => {
          // Loop through relations set on model
          Object.keys(model.relations).forEach((relation) => {
            // Check for exposed properties matching relation
            entity.properties.forEach((property) => {
              // Throw an error if a "using" option isn't specified as this could lead to unintended
              // data leaks since the entire relation would be exposed!
              if (relation === property.key && !property.using) {
                throw new Error(`Entity has an exposed relation "${relation}" that does not have a "using" option specified!`);
              }
            });
          });
        });
      }

      // Serialize collection and remove any falsy values from the resulting array. Since
      // JSON.stringify convers `undefined` to `null` when in an array, we want to make sure we
      // don't leak any info about models that were not included in output.
      const collection = CollectionBase.prototype.toJSON.call(this, options).filter(Boolean);

      return entity.represent(collection, options);
    },

    /**
     * Override collection.toJSON to apply Entity.represent recursively from the collection level.
     * Since the first model to serialize sets the root entity flag, subsequent models would have
     * all attributes exposed due to the flag in the shared options object. Therefore, we block
     * models from invoking represent on themselves and instead apply represent to the entire
     * collection.
     * @param  {Object} options Options to be passed to Entities and their functions
     * @return {Array}
     */
    toJSON(options = {}) {
      // Ensure options is an object
      const opts = isObject(options) ? options : {};

      // Check for root entity flag
      if (!opts.entityRoot) {
        // Set flag to avoid models attempting to call represent individually as we'll apply the
        // entity from the collection level to ensure coverage
        opts.entityRoot = true;

        // Call represent using the specified entity or default entity
        return this.represent(opts.entity || this.model.prototype.defaultEntity, opts);
      }

      // Return normal serialize output for nested collections (represent will be recursively
      // applied from the root level anyway)
      return CollectionBase.prototype.toJSON.call(this, opts);
    },
  });
};

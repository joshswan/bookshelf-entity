/*!
 * Bookshelf-Entity
 *
 * Copyright 2017 Josh Swan
 * Released under the MIT license
 * https://github.com/joshswan/bookshelf-entity/blob/master/LICENSE
 */

const Entity = require('json-entity');

module.exports = (bookshelf) => {
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
     * @type {Entity}
     */
    defaultEntity: null,

    /**
     * Use specified entity to serialize model data. Only whitelisted/exposed properties specified
     * in the Entity will be exposed in the output. The options obect will be passed through to any
     * if/value functions and nested Entities.
     * @param {Entity}  entity  Entity to use for serialization
     * @param {Object}  options Options to pass to Entities and their functions
     * @return {Object}
     */
    represent(entity, options = {}) {
      // Output nothing if no entity specified
      if (!entity) return undefined;

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
      return this.represent(options.entity || this.defaultEntity, options);
    },
  });
};

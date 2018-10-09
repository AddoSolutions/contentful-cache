class Content {

    /**
     * Let's get this party started
     * @param options
     */
    constructor(options) {

        var defaultOptions = {
            "source": {
                "source": "contentful",     // Which service you will be retreiving data from (right now just contentful)
                "options": {
                    "space": null,          // Enter the spaceID for the given contentful space (ex: l6venjzzzzzz)
                    "accessToken": null,    // The API access token
                    "logger": function (level, data) {
                    },
                }
            },
            "cache": {
                "method": "mongodb",    // What method would you like to use for your sync?
                "options": {
                    "connection": "mongodb://localhost:27017/contentful", // The mongoDB connection string
                }
            },
            "beforeStorage": function (collection, data) {
                return data
            }, // Want to do something special to your data before storing your data?
            "beforeContent": function (collection, data) {
                return data
            }, // Want to do something special to your data before relating your data?
            "beforeRelationshipMapping": function (collection, data) {
                return data
            }, // Want to do something special to your data before returning "getContent" data? Perhaps modelify it?
            "updateListener": {
                port: 33257,            // This will be the port that we listen on for updates from contentful
                //host: "0.0.0.0",        // And the IP we bind to for that listener
                enabled: true           // Don't want this? Set this to false
            },
            "syncAssets": true,          // Whether to sync the remtoe assets content as well (we are not syncing the actual file data)
            "whitelist": false,          // Collections you ONLY want (array of strings)
            "blacklist": false,          // Collections you DO NOT want (array of strings)Ω
            "noMemcache": false,
            "restructureData": true     // Whether to re-establish relations when loading from cache

        }

        this.options = Object.assign(defaultOptions, options);

        this._initListener();
    }

    /**
     * Perform full sync operation, returns upon completion
     * @returns {Promise.<void>}
     */
    async sync() {

        try {

            // First make sure we are connected to the cache datasource
            var cache = await this._getCache();

            // Now connect to the source
            var source = await this._getSource();

            // Get the data we are planning to store
            var records = await source.getRecords();

            records = await this._objectMorph(records, this.options.beforeRelationshipMapping);

            // Connect all the dots
            source.arrangeRelationships(records);

            // Allow user modification before storage
            records = await this._objectMorph(records, this.options.beforeStorage);

            // And finally, store it :)
            await cache.store(records);

            // And then mark the the memory cache as dirty
            this.bustCache();
        } catch (e) {
            console.error(e);
            throw e;
        }
    }


    /**
     * Get the all the cached content
     * @returns {Promise.<*>}
     */
    async getContent() {

        if (this.options.noMemcache) {
            return await this._getContent({});
        }

        // If we already have the content in a stored memory, just return that
        if (this.content && this.contentUpdated) return this.content;

        if (!this.content) this.content = {};
        this.contentUpdated = true;

        // Now we get the data from the cache source
        return await this._getContent(this.content);
    }

    /**
     * Actually get the content
     * @returns {Promise.<void>}
     * @private
     */
    async _getContent(content){
        await (await this._getCache()).getAll(content);
        await this._objectMorph(content, this.options.beforeContent);
        if(this.options.restructureData){
            return (await this._getCache()).restrucureData(content);
        }else{
            return content;
        }

    }

    /**
     * If we need to invalidate the current cache, do it here
     */
    bustCache() {
        if(this.content) this.contentUpdated = false;
    }


    /**
     * Apply `f` to each infidivual record in the records object
     * @param records
     * @param f
     * @private
     */
    async _objectMorph(records, f){
        try {
            for (var type in records) {
                if(!Array.isArray(records[type])) continue;
                records[type] = await Promise.all(records[type].map(async (obj) => {
                    // Before we finally store this object, we want to let the user morph it to their desired extent
                    try {
                        return f(type, obj);
                    } catch (e) {
                        console.error(e);
                        return undefined;
                    }
                }));
            }
        }catch(e){
            console.error(e);
        }
        return records;
    }


    /**
     * Initialize and retreive our cache connection
     * @returns {Promise.<*>}
     * @private
     */
    async _getCache() {
        if (!this._cache) {
            this._cache = new (require("./lib/caches/" + this.options.cache.method))(this.options.cache.options, this);
            await this._cache.connect();
        }
        return this._cache;
    }

    /**
     * Initialize and retreive our data source connection
     * @returns {Promise.<*>}
     * @private
     */
    async _getSource() {
        if (!this._source) {
            this._source = new (require("./lib/sources/" + this.options.source.source))(this.options.source.options, this);
            await this._source.connect();
        }
        return this._source;
    }

    /**
     * Start port listening for API call to refresh data
     * @private
     */
    _initListener() {
        var options = this.options.updateListener;

        // Don't bother if we are not enabled
        if (!options || !options.enabled) return;

        var http = require("http");


        const requestHandler = async (request, response) => {

            var respond = false;

            if (request.url == "/sync/" + this.options.source.source) {
                console.log("Received request to re-sync with " + this.options.source.source);
                this.sync();
                respond = {success: true};
            } else {
                console.log("Received invalid sync request");
                respond = {success: false};
            }
            ;

            response.end(JSON.stringify(respond));

        }

        const server = http.createServer(requestHandler)

        server.listen(options.port, (err) => {
            if (err) {
                return console.log('Whoops! Something bad happened', err)
            }

            console.log(`Sync is listening on ${options.port}`)
        })

    }


}


module.exports = Content;
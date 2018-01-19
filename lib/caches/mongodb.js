var MongoClient = require('mongodb').MongoClient
    , assert = require('assert');

var connection = false;


class MongoDB {

    /**
     * Initialize connector with provided options
     * @param options {}
     */
    constructor(options, parent) {

        var defaultOptions = {
            "connection": "mongodb://localhost:27017/notacms" // The mongoDB connection string
        }
        this.options = Object.assign(defaultOptions, options);
        console.log(this.options);
        this.parent = parent;
    }

    /**
     * Connect to datasource (if applicable)
     * @returns {Promise.<*>}
     */
    connect() {

        if (this.db) return this.db;
        this.db = false;

        // Connection URL
        var url = this.options.connection;

        return new Promise((resolve, reject) => {
            try {
                MongoClient.connect(url, (err, db) => {
                    assert.equal(null, err);
                    //console.log("Connected to MongoDB");
                    this.db = db;
                    resolve(db);
                });
            } catch (e) {
                console.error(e);
                reject(e);
            }
        })
    }

    /**
     * Perform the task of taking the records, and storing them however you'd like.
     * @param records
     * @returns {Promise.<void>}
     */
    async store(records) {
        try {

            // Make sure we are connected
            await this.connect();

            for (var type in records) {

                console.log("Updating all records for: " + type);

                var collection = this.db.collection(type);
                await collection.remove({});


                collection.createIndex({contentId: 1});
                collection.createIndex({slug: 1});

                await collection.insertMany(records[type]);

            }
        } catch (e) {
            console.error(e);
            throw e;
        }
    }

    /**
     * Return all of the cached records
     * @returns {Promise.<{}>}
     */
    async getAll(content) {

        var collections = await this.db.listCollections().toArray();



        await Promise.all(collections.map(async (collection) => {
            content[collection.name] = await this.db.collection(collection.name).find().toArray();
        }));

        return content;
    }


}

module.exports = MongoDB;
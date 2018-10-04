const contentful = require('contentful')


class Contentful {

    constructor(options, parent) {
        var defaultOptions = {
            "space": null,          // Enter the spaceID for the given contentful space (ex: l6venjzzzzzz)
            "accessToken": null,    // The API access token
            "logger": function (level, data) {
            }
        }


        this.options = Object.assign(defaultOptions, options);
        this.parent = parent;
    }

    /**
     * Called by parent method to initialize connection with API
     * @returns {Promise.<{}>}
     */
    connect() {

        if (!this.options.space || !this.options.accessToken) {
            throw new Error("No contentful config provided! This is required for an app… called: contentful-cache :)");
        }

        this.client = contentful.createClient({
            // This is the space ID. A space is like a project folder in Contentful terms
            space: this.options.space,
            // This is the access token for this space. Normally you get both ID and the token in the Contentful web app
            accessToken: this.options.accessToken,
            logHandler: this.options.logger
        });

    }

    /**
     * Called by parent method to retreive all the records to be stored
     * @returns {Promise.<{}>}
     */
    async getRecords() {


        // Now we have the contentful package get all the data from the contentful main API
        var sync = await this.client.sync({initial: true});

        var store = {};

        // Loop through all the actual content types and separate them out
        sync.entries.forEach((entry) => {
            var type = entry.sys.contentType.sys.id;
            if (!store[type]) store[type] = [];
            store[type].push(this.processRecord(entry, type));
        });

        // Process the assets
        sync.assets.forEach((entry) => {
            var type = entry.sys.type;
            if (!store[type]) store[type] = [];
            store[type].push(this.processRecord(entry, type));
        });

        return store;
    }

    /**
     * Connect the various relationships together
     * @param store
     */
    arrangeRelationships(store){
        // Now we go and do relation mapping
        for (var type in store) {
            store[type].forEach((entry) => {
                for (var property in entry) {
                    if (property == "sys") continue;
                    if (Array.isArray(entry[property])) {
                        entry[property] = entry[property].map(i => this.processRelation(i, type, property, entry, store));
                    } else if (typeof entry[property] === 'object') {
                        entry[property] = this.processRelation(entry[property], type, property, entry, store);
                    }
                }
            })
        }

        return store;
    }


    processRecord(entry, type) {
        var row = {};

        row.contentId = entry.sys.id;
        row.sys = entry.sys;

        for (var i in entry.fields) {
            row[i] = entry.fields[i]['en-US'];
        }

        ["createdAt", "updatedAt", "revision"].forEach(function (name) {
            row[name] = entry.sys[name];

        });


        return row;
    }

    processRelation(entry, type, property, parentEntry, store) {

        if (!entry || !entry.sys || !entry.sys.id) return entry;

        try {
            var relationType = entry.sys.type;
            if (entry.sys.contentType) {
                relationType = entry.sys.contentType.sys.id
            }

            if (store[relationType]) {
                return store[relationType].filter(entrySearch => entrySearch.contentId == entry.sys.id)[0];
            } else {
                console.log(`Warning: No such mapping from ${type}[${property}] to ${relationType}`);
                return entry;
            }
        } catch (e) {
            console.error(e);
            return entry;
        }

    }
}

module.exports = Contentful;
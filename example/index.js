const express = require('express');
const expressNunjucks = require('express-nunjucks');
const NotaCMS = require("..");
const config = require("./config")

const isDev = !process.env.APP_PROD; // If you add this it will go to production mode

async function main(){

    const app = express();

    const notaCMS = new NotaCMS({
        "source": {
            "source": "contentful",     // Which service you will be retreiving data from (right now just contentful)
            "options": {
                "space": config.space,          // Enter the spaceID for the given contentful space (ex: l6venjzzzzzz)
                "accessToken": config.accessToken,    // The API access token
                "logger": function (level, data) {
                    console.log(level + ": " + data); // Your own custom logging method
                }
            },
        },
        "cache": {
            "method": "mongodb",    // What method would you like to use for your sync?
            "options": {
                "connection": config.mongo, // The mongoDB connection string
            }
        },
        beforeStorage:(collection,obj)=>{
            obj.a=1;
            obj.c=collection;
            return obj;
        },
        beforeContent:(collection,obj)=>{
            obj.a++;
            return obj;
        }
    });

    //await notaCMS.sync();


    // Configure static resources directory
    app.use(express.static('./static'))

    app.set('views', './templates');

    const njk = expressNunjucks(app, {
        watch: isDev,
        noCache: isDev
    });

    app.get('/somethingspecial', (req, res) => {
        return JSON.stringify({"somethingCoolHappened":"Yup"});
    });

    app.get('*', async function(req, res) {
        var content = await notaCMS.getContent();

        // Check if we need an initial sync
        if(content.pages){
            await notaCMS.sync();
            content = await notaCMS.getContent();
        }


        var pages = content.page;
        var url = req.url;
        var selectedPage = {
            "file":"404"
        }

        if(url=="/") url="/index";

        pages.forEach((page)=>{
            if(page.slug == url.substring(1)){
                selectedPage = page;
                return true;
            }
        })

        return res.render(selectedPage.file, {
            content: notaCMS.getContent(),
            page: selectedPage
        })



    });

    app.listen(8000);

    console.log("Application listening on port 8000");
}

main();
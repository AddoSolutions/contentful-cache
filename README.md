# Not A CMS

Unlike other CMSes called "not a cms" this really isn't a CMS.  So what is it?

**NotACMS is an open source, lightweight, (arguably) the fastest way to make a small to midsize website.**

Ok, everyone makes that claim.

You can skip all this and see a [full example project](https://github.com/AddoSolutions/notacms-example) if you are into that kind of thing.

## I'm Tired of Wordpress… and the rest

If you have not used wordpress, well you probably havent been in the web very long.  

The fact is that the problem CMSes since basically forever have been trying to solve is giving anyone the power to update almost any part on a website without much technical knowledge. The problem is that in reality 99% of my clients don't want, know how to, and if they did they would make a mess of their site. 

So what's the difference here? Well we are looking to solve a slightly different problem.

## What this solves

We are looking to solve the following problems:

* As a developer I want to be able to quickly go from any web template (preferably static as they are cheaper) so a semi-fully dynamic series of web pages.
* As a business owner I want to be able to update certain pieces of information without technical/programming knowledge
* As a developer (and business owner), I don't want my piece of art ending up looking like garbage
* As a human being I want the website to be fast
* As a human being I want the website to be accurate

That is what we are looking to solve (in user story form).

## How is this solved

The dawn of Content as a Service helps us greatly (CaaS);

Today the internet has several really good CaaS platforms.  The one I really like is [Contentful](https://www.contentful.com/), it's free for my size project, it's fast, easy to use, pretty, and has a great API.  The down side to all of these is queries need to be done outside the server which means they will be a hair slower, plus I have limited abilities to query that data, oh and you pay per request.

In addition, they aren't specifically geared toward this end.

So the solution is simple:

1. Scrub the remote datasource and get all its content
2. Bring that data into a local cache (we use MongoDB)
3. Serve all content based on that cache
4. When changes are made, via a webhook, re-trigger #1.

## Supported Services

**Cache Sources**

* MongoDB

**Content Services**

* Contentful

There are some great other options out there, I just started with these two because I like them, but feel free to pull in a request for another option!

## Shut up and Code

Ok, cool.  I like code examples too.  So lets take an example (also shown in the examples folder).

You can also check out a [full example project](https://github.com/AddoSolutions/notacms-example) that is ready to clone and run with.

So in this example, we start off with the following premise:

1. You have an account with Contentful.
2. You have a "Content Model" called `Page` with the following Field IDs `name` `slug` and `file`.
23. in Contenful you create a "Content" Page called "Home" with the slig `index` and file of `index`
3. You have an API token and the space ID.
4. You have some MongoDB server working (we will dockerize all this later)
5. You are using NodeJS 7+

So let's start with the `config.json` file

```json
{
  "space":"l6venjxxxxxx",
  "accessToken": "dcfb534005732364fbbxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "mongo": "mongodb://localhost:27017/notacms"
}
``` 

Easy right?

The following may look long, but consider that this is almost the entirety of your application.  These few lines give you everything from an express, to automatically compiling (and watching) LESS, models, browsersync, redirects, and a bunch more.

All this in ~150 lines of code (and again, that's it).  It is also important to note the contrast between this and a traditional CMS.  This package is NOT a CMS, but is only a way for developers to seamlessly access data that users can easily maintain.  This is just one of infinite possibilities.    

```javascript 1.8
const express = require('express');
const expressNunjucks = require('express-nunjucks'); // Use Nunjucks, it's nice :)
const NotaCMS = require("notacms");
const config = require("./config" + (process.env.APP_DEV ? "-dev" : ""));
const requireGlob = require('require-glob')
const PageModel = require("./lib/pageModel");
const gulp = require("./gulpfile");

const isDev = process.env.APP_DEV; // If you add this it will go to production mode

if(isDev) console.log(" -- DEVELOPMENT MODE --");

async function main() {
    try {

        // Get express kicked off, load models, and configure notacms.
        const app = express(); // Create the express app
        const models = await requireGlob(['lib/models/*.js'])

        const notaCMS = new NotaCMS({ // Configure the application
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
                    "connection": config.mongo // The mongoDB connection string
                }
            },
            "beforeContent": async (collection, record) => {
                if (models[collection]) {
                    return new models[collection](record);
                } else {
                    return record;
                }
            }
        });

        // Get gulp doing it's thang
        gulp.less();
        if(isDev) gulp.watch();

        // Uncomment this to force a full sync
        // await notaCMS.sync();

        // Here we just get the cached content variable. This object will always have the latest content
        var content = await notaCMS.getContent();


        // Check if we need an initial sync (if this is your first time running and ther eare no pages)
        if (!content.page) {
            await notaCMS.sync();
            await notaCMS.getContent();
        }


        // Configure static resources directory
        app.use(express.static('./static'))
        app.use('/modules', express.static('./node_modules'))
        app.set('views', './templates');

        // Configure the nunjucks templating engine for use with express
        const njk = expressNunjucks(app, {
            watch: isDev,
            noCache: isDev
        });

        // This allows you to have your own api hook to bounce the cached content
        app.post('/appsync', async function (req, res) {
            notaCMS.sync();
            res.json({success: true});
        });


        // Otherwise we catch all requests here
        app.get('*', async function (request, response, next) {
            try {
                // Make sure we have the latest content (in most cases it just returns a cached variable).
                await notaCMS.getContent();

                // Now we set some basic connvenience variables
                var url = request.path;
                var selectedPage = false;

                // In 4 lines we determine if we have a routable page here
                for (var type in content) {
                    selectedPage = content[type].find(c => c instanceof PageModel && c.matchesUrl(url))
                    if (selectedPage) break;
                }

                // If we couldn't find the page, pass along to another router (then 404)
                if (!selectedPage) {
                    next();
                    return;
                }

                // Should re redirect? If so, then we will do so here
                if (selectedPage.getRedirect(url, request)) {
                    var redirect = selectedPage.getRedirect();
                    return response.redirect(redirect.code, redirect.location);
                }

                // Render the page, and add content and page to the view for usage
                return response.render(selectedPage.getTemplateFile(), {
                    content: content,
                    page: selectedPage
                });
            } catch (e) {
                console.error(e);
            }

        });

        // Listen on port 8000
        // This is good to use in general, as in production you will forward using docker
        app.listen(8000);

        console.log("Express: Application listening on port 8000");
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

try {
    main();
} catch (e) {
    console.error(e);
}
```

That may seem like a lot, but read it, it's really quite simple.

Then you create a `static` folder, a `template` folder, and name your tempaltes according to the file ID you define in Contentful.  In this case, define `index.html` and go to town.

You can check out [full example here](/example)

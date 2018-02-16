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

Ok, next step is the entirety of your ndoejs application `index.js`:

```javascript 1.8
const express = require('express');
const expressNunjucks = require('express-nunjucks'); // Use Nunjucks, it's nice :)
const NotaCMS = require("notacms");
const config = require("./config")

const isDev = !process.env.APP_PROD; // If you add this it will go to production mode

async function main(){

    const app = express(); // Create the express app

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

    // This is if you want a special route to handle a form submission for example
    app.get('/somethingspecial', (req, res) => {
        return JSON.stringify({"somethingCoolHappened":"Yup"});
    });

    // Otherwise we catch all requests here
    app.get('*', async function(req, res) {
        // Make sure we have the latest content (in most cases it just returns a cached variable).
        var content = await notaCMS.getContent();

        // Check if we need an initial sync (if this is your first time running and ther eare no pages)
        if(content.pages){
            await notaCMS.sync();
            content = await notaCMS.getContent();
        }


        var pages = content.page;
        var url = req.url;
        
        // If nothing is selected, we hit a 404
        var selectedPage = {
            "file":"404"
        }

        // If no page is selected, we assume they want the index
        if(url=="/") url="/index";

        // Loop through the pages to find the right URL
        pages.forEach((page)=>{
            if(page.slug == url.substring(1)){
                selectedPage = page;
                return true;
            }
        });

        // Render the page, and add content and page to the view for usage
        return res.render(selectedPage.file, {
            content: notaCMS.getContent(),
            page: selectedPage
        })



    });

    // Listen on port 8000
    app.listen(8000);

    console.log("Application listening on port 8000");
}

main();
```

That may seem like a lot, but read it, it's really quite simple.

Then you create a `static` folder, a `template` folder, and name your tempaltes according to the file ID you define in Contentful.  In this case, define `index.html` and go to town.

You can check out [full example here](/example)

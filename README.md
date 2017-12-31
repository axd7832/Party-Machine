# Party Machine

An end to the question : "Should I Go Out Tonight?"
![Alt text](media/screenshot.png?raw=true "Screenshot")

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes. See deployment for notes on how to deploy the project on a live system.

### Prerequisites

What things you need to install the software and how to install them
* Node.js
* Heroku

### Installing

A step by step series of examples that tell you have to get a development env running

* Clone Repository
* Install dependencies
```
npm install
```

* Create Heroku Environment
```
heroku create {name}
```
* Set Heroku Env Variables
```
heroku config:set VERIFY_TOKEN=<YOUR_VERIFY_TOKEN_HERE>
heroku config:set PAGE_ACCESS_TOKEN=<YOUR_PAGE_ACCESS_TOKEN_HERE>
```
* Create Heroku Procfile with contents:
```
web: node index.js
```

## Deployment

* Spin Up Heroku Instance
(Local) : port 5000
```
heroku local web
```
Server
```
heroku pg:scale web=1
```
**To turn off set 'web=0'**
* You now should have the web server up and running. Reachable at the url given in the app build.

## Built With

* [Node.js](https://nodejs.org/en/download/) - Server
* [Express](http://expressjs.com/en/guide/routing.html) - Node.js Routing
* [body-parser](https://github.com/expressjs/body-parser) - Node.js Http body parsing


## Authors

* **Andrew Diana**-(https://github.com/axd7832)

See also the list of [contributors](https://github.com/axd7832/PartyMachine/contributors) who participated in this project.


## Acknowledgments

* Developed For The Facebook Messenger Platform

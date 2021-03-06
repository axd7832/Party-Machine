'use strict';
// Imports dependencies and set up http server
const
  express = require('express'),
  bodyParser = require('body-parser'),
  request = require('request'),
  app = express().use(bodyParser.json()); // creates express http server
let goingOutTn = false;
// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening on port 1337'));
// Creates the endpoint for our webhook
app.post('/webhook', (req, res) => {
  let body = req.body;
  // Checks this is an event from a page subscription
  if (body.object === 'page') {
    // Iterates over each entry - there may be multiple if batched
    body.entry.forEach(function(entry) {
      // Gets the message. entry.messaging is an array, but
      // will only ever contain one message, so we get index 0
      let webhookEvent = entry.messaging[0];
      let psid = webhookEvent.sender.id;
      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function
      if (webhookEvent.message) {
        handleMessage(psid, webhookEvent.message);
      } else if (webhookEvent.postback) {
        handlePostback(psid, webhookEvent.postback);
      }
    });
    // Returns a '200 OK' response to all requests
    res.status(200).send('EVENT_RECEIVED');
  } else {
    // Returns a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }
});
// Adds support for GET requests to our webhook
app.get('/webhook', (req, res) => {
  // Random string in env
  let VERIFY_TOKEN = process.env.VERIFY_TOKEN;
  // Parse the query params
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];
  // Checks if a token and mode is in the query string of the request
  if (mode && token) {
    // Checks the mode and token sent is correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      // Responds with the challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  }
});
// Function to get bars from google maps -> place api
// Finds bars that are open, sorted by location nearest
function getBars(lat, long) {
  return new Promise(function(resolve, reject) {
    request({
      "uri": "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
      "qs": {
        'location': lat + ',' + long,
        'type': 'bar',
        'opennow': true,
        'rankby': 'distance',
        'key': process.env.GOOGLE_MAPS_KEY
      },
      "method": "GET",
      "json": true
    }, (err, res, body) => {
      if (err) {
        reject(err);
      }
      resolve(body.results);
      // If Results Were found
    });
  })
}
// Gets more information on places
// Used to get the website of the place
function getBarInfo(place_id) {
  return new Promise(function(resolve, reject) {
    request({
      "uri": "https://maps.googleapis.com/maps/api/place/details/json",
      "qs": {
        'placeid': place_id,
        'key': process.env.GOOGLE_MAPS_KEY
      },
      "method": "GET",
      "json": true
    }, (err, res, body) => {
      if (err) {
        reject(err);
      }
      resolve(body.result.website);
    });
  })
}
// Handles messages events
function handleMessage(sender_psid, received_message) {
  // Checking for location info
  if (received_message.attachments) {
    let lat = received_message.attachments[0].payload.coordinates.lat;
    let long = received_message.attachments[0].payload.coordinates.long;
    // Call for bars near the coords
    getBars(lat, long).then(function(info) {
      let results = info.slice(0, 5);
      let response = {
        attachment: {
          type: "template",
          payload: {
            template_type: "generic",
            elements: []
          }
        }
      }
      let counter = 0;
      for (let i = 0; i < results.length; i++) {
        getBarInfo(results[i].place_id).then(function(website) {
          counter++
          results[i].website = website;
          // Element to push to elements array for the response
          var element = {
            title: results[i].name,
            image_url: "https://maps.googleapis.com/maps/api/place/photo?" +
              "maxwidth=400" +
              "&photoreference=" + results[i].photos[0].photo_reference +
              "&key=" + process.env.GOOGLE_MAPS_KEY,
            subtitle: results[i].vicinity,
            default_action: {
              type: "web_url",
              url: results[i].website,
              webview_height_ratio: "tall"
            },
            buttons: [{
              type: "web_url",
              url: results[i].website,
              title: "View Website"
            }]
          }
          response.attachment.payload.elements.push(element);
          //If the last result, send the payload
          if (counter === results.length) {
            callSendAPI(sender_psid, {
              "text": "Here are the closest bars to you:"
            })
            callSendAPI(sender_psid, response);
          }
        });
      }
    });
  }
  // Checks if the message contains text
  if (received_message.text) {
    // Create the payload for a basic text message, which
    // will be added to the body of our request to the Send API
    switch (received_message.text) {
      case "Should I?":
        response = getAnswer();
        break;
    }
    // Send the response message
    callSendAPI(sender_psid, response);
  }
}

// Handles messaging_postbacks events
function handlePostback(sender_psid, received_postback) {
  let response;
  // Get the payload for the postback
  let payload = received_postback.payload;

  switch (payload) {
    case "Get Started":
      response = {
        "attachment": {
          "type": "template",
          "payload": {
            "template_type": "generic",
            "elements": [{
              "title": "Should You Go Out Tonight?",
              "subtitle": "Click to begin."
            }]
          }
        },
        "quick_replies": [{
          "content_type": "text",
          "title": "Should I?",
          "payload": "Should I?"
        }]
      }
      break;
    case "Should I?":
      response = getAnswer();
      break;
    default:
      response = {
        "text": "I'm not quite sure what you mean"
      }
  }
  // Send the message to acknowledge the postback
  callSendAPI(sender_psid, response);
}
// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {
  showTyping(sender_psid, true);
  console.log("In call send api");
  // Construct the message body
  let request_body = {
    "recipient": {
      "id": sender_psid
    },
    "message": response
  }
  console.log(request_body);
  // Send the HTTP request to the Messenger Platform
  request({
    "uri": "https://graph.facebook.com/v2.6/me/messages",
    "qs": {
      "access_token": process.env.PAGE_ACCESS_TOKEN
    },
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    if (!err) {
      console.log('message sent!')
    } else {
      console.error("Unable to send message:" + err);
    }
    console.log(body);
    showTyping(sender_psid, false);
  });
}
// Show typing call to Send API
function showTyping(sender_psid, bool) {
  // Construct the message body
  let response = 'typing_off';
  if (bool === true) {
    response = 'typing_on';
  } else {
    response = 'typing_off';
  }
  let request_body = {
    "recipient": {
      "id": sender_psid
    },
    "sender_action": response
  }
  // Send the HTTP request to the Messenger Platform
  request({
    "uri": "https://graph.facebook.com/v2.6/me/messages",
    "qs": {
      "access_token": process.env.PAGE_ACCESS_TOKEN
    },
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    if (!err) {
      console.log('toggled typing')
    } else {
      console.error("Unable to toggle typing" + err);
    }
  });
}

function getAnswer() {
  let randomNum = (Math.random() * 10);
  if (randomNum >= 6) {
    return {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Yes!",
            "subtitle": "Share your location to find events near you."
          }]
        }
      },
      "quick_replies": [{
        "content_type": "location"
      }]
    }
  } else {
    return {
      "text": "No! Stay in an catch up on Black Mirror Season 4"
    }
  }
}

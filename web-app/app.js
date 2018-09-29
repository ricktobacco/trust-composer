
'use strict';

//get libraries
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const path = require('path')
var envvar = require('envvar');
var moment = require('moment');

//create express web-app
const app = express();
const router = express.Router();
const plaid = require('plaid');

var PLAID_ENV = envvar.string('PLAID_ENV', 'development');
var PLAID_CLIENT_ID = '5baeebbb05b6800011bec506';
var PLAID_SECRET = '93358966f27eba60ce3334f6b1dd51';
var PLAID_PUBLIC_KEY = '0e156662f1c4288d60e5e21ccf7f6a';

var ACCESS_TOKEN = null;
var PUBLIC_TOKEN = null;
var ITEM_ID = null;

const client = new plaid.Client(
  PLAID_CLIENT_ID,
  PLAID_SECRET,
  PLAID_PUBLIC_KEY,
  plaid.environments[PLAID_ENV]
);

const network = require('./network/network.js');
//var validate = require('./network/validate.js');
//var analysis = require('./network/analysis.js');

app.use(express.static(__dirname + '/public'));
app.use('/scripts', express.static(path.join(__dirname, '/public/scripts')));
app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: false
}));

app.get('/', function(req, res) {
  res.redirect('/home');
});

app.get('/home', function(req, res) {
  res.sendFile(path.join(__dirname + '/public/index.html'));
});

app.get('/user', function(req, res) {
  res.render(path.join(__dirname + '/public/user.ejs'),  {
    PLAID_PUBLIC_KEY: PLAID_PUBLIC_KEY,
    PLAID_ENV: PLAID_ENV,
  });
});

app.get('/issuer', function(req, res) {
  res.sendFile(path.join(__dirname + '/public/issuer.html'));
});

app.get('/service', function(req, res) {
  res.sendFile(path.join(__dirname + '/public/service.html'));
});

app.get('/register', function(req, res) {
  res.sendFile(path.join(__dirname + '/public/register.html'));
});

app.get('/about', function(req, res) {
  res.sendFile(path.join(__dirname + '/public/about.html'));
});

app.post('/get_access_token', function(request, response, next) {
  PUBLIC_TOKEN = request.body.public_token;
  client.exchangePublicToken(PUBLIC_TOKEN, function(error, 
tokenResponse) {
    if (error != null) {
      var msg = 'Could not exchange public_token!';
      console.log(msg + '\n' + JSON.stringify(error));
      return response.json({
        error: msg
      });
    }
    ACCESS_TOKEN = tokenResponse.access_token;
    ITEM_ID = tokenResponse.item_id;
    prettyPrintResponse(tokenResponse);
    response.json({
      access_token: ACCESS_TOKEN,
      item_id: ITEM_ID,
      error: false
    });
  });
});

// Retrieve real-time Balances for each of an Item's accounts
// https://plaid.com/docs/#balance
app.get('/balance', function(request, response, next) {
    client.getBalance(ACCESS_TOKEN, function(error, balanceResponse) {
      if (error != null) {
        prettyPrintResponse(error);
        return response.json({
          error: error,
        });
      }
      prettyPrintResponse(balanceResponse);
      response.json({error: null, balance: balanceResponse});
    });
  });

app.post('/api/userData', function(req, res) {
  var cardID = req.body.cardID;
  var userID = req.body.userID;
  network.userData(cardID, userID)
         .then((info) => {
          if (info.error != null) {
            res.json({
              error: info.error
            });
          } else res.json(info);
         }); 
});

app.post('/api/issuerData', async function(req, res) {
  var cardID = req.body.cardID;
  var issuerID = req.body.issuerID;
  var returnData = {};
  network.issuerData(cardID, issuerID)
         .then(async (issuer) => {
            if (issuer.error != null) {
              res.json({
                error: issuer.error
              });
            } else {
                returnData.name = issuer.name;
      
                returnData.requests = await network.pendingClaimRequests(cardID, issuerID);
                
                if (issuer.trustees)
                  returnData.trustees = issuer.trustees;
                else  
                  returnData.trustees = [];
  
                returnData.assessors = await network.assessorsMinusTrustees(cardID, returnData.trustees);
    
                res.json(returnData);
            }
        });
});

app.post('/api/serviceData', async function(req, res) {
  var cardID = req.body.cardID;
  var serviceID = req.body.name;
  var returnData = {};

  network.serviceData(cardID, serviceID)
         .then(async (service) => {
            if (service.error != null) {
              res.json({
                error: service.error
              });
            } else {
              returnData.name = service.name;
              if (service.trustees)
                returnData.trustees = service.trustees;
              else  
                returnData.trustees = [];
              
              returnData.balance = 0;
              if (service.balances)
                for (let access of service.balances)
                  returnData.balance += access.balance;
                      
              returnData.assessors = await network.assessorsMinusTrustees(cardID, returnData.trustees);
              res.json(returnData);
            }
          });
});

app.post('/api/registerParticipant', function(req, res) {
  var cardID = req.body.cardID;
  var name = req.body.name;
  var type = req.body.type;
  network.registerParticipant(cardID, name, type)
         .then((response) => {
            if (response.error != null)
              res.json({ error: response.error});
            else
              res.json({ success: response});
          });
});

app.post('/api/requestClaim', function(req, res) {
  var cardID = req.body.cardID;
  var issuerID = req.body.issuerID;
  var proofNames = req.body.proofNames;
  var proofHashes = req.body.proofHashes;
  var proofKeys = req.body.proofKeys;
  var proofVals = req.body.proofVals;
  network.requestClaim(cardID, issuerID, proofNames, proofHashes, proofKeys, proofVals)
         .then((response) => {
            if (response.error != null)
              res.json({ error: response.error});
            else
              res.json({ success: response});
          });
});

app.post('/api/issueClaim', function(req, res) {
  var cardID = req.body.cardID;
  var requestID = req.body.requestID;
  var expire = req.body.expire;
  var status = req.body.status;
  var type = req.body.type;
  var name = req.body.name;
  var keys = req.body.keys;
  network.issueClaim(cardID, requestID, expire, status, type, name, keys)
         .then((response) => {
            if (response.error != null)
              res.json({ error: response.error});
            else
              res.json({ success: response});
          });
});

app.post('/api/trustFunction', function(req, res) {
  var cardID = req.body.cardID;
  var claims = req.body.claims;
  var assessorID = req.body.assessorID;
  network.trustFunction(cardID, claims, assessorID)
         .then((response) => {
            if (response.error != null)
              res.json({ error: response.error});
            else
              res.json({ success: response});
          });
});

app.post('/api/trustEquation', function(req, res) {
  var cardID = req.body.cardID;
  var serviceID = req.body.serviceID;
  network.trustEquation(cardID, serviceID)
         .then((response) => {
            if (response.error != null)
              res.json({ error: response.error});
            else
              res.json({ success: response});
          });
});

app.post('/api/accessResource', function(req, res) {
  var cardID = req.body.cardID;
  var serviceID = req.body.serviceID;
  var resourceID = req.body.resourceID;
  network.accessResource(cardID, serviceID, resourceID)
         .then((response) => {
            if (response.error != null)
              res.json({ error: response.error});
            else
              res.json({ success: response});
          });
});

app.post('/api/uploadResource', function(req, res) {
  var cardID = req.body.cardID;
  var resourceID = req.body.resourceID;
  var accessCost = parseInt(req.body.accessCost);
  var contentHash = req.body.contentHash;
  network.uploadResource(cardID, resourceID, accessCost, contentHash)
         .then((response) => {
            if (response.error != null)
              res.json({ error: response.error});
            else
              res.json({ success: response});
          });
});

app.post('/api/issuerAuthorizeAssessor', function(req, res) {
  var cardID = req.body.cardID;
  var assessorID = req.body.assessorID;
  network.issuerAuthorizeAssessor(cardID, assessorID)
         .then((response) => {
            if (response.error != null)
              res.json({ error: response.error});
            else
              res.json({ success: response});
          });
});

app.post('/api/serviceAuthorizeAssessor', function(req, res) {
  var cardID = req.body.cardID;
  var assessorID = req.body.assessorID;
  network.serviceAuthorizeAssessor(cardID, assessorID)
         .then((response) => {
            if (response.error != null)
              res.json({ error: response.error});
            else
              res.json({ success: response});
          });
});

//declare port
var port = process.env.PORT || 8000;
if (process.env.VCAP_APPLICATION) {
  port = process.env.PORT;
}

//run app on port
app.listen(port, function() {
  console.log('app running on port: %d', port);
});

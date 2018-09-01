
const AdminConnection = require('composer-admin').AdminConnection;
const BusinessNetworkConnection = require('composer-client').BusinessNetworkConnection;
const { BusinessNetworkDefinition, CertificateUtil, IdCard } = require('composer-common');

//declate namespace
const namespace = 'net.secure.trust';

//in-memory card store for testing so cards are not persisted to the file system
const cardStore = require('composer-common').NetworkCardStoreManager.getCardStore( { type: 'composer-wallet-inmemory' } );

//admin connection to the blockchain, used to deploy the business network
let adminConnection;

//this is the business network connection the tests will use.
let businessNetworkConnection;
let businessNetworkName = 'trust-network';
let factory;

/*
 * Import card for an identity
 * @param {String} cardName The card name to use for this identity
 * @param {Object} identity The identity details
 */
async function importCardForIdentity(cardName, identity) {

  //use admin connection
  adminConnection = new AdminConnection();

  //declare metadata
  const metadata = {
      userName: identity.userID,
      version: 1,
      enrollmentSecret: identity.userSecret,
      businessNetwork: businessNetworkName
  };

  //get connectionProfile from json, create Idcard
  const connectionProfile = require('./local_connection.json');
  const card = new IdCard(metadata, connectionProfile);

  //import card
  await adminConnection.importCard(cardName, card);
}

module.exports = {
  /*
  * RegisterParticipant and import card for identity
  * @param {String} cardID Import card id for participant
  * @param {String} name Participant name as identifier 
  * @param {String} type Participant type (1 of 4)
  */
 registerParticipant: async function (cardID, name, type) {
    try {
      businessNetworkConnection = new BusinessNetworkConnection();
      await businessNetworkConnection.connect('admin@' + businessNetworkName);
      factory = businessNetworkConnection.getBusinessNetwork().getFactory();

      if (type === 'User' || type === 'Service' || 
      type === 'Assessor' || type === 'Issuer') {
        //create member participant
        const member = factory.newResource(namespace, type, name);
        //add member participant
        const participantRegistry = await businessNetworkConnection.getParticipantRegistry(namespace + '.' + type);
        await participantRegistry.add(member);  
         
        //issue identity
        const identity = await businessNetworkConnection.issueIdentity(namespace + '.' + type + '#' + name, cardID);
        await importCardForIdentity(cardID, identity);
        
        //disconnect
        await businessNetworkConnection.disconnect('admin@' + businessNetworkName);
        return true;
      } else
        throw new Error('Not a valid participant');
    } catch(err) {
        console.log(err);
        var error = {};
        error.error = err.message;
        return error;
      }
  },

  /*
  * Perform RequestClaim transaction
  * @param {String} cardID Card id to connect to network
  * @param {String} issuerID identifier of Issuer
  * @param {String[]} proofNames submitted by user
  * @param {String[]} proofHashes submitted by user
  * @param {String[][]} proofKeys submitted by user
  * @param {String[][]} proofVals submitted by user
  */
  requestClaim: async function (cardID, issuerID, proofNames, proofHashes, proofKeys, proofVals) {
    try {
      //connect to network with cardID
      businessNetworkConnection = new BusinessNetworkConnection();
      await businessNetworkConnection.connect(cardID);

      //get the factory for the business network.
      factory = businessNetworkConnection.getBusinessNetwork().getFactory();
      var proofs = [];
      if (proofNames.length != proofHashes.length)
        throw new Error('Proof data mismatch.');
      for (let i = 0; i < proofNames.length; i++) {
        let proof = factory.newConcept(namespace, 'Proof');
        proof.proofName = proofNames[i];
        proof.proofHash = proofHashes[i];
        proof.data = [];
        if (proofKeys[i].length != proofVals[i].length)
          throw new Erorr('Proof data mismatch.');
        for (let j = 0; j < proofKeys[i].length; j++) {
          let attr = factory.newConcept(namespace, 'Attribute');
          attr.key = proofKeys[i][j];
          attr.val = proofVals[i][j];
          proof.data.push(attr);
        }
        proofs.push(proof);
      }
      //create transaction
      const tx = factory.newTransaction(namespace, 'RequestClaim');
      tx.proof = proofs;
      tx.issuer = issuerID;
      await businessNetworkConnection.submitTransaction(tx);
      await businessNetworkConnection.disconnect(cardID);
      return true;
    } catch(err) {
        console.log(err);
        var error = {};
        error.error = err.message;
        return error;
      }
  },

  /*
  * Perform IssueClaim transaction
  * @param {String} cardID Card id to connect to network
  * @param {String} requestID ClaimRequest
  * @param {String} expire DateTime string
  * @param {String} status ClaimStatus str
  * @param {String} name for ClaimDef
  * @param {String} keys comma separated keys for Claimdef
  * @param {String} type ClaimType for Claimdef
  */
  issueClaim: async function (cardID, requestID, expire, status, type, name, keys) {
    try {
      //connect to network with cardID
      businessNetworkConnection = new BusinessNetworkConnection();
      await businessNetworkConnection.connect(cardID);

      //get the factory for the business network.
      factory = businessNetworkConnection.getBusinessNetwork().getFactory();

      //create transaction
      const tx = factory.newTransaction(namespace, 'IssueClaim');
      tx.requestID = requestID;
      tx.expire = expire;
      tx.status = status;
      tx.type = type;
      tx.name = name;
      tx.keys = keys;

      await businessNetworkConnection.submitTransaction(tx);
      await businessNetworkConnection.disconnect(cardID);
      return true;
    } catch(err) {
        //print and return error
        console.log(err);
        var error = {};
        error.error = err.message;
        return error;
      }
  },

  /*
  * Perform TrustFunction transaction
  * @param {String} cardID Card id to connect to network
  * @param {String[]} claims array of ClaimReceipts identifiers 
  * @param {String} assessorID identifier of trust Assessor
  */
  trustFunction: async function(cardID, claims, assessorID) {
    try {
      //connect to network with cardID
      businessNetworkConnection = new BusinessNetworkConnection();
      await businessNetworkConnection.connect(cardID);
      //get the factory for the business network.
      factory = businessNetworkConnection.getBusinessNetwork().getFactory();
      const receiptRegistry = await businessNetworkConnection.getAssetRegistry(namespace + '.ClaimReceipt');
      //create transaction
      const tx = factory.newTransaction(namespace, 'TrustFunction');
      tx.claims = [];
      tx.assessorID = assessorID;
      for (let claim of claims) {
        let exists = await receiptRegistry.exists(claim);
        if (exists)
          tx.claims.push(claim);
      }
      await businessNetworkConnection.submitTransaction(tx);
      await businessNetworkConnection.disconnect(cardID);
      return true;
    } catch(err) {
        console.log(err);
        var error = {};
        error.error = err.message;
        return error;
      }
  },

  /*
  * Perform TrustEquation transaction
  * @param {String} cardID Card id to connect to network
  * @param {String} serviceID identifier of Service
  */
  trustEquation: async function(cardID, serviceID) {
    try {
      //connect to network with cardID
      businessNetworkConnection = new BusinessNetworkConnection();
      await businessNetworkConnection.connect(cardID);
      //get the factory for the business network.
      factory = businessNetworkConnection.getBusinessNetwork().getFactory();
      //create transaction
      const tx = factory.newTransaction(namespace, 'TrustEquation');
      tx.serviceID = serviceID;

      //TODO: fire new balance
      // businessNetworkConnection.on('event', (event) => {
      //   // event: { "$class": "org.namespace.BasicEvent", "eventId": "0000-0000-0000-000000#0" }
      //   console.log(event.contentHash);
      // });

      await businessNetworkConnection.submitTransaction(tx);
      await businessNetworkConnection.disconnect(cardID);
      return true;
    } catch(err) {
        console.log(err);
        var error = {};
        error.error = err.message;
        return error;
      }
  },

  /*
  * Perform AccessResource transaction
  * @param {String} cardID Card id to connect to network
  * @param {String} serviceID identifier of Service
  * @param {String} resourceID identifier of Resource
  */
  accessResource: async function(cardID, serviceID, resourceID) {
   try {
    //connect to network with cardID
    businessNetworkConnection = new BusinessNetworkConnection();
    await businessNetworkConnection.connect(cardID);
    //get the factory for the business network.
    factory = businessNetworkConnection.getBusinessNetwork().getFactory();
    //create transaction
    const tx = factory.newTransaction(namespace, 'AccessResource');
    tx.serviceID = serviceID;
    tx.resourceID = resourceID;
    businessNetworkConnection.on('event', (event) => {
      // event: { "$class": "org.namespace.BasicEvent", "eventId": "0000-0000-0000-000000#0" }
      console.log(event.contentHash);
    });
    await businessNetworkConnection.submitTransaction(tx);
    await businessNetworkConnection.disconnect(cardID);
    return true;
    } catch(err) {
        console.log(err);
        var error = {};
        error.error = err.message;
        return error;
      }
  },

  /*
  * Perform UploadResource transaction
  * @param {String} cardID Card id to connect to network
  * @param {String} resourceID identifier for resource
  * @param {String} accessCost for resource access
  * @param {String} contentHash of resource
  */
  uploadResource: async function(cardID, resourceID, accessCost, contentHash) {
    try {
      //connect to network with cardID
      businessNetworkConnection = new BusinessNetworkConnection();
      await businessNetworkConnection.connect(cardID);
      //get the factory for the business network.
      factory = businessNetworkConnection.getBusinessNetwork().getFactory();
      //create transaction
      const tx = factory.newTransaction(namespace, 'UploadResource');
      tx.resourceID = resourceID;
      tx.accessCost = accessCost;
      tx.contentHash = contentHash;

      await businessNetworkConnection.submitTransaction(tx);
      await businessNetworkConnection.disconnect(cardID);
      return true;
    } catch(err) {
        console.log(err);
        var error = {};
        error.error = err.message;
        return error;
      }
  },

  /*
  * Perform IssuerAuthorizeAssessor transaction
  * @param {String} cardID Card id to connect to network
  * @param {String} assessorID identifier of Assessor
  */
  issuerAuthorizeAssessor: async function(cardID, assessorID) {
    try {
      //connect to network with cardID
      businessNetworkConnection = new BusinessNetworkConnection();
      await businessNetworkConnection.connect(cardID);

      //get the factory for the business network.
      factory = businessNetworkConnection.getBusinessNetwork().getFactory();

      //create transaction
      const tx = factory.newTransaction(namespace, 'IssuerAuthorizeAssessor');
      tx.assessorID = assessorID;

      await businessNetworkConnection.submitTransaction(tx);
      await businessNetworkConnection.disconnect(cardID);
      return true;
    } catch(err) {
        console.log(err);
        var error = {};
        error.error = err.message;
        return error;
    }
  },

  /*
  * Perform ServiceAuthorizeAssessor transaction
  * @param {String} cardID Card id to connect to network
  * @param {String} assessorID identifier of Assessor
  */
  serviceAuthorizeAssessor: async function(cardID, assessorID) {
    try {
      //connect to network with cardID
      businessNetworkConnection = new BusinessNetworkConnection();
      await businessNetworkConnection.connect(cardID);

      //get the factory for the business network.
      factory = businessNetworkConnection.getBusinessNetwork().getFactory();
      //create transaction
      const tx = factory.newTransaction(namespace, 'ServiceAuthorizeAssessor');
      tx.assessorID = assessorID;

      await businessNetworkConnection.submitTransaction(tx);
      await businessNetworkConnection.disconnect(cardID);
      return true;
    } catch(err) {
        console.log(err);
        var error = {};
        error.error = err.message;
        return error;
    }
  },

  /*
  * Get all pendin ClaimRequests for Issuer to issue on top of
  * @param {String} cardID Card id to connect to network
  * @param {String} assessorID identifier of Assessor
  */
 pendingClaimRequests: async function(cardID, issuerID) {
   try {
    //connect to network with cardID
    businessNetworkConnection = new BusinessNetworkConnection();
    await businessNetworkConnection.connect(cardID);
    //get the factory for the business network.
    factory = businessNetworkConnection.getBusinessNetwork().getFactory();
    const results = await businessNetworkConnection.query('PendingClaimsByIssuer', {
                                                          'issuer' : 'resource:net.secure.trust.Issuer#' + issuerID
                                                        });
    await businessNetworkConnection.disconnect(cardID);
    return results;
  } catch(err) {
      console.log(err);
      var error = {};
      error.error = err.message;
      return error;
    }
  },

  /*
  * Get all untrusted Assessors
  * @param {String} cardId Card id to connect to network
  */
 assessorsMinusTrustees : async function (cardID, trustees) {
  try {
    //connect to network with cardId
    businessNetworkConnection = new BusinessNetworkConnection();
    await businessNetworkConnection.connect(cardID);
    //query all partners from the network
    const allAssessors = await businessNetworkConnection.query('selectAssessors');
    //disconnect
    var assessors = allAssessors.filter((item) => {
      return trustees.indexOf(item.$identifier) < 0;
    })
    await businessNetworkConnection.disconnect(cardID);
    //return allPartners object
    return assessors;
  } catch(err) {
      //print and return error
      console.log(err);
      var error = {};
      error.error = err.message;
      return error
    }
  },

  /*
  * Get all relevant User data for UI
  * @param {String} cardId Card id to connect to network
  */
 serviceData : async function (cardID, serviceID) {
  try {
    //connect to network with cardId
    businessNetworkConnection = new BusinessNetworkConnection();
    await businessNetworkConnection.connect(cardID);
    //get member from the network
    const serviceRegistry = await businessNetworkConnection.getParticipantRegistry(namespace + '.Service');
    const service = await serviceRegistry.get(serviceID);
    //disconnect
    await businessNetworkConnection.disconnect(cardID);
    return service;
  } catch(err) {
      console.log(err);
      var error = {};
      error.error = err.message;
      return error
    }
  },

  /*
  * Get all relevant User data for UI
  * @param {String} cardId Card id to connect to network
  */
 issuerData : async function (cardID, issuerID) {
  try {
    //connect to network with cardId
    businessNetworkConnection = new BusinessNetworkConnection();
    await businessNetworkConnection.connect(cardID);
    //get member from the network
    const issuerRegistry = await businessNetworkConnection.getParticipantRegistry(namespace + '.Issuer');
    const issuer = await issuerRegistry.get(issuerID);
    //disconnect
    await businessNetworkConnection.disconnect(cardID);
    return issuer;
  } catch(err) {
      console.log(err);
      var error = {};
      error.error = err.message;
      return error
    }
  },

  /*
  * Get all relevant User data for UI
  * @param {String} cardId Card id to connect to network
  */
 userData : async function (cardID, userID) {
  try {
    //connect to network with cardId
    businessNetworkConnection = new BusinessNetworkConnection();
    await businessNetworkConnection.connect(cardID);
    //query all partners from the network
    const userRegistry = await businessNetworkConnection.getParticipantRegistry(namespace + '.User');
    const issuerRegistry = await businessNetworkConnection.getParticipantRegistry(namespace + '.Issuer');
    const user = await userRegistry.get(userID);

    var returnData = {
      'name' : user.name, 'receipts' : [], 'services' : []
    };
    let receipts = await businessNetworkConnection.query('ReceiptsBySubject', 
    { 'subject': 'resource:net.secure.trust.User#' + userID, 
    });
    returnData['receipts'] = [];
    for (let receipt of receipts) {
      let r = { 'claimID' : receipt.claimID, 'issuer' : receipt.holder.$identifier};
      let issuer = await issuerRegistry.get(receipt.holder.$identifier);
      r['trustees'] = issuer.trustees;
      returnData['receipts'].push(r);
    }

    returnData['issuers'] = await businessNetworkConnection.query('selectIssuers');
    let services = await businessNetworkConnection.query('selectServices');
    
    for (let service of services) {
      let s = { 'name' : service.$identifier,
                'balance' : 0,
                'resources' : [] 
              };
      if (service.balances)
        for (let balance of service.balances)
          if (balance.user.$identifier === userID)
            s['balance'] = balance.balance;

      returnData['services'].push(s);
    }
    
    let resources = await businessNetworkConnection.query('selectResources');
    for (let resource of resources)
      for (let service of returnData['services'])
        if (resource.owner.$identifier === service['name']) {
          let r = { 
            'resourceID' : resource.resourceID, 
            'accessCost' : resource.accessCost,
            'contentHash': resource.contentHash
          };
          service['resources'].push(r);
        }
        
    await businessNetworkConnection.disconnect(cardID);
    return returnData;
  } catch(err) {
      console.log(err);
      var error = {};
      error.error = err.message;
      return error
    }
  },

  /*
  * Get all Trustees for Issuer to remove TODO: this req another tx
  * @param {String} cardID Card id to connect to network
  * @param {String} type of Participant (Issuer/Service)
  */
//  getTrustees: async function(cardID) {
//   try {
//     //connect to network with cardID
//     businessNetworkConnection = new BusinessNetworkConnection();
//     await businessNetworkConnection.connect(cardID, type);
//     //get the factory for the business network.
//     factory = businessNetworkConnection.getBusinessNetwork().getFactory();
//     const results = await businessNetworkConnection.query('PendingClaimsByIssuer', {
//                                                           'issuerID' : 'resource:net.secure.trust.Issuer#' + issuerID
//                                                         });
//     await businessNetworkConnection.disconnect(cardID);
//     return results;
//   } catch(err) {
//       console.log(err);
//       var error = {};
//       error.error = err.message;
//       return error;
//     }
//   },

  //TODO: ADD TRANSACTION HISTORIES FOR ALL PARTIES

}
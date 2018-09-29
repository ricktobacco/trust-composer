/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

/* global getParticipantRegistry emit */

const namespace = 'net.secure.trust';

/**
 * RequestClaim transaction
 * @param {net.secure.trust.RequestClaim} tx passed tx body
 * @transaction
 */

async function RequestClaim(tx) {
  const holder = getCurrentParticipant().getIdentifier();
  const claims = await query('ClaimsByUserAndIssuer', 
                            { 'holder': 'resource:net.secure.trust.User#' + holder, 
                              'issuer': 'resource:net.secure.trust.Issuer#' + tx.issuer
                            });
  const claimID = holder + '.' + tx.issuer + '#' + claims.length;

  const issuerRegistry = await getParticipantRegistry(namespace + '.Issuer');
  const claimRequestRegistry = await getAssetRegistry(namespace + '.ClaimRequest');
  const issuer = await issuerRegistry.get(tx.issuer);
  
  const factory = getFactory();
  var request = factory.newResource(namespace, 'ClaimRequest', claimID);
  request.issuer = factory.newRelationship(namespace, 'Issuer', issuer.$identifier);
  request.holder = factory.newRelationship(namespace, 'User', holder);
  request.proof = tx.proof;
  
  await claimRequestRegistry.add(request);
}

/**
 * IssueClaim transaction
 * @param {net.secure.trust.IssueClaim} tx passed transaction body
 * @transaction
 */
async function IssueClaim(tx) {
  const claimRequestRegistry = await getAssetRegistry(namespace + '.ClaimRequest');
  const issuerRegistry = await getParticipantRegistry(namespace + '.Issuer');
  let request = await claimRequestRegistry.get(tx.requestID);
  const issuer = getCurrentParticipant();
  
  if (request.issuer.getIdentifier() !== issuer.getIdentifier())
    throw new Error('Given issuer cannot issue this claim');
    
  request.status = tx.status;
  await claimRequestRegistry.update(request);  
  
  if (request.status === 'APPROVED') {
    const factory = getFactory();
    const claimReceiptRegistry = await getAssetRegistry(namespace + '.ClaimReceipt');
    
    var receipt = factory.newResource(namespace, 'ClaimReceipt', tx.requestID + '.Receipt');  
    receipt.holder = factory.newRelationship(namespace, 'Issuer', issuer.getIdentifier());
    receipt.req = factory.newRelationship(namespace, 'ClaimRequest', tx.requestID);
    receipt.claimSubject = factory.newRelationship(namespace, 'User', request.holder.$identifier); //TODO: make custom
    receipt.def = factory.newConcept(namespace, 'ClaimDefinition');
    receipt.def.name = tx.name;
    receipt.def.type = tx.type;
    
    if (!issuer.claimDefs)
      issuer.claimDefs = [];
    else
      for (def of issuer.claimDefs)
        if (def.name === tx.name 
         && def.type === tx.type) {
          tx.keys = def.keys.join();
          break;
         }
    if (tx.keys !== '') 
      receipt.def.keys = tx.keys.split(',');
    else
      receipt.def.keys = [];
    
    for (let proof of request.proof) {
      const name = proof.proofName;
      for (let attribute of proof.data)
        if (receipt.def.keys.indexOf(attribute.key) < 0 && tx.keys === '')
          receipt.def.keys.push(name + '.' + attribute.key);
    } issuer.claimDefs.push(receipt.def);
    
    receipt.expireDate = new Date(tx.expire);
    receipt.issuedDate = new Date();
    
    await issuerRegistry.update(issuer);
    await claimReceiptRegistry.add(receipt);
  }
}

/**
 * TrustFunction transaction
 * @param {net.secure.trust.TrustFunction} tx passed tx body
 * @transaction
 */

async function TrustFunction(tx) {
  const assessorRegistry = await getParticipantRegistry(namespace + '.Assessor');
  const assessorExists = await assessorRegistry.exists(tx.assessorID);
  if (assessorExists) {
    const factory = getFactory();
    const user = getCurrentParticipant().getIdentifier(); 
    const issuerRegistry = await getParticipantRegistry(namespace + '.Issuer');
    const receiptRegistry = await getAssetRegistry(namespace + '.ClaimReceipt');
    var counts = [0, 0, 0];
    var claimSet = [];
    var level = '';
    for (let claim of tx.claims) {
      let receipt = await receiptRegistry.get(claim);
      let issuer = await issuerRegistry.get(receipt.holder.$identifier);
      // the subject of receipt ie holder of corresponding request is the calling user
      if (receipt.claimSubject.$identifier === user
          && receipt.expireDate > new Date() 
          && issuer.trustees.indexOf(tx.assessorID) > -1) {
            if (receipt.def.type == 'USER') counts[0]++;
            else if (receipt.def.type == 'DEVICE') counts[1]++;
            else if (receipt.def.type == 'CONTEXT') counts[2]++;
            claimSet.push(factory.newRelationship(namespace, 'ClaimReceipt', claim));
      }
    } 
    if (counts[0] > 0 || counts[1] > 0 || counts[2] > 0) 
      {   level = 'BBB';
      if (counts[0] > 1 || counts[1] > 1 || counts[2] > 1) 
      {   level = 'A';
        if ((counts[0] > 1 && counts[1] > 1) 
        || (counts[0] > 1 && counts[2] > 1) 
        || (counts[1] > 1 && counts[2] > 1)) 
        { level = 'AA';
          if (counts[0] > 1 && counts[1] > 1 && counts[2] > 1)
            level = 'AAA';
        }
      }
    } if (level !== '') {
        const trustRegistry = await getAssetRegistry(namespace + '.Trust'); 
        const trusts = await query('TrustsByUserAndAssessor', 
                            { 'holder': 'resource:net.secure.trust.User#' + user, 
                              'grantor': 'resource:net.secure.trust.Assessor#' + tx.assessorID
                            });
        var trust = factory.newResource(namespace, 'Trust', tx.assessorID + '.' + user + '.Trust#' + trusts.length); 
        trust.grantor = factory.newRelationship(namespace, 'Assessor', tx.assessorID);
        trust.holder = factory.newRelationship(namespace, 'User', user);
        trust.level = level;
        trust.claimSet = claimSet;
        await trustRegistry.add(trust);
    }
  }
}  

/**
 * TrustEquation transaction
 * @param {net.secure.trust.TrustEquation} tx passed tx body 
 * @transaction
 */

async function TrustEquation(tx) { 
  const user = getCurrentParticipant().getIdentifier(); 
  const userRegistry = await getParticipantRegistry(namespace + '.User');
  const serviceRegistry = await getParticipantRegistry(namespace + '.Service');

  const userExists = await userRegistry.exists(user);
  const serviceExists = await serviceRegistry.exists(tx.serviceID);
  if (userExists == false || serviceExists == false)
    throw new Error('Check access balance ids');

  //TODO: MAKE SURE ACCESS BALANCE OWNED BY SERVICE WRTIABLE BY USER 
  const service = await serviceRegistry.get(tx.serviceID);
  const trusts = await query('TrustsByUser', 
                            { 'holder': 'resource:net.secure.trust.User#' + user, 
                            });
  var balance = 0; //TODO: future this shouldnt be hardcoded
  for (let trust of trusts) {
    if (service.trustees.indexOf(trust.grantor.$identifier) >= 0) {
      if (trust.level === 'BBB')
        balance += 7;
      else if (trust.level === 'A')
        balance += 14;
      else if (trust.level === 'AA')
        balance += 21;
      else if (trust.level === 'AAA')
        balance += 28;
    } 
  }
  var found = false;
  var balances = service.balances;
  if (!balances) balances = [];
  else {
    for (let access of balances) 
      if (access.user.getIdentifier() === user) {
        access.balance += balance;
        found = true;
        break;
      }
  } if (!found) {
      const factory = getFactory();
      var accessBalance = factory.newConcept(namespace, 'AccessBalance');
      accessBalance.user = factory.newRelationship(namespace, 'User', user);
      accessBalance.balance = balance;
      balances.push(accessBalance);
  }
  service.balances = balances;
  await serviceRegistry.update(service);
 
  // let event = getFactory().newEvent('net.secure.trust', 'TrustGranted');
  // event.trusts = trusts;
  // event.balance = accessBalace;
  // emit(event); //public event
}

/**
 * AccessResource transaction
 * @param {net.secure.trust.AccessResource} tx passed tx body
 * @transaction
 */

async function AccessResource(tx) {
  const user = getCurrentParticipant();

  const resourceRegistry = await getAssetRegistry(namespace + '.Resource');
  const serviceRegistry = await getParticipantRegistry(namespace + '.Service');

  const resourceExists = await resourceRegistry.exists(tx.resourceID);
  const serviceExists = await serviceRegistry.exists(tx.serviceID);
  if (!user || serviceExists == false || resourceExists == false)
    throw new Error('Check balance ids or resource id');
  
  const service = await serviceRegistry.get(tx.serviceID);
  const resource = await resourceRegistry.get(tx.resourceID);
  const cost = resource.accessCost;

  var found = false;
  var balances = service.balances;
  for (let access of balances) {
    if (access.user.getIdentifier() === user.getIdentifier()) {
      found = true;
      if (access.balance - cost < 0)
        throw new Error('Trying to spend more points than available');
      else 
        access.balance -= cost;
      break;
    }
  } 
  if (found != true)
    throw new Error('Trying to spend a balance which does not exist');

  service.balances = balances;
  await serviceRegistry.update(service);

  let event = getFactory().newEvent('net.secure.trust', 'ResourceReleased');
  event.contentHash = resource.contentHash;
  emit(event); //TODO: private event, only for user
}

/**
 * UploadResource transaction
 * @param {net.secure.trust.UploadResource} tx passed tx body
 * @transaction
 */

async function UploadResource(tx) {
  const service = getCurrentParticipant().getIdentifier();
  const resourceID = service + '.' + tx.resourceID;
  const resourceRegistry = await getAssetRegistry(namespace + '.Resource');

  const resourceExists = await resourceRegistry.exists(resourceID);
  if (resourceExists)
    throw new Error('Resource with given id already exists');
  
  const factory = getFactory();
  var resource = factory.newResource(namespace, 'Resource', resourceID);
  resource.owner = factory.newRelationship(namespace, 'Service', service);
  resource.accessCost = tx.accessCost;
  resource.contentHash = tx.contentHash;
  
  await resourceRegistry.add(resource);
}

/**
 * IssuerAuthorizeAssessor transaction
 * @param {net.secure.trust.IssuerAuthorizeAssessor} tx
 * @transaction
 */
async function IssuerAuthorizeAssessor(tx) {
  const issuer = getCurrentParticipant();
  if (!issuer)
    throw new Error('Issuer does not exist.');
  
  let index = -1;
  if (!issuer.trustees)
    issuer.trustees = [];
  else
    index = issuer.trustees.indexOf(tx.assessorID);

  if (index < 0) {
    issuer.trustees.push(tx.assessorID);
    const issuerRegistry = await getParticipantRegistry(namespace + '.Issuer');
    await issuerRegistry.update(issuer);
  }
}

/**
 * ServiceAuthorizeAssessor transaction 
 * @param {net.secure.trust.ServiceAuthorizeAssessor} tx
 * @transaction
 */
async function ServiceAuthorizeAssessor(tx) {
  const service = getCurrentParticipant();
  if (!service)
    throw new Error('Service does not exist.');
  
  let index = -1;
  if (!service.trustees)
    service.trustees = [];
  else
    index = service.trustees.indexOf(tx.assessorID);

  if (index < 0) {
    service.trustees.push(tx.assessorID);
    const serviceRegistry = await getParticipantRegistry(namespace + '.Service');
    await serviceRegistry.update(service);
  }
}

var apiUrl = location.protocol + '//' + location.host + "/api/";

//check user input and call server
$('.sign-in-user').click(function() {
  updateUser();
});

function findCommonElements(arr) {
  // an array to hold the count of each elements in the input elements
  var lookupArray = [];
  // an array to hold the common elements in all the array
  var commonElementArray = [];
  // iterates through each elements in the array to find the common elements
  for (var arrayIndex = 0; arrayIndex < arr.length; arrayIndex++) {
    for (var childArrayIndex = 0; childArrayIndex < arr[arrayIndex].length; childArrayIndex++) {
      // check whether we have already find the current element
      if (lookupArray[arr[arrayIndex][childArrayIndex]]) {
        // we have already seen this element, so increment count by one
        lookupArray[arr[arrayIndex][childArrayIndex]]++;
      } else {
        // this is a new element so set the count to 1
        lookupArray[arr[arrayIndex][childArrayIndex]] = 1;
      }
      // check the updated count of the current element in the look up table, if the 
      // count is same as the number of input arrays, then its a common element
      if (lookupArray[arr[arrayIndex][childArrayIndex]] == arr.length) {
        // this is a common element, push it to the array
        commonElementArray.push(arr[arrayIndex][childArrayIndex]);
      }
    }
  }
  return commonElementArray;
}

function updateUser() {
  //get user input data
  var userName = $('.user-id input').val();
  var formcardID = $('.card-id input').val();
  
  //create json data
  var inputData = '{' + '"userID" : "' + userName + '", ' + '"cardID" : "' + formcardID + '"}';
  //make ajax call
  $.ajax({
    type: 'POST',
    url: apiUrl + 'userData',
    data: inputData,
    dataType: 'json',
    contentType: 'application/json',
    beforeSend: function() {
      //display loading
      document.getElementById('loader').style.display = "block";
    },
    success: function(data) {
      //remove loader
      document.getElementById('loader').style.display = "none";
      //check data for error
      if (data.error) {
        alert(data.error);
        return;
      } else {
        // REQUEST CLAIM BEGIN
        var proofData = {};
        let proofsHTML = '<b>Add Proofs</b>' +
        '<button class="fas fa-plus btn btn-default add_proof" data-toggle="modal" data-target="#myModal" style="float: right;"></button>' +
        '<br><br>';
        let attrHTML = "<div class='row'> <label for='key' style='margin-left: 10px; margin-right: 24px;'>Key: </label> <input name='key' class='key col-md-10'></input> </div><br> <div class='row'> <label for='value' style='margin-left: 10px; margin-right: 12px;'>Value: </label> <input name='value' class='key col-md-10'></input> </div>";
        $('.add_attr').click(function(){
            $(".modal-body").append("<br>" + attrHTML);
        });
        $('.add_proof').click(function() {
            $('input[name="proofName"]').val("");
            $('input[name="proofHash"]').val("");
            $(".modal-body").html(attrHTML);
        });
        $('.save-proof').click(function(){
            let keys = [];
            $('input[name="key"]').each(function(){
                if ($(this).val().length)
                    keys.push($(this).val());
            })
            let vals = [];
            $('input[name="value"]').each(function(){
                if ($(this).val().length)
                    vals.push($(this).val());
            })
            let name = $('input[name="proofName"]').val(); 
            let hash = $('input[name="proofHash"]').val(); 
            if (keys.length == vals.length && keys.length > 0)
              if (!proofData[name])
                $('.proofs').append("<p>" + name + "</p>");
            proofData[name] = {'hash' : hash, 'keys' : keys, 'vals' : vals};
            console.log(proofData);
        });
        $('.issuer_selector').html(function(){
          var str = '<option value="" disabled="" selected="">select</option>';
          for (let issuer of data['issuers']){
            let name = '"' + issuer.name + '"';
            str += '<option value=' + name + '>' + issuer.name + '</option>';
          }
          return str;
        });
        $('.request-claim').click(function() {
          let issuerID = $('.issuer_selector').val();
          console.log(issuerID);
          let inputData = { 'cardID' : formcardID,
                          'issuerID' : issuerID,
                        'proofNames' : [],
                       'proofHashes' : [],
                         'proofKeys' : [],
                         'proofVals' : [] };
          Object.keys(proofData).forEach(function(key) {
            inputData.proofNames.push(key);
            inputData.proofHashes.push(proofData[key].hash);
            inputData.proofKeys.push(proofData[key]['keys']);
            inputData.proofVals.push(proofData[key]['vals']);
          });
          if (inputData.proofNames.length != inputData.proofHashes.length 
          || inputData.proofNames.length != inputData.proofKeys.length 
          || inputData.proofNames.length != inputData.proofVals.length) {
            alert("Cannot request claim with given parameters");
            return;
          }
          $('.proofs').html(proofsHTML);
          $.ajax({
            type: 'POST',
            url: apiUrl + 'requestClaim',
            data: JSON.stringify(inputData),
            dataType: 'json',
            contentType: 'application/json',
            beforeSend: function() {
              //display loading
              document.getElementById('loader').style.display = "block";
            },
            success: function(res) {
              //remove loader
              document.getElementById('loader').style.display = "none";
              //check data for error
              if (res.error) {
                alert(res.error);
                return;
              } else {
                alert("Claim Requested!");
              }
            },
            error: function(jqXHR, textStatus, errorThrown) {
              console.log(errorThrown); console.log(textStatus); console.log(jqXHR);
              location.reload();
            }
          });        
        });
        // REQUEST CLAIM END

        //EARN TRUST BEGIN
        var trustees = [];
        var claimIDs = [];
	      $('.receipt_selector').html(function() {
          var str = '<option value="" disabled="" selected="">select</option>';
          for (let receipt of data['receipts'])
            str += '<option value=' + receipt.claimID + '> ' + receipt.claimID + '</option>';
          return str;
        });
	      $('.add-receipt').click(function(){
          let claimID = $('.receipt_selector').val();
          claimIDs.push(claimID);
          var claim;
          for (let receipt of data.receipts)
            if (receipt.claimID === claimID) {
              claim = receipt;
              break;
            }
          $('#chosenReceipts').append("<p>" + claimID + "</p>");
          $('.receipt_selector option[value="'+ claimID + '"]').remove();
          if ($('.receipt_selector').children('option').length < 2) {
            $(this).hide();
            $('.receipt_selector').hide();
          }
          if (!$('.earn-trust-button').length)
            $('.addReceipts').append(
              "<br><p><b>Pick Assessor</b></p><select class='form-control pick_assessor'></select><br><br>"
            +
                "<button class='btn btn-primary earn-trust-button'>Earn Trust</button>"
            );
          if (!trustees.length)
            trustees = claim.trustees;
          else {
            let compare = findCommonElements([trustees, claim.trustees]);
            if (!compare.length)
              trustees.concat(claim.trustees);
            else 
              trustees = compare;
          } 
          let str = '';
          for (let trustee of trustees)
            str += '<option value=' + trustee + '> ' + trustee + '</option>';
          $('.pick_assessor').html(str);
          $('.earn-trust-button').click(function(){
            let assessorID =  $('.pick_assessor').val();
            let inputData = { 'cardID' : formcardID, 
                              'claims' : claimIDs,
                              'assessorID' : assessorID };
            $('#chosenReceipts').html("");
            console.log(inputData);
            $.ajax({
              type: 'POST',
              url: apiUrl + 'trustFunction',
              data: JSON.stringify(inputData),
              dataType: 'json',
              contentType: 'application/json',
              beforeSend: function() {
                //display loading
                document.getElementById('loader').style.display = "block";
              },
              success: function(res) {
                //remove loader
                document.getElementById('loader').style.display = "none";
                //check data for error
                if (res.error) {
                  alert(res.error);
                  return;
                } else
                    alert("Trust Earned!");
              },
              error: function(jqXHR, textStatus, errorThrown) {
                console.log(errorThrown); console.log(textStatus); console.log(jqXHR);
                location.reload();
              }
            });        
          });
        });
        
        //EARN TRUST END

        //ACCESS BALANCE BEGIN
        $('.service_selector').html(function(){
          var str = '<option value="" disabled="" selected="">select</option>';
          for (let service of data['services']) {
            let name = '"' + service.name + '"';
            str += '<option value=' + name + '> ' + service.name + '</option>';
          }
          return str;
        });
        $('.service_selector').change(function(){
          var serviceID = $(this).val();    
          let inputData = '{' + '"cardID" : "' + formcardID + '", ' +
                             '"serviceID" : "' + serviceID + '"}';
          console.log(inputData);
          for (let service of data['services'])
            if (service.name === serviceID) {
              if (!service.balance)
                $.ajax({
                  type: 'POST',
                  url: apiUrl + 'trustEquation',
                  data: inputData,
                  dataType: 'json',
                  contentType: 'application/json',
                  beforeSend: function() {
                    //display loading
                    document.getElementById('loader').style.display = "block";
                  },
                  success: function(res) {
                    //remove loader
                    document.getElementById('loader').style.display = "none";
                    //check data for error
                    if (res.error) {
                      alert(res.error);
                      return;
                    } else {
                      alert('Balance updated for ' + serviceID);
                      service.balance = res;
                    }
                  },
                  error: function(jqXHR, textStatus, errorThrown) {
                    console.log(errorThrown); console.log(textStatus); console.log(jqXHR);
                    location.reload();
                  }
                });
              break;
            }
            
          $('.resource_selector').html(function(){
            var str = '<option value="" disabled="" selected="">select</option>';
            for (let service of data['services'])
              if (service.name === serviceID)
                for (let resource of service.resources) {
                  let name = '"' + resource.resourceID + '"';
                  str += '<option value=' + name + '> ' + resource.resourceID + '</option>';
                }
            return str;
          });
        });
        $('.access-resource-button').click(function(){
          var serviceID = $('.service_selector').val();
          var resourceID = $('.resource_selector').val();    
          let inputData = '{' + '"cardID" : "' + formcardID + '", ' +
                             '"serviceID" : "' + serviceID + '", ' +
                             '"resourceID" : "' + resourceID + '"}';
          console.log(inputData);
          console.log(data.services);
          let cost;
          let balance;
          let hash;
          for (let service of data['services'])
              if (service.name === serviceID) {
                balance = service.balance;
                for (let resource of service.resources)
                  if (resource.resourceID === resourceID) {
                    cost = resource.accessCost;
                    hash = resource.contentHash;
                  }
              }

          //if (balance - cost >= 0) 
            $.ajax({
              type: 'POST',
              url: apiUrl + 'accessResource',
              data: inputData,
              dataType: 'json',
              contentType: 'application/json',
              beforeSend: function() {
                //display loading
                document.getElementById('loader').style.display = "block";
              },
              success: function(res) {
                //remove loader
                document.getElementById('loader').style.display = "none";
                //check data for error
                if (res.error) {
                  alert(res.error);
                  return;
                } else
                  window.setTimeout(function(){ window.location = "http://ipfs.io/ipfs/" + hash; }, 100);
              },
              error: function(jqXHR, textStatus, errorThrown) {
                console.log(errorThrown); console.log(textStatus); console.log(jqXHR);
                location.reload();
              }
            });
          //else  alert('Resource access costs more than available balance...go earn more trust');
          
        });
        // ACCESS BALANCE END

        //update heading
        $('.user-name').html(function() {
          var str = '<b><u>User</u> name : </b>' + '<i>' + data.name + '</i>';
          return str;
        });
        //remove login section and display member page
        document.getElementById('loginSection').style.display = "none";
        //display transaction section
        document.getElementById('transactionSection').style.display = "block";
      }
    },
    error: function(jqXHR, textStatus, errorThrown) {
      //reload on error
      alert("Error: Try again")
      console.log(errorThrown);
      console.log(textStatus);
      console.log(jqXHR);
    },
    complete: function() {}
  });
}
